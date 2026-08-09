"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RecommendationServices } from "@/services"
import type { MonthlyPick } from "@/services"

export async function getMonthlyWatchlist(): Promise<MonthlyPick[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const services = new RecommendationServices(supabase)
  return services.getMonthlyWatchlist(user.id)
}
