// Known platform slugs -> platforms row seed data, keyed by the slug segment
// of the external process's "<platform-slug>_<COUNTRY>.json" filename
// convention. ingestion/catalog/resolvePlatform.ts looks a slug up here to
// create the platforms row when it isn't in the table yet.
//
// Keep this in sync with supabase/migrations/20260810120000_seed_platforms.sql,
// which pre-seeds the same slugs so /suscripciones has something to pick from
// on a fresh database (the ingestion path only creates a platform the first
// time a catalog file for it is loaded).
export type PlatformSeed = {
  name: string
  providerIdMovie?: number
  providerIdTv?: number
}

export const KNOWN_PLATFORMS: Record<string, PlatformSeed> = {
  netflix: { name: "Netflix" },
  "amazon-prime-video": { name: "Amazon Prime Video" },
  "disney-plus": { name: "Disney+" },
  "hbo-max": { name: "HBO Max" },
  "apple-tv-plus": { name: "Apple TV+" },
  "paramount-plus": { name: "Paramount+" },
  crunchyroll: { name: "Crunchyroll" },
  mubi: { name: "MUBI" },
  vix: { name: "ViX" },
  "movistar-plus": { name: "Movistar Plus+" },
  filmin: { name: "Filmin" },
  "claro-video": { name: "Claro Video" },
}
