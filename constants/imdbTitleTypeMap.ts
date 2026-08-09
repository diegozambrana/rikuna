import type { MediaType } from "@/types"

// Raw IMDb "Title Type" CSV values -> this app's own type. IMDb's own export
// vocabulary is wider than this map (podcast episodes, video games, etc.);
// anything not listed here defaults to "movie" (fail open) rather than
// aborting the row, since a wrong type is cosmetic and recoverable while a
// dropped row loses the user's rating/watchlist data.
const IMDB_TITLE_TYPE_MAP: Record<string, MediaType> = {
  movie: "movie",
  tvMovie: "movie",
  short: "movie",
  tvSeries: "tv",
  tvMiniSeries: "tv",
}

export function mapImdbTitleType(rawTitleType: string): MediaType {
  return IMDB_TITLE_TYPE_MAP[rawTitleType] ?? "movie"
}
