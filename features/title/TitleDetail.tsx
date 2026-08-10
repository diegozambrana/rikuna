import Link from "next/link"
import { Film, Star } from "lucide-react"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Badge } from "@/components/ui/badge"
import type { TitleDetailDTO } from "@/actions/media"
import { CastList } from "./CastList"
import { StubNotice } from "./StubNotice"
import { TitleActions } from "./TitleActions"
import { WhereToWatch } from "./WhereToWatch"

const votesFormatter = new Intl.NumberFormat("es-ES")

export function TitleDetail({ slug, detail }: { slug: string; detail: TitleDetailDTO }) {
  const { media, genres, cast, availability, personalStatus, activeSubscriptions, isPublicView } = detail

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      {!isPublicView && (
        <Link href="/panel" className="text-xs text-muted-foreground hover:text-foreground">
          ← Volver al panel
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[240px_1fr]">
        <div className="mx-auto w-full max-w-60 sm:mx-0">
          <AspectRatio ratio={2 / 3} className="bg-muted">
            {!media.isStub && media.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized poster URLs from the catalog process
              <img src={media.posterUrl} alt={media.title} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <Film className="size-10" />
              </div>
            )}
          </AspectRatio>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading text-2xl font-medium">{media.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {media.year && <span>{media.year}</span>}
              {media.imdbRating !== null && (
                <Badge variant="secondary" className="gap-1 font-mono">
                  <Star className="size-3" />
                  {media.imdbRating.toFixed(1)}
                </Badge>
              )}
              {media.imdbVotes !== null && <span>{votesFormatter.format(media.imdbVotes)} votos</span>}
              {personalStatus?.personalRating != null && (
                <Badge variant="outline" className="font-mono">
                  Tu calificación: {personalStatus.personalRating}
                </Badge>
              )}
            </div>
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {genres.map((genre) => (
                  <Badge key={genre.id} variant="outline">
                    {genre.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {media.isStub && <StubNotice />}

          {media.description && (
            <p className="text-sm text-muted-foreground">{media.description}</p>
          )}

          <TitleActions
            mediaId={media.id}
            slug={slug}
            watched={personalStatus?.watched ?? false}
            wantToWatch={personalStatus?.wantToWatch ?? false}
            isPublicView={isPublicView}
          />
        </div>
      </div>

      <CastList cast={cast} />

      <WhereToWatch availability={availability} activeSubscriptions={activeSubscriptions} />
    </div>
  )
}
