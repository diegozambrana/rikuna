"use server"

import { createClient } from "@/lib/supabase/server"
import {
  MediaAvailabilityServices,
  MediaServices,
  MediaStatusServices,
  SubscriptionServices,
} from "@/services"
import type { MediaItem, MediaType, UserMediaStatus } from "@/types"

export type LibraryTab = "watched" | "want_to_watch" | "all"

// View-specific composite for /biblioteca — not table-backed, so it lives
// here instead of types/index.ts, same convention as
// actions/media/getTitleDetail.ts's TitleDetailDTO.
export type LibraryRow = {
  media: MediaItem
  status: Pick<UserMediaStatus, "watched" | "wantToWatch">
  isAvailable: boolean
}

export type GetLibraryParams = {
  tab: LibraryTab
  query?: string
  type?: MediaType
  genreSlug?: string
  yearMin?: number
  yearMax?: number
  ratingMin?: number
  onlyAvailable?: boolean
}

export type LibraryResult =
  | { status: "unauthorized" }
  // hasAnyHistory answers "does this user have ANY user_media_status row at
  // all" independent of the active tab/filters — the signal
  // features/library/LibraryScreen needs to tell "this tab has no matches"
  // apart from AC-6's "the whole library is empty, invite to import" state.
  | { status: "ok"; rows: LibraryRow[]; hasAnyHistory: boolean }

function statusFilterForTab(tab: LibraryTab): { watched?: boolean; wantToWatch?: boolean } | undefined {
  if (tab === "watched") return { watched: true }
  if (tab === "want_to_watch") return { wantToWatch: true }
  return undefined
}

/**
 * Biblioteca read (RIK-14): the caller's own user_media_status rows for the
 * active tab, joined to the matching media_items (filtered) and, when the
 * user has an active subscription, the availability set used for both the
 * "solo disponible" filter and the table's availability badge.
 */
export async function getLibrary(params: GetLibraryParams): Promise<LibraryResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: "unauthorized" }

  const statusServices = new MediaStatusServices(supabase)
  const mediaServices = new MediaServices(supabase)
  const subscriptionServices = new SubscriptionServices(supabase)
  const availabilityServices = new MediaAvailabilityServices(supabase)

  const statusRows = await statusServices.listForUser(user.id, statusFilterForTab(params.tab))

  if (statusRows.length === 0) {
    // This tab has nothing, but that alone doesn't mean the library is
    // empty — check the user's full history when the tab itself isn't
    // already "all" (which already *is* the full history).
    const hasAnyHistory =
      params.tab === "all" ? false : (await statusServices.listForUser(user.id)).length > 0
    return { status: "ok", rows: [], hasAnyHistory }
  }

  const statusByMediaId = new Map(statusRows.map((row) => [row.mediaId, row]))
  const mediaIds = statusRows.map((row) => row.mediaId)

  let mediaItems = await mediaServices.getManyWithFilters(mediaIds, {
    type: params.type,
    genreSlug: params.genreSlug,
    yearMin: params.yearMin,
    yearMax: params.yearMax,
    ratingMin: params.ratingMin,
    query: params.query,
  })

  const activeSubscriptions = await subscriptionServices.getActiveSubscriptions(user.id)
  const activePairs = activeSubscriptions.map((sub) => ({
    platformId: sub.platformId,
    country: sub.country,
  }))

  const availableIds =
    activePairs.length > 0 && mediaItems.length > 0
      ? await availabilityServices.getAvailableMediaIds(
          mediaItems.map((item) => item.id),
          activePairs
        )
      : []
  const availableSet = new Set(availableIds)

  if (params.onlyAvailable) {
    mediaItems = mediaItems.filter((item) => availableSet.has(item.id))
  }

  const rows: LibraryRow[] = mediaItems
    .map((media) => {
      const status = statusByMediaId.get(media.id)!
      return {
        media,
        status: { watched: status.watched, wantToWatch: status.wantToWatch },
        isAvailable: availableSet.has(media.id),
      }
    })
    .sort((a, b) => a.media.title.localeCompare(b.media.title))

  return { status: "ok", rows, hasAnyHistory: true }
}
