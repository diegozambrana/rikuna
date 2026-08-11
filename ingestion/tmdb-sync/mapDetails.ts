import type {
  TmdbCastMember,
  TmdbCredits,
  TmdbDetails,
  TmdbMovieResponse,
  TmdbTvResponse,
} from "./types"

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500"
const PROFILE_BASE_URL = "https://image.tmdb.org/t/p/w185"

// How many cast members land in media_people. features/title/CastList renders
// a lead-cast strip, not a full credits list, so the tail is noise.
const MAX_CAST = 10

// Certification preference. US first because it's by far the best-populated
// country in TMDB's certification data and PG-13/R read unambiguously; ES is
// the closest fallback for a Spanish-language audience.
const CERTIFICATION_COUNTRIES = ["US", "ES"]

function yearFromDate(date?: string | null): number | null {
  if (!date) return null
  const year = Number(date.slice(0, 4))
  return Number.isInteger(year) && year > 1800 ? year : null
}

function imageUrl(base: string, path?: string | null): string | null {
  return path ? `${base}${path}` : null
}

function mapCast(credits?: TmdbCredits): TmdbCastMember[] {
  return (credits?.cast ?? [])
    .filter((member) => Boolean(member.name?.trim()))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .slice(0, MAX_CAST)
    .map((member, index) => ({
      tmdbPersonId: member.id,
      name: member.name!.trim(),
      characterName: member.character?.trim() || null,
      profilePath: imageUrl(PROFILE_BASE_URL, member.profile_path),
      order: member.order ?? index,
    }))
}

function mapGenres(genres?: { name?: string }[]): string[] {
  return (genres ?? [])
    .map((genre) => genre.name?.trim())
    .filter((name): name is string => Boolean(name))
}

function pickCertification(
  entries: { country?: string; value?: string }[]
): string | null {
  const usable = entries.filter((entry) => Boolean(entry.value?.trim()))

  for (const country of CERTIFICATION_COUNTRIES) {
    const match = usable.find((entry) => entry.country === country)
    if (match) return match.value!.trim()
  }

  return usable[0]?.value?.trim() ?? null
}

export function mapMovieDetails(payload: TmdbMovieResponse): TmdbDetails {
  const certification = pickCertification(
    (payload.release_dates?.results ?? []).map((result) => ({
      country: result.iso_3166_1,
      // A country can list several releases (theatrical, digital, …); the
      // first one carrying a certification is the one TMDB's own UI shows.
      value: result.release_dates?.find((entry) => entry.certification?.trim())?.certification,
    }))
  )

  return {
    id: payload.id,
    kind: "movie",
    title: payload.title?.trim() || null,
    originalTitle: payload.original_title?.trim() || null,
    overview: payload.overview?.trim() || null,
    posterPath: imageUrl(POSTER_BASE_URL, payload.poster_path),
    runtimeMinutes: payload.runtime && payload.runtime > 0 ? payload.runtime : null,
    contentRating: certification,
    year: yearFromDate(payload.release_date),
    endYear: null,
    imdbId: payload.imdb_id?.trim() || null,
    genreNames: mapGenres(payload.genres),
    cast: mapCast(payload.credits),
  }
}

export function mapTvDetails(payload: TmdbTvResponse): TmdbDetails {
  const certification = pickCertification(
    (payload.content_ratings?.results ?? []).map((result) => ({
      country: result.iso_3166_1,
      value: result.rating,
    }))
  )

  // A running series has no end year — only stamp it once TMDB says the show
  // is over, otherwise the ficha would claim a series ended when it hasn't.
  const hasEnded = payload.status === "Ended" || payload.status === "Canceled"

  return {
    id: payload.id,
    kind: "tv",
    title: payload.name?.trim() || null,
    originalTitle: payload.original_name?.trim() || null,
    overview: payload.overview?.trim() || null,
    posterPath: imageUrl(POSTER_BASE_URL, payload.poster_path),
    runtimeMinutes: payload.episode_run_time?.find((minutes) => minutes > 0) ?? null,
    contentRating: certification,
    year: yearFromDate(payload.first_air_date),
    endYear: hasEnded ? yearFromDate(payload.last_air_date) : null,
    imdbId: payload.external_ids?.imdb_id?.trim() || null,
    genreNames: mapGenres(payload.genres),
    cast: mapCast(payload.credits),
  }
}

/**
 * media_items patch built from TMDB details.
 *
 * Deliberately absent: `imdb_rating` / `imdb_votes` (TMDB's vote_average is a
 * different scale from a different audience — overwriting IMDb's numbers with
 * it would silently corrupt the recommendation thresholds in
 * constants/recommendationThresholds.ts), `slug` (unique and part of every
 * public URL) and `updated_at` (the media_items_updated_at trigger owns it).
 *
 * Every optional field collapses to `undefined` rather than null when TMDB has
 * nothing: supabase-js drops undefined keys from the request body, so a title
 * whose runtime/year came from the IMDb CSV keeps it instead of being erased
 * by a thinner TMDB record.
 */
export function toMediaItemPatch(details: TmdbDetails, imdbId: string) {
  return {
    tmdb_id: details.id,
    title: details.title ?? undefined,
    original_title: details.originalTitle ?? undefined,
    description: details.overview ?? undefined,
    poster_url: details.posterPath ?? undefined,
    runtime_minutes: details.runtimeMinutes ?? undefined,
    content_rating: details.contentRating ?? undefined,
    year: details.year ?? undefined,
    end_year: details.endYear ?? undefined,
    imdb_url: `https://www.imdb.com/title/${imdbId}/`,
    is_stub: false,
    enriched_at: new Date().toISOString(),
  }
}
