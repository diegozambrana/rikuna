import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role client. Reserved exclusively for ingestion/ routines — never import this
 * from actions/ used by end-user flows or from any client bundle.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
