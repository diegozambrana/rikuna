"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X } from "lucide-react"
import { MediaCard } from "@/components/MediaCard"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ListItemWithMedia } from "@/services"

export function SortableListItemCard({
  item,
  onRemove,
  removing,
}: {
  item: ListItemWithMedia
  onRemove: () => void
  removing: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.mediaId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex flex-col gap-1.5", isDragging && "z-10 opacity-60")}
    >
      <MediaCard
        title={item.media.title}
        year={item.media.year}
        posterUrl={item.media.posterUrl}
        imdbRating={item.media.imdbRating}
        isStub={item.media.isStub}
      />
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="cursor-grab touch-none active:cursor-grabbing"
          aria-label="Arrastrar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={removing}
          onClick={onRemove}
        >
          <X /> Quitar
        </Button>
      </div>
    </div>
  )
}
