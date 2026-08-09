import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import type { ImdbImportActionState } from "@/actions/imdb-import"

const SOURCE_TYPE_LABEL = {
  ratings: "Calificaciones",
  watchlist: "Lista de seguimiento",
} as const

export function ImportSummary({ state }: { state: ImdbImportActionState }) {
  if (state.status === "idle") return null

  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo importar el archivo</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    )
  }

  const { summary } = state
  const hasSkipped = summary.skippedRows > 0

  return (
    <Alert variant={hasSkipped ? "destructive" : "default"}>
      <AlertTitle>
        Importación de {SOURCE_TYPE_LABEL[summary.sourceType]} completada
      </AlertTitle>
      <AlertDescription>
        <Table className="mt-2">
          <TableBody>
            <TableRow>
              <TableCell className="text-muted-foreground">Filas procesadas</TableCell>
              <TableCell className="text-right font-medium">{summary.totalRows}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Ya en el catálogo</TableCell>
              <TableCell className="text-right font-medium">{summary.matchedRows}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Nuevas (creadas)</TableCell>
              <TableCell className="text-right font-medium">{summary.createdRows}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">Omitidas</TableCell>
              <TableCell className="text-right font-medium">{summary.skippedRows}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </AlertDescription>
    </Alert>
  )
}
