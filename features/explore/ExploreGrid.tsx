"use client"

import { useState } from "react"
import { MediaCard } from "@/components/MediaCard"
import { PaginationBar } from "@/components/Pagination"
import type { MediaItem } from "@/types"

// Larger steps than the table's: a card carries far less text per row of
// screen, so 10 at a time would leave most of the viewport empty.
const PAGE_SIZE_OPTIONS = [24, 48, 96]

export function ExploreGrid({ items }: { items: MediaItem[] }) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ningún título del catálogo coincide con estos filtros.
      </p>
    )
  }

  const pageCount = Math.ceil(items.length / pageSize)
  // Clamped during render rather than corrected in an effect: growing the page
  // size shrinks the page count, and without this the grid would come back
  // empty on what is now a page past the end. A filter change doesn't need
  // handling here — the page's Suspense boundary is keyed on the filters, so
  // this component remounts with a fresh page index.
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const start = safePageIndex * pageSize
  const visible = items.slice(start, start + pageSize)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {visible.map((item) => (
          <MediaCard
            key={item.id}
            href={`/titulo/${item.slug}`}
            title={item.title}
            year={item.year}
            posterUrl={item.posterUrl}
            imdbRating={item.imdbRating}
            isStub={item.isStub}
          />
        ))}
      </div>

      <PaginationBar
        pageIndex={safePageIndex}
        pageCount={pageCount}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        sizeLabel="Tarjetas por página"
        sizeInputId="grid-page-size"
        onPageChange={setPageIndex}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPageIndex(0)
        }}
      />
    </div>
  )
}
