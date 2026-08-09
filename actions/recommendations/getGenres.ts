"use server"

import { createClient } from "@/lib/supabase/server"
import { RecommendationServices } from "@/services"
import type { Genre } from "@/types"

// Public read (genres RLS allows anon + authenticated) — no session check
// needed; the (app) layout guard already gates this route.
export async function getGenres(): Promise<Genre[]> {
  const supabase = await createClient()
  const services = new RecommendationServices(supabase)
  return services.getGenres()
}
