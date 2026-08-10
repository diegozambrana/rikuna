"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"
import type { ListMutationResult } from "./types"

export async function deleteListAction(id: string, slug: string): Promise<ListMutationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Debes iniciar sesión para continuar." }
  }

  const services = new ListServices(supabase)

  try {
    await services.deleteList(id)

    revalidatePath("/mis-listas")
    revalidatePath(`/mis-listas/${slug}`)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar la lista.",
    }
  }
}
