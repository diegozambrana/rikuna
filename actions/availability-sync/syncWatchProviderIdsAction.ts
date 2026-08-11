"use server"

import { revalidatePath } from "next/cache"
import { syncWatchProviderIds } from "@/ingestion/availability-sync"
import { createClient } from "@/lib/supabase/server"
import type { SyncWatchProviderIdsResult } from "./types"

/**
 * One-off backfill of platforms.provider_id_movie / provider_id_tv from TMDB's
 * provider directory. Informational only — the availability sync matches on
 * normalised names — but its report of unmatched providers is the cheapest way
 * to check the alias table before a full run.
 */
export async function syncWatchProviderIdsAction(): Promise<SyncWatchProviderIdsResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para vincular los proveedores." }
  }

  try {
    const result = await syncWatchProviderIds()
    revalidatePath("/sincronizar/disponibilidad")
    return { status: "ok", result }
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("TMDB credentials")
        ? "Falta configurar TMDB_ACCESS_TOKEN en el entorno del servidor."
        : "No se pudo vincular los proveedores de TMDB. Intenta de nuevo."

    return { status: "error", message }
  }
}
