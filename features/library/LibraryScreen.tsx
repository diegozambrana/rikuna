import type { GetLibraryParams, LibraryRow } from "@/actions/media"
import type { Genre } from "@/types"
import { SearchParamInput } from "@/components/SearchParamInput"
import { EmptyLibraryState } from "./EmptyLibraryState"
import { LibraryFilters } from "./LibraryFilters"
import { LibraryTable } from "./LibraryTable"
import { LibraryTabs } from "./LibraryTabs"

export function LibraryScreen({
  rows,
  hasAnyHistory,
  genres,
  filters,
}: {
  rows: LibraryRow[]
  hasAnyHistory: boolean
  genres: Genre[]
  filters: GetLibraryParams
}) {
  const filtersActive = Boolean(
    filters.query ||
      filters.type ||
      filters.genreSlug ||
      filters.yearMin !== undefined ||
      filters.yearMax !== undefined ||
      filters.ratingMin !== undefined ||
      filters.onlyAvailable
  )

  // AC-6's "invite to import" state is for a genuinely empty account, not
  // just an empty tab/filter combination — see hasAnyHistory's doc comment
  // in actions/media/getLibrary.ts.
  const showEmptyState = rows.length === 0 && !hasAnyHistory && !filtersActive

  return (
    <div className="flex flex-col gap-4">
      <LibraryTabs current={filters.tab} filters={filters} />

      {showEmptyState ? (
        <EmptyLibraryState />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchParamInput
              param="q"
              currentValue={filters.query}
              placeholder="Buscar por título…"
              label="Buscar por título"
            />
            <LibraryFilters
              genres={genres}
              currentType={filters.type}
              currentGenreSlug={filters.genreSlug}
              currentYearMin={filters.yearMin}
              currentYearMax={filters.yearMax}
              currentRatingMin={filters.ratingMin}
              currentOnlyAvailable={filters.onlyAvailable}
            />
          </div>
          <LibraryTable rows={rows} />
        </div>
      )}
    </div>
  )
}
