import { SearchParamInput } from "@/components/SearchParamInput"
import type { Genre, MediaItem, Platform } from "@/types"
import { ExploreFilters, type ExploreFilterValues } from "./ExploreFilters"
import { ExploreGrid } from "./ExploreGrid"
import { ExploreTable } from "./ExploreTable"
import { ExploreViewToggle } from "./ExploreViewToggle"
import type { ExploreView } from "./view"

const countFormatter = new Intl.NumberFormat("es-ES")

export function ExploreScreen({
  items,
  total,
  truncated,
  limit,
  genres,
  platforms,
  filters,
  view,
}: {
  items: MediaItem[]
  total: number
  truncated: boolean
  limit: number
  genres: Genre[]
  platforms: Pick<Platform, "id" | "name" | "slug">[]
  filters: ExploreFilterValues
  view: ExploreView
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SearchParamInput
          param="q"
          currentValue={filters.query}
          placeholder="Buscar por título…"
          label="Buscar por título"
        />
        <ExploreFilters genres={genres} platforms={platforms} current={filters} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? "Sin resultados"
            : truncated
              ? // Saying it outright beats letting someone page to the end of a
                // silently cut list and believe that's the whole catalog.
                `Mostrando ${countFormatter.format(limit)} de ${countFormatter.format(total)} títulos. Afina los filtros para ver el resto.`
              : `${countFormatter.format(total)} ${total === 1 ? "título" : "títulos"}`}
        </p>
        <ExploreViewToggle current={view} />
      </div>

      {view === "cuadricula" ? <ExploreGrid items={items} /> : <ExploreTable items={items} />}
    </div>
  )
}
