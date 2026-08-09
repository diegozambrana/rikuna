"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Bookmark, BookmarkCheck, Check, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { addToWatchlist, markNotWatched, markWatched, removeFromWatchlist } from "@/actions/media-status"
import { Button } from "@/components/ui/button"

export function TitleActions({
  mediaId,
  slug,
  watched,
  wantToWatch,
  isPublicView,
}: {
  mediaId: string
  slug: string
  watched: boolean
  wantToWatch: boolean
  isPublicView: boolean
}) {
  const [isTogglingWatched, startTogglingWatched] = useTransition()
  const [isTogglingWatchlist, startTogglingWatchlist] = useTransition()

  function handleToggleWatched() {
    startTogglingWatched(async () => {
      const result = watched ? await markNotWatched(mediaId, slug) : await markWatched(mediaId, slug)

      if (!result.success) {
        toast.error(result.error ?? "No se pudo actualizar el estado de visto.")
        return
      }
      toast.success(watched ? "Se desmarcó como visto." : "Marcado como visto.")
    })
  }

  function handleToggleWatchlist() {
    startTogglingWatchlist(async () => {
      try {
        if (wantToWatch) {
          await removeFromWatchlist(mediaId, slug)
          toast.success("Se quitó de tu watchlist.")
        } else {
          await addToWatchlist(mediaId, slug)
          toast.success("Se agregó a tu watchlist.")
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar tu watchlist.")
      }
    })
  }

  if (isPublicView) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/auth/login" />} nativeButton={false} variant="outline">
          <Check /> Marcar como visto
        </Button>
        <Button render={<Link href="/auth/login" />} nativeButton={false} variant="outline">
          <Bookmark /> Agregar a watchlist
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant={watched ? "secondary" : "outline"}
        disabled={isTogglingWatched}
        onClick={handleToggleWatched}
      >
        {watched ? <Undo2 /> : <Check />}
        {watched ? "Marcar como no visto" : "Marcar como visto"}
      </Button>
      <Button
        type="button"
        variant={wantToWatch ? "secondary" : "outline"}
        disabled={isTogglingWatchlist}
        onClick={handleToggleWatchlist}
      >
        {wantToWatch ? <BookmarkCheck /> : <Bookmark />}
        {wantToWatch ? "En tu watchlist" : "Agregar a watchlist"}
      </Button>
      {/* TODO(RIK-10): "Agregar a lista" once user_lists/list_items exist */}
    </div>
  )
}
