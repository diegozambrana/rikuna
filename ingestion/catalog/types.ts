// Raw catalog file contract produced by the external availability process,
// one file per platform+country (e.g. "apple-tv-plus_BO.json").
//
// No real sample shipped with RIK-3 at spec-writing time — this is the
// spec's inferred default. Adjust here (and in parseCatalogFile.ts) if a
// real sample from the external process contradicts it; nothing downstream
// should assume more than what's declared below.

export type RawCatalogOfferType = "subscription" | "rent" | "buy"
export type RawCatalogItemType = "movie" | "tv"

export type RawCatalogItem = {
  imdb_id: string
  title: string
  year?: number
  url?: string
  offer_type?: RawCatalogOfferType
  // Optional because today's external process reliably supplies a movie
  // catalog but only derived (incomplete) lists for series — see schema doc
  // Section 11 item 1. Missing/absent defaults to "movie" at the call site.
  type?: RawCatalogItemType
}

export type RawCatalogFile = {
  metadata: {
    generated_at: string
  }
  items: RawCatalogItem[]
}
