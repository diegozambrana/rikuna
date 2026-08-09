"use server"

import { createClient } from "@/lib/supabase/server"
import { ImdbImportServices } from "@/services"
import type { ImdbImportBatch } from "@/types"

export async function getImportBatches(): Promise<ImdbImportBatch[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const services = new ImdbImportServices(supabase)
  return services.listBatchesForUser(user.id)
}
