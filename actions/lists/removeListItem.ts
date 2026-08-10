"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"

export async function removeListItemAction(
  listId: string,
  mediaId: string,
  listSlug?: string,
  titleSlug?: string
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Debes iniciar sesión para continuar.")
  }

  const services = new ListServices(supabase)
  await services.removeListItem(listId, mediaId)

  if (listSlug) revalidatePath(`/mis-listas/${listSlug}`)
  if (titleSlug) revalidatePath(`/titulo/${titleSlug}`)
}
