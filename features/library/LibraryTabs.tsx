"use client"

import { useRouter } from "next/navigation"
import type { GetLibraryParams, LibraryTab } from "@/actions/media"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS: { value: LibraryTab; label: string }[] = [
  { value: "watched", label: "Vistas" },
  { value: "want_to_watch", label: "Quiero ver" },
  { value: "all", label: "Todas" },
]

// Preserves every active filter across a tab switch — same URLSearchParams
// round-trip GenreFilterSelect.tsx does for a single param, generalized to
// this screen's full filter set.
function buildTabHref(tab: LibraryTab, filters: GetLibraryParams): string {
  const params = new URLSearchParams()
  params.set("tab", tab)
  if (filters.query) params.set("q", filters.query)
  if (filters.type) params.set("tipo", filters.type)
  if (filters.genreSlug) params.set("genero", filters.genreSlug)
  if (filters.yearMin !== undefined) params.set("anioDesde", String(filters.yearMin))
  if (filters.yearMax !== undefined) params.set("anioHasta", String(filters.yearMax))
  if (filters.ratingMin !== undefined) params.set("calificacion", String(filters.ratingMin))
  if (filters.onlyAvailable) params.set("disponible", "1")
  return `/biblioteca?${params.toString()}`
}

// Client component: Base UI's Tabs intercepts the trigger's click (it calls
// preventDefault to drive its own ARIA tab-selection behavior), which
// swallows next/link's navigation when the trigger is rendered as a plain
// <Link> via `render`. Driving navigation from onValueChange instead is the
// reliable way to keep this a real URL change, not just a visual toggle.
export function LibraryTabs({ current, filters }: { current: LibraryTab; filters: GetLibraryParams }) {
  const router = useRouter()

  return (
    <Tabs
      value={current}
      onValueChange={(value) => router.push(buildTabHref(value as LibraryTab, filters))}
      className="w-full"
    >
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
