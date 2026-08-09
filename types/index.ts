// Central type definitions, mapped 1:1 to supabase/migrations table columns.
// Services own the row (snake_case) -> DTO (camelCase) mapping; nothing here
// should import a Supabase client.

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export type MediaType = "movie" | "tv"

export type MediaItem = {
  id: string
  createdAt: string
  updatedAt: string
  imdbId: string
  tmdbId: number | null
  type: MediaType
  titleType: string | null
  title: string
  originalTitle: string | null
  slug: string
  year: number | null
  endYear: number | null
  runtimeMinutes: number | null
  description: string | null
  posterUrl: string | null
  contentRating: string | null
  imdbRating: number | null
  imdbVotes: number | null
  imdbUrl: string | null
  isStub: boolean
  enrichedAt: string | null
  metadata: Record<string, unknown>
}

export type Genre = {
  id: string
  name: string
  slug: string
}

export type Person = {
  id: string
  imdbId: string | null
  name: string
  photoUrl: string | null
}

// ---------------------------------------------------------------------------
// Personal data
// ---------------------------------------------------------------------------

export type UserMediaStatusSource = "manual" | "imdb_ratings" | "imdb_watchlist"

export type UserMediaStatus = {
  id: string
  createdAt: string
  updatedAt: string
  userId: string
  mediaId: string
  watched: boolean
  watchedAt: string | null
  personalRating: number | null
  wantToWatch: boolean
  wantAddedAt: string | null
  dismissed: boolean
  source: UserMediaStatusSource
  manuallyEdited: boolean
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

export type ImdbCsvSourceType = "ratings" | "watchlist"

export type ImdbImportBatchStatus = "pending" | "completed" | "failed"

export type ImdbImportBatch = {
  id: string
  createdAt: string
  userId: string
  sourceType: ImdbCsvSourceType
  fileName: string | null
  status: ImdbImportBatchStatus
  totalRows: number
  matchedRows: number
  createdRows: number
  skippedRows: number
  completedAt: string | null
}

export type ImdbImportRowResult = "pending" | "matched" | "created" | "skipped"

export type ImdbImportRow = {
  id: string
  batchId: string
  imdbId: string
  title: string | null
  titleType: string | null
  year: number | null
  yourRating: number | null
  dateRated: string | null
  mediaId: string | null
  result: ImdbImportRowResult
}
