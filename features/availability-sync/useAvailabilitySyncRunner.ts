"use client"

import { useCallback, useRef, useState } from "react"
import { syncAvailabilityBatchAction } from "@/actions/availability-sync"
import type { AvailabilitySyncError } from "@/ingestion/availability-sync"

export type AvailabilitySyncTotals = {
  processed: number
  synced: number
  notFound: number
  failed: number
  withoutProviders: number
  withDirectLinks: number
  withFallbackLinks: number
  rowsUpserted: number
  rowsExpired: number
}

export type AvailabilitySyncRunState =
  | { phase: "idle" }
  | { phase: "running"; totals: AvailabilitySyncTotals; total: number }
  | {
      phase: "done"
      totals: AvailabilitySyncTotals
      total: number
      cancelled: boolean
      errors: AvailabilitySyncError[]
      unmatchedProviders: string[]
    }
  | {
      phase: "error"
      totals: AvailabilitySyncTotals
      total: number
      message: string
      errors: AvailabilitySyncError[]
      unmatchedProviders: string[]
    }

const BATCH_SIZE = 20

// The server already caps errors per batch; this caps the accumulation across
// a run so a catalog-wide failure can't grow the state unboundedly.
const MAX_COLLECTED_ERRORS = 100

const EMPTY_TOTALS: AvailabilitySyncTotals = {
  processed: 0,
  synced: 0,
  notFound: 0,
  failed: 0,
  withoutProviders: 0,
  withDirectLinks: 0,
  withFallbackLinks: 0,
  rowsUpserted: 0,
  rowsExpired: 0,
}

/**
 * Drives the availability sync from the client, one batch per request — same
 * reasoning as features/tmdb-sync/useTmdbSyncRunner: `useActionState` only
 * exposes a boolean `pending`, and a single action walking the whole catalog
 * would sit past any function timeout.
 *
 * Kept as its own hook rather than generalising that one, because the
 * accumulation isn't homogeneous: seven counters to add, a Set to union
 * (unmatchedProviders) and a capped list to concatenate (errors). A shared
 * runner would need a per-field reducer injected, and useTmdbSyncRunner has
 * two live consumers that would be put at risk for no functional gain. The
 * state machine is deliberately identical so both read alike.
 */
export function useAvailabilitySyncRunner() {
  const [state, setState] = useState<AvailabilitySyncRunState>({ phase: "idle" })
  const cancelledRef = useRef(false)

  const run = useCallback(async (options: { pendingCount: number }) => {
    cancelledRef.current = false

    const total = options.pendingCount
    const totals: AvailabilitySyncTotals = { ...EMPTY_TOTALS }
    const errors: AvailabilitySyncError[] = []
    const unmatched = new Set<string>()

    if (total === 0) {
      setState({
        phase: "done",
        totals,
        total,
        cancelled: false,
        errors,
        unmatchedProviders: [],
      })
      return
    }

    setState({ phase: "running", totals: { ...totals }, total })

    for (;;) {
      const result = await syncAvailabilityBatchAction({ batchSize: BATCH_SIZE })

      if (result.status === "error") {
        setState({
          phase: "error",
          totals: { ...totals },
          total,
          message: result.message,
          errors,
          unmatchedProviders: Array.from(unmatched),
        })
        return
      }

      totals.processed += result.batch.processed
      totals.synced += result.batch.synced
      totals.notFound += result.batch.notFound
      totals.failed += result.batch.failed
      totals.withoutProviders += result.batch.withoutProviders
      totals.withDirectLinks += result.batch.withDirectLinks
      totals.withFallbackLinks += result.batch.withFallbackLinks
      totals.rowsUpserted += result.batch.rowsUpserted
      totals.rowsExpired += result.batch.rowsExpired

      for (const name of result.batch.unmatchedProviders) unmatched.add(name)
      for (const error of result.batch.errors) {
        if (errors.length < MAX_COLLECTED_ERRORS) errors.push(error)
      }

      const finished =
        result.batch.remaining === 0 ||
        // A batch that processed nothing while rows are still pending means we
        // can't make progress — stop instead of looping on an empty slice.
        // This is also what ends the run when platforms is empty, since that
        // guard returns processed: 0 with an error row.
        result.batch.processed === 0

      if (finished || cancelledRef.current) {
        setState({
          phase: "done",
          totals: { ...totals },
          total,
          cancelled: cancelledRef.current,
          errors,
          unmatchedProviders: Array.from(unmatched),
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
export function availabilityProgressValue(state: AvailabilitySyncRunState): number {
  if (state.phase === "idle") return 0
  if (state.total === 0) return 100
  return Math.min(100, Math.round((state.totals.processed / state.total) * 100))
}
