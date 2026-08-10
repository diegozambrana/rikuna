"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { MediaStatusServices } from "@/services"

// Sibling to addToWatchlist — the title ficha's "quitar de watchlist"
// action. Throws on failure; callers surface it as a toast.
export async function removeFromWatchlist(mediaId: string, titleSlug?: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Debes iniciar sesión para continuar.")
  }

  const services = new MediaStatusServices(supabase)
  await services.removeFromWatchlist(user.id, mediaId)

  revalidatePath("/recomendaciones")
  revalidatePath("/panel")
  revalidatePath("/biblioteca")
  if (titleSlug) revalidatePath(`/titulo/${titleSlug}`)
}
