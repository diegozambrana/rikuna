"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  retryFailedAvailabilitySyncAction,
  syncWatchProviderIdsAction,
} from "@/actions/availability-sync"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import type { AvailabilitySyncCounts } from "@/services"
import { AvailabilitySyncProgress } from "./AvailabilitySyncProgress"
import { AvailabilitySyncSummary } from "./AvailabilitySyncSummary"
import { useAvailabilitySyncRunner } from "./useAvailabilitySyncRunner"

export function AvailabilitySyncScreen({
  counts,
  platformCount,
}: {
  counts: AvailabilitySyncCounts
  platformCount: number
}) {
  const router = useRouter()
  const { state, run, cancel } = useAvailabilitySyncRunner()
  const [isRetrying, startRetry] = useTransition()
  const [isLinking, startLinking] = useTransition()

  const isRunning = state.phase === "running"
  const isDone = state.phase === "done"

  // `pending` counts every unsynced row, but only the ones that already have a
  // tmdb_id are actually queued — that difference is the whole reason
  // /sincronizar has to run first.
  const eligible = counts.pending - counts.withoutTmdbId

  // Pull the fresh counters once a run settles — the numbers above the button
  // are server-rendered, so without this they'd still show the old backlog.
  useEffect(() => {
    if (isDone) router.refresh()
  }, [isDone, router])

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Estado de la disponibilidad</CardTitle>
          <CardDescription>
            Consulta en TMDB en qué plataformas se puede ver cada título y guarda el enlace para
            los países que Rikuna soporta. Solo se guardan las plataformas que ya existen en tu
            base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">Listos para sincronizar</TableCell>
                <TableCell className="text-right font-medium">{eligible}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Sincronizados</TableCell>
                <TableCell className="text-right font-medium">{counts.synced}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Sin resultado en TMDB</TableCell>
                <TableCell className="text-right font-medium">{counts.notFound}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Con error</TableCell>
                <TableCell className="text-right font-medium">{counts.failed}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Aún sin datos de TMDB</TableCell>
                <TableCell className="text-right font-medium">{counts.withoutTmdbId}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Total en el catálogo</TableCell>
                <TableCell className="text-right font-medium">{counts.total}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {platformCount === 0 ? (
            <p className="text-xs text-destructive">
              No hay plataformas registradas, así que la sincronización no guardaría nada. Aplica
              la migración de seed de plataformas primero.
            </p>
          ) : null}

          {counts.withoutTmdbId > 0 ? (
            <p className="text-xs text-muted-foreground">
              {counts.withoutTmdbId} títulos aún no tienen datos de TMDB. Pasa primero por
              Sincronizar catálogo: entran a esta cola solos en cuanto lo hagan.
            </p>
          ) : null}

          <AvailabilitySyncProgress state={state} />

          {isRunning ? (
            <Button variant="outline" className="w-full" onClick={cancel}>
              Cancelar
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={eligible === 0 || platformCount === 0}
              onClick={() => run({ pendingCount: eligible })}
            >
              {eligible === 0 ? "Todo sincronizado" : `Sincronizar ${eligible} títulos`}
            </Button>
          )}

          {/* Without this, a title that failed once would never be retried:
              processed rows leave 'pending' for good. */}
          {!isRunning && counts.failed > 0 ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={isRetrying}
              onClick={() =>
                startRetry(async () => {
                  await retryFailedAvailabilitySyncAction()
                  router.refresh()
                })
              }
            >
              {isRetrying ? "Reencolando..." : `Reintentar ${counts.failed} con error`}
            </Button>
          ) : null}

          {/* Informational backfill — nothing in the sync depends on it, but
              its report is the cheapest way to check the alias table. */}
          {!isRunning ? (
            <Button
              variant="ghost"
              className="w-full"
              disabled={isLinking}
              onClick={() =>
                startLinking(async () => {
                  const result = await syncWatchProviderIdsAction()
                  if (result.status === "error") {
                    toast.error(result.message)
                    return
                  }
                  toast.success(
                    `${result.result.updated} plataformas vinculadas con TMDB.` +
                      (result.result.platformsWithoutProvider.length > 0
                        ? ` Sin equivalente: ${result.result.platformsWithoutProvider.join(", ")}.`
                        : "")
                  )
                  router.refresh()
                })
              }
            >
              {isLinking ? "Vinculando..." : "Vincular proveedores de TMDB"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <AvailabilitySyncSummary state={state} />
    </div>
  )
}
