"use server"

import { createClient } from "@/lib/supabase/server"
import { MediaServices } from "@/services"
import type { CatalogFilters } from "@/services"
import type { MediaItem } from "@/types"

/**
 * Every matching row crosses the wire because the table paginates
 * client-side, so the result set is capped. 1000 is PostgREST's own
 * `max_rows` default and comfortably above today's catalog, which keeps the
 * unfiltered view complete while stopping a grown catalog from shipping a
 * multi-megabyte payload.
 *
 * Not exported: a "use server" module may only export async functions, and
 * callers get the value back on the result's `limit` field anyway.
 */
const EXPLORE_RESULT_LIMIT = 1000

export type ExploreParams = CatalogFilters

export type ExploreResult =
  | { status: "unauthorized" }
  | {
      status: "ok"
      items: MediaItem[]
      /** Matches before the cap, so the UI can say how much it isn't showing. */
      total: number
      truncated: boolean
      limit: number
    }

/**
 * Explorar read (RIK-19): the whole catalog under the given filters.
 *
 * Distinct from getLibrary, which starts from the caller's own
 * user_media_status rows — this one is the catalog itself, so there's no
 * per-user data involved and the session check exists only to keep the route
 * consistent with the rest of the (app) group. media_items_select is
 * `using (true)`, so the caller's own client is enough.
 */
export async function exploreCatalog(params: ExploreParams): Promise<ExploreResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: "unauthorized" }

  const services = new MediaServices(supabase)
  const page = await services.getCatalogWithFilters(params, EXPLORE_RESULT_LIMIT)

  return {
    status: "ok",
    items: page.items,
    total: page.total,
    truncated: page.truncated,
    limit: EXPLORE_RESULT_LIMIT,
  }
}
