"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { runImdbImport } from "@/ingestion/imdb-import"
import type { ImdbCsvSourceType } from "@/types"
import type { ImdbImportActionState } from "./types"

function isImdbCsvSourceType(value: FormDataEntryValue | null): value is ImdbCsvSourceType {
  return value === "ratings" || value === "watchlist"
}

export async function importImdbCsv(
  _prevState: ImdbImportActionState,
  formData: FormData
): Promise<ImdbImportActionState> {
  const file = formData.get("file")
  const sourceType = formData.get("sourceType")

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecciona un archivo CSV para continuar." }
  }
  if (!isImdbCsvSourceType(sourceType)) {
    return { status: "error", message: "Selecciona el tipo de importación." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para importar." }
  }

  let csvText: string
  try {
    csvText = await file.text()
  } catch {
    return { status: "error", message: "No se pudo leer el archivo." }
  }

  try {
    const summary = await runImdbImport(supabase, user.id, sourceType, file.name, csvText)

    revalidatePath("/panel")
    revalidatePath("/biblioteca")
    revalidatePath("/recomendaciones")

    return { status: "success", summary }
  } catch {
    return {
      status: "error",
      message: "No se pudo procesar el CSV. Verifica que sea un export válido de IMDb.",
    }
  }
}
