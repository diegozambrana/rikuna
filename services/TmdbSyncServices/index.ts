import type { SupabaseClient } from "@supabase/supabase-js"
import { slugify } from "@/lib/slug"

export type TmdbSyncStatus = "pending" | "synced" | "not_found" | "failed"

export type TmdbSyncCounts = {
  total: number
  pending: number
  synced: number
  notFound: number
  failed: number
}

/** The minimum a sync run needs to know about a row before fetching it. */
export type PendingMediaItem = {
  id: string
  imdbId: string
  title: string
}

export type CastLink = {
  name: string
  characterName: string | null
  photoUrl: string | null
  sortOrder: number
}

// Same chunking rationale as MediaServices/RecommendationServices: a `.in()`
// filter of a few hundred UUIDs blows past Kong's 8 KB request-line limit and
// comes back as a 414. See RecommendationServices for the measured numbers.
const ID_CHUNK_SIZE = 100

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * Reads and writes for the TMDB catalog sync (RIK-16).
 *
 * The counting methods run fine under an end-user session (media_items_select
 * is `using (true)`), but every write here needs a client that can UPDATE
 * media_items — which no RLS policy grants to `authenticated`. In practice
 * that means the service-role client, and the only place allowed to build one
 * is ingestion/ (see ARCHITECTURE.md). Injecting the client keeps that policy
 * decision at the call site instead of hard-coding it here.
 */
export class TmdbSyncServices {
  constructor(private readonly client: SupabaseClient) {}

  async countByStatus(): Promise<TmdbSyncCounts> {
    const statuses: TmdbSyncStatus[] = ["pending", "synced", "not_found", "failed"]

    const [total, ...perStatus] = await Promise.all([
      this.countWhere(),
      ...statuses.map((status) => this.countWhere(status)),
    ])

    const [pending, synced, notFound, failed] = perStatus
    return { total, pending, synced, notFound, failed }
  }

  private async countWhere(status?: TmdbSyncStatus): Promise<number> {
    let query = this.client.from("media_items").select("*", { count: "exact", head: true })
    if (status) query = query.eq("tmdb_sync_status", status)

    const { count, error } = await query
    if (error) throw error
    return count ?? 0
  }

  /**
   * Next slice of unsynced titles, oldest first so a run makes visible
   * progress from the top of the backlog instead of jumping around.
   *
   * `importBatchId` narrows the set to the titles an IMDb import just touched,
   * which is what features/import/UploadForm chains onto after a CSV upload.
   */
  async listPending(limit: number, importBatchId?: string): Promise<PendingMediaItem[]> {
    if (importBatchId) {
      const mediaIds = await this.mediaIdsForImportBatch(importBatchId)
      if (mediaIds.length === 0) return []
      return this.listPendingWithinIds(mediaIds, limit)
    }

    const { data, error } = await this.client
      .from("media_items")
      .select("id, imdb_id, title")
      .eq("tmdb_sync_status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) throw error
    return (data as { id: string; imdb_id: string; title: string }[]).map(mapPendingRow)
  }

  /** How many rows a run still has to process, for the progress bar's total. */
  async countPendingForRun(importBatchId?: string): Promise<number> {
    if (!importBatchId) return this.countWhere("pending")

    const mediaIds = await this.mediaIdsForImportBatch(importBatchId)
    if (mediaIds.length === 0) return 0

    let pending = 0
    for (const idChunk of chunk(mediaIds, ID_CHUNK_SIZE)) {
      const { count, error } = await this.client
        .from("media_items")
        .select("*", { count: "exact", head: true })
        .eq("tmdb_sync_status", "pending")
        .in("id", idChunk)

      if (error) throw error
      pending += count ?? 0
    }

    return pending
  }

  private async mediaIdsForImportBatch(importBatchId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from("imdb_import_rows")
      .select("media_id")
      .eq("batch_id", importBatchId)
      .not("media_id", "is", null)

    if (error) throw error

    const ids = (data as { media_id: string | null }[])
      .map((row) => row.media_id)
      .filter((id): id is string => id !== null)

    return Array.from(new Set(ids))
  }

  private async listPendingWithinIds(
    mediaIds: string[],
    limit: number
  ): Promise<PendingMediaItem[]> {
    const found: PendingMediaItem[] = []

    for (const idChunk of chunk(mediaIds, ID_CHUNK_SIZE)) {
      const { data, error } = await this.client
        .from("media_items")
        .select("id, imdb_id, title")
        .eq("tmdb_sync_status", "pending")
        .in("id", idChunk)
        .order("created_at", { ascending: true })
        .limit(limit - found.length)

      if (error) throw error
      found.push(...(data as { id: string; imdb_id: string; title: string }[]).map(mapPendingRow))
      if (found.length >= limit) break
    }

    return found
  }

  /** Writes the enrichment payload and flips the row out of 'pending'. */
  async applySyncResult(
    mediaId: string,
    patch: Record<string, unknown>,
    status: TmdbSyncStatus
  ): Promise<void> {
    const { error } = await this.client
      .from("media_items")
      .update({ ...patch, tmdb_sync_status: status })
      .eq("id", mediaId)

    if (error) throw error
  }

  /**
   * Records an outcome that carries no data (TMDB has no such title, or the
   * request failed). Persisting it is what stops the next run from retrying
   * the same hopeless rows forever.
   */
  async markStatus(mediaId: string, status: TmdbSyncStatus): Promise<void> {
    const { error } = await this.client
      .from("media_items")
      .update({ tmdb_sync_status: status })
      .eq("id", mediaId)

    if (error) throw error
  }

  /**
   * Puts failed rows back in the queue. Without this a transient TMDB outage
   * would park those titles in 'failed' permanently — 'not_found' is left
   * alone on purpose, since retrying a title TMDB doesn't carry is pure waste.
   */
  async resetFailedToPending(): Promise<number> {
    const { data, error } = await this.client
      .from("media_items")
      .update({ tmdb_sync_status: "pending" })
      .eq("tmdb_sync_status", "failed")
      .select("id")

    if (error) throw error
    return data?.length ?? 0
  }

  /**
   * Find-or-create each genre by slug, then link it. Mirrors
   * ImdbImportServices.linkGenres rather than reusing it — that method is
   * private to its class, and the same RIK-14 constraint that produced the
   * duplicated chunk helpers applies here.
   */
  async linkGenres(mediaId: string, genreNames: string[]): Promise<void> {
    for (const rawName of genreNames) {
      const name = rawName.trim()
      if (!name) continue

      const slug = slugify(name)
      const { data: existing, error: selectError } = await this.client
        .from("genres")
        .select("id")
        .eq("slug", slug)
        .maybeSingle()
      if (selectError) throw selectError

      let genreId = (existing as { id: string } | null)?.id
      if (!genreId) {
        const { data: inserted, error: insertError } = await this.client
          .from("genres")
          .insert({ name, slug })
          .select("id")
          .single()
        if (insertError) throw insertError
        genreId = inserted.id
      }

      const { error: linkError } = await this.client
        .from("media_genres")
        .upsert({ media_id: mediaId, genre_id: genreId }, { onConflict: "media_id,genre_id" })
      if (linkError) throw linkError
    }
  }

  /**
   * Lead cast as media_people rows with role='actor' — the exact shape
   * MediaServices.getBySlugWithDetails filters on to render features/title/CastList,
   * which has been empty since launch because only 'director' rows were ever
   * written (ImdbImportServices.linkDirectors).
   *
   * People are matched by name like linkDirectors does: `people.imdb_id` is the
   * only unique key and TMDB gives us its own person id, not an nconst.
   */
  async linkCast(mediaId: string, cast: CastLink[]): Promise<void> {
    for (const member of cast) {
      const name = member.name.trim()
      if (!name) continue

      const { data: existing, error: selectError } = await this.client
        .from("people")
        .select("id, photo_url")
        .ilike("name", name)
        .maybeSingle()
      if (selectError) throw selectError

      const found = existing as { id: string; photo_url: string | null } | null
      let personId = found?.id

      if (!personId) {
        const { data: inserted, error: insertError } = await this.client
          .from("people")
          .insert({ name, photo_url: member.photoUrl })
          .select("id")
          .single()
        if (insertError) throw insertError
        personId = inserted.id
      } else if (found && !found.photo_url && member.photoUrl) {
        // Backfill only — never replace a photo we already have.
        const { error: photoError } = await this.client
          .from("people")
          .update({ photo_url: member.photoUrl })
          .eq("id", personId)
        if (photoError) throw photoError
      }

      const { error: linkError } = await this.client.from("media_people").upsert(
        {
          media_id: mediaId,
          person_id: personId,
          role: "actor",
          character_name: member.characterName,
          sort_order: member.sortOrder,
        },
        { onConflict: "media_id,person_id,role" }
      )
      if (linkError) throw linkError
    }
  }
}

function mapPendingRow(row: { id: string; imdb_id: string; title: string }): PendingMediaItem {
  return { id: row.id, imdbId: row.imdb_id, title: row.title }
}
