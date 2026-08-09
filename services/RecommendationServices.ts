import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { RECOMMENDATION_THRESHOLDS } from "@/constants/recommendationThresholds"
import type { Genre } from "@/types"

// Query-shaped projection for the panel grid — narrower than MediaItem
// (schema-basedatos-rikuna.md Section 8.1 explicitly says to avoid `mi.*`),
// so it is colocated here rather than added to the shared types/index.ts barrel.
// Reused as-is for the RIK-8 discovery query (8.2): same card fields, so a
// second, near-identical DTO would only duplicate this shape.
export type MonthlyPick = {
  id: string
  slug: string
  title: string
  year: number | null
  posterUrl: string | null
  imdbRating: number | null
  imdbVotes: number | null
  isStub: boolean
}

export type RecommendationQueryParams = {
  genreSlug?: string
}

// PostgREST caps unpaginated selects at `max_rows` (1000 locally) and GET
// URLs blow up past a few hundred UUIDs in an `.in()` filter — both matter
// at the "several thousand rows" volume this ticket's AC-5 verifies against.
const PAGE_SIZE = 1000
const ID_CHUNK_SIZE = 200

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

type ActiveSubscriptionPair = { platformId: string; country: string }

export class RecommendationServices {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Implements schema-basedatos-rikuna.md Section 8.1 ("Qué ver este mes"):
   * watchlist ∩ available on an active subscription ∩ not watched/dismissed.
   *
   * PostgREST can't express the media_availability <-> user_subscriptions
   * join (matched on platform_id+country, not a foreign key) as a single
   * embedded select, and this ticket forbids adding a migration/RPC/view to
   * work around that — so the join is decomposed into three RLS-scoped,
   * index-backed queries instead of one round trip. Row-matching is
   * unchanged from the spec's SQL; only the transport is different.
   */
  async getMonthlyWatchlist(
    userId: string,
    params?: RecommendationQueryParams
  ): Promise<MonthlyPick[]> {
    const activePairs = await this.getActiveSubscriptionPairs(userId)
    if (activePairs.length === 0) return []

    let candidateMediaIds = await this.getWantToWatchMediaIds(userId)
    if (candidateMediaIds.length === 0) return []

    candidateMediaIds = await this.applyGenreFilter(candidateMediaIds, params?.genreSlug)
    if (candidateMediaIds.length === 0) return []

    const availableMediaIds = await this.getAvailableMediaIds(candidateMediaIds, activePairs)
    if (availableMediaIds.length === 0) return []

    return this.getMediaItems(availableMediaIds)
  }

  /**
   * Implements schema-basedatos-rikuna.md Section 8.2 ("Descubre algo nuevo"):
   * available on an active subscription ∩ well-rated ∩ unseen ∩ outside the
   * watchlist, extended with RIK-8's optional genre filter. Decomposed into
   * RLS-scoped queries for the same reason as getMonthlyWatchlist above.
   */
  async getDiscovery(userId: string, params?: RecommendationQueryParams): Promise<MonthlyPick[]> {
    const activePairs = await this.getActiveSubscriptionPairs(userId)
    if (activePairs.length === 0) return []

    let availableMediaIds = await this.getAvailableMediaIdsForPairs(activePairs)
    if (availableMediaIds.length === 0) return []

    availableMediaIds = await this.applyGenreFilter(availableMediaIds, params?.genreSlug)
    if (availableMediaIds.length === 0) return []

    const eligibleMediaIds = await this.excludeUserStatus(userId, availableMediaIds)
    if (eligibleMediaIds.length === 0) return []

    return this.getDiscoveryMediaItems(eligibleMediaIds)
  }

  /** All rows from `genres`, ordered by name — source for the filter Select. */
  async getGenres(): Promise<Genre[]> {
    const rows = await paginate<{ id: string; name: string; slug: string }>((from, to) =>
      this.client.from("genres").select("id, name, slug").order("name", { ascending: true }).range(from, to)
    )

    return rows
  }

  private async getActiveSubscriptionPairs(userId: string): Promise<ActiveSubscriptionPair[]> {
    const rows = await paginate<{ platform_id: string; country: string }>((from, to) =>
      this.client
        .from("user_subscriptions")
        .select("platform_id, country")
        .eq("user_id", userId)
        .is("ended_on", null)
        .range(from, to)
    )

    return rows.map((row) => ({ platformId: row.platform_id, country: row.country }))
  }

  /** Uses ums_user_want_idx (user_id, want_to_watch) partial index. */
  private async getWantToWatchMediaIds(userId: string): Promise<string[]> {
    const rows = await paginate<{ media_id: string }>((from, to) =>
      this.client
        .from("user_media_status")
        .select("media_id")
        .eq("user_id", userId)
        .eq("want_to_watch", true)
        .eq("watched", false)
        .eq("dismissed", false)
        .range(from, to)
    )

    return rows.map((row) => row.media_id)
  }

  /** Uses media_availability_lookup_idx (platform_id, country, is_available). */
  private async getAvailableMediaIds(
    candidateMediaIds: string[],
    activePairs: ActiveSubscriptionPair[]
  ): Promise<string[]> {
    const pairFilter = activePairs
      .map((pair) => `and(platform_id.eq.${pair.platformId},country.eq.${pair.country})`)
      .join(",")

    const available = new Set<string>()

    for (const idChunk of chunk(candidateMediaIds, ID_CHUNK_SIZE)) {
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

  /** Uses media_availability_lookup_idx (platform_id, country, is_available); no candidate set to chunk by. */
  private async getAvailableMediaIdsForPairs(pairs: ActiveSubscriptionPair[]): Promise<string[]> {
    const pairFilter = pairs
      .map((pair) => `and(platform_id.eq.${pair.platformId},country.eq.${pair.country})`)
      .join(",")

    const rows = await paginate<{ media_id: string }>((from, to) =>
      this.client
        .from("media_availability")
        .select("media_id")
        .eq("is_available", true)
        .or(pairFilter)
        .range(from, to)
    )

    return Array.from(new Set(rows.map((row) => row.media_id)))
  }

  /** No-op when genreSlug is unset; an unknown slug resolves to zero matches rather than erroring. */
  private async applyGenreFilter(mediaIds: string[], genreSlug?: string): Promise<string[]> {
    if (!genreSlug) return mediaIds
    if (mediaIds.length === 0) return mediaIds

    const { data: genre, error: genreError } = await this.client
      .from("genres")
      .select("id")
      .eq("slug", genreSlug)
      .maybeSingle()

    if (genreError) throw genreError
    if (!genre) return []

    const genreMediaIds = new Set<string>()
    for (const idChunk of chunk(mediaIds, ID_CHUNK_SIZE)) {
      const rows = await paginate<{ media_id: string }>((from, to) =>
        this.client
          .from("media_genres")
          .select("media_id")
          .eq("genre_id", (genre as { id: string }).id)
          .in("media_id", idChunk)
          .range(from, to)
      )
      for (const row of rows) genreMediaIds.add(row.media_id)
    }

    return mediaIds.filter((id) => genreMediaIds.has(id))
  }

  /**
   * watched/want_to_watch/dismissed = false, per the discovery query's
   * `coalesce(ums.*, false) = false` guards — a missing status row (never
   * touched by the user) also passes, same as a left join with no match.
   */
  private async excludeUserStatus(userId: string, mediaIds: string[]): Promise<string[]> {
    const excluded = new Set<string>()

    for (const idChunk of chunk(mediaIds, ID_CHUNK_SIZE)) {
      const rows = await paginate<{
        media_id: string
        watched: boolean
        want_to_watch: boolean
        dismissed: boolean
      }>((from, to) =>
        this.client
          .from("user_media_status")
          .select("media_id, watched, want_to_watch, dismissed")
          .eq("user_id", userId)
          .in("media_id", idChunk)
          .range(from, to)
      )

      for (const row of rows) {
        if (row.watched || row.want_to_watch || row.dismissed) excluded.add(row.media_id)
      }
    }

    return mediaIds.filter((id) => !excluded.has(id))
  }

  /** Applies the rating/votes thresholds and the `limit 50` cap from Section 8.2, sorted by imdb_rating desc. */
  private async getDiscoveryMediaItems(mediaIds: string[]): Promise<MonthlyPick[]> {
    const items: MonthlyPick[] = []

    for (const idChunk of chunk(mediaIds, ID_CHUNK_SIZE)) {
      const rows = await paginate<Record<string, unknown>>((from, to) =>
        this.client
          .from("media_items")
          .select("id, slug, title, year, poster_url, imdb_rating, imdb_votes, is_stub")
          .in("id", idChunk)
          .gte("imdb_rating", RECOMMENDATION_THRESHOLDS.minRating)
          .gte("imdb_votes", RECOMMENDATION_THRESHOLDS.minImdbVotes)
          .range(from, to)
      )

      items.push(...rows.map(mapMonthlyPickRow))
    }

    items.sort((a, b) => (b.imdbRating ?? -Infinity) - (a.imdbRating ?? -Infinity))

    return items.slice(0, 50)
  }

  /** Preserves `order by imdb_rating desc nulls last` from Section 8.1. */
  private async getMediaItems(mediaIds: string[]): Promise<MonthlyPick[]> {
    const items: MonthlyPick[] = []

    for (const idChunk of chunk(mediaIds, ID_CHUNK_SIZE)) {
      const rows = await paginate<Record<string, unknown>>((from, to) =>
        this.client
          .from("media_items")
          .select("id, slug, title, year, poster_url, imdb_rating, imdb_votes, is_stub")
          .in("id", idChunk)
          .range(from, to)
      )

      items.push(...rows.map(mapMonthlyPickRow))
    }

    items.sort((a, b) => {
      if (a.imdbRating === b.imdbRating) return 0
      if (a.imdbRating === null) return 1
      if (b.imdbRating === null) return -1
      return b.imdbRating - a.imdbRating
    })

    return items
  }
}

function mapMonthlyPickRow(row: Record<string, unknown>): MonthlyPick {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    year: (row.year as number | null) ?? null,
    posterUrl: (row.poster_url as string | null) ?? null,
    imdbRating: (row.imdb_rating as number | null) ?? null,
    imdbVotes: (row.imdb_votes as number | null) ?? null,
    isStub: row.is_stub as boolean,
  }
}
