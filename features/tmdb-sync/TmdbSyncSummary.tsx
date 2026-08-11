"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import type { TmdbSyncRunState } from "./useTmdbSyncRunner"

/**
 * Final counters for a finished (or failed) run — same Alert + Table shape as
 * features/import/ImportSummary so both flows read alike.
 */
export function TmdbSyncSummary({ state }: { state: TmdbSyncRunState }) {
  if (state.phase === "idle" || state.phase === "running") return null

  const { totals } = state
  const hadProblems = totals.failed > 0 || state.phase === "error"

  return (
    <Alert variant={hadProblems ? "destructive" : "default"}>
      <AlertTitle>{title(state)}</AlertTitle>
      <AlertDescription>
        {state.phase === "error" ? <p className="mb-2">{state.message}</p> : null}
        <Table className="mt-2">
          <TableBody>
            <TableRow>
              <TableCell className="text-muted-foreground">Títulos procesados</TableCell>
              <TableCell className="text-right font-medium">{totals.processed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Sincronizados</TableCell>
              <TableCell className="text-right font-medium">{totals.synced}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Sin resultado en TMDB</TableCell>
              <TableCell className="text-right font-medium">{totals.notFound}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Con error</TableCell>
              <TableCell className="text-right font-medium">{totals.failed}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </AlertDescription>
    </Alert>
  )
}

function title(state: Exclude<TmdbSyncRunState, { phase: "idle" } | { phase: "running" }>): string {
  if (state.phase === "error") return "La sincronización se detuvo"
  if (state.cancelled) return "Sincronización cancelada"
  return "Sincronización completada"
}
