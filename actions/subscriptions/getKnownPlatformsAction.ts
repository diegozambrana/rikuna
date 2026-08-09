"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SubscriptionServices } from "@/services"
import type { Platform } from "@/types"

export async function getKnownPlatformsAction(): Promise<Pick<Platform, "id" | "name" | "slug">[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const services = new SubscriptionServices(supabase)
  return services.getKnownPlatforms()
}
