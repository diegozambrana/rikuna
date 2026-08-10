"use client"

import { useRouter } from "next/navigation"
import type { LegacyColumnDef } from "@tanstack/react-table/legacy"
import type { LibraryRow } from "@/actions/media"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/Table/DataTable"
import type { MediaType } from "@/types"

const TYPE_LABELS: Record<MediaType, string> = {
  movie: "Película",
  tv: "Serie",
}

const columns: LegacyColumnDef<LibraryRow>[] = [
  {
    id: "title",
    accessorFn: (row) => row.media.title,
    header: "Título",
    cell: ({ row }) => <span className="font-medium">{row.original.media.title}</span>,
  },
  {
    id: "year",
    accessorFn: (row) => row.media.year ?? 0,
    header: "Año",
    cell: ({ row }) => row.original.media.year ?? "—",
  },
  {
    id: "type",
    accessorFn: (row) => row.media.type,
    header: "Tipo",
    cell: ({ row }) => TYPE_LABELS[row.original.media.type],
  },
  {
    id: "rating",
    accessorFn: (row) => row.media.imdbRating ?? -1,
    header: "IMDb",
    cell: ({ row }) =>
      row.original.media.imdbRating !== null ? (
        <Badge variant="secondary" className="font-mono">
          {row.original.media.imdbRating.toFixed(1)}
        </Badge>
      ) : (
        "—"
      ),
  },
  {
    id: "status",
    header: "Estado",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.status.watched && <Badge variant="default">Visto</Badge>}
        {row.original.status.wantToWatch && <Badge variant="outline">Quiero ver</Badge>}
      </div>
    ),
  },
  {
    id: "availability",
    header: "Disponibilidad",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.isAvailable ? (
        <Badge variant="default">Disponible</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
]

export function LibraryTable({ rows }: { rows: LibraryRow[] }) {
  const router = useRouter()

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No hay títulos que coincidan con los filtros seleccionados."
      onRowClick={(row) => router.push(`/titulo/${row.media.slug}`)}
    />
  )
}
