import { Suspense } from "react"
import { redirect } from "next/navigation"
import { exploreCatalog, type ExploreParams } from "@/actions/media"
import { getGenres } from "@/actions/recommendations"
import { getKnownPlatformsAction } from "@/actions/subscriptions"
import { Skeleton } from "@/components/ui/skeleton"
import { COUNTRIES } from "@/constants/countries"
import { ExploreScreen } from "@/features/explore/ExploreScreen"
import { parseExploreView, type ExploreView } from "@/features/explore/view"
import type { MediaType } from "@/types"

type ExplorarSearchParams = {
  q?: string
  tipo?: string
  genero?: string
  plataforma?: string
  pais?: string
  anioDesde?: string
  anioHasta?: string
  calificacion?: string
  vista?: string
}

function parseType(value?: string): MediaType | undefined {
  return value === "movie" || value === "tv" ? value : undefined
}

function parseYear(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : undefined
}

function parseRating(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseCountry(value?: string): string | undefined {
  return COUNTRIES.some((country) => country.code === value) ? value : undefined
}

export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: Promise<ExplorarSearchParams>
}) {
  const raw = await searchParams

  const params: ExploreParams = {
    query: raw.q?.trim() || undefined,
    type: parseType(raw.tipo),
    genreSlug: raw.genero || undefined,
    platformSlug: raw.plataforma || undefined,
    // Dropped without a platform: on its own it would filter nothing, and
    // keeping it would make the disabled country picker look meaningful.
    country: raw.plataforma ? parseCountry(raw.pais) : undefined,
    yearMin: parseYear(raw.anioDesde),
    yearMax: parseYear(raw.anioHasta),
    ratingMin: parseRating(raw.calificacion),
  }

  const view = parseExploreView(raw.vista)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-medium">Explorar</h1>
        <p className="text-xs text-muted-foreground">
          Todo el catálogo de Rikuna. Filtra por tipo, género, plataforma, país, año y
          calificación.
        </p>
      </div>
      {/* Keyed on the filters so a new query swaps in the skeleton instead of
          leaving the previous results on screen while the server catches up.
          `view` is left out of the key on purpose: switching layout re-renders
          the same data and shouldn't flash a skeleton. */}
      <Suspense key={JSON.stringify(params)} fallback={<ExploreSkeleton />}>
        <ExploreSection params={params} view={view} />
      </Suspense>
    </div>
  )
}

async function ExploreSection({ params, view }: { params: ExploreParams; view: ExploreView }) {
  const [genres, platforms, result] = await Promise.all([
    getGenres(),
    getKnownPlatformsAction(),
    exploreCatalog(params),
  ])

  if (result.status === "unauthorized") {
    // Defensive fallback — /explorar is middleware-protected
    // (lib/supabase/proxy.ts's PROTECTED_PREFIXES), so this only triggers if a
    // session expires between the middleware check and this read.
    redirect("/auth/login")
  }

  return (
    <ExploreScreen
      items={result.items}
      total={result.total}
      truncated={result.truncated}
      limit={result.limit}
      genres={genres}
      platforms={platforms}
      filters={params}
      view={view}
    />
  )
}

function ExploreSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}
