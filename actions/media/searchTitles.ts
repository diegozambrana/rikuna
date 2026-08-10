"use server"

import { createClient } from "@/lib/supabase/server"
import { MediaServices } from "@/services"
import type { MediaSearchResult } from "@/services"

// Exposed as a Server Function (RIK-10) so the list-detail search-and-add
// control (a client component) can query the catalog directly. media_items
// is publicly readable, so no session check is needed here.
export async function searchTitles(query: string): Promise<MediaSearchResult[]> {
  const supabase = await createClient()
  const services = new MediaServices(supabase)
  return services.searchByTitle(query)
}
