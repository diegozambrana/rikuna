import { createClient } from "@/lib/supabase/server"
import {
  MediaAvailabilityServices,
  MediaServices,
  MediaStatusServices,
  SubscriptionServices,
} from "@/services"
import type { AvailabilityWithPlatform, CastMember } from "@/services"
import type { Genre, MediaItem, UserMediaStatus, UserSubscription } from "@/types"

// View-specific composite for the ficha (RIK-9) — not table-backed, so it
// lives here instead of types/index.ts. Shared between the authenticated and
// public (isPublicView) render branches of features/title/TitleDetail.
export type TitleDetailDTO = {
  media: MediaItem
  genres: Genre[]
  cast: CastMember[]
  availability: AvailabilityWithPlatform[]
  personalStatus: UserMediaStatus | null
  activeSubscriptions: UserSubscription[]
  isPublicView: boolean
}

/**
 * Title detail read, used by both the authenticated and public branches of
 * /titulo/[slug]. Does NOT redirect when there is no session — the
 * personal-status and subscription reads are simply skipped, and
 * isPublicView tells the feature component which controls to render.
 */
export async function getTitleDetail(slug: string): Promise<TitleDetailDTO | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const mediaServices = new MediaServices(supabase)
  const details = await mediaServices.getBySlugWithDetails(slug)
  if (!details) return null

  const availabilityServices = new MediaAvailabilityServices(supabase)
  const availability = await availabilityServices.getAvailableForMedia(details.media.id)

  let personalStatus: UserMediaStatus | null = null
  let activeSubscriptions: UserSubscription[] = []

  if (user) {
    const statusServices = new MediaStatusServices(supabase)
    const subscriptionServices = new SubscriptionServices(supabase)
    ;[personalStatus, activeSubscriptions] = await Promise.all([
      statusServices.getForUser(user.id, details.media.id),
      subscriptionServices.getActiveSubscriptions(user.id),
    ])
  }

  return {
    media: details.media,
    genres: details.genres,
    cast: details.cast,
    availability,
    personalStatus,
    activeSubscriptions,
    isPublicView: !user,
  }
}
