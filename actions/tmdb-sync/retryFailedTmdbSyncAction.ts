"use server"

import { revalidatePath } from "next/cache"
import { resetFailedTmdbSync } from "@/ingestion/tmdb-sync"
import { createClient } from "@/lib/supabase/server"
import type { RetryFailedTmdbSyncResult } from "./types"

/**
 * Moves 'failed' rows back to 'pending' so the next run picks them up. Same
 * session-check-then-delegate split as syncTmdbBatchAction.
 */
export async function retryFailedTmdbSyncAction(): Promise<RetryFailedTmdbSyncResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para reintentar la sincronización." }
  }

  try {
    const requeued = await resetFailedTmdbSync()
    revalidatePath("/sincronizar")
    return { status: "ok", requeued }
  } catch {
    return { status: "error", message: "No se pudo reencolar los títulos con error." }
  }
}
