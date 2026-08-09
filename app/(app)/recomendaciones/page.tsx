import { Suspense } from "react"
import { getGenres, getRecommendations } from "@/actions/recommendations"
import { Skeleton } from "@/components/ui/skeleton"
import { RecommendationsScreen } from "@/features/recommendations/RecommendationsScreen"

export default async function RecomendacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ genero?: string }>
}) {
  const { genero } = await searchParams

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-medium">Recomendaciones</h1>
        <p className="text-xs text-muted-foreground">
          Qué ver a continuación, calculado a partir de tu suscripción activa.
        </p>
      </div>
      <Suspense fallback={<RecommendationsSkeleton />}>
        <RecommendationsSection genreSlug={genero} />
      </Suspense>
    </div>
  )
}

async function RecommendationsSection({ genreSlug }: { genreSlug?: string }) {
  const [genres, recommendations] = await Promise.all([
    getGenres(),
    getRecommendations(genreSlug),
  ])

  return (
    <RecommendationsScreen
      watchlistAvailable={recommendations.watchlistAvailable}
      discovery={recommendations.discovery}
      genres={genres}
      currentGenreSlug={genreSlug}
    />
  )
}

function RecommendationsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-64" />
        <RecommendationsGridSkeleton />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-64" />
        <RecommendationsGridSkeleton />
      </div>
    </div>
  )
}

function RecommendationsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-2/3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
