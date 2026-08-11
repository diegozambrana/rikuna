"use client"

import { useState } from "react"
import {
  flexRender,
  type PaginationState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table"
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const DEFAULT_PAGE_SIZE = 10

type DataTableProps<TData extends RowData> = {
  columns: LegacyColumnDef<TData>[]
  data: TData[]
  emptyMessage?: string
  /** Optional row-click handler (e.g. navigating to a detail page) — rows render with a pointer cursor when set. */
  onRowClick?: (row: TData) => void
  /**
   * Opt-in "filas por página" selector. The first option is the initial page
   * size; tables that omit this keep the fixed 10-row pagination.
   */
  pageSizeOptions?: number[]
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  emptyMessage = "Sin datos.",
  onRowClick,
  pageSizeOptions,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSizeOptions?.[0] ?? DEFAULT_PAGE_SIZE,
  })

  const table = useLegacyTable({
    data,
    columns,
    state: { sorting, pagination },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortDir = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={
                      header.column.getCanSort() ? "cursor-pointer select-none" : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {sortDir === "asc" ? " ↑" : sortDir === "desc" ? " ↓" : null}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {(pageSizeOptions || table.getPageCount() > 1) && (
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {pageSizeOptions && (
            <div className="mr-auto flex items-center gap-2">
              <Label htmlFor="page-size" className="text-xs text-muted-foreground">
                Filas por página
              </Label>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger
                  id="page-size"
                  className="w-20"
                  aria-label="Cantidad de elementos por página"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {table.getPageCount() > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {pagination.pageIndex + 1} de {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
