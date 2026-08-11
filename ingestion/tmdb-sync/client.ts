import type {
  TmdbProviderDirectoryResponse,
  TmdbWatchProvidersResponse,
} from "@/ingestion/availability-sync/types"
import type {
  TmdbFindMatch,
  TmdbFindResponse,
  TmdbMovieResponse,
  TmdbTvResponse,
} from "./types"

const TMDB_BASE_URL = "https://api.themoviedb.org/3"

// TMDB's v4 read access token is a Bearer JWT; the older v3 key goes in the
// query string. Both are accepted by the v3 endpoints this module uses, so
// whichever the deployment has configured works.
const ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN
const API_KEY = process.env.TMDB_API_KEY

/** Spanish first — the whole app's copy is Spanish. */
export const PRIMARY_LANGUAGE = "es-ES"
/** Fallback for the ~30% of titles with no Spanish overview in TMDB. */
export const FALLBACK_LANGUAGE = "en-US"

export class TmdbConfigError extends Error {}

/** Thrown for a non-2xx TMDB response other than 404, so callers can retry later. */
export class TmdbRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

function assertConfigured(): void {
  if (!ACCESS_TOKEN && !API_KEY) {
    throw new TmdbConfigError(
      "Missing TMDB credentials — set TMDB_ACCESS_TOKEN (preferred) or TMDB_API_KEY in .env.local."
    )
  }
}

/**
 * One TMDB GET. Returns null on 404 (the "TMDB doesn't know this title" case,
 * which is an outcome and not an error); throws TmdbRequestError on anything
 * else non-2xx so the caller can mark the row 'failed' and retry on a later run.
 */
async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  assertConfigured()

  const url = new URL(`${TMDB_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  if (!ACCESS_TOKEN && API_KEY) {
    url.searchParams.set("api_key", API_KEY)
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(ACCESS_TOKEN ? { authorization: `Bearer ${ACCESS_TOKEN}` } : {}),
    },
    // Catalog data changes rarely and this runs server-side on demand — Next's
    // fetch cache would only hide fresh TMDB edits behind a stale response.
    cache: "no-store",
  })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new TmdbRequestError(`TMDB ${path} responded ${response.status}`, response.status)
  }

  return (await response.json()) as T
}

/**
 * Resolves an IMDb tconst to a TMDB id. Prefers movie_results over tv_results
 * — an id only ever appears in one of them, and checking movies first matches
 * constants/imdbTitleTypeMap.ts's own fail-open bias toward "movie".
 */
export async function findByImdbId(imdbId: string): Promise<TmdbFindMatch | null> {
  const found = await tmdbGet<TmdbFindResponse>(`/find/${encodeURIComponent(imdbId)}`, {
    external_source: "imdb_id",
  })
  if (!found) return null

  const movie = found.movie_results?.[0]
  if (movie) return { tmdbId: movie.id, kind: "movie" }

  const tv = found.tv_results?.[0]
  if (tv) return { tmdbId: tv.id, kind: "tv" }

  return null
}

export async function getMovieDetails(
  tmdbId: number,
  language: string = PRIMARY_LANGUAGE
): Promise<TmdbMovieResponse | null> {
  return tmdbGet<TmdbMovieResponse>(`/movie/${tmdbId}`, {
    language,
    append_to_response: "credits,release_dates",
  })
}

export async function getTvDetails(
  tmdbId: number,
  language: string = PRIMARY_LANGUAGE
): Promise<TmdbTvResponse | null> {
  return tmdbGet<TmdbTvResponse>(`/tv/${tmdbId}`, {
    language,
    append_to_response: "credits,content_ratings,external_ids",
  })
}

/**
 * Second pass for a title with no Spanish overview: asks for en-US and returns
 * just that field. Costs one extra request only for the titles that need it.
 */
export async function getOverviewFallback(
  tmdbId: number,
  kind: "movie" | "tv"
): Promise<string | null> {
  const details =
    kind === "movie"
      ? await tmdbGet<TmdbMovieResponse>(`/movie/${tmdbId}`, { language: FALLBACK_LANGUAGE })
      : await tmdbGet<TmdbTvResponse>(`/tv/${tmdbId}`, { language: FALLBACK_LANGUAGE })

  return details?.overview?.trim() || null
}

/**
 * Where a title can be watched — every country in a single call, since
 * `results` is keyed by ISO-3166-1 alpha-2. That's what makes syncing all of
 * constants/countries.ts cost one request per title instead of eight.
 *
 * No `language` param: the values this reads are brand names, which TMDB
 * returns identically whatever locale you ask for, and the platform matching
 * downstream normalises them anyway.
 *
 * Lives here rather than in a second client module so it inherits
 * assertConfigured(), the shared credentials and the "404 -> null, other
 * non-2xx -> throw" contract — a separate module would also break
 * `instanceof TmdbConfigError` across the two.
 */
export async function getWatchProviders(
  tmdbId: number,
  kind: "movie" | "tv"
): Promise<TmdbWatchProvidersResponse | null> {
  return tmdbGet<TmdbWatchProvidersResponse>(`/${kind}/${tmdbId}/watch/providers`)
}

/**
 * TMDB's full provider directory for a media kind. Asked WITHOUT
 * `watch_region` on purpose: the global catalog is a superset of Rikuna's
 * eight markets, so this is two requests total instead of sixteen.
 *
 * Only the platforms.provider_id_movie/provider_id_tv backfill needs this —
 * the availability sync itself matches on normalised names.
 */
export async function getProviderDirectory(
  kind: "movie" | "tv"
): Promise<TmdbProviderDirectoryResponse | null> {
  return tmdbGet<TmdbProviderDirectoryResponse>(`/watch/providers/${kind}`)
}
