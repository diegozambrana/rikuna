"use client"

import { useRouter } from "next/navigation"
import { Film } from "lucide-react"
import type { LegacyColumnDef } from "@tanstack/react-table/legacy"
import type { LibraryRow } from "@/actions/media"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/Table/DataTable"
import type { MediaType } from "@/types"

// RIK-14 follow-up: the biblioteca is the one table where a user can rack up
// hundreds of rows, so it exposes the page-size control the shared DataTable
// keeps opt-in.
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const TYPE_LABELS: Record<MediaType, string> = {
  movie: "Película",
  tv: "Serie",
}

const columns: LegacyColumnDef<LibraryRow>[] = [
  {
    id: "title",
    accessorFn: (row) => row.media.title,
    header: "Título",
    cell: ({ row }) => {
      const { title, posterUrl, isStub } = row.original.media
      return (
        <div className="flex items-center gap-3">
          <AspectRatio ratio={2 / 3} className="w-8 shrink-0 bg-muted">
            {!isStub && posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized poster URLs from the catalog process
              <img src={posterUrl} alt={title} className="size-full object-cover" loading="lazy" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <Film className="size-3.5" />
              </div>
            )}
          </AspectRatio>
          <span className="font-medium">{title}</span>
        </div>
      )
    },
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
      pageSizeOptions={PAGE_SIZE_OPTIONS}
    />
  )
}
