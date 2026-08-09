import { readFile } from "node:fs/promises"
import type { RawCatalogFile, RawCatalogItem } from "./types"

const VALID_OFFER_TYPES = ["subscription", "rent", "buy"]
const VALID_ITEM_TYPES = ["movie", "tv"]

/** Reads and validates a raw catalog file. Fails loudly rather than partially ingesting. */
export async function parseCatalogFile(filePath: string): Promise<RawCatalogFile> {
  let raw: string
  try {
    raw = await readFile(filePath, "utf-8")
  } catch (error) {
    throw new Error(
      `Could not read catalog file at "${filePath}": ${(error as Error).message}`
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Catalog file at "${filePath}" is not valid JSON: ${(error as Error).message}`
    )
  }

  return validateCatalogFile(parsed, filePath)
}

function validateCatalogFile(value: unknown, filePath: string): RawCatalogFile {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Catalog file at "${filePath}" must be a JSON object.`)
  }

  const { metadata, items } = value as Record<string, unknown>

  if (
    typeof metadata !== "object" ||
    metadata === null ||
    typeof (metadata as Record<string, unknown>).generated_at !== "string"
  ) {
    throw new Error(
      `Catalog file at "${filePath}" is missing a valid "metadata.generated_at" string.`
    )
  }

  if (!Array.isArray(items)) {
    throw new Error(`Catalog file at "${filePath}" is missing an "items" array.`)
  }

  return {
    metadata: { generated_at: (metadata as { generated_at: string }).generated_at },
    items: items.map((item, index) => validateItem(item, index, filePath)),
  }
}

function validateItem(value: unknown, index: number, filePath: string): RawCatalogItem {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Catalog file at "${filePath}" has an invalid item at index ${index}.`)
  }

  const item = value as Record<string, unknown>

  if (typeof item.imdb_id !== "string" || !item.imdb_id) {
    throw new Error(
      `Catalog file at "${filePath}" item at index ${index} is missing "imdb_id".`
    )
  }
  if (typeof item.title !== "string" || !item.title) {
    throw new Error(
      `Catalog file at "${filePath}" item at index ${index} is missing "title".`
    )
  }
  if (item.year !== undefined && typeof item.year !== "number") {
    throw new Error(
      `Catalog file at "${filePath}" item at index ${index} has a non-numeric "year".`
    )
  }
  if (item.url !== undefined && typeof item.url !== "string") {
    throw new Error(
      `Catalog file at "${filePath}" item at index ${index} has a non-string "url".`
    )
  }
  if (item.offer_type !== undefined && !VALID_OFFER_TYPES.includes(item.offer_type as string)) {
    throw new Error(
      `Catalog file at "${filePath}" item at index ${index} has an invalid "offer_type".`
    )
  }
  if (item.type !== undefined && !VALID_ITEM_TYPES.includes(item.type as string)) {
    throw new Error(
      `Catalog file at "${filePath}" item at index ${index} has an invalid "type".`
    )
  }

  return {
    imdb_id: item.imdb_id,
    title: item.title,
    year: item.year as number | undefined,
    url: item.url as string | undefined,
    offer_type: item.offer_type as RawCatalogItem["offer_type"],
    type: item.type as RawCatalogItem["type"],
  }
}
