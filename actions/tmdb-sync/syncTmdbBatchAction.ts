"use server"

import { revalidatePath } from "next/cache"
import { runTmdbSync } from "@/ingestion/tmdb-sync"
import { createClient } from "@/lib/supabase/server"
import type { SyncTmdbBatchInput, SyncTmdbBatchResult } from "./types"

const DEFAULT_BATCH_SIZE = 20
const MAX_BATCH_SIZE = 50

/**
 * Processes one batch of pending titles.
 *
 * The client calls this repeatedly until `remaining === 0` — that's what makes
 * a real progress bar possible and keeps every request short enough to never
 * approach a function timeout, which a single "sync all 881 titles" action
 * would blow straight through.
 *
 * Note the split responsibility: the session check happens here, with the
 * caller's RLS-scoped client, and only then does it delegate to
 * ingestion/tmdb-sync, which owns the service-role client. The catalog is
 * global shared data, so the alternative — an RLS UPDATE policy on
 * media_items for `authenticated` — would let any signed-in user rewrite it
 * straight from the browser.
 */
export async function syncTmdbBatchAction(
  input: SyncTmdbBatchInput = {}
): Promise<SyncTmdbBatchResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "Debes iniciar sesión para sincronizar el catálogo." }
  }

  const batchSize = Math.min(Math.max(input.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE)

  try {
    const batch = await runTmdbSync({ limit: batchSize, importBatchId: input.importBatchId })

    // Only on the last batch: these paths render posters and synopses from
    // media_items, and revalidating them once per batch would throw away the
    // whole route cache dozens of times during a single run.
    if (batch.remaining === 0) {
      revalidatePath("/panel")
      revalidatePath("/biblioteca")
      revalidatePath("/recomendaciones")
      revalidatePath("/mis-listas")
      revalidatePath("/sincronizar")
      revalidatePath("/titulo/[slug]", "page")
    }

    return { status: "ok", batch }
  } catch (error) {
    // A missing TMDB key is the one failure worth naming — it's the difference
    // between "retry later" and "nothing will ever work until you configure it".
    const message =
      error instanceof Error && error.message.includes("TMDB credentials")
        ? "Falta configurar TMDB_ACCESS_TOKEN en el entorno del servidor."
        : "No se pudo completar el lote de sincronización. Intenta de nuevo."

    return { status: "error", message }
  }
}
