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

  // imdb_url is only filled in by the TMDB sync, but imdb_id is NOT NULL on
  // every row, so deriving it keeps the link working on titles that haven't
  // been synced yet.
  const imdbUrl = media.imdbUrl ?? `https://www.imdb.com/title/${media.imdbId}/`
  const imdbLink = (
    <a
      href={imdbUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ver ${media.title} en IMDb (se abre en una pestaña nueva)`}
    />
  )

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
              {/* The rating badge doubles as the IMDb link — it's IMDb's own
                  score, so "click it to see the source" is where a reader
                  looks first. Titles with no rating get a plain badge instead,
                  so there's exactly one IMDb affordance either way. */}
              {media.imdbRating !== null ? (
                <Badge
                  variant="secondary"
                  render={imdbLink}
                  className="gap-1 font-mono hover:opacity-80"
                >
                  <Star className="size-3" />
                  {media.imdbRating.toFixed(1)}
                </Badge>
              ) : (
                <Badge variant="outline" render={imdbLink} className="gap-1 hover:opacity-80">
                  <Star className="size-3" />
                  IMDb
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
