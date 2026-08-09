"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RecommendationServices } from "@/services"
import type { MonthlyPick } from "@/services"

export type Recommendations = {
  watchlistAvailable: MonthlyPick[]
  discovery: MonthlyPick[]
}

// Feeds /recomendaciones' two blocks in one call. Recomputed on every
// request per documento-especificacion-rikuna.md — never cached — so marking
// a title watched/dismissed takes effect on the next load.
export async function getRecommendations(genreSlug?: string): Promise<Recommendations> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const services = new RecommendationServices(supabase)
  const params = genreSlug ? { genreSlug } : undefined

  const [watchlistAvailable, discovery] = await Promise.all([
    services.getMonthlyWatchlist(user.id, params),
    services.getDiscovery(user.id, params),
  ])

  return { watchlistAvailable, discovery }
}
