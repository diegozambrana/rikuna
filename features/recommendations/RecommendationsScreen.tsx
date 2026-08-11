"use client"

import { useState } from "react"
import { MediaCard } from "@/components/MediaCard"
import type { MonthlyPick } from "@/services"
import type { Genre } from "@/types"
import { DiscoveryCard } from "./DiscoveryCard"
import { GenreFilterSelect } from "./GenreFilterSelect"

export function RecommendationsScreen({
  watchlistAvailable,
  discovery: initialDiscovery,
  genres,
  currentGenreSlug,
}: {
  watchlistAvailable: MonthlyPick[]
  discovery: MonthlyPick[]
  genres: Genre[]
  currentGenreSlug?: string
}) {
  const [discovery, setDiscovery] = useState(initialDiscovery)
  // Mirrors initialDiscovery so a prop change (a new genre filter re-fetched
  // server-side — this component instance persists across that navigation)
  // can be detected and reset during render, per React's "adjusting state
  // when props change" pattern — avoids the extra render an effect would add.
  const [syncedDiscovery, setSyncedDiscovery] = useState(initialDiscovery)

  if (initialDiscovery !== syncedDiscovery) {
    setSyncedDiscovery(initialDiscovery)
    setDiscovery(initialDiscovery)
  }

  function removeFromDiscovery(mediaId: string) {
    setDiscovery((current) => current.filter((item) => item.id !== mediaId))
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium">
          De tu lista de seguimiento, disponibles ahora
        </h2>
        {watchlistAvailable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes títulos de tu lista de seguimiento disponibles en este momento.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {watchlistAvailable.map((item) => (
              <MediaCard
                key={item.id}
                href={`/titulo/${item.slug}`}
                title={item.title}
                year={item.year}
                posterUrl={item.posterUrl}
                imdbRating={item.imdbRating}
                isStub={item.isStub}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-lg font-medium">Descubre algo nuevo</h2>
          <GenreFilterSelect genres={genres} currentGenreSlug={currentGenreSlug} />
        </div>
        {discovery.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay títulos nuevos para recomendarte por ahora.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {discovery.map((item) => (
              <DiscoveryCard
                key={item.id}
                item={item}
                onAdded={removeFromDiscovery}
                onDismissed={removeFromDiscovery}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
