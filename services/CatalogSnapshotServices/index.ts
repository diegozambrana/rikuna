import type { SupabaseClient } from "@supabase/supabase-js"
import type { CatalogSnapshot, CatalogSnapshotStatus } from "@/types"

export type CreateSnapshotInput = {
  platformId: string
  country: string
  generatedAt: string
  sourceFile: string | null
}

export class CatalogSnapshotServices {
  constructor(private readonly client: SupabaseClient) {}

  async createSnapshot(input: CreateSnapshotInput): Promise<CatalogSnapshot> {
    const { data, error } = await this.client
      .from("catalog_snapshots")
      .insert({
        platform_id: input.platformId,
        country: input.country,
        generated_at: input.generatedAt,
        source_file: input.sourceFile,
        total_items: 0,
        status: "pending",
      })
      .select()
      .single()

    if (error) throw error
    return mapSnapshotRow(data)
  }

  /** Only call once the full run (upserts + expire step) has succeeded. */
  async markCompleted(snapshotId: string, totalItems: number): Promise<void> {
    const { error } = await this.client
      .from("catalog_snapshots")
      .update({ status: "completed" satisfies CatalogSnapshotStatus, total_items: totalItems })
      .eq("id", snapshotId)

    if (error) throw error
  }

  async markFailed(snapshotId: string): Promise<void> {
    const { error } = await this.client
      .from("catalog_snapshots")
      .update({ status: "failed" satisfies CatalogSnapshotStatus })
      .eq("id", snapshotId)

    if (error) throw error
  }
}

function mapSnapshotRow(row: Record<string, unknown>): CatalogSnapshot {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    platformId: row.platform_id as string,
    country: row.country as string,
    generatedAt: row.generated_at as string,
    sourceFile: (row.source_file as string | null) ?? null,
    totalItems: row.total_items as number,
    status: row.status as CatalogSnapshotStatus,
  }
}
