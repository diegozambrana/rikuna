import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

export class MediaStatusServices {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * A want_to_watch=true row is guaranteed to already exist for anything
   * reachable through this action (panel, title detail), so this is an
   * UPDATE — never a blind upsert that could create a stray row.
   * want_to_watch is intentionally left untouched.
   */
  async markWatched(userId: string, mediaId: string): Promise<void> {
    const { data, error } = await this.client
      .from("user_media_status")
      .update({
        watched: true,
        watched_at: new Date().toISOString(),
        manually_edited: true,
        source: "manual",
      })
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .select("id")

    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error("No se encontró el registro de este título para marcarlo como visto.")
    }
  }

  /**
   * Upsert against user_media_status_uq (user_id, media_id) — unlike
   * markWatched, no prior row is guaranteed to exist (a discovery-block title
   * has never been touched by the user), so this must create one. Only the
   * touched columns are set; want_to_watch's own default (false) covers a
   * fresh row and an existing row's other columns are left untouched.
   */
  async addToWatchlist(userId: string, mediaId: string): Promise<void> {
    const { error } = await this.client.from("user_media_status").upsert(
      {
        user_id: userId,
        media_id: mediaId,
        want_to_watch: true,
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
}
