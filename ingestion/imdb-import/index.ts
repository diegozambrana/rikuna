import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ImdbImportServices } from "@/services"
import type { ImdbCsvSourceType } from "@/types"
import { parseImdbCsv } from "./parseCsv"
import { processImdbCsvRow } from "./processRow"

export type ImdbImportSummary = {
  batchId: string
  sourceType: ImdbCsvSourceType
  totalRows: number
  matchedRows: number
  createdRows: number
  skippedRows: number
}

/**
 * Synchronous, request-scoped IMDb CSV import — runs entirely inside the
 * calling Server Action's request/response (no background job). Receives the
 * RLS-scoped client and the authenticated user's id; never creates its own
 * client and never imports lib/supabase/admin.ts.
 */
export async function runImdbImport(
  client: SupabaseClient,
  userId: string,
  sourceType: ImdbCsvSourceType,
  fileName: string | null,
  csvText: string
): Promise<ImdbImportSummary> {
  const services = new ImdbImportServices(client)
  const batch = await services.createBatch(userId, sourceType, fileName)

  let rows
  try {
    rows = parseImdbCsv(csvText).rows
  } catch (error) {
    await services.finalizeBatch(
      batch.id,
      { totalRows: 0, matchedRows: 0, createdRows: 0, skippedRows: 0 },
      "failed"
    )
    throw error
  }

  const counts = { totalRows: rows.length, matchedRows: 0, createdRows: 0, skippedRows: 0 }

  try {
    for (const row of rows) {
      const result = await processImdbCsvRow(services, batch.id, userId, sourceType, row)
      if (result === "matched") counts.matchedRows += 1
      else if (result === "created") counts.createdRows += 1
      else counts.skippedRows += 1
    }
  } catch (error) {
    await services.finalizeBatch(batch.id, counts, "failed")
    throw error
  }

  await services.finalizeBatch(batch.id, counts, "completed")

  return { batchId: batch.id, sourceType, ...counts }
}
