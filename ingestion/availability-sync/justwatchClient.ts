import { COUNTRIES } from "@/constants/countries"
import type {
  JustWatchOffer,
  JustWatchOffersResponse,
  JustWatchSearchResponse,
} from "./types"

const JUSTWATCH_ENDPOINT = "https://apis.justwatch.com/graphql"

// The country the search runs in. Only affects which localised title and
// fullPath come back — the offers query asks for every country explicitly.
const SEARCH_COUNTRY = "BO"
const SEARCH_LANGUAGE = "es"
const SEARCH_RESULTS = 8

const COUNTRY_CODES = COUNTRIES.map((country) => country.code)

/**
 * Thrown for a transport or GraphQL-level failure, so a caller can mark the
 * title 'failed' and retry later. A title JustWatch simply doesn't carry is
 * not this — that's a null return.
 */
export class JustWatchRequestError extends Error {}

/**
 * Set JUSTWATCH_ENABLED=false to fall back to TMDB links everywhere.
 *
 * This endpoint is undocumented and unversioned — introspection is disabled
 * and JustWatch sells a commercial API for the same data — so it can change
 * shape without notice. The kill switch means that degrades the links instead
 * of breaking the sync.
 */
export function isJustWatchEnabled(): boolean {
  return process.env.JUSTWATCH_ENABLED !== "false"
}

export type JustWatchMatch = {
  fullPath: string
  imdbId: string
}

async function justWatchPost<T>(body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(JUSTWATCH_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
  } catch (error) {
    throw new JustWatchRequestError(
      `JustWatch request failed: ${error instanceof Error ? error.message : "network error"}`
    )
  }

  if (!response.ok) {
    throw new JustWatchRequestError(`JustWatch responded ${response.status}`)
  }

  return (await response.json()) as T
}

const SEARCH_QUERY = `
query RikunaSearch($country: Country!, $language: Language!, $filter: TitleFilter!, $first: Int!) {
  popularTitles(country: $country, filter: $filter, first: $first) {
    edges {
      node {
        ... on MovieOrShow {
          objectType
          content(country: $country, language: $language) {
            title
            originalReleaseYear
            fullPath
            externalIds { imdbId tmdbId }
          }
        }
      }
    }
  }
}`

/**
 * Finds a title on JustWatch and returns its path, matched strictly by IMDb
 * id.
 *
 * The strictness is the point: a fuzzy title match would happily hand back the
 * remake, and a wrong match here doesn't produce a missing link — it produces a
 * confident link to the wrong film. No imdbId match means null, and the caller
 * falls back to TMDB.
 */
export async function findJustWatchTitle(
  title: string,
  imdbId: string
): Promise<JustWatchMatch | null> {
  const payload = await justWatchPost<JustWatchSearchResponse>({
    query: SEARCH_QUERY,
    variables: {
      country: SEARCH_COUNTRY,
      language: SEARCH_LANGUAGE,
      filter: { searchQuery: title },
      first: SEARCH_RESULTS,
    },
  })

  if (payload.errors?.length) {
    throw new JustWatchRequestError(`JustWatch search: ${payload.errors[0].message}`)
  }

  for (const edge of payload.data?.popularTitles?.edges ?? []) {
    const content = edge?.node?.content
    const fullPath = content?.fullPath
    const hitImdbId = content?.externalIds?.imdbId

    if (fullPath && hitImdbId && hitImdbId === imdbId) {
      return { fullPath, imdbId: hitImdbId }
    }
  }

  return null
}

// One aliased offers field per country, so all eight markets cost a single
// request instead of eight. Built once at module load — the country list is a
// constant.
const OFFERS_QUERY = `
query RikunaOffers($fullPath: String!) {
  urlV2(fullPath: $fullPath) {
    node {
      ... on MovieOrShow {
        objectId
${COUNTRY_CODES.map(
  (code) => `        ${code}: offers(country: ${code}, platform: WEB) {
          monetizationType
          standardWebURL
          package { clearName packageId }
        }`
).join("\n")}
      }
    }
  }
}`

/** Every offer JustWatch knows about for one title, keyed by country code. */
export async function getJustWatchOffers(
  fullPath: string
): Promise<Record<string, JustWatchOffer[]>> {
  const payload = await justWatchPost<JustWatchOffersResponse>({
    query: OFFERS_QUERY,
    variables: { fullPath },
  })

  if (payload.errors?.length) {
    throw new JustWatchRequestError(`JustWatch offers: ${payload.errors[0].message}`)
  }

  const node = payload.data?.urlV2?.node
  if (!node) return {}

  const byCountry: Record<string, JustWatchOffer[]> = {}
  for (const code of COUNTRY_CODES) {
    const offers = node[code]
    if (Array.isArray(offers) && offers.length > 0) byCountry[code] = offers
  }

  return byCountry
}

/**
 * JustWatch returns HTML-escaped URLs (`?a=1&amp;b=2`), which would break the
 * query string if written straight into an href.
 *
 * The affiliate/tracking parameters they append are left alone on purpose:
 * some of them are load-bearing (Apple's `playableId` selects the actual
 * stream), and telling them apart from pure tracking reliably enough to strip
 * one and not the other isn't worth a broken deep link.
 */
export function decodeJustWatchUrl(url: string): string {
  return url
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
}
