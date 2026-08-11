// Narrow projections of TMDB's watch-provider payloads — only the fields this
// sync reads. Everything optional for the same reason as
// ingestion/tmdb-sync/types.ts: TMDB omits keys rather than sending nulls, and
// a missing key must never crash a batch.

/** One offer inside a flatrate/free/ads/rent/buy bucket. */
export type TmdbWatchProvider = {
  provider_id: number
  provider_name: string
  logo_path?: string | null
  display_priority?: number
}

/**
 * The per-country block. `link` is TMDB's own watch page for the title in that
 * country — one link for the whole country, NOT one per provider. TMDB does
 * not expose per-provider deep links here.
 */
export type TmdbWatchCountry = {
  link?: string
  flatrate?: TmdbWatchProvider[]
  free?: TmdbWatchProvider[]
  ads?: TmdbWatchProvider[]
  rent?: TmdbWatchProvider[]
  buy?: TmdbWatchProvider[]
}

/** GET /movie/{id}/watch/providers | /tv/{id}/watch/providers */
export type TmdbWatchProvidersResponse = {
  id: number
  /** Keyed by ISO-3166-1 alpha-2, so one call covers every country at once. */
  results: Record<string, TmdbWatchCountry>
}

/** GET /watch/providers/movie | /watch/providers/tv */
export type TmdbProviderDirectoryResponse = {
  results?: {
    provider_id: number
    provider_name: string
    logo_path?: string | null
    display_priority?: number
    display_priorities?: Record<string, number>
  }[]
}

/** The keys of TmdbWatchCountry that carry offers. */
export type TmdbOfferBucket = "flatrate" | "free" | "ads" | "rent" | "buy"

// --- JustWatch -------------------------------------------------------------
// TMDB's watch-provider data comes from JustWatch, but TMDB strips the one
// field that matters most here: the per-provider deep link. JustWatch's own
// GraphQL endpoint still carries it as `standardWebURL`, and its `packageId`
// values share TMDB's provider-id namespace (Netflix 8, Paramount+ 531), so
// the platform matching in constants/tmdbProviders.ts works unchanged.

/** JustWatch's monetization buckets. CINEMA exists too and is ignored. */
export type JustWatchMonetizationType =
  | "FLATRATE"
  | "FREE"
  | "ADS"
  | "RENT"
  | "BUY"
  | "CINEMA"

export type JustWatchOffer = {
  monetizationType: JustWatchMonetizationType
  /** The provider's own deep link — the whole reason this path exists. */
  standardWebURL?: string | null
  package?: {
    clearName?: string | null
    packageId?: number | null
  } | null
}

export type JustWatchSearchHit = {
  objectType?: string | null
  content?: {
    title?: string | null
    originalReleaseYear?: number | null
    fullPath?: string | null
    externalIds?: {
      imdbId?: string | null
      tmdbId?: string | null
    } | null
  } | null
}

export type JustWatchSearchResponse = {
  data?: {
    popularTitles?: {
      edges?: { node?: JustWatchSearchHit | null }[] | null
    } | null
  } | null
  errors?: { message: string }[]
}

/** Offers keyed by ISO country code, one alias per country in a single query. */
export type JustWatchOffersResponse = {
  data?: {
    urlV2?: {
      node?: (Record<string, JustWatchOffer[] | null> & { objectId?: number }) | null
    } | null
  } | null
  errors?: { message: string }[]
}
