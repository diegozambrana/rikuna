"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { MediaStatusServices } from "@/services"
import type { MarkWatchedResult } from "./types"

// Sibling to markWatched — the title ficha's "un-mark watched" toggle.
// titleSlug is optional so future callers without it are unaffected.
export async function markNotWatched(mediaId: string, titleSlug?: string): Promise<MarkWatchedResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Debes iniciar sesión para continuar." }
  }

  const services = new MediaStatusServices(supabase)

  try {
    await services.markNotWatched(user.id, mediaId)

    revalidatePath("/panel")
    revalidatePath("/biblioteca")
    if (titleSlug) revalidatePath(`/titulo/${titleSlug}`)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo desmarcar el título como visto.",
    }
  }
}
