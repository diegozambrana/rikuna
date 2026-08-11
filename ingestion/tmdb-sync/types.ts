// Narrow projections of the TMDB v3 payloads — only the fields this sync
// reads. Everything is optional because TMDB omits keys rather than sending
// nulls, and a missing key must never crash a batch.

export type TmdbMediaKind = "movie" | "tv"

export type TmdbFindMatch = {
  tmdbId: number
  kind: TmdbMediaKind
}

export type TmdbCastMember = {
  tmdbPersonId: number
  name: string
  characterName: string | null
  profilePath: string | null
  order: number
}

export type TmdbDetails = {
  id: number
  kind: TmdbMediaKind
  title: string | null
  originalTitle: string | null
  overview: string | null
  posterPath: string | null
  runtimeMinutes: number | null
  contentRating: string | null
  year: number | null
  endYear: number | null
  imdbId: string | null
  genreNames: string[]
  cast: TmdbCastMember[]
}

// --- Raw response shapes (only what's read) -------------------------------

export type TmdbFindResponse = {
  movie_results?: { id: number }[]
  tv_results?: { id: number }[]
}

export type TmdbGenre = { id: number; name?: string }

export type TmdbCredits = {
  cast?: {
    id: number
    name?: string
    character?: string
    profile_path?: string | null
    order?: number
  }[]
}

export type TmdbMovieResponse = {
  id: number
  title?: string
  original_title?: string
  overview?: string
  poster_path?: string | null
  runtime?: number | null
  release_date?: string
  imdb_id?: string | null
  genres?: TmdbGenre[]
  credits?: TmdbCredits
  release_dates?: {
    results?: {
      iso_3166_1?: string
      release_dates?: { certification?: string }[]
    }[]
  }
}

export type TmdbTvResponse = {
  id: number
  name?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  episode_run_time?: number[]
  first_air_date?: string
  last_air_date?: string
  status?: string
  genres?: TmdbGenre[]
  credits?: TmdbCredits
  external_ids?: { imdb_id?: string | null }
  content_ratings?: {
    results?: { iso_3166_1?: string; rating?: string }[]
  }
}
