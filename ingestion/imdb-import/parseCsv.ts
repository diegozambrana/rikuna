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

const REQUIRED_HEADERS = ["Const", "Title"]

export function parseImdbCsv(csvText: string): ParsedImdbCsv {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const headers = result.meta.fields ?? []
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header))
  if (missingHeaders.length > 0) {
    throw new Error(`CSV is missing required column(s): ${missingHeaders.join(", ")}`)
  }

  const rows = result.data.map(toImdbCsvRow)

  return { rows }
}

function toImdbCsvRow(raw: Record<string, string>): ImdbCsvRow {
  const imdbId = (raw["Const"] ?? "").trim()
  const title = (raw["Title"] ?? "").trim()

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
    // Invalid when the join key or the title is missing — nothing usable to
    // match or create a media_items row with.
    isValid: imdbId.length > 0 && title.length > 0,
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
