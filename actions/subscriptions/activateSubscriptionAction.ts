"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { SubscriptionServices } from "@/services"
import type { ActivateSubscriptionActionState } from "./types"

export async function activateSubscriptionAction(
  _prevState: ActivateSubscriptionActionState,
  formData: FormData
): Promise<ActivateSubscriptionActionState> {
  const platformId = formData.get("platformId")
  const country = formData.get("country")
  const notes = formData.get("notes")

  if (typeof platformId !== "string" || platformId.length === 0) {
    return { status: "error", message: "Selecciona una plataforma." }
  }
  if (typeof country !== "string" || country.length !== 2) {
    return { status: "error", message: "Selecciona un país." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para continuar." }
  }

  const services = new SubscriptionServices(supabase)

  try {
    const subscription = await services.activateSubscription(user.id, {
      platformId,
      country,
      notes: typeof notes === "string" && notes.length > 0 ? notes : undefined,
    })

    revalidatePath("/suscripciones")
    revalidatePath("/panel")

    return { status: "success", subscription }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo activar la suscripción.",
    }
  }
}
