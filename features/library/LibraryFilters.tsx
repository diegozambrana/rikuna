"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Genre, MediaType } from "@/types"

// Sentinel item values — Base UI's Select can't hold an empty-string item
// value, same pattern as features/recommendations/GenreFilterSelect.tsx.
const ALL_TYPES = "__all_types__"
const ALL_GENRES = "__all_genres__"
const ANY_RATING = "__any_rating__"

const RATING_PRESETS = [
  { value: "7", label: "7+" },
  { value: "8", label: "8+" },
  { value: "9", label: "9+" },
]

export function LibraryFilters({
  genres,
  currentType,
  currentGenreSlug,
  currentYearMin,
  currentYearMax,
  currentRatingMin,
  currentOnlyAvailable,
}: {
  genres: Genre[]
  currentType?: MediaType
  currentGenreSlug?: string
  currentYearMin?: number
  currentYearMax?: number
  currentRatingMin?: number
  currentOnlyAvailable?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())

    if (!value) {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Tipo</Label>
        <Select
          value={currentType ?? ALL_TYPES}
          onValueChange={(value) => updateParam("tipo", value === ALL_TYPES ? undefined : (value as string))}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filtrar por tipo">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>Todos</SelectItem>
            <SelectItem value="movie">Película</SelectItem>
            <SelectItem value="tv">Serie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Género</Label>
        <Select
          value={currentGenreSlug ?? ALL_GENRES}
          onValueChange={(value) => updateParam("genero", value === ALL_GENRES ? undefined : (value as string))}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por género">
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
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Año desde</Label>
        <Input
          type="number"
          inputMode="numeric"
          defaultValue={currentYearMin ?? ""}
          onBlur={(event) => updateParam("anioDesde", event.target.value || undefined)}
          onKeyDown={(event) => {
            if (event.key === "Enter") updateParam("anioDesde", event.currentTarget.value || undefined)
          }}
          placeholder="1990"
          aria-label="Año desde"
          className="w-24"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Año hasta</Label>
        <Input
          type="number"
          inputMode="numeric"
          defaultValue={currentYearMax ?? ""}
          onBlur={(event) => updateParam("anioHasta", event.target.value || undefined)}
          onKeyDown={(event) => {
            if (event.key === "Enter") updateParam("anioHasta", event.currentTarget.value || undefined)
          }}
          placeholder="2026"
          aria-label="Año hasta"
          className="w-24"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Calificación mínima</Label>
        <Select
          value={currentRatingMin ? String(currentRatingMin) : ANY_RATING}
          onValueChange={(value) => updateParam("calificacion", value === ANY_RATING ? undefined : (value as string))}
        >
          <SelectTrigger className="w-full sm:w-32" aria-label="Filtrar por calificación mínima">
            <SelectValue placeholder="Cualquiera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_RATING}>Cualquiera</SelectItem>
            {RATING_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 pb-1.5">
        <Checkbox
          id="only-available"
          checked={currentOnlyAvailable ?? false}
          onCheckedChange={(checked) => updateParam("disponible", checked ? "1" : undefined)}
        />
        <Label htmlFor="only-available" className="text-xs text-muted-foreground">
          Solo disponible en mi suscripción activa
        </Label>
      </div>
    </div>
  )
}
