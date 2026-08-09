import "server-only"
import type { ImdbCsvSourceType, ImdbImportRowResult } from "@/types"
import type { ImdbImportServices } from "@/services"
import type { ImdbCsvRow } from "./parseCsv"

/**
 * Implements schema-basedatos-rikuna.md Section 7.3 for a single CSV row.
 * Ratings: watched=true / watched_at / personal_rating.
 * Watchlist: want_to_watch=true / want_added_at — never touches `watched`.
 */
export async function processImdbCsvRow(
  services: ImdbImportServices,
  batchId: string,
  userId: string,
  sourceType: ImdbCsvSourceType,
  csvRow: ImdbCsvRow
): Promise<ImdbImportRowResult> {
  if (!csvRow.isValid) {
    await services.insertRow(batchId, csvRow, null, "skipped")
    return "skipped"
  }

  const { mediaItem, result } = await services.findOrCreateMediaItem(csvRow)

  if (sourceType === "ratings") {
    await services.upsertUserMediaStatus(
      userId,
      mediaItem.id,
      {
        watched: true,
        watched_at: csvRow.dateRated,
        personal_rating: csvRow.yourRating,
        source: "imdb_ratings",
      },
      true
    )
  } else {
    await services.upsertUserMediaStatus(
      userId,
      mediaItem.id,
      {
        want_to_watch: true,
        want_added_at: csvRow.dateCreated ?? new Date().toISOString(),
        source: "imdb_watchlist",
      },
      false
    )
  }

  await services.insertRow(batchId, csvRow, mediaItem.id, result)
  return result
}
