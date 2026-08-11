import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { TmdbSyncServices } from "@/services"
import { syncMediaItem, type SyncOutcome } from "./syncMediaItem"

export type TmdbSyncBatchResult = {
  processed: number
  synced: number
  notFound: number
  failed: number
  /** Rows still in 'pending' after this batch — 0 means the run is done. */
  remaining: number
}

export type RunTmdbSyncOptions = {
  /** How many titles this call processes. Keep it small: one call is one HTTP request. */
  limit: number
  /** Restricts the run to the titles one IMDb import batch touched. */
  importBatchId?: string
}

// TMDB's published ceiling is ~50 requests/second and each title costs 2-3
// requests. Five in flight keeps a comfortable margin while still being ~5x
// faster than a serial loop.
const CONCURRENCY = 5

/**
 * Processes ONE batch of pending titles and returns immediately.
 *
 * Deliberately not a "sync everything" entry point: the caller (a Server
 * Action, driven by features/tmdb-sync/useTmdbSyncRunner) invokes it in a loop
 * so each request stays short, progress is observable, and a catalog-sized run
 * never risks a function timeout.
 *
 * This is the one place in the codebase that writes the shared catalog, which
 * is why it lives in ingestion/ and builds its own service-role client: no RLS
 * policy grants UPDATE on media_items to `authenticated`, and granting one
 * would let any signed-in user rewrite the global catalog from the browser.
 * The calling action still authenticates the user before delegating here.
 */
export async function runTmdbSync(options: RunTmdbSyncOptions): Promise<TmdbSyncBatchResult> {
  const services = new TmdbSyncServices(createAdminClient())

  const pending = await services.listPending(options.limit, options.importBatchId)

  const counts = { synced: 0, notFound: 0, failed: 0 }

  for (const group of chunk(pending, CONCURRENCY)) {
    const outcomes = await Promise.all(group.map((item) => syncMediaItem(services, item)))
    for (const outcome of outcomes) {
      countOutcome(counts, outcome)
    }
  }

  const remaining = await services.countPendingForRun(options.importBatchId)

  return { processed: pending.length, ...counts, remaining }
}

/**
 * Requeues every 'failed' row. Also a write, so it needs the same privileged
 * client and belongs on this side of the boundary.
 */
export async function resetFailedTmdbSync(): Promise<number> {
  return new TmdbSyncServices(createAdminClient()).resetFailedToPending()
}

// No counting helper here on purpose: reads don't need the service-role
// client (media_items_select is `using (true)`), so actions/tmdb-sync does
// them with the caller's own session and the admin client stays write-only.

function countOutcome(counts: { synced: number; notFound: number; failed: number }, outcome: SyncOutcome) {
  if (outcome === "synced") counts.synced += 1
  else if (outcome === "not_found") counts.notFound += 1
  else counts.failed += 1
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
