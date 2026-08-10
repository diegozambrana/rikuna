import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getLibrary } from "@/actions/media"
import type { GetLibraryParams, LibraryTab } from "@/actions/media"
import { getGenres } from "@/actions/recommendations"
import { Skeleton } from "@/components/ui/skeleton"
import { LibraryScreen } from "@/features/library/LibraryScreen"
import type { MediaType } from "@/types"

type BibliotecaSearchParams = {
  tab?: string
  q?: string
  tipo?: string
  genero?: string
  anioDesde?: string
  anioHasta?: string
  calificacion?: string
  disponible?: string
}

const VALID_TABS: LibraryTab[] = ["watched", "want_to_watch", "all"]

function parseTab(value?: string): LibraryTab {
  return (VALID_TABS as string[]).includes(value ?? "") ? (value as LibraryTab) : "watched"
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

export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<BibliotecaSearchParams>
}) {
  const raw = await searchParams

  const params: GetLibraryParams = {
    tab: parseTab(raw.tab),
    query: raw.q?.trim() || undefined,
    type: parseType(raw.tipo),
    genreSlug: raw.genero || undefined,
    yearMin: parseYear(raw.anioDesde),
    yearMax: parseYear(raw.anioHasta),
    ratingMin: parseRating(raw.calificacion),
    onlyAvailable: raw.disponible === "1",
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-medium">Mi biblioteca</h1>
        <p className="text-xs text-muted-foreground">
          Todo tu historial personal: lo que has visto, lo que quieres ver, y lo que aún no
          tocas.
        </p>
      </div>
      <Suspense fallback={<LibrarySkeleton />}>
        <LibrarySection params={params} />
      </Suspense>
    </div>
  )
}

async function LibrarySection({ params }: { params: GetLibraryParams }) {
  const [genres, result] = await Promise.all([getGenres(), getLibrary(params)])

  if (result.status === "unauthorized") {
    // Defensive fallback — /biblioteca is already middleware-protected
    // (lib/supabase/proxy.ts's PROTECTED_PREFIXES), so this only triggers if
    // a session expires between the middleware check and this read.
    redirect("/auth/login")
  }

  return <LibraryScreen rows={result.rows} hasAnyHistory={result.hasAnyHistory} genres={genres} filters={params} />
}

function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}
