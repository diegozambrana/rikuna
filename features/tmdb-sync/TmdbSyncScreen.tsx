"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { retryFailedTmdbSyncAction } from "@/actions/tmdb-sync"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import type { TmdbSyncCounts } from "@/services"
import { TmdbSyncProgress } from "./TmdbSyncProgress"
import { TmdbSyncSummary } from "./TmdbSyncSummary"
import { useTmdbSyncRunner } from "./useTmdbSyncRunner"

export function TmdbSyncScreen({ counts }: { counts: TmdbSyncCounts }) {
  const router = useRouter()
  const { state, run, cancel } = useTmdbSyncRunner()
  const [isRetrying, startRetry] = useTransition()

  const isRunning = state.phase === "running"
  const isDone = state.phase === "done"

  // Pull the fresh counters once a run settles — the numbers above the button
  // are server-rendered, so without this they'd still show the old backlog.
  useEffect(() => {
    if (isDone) router.refresh()
  }, [isDone, router])

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Estado del catálogo</CardTitle>
          <CardDescription>
            Los títulos importados desde IMDb llegan sin póster, sinopsis ni reparto. La
            sincronización los completa con datos de TMDB.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">Sin sincronizar</TableCell>
                <TableCell className="text-right font-medium">{counts.pending}</TableCell>
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
                <TableCell className="text-muted-foreground">Total en el catálogo</TableCell>
                <TableCell className="text-right font-medium">{counts.total}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <TmdbSyncProgress state={state} />

          {isRunning ? (
            <Button variant="outline" className="w-full" onClick={cancel}>
              Cancelar
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={counts.pending === 0}
              onClick={() => run({ pendingCount: counts.pending })}
            >
              {counts.pending === 0 ? "Todo sincronizado" : `Sincronizar ${counts.pending} títulos`}
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
                  await retryFailedTmdbSyncAction()
                  router.refresh()
                })
              }
            >
              {isRetrying ? "Reencolando..." : `Reintentar ${counts.failed} con error`}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <TmdbSyncSummary state={state} />
    </div>
  )
}
