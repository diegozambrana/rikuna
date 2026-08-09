import path from "node:path"
import { loadEnvConfig } from "@next/env"
import { createAdminClient } from "@/lib/supabase/admin"
// Imported from each service's own module, not the "@/services" barrel: the
// barrel also re-exports ImdbImportServices, which carries its own
// `import "server-only"` guard — fine for actions/ running inside Next's
// module graph, but that guard throws unconditionally under this file's
// plain `tsx` execution (see the note in lib/supabase/admin.ts).
import { CatalogSnapshotServices } from "@/services/CatalogSnapshotServices"
import { MediaAvailabilityServices } from "@/services/MediaAvailabilityServices"
import { MediaServices } from "@/services/MediaServices"
import { parseCatalogFile } from "./parseCatalogFile"
import { resolvePlatform } from "./resolvePlatform"

// This script runs outside Next's request/response cycle (no `next dev`/`next
// build` process loading .env.* for it), so it loads the same .env.local /
// .env files Next itself would, using Next's own loader. A no-op when the
// vars are already present in process.env (e.g. injected by a scheduler).
loadEnvConfig(process.cwd())

export type IngestCatalogFileResult = {
  snapshotId: string
  totalItems: number
  expiredCount: number
}

/**
 * Loads one "<platform-slug>_<COUNTRY>.json" availability file into the
 * database: creates a catalog_snapshots run-history row, upserts
 * media_items (stubbing anything unseen) and media_availability for every
 * item, then expires anything previously available in this platform+country
 * that didn't show up in this run. Never deletes rows — see schema doc
 * Section 3.3. Uses the service-role client; not part of the Next.js
 * request/response cycle.
 */
export async function ingestCatalogFile(filePath: string): Promise<IngestCatalogFileResult> {
  const client = createAdminClient()
  const { platformId, country } = await resolvePlatform(filePath, client)
  const file = await parseCatalogFile(filePath)

  const snapshotServices = new CatalogSnapshotServices(client)
  const mediaServices = new MediaServices(client)
  const availabilityServices = new MediaAvailabilityServices(client)

  const snapshot = await snapshotServices.createSnapshot({
    platformId,
    country,
    generatedAt: file.metadata.generated_at,
    sourceFile: path.basename(filePath),
  })

  try {
    for (const item of file.items) {
      const mediaId = await mediaServices.upsertOrCreateStub({
        imdbId: item.imdb_id,
        title: item.title,
        year: item.year,
        // Missing/absent type defaults to "movie" — today's external process
        // only supplies a complete catalog for movies, not series (schema
        // doc Section 11 item 1). Not fixable from this ticket.
        type: item.type ?? "movie",
      })

      await availabilityServices.upsert({
        mediaId,
        platformId,
        country,
        url: item.url ?? null,
        offerType: item.offer_type,
        lastSeenAt: file.metadata.generated_at,
        snapshotId: snapshot.id,
      })
    }

    const expiredCount = await availabilityServices.expireStale({
      platformId,
      country,
      snapshotId: snapshot.id,
    })

    await snapshotServices.markCompleted(snapshot.id, file.items.length)

    return { snapshotId: snapshot.id, totalItems: file.items.length, expiredCount }
  } catch (error) {
    // Never mark 'completed' on a partial run — leave a 'failed' snapshot
    // behind instead so the failure is inspectable, then rethrow.
    await snapshotServices.markFailed(snapshot.id)
    throw error
  }
}

// ---------------------------------------------------------------------------
// CLI entry point — `npm run ingest:catalog -- --file <path>`
// ---------------------------------------------------------------------------

function parseFileArg(argv: string[]): string {
  const flagIndex = argv.indexOf("--file")
  const value = flagIndex !== -1 ? argv[flagIndex + 1] : undefined
  if (!value) {
    throw new Error("Usage: tsx ingestion/catalog/run.ts --file <path>")
  }
  return value
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  const filePath = parseFileArg(process.argv.slice(2))

  ingestCatalogFile(filePath)
    .then((result) => {
      console.log(
        `Ingested ${result.totalItems} item(s) from "${filePath}" — snapshot ${result.snapshotId}, ${result.expiredCount} expired.`
      )
      process.exit(0)
    })
    .catch((error) => {
      console.error("Catalog ingestion failed:", error)
      process.exit(1)
    })
}
