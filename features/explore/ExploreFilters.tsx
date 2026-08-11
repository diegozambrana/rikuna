"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { COUNTRIES } from "@/constants/countries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Genre, MediaType, Platform } from "@/types"

// Sentinel item values — Base UI's Select can't hold an empty-string item
// value, same pattern as features/library/LibraryFilters.tsx.
const ALL_TYPES = "__all_types__"
const ALL_GENRES = "__all_genres__"
const ALL_PLATFORMS = "__all_platforms__"
const ALL_COUNTRIES = "__all_countries__"
const ANY_RATING = "__any_rating__"

const RATING_PRESETS = [
  { value: "6", label: "6+" },
  { value: "7", label: "7+" },
  { value: "8", label: "8+" },
  { value: "9", label: "9+" },
]

// Base UI's Select.Value renders the raw value unless Root is handed this
// value -> label map, which is how a sentinel would otherwise show up in the
// trigger as literal "__all_types__".
const TYPE_ITEMS: Record<string, string> = {
  [ALL_TYPES]: "Todos",
  movie: "Película",
  tv: "Serie",
}

const COUNTRY_ITEMS: Record<string, string> = {
  [ALL_COUNTRIES]: "Cualquiera",
  ...Object.fromEntries(COUNTRIES.map((country) => [country.code, country.name])),
}

const RATING_ITEMS: Record<string, string> = {
  [ANY_RATING]: "Cualquiera",
  ...Object.fromEntries(RATING_PRESETS.map((preset) => [preset.value, preset.label])),
}

export type ExploreFilterValues = {
  type?: MediaType
  genreSlug?: string
  platformSlug?: string
  country?: string
  yearMin?: number
  yearMax?: number
  ratingMin?: number
  query?: string
}

export function ExploreFilters({
  genres,
  platforms,
  current,
}: {
  genres: Genre[]
  platforms: Pick<Platform, "id" | "name" | "slug">[]
  current: ExploreFilterValues
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

    // The country filter only means something alongside a platform, so
    // clearing the platform has to take it with it — otherwise a stale
    // country would sit in the URL doing nothing and reappear on the next
    // platform the user picks.
    if (key === "plataforma" && !value) params.delete("pais")

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const hasFilters = Object.values(current).some((value) => value !== undefined)

  const genreItems: Record<string, string> = {
    [ALL_GENRES]: "Todos los géneros",
    ...Object.fromEntries(genres.map((genre) => [genre.slug, genre.name])),
  }
  const platformItems: Record<string, string> = {
    [ALL_PLATFORMS]: "Todas",
    ...Object.fromEntries(platforms.map((platform) => [platform.slug, platform.name])),
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Tipo</Label>
        <Select
          items={TYPE_ITEMS}
          value={current.type ?? ALL_TYPES}
          onValueChange={(value) =>
            updateParam("tipo", value === ALL_TYPES ? undefined : (value as string))
          }
        >
          <SelectTrigger className="w-full sm:w-32" aria-label="Filtrar por tipo">
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
          items={genreItems}
          value={current.genreSlug ?? ALL_GENRES}
          onValueChange={(value) =>
            updateParam("genero", value === ALL_GENRES ? undefined : (value as string))
          }
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por género">
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
        <Label className="text-xs text-muted-foreground">Plataforma</Label>
        <Select
          items={platformItems}
          value={current.platformSlug ?? ALL_PLATFORMS}
          onValueChange={(value) =>
            updateParam("plataforma", value === ALL_PLATFORMS ? undefined : (value as string))
          }
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por plataforma">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PLATFORMS}>Todas</SelectItem>
            {platforms.map((platform) => (
              <SelectItem key={platform.id} value={platform.slug}>
                {platform.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Disabled rather than hidden: a control that appears and disappears as
          you touch the one beside it is harder to follow than one that's
          visibly waiting on it. */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">País</Label>
        <Select
          items={COUNTRY_ITEMS}
          value={current.country ?? ALL_COUNTRIES}
          disabled={!current.platformSlug}
          onValueChange={(value) =>
            updateParam("pais", value === ALL_COUNTRIES ? undefined : (value as string))
          }
        >
          <SelectTrigger
            className="w-full sm:w-36"
            aria-label="Filtrar por país de disponibilidad"
          >
            <SelectValue placeholder="Cualquiera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COUNTRIES}>Cualquiera</SelectItem>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
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
          defaultValue={current.yearMin ?? ""}
          onBlur={(event) => updateParam("anioDesde", event.target.value || undefined)}
          onKeyDown={(event) => {
            if (event.key === "Enter")
              updateParam("anioDesde", event.currentTarget.value || undefined)
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
          defaultValue={current.yearMax ?? ""}
          onBlur={(event) => updateParam("anioHasta", event.target.value || undefined)}
          onKeyDown={(event) => {
            if (event.key === "Enter")
              updateParam("anioHasta", event.currentTarget.value || undefined)
          }}
          placeholder="2026"
          aria-label="Año hasta"
          className="w-24"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Calificación mínima</Label>
        <Select
          items={RATING_ITEMS}
          value={current.ratingMin ? String(current.ratingMin) : ANY_RATING}
          onValueChange={(value) =>
            updateParam("calificacion", value === ANY_RATING ? undefined : (value as string))
          }
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

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="mb-0.5"
          onClick={() => router.push(pathname)}
        >
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}
