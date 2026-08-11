import { COUNTRIES } from "@/constants/countries"
import type { TmdbAvailabilityRow } from "@/services"
import type { MediaAvailabilityOfferType } from "@/types"
import { decodeJustWatchUrl } from "./justwatchClient"
import { resolvePlatformId, type PlatformIndex } from "./platformIndex"
import type {
  JustWatchMonetizationType,
  JustWatchOffer,
  TmdbOfferBucket,
  TmdbWatchProvidersResponse,
} from "./types"

const SUPPORTED_COUNTRIES = new Set(COUNTRIES.map((country) => country.code))

/**
 * flatrate/free/ads are all "watch it at no extra cost" as far as Rikuna's
 * subscription model is concerned; rent and buy keep their own offer_type so
 * the ficha can label them.
 */
const OFFER_TYPE_BY_BUCKET: Record<TmdbOfferBucket, MediaAvailabilityOfferType> = {
  flatrate: "subscription",
  free: "subscription",
  ads: "subscription",
  rent: "rent",
  buy: "buy",
}

const BUCKETS = Object.keys(OFFER_TYPE_BY_BUCKET) as TmdbOfferBucket[]

export type MapProvidersResult = {
  rows: TmdbAvailabilityRow[]
  /** Raw provider_names with no matching platform, deduplicated. */
  unmatched: string[]
}

/**
 * Turns one watch-providers response into the rows reconcileForMedia expects.
 * Pure — no I/O, no clock — so it can be reasoned about against a captured
 * payload.
 *
 * The Map keyed on (platform, country, offerType) is load-bearing, not
 * defensive: three of the five buckets collapse onto 'subscription' and TMDB
 * happily lists the same provider under flatrate and ads, which would put two
 * rows with the same conflict key into one upsert and make Postgres raise
 * "cannot affect row a second time" — failing the whole batch, not just the
 * title. First bucket wins, which makes the output deterministic.
 */
export function mapProviders(
  response: TmdbWatchProvidersResponse,
  index: PlatformIndex
): MapProvidersResult {
  const rows = new Map<string, TmdbAvailabilityRow>()
  const unmatched = new Set<string>()

  for (const [country, offers] of Object.entries(response.results ?? {})) {
    if (!SUPPORTED_COUNTRIES.has(country)) continue

    // One link per country, not per provider — TMDB doesn't expose
    // per-provider deep links on this endpoint, so every offer in this
    // country shares its watch page.
    const url = offers.link ?? null

    for (const bucket of BUCKETS) {
      for (const provider of offers[bucket] ?? []) {
        const platformId = resolvePlatformId(index, provider.provider_name)
        if (!platformId) {
          unmatched.add(provider.provider_name)
          continue
        }

        const offerType = OFFER_TYPE_BY_BUCKET[bucket]
        const key = `${platformId}|${country}|${offerType}`
        if (!rows.has(key)) rows.set(key, { platformId, country, offerType, url })
      }
    }
  }

  return { rows: Array.from(rows.values()), unmatched: Array.from(unmatched) }
}

/**
 * Same as mapProviders, but over JustWatch offers — which carry the provider's
 * own deep link instead of a link back to an aggregator page.
 *
 * Platform matching reuses the same index: JustWatch's `clearName` normalises
 * to the same slugs ("Paramount Plus" -> paramount-plus) and its `packageId`
 * shares TMDB's provider-id namespace, because TMDB licenses this very data.
 *
 * Dedup matters even more here than on the TMDB side: JustWatch returns one
 * offer per presentation (SD, HD, 4K), so the same provider shows up three or
 * four times for a single monetization type. First wins, which keeps the
 * output stable across runs.
 */
export function mapJustWatchOffers(
  offersByCountry: Record<string, JustWatchOffer[]>,
  index: PlatformIndex
): MapProvidersResult {
  const rows = new Map<string, TmdbAvailabilityRow>()
  const unmatched = new Set<string>()

  for (const [country, offers] of Object.entries(offersByCountry)) {
    if (!SUPPORTED_COUNTRIES.has(country)) continue

    for (const offer of offers) {
      const offerType = OFFER_TYPE_BY_MONETIZATION[offer.monetizationType]
      // CINEMA and anything new they add: not something you can stream.
      if (!offerType) continue

      const providerName = offer.package?.clearName
      if (!providerName) continue

      const platformId = resolvePlatformId(index, providerName)
      if (!platformId) {
        unmatched.add(providerName)
        continue
      }

      const key = `${platformId}|${country}|${offerType}`
      if (rows.has(key)) continue

      const url = offer.standardWebURL ? decodeJustWatchUrl(offer.standardWebURL) : null
      rows.set(key, { platformId, country, offerType, url })
    }
  }

  return { rows: Array.from(rows.values()), unmatched: Array.from(unmatched) }
}

const OFFER_TYPE_BY_MONETIZATION: Partial<
  Record<JustWatchMonetizationType, MediaAvailabilityOfferType>
> = {
  FLATRATE: "subscription",
  FREE: "subscription",
  ADS: "subscription",
  RENT: "rent",
  BUY: "buy",
}
