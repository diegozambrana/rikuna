# RIK-3 — Catalog ingestion

| Field | Value |
|---|---|
| Ticket | RIK-3 |
| Completed | 2026-08-09 15:59 (local) |
| Log file | `specs/logs/202608091559_RIK-3_catalog_ingestion.md` |
| Backlog spec | `specs/backlog/RIK-3_catalog_ingestion.md` |
| Status | completed |

## Summary

Delivered the availability-catalog ingestion routine: a standalone script that turns one
platform+country JSON file into database state — a `catalog_snapshots` run-history row,
upserted `media_items` (creating stub rows for unseen titles), and upserted
`media_availability` rows — followed by an expire step that flips `is_available` to false
for anything not present in the current run without deleting history. Runs via
`npm run ingest:catalog -- --file <path>` using the service-role client, entirely outside
the Next.js request/response cycle.

## Scope delivered

- Types: raw file contract (`RawCatalogFile`/`RawCatalogItem`) plus `Platform`,
  `CatalogSnapshot`, `MediaAvailability` domain types.
- Constants: known platform slug → seed data map.
- Services: `CatalogSnapshotServices`, `MediaAvailabilityServices`, `MediaServices`
  (upsert-or-stub), all service-role-client-driven.
- Ingestion: filename-based platform/country resolution, strict file parsing/validation,
  and the `ingestCatalogFile` orchestration (upsert loop + expire + snapshot finalize).
- Config: `tsx` + `ingest:catalog` npm script; fixed a pre-existing standalone-script
  incompatibility in `lib/supabase/admin.ts` (see Decisions).
- Fixtures: three JSON files proving expiry, idempotency, and multi-platform stub creation.

## Files changed

### Created

- `ingestion/catalog/types.ts` — raw file contract (inferred default; no real sample shipped with this ticket).
- `ingestion/catalog/__fixtures__/before/apple-tv-plus_BO.json` — 3-item baseline fixture.
- `ingestion/catalog/__fixtures__/after/apple-tv-plus_BO.json` — same platform+country, one title removed, later `generated_at`, to prove expiry.
- `ingestion/catalog/__fixtures__/netflix_BO.json` — separate platform, shares one `imdb_id` with the apple-tv-plus fixtures, to prove cross-file media reuse and stub creation.
- `constants/platforms.ts` — known platform slug → `{ name, providerIdMovie?, providerIdTv? }` seed map.
- `services/CatalogSnapshotServices/index.ts` — create / markCompleted / markFailed.
- `services/MediaAvailabilityServices/index.ts` — `upsert` (onConflict `media_id,platform_id,country,offer_type`) and `expireStale` (Section 3.3 step 3, "is distinct from" semantics preserved).
- `services/MediaServices/index.ts` — `upsertOrCreateStub`, keyed by `imdb_id`, using `lib/slug.ts`'s existing `slugify`/`withSlugRetry`.
- `ingestion/catalog/resolvePlatform.ts` — parses `<platform-slug>_<COUNTRY>.json`, finds-or-creates the `platforms` row from `constants/platforms.ts`.
- `ingestion/catalog/parseCatalogFile.ts` — reads + validates the raw file, fails loudly on malformation.
- `ingestion/catalog/run.ts` — `ingestCatalogFile()` orchestration + CLI entry point (`--file <path>`).

### Modified

- `types/index.ts` — added `Platform`, `CatalogSnapshot`, `MediaAvailability` (+ their enum-like literal types).
- `services/index.ts` — exported the three new services.
- `package.json` — added `ingest:catalog` script; added `tsx` (devDependency), `server-only` and `@next/env` (dependencies — see Decisions).
- `lib/supabase/admin.ts` — removed `import "server-only"` (see Decisions); added a comment explaining why.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | `catalog_snapshots` row `3a6b8c2a-af64-469b-9611-8223ddfd7501` (source_file=`netflix_BO.json`, status=completed). Its two items' `media_availability` rows both have `last_snapshot_id = 3a6b8c2a-...` and `last_seen_at = 2026-08-05 00:00:00+00`, matching the fixture's `metadata.generated_at`. |
| AC-2 | PASS | After "before" (tt0068646 present) then "after" (tt0068646 removed): `select is_available, last_snapshot_id from media_availability where media_id = (select id from media_items where imdb_id='tt0068646') and platform_id=(apple-tv-plus id) and country='BO'` → `is_available = f`, row still present (not deleted), `last_snapshot_id` = the last run that actually saw it. |
| AC-3 | PASS | After 3 runs referencing tt0111161 (before, before again, after): `select count(*) from media_availability where media_id=(tt0111161 id) and platform_id=(apple-tv-plus id) and country='BO' and offer_type='subscription'` → `1`. |
| AC-4 | PASS | `npm run ingest:catalog -- --file <fixture>` exited 0 on every run (verified explicitly with `echo "EXIT CODE: $?"`); a malformed-file run exited 1 without creating a snapshot row (fails before snapshot creation) or requiring manual SQL cleanup. |
| AC-5 | PASS | `select is_stub, title, year from media_items where imdb_id='tt4574334'` → `is_stub=t, title='Stranger Things', year=2016` (new title from the netflix fixture, not previously in the catalog). |
| AC-6 | PASS | `catalog_snapshots` rows all end `status='completed'` with `total_items` matching the fixture's item count (3, 3, 2, 2 across the four runs). |

## Decisions

- **`lib/supabase/admin.ts` had `import "server-only"`, which broke the CLI script entirely.** The `server-only` npm package only resolves to a no-op (`empty.js`) under Next's own `react-server` bundler condition; under plain `tsx`/Node execution it unconditionally throws "This module cannot be imported from a Client Component module." Since this ticket's whole point is a standalone script outside Next's module graph, and nothing in the app currently imports `admin.ts` (confirmed via grep — RIK-2 created it but it had no consumer yet), removed the guard and documented why in a comment. The architectural boundary itself (never import from `actions/`/`features/`/client bundles) is unaffected — it was never actually enforced by this guard anyway, since `actions/` code also runs server-side.
- **The three new services also dropped `import "server-only"`** for the same reason — they exist exclusively to be called by `ingestion/catalog/run.ts`. `ingestion/imdb-import/`'s existing services (`ImdbImportServices`) keep their guard since that module is a real Next request/response consumer (called from a Server Action), unaffected by this ticket.
- **`ingestion/catalog/run.ts` imports each service from its own module path, not the `@/services` barrel** — the barrel also re-exports `ImdbImportServices`, which still carries `import "server-only"`; importing the barrel would pull that guard's throw into the CLI script's module graph.
- **Added `@next/env` as an explicit dependency** (pinned to `next`'s installed version, `16.3.0`) and call `loadEnvConfig(process.cwd())` at the top of `run.ts`. A standalone `tsx` script has no `.env.local`/`.env` auto-loading the way `next dev`/`next build` do; `@next/env` is Next's own loader (already a transitive dependency of `next`), so this replicates the same `.env.local` → `.env` priority without a new third-party dependency or hand-rolled dotenv parsing. No-ops safely when the vars are already in `process.env` (e.g. injected by a future scheduler).
- **Fixture layout**: `before/apple-tv-plus_BO.json` and `after/apple-tv-plus_BO.json` share the exact same basename, in separate directories — `resolvePlatform.ts` only reads the basename, so this actually mirrors production: the external process regenerates the same filename each period, and `source_file` in `catalog_snapshots` naturally repeats across runs (disambiguated by `created_at`, not by a unique filename).
- **`type` defaults to `"movie"`** when a raw item omits it, per the ground-truth note on incomplete series coverage (schema doc Section 11 item 1) — not fixed here, out of scope.
- **`offer_type` is only passed through when the raw file provides it**; otherwise omitted from the upsert payload so the column's own `default 'subscription'` applies.
- **Node version**: this machine's active Node (via nvm) is 20.19.1, but `@supabase/supabase-js`'s Realtime client requires native `WebSocket` (Node 22+) even when Realtime is unused — the client constructor throws otherwise. Verification runs used the Homebrew-installed Node 24.1.0 binary directly (`/opt/homebrew/opt/node/bin/node`) without changing the project's active Node version or configuration. This is a pre-existing constraint from `@supabase/supabase-js`/`@supabase/storage-js`'s own `engines` field (visible as an `npm install` warning before this ticket), not something introduced here.

## Deferred / follow-ups

- Stub enrichment (poster/synopsis/cast) for `is_stub=true` titles — separate future process, per spec.
- Series catalog completeness — known external-process gap, not fixable from this ticket.
- Scheduling/cron automation of the routine — this ticket only delivers an on-demand script.
- No real sample file from the external process was available; `RawCatalogFile`/`RawCatalogItem` in `ingestion/catalog/types.ts` is this spec's inferred default and should be revisited against a real sample when the external process is integrated.

## Verification

- `npm run lint` — clean, no errors.
- `npx tsc --noEmit` — clean, no errors.
- `npm run ingest:catalog -- --file ingestion/catalog/__fixtures__/before/apple-tv-plus_BO.json` — run twice (idempotency).
- `npm run ingest:catalog -- --file ingestion/catalog/__fixtures__/after/apple-tv-plus_BO.json` — run once (expiry).
- `npm run ingest:catalog -- --file ingestion/catalog/__fixtures__/netflix_BO.json` — run once (multi-platform + stub creation).
- A malformed fixture (missing `imdb_id`) run to confirm it fails loudly (exit 1) without creating a snapshot row.
- Direct `psql` queries against the local Supabase Postgres instance for every AC (see table above).

## Manual validation

See the `manual_validation` deliverable in the pull request / ticket comment for the full copy-paste guide (prerequisites, exact commands, and read-only SQL checks per acceptance criterion).
