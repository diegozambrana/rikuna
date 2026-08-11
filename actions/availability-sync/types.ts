import type {
  AvailabilitySyncBatchResult,
  ProviderIdSyncResult,
} from "@/ingestion/availability-sync"
import type { AvailabilitySyncCounts } from "@/services"

export type SyncAvailabilityBatchInput = {
  /** Titles per call. The client loops; see features/availability-sync/useAvailabilitySyncRunner. */
  batchSize?: number
}

export type SyncAvailabilityBatchResult =
  | { status: "ok"; batch: AvailabilitySyncBatchResult }
  | { status: "error"; message: string }

export type AvailabilitySyncStatusResult =
  | {
      status: "ok"
      counts: AvailabilitySyncCounts
      /** Rows in `platforms` — zero means a run would write nothing at all. */
      platformCount: number
    }
  | { status: "error"; message: string }

export type RetryFailedAvailabilitySyncResult =
  | { status: "ok"; requeued: number }
  | { status: "error"; message: string }

export type SyncWatchProviderIdsResult =
  | { status: "ok"; result: ProviderIdSyncResult }
  | { status: "error"; message: string }
