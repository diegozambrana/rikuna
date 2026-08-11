import { COUNTRIES } from "@/constants/countries"
import type { AvailabilityWithPlatform } from "@/services"
import type { MediaAvailabilityOfferType, Platform, UserSubscription } from "@/types"

export type WhereToWatchEntry = {
  key: string
  platform: Platform
  url: string | null
  country: string
  offerType: MediaAvailabilityOfferType
  isActiveSubscription: boolean
  /** Badge suffix: "Alquiler", "Compra", "AR", "AR · Alquiler"… null when there's nothing to qualify. */
  note: string | null
}

const OFFER_RANK: Record<MediaAvailabilityOfferType, number> = {
  subscription: 0,
  rent: 1,
  buy: 2,
}

const OFFER_LABEL: Partial<Record<MediaAvailabilityOfferType, string>> = {
  rent: "Alquiler",
  buy: "Compra",
}

const COUNTRY_RANK = new Map(COUNTRIES.map((country, position) => [country.code, position]))

/**
 * Collapses the availability rows of one title into a single badge per
 * platform.
 *
 * media_availability is unique on (media_id, platform_id, country,
 * offer_type), so a title on Netflix across the eight supported countries with
 * three offer types is 24 rows — and 24 identical-looking badges if rendered
 * raw. This picks the row that matters most to this viewer and labels the rest
 * of the context into a short note.
 *
 * Rows from other countries are ranked down and tagged, never filtered out:
 * /titulo/[slug] has a public variant with no session and therefore no
 * subscriptions, and a viewer without any declared subscription would
 * otherwise be told "sin disponibilidad confirmada" while the data sits right
 * there.
 */
export function groupAvailability(
  availability: AvailabilityWithPlatform[],
  activeSubscriptions: UserSubscription[]
): WhereToWatchEntry[] {
  const subscribedPairs = new Set(
    activeSubscriptions.map((sub) => `${sub.platformId}|${sub.country}`)
  )
  const subscribedCountries = new Set(activeSubscriptions.map((sub) => sub.country))

  const best = new Map<string, WhereToWatchEntry>()

  for (const row of availability) {
    const isActiveSubscription = subscribedPairs.has(`${row.platform.id}|${row.country}`)
    const entry: WhereToWatchEntry = {
      key: row.id,
      platform: row.platform,
      url: row.url,
      country: row.country,
      offerType: row.offerType,
      isActiveSubscription,
      note: buildNote(row, isActiveSubscription, subscribedCountries),
    }

    const current = best.get(row.platform.id)
    if (!current || compareCandidates(entry, current, subscribedCountries) < 0) {
      best.set(row.platform.id, entry)
    }
  }

  return Array.from(best.values()).sort((a, b) => {
    if (a.isActiveSubscription !== b.isActiveSubscription) return a.isActiveSubscription ? -1 : 1
    if (a.offerType !== b.offerType) return OFFER_RANK[a.offerType] - OFFER_RANK[b.offerType]
    return a.platform.name.localeCompare(b.platform.name)
  })
}

/**
 * Lexicographic preference within one platform: the viewer's own country
 * first, then subscription over rent over buy, then a row that actually
 * carries a link over one that doesn't.
 */
function compareCandidates(
  a: WhereToWatchEntry,
  b: WhereToWatchEntry,
  subscribedCountries: Set<string>
): number {
  const countryDelta =
    countryRank(a, subscribedCountries) - countryRank(b, subscribedCountries)
  if (countryDelta !== 0) return countryDelta

  const offerDelta = OFFER_RANK[a.offerType] - OFFER_RANK[b.offerType]
  if (offerDelta !== 0) return offerDelta

  return Number(a.url === null) - Number(b.url === null)
}

function countryRank(entry: WhereToWatchEntry, subscribedCountries: Set<string>): number {
  if (entry.isActiveSubscription) return 0
  if (subscribedCountries.has(entry.country)) return 1
  // Falls back to the curated market order, which puts BO — the base market —
  // ahead of the rest.
  return 2 + (COUNTRY_RANK.get(entry.country) ?? COUNTRIES.length)
}

function buildNote(
  row: AvailabilityWithPlatform,
  isActiveSubscription: boolean,
  subscribedCountries: Set<string>
): string | null {
  const parts: string[] = []

  // The country only earns space on the badge when it isn't one of the
  // viewer's own — otherwise every badge would carry a redundant "BO".
  if (!isActiveSubscription && !subscribedCountries.has(row.country)) parts.push(row.country)

  const offerLabel = OFFER_LABEL[row.offerType]
  if (offerLabel) parts.push(offerLabel)

  return parts.length > 0 ? parts.join(" · ") : null
}
