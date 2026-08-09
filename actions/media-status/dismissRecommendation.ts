"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { MediaStatusServices } from "@/services"

// Shared write path for "No me interesa" from a discovery card — structured
// so RIK-9 (title detail actions) can add a sibling function to this module
// later without restructuring it. Throws on failure; callers surface it as a toast.
export async function dismissRecommendation(mediaId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Debes iniciar sesión para continuar.")
  }

  const services = new MediaStatusServices(supabase)
  await services.dismissRecommendation(user.id, mediaId)

  revalidatePath("/recomendaciones")
  revalidatePath("/panel")
}
