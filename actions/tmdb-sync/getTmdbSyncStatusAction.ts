"use server"

import { createClient } from "@/lib/supabase/server"
import { TmdbSyncServices } from "@/services"
import type { TmdbSyncStatusResult } from "./types"

/**
 * How many catalog titles are still missing their TMDB data. Read-only, so it
 * runs on the caller's own session — media_items_select is `using (true)`.
 */
export async function getTmdbSyncStatusAction(): Promise<TmdbSyncStatusResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para ver el estado de sincronización." }
  }

  try {
    const counts = await new TmdbSyncServices(supabase).countByStatus()
    return { status: "ok", counts }
  } catch {
    return { status: "error", message: "No se pudo leer el estado del catálogo." }
  }
}
