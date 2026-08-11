import Papa from "papaparse"

// Row shape stays CSV-shaped (raw strings, minimally coerced) so a coercion
// or validity issue is attributable to a specific row instead of failing the
// whole parse. Type/date coercion for DB writes happens in processRow.ts.
export type ImdbCsvRow = {
  imdbId: string
  title: string
  titleType: string
  year: number | null
  imdbRating: number | null
  imdbVotes: number | null
  runtimeMinutes: number | null
  genres: string[]
  directors: string[]
  yourRating: number | null
  dateRated: string | null
  dateCreated: string | null
  isValid: boolean
}

export type ParsedImdbCsv = {
  rows: ImdbCsvRow[]
}

/**
 * The IMDb id is the only column this importer truly needs: everything else
 * (title, year, runtime, genres, cast) gets filled in afterwards by the TMDB
 * sync. So a full IMDb export and a bare one-column list of ids are both
 * accepted, and the id column is looked up under whatever name it arrived
 * with — IMDb calls it "Const", most hand-made lists call it "imdb_id".
 *
 * Compared by normalized name (lowercased, non-alphanumerics dropped), so
 * "IMDb ID", "imdb_id" and "imdbId" all collapse to the same key. Ordered by
 * how specific each name is: "id" is last because it's the one that could
 * plausibly mean something else.
 */
const ID_HEADERS = ["const", "imdbid", "tconst", "imdb", "id"]
const TITLE_HEADERS = ["title", "primarytitle", "originaltitle"]

/** IMDb title ids are `tt` + digits. Name ids (`nm…`) are not titles. */
const IMDB_ID_PATTERN = /^tt\d+$/

export function parseImdbCsv(csvText: string): ParsedImdbCsv {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const headers = result.meta.fields ?? []
  const idHeader = findHeader(headers, ID_HEADERS)

  if (!idHeader) {
    // No recognizable id column. Before giving up, check whether this is a
    // headerless list of ids — Papa would have consumed the first id as the
    // column name, so that name looking like an IMDb id is the tell.
    const headerless = parseHeaderlessIds(csvText, headers)
    if (headerless) return headerless

    throw new Error(
      `CSV is missing an IMDb id column. Expected one of: ${ID_HEADERS.join(", ")}.`
    )
  }

  const titleHeader = findHeader(headers, TITLE_HEADERS)
  const rows = result.data.map((raw) => toImdbCsvRow(raw, idHeader, titleHeader))

  return { rows }
}

/** First header whose normalized form matches one of `candidates`, in order. */
function findHeader(headers: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    const match = headers.find((header) => normalizeHeader(header) === candidate)
    if (match) return match
  }
  return null
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * A file that is nothing but IMDb ids, one per line, with no header row.
 * Returns null when the first line isn't an id, so a genuinely malformed CSV
 * still raises the missing-column error instead of importing garbage.
 */
function parseHeaderlessIds(csvText: string, headers: string[]): ParsedImdbCsv | null {
  const firstCell = headers[0]?.trim() ?? ""
  if (!IMDB_ID_PATTERN.test(firstCell.toLowerCase())) return null

  const result = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: true })
  const rows = result.data.map((cells) => toImdbCsvRow({ id: cells[0] ?? "" }, "id", null))

  return { rows }
}

function toImdbCsvRow(
  raw: Record<string, string>,
  idHeader: string,
  titleHeader: string | null
): ImdbCsvRow {
  // Lowercased because the `tt` prefix is canonically lowercase and
  // media_items.imdb_id is the join key across every ingestion path — a
  // stray "TT0111161" would create a duplicate row for the same film.
  const imdbId = (raw[idHeader] ?? "").trim().toLowerCase()
  const title = (titleHeader ? (raw[titleHeader] ?? "") : "").trim()

  return {
    imdbId,
    title,
    titleType: (raw["Title Type"] ?? "").trim(),
    year: parseIntOrNull(raw["Year"]),
    imdbRating: parseFloatOrNull(raw["IMDb Rating"]),
    imdbVotes: parseIntOrNull(raw["Num Votes"]),
    runtimeMinutes: parseIntOrNull(raw["Runtime (mins)"]),
    genres: splitList(raw["Genres"]),
    directors: splitList(raw["Directors"]),
    yourRating: parseIntOrNull(raw["Your Rating"]),
    dateRated: parseDateOrNull(raw["Date Rated"]),
    dateCreated: parseDateOrNull(raw["Created"]),
    // The id is the only thing a row can't do without: it's the join key, and
    // everything else is recoverable from TMDB afterwards. A missing title no
    // longer skips the row — the id stands in until the sync fills the real
    // one — but a malformed id does, since inserting one would poison the join
    // key for every later import of the same film.
    isValid: IMDB_ID_PATTERN.test(imdbId),
  }
}

function parseIntOrNull(value: string | undefined): number | null {
  if (!value || !value.trim()) return null
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseFloatOrNull(value: string | undefined): number | null {
  if (!value || !value.trim()) return null
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDateOrNull(value: string | undefined): string | null {
  if (!value || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function splitList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}
