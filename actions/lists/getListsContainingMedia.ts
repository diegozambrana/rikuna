"use server"

import { createClient } from "@/lib/supabase/server"
import { ListServices } from "@/services"
import type { ListWithContainsFlag } from "@/services"

// Read, exposed as a Server Function so client components (AddToListDialog)
// can call it directly — unlike Server Component reads, a client component
// has no other way to reach a service. Returns [] without a session rather
// than throwing, since AddToListDialog only ever renders inside (app).
export async function getListsContainingMediaAction(mediaId: string): Promise<ListWithContainsFlag[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const services = new ListServices(supabase)
  return services.getListsContainingMedia(user.id, mediaId)
}
