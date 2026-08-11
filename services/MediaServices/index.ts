import type { SupabaseClient } from "@supabase/supabase-js"
import { slugify, withSlugRetry } from "@/lib/slug"
import type { Genre, MediaItem, MediaType, Person } from "@/types"

// Same chunking/pagination constants as RecommendationServices — mirrored
// locally since those helpers are private to that class (RIK-14 constraint:
// reimplement the logic, don't reach into its internals). See that file for
// why ID_CHUNK_SIZE is 100 and not 200 (Kong's 8 KB request-line limit).
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

/**
 * Explorar's default order: best-rated first, unrated last, alphabetical
 * within ties so the listing is stable between requests.
 */
function byRatingThenTitle(a: MediaItem, b: MediaItem): number {
  const ratingA = a.imdbRating ?? -1
  const ratingB = b.imdbRating ?? -1
  if (ratingA !== ratingB) return ratingB - ratingA
  return a.title.localeCompare(b.title)
}

export type UpsertOrCreateStubInput = {
  imdbId: string
  title: string
  year?: number
  type: MediaType
}

// Query-shaped projection for the ficha (RIK-9) — media_items plus its
// genres and lead cast, colocated here rather than types/index.ts since it's
// a view-specific composite, not a table-backed type.
export type CastMember = {
  person: Person
  characterName: string | null
  sortOrder: number
}

export type TitleWithDetails = {
  media: MediaItem
  genres: Genre[]
  cast: CastMember[]
}

type MediaItemRow = {
  id: string
  created_at: string
  updated_at: string
  imdb_id: string
  tmdb_id: number | null
  type: string
  title_type: string | null
  title: string
  original_title: string | null
  slug: string
  year: number | null
  end_year: number | null
  runtime_minutes: number | null
  description: string | null
  poster_url: string | null
  content_rating: string | null
  imdb_rating: number | null
  imdb_votes: number | null
  imdb_url: string | null
  is_stub: boolean
  enriched_at: string | null
  metadata: Record<string, unknown>
}

function mapMediaItemRow(row: MediaItemRow): MediaItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imdbId: row.imdb_id,
    tmdbId: row.tmdb_id,
    type: row.type as MediaType,
    titleType: row.title_type,
    title: row.title,
    originalTitle: row.original_title,
    slug: row.slug,
    year: row.year,
    endYear: row.end_year,
    runtimeMinutes: row.runtime_minutes,
    description: row.description,
    posterUrl: row.poster_url,
    contentRating: row.content_rating,
    imdbRating: row.imdb_rating,
    imdbVotes: row.imdb_votes,
    imdbUrl: row.imdb_url,
    isStub: row.is_stub,
    enrichedAt: row.enriched_at,
    metadata: row.metadata,
  }
}

type GenreRow = { genres: { id: string; name: string; slug: string } | null }

type PersonRow = { id: string; imdb_id: string | null; name: string; photo_url: string | null }

type CastRow = {
  person_id: string
  character_name: string | null
  sort_order: number
  people: PersonRow | null
}

// Search-result projection for the list-detail "add title" control (RIK-10)
// — narrower than MediaItem, same shape as RecommendationServices.MonthlyPick
// so it drops straight into MediaCard.
export type MediaSearchResult = {
  id: string
  slug: string
  title: string
  year: number | null
  posterUrl: string | null
  imdbRating: number | null
  isStub: boolean
}

export type MediaManyFilters = {
  type?: MediaType
  genreSlug?: string
  yearMin?: number
  yearMax?: number
  ratingMin?: number
  query?: string
}

/**
 * Explorar filters (RIK-19). Superset of MediaManyFilters: the same
 * media_items column predicates plus the two relational ones — genre via
 * media_genres and platform via media_availability. `country` only narrows a
 * platform filter; on its own it would mean "available anywhere in this
 * country", which is what the platform picker already expresses.
 */
export type CatalogFilters = MediaManyFilters & {
  platformSlug?: string
  country?: string
}

export type CatalogPage = {
  items: MediaItem[]
  /** Rows matching the filters, before `limit` is applied. */
  total: number
  /** True when `total` exceeded `limit` and `items` is a prefix of the matches. */
  truncated: boolean
}

export class MediaServices {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Catalog search by title (RIK-10's add-to-list control) — case-insensitive
   * substring match, capped at `limit` results ordered by rating so the most
   * likely match surfaces first. No established search method existed yet
   * for RIK-3/RIK-9 to reuse (biblioteca's search ships in a later ticket).
   */
  async searchByTitle(query: string, limit = 10): Promise<MediaSearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const { data, error } = await this.client
      .from("media_items")
      .select("id, slug, title, year, poster_url, imdb_rating, is_stub")
      .ilike("title", `%${trimmed}%`)
      .order("imdb_rating", { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) throw error

    return (
      data as {
        id: string
        slug: string
        title: string
        year: number | null
        poster_url: string | null
        imdb_rating: number | null
        is_stub: boolean
      }[]
    ).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      year: row.year,
      posterUrl: row.poster_url,
      imdbRating: row.imdb_rating,
      isStub: row.is_stub,
    }))
  }

  /**
   * Biblioteca read (RIK-14): media_items rows restricted to `mediaIds`
   * (the caller's user_media_status media_id list), narrowed by the
   * type/genre/year/rating/title filters. Chunks mediaIds at
   * ID_CHUNK_SIZE like RecommendationServices' getMediaItems/getAvailableMediaIds
   * so a multi-thousand-title library doesn't blow up the .in() URL. Distinct
   * from searchByTitle, whose signature/behavior RIK-10's add-to-list control
   * still depends on unchanged.
   */
  async getManyWithFilters(mediaIds: string[], filters: MediaManyFilters = {}): Promise<MediaItem[]> {
    if (mediaIds.length === 0) return []

    const narrowedIds = await this.applyGenreFilter(mediaIds, filters.genreSlug)
    if (narrowedIds.length === 0) return []

    const items: MediaItem[] = []

    for (const idChunk of chunk(narrowedIds, ID_CHUNK_SIZE)) {
      let query = this.client.from("media_items").select("*").in("id", idChunk)

      if (filters.type) query = query.eq("type", filters.type)
      if (filters.yearMin !== undefined) query = query.gte("year", filters.yearMin)
      if (filters.yearMax !== undefined) query = query.lte("year", filters.yearMax)
      if (filters.ratingMin !== undefined) query = query.gte("imdb_rating", filters.ratingMin)
      if (filters.query) query = query.ilike("title", `%${filters.query}%`)

      const rows = await paginate<MediaItemRow>((from, to) => query.range(from, to))
      items.push(...rows.map(mapMediaItemRow))
    }

    return items
  }

  /**
   * Explorar read (RIK-19): the whole catalog, not one user's slice.
   *
   * Deliberately NOT built on getManyWithFilters — that one starts from a
   * caller-supplied id list (the user's user_media_status rows) and can only
   * ever narrow it. Here there is no starting list, so the relational filters
   * have to produce one and the unfiltered case must stay a single indexed
   * query over media_items instead of paging the entire table into memory.
   *
   * Ordered by rating so the default view is useful, and capped: the DataTable
   * paginates client-side, so every matching row crosses the wire. `total` and
   * `truncated` let the UI say so honestly rather than silently showing a
   * prefix.
   */
  async getCatalogWithFilters(filters: CatalogFilters, limit: number): Promise<CatalogPage> {
    const restrictIds = await this.resolveRelationalFilters(filters)

    if (restrictIds !== null && restrictIds.length === 0) {
      return { items: [], total: 0, truncated: false }
    }

    if (restrictIds === null) {
      let query = this.client.from("media_items").select("*", { count: "exact" })

      if (filters.type) query = query.eq("type", filters.type)
      if (filters.yearMin !== undefined) query = query.gte("year", filters.yearMin)
      if (filters.yearMax !== undefined) query = query.lte("year", filters.yearMax)
      if (filters.ratingMin !== undefined) query = query.gte("imdb_rating", filters.ratingMin)
      if (filters.query) query = query.ilike("title", `%${filters.query}%`)

      const { data, error, count } = await query
        .order("imdb_rating", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true })
        .range(0, limit - 1)

      if (error) throw error

      const total = count ?? 0
      return {
        items: (data as MediaItemRow[]).map(mapMediaItemRow),
        total,
        truncated: total > limit,
      }
    }

    // A genre or platform filter is in play, so the candidate set is already
    // bounded — fetch it chunked (Kong's request-line limit again), then
    // order and cap in memory since the rows are spread across chunks.
    const matches: MediaItem[] = []
    for (const idChunk of chunk(restrictIds, ID_CHUNK_SIZE)) {
      let query = this.client.from("media_items").select("*").in("id", idChunk)

      if (filters.type) query = query.eq("type", filters.type)
      if (filters.yearMin !== undefined) query = query.gte("year", filters.yearMin)
      if (filters.yearMax !== undefined) query = query.lte("year", filters.yearMax)
      if (filters.ratingMin !== undefined) query = query.gte("imdb_rating", filters.ratingMin)
      if (filters.query) query = query.ilike("title", `%${filters.query}%`)

      const rows = await paginate<MediaItemRow>((from, to) => query.range(from, to))
      matches.push(...rows.map(mapMediaItemRow))
    }

    matches.sort(byRatingThenTitle)

    return {
      items: matches.slice(0, limit),
      total: matches.length,
      truncated: matches.length > limit,
    }
  }

  /**
   * Turns the genre and platform filters into the id set they allow, or null
   * when neither is set (meaning "no restriction", which is different from
   * an empty array's "nothing matches").
   */
  private async resolveRelationalFilters(filters: CatalogFilters): Promise<string[] | null> {
    const byGenre = filters.genreSlug ? await this.mediaIdsForGenre(filters.genreSlug) : null
    const byPlatform = filters.platformSlug
      ? await this.mediaIdsForPlatform(filters.platformSlug, filters.country)
      : null

    if (byGenre === null) return byPlatform
    if (byPlatform === null) return byGenre

    const platformSet = new Set(byPlatform)
    return byGenre.filter((id) => platformSet.has(id))
  }

  /** Media ids carrying this genre. An unknown slug matches nothing. */
  private async mediaIdsForGenre(genreSlug: string): Promise<string[]> {
    const { data: genre, error } = await this.client
      .from("genres")
      .select("id")
      .eq("slug", genreSlug)
      .maybeSingle()

    if (error) throw error
    if (!genre) return []

    const rows = await paginate<{ media_id: string }>((from, to) =>
      this.client
        .from("media_genres")
        .select("media_id")
        .eq("genre_id", (genre as { id: string }).id)
        .range(from, to)
    )

    return Array.from(new Set(rows.map((row) => row.media_id)))
  }

  /**
   * Media ids currently available on this platform, optionally in one
   * country. Reads media_availability directly rather than going through
   * MediaAvailabilityServices, whose methods all start from a caller-supplied
   * id list — the same RIK-14 constraint that keeps the chunk helpers
   * duplicated across this layer.
   */
  private async mediaIdsForPlatform(platformSlug: string, country?: string): Promise<string[]> {
    const { data: platform, error } = await this.client
      .from("platforms")
      .select("id")
      .eq("slug", platformSlug)
      .maybeSingle()

    if (error) throw error
    if (!platform) return []

    const rows = await paginate<{ media_id: string }>((from, to) => {
      let query = this.client
        .from("media_availability")
        .select("media_id")
        .eq("platform_id", (platform as { id: string }).id)
        .eq("is_available", true)

      if (country) query = query.eq("country", country)

      return query.range(from, to)
    })

    return Array.from(new Set(rows.map((row) => row.media_id)))
  }

  /**
   * No-op when genreSlug is unset; an unknown slug resolves to zero matches.
   * Same shape as RecommendationServices.applyGenreFilter (resolve slug ->
   * genre id, then intersect via chunked media_genres lookups).
   */
  private async applyGenreFilter(mediaIds: string[], genreSlug?: string): Promise<string[]> {
    if (!genreSlug) return mediaIds
    if (mediaIds.length === 0) return mediaIds

    const { data: genre, error: genreError } = await this.client
      .from("genres")
      .select("id")
      .eq("slug", genreSlug)
      .maybeSingle()

    if (genreError) throw genreError
    if (!genre) return []

    const genreMediaIds = new Set<string>()
    for (const idChunk of chunk(mediaIds, ID_CHUNK_SIZE)) {
      const rows = await paginate<{ media_id: string }>((from, to) =>
        this.client
          .from("media_genres")
          .select("media_id")
          .eq("genre_id", (genre as { id: string }).id)
          .in("media_id", idChunk)
          .range(from, to)
      )
      for (const row of rows) genreMediaIds.add(row.media_id)
    }

    return mediaIds.filter((id) => genreMediaIds.has(id))
  }

  /**
   * Ficha read (RIK-9): media_items by slug, embedding genres (via
   * media_genres) and lead cast (media_people where role='actor', ordered by
   * sort_order). Returns null when the slug matches no row so the route can
   * notFound().
   */
  async getBySlugWithDetails(slug: string): Promise<TitleWithDetails | null> {
    const { data, error } = await this.client
      .from("media_items")
      .select(
        `*,
        media_genres(genres(id, name, slug)),
        media_people(person_id, character_name, sort_order, role, people(id, imdb_id, name, photo_url))`
      )
      .eq("slug", slug)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const row = data as MediaItemRow & {
      media_genres: GenreRow[] | null
      media_people: (CastRow & { role: string })[] | null
    }

    const genres = (row.media_genres ?? [])
      .map((entry) => entry.genres)
      .filter((genre): genre is { id: string; name: string; slug: string } => genre !== null)
      .sort((a, b) => a.name.localeCompare(b.name))

    const cast = (row.media_people ?? [])
      .filter((entry) => entry.role === "actor" && entry.people !== null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((entry) => ({
        person: {
          id: entry.people!.id,
          imdbId: entry.people!.imdb_id,
          name: entry.people!.name,
          photoUrl: entry.people!.photo_url,
        },
        characterName: entry.character_name,
        sortOrder: entry.sort_order,
      }))

    return {
      media: mapMediaItemRow(row),
      genres,
      cast,
    }
  }

  /**
   * Looks up media_items by imdb_id; creates a stub row (is_stub=true) when
   * missing. Used by ingestion/catalog/ so a title referenced by an
   * availability file always has somewhere to attach, even before any
   * enrichment process fills in poster/synopsis/cast.
   */
  async upsertOrCreateStub(input: UpsertOrCreateStubInput): Promise<string> {
    const { data: existing, error: selectError } = await this.client
      .from("media_items")
      .select("id")
      .eq("imdb_id", input.imdbId)
      .maybeSingle()

    if (selectError) throw selectError
    if (existing) return (existing as { id: string }).id

    const baseSlug = slugify(input.title, input.year)

    const created = await withSlugRetry(baseSlug, async (slug) => {
      const { data, error } = await this.client
        .from("media_items")
        .insert({
          imdb_id: input.imdbId,
          type: input.type,
          title: input.title,
          slug,
          year: input.year ?? null,
          is_stub: true,
        })
        .select("id")
        .single()

      if (error) throw error
      return data as { id: string }
    })

    return created.id
  }
}
