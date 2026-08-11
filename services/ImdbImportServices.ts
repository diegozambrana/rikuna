import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { mapImdbTitleType } from "@/constants/imdbTitleTypeMap"
import { slugify, withSlugRetry } from "@/lib/slug"
import type {
  ImdbCsvSourceType,
  ImdbImportBatch,
  ImdbImportBatchStatus,
  ImdbImportRow,
  ImdbImportRowResult,
  MediaItem,
  UserMediaStatusSource,
} from "@/types"
import type { ImdbCsvRow } from "@/ingestion/imdb-import/parseCsv"

type MediaMatchResult = "matched" | "created"

// Write-shaped patch for user_media_status — mirrors DB columns directly
// since it is passed straight into an upsert, not surfaced to the UI as a DTO.
export type UserMediaStatusUpsertPatch = {
  watched?: boolean
  watched_at?: string | null
  personal_rating?: number | null
  want_to_watch?: boolean
  want_added_at?: string | null
  source: UserMediaStatusSource
}

export type ImdbImportBatchCounts = {
  totalRows: number
  matchedRows: number
  createdRows: number
  skippedRows: number
}

export class ImdbImportServices {
  constructor(private readonly client: SupabaseClient) {}

  async createBatch(
    userId: string,
    sourceType: ImdbCsvSourceType,
    fileName: string | null
  ): Promise<ImdbImportBatch> {
    const { data, error } = await this.client
      .from("imdb_import_batches")
      .insert({ user_id: userId, source_type: sourceType, file_name: fileName, status: "pending" })
      .select()
      .single()

    if (error) throw error
    return mapBatchRow(data)
  }

  async findOrCreateMediaItem(
    csvRow: ImdbCsvRow
  ): Promise<{ mediaItem: MediaItem; result: MediaMatchResult }> {
    const { data: existing, error: selectError } = await this.client
      .from("media_items")
      .select("*")
      .eq("imdb_id", csvRow.imdbId)
      .maybeSingle()

    if (selectError) throw selectError
    if (existing) {
      return { mediaItem: mapMediaItemRow(existing), result: "matched" }
    }

    const type = mapImdbTitleType(csvRow.titleType)
    // An id-only CSV gives us no title, but media_items.title and .slug are
    // both NOT NULL. The IMDb id stands in for each until the TMDB sync
    // replaces them — see syncMediaItem, which recognizes the placeholder by
    // title === imdb_id and rewrites the slug along with the real title.
    const title = csvRow.title || csvRow.imdbId
    const baseSlug = slugify(title, csvRow.year ?? undefined)

    const createdRow = await withSlugRetry(baseSlug, async (slug) => {
      const { data, error } = await this.client
        .from("media_items")
        .insert({
          imdb_id: csvRow.imdbId,
          type,
          title_type: csvRow.titleType || null,
          title,
          slug,
          year: csvRow.year,
          runtime_minutes: csvRow.runtimeMinutes,
          imdb_rating: csvRow.imdbRating,
          imdb_votes: csvRow.imdbVotes,
          is_stub: true,
        })
        .select()
        .single()

      if (error) throw error
      return data
    })

    const mediaItem = mapMediaItemRow(createdRow)

    await this.linkGenres(mediaItem.id, csvRow.genres)
    await this.linkDirectors(mediaItem.id, csvRow.directors)

    return { mediaItem, result: "created" }
  }

  private async linkGenres(mediaId: string, genreNames: string[]): Promise<void> {
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

  private async linkDirectors(mediaId: string, directorNames: string[]): Promise<void> {
    for (const rawName of directorNames) {
      const name = rawName.trim()
      if (!name) continue

      const { data: existing, error: selectError } = await this.client
        .from("people")
        .select("id")
        .ilike("name", name)
        .maybeSingle()
      if (selectError) throw selectError

      let personId = (existing as { id: string } | null)?.id
      if (!personId) {
        const { data: inserted, error: insertError } = await this.client
          .from("people")
          .insert({ name })
          .select("id")
          .single()
        if (insertError) throw insertError
        personId = inserted.id
      }

      const { error: linkError } = await this.client.from("media_people").upsert(
        { media_id: mediaId, person_id: personId, role: "director" },
        { onConflict: "media_id,person_id,role" }
      )
      if (linkError) throw linkError
    }
  }

  /**
   * Upserts on (user_id, media_id). A manually_edited=true row is left alone,
   * except a ratings import may still fill personal_rating if it was NULL —
   * see AC-4 / ground_truth_db_notes in the RIK-4 spec.
   */
  async upsertUserMediaStatus(
    userId: string,
    mediaId: string,
    patch: UserMediaStatusUpsertPatch,
    isRatingsImport: boolean
  ): Promise<void> {
    const { data: existing, error: selectError } = await this.client
      .from("user_media_status")
      .select("id, manually_edited, personal_rating")
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .maybeSingle()
    if (selectError) throw selectError

    if (!existing || !existing.manually_edited) {
      const { error } = await this.client
        .from("user_media_status")
        .upsert(
          { user_id: userId, media_id: mediaId, ...patch },
          { onConflict: "user_id,media_id" }
        )
      if (error) throw error
      return
    }

    const canFillRating =
      isRatingsImport && existing.personal_rating === null && patch.personal_rating != null

    if (canFillRating) {
      const { error } = await this.client
        .from("user_media_status")
        .update({ personal_rating: patch.personal_rating })
        .eq("id", existing.id)
      if (error) throw error
    }
    // Otherwise: manually_edited protects this row, skip the write entirely.
  }

  async insertRow(
    batchId: string,
    csvRow: ImdbCsvRow,
    mediaId: string | null,
    result: ImdbImportRowResult
  ): Promise<void> {
    const { error } = await this.client.from("imdb_import_rows").insert({
      batch_id: batchId,
      imdb_id: csvRow.imdbId,
      title: csvRow.title || null,
      title_type: csvRow.titleType || null,
      year: csvRow.year,
      your_rating: csvRow.yourRating,
      date_rated: csvRow.dateRated,
      media_id: mediaId,
      result,
    })
    if (error) throw error
  }

  async finalizeBatch(
    batchId: string,
    counts: ImdbImportBatchCounts,
    status: ImdbImportBatchStatus = "completed"
  ): Promise<void> {
    const { error } = await this.client
      .from("imdb_import_batches")
      .update({
        total_rows: counts.totalRows,
        matched_rows: counts.matchedRows,
        created_rows: counts.createdRows,
        skipped_rows: counts.skippedRows,
        status,
        completed_at: new Date().toISOString(),
      })
      .eq("id", batchId)
    if (error) throw error
  }

  async listBatchesForUser(userId: string): Promise<ImdbImportBatch[]> {
    const { data, error } = await this.client
      .from("imdb_import_batches")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapBatchRow)
  }

  async getBatchWithRows(
    batchId: string,
    userId: string
  ): Promise<{ batch: ImdbImportBatch; rows: ImdbImportRow[] } | null> {
    const { data: batchRow, error: batchError } = await this.client
      .from("imdb_import_batches")
      .select("*")
      .eq("id", batchId)
      .eq("user_id", userId)
      .maybeSingle()

    if (batchError) throw batchError
    if (!batchRow) return null

    const { data: rowRows, error: rowsError } = await this.client
      .from("imdb_import_rows")
      .select("*")
      .eq("batch_id", batchId)
      .order("title", { ascending: true })

    if (rowsError) throw rowsError

    return {
      batch: mapBatchRow(batchRow),
      rows: (rowRows ?? []).map(mapImportRowRow),
    }
  }
}

function mapBatchRow(row: Record<string, unknown>): ImdbImportBatch {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    userId: row.user_id as string,
    sourceType: row.source_type as ImdbCsvSourceType,
    fileName: (row.file_name as string | null) ?? null,
    status: row.status as ImdbImportBatchStatus,
    totalRows: row.total_rows as number,
    matchedRows: row.matched_rows as number,
    createdRows: row.created_rows as number,
    skippedRows: row.skipped_rows as number,
    completedAt: (row.completed_at as string | null) ?? null,
  }
}

function mapImportRowRow(row: Record<string, unknown>): ImdbImportRow {
  return {
    id: row.id as string,
    batchId: row.batch_id as string,
    imdbId: row.imdb_id as string,
    title: (row.title as string | null) ?? null,
    titleType: (row.title_type as string | null) ?? null,
    year: (row.year as number | null) ?? null,
    yourRating: (row.your_rating as number | null) ?? null,
    dateRated: (row.date_rated as string | null) ?? null,
    mediaId: (row.media_id as string | null) ?? null,
    result: row.result as ImdbImportRowResult,
  }
}

function mapMediaItemRow(row: Record<string, unknown>): MediaItem {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    imdbId: row.imdb_id as string,
    tmdbId: (row.tmdb_id as number | null) ?? null,
    type: row.type as MediaItem["type"],
    titleType: (row.title_type as string | null) ?? null,
    title: row.title as string,
    originalTitle: (row.original_title as string | null) ?? null,
    slug: row.slug as string,
    year: (row.year as number | null) ?? null,
    endYear: (row.end_year as number | null) ?? null,
    runtimeMinutes: (row.runtime_minutes as number | null) ?? null,
    description: (row.description as string | null) ?? null,
    posterUrl: (row.poster_url as string | null) ?? null,
    contentRating: (row.content_rating as string | null) ?? null,
    imdbRating: (row.imdb_rating as number | null) ?? null,
    imdbVotes: (row.imdb_votes as number | null) ?? null,
    imdbUrl: (row.imdb_url as string | null) ?? null,
    isStub: row.is_stub as boolean,
    enrichedAt: (row.enriched_at as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}
