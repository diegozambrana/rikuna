"use client"

import type { LegacyColumnDef } from "@tanstack/react-table/legacy"
import { DataTable } from "@/components/Table/DataTable"
import type { ImdbImportRow } from "@/types"
import { ImportResultBadge } from "./ImportResultBadge"

const columns: LegacyColumnDef<ImdbImportRow>[] = [
  {
    accessorKey: "title",
    header: "Título",
    cell: ({ getValue }) => (getValue() as string | null) ?? "—",
  },
  {
    accessorKey: "imdbId",
    header: "IMDb ID",
  },
  {
    accessorKey: "result",
    header: "Resultado",
    cell: ({ getValue }) => <ImportResultBadge result={getValue() as ImdbImportRow["result"]} />,
  },
]

export function BatchDetailTable({ rows }: { rows: ImdbImportRow[] }) {
  return <DataTable columns={columns} data={rows} emptyMessage="Esta importación no tiene filas." />
}
