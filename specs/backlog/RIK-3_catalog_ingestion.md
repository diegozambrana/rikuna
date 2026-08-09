# RIK-3 — Ingesta del catálogo de disponibilidad

## Ticket summary

A server-only routine that turns the external process's periodic platform+country catalog files into live `media_availability` rows, so the rest of the app (panel, recommendations, title pages) can trust "is this available right now" instead of a stale static list. Every file load creates a `catalog_snapshots` row, upserts a stub `media_items` row for anything not already in the catalog, upserts `media_availability` as available, and then expires (never deletes) anything that dropped out of that platform+country's latest snapshot.

- Loading one example file for a platform/country creates its `catalog_snapshots` row and populates `media_availability` with correct `last_seen_at` / `last_snapshot_id`.
- A title present in the previous snapshot but absent from the new one ends up `is_available = false`, row preserved (not deleted).
- Loading the same file twice is idempotent — no duplicate `media_availability` rows, enforced via the existing `unique (media_id, platform_id, country, offer_type)` constraint.
- The routine must be runnable repeatably (script/command) with no manual database intervention.
- No UI, no `app/` routes, no `features/` slice — this is a backend routine only.

This ticket depends on **RIK-1** (schema + RLS, not yet landed at spec time — see `Decisions made`). The raw external-process JSON shape is not documented anywhere in `specs/`; this document infers a reasonable default and flags it as the main open question.

---

## Context

### Original ticket

**RIK-3 — Ingesta del catálogo de disponibilidad**

**Descripción:** Rutina en `ingestion/` (server-only, cliente admin de Supabase) que procesa los archivos por plataforma/país del proceso externo: crea un `catalog_snapshots`, hace upsert de cada título en `media_items` (creando stub si no existe) y en `media_availability` (`is_available = true`, `last_snapshot_id`), y al final marca `is_available = false` en todo lo que quedó fuera del snapshot recién procesado, según la lógica de la Sección 3.3 del esquema.

**Criterios de aceptación:**
- Cargar un archivo de ejemplo de una plataforma/país crea el `catalog_snapshots` correspondiente y puebla `media_availability` con `last_seen_at`/`last_snapshot_id` correctos.
- Un título que existía en el snapshot anterior pero no en el nuevo queda con `is_available = false` tras la carga, sin borrarse la fila.
- Cargar el mismo archivo dos veces es idempotente: no se duplican filas de `media_availability` (respeta el `unique (media_id, platform_id, country, offer_type)`).
- La rutina puede correrse de forma repetible (script o comando) sin intervención manual en base de datos.

**Note:** This ticket targets tables (`catalog_snapshots`, `media_availability`, `media_items`, `platforms`) that only exist on paper today — `supabase/migrations/` does not exist in the repo yet. Everything below assumes **RIK-1** has landed by the time this ticket is implemented; the coding agent must re-verify column names/types/defaults against the real migration file before writing any query (see `Decisions made` #1 and `<ground_truth_db_notes>` in the prompt).

### Team comments

No team comments exist for this ticket — it was pasted directly from the tracker with description and acceptance criteria only. Per the sibling backlog list supplied with this run, the dependency chain is: RIK-3 depends on RIK-1; RIK-4/5/6/7/8/9 depend (directly or transitively) on RIK-3 for real availability data. No comment redirects scope; the description is the full authoritative source.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| "crea un `catalog_snapshots`... upsert en `media_items`... `media_availability`" | None of these tables exist yet — `supabase/` directory does not exist at all (confirmed: `ls supabase` fails). | Hard dependency on RIK-1 landing first. This ticket cannot be executed (only specced) until RIK-1's migration exists. |
| "cliente admin de Supabase" | `lib/supabase/admin.ts` does not exist yet. Per `ARCHITECTURE.md`, it is introduced by **RIK-2** but RIK-3 is its first real consumer. `@supabase/supabase-js` / `@supabase/ssr` are not in `package.json` yet either. | Implementer must check whether RIK-2 already added `admin.ts` before creating it, to avoid a duplicate/conflicting file. |
| "según la lógica de la Sección 3.3 del esquema" | Section 3.3 exists verbatim in `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` (lines 145–184), including the literal expire SQL. | No re-derivation needed — the prompt points the agent directly at it. |
| Ticket gives no file format for the external process's JSON | Not documented anywhere in `specs/`. Only inferable fragments exist: `platforms.provider_id_movie` / `provider_id_tv` (schema doc line 122–123), `catalog_snapshots.generated_at` comment "`metadata.generated_at` del archivo" (line 135), `catalog_snapshots.source_file` example `"apple-tv-plus_BO.json"` (line 136), and `constants/platforms.ts` description in `ARCHITECTURE.md` ("used when mapping incoming catalog files to platforms rows"). | This is the ticket's biggest open question. Resolved as a non-blocking default below (see `Decisions made` #2–#4) since real sample files were not provided with this run. |
| Ticket implies a routine that "just runs" | `ingestion/` folder does not exist; no script runner (`tsx`/`ts-node`) is configured in `package.json`; no `npm run` entry point exists for anything ingestion-shaped. | This ticket must also stand up the minimal script-running mechanism (AC "puede correrse de forma repetible... sin intervención manual"), not just the ingestion logic itself. |

### Current database state

No tables exist yet (`supabase/migrations/` absent). The tables this ticket writes to are defined only in `specs/RIKUNA-PRD-schema-basedatos-rikuna.md`, Sections 2.1, 3.1–3.3 (verbatim below, so the coding agent does not need to re-derive them — but **must** re-verify against the real RIK-1 migration file once it exists, since a migration can drift from the PRD doc during RIK-1's own implementation):

```sql
-- media_items (Section 2.1) — relevant columns for this ticket
imdb_id         varchar not null,          -- unique
type            varchar not null,          -- 'movie' | 'tv'
title_type      varchar,
title           varchar not null,
slug            varchar not null,          -- unique, no documented generation rule anywhere
year            integer,
is_stub         boolean default false not null,
metadata        jsonb default '{}'::jsonb not null,
constraint media_items_imdb_id_uq unique (imdb_id),
constraint media_items_slug_uq unique (slug)

-- platforms (Section 3.1)
id                uuid,
name              varchar not null,
slug              varchar not null unique,   -- "apple-tv-plus"
provider_id_movie integer,
provider_id_tv    integer

-- catalog_snapshots (Section 3.2)
id           uuid,
platform_id  uuid not null references platforms(id),
country      varchar(2) not null,
generated_at timestamptz not null,          -- metadata.generated_at del archivo
source_file  varchar,                       -- "apple-tv-plus_BO.json"
total_items  integer default 0 not null,
status       varchar default 'pending' not null  -- 'pending' | 'completed' | 'failed'

-- media_availability (Section 3.3)
id               uuid,
media_id         uuid not null references media_items(id),
platform_id      uuid not null references platforms(id),
country          varchar(2) not null,
url              text,
offer_type       varchar default 'subscription' not null,  -- 'subscription' | 'rent' | 'buy'
is_available     boolean default true not null,
first_seen_at    timestamptz default now() not null,
last_seen_at     timestamptz default now() not null,
last_snapshot_id uuid references catalog_snapshots(id),
constraint media_availability_uq unique (media_id, platform_id, country, offer_type)
```

RLS (Section 9): `media_items`, `platforms`, `media_availability`, `catalog_snapshots` are public-read, **service-role-only write** — exactly why this routine must run through `lib/supabase/admin.ts` and never through a user-session client.

**Code usage:** none yet — no `services/`, no `types/` barrel exist. This ticket is the first thing that reads/writes these four tables from application code.

### Current logic (ingestion)

`ingestion/` does not exist. `ARCHITECTURE.md` (lines 124–131) states the intended shape but no implementation exists:

> "**Availability snapshots** (`ingestion/catalog/`) — consumes the periodic JSON produced by the external platform+country process. Creates a `catalog_snapshots` row, upserts `media_items` (by `imdb_id`) and `media_availability`, then expires anything not seen in that snapshot. Runs on a schedule, using the `admin.ts` service-role client (no end-user session involved)."

The exact upsert + expire step is given verbatim in the schema doc, `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` lines 170–184:

```
1. Se crea un catalog_snapshots con los datos de metadata del archivo.
2. Por cada título del catálogo crudo: upsert en media_items por imdb_id, y upsert en
   media_availability con is_available = true, last_seen_at = generated_at y
   last_snapshot_id = <snapshot actual>.
3. Al terminar, todo lo que en esa plataforma+país tenga un last_snapshot_id distinto
   al snapshot recién procesado se marca is_available = false.
```

```sql
-- Paso 3: marcar como no disponible lo que ya no apareció
update public.media_availability
set is_available = false
where platform_id = :platform_id
  and country     = :country
  and (last_snapshot_id is distinct from :snapshot_id)
  and is_available;
```

Note the `is distinct from` semantics: this also expires rows whose `last_snapshot_id` is `null` (should not occur after this ticket ships, but any Supabase-JS translation of this filter must preserve that behavior, not just `neq`, which silently excludes `null` rows in Postgres).

### Requested field mapping

| Field requested | Type | Existing equivalent | Action |
| --- | --- | --- | --- |
| `catalog_snapshots` row per file load | table | Defined in schema doc Section 3.2, not yet migrated | Reuse once RIK-1 lands — do not add columns |
| `media_items` upsert by `imdb_id`, stub if missing | table + `is_stub` flag | Defined in schema doc Section 2.1 | Reuse; stub creation mirrors the pattern already documented for IMDb import (Section 7.3) |
| `media_availability` upsert, `is_available=true`, `last_snapshot_id` | table | Defined in schema doc Section 3.3 | Reuse verbatim; upsert key is the existing `unique (media_id, platform_id, country, offer_type)` |
| Expire step at end of load | SQL | Given verbatim in Section 3.3 | Reuse verbatim (or an equivalent Supabase-JS filter preserving `is distinct from` semantics) |
| Raw file "platform/country" identity | not specified by ticket | `catalog_snapshots.source_file` example `"apple-tv-plus_BO.json"`, `platforms.slug` | **Must be created**: a filename convention (`<platform-slug>_<COUNTRY>.json`) plus a lookup/create-if-missing against `platforms.slug` |
| Raw file item shape (`imdb_id`, `title`, `year`, `url`, `offer_type`) | not specified by ticket | Nothing existing | **Must be created**: inferred JSON contract, documented in `ingestion/catalog/types.ts`, flagged as an assumption |
| `media_items.slug` generation for stubs | not specified by ticket or schema doc anywhere | Nothing existing | **Must be created**: small shared slug helper (kebab-case title + year, collision-safe) |

### Impacted files

**ingestion** (new)
- `ingestion/catalog/types.ts` — raw file/item TypeScript contract (the inferred input shape)
- `ingestion/catalog/parseCatalogFile.ts` — reads + validates one JSON file against the contract
- `ingestion/catalog/resolvePlatform.ts` — derives `{ slug, country }` from the filename, finds-or-creates the `platforms` row
- `ingestion/catalog/run.ts` — orchestrator implementing the 3-step algorithm + CLI entry point
- `ingestion/catalog/__fixtures__/*.json` — example files used to exercise all four acceptance criteria manually (see `manual_validation`)

**lib** (new, unless RIK-2 already delivered `admin.ts`)
- `lib/supabase/admin.ts` — service-role Supabase client, server-only
- `lib/slug.ts` — shared slug generator (kebab-case + collision suffix), reusable by RIK-4 later

**constants** (new)
- `constants/platforms.ts` — known platform slug → display name / provider id map, used as the seed source when `resolvePlatform` needs to create a missing `platforms` row

**types** (new, or extended if a sibling ticket created the barrel first)
- `types/MediaItem.ts`, `types/Platform.ts`, `types/CatalogSnapshot.ts`, `types/MediaAvailability.ts`
- `types/index.ts` — barrel export

**services** (new, or extended)
- `services/CatalogSnapshotServices/index.ts` — create snapshot row, mark completed/failed
- `services/MediaServices/index.ts` — upsert-or-create-stub by `imdb_id`
- `services/MediaAvailabilityServices/index.ts` — upsert availability, expire stale rows
- `services/index.ts` — barrel export

**config**
- `package.json` — add `tsx` (devDependency, script runner), add `@supabase/supabase-js` (if RIK-2 hasn't already), add `"ingest:catalog"` script

**docs (always, per workflow)**
- `CHANGELOG.md` — one bullet under `[Unreleased]`
- `specs/logs/<timestamp>_RIK-3_catalog_ingestion.md` — work log

### Decisions made

1. **RIK-1 dependency treated as landed-by-execution-time.** This spec is written against the schema doc's Section 2.1/3.1–3.3 DDL as current truth. Recommended default: proceed with this spec now; the coding agent re-verifies the real migration file before writing queries. *Unconfirmed — depends on RIK-1's actual implementation.*
2. **Raw file shape (inferred).** A JSON envelope per platform+country file: `{ "metadata": { "generated_at": "<ISO8601>" }, "items": [ { "imdb_id": "tt...", "title": "...", "year": 2024, "url"?: "...", "offer_type"?: "subscription"|"rent"|"buy", "type"?: "movie"|"tv" } ] }`. Recommended default, since no real sample file shipped with this ticket. *Unconfirmed — must be validated against the actual file the external process produces before the first real load.*
3. **Platform + country identity comes from the filename**, not the JSON body: `<platform-slug>_<COUNTRY>.json` (matches the schema doc's own `source_file` example `"apple-tv-plus_BO.json"`). Recommended default — keeps the contract minimal and matches the one concrete example the PRD gives. *Unconfirmed.*
4. **Missing per-item `type` defaults to `'movie'`.** Per schema doc Section 11 item 1 / product spec Section 13, the real external process today only reliably delivers a full **movie** catalog; series coverage is a known, separately-tracked gap. Recommended default so the routine doesn't hard-fail on today's real files. *Unconfirmed, and explicitly not a fix for the series gap — see Out of scope.*
5. **`media_items.slug` generation**: kebab-case(`title`) + `-` + `year` (when present), with a short `imdb_id`-derived suffix appended only on a uniqueness collision. Implemented once as `lib/slug.ts` since RIK-4 (IMDb import) will face the exact same unresolved gap. Recommended default — no documented algorithm exists anywhere in `specs/`. *Unconfirmed.*
6. **`platforms` row is find-or-create, not assumed pre-seeded.** RIK-1's ticket text does not mention seeding `platforms` with real rows (Netflix, Apple TV+, etc.), so this routine looks up by `slug` and creates the row from `constants/platforms.ts` if missing, instead of failing on a brand-new platform. Recommended default. *Unconfirmed.*
7. **Script runner**: add `tsx` as a devDependency and an `"ingest:catalog": "tsx ingestion/catalog/run.ts"` npm script, invoked as `npm run ingest:catalog -- --file <path>`, to satisfy "repeatable, no manual DB intervention" without inventing a Next.js API route for something explicitly documented as outside the request/response cycle. Recommended default. *Unconfirmed.*
8. **No automated test framework added.** Repo has no `vitest`/`jest` configured. Verification for this ticket relies on fixture files + manual SQL (see `manual_validation`), not a new test suite. Recommended default, consistent with `analyze-ticket.md`'s "if no test suite exists yet, note that" guidance. *Unconfirmed.*

### Out of scope

- **Series catalog completeness** — the external process only delivers derived lists for series today, not a full catalog (schema doc Section 11 item 1; product spec Section 13). This ticket does not fix that upstream gap; it only avoids hard-failing on it via the `type` default in Decision 4.
- **Stub enrichment** (poster, synopsis, cast for `is_stub = true` titles) — separate future process (schema doc Section 11 item 3).
- **Scheduling/automation** of the ingestion run (cron, Vercel Cron, GitHub Action) — this ticket only delivers a script that can be run repeatably on demand; wiring it to a schedule is separate.
- **Deep-link URL resolution** beyond whatever `url` the raw file already provides (schema doc Section 11 item 2).
- **`offer_type` differentiation logic** beyond passing through what the file provides / relying on the column default (schema doc Section 11 item 5, still marked pending in the PRD).
- **Any UI or `app/` route** to trigger or monitor runs — ticket is explicit this is non-UI.
- **Adding a general test framework** (vitest/jest) to the repo — separate concern.
- **`/importar/[batchId]`-style run history UI** — that pattern is for `imdb_import_batches` (RIK-4/RIK-5), not this ticket's `catalog_snapshots`.

---

## Implementation plan

**Goal:** stand up `ingestion/catalog/` as a repeatable, service-role-only routine that turns one external-process JSON file into snapshot + availability rows per the exact algorithm in schema doc Section 3.3, laying the types/services groundwork (`lib/supabase/admin.ts`, `types/`, `services/`) that RIK-4 through RIK-9 will also depend on.

**In scope:**
1. `lib/supabase/admin.ts` — service-role client (skip if RIK-2 already added it; verify first).
2. `constants/platforms.ts` — known platform slug/name/provider-id map.
3. `lib/slug.ts` — shared slug generator for stub `media_items`.
4. `types/MediaItem.ts`, `types/Platform.ts`, `types/CatalogSnapshot.ts`, `types/MediaAvailability.ts` + barrel — only what's missing.
5. `services/CatalogSnapshotServices`, `services/MediaServices` (upsert-or-stub), `services/MediaAvailabilityServices` (upsert + expire, Section 3.3 semantics preserved exactly).
6. `ingestion/catalog/types.ts`, `parseCatalogFile.ts`, `resolvePlatform.ts`, `run.ts` implementing the 3-step algorithm end to end.
7. Example fixture files (`__fixtures__/`) covering: a first load, a second load of the same file (idempotency), and a second load with one title removed (expiry).
8. `package.json`: `tsx` devDependency, `"ingest:catalog"` script.

**Out of scope:** see above — series completeness, stub enrichment, scheduling, deep links, offer_type policy, UI, test framework.

**Key risks / compatibility:**
- Writing to `media_items` / `platforms` / `catalog_snapshots` / `media_availability` **must** go through `lib/supabase/admin.ts` — these tables are service-role-write-only under RLS (schema doc Section 9). Any accidental use of the anon/session client will silently fail all writes once RLS is enabled.
- The expire step's `is distinct from` semantics must survive translation to Supabase-JS (or be executed as raw SQL) — a naive `.neq()` filter would incorrectly skip rows with a `null` `last_snapshot_id`.
- `media_items.slug` and `type` are `not null` with no documented derivation rule; the stub-creation path must never violate those constraints, or the whole item is silently dropped instead of ingested.
- Nothing in this ticket may edit an existing migration — if RIK-1's actual migration is missing something this spec assumed, that's a stop-and-flag situation, not a schema edit.

**Acceptance criteria mapping:**

| AC | Satisfied by |
| --- | --- |
| AC-1 | `run.ts` creates the `catalog_snapshots` row first, then upserts `media_availability` with `last_seen_at`/`last_snapshot_id` from that snapshot |
| AC-2 | Expire step (Section 3.3 step 3) run at the end of every load, scoped to `platform_id` + `country` |
| AC-3 | Upsert on the existing `media_availability_uq` constraint, not insert-then-check |
| AC-4 | `npm run ingest:catalog -- --file <path>` via the new `tsx` script, no manual SQL between runs |
| AC-5 | `MediaServices` upsert-or-stub path creates `is_stub = true` rows for unseen `imdb_id`s |
| AC-6 | `CatalogSnapshotServices` sets `status = 'completed'` + `total_items` only after the full run succeeds |

---

## Claude Code prompt

```xml
<task id="RIK-3" title="Ingesta del catálogo de disponibilidad" depends_on="RIK-1">
  <role>
    You are a senior full-stack engineer on Rikuna (Next.js 16 App Router + Supabase). This task is a
    server-only ingestion routine, not a UI feature — there is no app/ route and no features/ slice involved.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — read the "Catalog Ingestion" section (ingestion/catalog/, lib/supabase/admin.ts boundary), the "Services" and "Types" sections, and the layered/feature-sliced conventions before writing any file.</item>
    <item>AGENTS.md — this project uses a Next.js version with breaking changes vs. your training data. Read the relevant guide under node_modules/next/dist/docs/ (resolved relative to AGENTS.md's own directory) before touching anything Next.js-related. This ticket has minimal Next.js surface (no routes), but read it anyway since it governs the whole repo.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping needed for the commit_message deliverable below.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — read Section 2.1 (media_items), Section 3.1-3.3 (platforms, catalog_snapshots, media_availability, and the exact upsert+expire algorithm with its literal SQL), and Section 11 (open product pendings, notably item 1 on incomplete series coverage). This is the canonical source for every column name/type/default used below.</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — Section 13 (Riesgos, Dudas y Decisiones Pendientes) for the same series-catalog-completeness caveat from the product side.</item>
    <item>supabase/migrations/ — read the actual, most recent migration file(s) that create media_items, platforms, catalog_snapshots and media_availability. This spec was written before RIK-1 landed; the applied migration is ground truth if anything differs from the schema doc excerpts in this prompt.</item>
    <item>lib/utils.ts — the only file in lib/ today (shadcn's cn helper); confirms lib/supabase/ does not exist yet unless a prior ticket (RIK-2) already created it — check before creating lib/supabase/admin.ts.</item>
    <item>package.json — confirm current dependencies before adding tsx / @supabase/supabase-js, to avoid duplicating something RIK-1/RIK-2 already added.</item>
    <item>CHANGELOG.md — format and where to append the entry for this ticket.</item>
    <item>specs/logs/README.md — work log filename convention and required template.</item>
  </mandatory_reading>

  <context>
    Rikuna cross-references a user's IMDb history against what is currently available on their active
    streaming subscription. Availability data comes from an external process that periodically produces
    one JSON file per platform+country (e.g. conceptually "apple-tv-plus_BO.json"). This task builds the
    routine that turns one such file into database state: a run-history row in catalog_snapshots, upserted
    media_items (creating incomplete "stub" rows for anything not already in the catalog), and upserted
    media_availability rows marked available — followed by an expire step that flips is_available to false
    for anything that was available before but did not appear in this run's file, WITHOUT deleting the row
    (history must be preserved so future re-appearance is just another upsert).

    This routine is one of exactly two ingestion paths in the app (the other is the user-triggered IMDb CSV
    import under ingestion/imdb-import/, out of scope here). It is explicitly NOT part of the normal
    request/response cycle — it runs as a standalone script using the Supabase service-role client, never
    the per-request session client, because media_items/platforms/catalog_snapshots/media_availability are
    public-read but service-role-write-only under Row Level Security.

    No real sample file shipped with this ticket. The raw JSON contract below is this spec's inferred
    default — treat it as the working assumption, document it clearly in code, and do not block on it.
  </context>

  <ground_truth_db_notes critical="true">
    <note>supabase/migrations/ does not exist in the repo at spec-writing time — this ticket depends on RIK-1, which creates it. Before writing any query, read the REAL migration file for the true column list/types/defaults on media_items, platforms, catalog_snapshots, media_availability. The DDL quoted in this prompt is copied from specs/RIKUNA-PRD-schema-basedatos-rikuna.md and may have drifted during RIK-1's own implementation.</note>
    <note>media_items.slug is `not null` and `unique` (constraint media_items_slug_uq). No slug-generation algorithm is documented anywhere in specs/. Implement one shared helper (recommended: lib/slug.ts, kebab-case(title) + "-" + year when present, with a short imdb_id-derived suffix appended only on a uniqueness collision) — do not skip slug when creating a stub, the insert will fail the constraint otherwise.</note>
    <note>media_items.type is `not null` ('movie' | 'tv'). The inferred raw file contract makes a per-item type field optional. Default missing/absent type to 'movie': today's real external process reliably supplies a movie catalog but only derived (incomplete) lists for series, per schema doc Section 11 item 1 and product spec Section 13. Do not attempt to "fix" series coverage in this ticket.</note>
    <note>media_availability.offer_type defaults to 'subscription' at the column level (`default 'subscription' not null`) — do not force every ingested item to pass offer_type explicitly; only set it when the raw file actually provides one, and let the DB default apply otherwise.</note>
    <note>catalog_snapshots.status starts 'pending' (`default 'pending' not null`). Only set it to 'completed' after the ENTIRE run (upsert loop + expire step) succeeds; on any unhandled error, leave it as 'pending' or explicitly set 'failed' — never mark 'completed' on a partial run.</note>
    <note>media_availability_uq is `unique (media_id, platform_id, country, offer_type)` — this is the upsert conflict target for step 2 of the algorithm. Do not implement idempotency via a manual "select then insert/update" — use a real upsert (Supabase-JS `.upsert(..., { onConflict: 'media_id,platform_id,country,offer_type' })` or equivalent) so a second load of the identical file cannot create a duplicate row.</note>
    <note>The expire step (schema doc Section 3.3, step 3) uses `last_snapshot_id is distinct from :snapshot_id`, which ALSO matches rows where last_snapshot_id is null. A naive Supabase-JS `.neq('last_snapshot_id', snapshotId)` silently excludes null rows in Postgres and is NOT equivalent — preserve the "is distinct from" semantics exactly (e.g. `.or('last_snapshot_id.is.null,last_snapshot_id.neq.' + snapshotId)`, or execute the literal SQL from the schema doc via a Postgres function/RPC).</note>
    <note>lib/supabase/admin.ts does not exist yet. Per ARCHITECTURE.md it is introduced by RIK-2 (auth/routing ticket) but this ticket is its first real consumer. CHECK whether RIK-2 has already landed it before creating one — do not create a second, conflicting service-role client. If it doesn't exist, create the minimal version yourself: a service-role client factory using @supabase/supabase-js's createClient (NOT @supabase/ssr's cookie-bound client) with SUPABASE_SERVICE_ROLE_KEY, server-only.</note>
    <note>Never import lib/supabase/admin.ts from actions/, features/, or any client bundle — it is reserved exclusively for ingestion/ routines (ARCHITECTURE.md, "Conventions worth preserving").</note>
    <note>@supabase/supabase-js and @supabase/ssr are not yet in package.json. Add @supabase/supabase-js if it's still missing when you start (admin.ts needs the plain client, not the ssr cookie-bound one). Check package.json first — RIK-1/RIK-2 may have already added it.</note>
    <note>No script runner (tsx/ts-node) is configured in package.json. Ingestion is explicitly documented as outside the Next.js request/response cycle (ARCHITECTURE.md) — do not build a Next.js API route for this. Add tsx as a devDependency and an npm script instead.</note>
    <note>constants/platforms.ts does not exist yet (ARCHITECTURE.md references it as the future map of "known platform slugs/provider ids, used when mapping incoming catalog files to platforms rows") — this ticket creates it.</note>
    <note>Nothing in RIK-1's scope documents seeding the platforms table with real rows. Do not assume a platforms row exists for a given slug — find it by slug, and create it from constants/platforms.ts if missing, rather than throwing on a brand-new platform's first file.</note>
    <note>types/ and services/ barrels (types/index.ts, services/index.ts) do not exist yet either. If a sibling ticket created them first, extend — do not overwrite or duplicate existing exports.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="1. Input contract and fixtures">
      <item>Create ingestion/catalog/types.ts defining the raw file contract (this spec's inferred default, document the assumption in a code comment): a top-level object with `metadata: { generated_at: string }` and `items: RawCatalogItem[]`, where RawCatalogItem has `imdb_id: string` (required), `title: string` (required), `year?: number`, `url?: string`, `offer_type?: 'subscription' | 'rent' | 'buy'`, `type?: 'movie' | 'tv'`.</item>
      <item>Create at least three fixture files under ingestion/catalog/__fixtures__/ following the `<platform-slug>_<COUNTRY>.json` naming convention (e.g. a "before" file, an "after" file removing one title present in "before" to prove the expiry criterion, and confirm the "before" file re-run proves idempotency).</item>
    </phase>

    <phase title="2. Shared utilities">
      <item>Create lib/supabase/admin.ts if it does not already exist (check first) — service-role Supabase client using @supabase/supabase-js, reading SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from env, server-only (no "use client").</item>
      <item>Create lib/slug.ts — a pure function `generateSlug(title: string, year?: number, disambiguator?: string): string` producing a kebab-case slug, with the disambiguator appended only when the caller detects a collision (the caller, in services/MediaServices, is responsible for retrying with a disambiguator on a unique-constraint violation).</item>
      <item>Create constants/platforms.ts — a typed map/array of known platform slug → { name, providerIdMovie?, providerIdTv? }, seeded with at least the platforms referenced in your fixtures.</item>
    </phase>

    <phase title="3. Types">
      <item>Create types/MediaItem.ts, types/Platform.ts, types/CatalogSnapshot.ts, types/MediaAvailability.ts (only the ones missing) matching the real migration's columns exactly, and aggregate them in types/index.ts.</item>
    </phase>

    <phase title="4. Services">
      <item>Create services/CatalogSnapshotServices/index.ts: a class taking a SupabaseClient in its constructor, with methods to create a snapshot row (platform_id, country, generated_at, source_file, total_items=0, status='pending'), and to update it to status='completed' (with the final total_items) or status='failed'.</item>
      <item>Create services/MediaServices/index.ts (or extend it if it exists): an upsert-or-create-stub method keyed by imdb_id — look up by imdb_id, return the existing id if found, otherwise insert with is_stub=true, type defaulted per the ground-truth note above, and a slug from lib/slug.ts (retrying once with a disambiguator on a unique violation).</item>
      <item>Create services/MediaAvailabilityServices/index.ts: an upsert method (media_id, platform_id, country, url, offer_type, last_seen_at, last_snapshot_id, is_available=true) using onConflict against the media_availability_uq columns, and an expireStale method implementing schema doc Section 3.3 step 3 exactly (platform_id + country scoped, is distinct from semantics preserved, is_available currently true).</item>
      <item>Export all three from services/index.ts.</item>
    </phase>

    <phase title="5. Ingestion routine">
      <item>Create ingestion/catalog/resolvePlatform.ts: given a file path, parse the `<platform-slug>_<COUNTRY>.json` filename, find the platforms row by slug via the admin client, create it from constants/platforms.ts if missing, and return { platformId, country }.</item>
      <item>Create ingestion/catalog/parseCatalogFile.ts: read + JSON.parse the file, validate it against the RawCatalogFile shape (fail loudly and clearly on a malformed file rather than partially ingesting).</item>
      <item>Create ingestion/catalog/run.ts exporting `ingestCatalogFile(filePath: string): Promise&lt;{ snapshotId: string; totalItems: number; expiredCount: number }&gt;` implementing, in order: (1) resolvePlatform, (2) parseCatalogFile, (3) CatalogSnapshotServices.createSnapshot, (4) for each item: MediaServices upsert-or-stub then MediaAvailabilityServices.upsert with last_snapshot_id = the new snapshot id and last_seen_at = metadata.generated_at, (5) MediaAvailabilityServices.expireStale scoped to this platform+country+snapshot, (6) CatalogSnapshotServices mark completed with the final total_items, catching any error to mark the snapshot failed instead of completed and rethrow.</item>
      <item>Add a CLI entry point at the bottom of run.ts (or a thin wrapper) reading a `--file &lt;path&gt;` argument from process.argv and calling ingestCatalogFile, so it can run standalone via a script command.</item>
    </phase>

    <phase title="6. Script wiring">
      <item>Add tsx to package.json devDependencies.</item>
      <item>Add an "ingest:catalog" script to package.json: "tsx ingestion/catalog/run.ts", usable as `npm run ingest:catalog -- --file &lt;path&gt;`.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Running `npm run ingest:catalog -- --file &lt;fixture&gt;` for one platform/country creates exactly one new catalog_snapshots row (verify via `select * from catalog_snapshots where source_file = '&lt;fixture filename&gt;' order by created_at desc limit 1;`) and every item in the fixture has a matching media_availability row with last_snapshot_id equal to that snapshot's id and last_seen_at equal to the fixture's metadata.generated_at.</criterion>
    <criterion id="AC-2">Running the "before" fixture then the "after" fixture (same platform+country, one title removed) leaves the removed title's media_availability row with is_available = false and the row still present (row count unchanged, not deleted) — verify via `select is_available, last_snapshot_id from media_availability where media_id = (select id from media_items where imdb_id = '&lt;removed imdb_id&gt;') and platform_id = '&lt;id&gt;' and country = '&lt;code&gt;';`.</criterion>
    <criterion id="AC-3">Running the identical fixture file twice results in exactly one media_availability row per (media_id, platform_id, country, offer_type) combination, not two — verify via `select count(*) from media_availability where media_id = '&lt;id&gt;' and platform_id = '&lt;id&gt;' and country = '&lt;code&gt;' and offer_type = 'subscription';` returning 1.</criterion>
    <criterion id="AC-4">`npm run ingest:catalog -- --file &lt;path&gt;` runs start to finish with exit code 0 and requires no manual SQL statement between or during runs.</criterion>
    <criterion id="AC-5">A title present in a fixture's items but not previously in media_items is created with is_stub = true and the fields available in the fixture (title, year, imdb_id) — verify via `select is_stub, title, year from media_items where imdb_id = '&lt;new imdb_id&gt;';`.</criterion>
    <criterion id="AC-6">catalog_snapshots.status ends as 'completed' with total_items equal to the number of items processed from the fixture on a successful run — verify via `select status, total_items from catalog_snapshots where id = '&lt;snapshot id&gt;';`.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create or edit any file under supabase/migrations/ — this ticket assumes RIK-1's tables already exist as-is. If a column this spec assumes is genuinely missing from the real migration, stop and report it instead of altering the schema.</item>
    <item>Do NOT import lib/supabase/admin.ts from actions/, features/, components/, or any client component — it is exclusive to ingestion/.</item>
    <item>Do NOT rename or repurpose media_availability_uq, media_items_imdb_id_uq, or media_items_slug_uq — implement upserts against the existing constraints as-is.</item>
    <item>Do NOT delete rows from media_availability to represent "no longer available" — is_available = false is the only correct representation; deleting destroys the availability history the schema was explicitly designed to preserve.</item>
    <item>Do NOT mark a catalog_snapshots row 'completed' unless the full run (all upserts + the expire step) succeeded.</item>
    <item>Do NOT build any app/ route, features/ slice, or UI for this ticket — it is explicitly a backend-only routine.</item>
    <item>Do NOT add a general test framework (vitest/jest) as part of this ticket.</item>
  </constraints>

  <out_of_scope>
    <item>Fixing series catalog completeness upstream — known external-process gap (schema doc Section 11 item 1, product spec Section 13), not fixable from this ticket.</item>
    <item>Stub enrichment (poster/synopsis/cast) for is_stub = true titles — separate future process.</item>
    <item>Scheduling/cron automation of the routine — this ticket only delivers a script runnable on demand.</item>
    <item>Deep-link URL resolution beyond whatever the raw file's own `url` field provides.</item>
    <item>Any offer_type differentiation policy beyond passing through what the file provides.</item>
    <item>Any UI, admin screen, or run-history display for catalog_snapshots.</item>
  </out_of_scope>

  <implementation_notes>
    <item>ingestion/catalog/run.ts — export `ingestCatalogFile(filePath: string): Promise&lt;{ snapshotId: string; totalItems: number; expiredCount: number }&gt;` as the reusable entry point (so a future scheduler can import it directly instead of shelling out).</item>
    <item>ingestion/catalog/resolvePlatform.ts — export `resolvePlatform(filePath: string, client: SupabaseClient): Promise&lt;{ platformId: string; country: string }&gt;`.</item>
    <item>lib/slug.ts — export `generateSlug(title: string, year?: number, disambiguator?: string): string`.</item>
    <item>services/MediaAvailabilityServices/index.ts — export an `expireStale(params: { platformId: string; country: string; snapshotId: string }): Promise&lt;number&gt;` returning the count of rows flipped, useful for the AC-1/AC-6 verification and for the completion report.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases above, created or extended as needed.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>Persist documentation per &lt;completion_report&gt; &lt;persistence&gt; below: one bullet in CHANGELOG.md under [Unreleased], and one file in specs/logs/.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Exact raw JSON file shape from the external process — no real sample shipped with this ticket. Default: the RawCatalogFile/RawCatalogItem contract in Phase 1 above. Proceed with this default; adjust parseCatalogFile.ts later if a real sample contradicts it.</item>
    <item>Whether RIK-1 has actually landed with the exact DDL quoted in this prompt. Default: assume yes, but re-read the real migration file first per the ground_truth_db_notes and adjust column references if anything drifted.</item>
    <item>Whether lib/supabase/admin.ts already exists from RIK-2. Default: check first; only create it if missing.</item>
    <item>media_items.slug generation algorithm — undocumented anywhere. Default: kebab-case(title) + year + collision suffix, per Phase 2.</item>
    <item>Whether the platforms table is pre-seeded by RIK-1. Default: assume not, and find-or-create by slug from constants/platforms.ts.</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-6): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-3: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-3_catalog_ingestion.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to catalog_ingestion, matching specs/backlog/RIK-3_catalog_ingestion.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-3_catalog_ingestion.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: types / services / ingestion / config), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-3 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the catalog loading routine" instead of naming ingestion/catalog/run.ts, "the availability record" instead of naming media_availability.</item>
      <item>Keep it under 15 lines. State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Omit the "## Screenshots" section entirely — this ticket has no user-visible UI changes.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human (developer or QA) to confirm the work works.</item>
      <item>This ticket is ingestion/business-logic only (no UI, no schema change beyond what RIK-1 already defined) — include "## Prerequisites" (local Supabase running with RIK-1's migration applied, SUPABASE_SERVICE_ROLE_KEY set, the fixture files available) and "## Logic validation": exact `npm run ingest:catalog -- --file &lt;path&gt;` commands to run in sequence (first load, second identical load, "after" load with a title removed), and the SQL queries from AC-1 through AC-6 to confirm each expected outcome, with what each query should return.</item>
      <item>Do NOT include a "## UI validation" section — there is no UI in this ticket.</item>
      <item>End with "## Expected outcome" — 3-6 bullets tying back to AC-1 through AC-6.</item>
      <item>SQL must be read-only verification queries only.</item>
    </deliverable>
  </completion_report>
</task>
```
