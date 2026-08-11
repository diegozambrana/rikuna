// Bridge between TMDB's watch-provider names and public.platforms rows (RIK-17).
//
// Deliberately NOT keyed on TMDB's provider_id, even though platforms carries
// provider_id_movie / provider_id_tv: those are a single integer each, while a
// platform has several provider ids in TMDB ("Netflix" 8 plus "Netflix
// Standard with Ads"; "HBO Max" plus "Max" plus "Max Amazon Channel"). Matching
// on them would silently drop legitimate offers. Those columns are filled in as
// informational metadata by ingestion/availability-sync's syncWatchProviderIds
// and nothing in the sync path depends on them.

/**
 * Folds a TMDB provider_name into the same shape as a platforms.slug.
 * NFD + diacritic strip ("Claro video" -> "claro-video"), "+" spelled out
 * ("Apple TV+" -> "apple-tv-plus"), everything else kebab-cased.
 */
export function normalizeProviderName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * normalizeProviderName(TMDB name) -> platforms.slug, for the cases the
 * normalisation alone doesn't cover.
 *
 * Most of the seeded catalog needs no entry here: "Netflix", "Crunchyroll",
 * "Disney Plus", "Paramount Plus", "MUBI", "ViX", "Filmin", "Claro video",
 * "Apple TV+", "HBO Max" and "Amazon Prime Video" all satisfy
 * `normalizeProviderName(name) === slug` on their own.
 *
 * An unmatched provider is not an error — the offer is skipped (only platforms
 * already in the table get rows) and the raw name is surfaced in the run
 * summary, which is the feedback loop for extending this map.
 */
export const TMDB_PROVIDER_ALIASES: Record<string, string> = {
  // 2023-2025 rebrand churn: TMDB carries "Max" and "HBO Max" as separate
  // providers depending on region and on when the row was created.
  max: "hbo-max",
  "max-amazon-channel": "hbo-max",
  "hbo-max-amazon-channel": "hbo-max",

  // "Amazon Video" is the rent/buy storefront of the same brand as "Amazon
  // Prime Video" (subscription). offer_type already carries that distinction,
  // so collapsing them onto one platform is right.
  "amazon-video": "amazon-prime-video",
  "prime-video": "amazon-prime-video",
  "amazon-prime-video-with-ads": "amazon-prime-video",

  // CAVEAT: "Apple TV Store" (previously "Apple TV") and "iTunes" are the
  // STORE, not the Apple TV+ subscription. They're folded in anyway because
  // the sync keeps rent/buy offers and without this there'd be no Apple rental
  // rows at all — the ficha shows "Apple TV+ · Alquiler", which is close
  // enough. To split them, delete these three lines and add an 'apple-tv' row
  // to platforms.
  "apple-tv": "apple-tv-plus",
  "apple-tv-store": "apple-tv-plus",
  itunes: "apple-tv-plus",
  "apple-tv-plus-amazon-channel": "apple-tv-plus",

  // "Movistar Plus+" normalises to "movistar-plus-plus"; the slug is
  // "movistar-plus". "Ficción Total" is one of its add-on packs and
  // "MovistarTV" is the same brand's Latin American pay-TV arm.
  "movistar-plus-plus": "movistar-plus",
  "movistar-plus-plus-ficcion-total": "movistar-plus",
  "movistar-play": "movistar-plus",
  movistartv: "movistar-plus",

  "netflix-basic-with-ads": "netflix",
  "netflix-standard-with-ads": "netflix",
  "netflix-kids": "netflix",

  "paramount-plus-amazon-channel": "paramount-plus",
  "paramount-plus-apple-tv-channel": "paramount-plus",
  "paramount-plus-premium": "paramount-plus",
  "paramount-plus-essential": "paramount-plus",

  "crunchyroll-amazon-channel": "crunchyroll",
  "mubi-amazon-channel": "mubi",
  "vix-plus": "vix",
  "filmin-plus": "filmin",
}
