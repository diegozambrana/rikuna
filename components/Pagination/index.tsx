"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Page-size selector plus prev/next controls, shared by the shared DataTable
 * and by /explorar's card grid so the two views of the same data paginate
 * identically instead of drifting into two slightly different bars.
 *
 * Purely presentational: the caller owns the pagination state, since the table
 * keeps it inside TanStack while the grid keeps it in a plain useState.
 */
export function PaginationBar({
  pageIndex,
  pageCount,
  pageSize,
  pageSizeOptions,
  sizeLabel,
  sizeInputId,
  onPageChange,
  onPageSizeChange,
}: {
  pageIndex: number
  pageCount: number
  pageSize: number
  /** Omit to hide the size selector and keep a fixed page size. */
  pageSizeOptions?: number[]
  sizeLabel: string
  sizeInputId: string
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  if (!pageSizeOptions && pageCount <= 1) return null

  const sizeItems = Object.fromEntries(
    (pageSizeOptions ?? []).map((option) => [String(option), String(option)])
  )

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      {pageSizeOptions && (
        <div className="mr-auto flex items-center gap-2">
          <Label htmlFor={sizeInputId} className="text-xs text-muted-foreground">
            {sizeLabel}
          </Label>
          <Select
            items={sizeItems}
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              id={sizeInputId}
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

      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={pageIndex <= 0}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {pageIndex + 1} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={pageIndex >= pageCount - 1}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}
