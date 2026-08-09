import type { SupabaseClient } from "@supabase/supabase-js"
import { slugify, withSlugRetry } from "@/lib/slug"
import type { MediaType } from "@/types"

export type UpsertOrCreateStubInput = {
  imdbId: string
  title: string
  year?: number
  type: MediaType
}

export class MediaServices {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Looks up media_items by imdb_id; creates a stub row (is_stub=true) when
   * missing. Used by ingestion/catalog/ so a title referenced by an
   * availability file always has somewhere to attach, even before any
   * enrichment process fills in poster/synopsis/cast.
   */
  async upsertOrCreateStub(input: UpsertOrCreateStubInput): Promise<string> {
    const { data: existing, error: selectError } = await this.client
      .from("media_items")
      .select("id")
      .eq("imdb_id", input.imdbId)
      .maybeSingle()

    if (selectError) throw selectError
    if (existing) return (existing as { id: string }).id

    const baseSlug = slugify(input.title, input.year)

    const created = await withSlugRetry(baseSlug, async (slug) => {
      const { data, error } = await this.client
        .from("media_items")
        .insert({
          imdb_id: input.imdbId,
          type: input.type,
          title: input.title,
          slug,
          year: input.year ?? null,
          is_stub: true,
        })
        .select("id")
        .single()

      if (error) throw error
      return data as { id: string }
    })

    return created.id
  }
}
