import type { SupabaseClient } from "@supabase/supabase-js"
import type { MediaAvailabilityOfferType, Platform } from "@/types"

// Same chunking/pagination constants as RecommendationServices — mirrored
// locally since those helpers are private to that class (RIK-14 constraint:
// reimplement the logic, don't reach into its internals).
//
// ID_CHUNK_SIZE is 100, not 200: getAvailableMediaIds appends an `.or(...)`
// clause per active subscription on top of the `.in("media_id", ...)` list,
// and at 200 UUIDs the percent-encoded request line crossed Kong's 8 KB
// limit — Kong answered 414 "URI too long" and supabase-js surfaced it as a
// bare {message} object. See RecommendationServices for the full note.
const PAGE_SIZE = 1000
const ID_CHUNK_SIZE = 100

async function paginate<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export type ActiveSubscriptionPair = { platformId: string; country: string }

export type UpsertAvailabilityInput = {
  mediaId: string
  platformId: string
  country: string
  url: string | null
  // Omitted on purpose when the raw file doesn't provide one — the column's
  // own `default 'subscription'` applies instead of forcing every ingested
  // item through this field.
  offerType?: MediaAvailabilityOfferType
  lastSeenAt: string
  snapshotId: string
}

export type ExpireStaleInput = {
  platformId: string
  country: string
  snapshotId: string
}

// Ficha read (RIK-9) — one available row plus its platform, so
// features/title/WhereToWatch can render name/link without a second query.
export type AvailabilityWithPlatform = {
  id: string
  mediaId: string
  country: string
  url: string | null
  offerType: MediaAvailabilityOfferType
  platform: Platform
}

type AvailabilityRow = {
  id: string
  media_id: string
  country: string
  url: string | null
  offer_type: MediaAvailabilityOfferType
  platforms: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    provider_id_movie: number | null
    provider_id_tv: number | null
  } | null
}

export class MediaAvailabilityServices {
  constructor(private readonly client: SupabaseClient) {}

  /** Ficha "Dónde ver" read — is_available=true rows for one title, joined to their platform. */
  async getAvailableForMedia(mediaId: string): Promise<AvailabilityWithPlatform[]> {
    const { data, error } = await this.client
      .from("media_availability")
      .select("id, media_id, country, url, offer_type, platforms(id, name, slug, logo_url, provider_id_movie, provider_id_tv)")
      .eq("media_id", mediaId)
      .eq("is_available", true)

    if (error) throw error

    return (data as unknown as AvailabilityRow[])
      .filter((row) => row.platforms !== null)
      .map((row) => ({
        id: row.id,
        mediaId: row.media_id,
        country: row.country,
        url: row.url,
        offerType: row.offer_type,
        platform: {
          id: row.platforms!.id,
          name: row.platforms!.name,
          slug: row.platforms!.slug,
          logoUrl: row.platforms!.logo_url,
          providerIdMovie: row.platforms!.provider_id_movie,
          providerIdTv: row.platforms!.provider_id_tv,
        },
      }))
  }

  /**
   * Biblioteca "solo disponible en mi suscripción activa" filter (RIK-14).
   * Byte-identical matching semantics to RecommendationServices' private
   * getAvailableMediaIds/getAvailableMediaIdsForPairs (is_available=true,
   * OR-matched across the active pairs' platform_id+country) — promoted here
   * as a public method per ARCHITECTURE.md's Services table instead of
   * reaching into that class's private methods or duplicating the class.
   */
  async getAvailableMediaIds(mediaIds: string[], activePairs: ActiveSubscriptionPair[]): Promise<string[]> {
    if (mediaIds.length === 0 || activePairs.length === 0) return []

    const pairFilter = activePairs
      .map((pair) => `and(platform_id.eq.${pair.platformId},country.eq.${pair.country})`)
      .join(",")

    const available = new Set<string>()

    for (const idChunk of chunk(mediaIds, ID_CHUNK_SIZE)) {
      const rows = await paginate<{ media_id: string }>((from, to) =>
        this.client
          .from("media_availability")
          .select("media_id")
          .in("media_id", idChunk)
          .eq("is_available", true)
          .or(pairFilter)
          .range(from, to)
      )

      for (const row of rows) available.add(row.media_id)
    }

    return Array.from(available)
  }

  /** Upsert against media_availability_uq (media_id, platform_id, country, offer_type). */
  async upsert(input: UpsertAvailabilityInput): Promise<void> {
    const { error } = await this.client.from("media_availability").upsert(
      {
        media_id: input.mediaId,
        platform_id: input.platformId,
        country: input.country,
        url: input.url,
        is_available: true,
        last_seen_at: input.lastSeenAt,
        last_snapshot_id: input.snapshotId,
        ...(input.offerType ? { offer_type: input.offerType } : {}),
      },
      { onConflict: "media_id,platform_id,country,offer_type" }
    )

    if (error) throw error
  }

  /**
   * Schema doc Section 3.3 step 3: flips is_available=false for anything in
   * this platform+country whose last_snapshot_id is NOT this run's snapshot
   * (including rows where it's null) — preserving the row instead of
   * deleting it. `.neq()` alone would silently exclude null rows, so the
   * null case is handled explicitly via `.or()` to match SQL's
   * "is distinct from" semantics.
   */
  async expireStale(input: ExpireStaleInput): Promise<number> {
    const { data, error } = await this.client
      .from("media_availability")
      .update({ is_available: false })
      .eq("platform_id", input.platformId)
      .eq("country", input.country)
      .eq("is_available", true)
      .or(`last_snapshot_id.is.null,last_snapshot_id.neq.${input.snapshotId}`)
      .select("id")

    if (error) throw error
    return data?.length ?? 0
  }
}
