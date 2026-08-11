"use client"

import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import type { TmdbSyncRunState } from "./useTmdbSyncRunner"
import { syncProgressValue } from "./useTmdbSyncRunner"

/**
 * Progress bar for a running sync. Note the Progress API: the Root already
 * renders its own Track + Indicator after `children`, so composing Label and
 * Value is all that's needed — adding a Track here would paint two bars.
 */
export function TmdbSyncProgress({ state }: { state: TmdbSyncRunState }) {
  if (state.phase !== "running") return null

  return (
    <Progress value={syncProgressValue(state)}>
      <ProgressLabel>
        Sincronizando… {state.totals.processed} de {state.total}
      </ProgressLabel>
      <ProgressValue />
    </Progress>
  )
}
