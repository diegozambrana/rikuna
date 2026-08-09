"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Genre } from "@/types"

// Sentinel item value — Base UI's Select can't hold an empty-string item
// value, so "clear the filter" needs its own non-empty token.
const ALL_GENRES = "__all__"

export function GenreFilterSelect({
  genres,
  currentGenreSlug,
}: {
  genres: Genre[]
  currentGenreSlug?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString())

    if (!value || value === ALL_GENRES) {
      params.delete("genero")
    } else {
      params.set("genero", value)
    }

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <Select value={currentGenreSlug ?? ALL_GENRES} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por género">
        <SelectValue placeholder="Todos los géneros" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_GENRES}>Todos los géneros</SelectItem>
        {genres.map((genre) => (
          <SelectItem key={genre.id} value={genre.slug}>
            {genre.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
