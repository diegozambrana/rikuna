import "server-only"
import { getProviderDirectory } from "@/ingestion/tmdb-sync/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { AvailabilitySyncServices, MediaAvailabilityServices } from "@/services"
import { normalizeProviderName } from "@/constants/tmdbProviders"
import { buildPlatformIndex, resolvePlatformId, type PlatformIndex } from "./platformIndex"
import { syncMediaAvailability, type AvailabilitySyncOutcome } from "./syncMediaAvailability"

// Two requests per title on the JustWatch path (search, then offers for all
// eight countries in one aliased query), three when it falls back to TMDB.
// They're sequential within a title, so this is still five requests in flight
// at a time — comfortable against TMDB's published ~50 req/s, and deliberately
// unaggressive against JustWatch's undocumented endpoint.
const CONCURRENCY = 5

// The per-title errors travel back to the browser inside the Server Action's
// response. Capped so a batch where everything fails doesn't return a payload
// that grows with the backlog.
const MAX_ERRORS_PER_BATCH = 20

export type AvailabilitySyncError = {
  mediaId: string
  title: string
  slug: string
  reason: string
}

export type AvailabilitySyncBatchResult = {
  processed: number
  synced: number
  notFound: number
  failed: number
  /** Synced titles the upstreams carry but that stream nowhere in our countries. */
  withoutProviders: number
  /** Titles whose links came from JustWatch — i.e. real provider deep links. */
  withDirectLinks: number
  /** Titles that fell back to TMDB's own watch page for their links. */
  withFallbackLinks: number
  /** media_availability rows written (created or updated — see the note below). */
  rowsUpserted: number
  /** Rows flipped to is_available=false because TMDB no longer reports them. */
  rowsExpired: number
  /** TMDB provider names with no matching platforms row, deduplicated. */
  unmatchedProviders: string[]
  /** Truncated to MAX_ERRORS_PER_BATCH. */
  errors: AvailabilitySyncError[]
  /** Eligible rows still pending after this batch — 0 means the run is done. */
  remaining: number
}

export type RunAvailabilitySyncOptions = {
  /** How many titles this call processes. Keep it small: one call is one HTTP request. */
  limit: number
}

/**
 * Processes ONE batch of titles awaiting an availability pass and returns.
 *
 * Same shape as runTmdbSync and for the same reasons: the caller (a Server
 * Action driven by features/availability-sync/useAvailabilitySyncRunner) loops
 * over it, so each request stays short, progress is observable, and a
 * catalog-sized run never risks a function timeout.
 *
 * Builds its own service-role client because no RLS policy grants UPDATE on
 * media_items or INSERT on media_availability to `authenticated` — granting
 * one would let any signed-in user rewrite the global catalog from the
 * browser. The calling action authenticates the user before delegating here.
 *
 * `rowsUpserted` counts rows written, without splitting created from updated:
 * PostgREST doesn't report which branch of ON CONFLICT ran, and finding out
 * would cost an extra query per title for a number nobody acts on.
 */
export async function runAvailabilitySync(
  options: RunAvailabilitySyncOptions
): Promise<AvailabilitySyncBatchResult> {
  const client = createAdminClient()
  const queue = new AvailabilitySyncServices(client)
  const availability = new MediaAvailabilityServices(client)

  const index = buildPlatformIndex(await queue.listPlatforms())

  // Without this guard an empty platforms table would march through the whole
  // catalog marking every title 'synced' with zero rows written, and the only
  // symptom would be a ficha that stays empty.
  if (index.byId.size === 0) {
    return {
      ...EMPTY_COUNTS,
      unmatchedProviders: [],
      errors: [
        {
          mediaId: "",
          title: "Sin plataformas registradas",
          slug: "",
          reason:
            "La tabla platforms está vacía, así que no hay dónde guardar la disponibilidad. Aplica la migración de seed de plataformas y vuelve a intentarlo.",
        },
      ],
      remaining: await queue.countPendingForRun(),
    }
  }

  const pending = await queue.listPending(options.limit)

  const totals = {
    synced: 0,
    notFound: 0,
    failed: 0,
    withoutProviders: 0,
    withDirectLinks: 0,
    withFallbackLinks: 0,
  }
  let rowsUpserted = 0
  let rowsExpired = 0
  const unmatched = new Set<string>()
  const errors: AvailabilitySyncError[] = []

  for (const group of chunk(pending, CONCURRENCY)) {
    const outcomes = await Promise.all(
      group.map((item) => syncMediaAvailability({ queue, availability, index }, item))
    )

    outcomes.forEach((outcome, position) => {
      const item = group[position]

      if (outcome.status === "synced") {
        totals.synced += 1
        if (!outcome.hadProviders) totals.withoutProviders += 1
        if (outcome.linkSource === "justwatch") totals.withDirectLinks += 1
        else if (outcome.linkSource === "tmdb") totals.withFallbackLinks += 1
      } else if (outcome.status === "not_found") {
        totals.notFound += 1
      } else {
        totals.failed += 1
        if (errors.length < MAX_ERRORS_PER_BATCH) {
          errors.push({
            mediaId: item.id,
            title: item.title,
            slug: item.slug,
            reason: outcome.reason ?? "Error desconocido",
          })
        }
      }

      rowsUpserted += outcome.upserted
      rowsExpired += outcome.expired
      for (const name of outcome.unmatched) unmatched.add(name)
    })
  }

  return {
    processed: pending.length,
    ...totals,
    rowsUpserted,
    rowsExpired,
    unmatchedProviders: Array.from(unmatched),
    errors,
    remaining: await queue.countPendingForRun(),
  }
}

/**
 * Requeues every 'failed' row. Also a write, so it needs the same privileged
 * client and belongs on this side of the boundary.
 */
export async function resetFailedAvailabilitySync(): Promise<number> {
  return new AvailabilitySyncServices(createAdminClient()).resetFailedToPending()
}

export type ProviderIdSyncResult = {
  /** Platforms that ended up with at least one provider id. */
  updated: number
  /** Slugs with no equivalent provider in TMDB's directory. */
  platformsWithoutProvider: string[]
  /** TMDB names with no matching platform, informational. */
  unmatchedProviders: string[]
}

/**
 * Fills platforms.provider_id_movie / provider_id_tv from TMDB's directory.
 *
 * Purely informational: the availability sync matches on normalised names
 * (see constants/tmdbProviders.ts for why a single integer column can't carry
 * the mapping). Worth running once so the ids on the row are auditable, and
 * its report of unmatched names is a cheap way to see what the alias table is
 * missing before committing to a full run.
 */
export async function syncWatchProviderIds(): Promise<ProviderIdSyncResult> {
  const client = createAdminClient()
  const queue = new AvailabilitySyncServices(client)
  const platforms = await queue.listPlatforms()
  const index = buildPlatformIndex(platforms)

  const [movieDirectory, tvDirectory] = await Promise.all([
    getProviderDirectory("movie"),
    getProviderDirectory("tv"),
  ])

  const unmatched = new Set<string>()
  const movieIds = pickBestPerPlatform(movieDirectory?.results ?? [], index, platforms, unmatched)
  const tvIds = pickBestPerPlatform(tvDirectory?.results ?? [], index, platforms, unmatched)

  let updated = 0
  const platformsWithoutProvider: string[] = []

  for (const platform of platforms) {
    const movie = movieIds.get(platform.id)
    const tv = tvIds.get(platform.id)

    if (movie === undefined && tv === undefined) {
      platformsWithoutProvider.push(platform.slug)
      continue
    }

    await queue.updateProviderIds(platform.id, { movie, tv })
    updated += 1
  }

  return {
    updated,
    platformsWithoutProvider,
    unmatchedProviders: Array.from(unmatched),
  }
}

type DirectoryEntry = {
  provider_id: number
  provider_name: string
  display_priority?: number
}

/**
 * A platform matches several TMDB providers ("Netflix" and "Netflix Standard
 * with Ads"), so one has to win the id column. An exact slug match beats an
 * alias, and among equals the lowest display_priority wins — that's TMDB's own
 * ranking of which provider is the canonical one in a region.
 */
function pickBestPerPlatform(
  entries: DirectoryEntry[],
  index: PlatformIndex,
  platforms: { id: string; slug: string }[],
  unmatched: Set<string>
): Map<string, number> {
  const slugById = new Map(platforms.map((platform) => [platform.id, platform.slug]))
  const best = new Map<string, { id: number; exact: boolean; priority: number }>()

  for (const entry of entries) {
    const platformId = resolvePlatformId(index, entry.provider_name)
    if (!platformId) {
      unmatched.add(entry.provider_name)
      continue
    }

    const candidate = {
      id: entry.provider_id,
      exact: normalizeProviderName(entry.provider_name) === slugById.get(platformId),
      priority: entry.display_priority ?? Number.MAX_SAFE_INTEGER,
    }

    const current = best.get(platformId)
    if (!current) {
      best.set(platformId, candidate)
      continue
    }

    if (candidate.exact !== current.exact) {
      if (candidate.exact) best.set(platformId, candidate)
      continue
    }

    if (candidate.priority < current.priority) best.set(platformId, candidate)
  }

  return new Map(Array.from(best, ([platformId, entry]) => [platformId, entry.id]))
}

const EMPTY_COUNTS = {
  processed: 0,
  synced: 0,
  notFound: 0,
  failed: 0,
  withoutProviders: 0,
  withDirectLinks: 0,
  withFallbackLinks: 0,
  rowsUpserted: 0,
  rowsExpired: 0,
} as const

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export type { AvailabilitySyncOutcome }
