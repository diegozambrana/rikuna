import type { TmdbSyncBatchResult } from "@/ingestion/tmdb-sync"
import type { TmdbSyncCounts } from "@/services"

export type SyncTmdbBatchInput = {
  /** Titles per call. The client loops; see features/tmdb-sync/useTmdbSyncRunner. */
  batchSize?: number
  /** Restricts the run to one IMDb import batch's titles. */
  importBatchId?: string
}

export type SyncTmdbBatchResult =
  | { status: "ok"; batch: TmdbSyncBatchResult }
  | { status: "error"; message: string }

export type TmdbSyncStatusResult =
  | { status: "ok"; counts: TmdbSyncCounts }
  | { status: "error"; message: string }

export type RetryFailedTmdbSyncResult =
  | { status: "ok"; requeued: number }
  | { status: "error"; message: string }
