"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SubscriptionServices } from "@/services"
import type { ActiveSubscriptionWithPlatform } from "@/services"

// Panel-specific variant of getActiveSubscriptionsAction: embeds the
// platform name and orders by started_on desc, per this ticket's header
// requirement (RIK-6's action stays untouched for /suscripciones).
export async function getActiveSubscriptionsWithPlatformAction(): Promise<
  ActiveSubscriptionWithPlatform[]
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const services = new SubscriptionServices(supabase)
  return services.getActiveSubscriptionsWithPlatform(user.id)
}
