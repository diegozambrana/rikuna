"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ImdbImportServices } from "@/services"
import type { ImdbImportBatch, ImdbImportRow } from "@/types"

export async function getImportBatchDetail(
  batchId: string
): Promise<{ batch: ImdbImportBatch; rows: ImdbImportRow[] } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const services = new ImdbImportServices(supabase)
  return services.getBatchWithRows(batchId, user.id)
}
