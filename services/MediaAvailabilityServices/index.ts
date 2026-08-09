import type { SupabaseClient } from "@supabase/supabase-js"
import type { MediaAvailabilityOfferType, Platform } from "@/types"

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
