"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"
import type { ListMutationResult } from "./types"

export async function setListVisibilityAction(
  listId: string,
  isPublic: boolean,
  listSlug: string
): Promise<ListMutationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Debes iniciar sesión para continuar." }
  }

  const services = new ListServices(supabase)

  try {
    await services.setListVisibility(listId, isPublic)

    revalidatePath("/mis-listas")
    revalidatePath(`/mis-listas/${listSlug}`)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar la visibilidad.",
    }
  }
}
