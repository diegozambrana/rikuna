import { slugify } from "@/lib/slug"
import type { PendingMediaItem, TmdbSyncServices, TmdbSyncStatus } from "@/services"
import {
  findByImdbId,
  getMovieDetails,
  getOverviewFallback,
  getTvDetails,
  TmdbConfigError,
} from "./client"
import { mapMovieDetails, mapTvDetails, toMediaItemPatch } from "./mapDetails"
import type { TmdbDetails } from "./types"

/** Outcome of one title. 'pending' is never returned — a processed row always leaves that state. */
export type SyncOutcome = Exclude<TmdbSyncStatus, "pending">

/**
 * Enriches a single media_items row from TMDB.
 *
 * Never throws for a per-title problem: a bad response, a title TMDB doesn't
 * carry, or a write failure all resolve to a persisted status so the batch
 * keeps going and the next run doesn't retry a hopeless row. The one exception
 * is TmdbConfigError — missing credentials aren't a per-title problem and
 * failing 800 rows one by one would just bury the real cause.
 */
export async function syncMediaItem(
  services: TmdbSyncServices,
  item: PendingMediaItem
): Promise<SyncOutcome> {
  let details: TmdbDetails

  try {
    const match = await findByImdbId(item.imdbId)
    if (!match) {
      await services.markStatus(item.id, "not_found")
      return "not_found"
    }

    const payload =
      match.kind === "movie"
        ? await getMovieDetails(match.tmdbId)
        : await getTvDetails(match.tmdbId)

    if (!payload) {
      await services.markStatus(item.id, "not_found")
      return "not_found"
    }

    details =
      match.kind === "movie"
        ? mapMovieDetails(payload as Parameters<typeof mapMovieDetails>[0])
        : mapTvDetails(payload as Parameters<typeof mapTvDetails>[0])

    if (!details.overview) {
      details.overview = await getOverviewFallback(details.id, details.kind)
    }
  } catch (error) {
    if (error instanceof TmdbConfigError) throw error
    await markFailedQuietly(services, item.id)
    return "failed"
  }

  try {
    // A row imported from an id-only CSV has no title of its own: both its
    // title and its slug are the IMDb id standing in until now. TMDB just
    // supplied the real name, so the slug gets rebuilt too — otherwise the
    // ficha would live at /titulo/tt0111161 forever.
    const isPlaceholderTitle = item.title === item.imdbId
    const desiredSlug =
      isPlaceholderTitle && details.title ? slugify(details.title, details.year) : undefined

    await services.applySyncResult(
      item.id,
      toMediaItemPatch(details, item.imdbId),
      "synced",
      desiredSlug
    )
    await services.linkGenres(item.id, details.genreNames)
    await services.linkCast(
      item.id,
      details.cast.map((member) => ({
        name: member.name,
        characterName: member.characterName,
        photoUrl: member.profilePath,
        sortOrder: member.order,
      }))
    )
    return "synced"
  } catch {
    // The media_items row may already carry the patch — genre/cast linking is
    // what usually fails here. 'failed' keeps it in the retry set rather than
    // leaving it half-enriched and marked done.
    await markFailedQuietly(services, item.id)
    return "failed"
  }
}

/** A failure while recording a failure must not take the whole batch down. */
async function markFailedQuietly(services: TmdbSyncServices, mediaId: string): Promise<void> {
  try {
    await services.markStatus(mediaId, "failed")
  } catch {
    // Swallowed on purpose: the row simply stays 'pending' and gets retried.
  }
}
