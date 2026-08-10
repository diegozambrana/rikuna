"use client"

import { useEffect, useState } from "react"
import { searchTitles } from "@/actions/media/searchTitles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MediaSearchResult } from "@/services"

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

// Inline search-and-add control for the list detail screen — debounced
// catalog search, one "Agregar" button per result. Parent owns the actual
// mutation (handleAdd) so it can update its optimistic item list.
export function TitleSearchAndAdd({
  onAdd,
  existingMediaIds,
}: {
  onAdd: (result: MediaSearchResult) => void
  existingMediaIds: Set<string>
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MediaSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const trimmedQuery = query.trim()
  const queryTooShort = trimmedQuery.length < MIN_QUERY_LENGTH

  useEffect(() => {
    if (queryTooShort) return

    const timeout = setTimeout(() => {
      setSearching(true)
      searchTitles(trimmedQuery)
        .then(setResults)
        .finally(() => setSearching(false))
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [trimmedQuery, queryTooShort])

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Buscar título para agregar..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar título para agregar a la lista"
      />

      {!queryTooShort && searching && <p className="text-xs text-muted-foreground">Buscando...</p>}

      {!queryTooShort && !searching && results.length === 0 && (
        <p className="text-xs text-muted-foreground">Sin resultados.</p>
      )}

      {!queryTooShort && !searching && results.length > 0 && (
        <div className="flex flex-col divide-y divide-border border border-border">
          {results.map((result) => {
            const alreadyIn = existingMediaIds.has(result.id)
            return (
              <div key={result.id} className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs">
                <span className="truncate">
                  {result.title}
                  {result.year ? ` (${result.year})` : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={alreadyIn}
                  onClick={() => {
                    onAdd(result)
                    setQuery("")
                    setResults([])
                  }}
                >
                  {alreadyIn ? "Ya en la lista" : "Agregar"}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
