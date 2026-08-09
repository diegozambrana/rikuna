import { Check, Film } from "lucide-react"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// Shared across panel, recommendations, biblioteca, lists, and the public
// list view — keep props generic (no panel-specific fields, no server-action
// imports here) so every consumer can compose it with its own actions.
export type MediaCardProps = {
  title: string
  year: number | null
  posterUrl: string | null
  imdbRating: number | null
  isStub: boolean
  /** Renders an inline "mark watched" button when provided; omit for read-only contexts (e.g. public list view). */
  onMarkWatched?: () => void
  markWatchedPending?: boolean
  className?: string
}

export function MediaCard({
  title,
  year,
  posterUrl,
  imdbRating,
  isStub,
  onMarkWatched,
  markWatchedPending = false,
  className,
}: MediaCardProps) {
  return (
    <Card size="sm" className={cn("gap-2", className)}>
      <AspectRatio ratio={2 / 3} className="bg-muted">
        {!isStub && posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized poster URLs from the catalog process
          <img src={posterUrl} alt={title} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Film className="size-8" />
          </div>
        )}
      </AspectRatio>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-xs font-medium">{title}</p>
          {onMarkWatched && (
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              className="shrink-0"
              disabled={markWatchedPending}
              onClick={onMarkWatched}
              aria-label="Marcar como visto"
            >
              <Check />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {year && <span>{year}</span>}
          {imdbRating !== null && (
            <Badge variant="secondary" className="font-mono">
              {imdbRating.toFixed(1)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
