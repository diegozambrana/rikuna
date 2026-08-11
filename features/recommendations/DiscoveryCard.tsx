"use client"

import { useTransition } from "react"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { addToWatchlist, dismissRecommendation } from "@/actions/media-status"
import { MediaCard } from "@/components/MediaCard"
import { Button } from "@/components/ui/button"
import type { MonthlyPick } from "@/services"

export function DiscoveryCard({
  item,
  onAdded,
  onDismissed,
}: {
  item: MonthlyPick
  onAdded: (mediaId: string) => void
  onDismissed: (mediaId: string) => void
}) {
  const [isAdding, startAdding] = useTransition()
  const [isDismissing, startDismissing] = useTransition()
  const pending = isAdding || isDismissing

  function handleAdd() {
    startAdding(async () => {
      try {
        await addToWatchlist(item.id)
        toast.success(`"${item.title}" se agregó a tu lista de seguimiento.`)
        onAdded(item.id)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo agregar a tu lista de seguimiento."
        )
      }
    })
  }

  function handleDismiss() {
    startDismissing(async () => {
      try {
        await dismissRecommendation(item.id)
        toast.success(`"${item.title}" ya no aparecerá en descubrimiento.`)
        onDismissed(item.id)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo descartar el título.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <MediaCard
        href={`/titulo/${item.slug}`}
        title={item.title}
        year={item.year}
        posterUrl={item.posterUrl}
        imdbRating={item.imdbRating}
        isStub={item.isStub}
      />
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={handleAdd}
        >
          <Plus />
          Agregar a watchlist
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          disabled={pending}
          onClick={handleDismiss}
          aria-label="No me interesa"
          title="No me interesa"
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
