"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"
import type { ListFormActionState } from "./types"

export async function createListAction(
  _prevState: ListFormActionState,
  formData: FormData
): Promise<ListFormActionState> {
  const name = formData.get("name")
  const description = formData.get("description")

  if (typeof name !== "string" || name.trim().length === 0) {
    return { status: "error", message: "Ponle un nombre a la lista." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para continuar." }
  }

  const services = new ListServices(supabase)

  try {
    const list = await services.createList(user.id, {
      name: name.trim(),
      description: typeof description === "string" && description.trim().length > 0 ? description.trim() : null,
    })

    revalidatePath("/mis-listas")

    return { status: "success", list }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo crear la lista.",
    }
  }
}
