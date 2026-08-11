import type { SupabaseClient } from "@supabase/supabase-js"
import type { MediaType, Platform } from "@/types"

export type AvailabilitySyncStatus = "pending" | "synced" | "not_found" | "failed"

export type AvailabilitySyncCounts = {
  total: number
  pending: number
  synced: number
  notFound: number
  failed: number
  /**
   * Pending rows that aren't eligible yet because they have no tmdb_id. Shown
   * separately so "0 pendientes" never means "nothing left to do" when the
   * real answer is "run /sincronizar first".
   */
  withoutTmdbId: number
}

/** The minimum a run needs to know about a row before hitting TMDB. */
export type PendingAvailabilityItem = {
  id: string
  tmdbId: number
  /** Used to confirm a JustWatch search hit is actually this title. */
  imdbId: string
  type: MediaType
  title: string
  slug: string
}

/**
 * The queue side of the TMDB availability sync (RIK-17): which media_items
 * still need a watch-providers pass, and marking them once they've had one.
 * Writing to media_availability itself belongs to MediaAvailabilityServices,
 * which owns every query shape against that table.
 *
 * Counting runs fine under an end-user session (media_items_select is
 * `using (true)`), but the writes need a client that can UPDATE media_items,
 * which no RLS policy grants to `authenticated`. Injecting the client keeps
 * that decision at the call site — see ARCHITECTURE.md on why only ingestion/
 * may build a service-role client.
 *
 * Deliberately a sibling of TmdbSyncServices rather than a generalisation of
 * it: the projections and filters differ (this one requires tmdb_id), that
 * class carries linkGenres/linkCast/mediaIdsForImportBatch which are dead
 * weight here, and reworking it would put /sincronizar and the /importar
 * chain at risk for no functional gain — the same RIK-14 constraint that
 * produced the mirrored chunk helpers across the services layer. The method
 * names and return shapes are kept identical so both classes read alike.
 */
export class AvailabilitySyncServices {
  constructor(private readonly client: SupabaseClient) {}

  async countByStatus(): Promise<AvailabilitySyncCounts> {
    const statuses: AvailabilitySyncStatus[] = ["pending", "synced", "not_found", "failed"]

    const [total, withoutTmdbId, ...perStatus] = await Promise.all([
      this.countWhere(),
      this.countPendingWithoutTmdbId(),
      ...statuses.map((status) => this.countWhere(status)),
    ])

    const [pending, synced, notFound, failed] = perStatus
    return { total, pending, synced, notFound, failed, withoutTmdbId }
  }

  private async countWhere(status?: AvailabilitySyncStatus): Promise<number> {
    let query = this.client.from("media_items").select("*", { count: "exact", head: true })
    if (status) query = query.eq("availability_sync_status", status)

    const { count, error } = await query
    if (error) throw error
    return count ?? 0
  }

  private async countPendingWithoutTmdbId(): Promise<number> {
    const { count, error } = await this.client
      .from("media_items")
      .select("*", { count: "exact", head: true })
      .eq("availability_sync_status", "pending")
      .is("tmdb_id", null)

    if (error) throw error
    return count ?? 0
  }

  /**
   * Next slice of titles waiting for an availability pass, oldest first.
   *
   * The `tmdb_id is not null` filter is the real precondition, not
   * tmdb_sync_status='synced': a title with an id from an earlier run can be
   * queried even if its genre/cast linking failed. It also means a title
   * enters this queue by itself the moment /sincronizar fills its id in — no
   * requeueing step anywhere. Matches media_items_availability_sync_idx.
   */
  async listPending(limit: number): Promise<PendingAvailabilityItem[]> {
    const { data, error } = await this.client
      .from("media_items")
      .select("id, tmdb_id, imdb_id, type, title, slug")
      .eq("availability_sync_status", "pending")
      .not("tmdb_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) throw error

    return (data as PendingRow[]).map((row) => ({
      id: row.id,
      tmdbId: row.tmdb_id,
      imdbId: row.imdb_id,
      type: row.type,
      title: row.title,
      slug: row.slug,
    }))
  }

  /** How many rows a run still has to process, for the progress bar's total. */
  async countPendingForRun(): Promise<number> {
    const { count, error } = await this.client
      .from("media_items")
      .select("*", { count: "exact", head: true })
      .eq("availability_sync_status", "pending")
      .not("tmdb_id", "is", null)

    if (error) throw error
    return count ?? 0
  }

  async markStatus(mediaId: string, status: AvailabilitySyncStatus): Promise<void> {
    const { error } = await this.client
      .from("media_items")
      .update({
        availability_sync_status: status,
        // Only a successful pass stamps the timestamp — a 'failed' row's last
        // successful sync time is still whatever it was before.
        ...(status === "synced" ? { availability_synced_at: new Date().toISOString() } : {}),
      })
      .eq("id", mediaId)

    if (error) throw error
  }

  /**
   * Requeues every 'failed' row. Without this a title that failed once would
   * never be retried: processed rows leave 'pending' for good.
   */
  async resetFailedToPending(): Promise<number> {
    const { data, error } = await this.client
      .from("media_items")
      .update({ availability_sync_status: "pending" })
      .eq("availability_sync_status", "failed")
      .select("id")

    if (error) throw error
    return data?.length ?? 0
  }

  /** Every platform row — the sync builds its name-matching index from these. */
  async listPlatforms(): Promise<Platform[]> {
    const { data, error } = await this.client
      .from("platforms")
      .select("id, name, slug, logo_url, provider_id_movie, provider_id_tv")
      .order("name", { ascending: true })

    if (error) throw error

    return (data as PlatformRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url,
      providerIdMovie: row.provider_id_movie,
      providerIdTv: row.provider_id_tv,
    }))
  }

  /**
   * Informational backfill of provider_id_movie / provider_id_tv. Nothing in
   * the sync path reads these — see constants/tmdbProviders.ts for why
   * matching is name-based — but having the canonical id on the row makes the
   * mapping auditable.
   */
  async updateProviderIds(
    platformId: string,
    ids: { movie?: number | null; tv?: number | null }
  ): Promise<void> {
    const patch: Record<string, number | null> = {}
    if (ids.movie !== undefined) patch.provider_id_movie = ids.movie
    if (ids.tv !== undefined) patch.provider_id_tv = ids.tv
    if (Object.keys(patch).length === 0) return

    const { error } = await this.client.from("platforms").update(patch).eq("id", platformId)
    if (error) throw error
  }
}

type PendingRow = {
  id: string
  tmdb_id: number
  imdb_id: string
  type: MediaType
  title: string
  slug: string
}

type PlatformRow = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  provider_id_movie: number | null
  provider_id_tv: number | null
}
