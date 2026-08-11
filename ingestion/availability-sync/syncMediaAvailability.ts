import { getWatchProviders, TmdbConfigError } from "@/ingestion/tmdb-sync/client"
import type {
  AvailabilitySyncServices,
  AvailabilitySyncStatus,
  MediaAvailabilityServices,
  PendingAvailabilityItem,
  TmdbAvailabilityRow,
} from "@/services"
import {
  findJustWatchTitle,
  getJustWatchOffers,
  isJustWatchEnabled,
} from "./justwatchClient"
import { mapJustWatchOffers, mapProviders } from "./mapProviders"
import type { PlatformIndex } from "./platformIndex"

/** Which upstream produced the links for a title. Reported in the run summary. */
export type AvailabilityLinkSource = "justwatch" | "tmdb" | "none"

/** Outcome of one title. 'pending' is never returned — a processed row always leaves that state. */
export type AvailabilitySyncOutcome = {
  status: Exclude<AvailabilitySyncStatus, "pending">
  upserted: number
  expired: number
  /** false when neither upstream reports an offer in any of our countries. */
  hadProviders: boolean
  linkSource: AvailabilityLinkSource
  unmatched: string[]
  reason?: string
}

export type SyncDeps = {
  queue: AvailabilitySyncServices
  availability: MediaAvailabilityServices
  index: PlatformIndex
}

/**
 * Fills in media_availability for a single title.
 *
 * JustWatch is the primary source and TMDB the fallback, because they carry
 * the same catalog — TMDB licenses JustWatch's data — but TMDB strips the
 * per-provider deep link and returns only a link back to its own watch page.
 * A badge that opens themoviedb.org instead of paramountplus.com is the thing
 * this ordering exists to avoid.
 *
 * Falling back rather than merging: JustWatch is a superset of what TMDB
 * reports for a title it knows, so a merge would only add rows that already
 * exist while costing an extra request per title.
 *
 * Same contract as ingestion/tmdb-sync/syncMediaItem: never throws for a
 * per-title problem, so one bad row can't take a batch down, and the only
 * exception it propagates is TmdbConfigError — missing credentials aren't a
 * per-title problem and failing every row one by one would bury the cause.
 *
 * Note the "known but unavailable" case resolves to 'synced', not 'not_found'
 * and not left 'pending'. An empty result is a complete, valid answer ("it
 * isn't streaming anywhere here"); leaving it pending would re-query the same
 * titles on every run forever. It still runs the reconcile with an empty row
 * set, which is what switches off links that existed before and no longer do.
 */
export async function syncMediaAvailability(
  deps: SyncDeps,
  item: PendingAvailabilityItem
): Promise<AvailabilitySyncOutcome> {
  try {
    const resolved = await resolveRows(deps.index, item)

    if (resolved === null) {
      await deps.queue.markStatus(item.id, "not_found")
      return {
        status: "not_found",
        upserted: 0,
        expired: 0,
        hadProviders: false,
        linkSource: "none",
        unmatched: [],
      }
    }

    const result = await deps.availability.reconcileForMedia(
      item.id,
      resolved.rows,
      new Date().toISOString()
    )

    await deps.queue.markStatus(item.id, "synced")

    return {
      status: "synced",
      upserted: result.upserted,
      expired: result.expired,
      hadProviders: resolved.rows.length > 0,
      linkSource: resolved.rows.length > 0 ? resolved.source : "none",
      unmatched: resolved.unmatched,
    }
  } catch (error) {
    if (error instanceof TmdbConfigError) throw error

    await markFailedQuietly(deps.queue, item.id)
    return {
      status: "failed",
      upserted: 0,
      expired: 0,
      hadProviders: false,
      linkSource: "none",
      unmatched: [],
      reason: describe(error),
    }
  }
}

type ResolvedRows = {
  rows: TmdbAvailabilityRow[]
  unmatched: string[]
  source: AvailabilityLinkSource
}

/**
 * Returns null only for "neither upstream has ever heard of this title", which
 * is what earns a 'not_found'. A JustWatch outage is deliberately NOT that: it
 * throws inside findJustWatchTitle, and the catch below downgrades to TMDB so
 * a flaky undocumented endpoint costs link quality, never coverage.
 */
async function resolveRows(
  index: PlatformIndex,
  item: PendingAvailabilityItem
): Promise<ResolvedRows | null> {
  if (isJustWatchEnabled()) {
    try {
      const match = await findJustWatchTitle(item.title, item.imdbId)
      if (match) {
        const offers = await getJustWatchOffers(match.fullPath)
        const mapped = mapJustWatchOffers(offers, index)
        // An empty map here still counts as an answer: JustWatch knows the
        // title and reports nothing streaming in our countries.
        return { ...mapped, source: "justwatch" }
      }
    } catch {
      // Swallowed on purpose — see the note above. TMDB takes over.
    }
  }

  const response = await getWatchProviders(item.tmdbId, item.type)
  if (!response) return null

  return { ...mapProviders(response, index), source: "tmdb" }
}

/** A failure while recording a failure must not take the whole batch down. */
async function markFailedQuietly(
  queue: AvailabilitySyncServices,
  mediaId: string
): Promise<void> {
  try {
    await queue.markStatus(mediaId, "failed")
  } catch {
    // Swallowed on purpose: the row simply stays 'pending' and gets retried.
  }
}

/**
 * A short, user-facing reason for the run summary. Supabase errors arrive as
 * plain objects with a `message`, not as Error instances, so both shapes are
 * handled.
 */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message)
  }
  return "Error desconocido"
}
