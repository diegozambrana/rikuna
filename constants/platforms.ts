// Known platform slugs -> platforms row seed data, keyed by the slug segment
// of the external process's "<platform-slug>_<COUNTRY>.json" filename
// convention. ingestion/catalog/resolvePlatform.ts looks a slug up here to
// create the platforms row on a brand-new platform's first file — the table
// itself is not pre-seeded by any migration.
export type PlatformSeed = {
  name: string
  providerIdMovie?: number
  providerIdTv?: number
}

export const KNOWN_PLATFORMS: Record<string, PlatformSeed> = {
  "apple-tv-plus": { name: "Apple TV+" },
  netflix: { name: "Netflix" },
  "disney-plus": { name: "Disney+" },
  "amazon-prime-video": { name: "Amazon Prime Video" },
  "hbo-max": { name: "HBO Max" },
}
