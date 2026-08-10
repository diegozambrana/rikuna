"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"
import type { ListFormActionState } from "./types"

// Renames a list (name/description only — slug is immutable after creation,
// per this ticket's clarify_before_coding default). The list's current slug
// is submitted alongside id/name/description so both the grid and the
// list's own detail page can be revalidated.
export async function renameListAction(
  _prevState: ListFormActionState,
  formData: FormData
): Promise<ListFormActionState> {
  const id = formData.get("id")
  const slug = formData.get("slug")
  const name = formData.get("name")
  const description = formData.get("description")

  if (typeof id !== "string" || id.length === 0) {
    return { status: "error", message: "Lista inválida." }
  }
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
    const list = await services.renameList(id, {
      name: name.trim(),
      description: typeof description === "string" && description.trim().length > 0 ? description.trim() : null,
    })

    revalidatePath("/mis-listas")
    if (typeof slug === "string" && slug.length > 0) {
      revalidatePath(`/mis-listas/${slug}`)
    }

    return { status: "success", list }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo renombrar la lista.",
    }
  }
}
