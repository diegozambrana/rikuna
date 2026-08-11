"use client"

import { useRouter } from "next/navigation"
import { Film } from "lucide-react"
import type { LegacyColumnDef } from "@tanstack/react-table/legacy"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/Table/DataTable"
import type { MediaItem, MediaType } from "@/types"

// The catalog is the largest table in the app, so it offers the same page-size
// control as /biblioteca.
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const TYPE_LABELS: Record<MediaType, string> = {
  movie: "Película",
  tv: "Serie",
}

const votesFormatter = new Intl.NumberFormat("es-ES")

const columns: LegacyColumnDef<MediaItem>[] = [
  {
    id: "title",
    accessorFn: (row) => row.title,
    header: "Título",
    cell: ({ row }) => {
      const { title, posterUrl, isStub } = row.original
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
    accessorFn: (row) => row.year ?? 0,
    header: "Año",
    cell: ({ row }) => row.original.year ?? "—",
  },
  {
    id: "type",
    accessorFn: (row) => row.type,
    header: "Tipo",
    cell: ({ row }) => TYPE_LABELS[row.original.type],
  },
  {
    id: "runtime",
    accessorFn: (row) => row.runtimeMinutes ?? 0,
    header: "Duración",
    cell: ({ row }) =>
      row.original.runtimeMinutes !== null ? `${row.original.runtimeMinutes} min` : "—",
  },
  {
    id: "rating",
    accessorFn: (row) => row.imdbRating ?? -1,
    header: "IMDb",
    cell: ({ row }) =>
      row.original.imdbRating !== null ? (
        <Badge variant="secondary" className="font-mono">
          {row.original.imdbRating.toFixed(1)}
        </Badge>
      ) : (
        "—"
      ),
  },
  {
    id: "votes",
    accessorFn: (row) => row.imdbVotes ?? -1,
    header: "Votos",
    cell: ({ row }) =>
      row.original.imdbVotes !== null ? votesFormatter.format(row.original.imdbVotes) : "—",
  },
]

export function ExploreTable({ items }: { items: MediaItem[] }) {
  const router = useRouter()

  return (
    <DataTable
      columns={columns}
      data={items}
      emptyMessage="Ningún título del catálogo coincide con estos filtros."
      onRowClick={(item) => router.push(`/titulo/${item.slug}`)}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
    />
  )
}
