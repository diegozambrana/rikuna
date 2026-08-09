import Link from "next/link"
import { notFound } from "next/navigation"
import { getImportBatchDetail } from "@/actions/imdb-import"
import { Button } from "@/components/ui/button"
import { BatchDetailTable } from "@/features/import/components/BatchDetailTable"

const SOURCE_TYPE_LABEL = {
  ratings: "Calificaciones",
  watchlist: "Lista de seguimiento",
} as const

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
})

export default async function ImportBatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  const detail = await getImportBatchDetail(batchId)

  if (!detail) {
    notFound()
  }

  const { batch, rows } = detail

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-medium">
          Importación de {SOURCE_TYPE_LABEL[batch.sourceType]}
        </h1>
        <p className="text-xs text-muted-foreground">
          {dateFormatter.format(new Date(batch.createdAt))}
        </p>
      </div>

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

      <BatchDetailTable rows={rows} />

      <Button
        render={<Link href="/importar" />}
        nativeButton={false}
        variant="outline"
        className="w-fit"
      >
        Volver a Importar
      </Button>
    </div>
  )
}
