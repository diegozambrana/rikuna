"use server"

import { revalidatePath } from "next/cache"
import { runAvailabilitySync } from "@/ingestion/availability-sync"
import { createClient } from "@/lib/supabase/server"
import type { SyncAvailabilityBatchInput, SyncAvailabilityBatchResult } from "./types"

const DEFAULT_BATCH_SIZE = 20
const MAX_BATCH_SIZE = 50

/**
 * Processes one batch of titles awaiting a watch-providers lookup.
 *
 * The client calls this repeatedly until `remaining === 0` — that's what makes
 * a real progress bar possible and keeps every request short enough to never
 * approach a function timeout.
 *
 * Same split as syncTmdbBatchAction: the session check happens here with the
 * caller's RLS-scoped client, and only then does it delegate to
 * ingestion/availability-sync, which owns the service-role client.
 */
export async function syncAvailabilityBatchAction(
  input: SyncAvailabilityBatchInput = {}
): Promise<SyncAvailabilityBatchResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para sincronizar la disponibilidad." }
  }

  const batchSize = Math.min(Math.max(input.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE)

  try {
    const batch = await runAvailabilitySync({ limit: batchSize })

    // Only on the last batch: every one of these reads media_availability, and
    // revalidating per batch would throw away the whole route cache dozens of
    // times during a single run. /mis-listas is absent on purpose — it doesn't
    // query availability.
    if (batch.remaining === 0) {
      revalidatePath("/titulo/[slug]", "page")
      revalidatePath("/panel")
      revalidatePath("/recomendaciones")
      revalidatePath("/biblioteca")
      revalidatePath("/sincronizar/disponibilidad")
    }

    return { status: "ok", batch }
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("TMDB credentials")
        ? "Falta configurar TMDB_ACCESS_TOKEN en el entorno del servidor."
        : "No se pudo completar el lote de disponibilidad. Intenta de nuevo."

    return { status: "error", message }
  }
}
