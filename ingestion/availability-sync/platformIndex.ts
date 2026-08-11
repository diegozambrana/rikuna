import { normalizeProviderName, TMDB_PROVIDER_ALIASES } from "@/constants/tmdbProviders"
import type { Platform } from "@/types"

export type PlatformIndex = {
  /** normalised TMDB provider name -> platforms.id */
  byAlias: Map<string, string>
  /** platforms.id -> Platform, for the summary and the provider-id backfill */
  byId: Map<string, Platform>
}

/**
 * Builds the name -> platform lookup the sync uses to decide whether a TMDB
 * offer belongs to a platform Rikuna actually knows about.
 *
 * Built once per batch, not per title: it's pure in-memory work over the
 * dozen-odd rows of `platforms`, but doing it inside the per-title loop would
 * repeat it twenty times a request for nothing.
 *
 * Entries are added slug first, then the platform's own normalised name, then
 * the alias table — first write wins, so a slug can never be shadowed by an
 * alias someone added carelessly.
 */
export function buildPlatformIndex(platforms: Platform[]): PlatformIndex {
  const byAlias = new Map<string, string>()
  const byId = new Map<string, Platform>()

  for (const platform of platforms) {
    byId.set(platform.id, platform)
    if (!byAlias.has(platform.slug)) byAlias.set(platform.slug, platform.id)
  }

  for (const platform of platforms) {
    const normalised = normalizeProviderName(platform.name)
    if (!byAlias.has(normalised)) byAlias.set(normalised, platform.id)
  }

  const idBySlug = new Map(platforms.map((platform) => [platform.slug, platform.id]))
  for (const [alias, slug] of Object.entries(TMDB_PROVIDER_ALIASES)) {
    const platformId = idBySlug.get(slug)
    // An alias pointing at a slug that isn't in the table is not a problem —
    // the seed list and the alias map evolve independently.
    if (platformId && !byAlias.has(alias)) byAlias.set(alias, platformId)
  }

  return { byAlias, byId }
}

/**
 * Resolves one TMDB provider name to a platforms.id, or null when Rikuna
 * doesn't carry that platform. A null is an outcome, not an error: the offer
 * is skipped (the sync only fills in platforms that already exist) and the
 * caller records the raw name so the run summary can surface it.
 */
export function resolvePlatformId(index: PlatformIndex, providerName: string): string | null {
  return index.byAlias.get(normalizeProviderName(providerName)) ?? null
}
