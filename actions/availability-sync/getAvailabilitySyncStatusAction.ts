"use server"

import { createClient } from "@/lib/supabase/server"
import { AvailabilitySyncServices } from "@/services"
import type { AvailabilitySyncStatusResult } from "./types"

/**
 * How many titles still need an availability pass. Read-only, so it runs on
 * the caller's own session — media_items_select and platforms_select are both
 * `using (true)`.
 */
export async function getAvailabilitySyncStatusAction(): Promise<AvailabilitySyncStatusResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para ver el estado de sincronización." }
  }

  try {
    const services = new AvailabilitySyncServices(supabase)
    const [counts, platforms] = await Promise.all([
      services.countByStatus(),
      services.listPlatforms(),
    ])

    return { status: "ok", counts, platformCount: platforms.length }
  } catch {
    return { status: "error", message: "No se pudo leer el estado de disponibilidad." }
  }
}
