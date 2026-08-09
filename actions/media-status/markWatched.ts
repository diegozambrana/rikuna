"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { MediaStatusServices } from "@/services"
import type { MarkWatchedResult } from "./types"

// Shared write path for "mark watched" — called from the panel grid and,
// later, the title detail screen (RIK-9). Do not duplicate this logic
// elsewhere; extend this action instead.
export async function markWatched(mediaId: string): Promise<MarkWatchedResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Debes iniciar sesión para continuar." }
  }

  const services = new MediaStatusServices(supabase)

  try {
    await services.markWatched(user.id, mediaId)

    revalidatePath("/panel")
    revalidatePath("/biblioteca")

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo marcar el título como visto.",
    }
  }
}
