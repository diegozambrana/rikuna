"use client"

import { useCallback, useRef, useState } from "react"
import { syncTmdbBatchAction } from "@/actions/tmdb-sync"

export type TmdbSyncTotals = {
  processed: number
  synced: number
  notFound: number
  failed: number
}

export type TmdbSyncRunState =
  | { phase: "idle" }
  | { phase: "running"; totals: TmdbSyncTotals; total: number }
  | { phase: "done"; totals: TmdbSyncTotals; total: number; cancelled: boolean }
  | { phase: "error"; totals: TmdbSyncTotals; total: number; message: string }

const BATCH_SIZE = 20
const EMPTY_TOTALS: TmdbSyncTotals = { processed: 0, synced: 0, notFound: 0, failed: 0 }

/**
 * Drives the sync from the client, one batch per request.
 *
 * `useActionState` can't back a real progress bar — it only exposes a boolean
 * `pending` — and a single action that walked the whole catalog would sit well
 * past any function timeout. So the loop lives here: each call to
 * syncTmdbBatchAction is short, and `remaining` from the server is what tells
 * us when to stop, so an item that errors out mid-run can't spin us forever.
 *
 * Shared by features/tmdb-sync/TmdbSyncScreen (whole catalog) and
 * features/import/UploadForm (scoped to a freshly imported batch).
 */
export function useTmdbSyncRunner() {
  const [state, setState] = useState<TmdbSyncRunState>({ phase: "idle" })
  const cancelledRef = useRef(false)

  const run = useCallback(async (options: { pendingCount: number; importBatchId?: string }) => {
    cancelledRef.current = false

    const total = options.pendingCount
    const totals: TmdbSyncTotals = { ...EMPTY_TOTALS }

    if (total === 0) {
      setState({ phase: "done", totals, total, cancelled: false })
      return
    }

    setState({ phase: "running", totals: { ...totals }, total })

    for (;;) {
      const result = await syncTmdbBatchAction({
        batchSize: BATCH_SIZE,
        importBatchId: options.importBatchId,
      })

      if (result.status === "error") {
        setState({ phase: "error", totals: { ...totals }, total, message: result.message })
        return
      }

      totals.processed += result.batch.processed
      totals.synced += result.batch.synced
      totals.notFound += result.batch.notFound
      totals.failed += result.batch.failed

      const finished =
        result.batch.remaining === 0 ||
        // A batch that processed nothing while rows are still pending means we
        // can't make progress (e.g. every candidate is being retried and
        // failing to persist) — stop instead of looping on an empty slice.
        result.batch.processed === 0

      if (finished || cancelledRef.current) {
        setState({
          phase: "done",
          totals: { ...totals },
          total,
          cancelled: cancelledRef.current,
        })
        return
      }

      setState({ phase: "running", totals: { ...totals }, total })
    }
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
  }, [])

  const reset = useCallback(() => {
    cancelledRef.current = false
    setState({ phase: "idle" })
  }, [])

  return { state, run, cancel, reset }
}

/** Percentage for <Progress value=…>, which expects 0..100 and not a fraction. */
export function syncProgressValue(state: TmdbSyncRunState): number {
  if (state.phase === "idle") return 0
  if (state.total === 0) return 100
  return Math.min(100, Math.round((state.totals.processed / state.total) * 100))
}
