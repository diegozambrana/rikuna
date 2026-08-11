"use client"

import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import type { AvailabilitySyncRunState } from "./useAvailabilitySyncRunner"
import { availabilityProgressValue } from "./useAvailabilitySyncRunner"

/**
 * Progress bar for a running sync. Note the Progress API: the Root already
 * renders its own Track + Indicator after `children`, so composing Label and
 * Value is all that's needed — adding a Track here would paint two bars.
 */
export function AvailabilitySyncProgress({ state }: { state: AvailabilitySyncRunState }) {
  if (state.phase !== "running") return null

  return (
    <Progress value={availabilityProgressValue(state)}>
      <ProgressLabel>
        Buscando enlaces… {state.totals.processed} de {state.total}
      </ProgressLabel>
      <ProgressValue />
    </Progress>
  )
}
