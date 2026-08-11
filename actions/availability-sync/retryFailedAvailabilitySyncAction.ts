"use server"

import { revalidatePath } from "next/cache"
import { resetFailedAvailabilitySync } from "@/ingestion/availability-sync"
import { createClient } from "@/lib/supabase/server"
import type { RetryFailedAvailabilitySyncResult } from "./types"

/**
 * Moves 'failed' rows back to 'pending' so the next run picks them up. Same
 * session-check-then-delegate split as syncAvailabilityBatchAction.
 */
export async function retryFailedAvailabilitySyncAction(): Promise<RetryFailedAvailabilitySyncResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para reintentar la sincronización." }
  }

  try {
    const requeued = await resetFailedAvailabilitySync()
    revalidatePath("/sincronizar/disponibilidad")
    return { status: "ok", requeued }
  } catch {
    return { status: "error", message: "No se pudo reencolar los títulos con error." }
  }
}
