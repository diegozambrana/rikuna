"use client"

import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import type { AvailabilitySyncRunState } from "./useAvailabilitySyncRunner"

type SettledState = Exclude<AvailabilitySyncRunState, { phase: "idle" } | { phase: "running" }>

/**
 * Final report for a finished (or failed) run — same Alert + Table shape as
 * features/tmdb-sync/TmdbSyncSummary, plus the two things counters alone can't
 * say: which titles failed and why, and which TMDB providers were skipped
 * because Rikuna doesn't carry them.
 */
export function AvailabilitySyncSummary({ state }: { state: AvailabilitySyncRunState }) {
  if (state.phase === "idle" || state.phase === "running") return null

  const { totals, errors, unmatchedProviders } = state
  const hadProblems = totals.failed > 0 || state.phase === "error"
  const withProviders = totals.synced - totals.withoutProviders

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
              <TableCell className="text-muted-foreground">Con disponibilidad</TableCell>
              <TableCell className="text-right font-medium">{withProviders}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Sin oferta en tus países</TableCell>
              <TableCell className="text-right font-medium">{totals.withoutProviders}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Con enlace directo</TableCell>
              <TableCell className="text-right font-medium">{totals.withDirectLinks}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Con enlace de respaldo</TableCell>
              <TableCell className="text-right font-medium">{totals.withFallbackLinks}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Sin resultado en TMDB</TableCell>
              <TableCell className="text-right font-medium">{totals.notFound}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Con error</TableCell>
              <TableCell className="text-right font-medium">{totals.failed}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">
                Enlaces creados o actualizados
              </TableCell>
              <TableCell className="text-right font-medium">{totals.rowsUpserted}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">
                Enlaces marcados como no disponibles
              </TableCell>
              <TableCell className="text-right font-medium">{totals.rowsExpired}</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {errors.length > 0 ? (
          <div className="mt-4">
            <p className="font-medium">Títulos con error</p>
            <div className="mt-1 max-h-64 overflow-y-auto">
              <Table>
                <TableBody>
                  {errors.map((error) => (
                    <TableRow key={error.mediaId || error.title}>
                      <TableCell>
                        {error.slug ? (
                          <Link href={`/titulo/${error.slug}`} className="underline">
                            {error.title}
                          </Link>
                        ) : (
                          error.title
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {error.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totals.failed > errors.length ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Se muestran los primeros {errors.length} de {totals.failed}.
              </p>
            ) : null}
          </div>
        ) : null}

        {unmatchedProviders.length > 0 ? (
          <p className="mt-4 text-xs">
            TMDB reportó proveedores que no están en tu tabla de plataformas y se ignoraron:{" "}
            <span className="font-medium">{unmatchedProviders.join(", ")}</span>. Si alguno te
            interesa, añádelo como alias en <code>constants/tmdbProviders.ts</code> o como
            plataforma nueva en <code>platforms</code>, y vuelve a sincronizar.
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

function title(state: SettledState): string {
  if (state.phase === "error") return "La sincronización se detuvo"
  if (state.cancelled) return "Sincronización cancelada"
  return "Sincronización completada"
}
