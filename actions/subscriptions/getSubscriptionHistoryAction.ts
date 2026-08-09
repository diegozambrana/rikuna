"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SubscriptionServices } from "@/services"
import type { UserSubscription } from "@/types"

export async function getSubscriptionHistoryAction(): Promise<UserSubscription[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const services = new SubscriptionServices(supabase)
  return services.getSubscriptionHistory(user.id)
}
