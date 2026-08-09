import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role client. Reserved exclusively for ingestion/ routines — never import this
 * from actions/ used by end-user flows or from any client bundle.
 *
 * Deliberately does NOT `import "server-only"`: ingestion/catalog/run.ts runs as a
 * standalone `tsx` script outside Next's module graph, and that package's guard only
 * resolves via Next's own bundler condition — it throws unconditionally under plain
 * Node, which would break the one real consumer this module has.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
