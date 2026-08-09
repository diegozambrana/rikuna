import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

// Query-shaped projection for the panel grid — narrower than MediaItem
// (schema-basedatos-rikuna.md Section 8.1 explicitly says to avoid `mi.*`),
// so it is colocated here rather than added to the shared types/index.ts barrel.
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
  async getMonthlyWatchlist(userId: string): Promise<MonthlyPick[]> {
    const activePairs = await this.getActiveSubscriptionPairs(userId)
    if (activePairs.length === 0) return []

    const candidateMediaIds = await this.getWantToWatchMediaIds(userId)
    if (candidateMediaIds.length === 0) return []

    const availableMediaIds = await this.getAvailableMediaIds(candidateMediaIds, activePairs)
    if (availableMediaIds.length === 0) return []

    return this.getMediaItems(availableMediaIds)
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
