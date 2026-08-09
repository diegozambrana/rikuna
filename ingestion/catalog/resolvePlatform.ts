import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { KNOWN_PLATFORMS } from "@/constants/platforms"

// "<platform-slug>_<COUNTRY>.json" — the external process's naming
// convention. The directory portion of filePath is ignored, so fixture
// files may live under dated/versioned subfolders while still resolving to
// the same platform+country (this is also how it'll work in production:
// the external process overwrites the same filename each period).
const FILENAME_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)_([a-zA-Z]{2})\.json$/

export type ResolvedPlatform = {
  platformId: string
  country: string
}

export async function resolvePlatform(
  filePath: string,
  client: SupabaseClient
): Promise<ResolvedPlatform> {
  const basename = path.basename(filePath)
  const match = FILENAME_PATTERN.exec(basename)

  if (!match) {
    throw new Error(
      `Catalog file name "${basename}" does not match the expected "<platform-slug>_<COUNTRY>.json" convention.`
    )
  }

  const [, slug, rawCountry] = match
  const country = rawCountry.toUpperCase()

  const { data: existing, error: selectError } = await client
    .from("platforms")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) {
    return { platformId: (existing as { id: string }).id, country }
  }

  const seed = KNOWN_PLATFORMS[slug]
  if (!seed) {
    throw new Error(
      `Unknown platform slug "${slug}" — add it to constants/platforms.ts before ingesting this file.`
    )
  }

  const { data: created, error: insertError } = await client
    .from("platforms")
    .insert({
      slug,
      name: seed.name,
      provider_id_movie: seed.providerIdMovie ?? null,
      provider_id_tv: seed.providerIdTv ?? null,
    })
    .select("id")
    .single()

  if (insertError) throw insertError
  return { platformId: (created as { id: string }).id, country }
}
