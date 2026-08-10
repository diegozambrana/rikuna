"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"

// Shared write path for "add to list" — called from the list detail search
// control and AddToListDialog (the latter has no listSlug on hand, since it
// only knows mediaId; titleSlug lets a future /titulo/[slug] trigger
// revalidate that page too, mirroring markWatched's optional-slug pattern.
export async function addListItemAction(
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
  await services.addListItem(listId, mediaId)

  if (listSlug) revalidatePath(`/mis-listas/${listSlug}`)
  if (titleSlug) revalidatePath(`/titulo/${titleSlug}`)
}
