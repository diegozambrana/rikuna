import type { SupabaseClient } from "@supabase/supabase-js"
import type { MediaAvailabilityOfferType, Platform } from "@/types"

// Same chunking/pagination constants as RecommendationServices — mirrored
// locally since those helpers are private to that class (RIK-14 constraint:
// reimplement the logic, don't reach into its internals).
//
// ID_CHUNK_SIZE is 100, not 200: getAvailableMediaIds appends an `.or(...)`
// clause per active subscription on top of the `.in("media_id", ...)` list,
// and at 200 UUIDs the percent-encoded request line crossed Kong's 8 KB
// limit — Kong answered 414 "URI too long" and supabase-js surfaced it as a
// bare {message} object. See RecommendationServices for the full note.
const PAGE_SIZE = 1000
const ID_CHUNK_SIZE = 100

async function paginate<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export type ActiveSubscriptionPair = { platformId: string; country: string }

export type UpsertAvailabilityInput = {
  mediaId: string
  platformId: string
  country: string
  url: string | null
  // Omitted on purpose when the raw file doesn't provide one — the column's
  // own `default 'subscription'` applies instead of forcing every ingested
  // item through this field.
  offerType?: MediaAvailabilityOfferType
  lastSeenAt: string
  snapshotId: string
}

export type ExpireStaleInput = {
  platformId: string
  country: string
  snapshotId: string
}

/** One offer TMDB reported for a title, already resolved to a platforms row. */
export type TmdbAvailabilityRow = {
  platformId: string
  country: string
  offerType: MediaAvailabilityOfferType
  url: string | null
}

export type ReconcileAvailabilityResult = {
  upserted: number
  expired: number
}

// Ficha read (RIK-9) — one available row plus its platform, so
// features/title/WhereToWatch can render name/link without a second query.
export type AvailabilityWithPlatform = {
  id: string
  mediaId: string
  country: string
  url: string | null
  offerType: MediaAvailabilityOfferType
  platform: Platform
}

type AvailabilityRow = {
  id: string
  media_id: string
  country: string
  url: string | null
  offer_type: MediaAvailabilityOfferType
  platforms: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    provider_id_movie: number | null
    provider_id_tv: number | null
  } | null
}

export class MediaAvailabilityServices {
  constructor(private readonly client: SupabaseClient) {}

  /** Ficha "Dónde ver" read — is_available=true rows for one title, joined to their platform. */
  async getAvailableForMedia(mediaId: string): Promise<AvailabilityWithPlatform[]> {
    const { data, error } = await this.client
      .from("media_availability")
      .select("id, media_id, country, url, offer_type, platforms(id, name, slug, logo_url, provider_id_movie, provider_id_tv)")
      .eq("media_id", mediaId)
      .eq("is_available", true)

    if (error) throw error

    return (data as unknown as AvailabilityRow[])
      .filter((row) => row.platforms !== null)
      .map((row) => ({
        id: row.id,
        mediaId: row.media_id,
        country: row.country,
        url: row.url,
        offerType: row.offer_type,
        platform: {
          id: row.platforms!.id,
          name: row.platforms!.name,
          slug: row.platforms!.slug,
          logoUrl: row.platforms!.logo_url,
          providerIdMovie: row.platforms!.provider_id_movie,
          providerIdTv: row.platforms!.provider_id_tv,
        },
      }))
  }

  /**
   * Biblioteca "solo disponible en mi suscripción activa" filter (RIK-14).
   * Byte-identical matching semantics to RecommendationServices' private
   * getAvailableMediaIds/getAvailableMediaIdsForPairs (is_available=true,
   * OR-matched across the active pairs' platform_id+country) — promoted here
   * as a public method per ARCHITECTURE.md's Services table instead of
   * reaching into that class's private methods or duplicating the class.
   */
  async getAvailableMediaIds(mediaIds: string[], activePairs: ActiveSubscriptionPair[]): Promise<string[]> {
    if (mediaIds.length === 0 || activePairs.length === 0) return []

    const pairFilter = activePairs
      .map((pair) => `and(platform_id.eq.${pair.platformId},country.eq.${pair.country})`)
      .join(",")

    const available = new Set<string>()

    for (const idChunk of chunk(mediaIds, ID_CHUNK_SIZE)) {
      const rows = await paginate<{ media_id: string }>((from, to) =>
        this.client
          .from("media_availability")
          .select("media_id")
          .in("media_id", idChunk)
          .eq("is_available", true)
          .or(pairFilter)
          .range(from, to)
      )

      for (const row of rows) available.add(row.media_id)
    }

    return Array.from(available)
  }

  /** Upsert against media_availability_uq (media_id, platform_id, country, offer_type). */
  async upsert(input: UpsertAvailabilityInput): Promise<void> {
    const { error } = await this.client.from("media_availability").upsert(
      {
        media_id: input.mediaId,
        platform_id: input.platformId,
        country: input.country,
        url: input.url,
        is_available: true,
        last_seen_at: input.lastSeenAt,
        last_snapshot_id: input.snapshotId,
        ...(input.offerType ? { offer_type: input.offerType } : {}),
      },
      { onConflict: "media_id,platform_id,country,offer_type" }
    )

    if (error) throw error
  }

  /**
   * Schema doc Section 3.3 step 3: flips is_available=false for anything in
   * this platform+country whose last_snapshot_id is NOT this run's snapshot
   * (including rows where it's null) — preserving the row instead of
   * deleting it. `.neq()` alone would silently exclude null rows, so the
   * null case is handled explicitly via `.or()` to match SQL's
   * "is distinct from" semantics.
   *
   * Scoped to source='catalog' (RIK-17): rows written by
   * ingestion/availability-sync belong to no snapshot, so the null branch of
   * that `.or()` would match every single one of them and a catalog load
   * would switch off every TMDB-sourced link. Their lifecycle is governed by
   * reconcileForMedia instead.
   */
  async expireStale(input: ExpireStaleInput): Promise<number> {
    const { data, error } = await this.client
      .from("media_availability")
      .update({ is_available: false })
      .eq("platform_id", input.platformId)
      .eq("country", input.country)
      .eq("is_available", true)
      .eq("source", "catalog")
      .or(`last_snapshot_id.is.null,last_snapshot_id.neq.${input.snapshotId}`)
      .select("id")

    if (error) throw error
    return data?.length ?? 0
  }

  /**
   * Per-title reconciliation for the TMDB availability sync (RIK-17).
   *
   * The catalog path's upsert()/expireStale() pair reasons in
   * (platform, country, snapshot) because each file only knows about one
   * platform. TMDB is the opposite: one call returns the COMPLETE truth for a
   * title across every platform and country, so the unit here is media_id —
   * upsert what was seen, switch off what this title used to have and no
   * longer does.
   *
   * Bounded to source='tmdb' in both directions: it never expires rows that
   * ingestion/catalog owns, and it never writes last_snapshot_id. Omitting
   * that column is deliberate rather than passing null — in
   * `INSERT … ON CONFLICT DO UPDATE` only the columns present in the payload
   * are assigned, so omitting it preserves whatever snapshot provenance a
   * shared row already had and lets the DEFAULT (null) apply on insert.
   *
   * `rows` MUST already be deduplicated by (platformId, country, offerType):
   * two entries with the same conflict key in one statement make Postgres
   * raise "cannot affect row a second time". That's not hypothetical — TMDB's
   * flatrate/free/ads buckets all collapse onto offer_type 'subscription' and
   * a provider can appear in more than one of them. ingestion's mapProviders
   * is where that dedup happens.
   */
  async reconcileForMedia(
    mediaId: string,
    rows: TmdbAvailabilityRow[],
    seenAt: string
  ): Promise<ReconcileAvailabilityResult> {
    // Read BEFORE the upsert, so `existing` can't contain what we're about to
    // write and the diff below is a plain set difference.
    const { data: existing, error: readError } = await this.client
      .from("media_availability")
      .select("id, platform_id, country, offer_type")
      .eq("media_id", mediaId)
      .eq("source", "tmdb")
      .eq("is_available", true)

    if (readError) throw readError

    if (rows.length > 0) {
      // Uniform payload keys on purpose: PostgREST fills missing keys with
      // null on a bulk upsert rather than leaving the column alone.
      const { error } = await this.client.from("media_availability").upsert(
        rows.map((row) => ({
          media_id: mediaId,
          platform_id: row.platformId,
          country: row.country,
          offer_type: row.offerType,
          url: row.url,
          is_available: true,
          last_seen_at: seenAt,
          source: "tmdb",
        })),
        { onConflict: "media_id,platform_id,country,offer_type" }
      )

      if (error) throw error
    }

    const seen = new Set(rows.map((row) => `${row.platformId}|${row.country}|${row.offerType}`))
    const staleIds = ((existing ?? []) as StaleAvailabilityRow[])
      .filter((row) => !seen.has(`${row.platform_id}|${row.country}|${row.offer_type}`))
      .map((row) => row.id)

    // Expire by explicit id — building an `.or()` of tuples is exactly the
    // shape that blows past Kong's request-line limit.
    for (const idChunk of chunk(staleIds, ID_CHUNK_SIZE)) {
      const { error } = await this.client
        .from("media_availability")
        .update({ is_available: false })
        .in("id", idChunk)

      if (error) throw error
    }

    return { upserted: rows.length, expired: staleIds.length }
  }
}

type StaleAvailabilityRow = {
  id: string
  platform_id: string
  country: string
  offer_type: MediaAvailabilityOfferType
}
