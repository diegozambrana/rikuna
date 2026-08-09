import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { ImdbImportBatch } from "@/types"

const SOURCE_TYPE_LABEL = {
  ratings: "Calificaciones",
  watchlist: "Lista de seguimiento",
} as const

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function BatchHistoryList({ batches }: { batches: ImdbImportBatch[] }) {
  if (batches.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Todavía no importaste ningún archivo. Sube tu primer CSV de IMDb para empezar.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {batches.map((batch) => (
        <Link key={batch.id} href={`/importar/${batch.id}`}>
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>{SOURCE_TYPE_LABEL[batch.sourceType]}</CardTitle>
              <CardDescription>{dateFormatter.format(new Date(batch.createdAt))}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="font-medium">{batch.totalRows}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reconocidos</dt>
                  <dd className="font-medium">{batch.matchedRows}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Creados</dt>
                  <dd className="font-medium">{batch.createdRows}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Omitidos</dt>
                  <dd className="font-medium">{batch.skippedRows}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
