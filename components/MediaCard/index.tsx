import Link from "next/link"
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
  /**
   * Makes the whole card a link to the title (typically `/titulo/<slug>`).
   * Omit to keep the card inert — e.g. inside a drag-and-drop list, where a
   * link would fight the drag gesture.
   */
  href?: string
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
  href,
  onMarkWatched,
  markWatchedPending = false,
  className,
}: MediaCardProps) {
  return (
    <Card
      size="sm"
      className={cn("gap-2", href && "relative transition-colors hover:bg-muted/50", className)}
    >
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
          <p className="line-clamp-2 text-xs font-medium">
            {href ? (
              // The pseudo-element stretches the hit area over the whole card
              // (poster included) while the anchor's text stays the title, so
              // screen readers announce a real link instead of a bare region.
              // Anything interactive inside the card has to sit above it —
              // see the button below.
              <Link href={href} className="after:absolute after:inset-0 hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </p>
          {onMarkWatched && (
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              // z-10 keeps the button clickable above the stretched link, and
              // stacking only works on a positioned element.
              className="relative z-10 shrink-0"
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
