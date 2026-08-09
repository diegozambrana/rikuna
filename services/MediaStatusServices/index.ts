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
}
