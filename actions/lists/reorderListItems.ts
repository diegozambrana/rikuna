"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"

export async function reorderListItemsAction(
  listId: string,
  orderedMediaIds: string[],
  listSlug: string
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Debes iniciar sesión para continuar.")
  }

  const services = new ListServices(supabase)
  await services.reorderListItems(listId, orderedMediaIds)

  revalidatePath(`/mis-listas/${listSlug}`)
}
