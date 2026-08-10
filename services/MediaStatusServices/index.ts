import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { UserMediaStatus, UserMediaStatusSource } from "@/types"

// Same "several thousand rows" scale problem RecommendationServices documents
// for a single user's history — mirrored here rather than imported since
// RecommendationServices doesn't export these helpers.
const PAGE_SIZE = 1000

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

type UserMediaStatusRow = {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  media_id: string
  watched: boolean
  watched_at: string | null
  personal_rating: number | null
  want_to_watch: boolean
  want_added_at: string | null
  dismissed: boolean
  source: UserMediaStatusSource
  manually_edited: boolean
}

function mapRow(row: UserMediaStatusRow): UserMediaStatus {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    mediaId: row.media_id,
    watched: row.watched,
    watchedAt: row.watched_at,
    personalRating: row.personal_rating,
    wantToWatch: row.want_to_watch,
    wantAddedAt: row.want_added_at,
    dismissed: row.dismissed,
    source: row.source,
    manuallyEdited: row.manually_edited,
  }
}

export class MediaStatusServices {
  constructor(private readonly client: SupabaseClient) {}

  /** Ficha read (RIK-9) — the caller's own status row for one title, or null if never touched. */
  async getForUser(userId: string, mediaId: string): Promise<UserMediaStatus | null> {
    const { data, error } = await this.client
      .from("user_media_status")
      .select("*")
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .maybeSingle()

    if (error) throw error
    return data ? mapRow(data as UserMediaStatusRow) : null
  }

  /**
   * Upsert against user_media_status_uq (user_id, media_id): the panel only
   * calls this for titles that already have a want_to_watch=true row, but
   * the title ficha (RIK-9) can mark watched on a title never touched
   * before, so this must be able to create the row, not just update it.
   * Only the touched columns are set — want_to_watch is never cleared here.
   */
  async markWatched(userId: string, mediaId: string): Promise<void> {
    const { error } = await this.client.from("user_media_status").upsert(
      {
        user_id: userId,
        media_id: mediaId,
        watched: true,
        watched_at: new Date().toISOString(),
        manually_edited: true,
        source: "manual",
      },
      { onConflict: "user_id,media_id" }
    )

    if (error) throw error
  }

  /** Same upsert shape as markWatched, flipping watched back off without touching watched_at or want_to_watch. */
  async markNotWatched(userId: string, mediaId: string): Promise<void> {
    const { error } = await this.client.from("user_media_status").upsert(
      {
        user_id: userId,
        media_id: mediaId,
        watched: false,
        manually_edited: true,
        source: "manual",
      },
      { onConflict: "user_id,media_id" }
    )

    if (error) throw error
  }

  /**
   * Upsert against user_media_status_uq (user_id, media_id) — unlike
   * markWatched, no prior row is guaranteed to exist (a discovery-block title
   * has never been touched by the user), so this must create one. Only the
   * touched columns are set; watched's own default (false) covers a fresh
   * row and an existing row's other columns are left untouched.
   */
  async addToWatchlist(userId: string, mediaId: string): Promise<void> {
    const { error } = await this.client.from("user_media_status").upsert(
      {
        user_id: userId,
        media_id: mediaId,
        want_to_watch: true,
        want_added_at: new Date().toISOString(),
        manually_edited: true,
        source: "manual",
      },
      { onConflict: "user_id,media_id" }
    )

    if (error) throw error
  }

  /** Same upsert shape as addToWatchlist, flipping want_to_watch back off; want_added_at is left as the last time it was added. */
  async removeFromWatchlist(userId: string, mediaId: string): Promise<void> {
    const { error } = await this.client.from("user_media_status").upsert(
      {
        user_id: userId,
        media_id: mediaId,
        want_to_watch: false,
        manually_edited: true,
        source: "manual",
      },
      { onConflict: "user_id,media_id" }
    )

    if (error) throw error
  }

  /** Same upsert shape as addToWatchlist, setting `dismissed` instead of `want_to_watch`. */
  async dismissRecommendation(userId: string, mediaId: string): Promise<void> {
    const { error } = await this.client.from("user_media_status").upsert(
      {
        user_id: userId,
        media_id: mediaId,
        dismissed: true,
        manually_edited: true,
        source: "manual",
      },
      { onConflict: "user_id,media_id" }
    )

    if (error) throw error
  }

  /**
   * Biblioteca read (RIK-14): every user_media_status row for the caller,
   * optionally narrowed to watched and/or want_to_watch. Omitting both keys
   * of `filter` (the "Todas" tab) returns the user's entire history,
   * dismissed-only rows included — this screen is a read of the full
   * personal record, not a recommendations-style exclusion filter. Uses the
   * same paginated-range pattern as RecommendationServices so a multi
   * thousand-row IMDb import isn't silently truncated by PostgREST's
   * unpaginated-select cap.
   */
  async listForUser(
    userId: string,
    filter?: { watched?: boolean; wantToWatch?: boolean }
  ): Promise<UserMediaStatus[]> {
    const rows = await paginate<UserMediaStatusRow>((from, to) => {
      let query = this.client.from("user_media_status").select("*").eq("user_id", userId)

      if (filter?.watched !== undefined) {
        query = query.eq("watched", filter.watched)
      }
      if (filter?.wantToWatch !== undefined) {
        query = query.eq("want_to_watch", filter.wantToWatch)
      }

      return query.range(from, to)
    })

    return rows.map(mapRow)
  }
}
