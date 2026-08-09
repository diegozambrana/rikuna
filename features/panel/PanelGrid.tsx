"use client"

import { useState } from "react"
import { toast } from "sonner"
import { markWatched } from "@/actions/media-status"
import { MediaCard } from "@/components/MediaCard"
import type { ActiveSubscriptionWithPlatform, MonthlyPick } from "@/services"
import { PanelHeader } from "./PanelHeader"

export function PanelGrid({
  subscriptions,
  initialPicks,
}: {
  subscriptions: ActiveSubscriptionWithPlatform[]
  initialPicks: MonthlyPick[]
}) {
  const [picks, setPicks] = useState(initialPicks)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  async function handleMarkWatched(pick: MonthlyPick) {
    setPicks((current) => current.filter((item) => item.id !== pick.id))
    setPendingIds((current) => new Set(current).add(pick.id))

    const result = await markWatched(pick.id)

    setPendingIds((current) => {
      const next = new Set(current)
      next.delete(pick.id)
      return next
    })

    if (!result.success) {
      setPicks((current) =>
        [...current, pick].sort((a, b) => {
          if (a.imdbRating === b.imdbRating) return 0
          if (a.imdbRating === null) return 1
          if (b.imdbRating === null) return -1
          return b.imdbRating - a.imdbRating
        })
      )
      toast.error(result.error ?? "No se pudo marcar el título como visto.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader subscriptions={subscriptions} count={picks.length} />
      {picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tienes títulos de tu lista disponibles en este momento.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {picks.map((pick) => (
            <MediaCard
              key={pick.id}
              title={pick.title}
              year={pick.year}
              posterUrl={pick.posterUrl}
              imdbRating={pick.imdbRating}
              isStub={pick.isStub}
              onMarkWatched={() => handleMarkWatched(pick)}
              markWatchedPending={pendingIds.has(pick.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
