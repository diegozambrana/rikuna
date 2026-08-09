# RIK-5 — Detalle de importación

## Ticket summary

Gives users full transparency into what happened during an IMDb CSV import: a history list on `/importar` showing every past batch (date, type, summary counts), and a `/importar/[batchId]` detail page listing every row of a chosen batch with its per-title outcome.

- `/importar` lists the signed-in user's previous import batches — date, type (ratings/watchlist), and summary (total/matched/created/skipped) — newest first.
- `/importar/[batchId]` lists every row of that batch (title, IMDb id, result) and is only visible to the batch's owner.
- Rows with result `skipped` must be visually distinguishable (a different badge/color) from `matched`/`created` rows.
- This is a **read-only** ticket layered on `imdb_import_batches` / `imdb_import_rows`, both written by RIK-4's upload flow. RIK-5 does not touch the upload, CSV parsing, or matching logic.
- No team comments exist for this ticket beyond the scope note already folded into the description above (reuse RIK-4's `/importar` container, add the history list underneath it, plus the new detail route).

---

## Context

### Original ticket

**Descripción:** Vista `/importar/[batchId]` e historial de importaciones previas en `/importar`, mostrando fila por fila el resultado de cada lote (título, `imdb_id`, resultado) para dar transparencia total sobre qué pasó con cada título del CSV.

**Criterios de aceptación:**
- `/importar` lista los lotes previos del usuario con fecha, tipo y resumen (total/reconocidos/creados/omitidos), ordenados del más reciente al más antiguo.
- `/importar/[batchId]` muestra todas las filas de `imdb_import_rows` del lote con su resultado, y solo es accesible por el dueño del lote.
- Cada fila con resultado `skipped` es identificable visualmente (color/badge distinto).

The ticket names real tables (`imdb_import_rows`) and a real column (`imdb_id`) correctly at face value, but as of this analysis **none of `supabase/`, `types/`, `services/`, `actions/`, `features/`, `app/(app)/importar/`** exist in the repository yet — this is a from-scratch Next.js 16 scaffold. The ticket must be spec'd against the target schema (`RIKUNA-PRD-schema-basedatos-rikuna.md`) and target architecture (`ARCHITECTURE.md`), not against code that exists today.

### Team comments

One scope note was provided alongside the ticket (not a tracker comment, but treated with the same authority since it is the only clarification available):

> Reuse the batch-listing container already on `/importar` (RIK-4 built the upload UI there; this ticket adds the history list underneath it on the same route) plus the new `/importar/[batchId]` detail route. Cross-check `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Section 2.2 (`/importar/[batchId]`) and `RIKUNA-PRD-documento-especificacion-rikuna.md` Section 7.6 for exact content expectations (title, imdb_id, result columns; back-to-import action).

This is authoritative for scope: **do not rebuild or modify RIK-4's upload/dropzone/processing UI** — only add the history section and the new detail route.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| "Vista `/importar/[batchId]` e historial ... en `/importar`" implies these routes/UI partially exist (RIK-4 built the upload UI) | `app/` currently only has `layout.tsx`, `page.tsx`, `globals.css`, `favicon.ico` — no `app/(app)/importar/` at all. `specs/backlog/RIK-1_database_schema_rls.md` (already written, dependency of this ticket) confirms `supabase/`, `types/`, `services/`, `actions/` are all still empty. RIK-4's own backlog spec does not exist yet either. | This ticket's prompt must be defensive: check at execution time whether RIK-4 has landed (its route file, service, action, types). If yes, extend. If the dependency has not actually landed when this prompt runs, the executing agent must stop and flag it rather than fabricate RIK-4's upload logic (out of scope here). |
| "mostrando fila por fila el resultado de cada lote (título, `imdb_id`, resultado)" | Confirmed real columns on `imdb_import_rows`: `title`, `imdb_id`, `result` (schema doc Section 7.1) — the ticket's field names match the DB exactly, no renaming needed. | Straightforward reuse — no new columns. |
| Ticket doesn't name the summary columns for the `/importar` history list | Real columns on `imdb_import_batches`: `total_rows`, `matched_rows`, `created_rows`, `skipped_rows`, `source_type`, `created_at` (schema doc Section 7.1) | Use these directly; do not recompute counts by aggregating `imdb_import_rows` at read time — RIK-4 is responsible for keeping the batch counters correct. |
| "resultado" values are informally Spanish in the ticket ("reconocido/creado/omitido") and in the PRD vistas doc | The actual stored `result` enum is English: `'matched' | 'created' | 'skipped'` (default `'pending'` before processing finishes), and `source_type` is `'ratings' | 'watchlist'` (schema doc Section 7.1, 7.3) | Translate only at the UI copy layer (Spanish labels); keep the stored/compared value in English in code, per `ARCHITECTURE.md`'s English-identifiers rule. |
| "solo es accesible por el dueño del lote" | `imdb_import_rows` has **no `user_id` column** — ownership is only reachable by joining `batch_id → imdb_import_batches.user_id`. `specs/backlog/RIK-1_database_schema_rls.md` (already drafted) commits to building this as an EXISTS-subquery, owner-only RLS policy on `imdb_import_rows` mirroring the `list_items` pattern in schema doc Section 9.2, but **without** the public branch. | RLS should enforce this at the DB layer once RIK-1 lands, but the action/service layer must still do its own ownership check (fetch the batch header first) so the UI can render a proper "not found" instead of an ambiguous empty table. See `Decisions made`. |
| `ARCHITECTURE.md` documents `components/Table/` (`DataTable`, TanStack Table) as shared between "biblioteca" and "import-batch detail" | `components/Table/` does not exist. `components/ui/` only has `button.tsx`. No `@tanstack/react-table` in `package.json`. A "Biblioteca" ticket is not present in the given RIK-1…RIK-11 sibling list, so this ticket is likely the **first real consumer** of `DataTable`. | Build `DataTable` as the generic shared component at `components/Table/DataTable.tsx` (per `ARCHITECTURE.md`'s stated intent), not as a one-off table hard-coded inside `features/import/`. Add `@tanstack/react-table` as a dependency if still missing. |
| Sibling backlog lists this ticket as `depends_on RIK-4` only (not `RIK-2`, auth) | The route sits under the authenticated `(app)` group per `ARCHITECTURE.md`'s routing table, and AC-2 requires ownership enforcement, which implies a signed-in session | This ticket's action layer must perform its own `supabase.auth.getUser()` check regardless of whether `(app)`'s shared layout guard (RIK-2) has landed yet, as a defense-in-depth / standalone-safety measure — not a replacement for RIK-2, just insurance against build order. |
| N/A (implicit) | `package.json` currently has no `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-table`, `zustand`, `react-hook-form`, or `sonner` installed — confirmed by reading the file directly. | RIK-1/RIK-4 are expected to install the Supabase client packages; this ticket must independently verify `@tanstack/react-table` is present (for `DataTable`) and install it if not, rather than assuming another ticket already did. |
| N/A (Next.js version) | This project runs Next.js 16.3.0, where `page.tsx` dynamic route `params` is a **Promise**, not a plain object (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`) | `app/(app)/importar/[batchId]/page.tsx` must be `async function Page({ params }: { params: Promise<{ batchId: string }> })` and `await params` before using `batchId` — writing it as a synchronous prop (pre-v15 pattern) will break. |

### Current database state

Confirmed by reading `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Section 7.1 (the schema doc, since no live migration exists yet — `supabase/` is absent) and cross-checked against the already-drafted `specs/backlog/RIK-1_database_schema_rls.md`:

```sql
create table if not exists public.imdb_import_batches (
    id             uuid default gen_random_uuid() not null primary key,
    created_at     timestamptz default now() not null,
    user_id        uuid not null references auth.users(id) on delete cascade,
    source_type    varchar not null,   -- 'ratings' | 'watchlist'
    file_name      varchar,
    status         varchar default 'pending' not null,
    total_rows     integer default 0 not null,
    matched_rows   integer default 0 not null,  -- ya existían en el catálogo
    created_rows   integer default 0 not null,  -- se crearon como stub
    skipped_rows   integer default 0 not null,
    completed_at   timestamptz
);
create index if not exists imdb_batches_user_idx on public.imdb_import_batches (user_id, created_at desc);

create table if not exists public.imdb_import_rows (
    id          uuid default gen_random_uuid() not null primary key,
    batch_id    uuid not null references public.imdb_import_batches(id) on delete cascade,
    imdb_id     varchar not null,     -- columna "Const"
    title       varchar,
    title_type  varchar,              -- columna "Title Type"
    year        integer,
    your_rating smallint,             -- solo en export de calificaciones
    date_rated  date,
    media_id    uuid references public.media_items(id),
    result      varchar default 'pending' not null  -- 'matched' | 'created' | 'skipped'
);
create index if not exists imdb_rows_batch_idx on public.imdb_import_rows (batch_id);
```

**RLS (per schema doc Section 9 + RIK-1's committed approach):**
- `imdb_import_batches`: owner-only via `auth.uid() = user_id` (the standard Section 9.1 pattern — it has a direct `user_id` column).
- `imdb_import_rows`: owner-only via an EXISTS-subquery joining `batch_id → imdb_import_batches.user_id` (no direct `user_id` column; no public branch — this table is never publicly readable).

**Code usage:** none. Nothing has been built against these tables yet in this repository — `types/`, `services/`, `actions/`, `features/`, and the `app/(app)/importar/*` routes are all absent. This ticket, together with RIK-4, is the first real consumer.

**Current behaviour:** N/A — the routes do not exist.

### Requested field mapping

| Field requested | Type | Existing equivalent | Action |
| --- | --- | --- | --- |
| fecha (batch list) | timestamp | `imdb_import_batches.created_at` | already exists (reuse) |
| tipo (batch list) | enum | `imdb_import_batches.source_type` (`'ratings' \| 'watchlist'`) | already exists (reuse) |
| resumen: total | integer | `imdb_import_batches.total_rows` | already exists (reuse) |
| resumen: reconocidos | integer | `imdb_import_batches.matched_rows` | already exists (reuse) |
| resumen: creados | integer | `imdb_import_batches.created_rows` | already exists (reuse) |
| resumen: omitidos | integer | `imdb_import_batches.skipped_rows` | already exists (reuse) |
| título (row) | text | `imdb_import_rows.title` | already exists (reuse) |
| imdb_id (row) | text | `imdb_import_rows.imdb_id` | already exists (reuse) |
| resultado (row) | enum | `imdb_import_rows.result` (`'matched' \| 'created' \| 'skipped'`, default `'pending'`) | already exists (reuse) |
| dueño del lote (access control) | — | `imdb_import_batches.user_id` (direct FK) + `imdb_import_rows` via join (RIK-1's EXISTS policy) | already exists (reuse) — RLS from RIK-1, plus an explicit ownership check in the action layer (see Decisions made) |

No new columns or tables are required for this ticket.

### Impacted files

- **Types** — `types/ImdbImport.ts` (or the existing barrel `types/index.ts` if RIK-4 already created it): `ImdbImportBatch`, `ImdbImportRow` matching the schema above. Extend if RIK-4 created them first; create if not.
- **Services** — `services/ImdbImportServices/index.ts`: add `listBatchesForUser(userId)` and `getBatchWithRows(batchId, userId)`. Extend the existing service class if RIK-4 already created it (it will already have write-side methods for the upload flow); do not duplicate the class.
- **Actions** — `actions/imdb-import/index.ts`: add `getImportBatches()` and `getImportBatchDetail(batchId)` Server Actions — session check via `supabase.auth.getUser()`, instantiate `ImdbImportServices` with the request-scoped client, return `null`/redirect on no session or no ownership.
- **Components (shared)** — `components/Table/DataTable.tsx` (new, TanStack Table wrapper per `ARCHITECTURE.md`) if it does not already exist; `components/ui/badge.tsx`, `components/ui/card.tsx`, `components/ui/table.tsx` (shadcn primitives, `style: base-lyra`, `baseColor: mist`) if not already added — only `button.tsx` exists today.
- **Features** — `features/import/components/BatchHistoryList.tsx` (renders the `/importar` history section), `features/import/components/BatchDetailTable.tsx` (renders the `/importar/[batchId]` rows via `DataTable`), `features/import/components/ImportResultBadge.tsx` (shared result → Spanish label + Badge variant mapping, reused by the detail table and, if useful, the history summary).
- **App routes** — `app/(app)/importar/page.tsx`: extend if RIK-4 already created it (append the history section below the existing upload UI, do not touch the upload/dropzone code); create a minimal version with just the history section (and a `TODO: upload UI — RIK-4` placeholder) if RIK-4 has not landed yet. `app/(app)/importar/[batchId]/page.tsx` (new): batch header + `BatchDetailTable` + back-to-`/importar` action; `notFound()` when the batch doesn't exist or isn't owned by the current user.
- **Tests** — no test suite exists yet in this repository; note where tests would live (`features/import/__tests__/` or co-located `*.test.tsx`) if/when one is introduced, but do not scaffold a test runner as part of this ticket.

### Decisions made

1. **Ownership check happens in the action/service layer, not only via RLS.** Fetch the batch header (`imdb_import_batches` row) first; if it comes back `null` (either it doesn't exist or RLS filtered it out because the current user isn't the owner — indistinguishable from the client's point of view, which is correct: non-owners must not learn whether the batch exists), the page calls `notFound()`. Only fetch `imdb_import_rows` once the batch header confirms ownership. **Recommended default**, not confirmed by the user — the alternative of relying on RLS alone would still work for data isolation but gives a worse UX (can't distinguish "zero rows in an owned empty batch" from "batch doesn't exist" without this two-step fetch).
2. **Skipped rows get `variant="destructive"` on the shadcn Badge**, `matched` gets `variant="secondary"`, `created` gets `variant="default"` — using the three standard shadcn Badge variants already available in the `base-lyra` style rather than inventing new color tokens. **Recommended default.**
3. **No server-side pagination for the row detail table.** IMDb CSV exports are personal watch histories (typically hundreds to a few thousand rows); the ticket's own acceptance criterion says "muestra todas las filas" (show all rows). Use `DataTable`'s built-in TanStack Table client-side pagination/sort rather than adding `LIMIT`/`OFFSET` query params. **Recommended default** — revisit if a real user's export proves too large in practice.
4. **`DataTable` is built as the generic shared component** at `components/Table/DataTable.tsx`, per `ARCHITECTURE.md`'s explicit statement that it's meant for both "biblioteca" and "import-batch detail," even though no Biblioteca ticket exists yet in the current sibling backlog. This ticket is treated as the first real consumer establishing that shared location. **Recommended default.**
5. **Empty state on `/importar` (zero batches)** mirrors the product's existing empty-state pattern (e.g. Biblioteca's "importa desde IMDb" message per the vistas PRD): a short message inviting the user to import their first file, not a blank table or an error. **Recommended default**, copy TBD by the implementing agent.
6. **`/importar/[batchId]`'s "back to Importar" action** (PRD Section 7.6) is a plain `next/link` `<Button variant="outline">` back to `/importar`, not a browser-back call — keeps behaviour deterministic regardless of navigation history. **Recommended default.**
7. **This ticket does not touch `supabase/migrations/`.** RLS for `imdb_import_rows` (the EXISTS-subquery, owner-only policy) is entirely RIK-1's committed scope per `specs/backlog/RIK-1_database_schema_rls.md`. If RIK-1 has not landed, or its `imdb_import_rows` policy is missing/incorrect at execution time, the implementing agent must stop and report it as a blocker rather than writing a migration itself or shipping an unenforced read path. **Recommended default**, keeps layer boundaries clean per `ARCHITECTURE.md`.

### Out of scope

- CSV upload, parsing, matching (`matched`/`created`/`skipped` classification) and `user_media_status` upserts — entirely RIK-4.
- Schema and RLS for `imdb_import_batches` / `imdb_import_rows`, including the join-based ownership policy — entirely RIK-1 (already drafted).
- The `(app)` route group's shared layout auth guard (`AuthCheck`, `UserProvider`) — RIK-2. This ticket adds its own defensive session check in the action layer but does not build the shared guard.
- Watchlist-removal reconciliation policy (schema doc Section 11, item 4) — belongs to RIK-4's processing logic, not this read-side ticket.
- Server-side pagination, filtering, or search on the batch detail table — not requested by the ticket; deferred until proven necessary.
- Any UI for re-running or deleting a past import — not requested by the ticket.

---

## Implementation plan

**Goal:** build the read-only history list on `/importar` and the row-level detail page at `/importar/[batchId]`, against the real `imdb_import_batches` / `imdb_import_rows` schema, reusing RIK-4's upload container and RIK-1's RLS rather than re-deriving either.

**In scope:**
1. `types/ImdbImport.ts` (or extend `types/index.ts`) — `ImdbImportBatch`, `ImdbImportRow` types matching the schema doc exactly.
2. `services/ImdbImportServices` — add `listBatchesForUser(userId)` (ordered `created_at desc`) and `getBatchWithRows(batchId, userId)` (batch header + rows, two-step ownership-safe fetch).
3. `actions/imdb-import` — add `getImportBatches()` and `getImportBatchDetail(batchId)` Server Actions with an explicit `supabase.auth.getUser()` check.
4. `components/Table/DataTable.tsx` — generic TanStack Table wrapper (shared component, not import-specific); add shadcn `badge`, `card`, `table` primitives if missing.
5. `features/import/components/` — `BatchHistoryList`, `BatchDetailTable`, `ImportResultBadge`.
6. `app/(app)/importar/page.tsx` — extend with the history section (or create minimally if RIK-4 hasn't landed).
7. `app/(app)/importar/[batchId]/page.tsx` — new detail route, async `params` per Next.js 16, `notFound()` for non-owners/missing batches, back-to-`/importar` action.

**Out of scope:** upload/parsing/matching logic (RIK-4), schema/RLS (RIK-1), `(app)` auth guard (RIK-2), reconciliation policy, pagination beyond client-side, re-run/delete UI — see above for reasons.

**Key risks / compatibility:**
- `imdb_import_rows` has no `user_id` column — do not write or assume a naive `auth.uid() = user_id` filter against it in application code; ownership only resolves through the batch header.
- If RIK-1's `imdb_import_rows` RLS policy is missing at execution time, this ticket's read path would either return nothing (safe but broken) or, if RLS isn't enabled at all, leak cross-user data (unsafe) — hence the explicit "stop and flag" constraint rather than silently shipping.
- `DataTable` and the shadcn primitives it needs (`badge`, `card`, `table`) don't exist yet — must be added without assuming another ticket already did.

**Acceptance criteria mapping:**

| Ticket AC | Implementation coverage |
| --- | --- |
| `/importar` lists previous batches with date/type/summary, newest first | `BatchHistoryList` fed by `getImportBatches()` → `listBatchesForUser()`, ordered `created_at desc` |
| `/importar/[batchId]` shows all rows with result, owner-only | `BatchDetailTable` fed by `getImportBatchDetail()` → `getBatchWithRows()`; `notFound()` when batch header fetch returns null |
| `skipped` rows visually distinct | `ImportResultBadge` maps `result` to a distinct Badge variant (`destructive` for `skipped`) |

---

## Claude Code prompt

```xml
<task id="RIK-5" title="Detalle de importación" depends_on="RIK-4">
  <role>
    You are a senior full-stack engineer working on Rikuna (Next.js 16 App Router + Supabase/Postgres).
    You are building the READ-ONLY history and detail views on top of the IMDb CSV import feature: a
    history list on /importar showing past import batches, and a new /importar/[batchId] page showing
    every row of one batch with its per-title result. You do NOT touch upload, CSV parsing, or matching
    logic — that is entirely RIK-4's scope, already implemented (or being implemented in parallel) as
    the writer of imdb_import_batches / imdb_import_rows.
  </role>

  <mandatory_reading>
    <item path="ARCHITECTURE.md">Layered + feature-sliced layout, auth boundaries (actions/ session
      checks, never import lib/supabase/admin.ts here), the (app)/(public) route groups, and the
      documented intent that components/Table/DataTable (TanStack Table) is shared between "biblioteca"
      and "import-batch detail".</item>
    <item path="AGENTS.md">This project runs a Next.js version with breaking changes versus your
      training data. Also read node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
      before writing app/(app)/importar/[batchId]/page.tsx — in this Next.js version, the `params` prop
      of a page component is a Promise and must be awaited.</item>
    <item path=".cursor/commands/makecommit.md">Commit message format and emoji mapping required by the
      completion_report's commit_message deliverable.</item>
    <item path="specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md">Section 2.2 — exact content expectations for
      /importar (dropzone, type selector, history table with date/type/summary) and /importar/[batchId]
      (row-by-row table: title, imdb_id, result; DataTable with a colored result Badge).</item>
    <item path="specs/RIKUNA-PRD-documento-especificacion-rikuna.md">Section 7.6 — "Detalle de
      importación": purpose (transparency on what happened per row), content (title, IMDb id, result),
      action (back to Importar).</item>
    <item path="specs/RIKUNA-PRD-schema-basedatos-rikuna.md">Section 7.1 (imdb_import_batches /
      imdb_import_rows DDL — copied into ground_truth_db_notes below, but read the section for full
      context), Section 9 / 9.1 / 9.2 (RLS patterns — imdb_import_rows uses the join-based pattern
      structurally similar to list_items in 9.2, minus the public branch).</item>
    <item path="specs/backlog/RIK-1_database_schema_rls.md">The already-drafted foundation ticket. Confirms
      imdb_import_batches uses the direct owner_all RLS pattern and imdb_import_rows uses an EXISTS-subquery
      policy joining to imdb_import_batches.user_id. If RIK-1 has landed by the time you run this, verify
      the actual migration matches this; if it has NOT landed, or the imdb_import_rows policy is missing,
      STOP and report it as a blocker in your completion report instead of writing a migration yourself or
      shipping a read path with no ownership enforcement.</item>
    <item path="package.json">Confirm exactly what's installed before assuming any Supabase client,
      @tanstack/react-table, or other ARCHITECTURE.md-listed dependency already exists.</item>
    <item path="components.json">shadcn config: style "base-lyra" (Base UI variant), baseColor "mist" —
      use this when adding any new shadcn primitive (badge, card, table).</item>
    <item path="components/ui/button.tsx">The only shadcn primitive that exists today — use it as the
      style/convention reference when adding badge.tsx, card.tsx, table.tsx.</item>
    <item path="supabase/migrations/">Read whatever migration files actually exist here at execution
      time (created by RIK-1) to confirm the real, applied table/column/RLS shape before writing any
      query against imdb_import_batches or imdb_import_rows.</item>
    <item path="app/(app)/importar/">Read RIK-4's existing upload page (if it has landed) before touching
      it — you are appending a history section, not rewriting the upload UI.</item>
    <item path="CHANGELOG.md">Format and where to append the one bullet for this ticket.</item>
    <item path="specs/logs/README.md">Work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna lets a user import their IMDb "Ratings" and "Watchlist" CSV exports. RIK-4 (upload flow,
    depended on by this ticket) processes an uploaded CSV, writes one row to imdb_import_batches per
    upload (with running counters), and one row to imdb_import_rows per CSV line (with a per-row
    result). This ticket is purely additive on the READ side: a history list of past batches on
    /importar, and a new /importar/[batchId] route showing every row of one batch. Nothing here writes
    to the database — only SELECT queries via services/actions, scoped to the signed-in user's own data.

    types/, services/, actions/, features/, and app/(app)/importar/ may or may not exist yet depending on
    whether RIK-4 has already run in this environment. Check each layer before creating it: if RIK-4
    already created ImdbImportServices, actions/imdb-import, types/ImdbImport (or an entry in
    types/index.ts), or app/(app)/importar/page.tsx, EXTEND those files with the read methods/UI this
    ticket needs — do not duplicate the service class, action barrel, or route file. If a layer genuinely
    does not exist yet, create the minimal version needed for this ticket's read paths only, and leave a
    `// TODO(RIK-4): ...` comment marking where the write-side logic belongs instead of stubbing it out
    yourself.
  </context>

  <ground_truth_db_notes critical="true">
    <note>Real tables are imdb_import_batches and imdb_import_rows (schema doc Section 7.1), created by
      RIK-1's migration(s), not by this ticket. Do not create or modify anything under
      supabase/migrations/ as part of this work.</note>
    <note>imdb_import_batches columns: id (uuid pk), created_at (timestamptz), user_id (uuid, fk
      auth.users), source_type ('ratings' | 'watchlist'), file_name (varchar, nullable), status
      (varchar, default 'pending'), total_rows / matched_rows / created_rows / skipped_rows (integer,
      default 0), completed_at (timestamptz, nullable). Indexed on (user_id, created_at desc).</note>
    <note>imdb_import_rows columns: id (uuid pk), batch_id (uuid, fk imdb_import_batches, on delete
      cascade), imdb_id (varchar, not null), title (varchar, nullable), title_type (varchar, nullable),
      year (integer, nullable), your_rating (smallint, nullable — ratings export only), date_rated (date,
      nullable), media_id (uuid, fk media_items, nullable), result (varchar, default 'pending' — real
      values are 'matched' | 'created' | 'skipped'). Indexed on batch_id.</note>
    <note>imdb_import_rows has NO user_id column. Do not write `.eq('user_id', ...)` against it — it does
      not exist and the query will error. Ownership is only reachable through batch_id →
      imdb_import_batches.user_id.</note>
    <note>The batch summary counters (total_rows, matched_rows, created_rows, skipped_rows) already exist
      as columns on imdb_import_batches. Use them directly for the /importar history list. Do NOT
      recompute them by counting/aggregating imdb_import_rows at read time — RIK-4 owns keeping those
      counters correct.</note>
    <note>result and source_type are stored as English varchar enums ('matched'/'created'/'skipped' and
      'ratings'/'watchlist' respectively). Keep the stored/compared values in English in code (constants,
      switch cases, type unions); only the rendered label shown to the user is Spanish
      ("reconocido"/"creado"/"omitido", "Calificaciones"/"Lista de seguimiento").</note>
    <note>RLS: imdb_import_batches uses the direct owner_all pattern (auth.uid() = user_id) since it has
      a user_id column. imdb_import_rows uses an EXISTS-subquery policy joining to
      imdb_import_batches.user_id (no public branch, never anon-readable) — this is RIK-1's committed
      design (specs/backlog/RIK-1_database_schema_rls.md), not something to re-derive or second-guess.
      Verify the actual applied policy at execution time; if it's missing, stop and report it rather than
      proceeding.</note>
    <note>Because RLS makes a non-owner's SELECT return zero rows (not an error), fetch the batch header
      row first, separately from the rows. If the batch header comes back null, treat it as "not found"
      (call notFound()) regardless of whether that's because the id doesn't exist or because the current
      user isn't the owner — do not leak which case it was. Only fetch imdb_import_rows once the header
      confirms ownership.</note>
    <note>Next.js 16: the page component's `params` prop is a Promise. Write
      `app/(app)/importar/[batchId]/page.tsx` as `async function Page({ params }: { params: Promise<{ batchId: string }> })`
      and `const { batchId } = await params;` — do not destructure params synchronously.</note>
    <note>package.json currently has none of @supabase/ssr, @supabase/supabase-js, @tanstack/react-table,
      zustand, react-hook-form, or sonner installed. Do not assume any of them exist — check package.json
      first and install @tanstack/react-table if DataTable needs it and it's still missing.</note>
    <note>Only components/ui/button.tsx exists under components/ui/ today. badge.tsx, card.tsx, and
      table.tsx must be added (shadcn style "base-lyra", baseColor "mist" per components.json) before
      they can be used by features/import components.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="1. Types">
      <item>Ensure ImdbImportBatch and ImdbImportRow types exist (types/ImdbImport.ts or an entry in
        types/index.ts, matching whatever convention RIK-4 already used if it landed first), with fields
        matching the columns listed in ground_truth_db_notes exactly (camelCase in TypeScript, mapped
        from the snake_case DB columns in the service layer — do not rename the DB columns themselves).</item>
    </phase>

    <phase title="2. Services">
      <item>In services/ImdbImportServices (extend if it exists, create if not — constructor takes a
        SupabaseClient per ARCHITECTURE.md's DI convention), add:
        listBatchesForUser(userId: string): Promise&lt;ImdbImportBatch[]&gt; — selects from
        imdb_import_batches ordered by created_at desc.</item>
      <item>getBatchWithRows(batchId: string, userId: string): Promise&lt;{ batch: ImdbImportBatch; rows: ImdbImportRow[] } | null&gt;
        — first selects the single batch row by id (rely on RLS + an explicit .eq('user_id', userId) as
        belt-and-suspenders since this table does have the column), returns null immediately if not
        found/not owned; only then selects all imdb_import_rows for that batch_id, ordered in a stable,
        sensible way (e.g. by title or by insertion order — id or a natural row order column if present).</item>
      <item>No row mapper should silently drop the result field, imdb_id, or title — these are the whole
        point of the detail view.</item>
    </phase>

    <phase title="3. Actions">
      <item>In actions/imdb-import (extend if it exists, create if not), add two Server Actions:
        getImportBatches() and getImportBatchDetail(batchId: string).</item>
      <item>Both must call supabase.auth.getUser() first (using the request-scoped server client from
        lib/supabase/server — never lib/supabase/admin.ts here) and return an empty result /
        redirect('/auth/login') when there is no session, even if the (app) layout guard (RIK-2) is
        also expected to have already redirected — treat this as defense-in-depth, not redundant.</item>
      <item>getImportBatches() calls ImdbImportServices.listBatchesForUser(user.id).</item>
      <item>getImportBatchDetail(batchId) calls ImdbImportServices.getBatchWithRows(batchId, user.id) and
        returns the result (including null) untouched — the page component decides what null means (404).</item>
    </phase>

    <phase title="4. Shared components">
      <item>If components/Table/DataTable.tsx does not exist, create it as a generic TanStack Table
        wrapper (columns + data props, sorting and client-side pagination built in) — this is meant to be
        reused later outside of import, per ARCHITECTURE.md, so keep it free of import-specific logic.</item>
      <item>Add shadcn primitives components/ui/badge.tsx, components/ui/card.tsx, components/ui/table.tsx
        if they don't already exist, matching the project's "base-lyra" style / "mist" base color and the
        existing button.tsx as a style reference. Respect the Lyra convention of border-radius 0 already
        configured globally — do not override it per-component.</item>
    </phase>

    <phase title="5. Feature components">
      <item>features/import/components/ImportResultBadge.tsx — maps a row's `result` value to a Spanish
        label and a Badge variant: 'matched' → "Reconocido" / variant="secondary"; 'created' → "Creado" /
        variant="default"; 'skipped' → "Omitido" / variant="destructive" (the visually distinct case
        required by AC-3); any other/pending value → a neutral fallback label/variant, not a crash.</item>
      <item>features/import/components/BatchHistoryList.tsx — renders the list of batches passed in as
        props (Server Component data flow per ARCHITECTURE.md: fetch in the page, pass initial data down):
        one row/card per batch showing created_at (formatted, e.g. relative or localized date), a label
        for source_type ("Calificaciones"/"Lista de seguimiento"), and the four counters
        (total/matched/created/skipped). Each item links to /importar/[batchId]. Renders an empty-state
        message (invite to import a first file) when the batches array is empty.</item>
      <item>features/import/components/BatchDetailTable.tsx — renders the batch's rows via DataTable with
        columns for title, imdb_id, and result (using ImportResultBadge for the result cell).</item>
    </phase>

    <phase title="6. Routes">
      <item>app/(app)/importar/page.tsx — if RIK-4 already created this file with the upload
        dropzone/type selector, APPEND a history section below it by calling getImportBatches() and
        rendering &lt;BatchHistoryList batches={batches} /&gt; — do not modify the existing upload code.
        If the file does not exist yet, create it with just the history section and a
        `{/* TODO(RIK-4): upload dropzone + type selector */}` placeholder comment where the upload UI
        belongs.</item>
      <item>app/(app)/importar/[batchId]/page.tsx (new) — async Server Component,
        `params: Promise<{ batchId: string }>`, await it, call getImportBatchDetail(batchId). If the
        result is null, call notFound() from next/navigation. Otherwise render a header with the batch's
        source_type label and created_at, the four summary counters, &lt;BatchDetailTable rows={rows} /&gt;,
        and a "Volver a Importar" Button/Link back to /importar.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">/importar lists the signed-in user's previous import batches with date
      (created_at), type (source_type, labeled in Spanish), and summary (total_rows, matched_rows,
      created_rows, skipped_rows), ordered from most recent to oldest (created_at desc). Verify by seeding
      2+ batches with different created_at values for one test user and confirming render order and
      displayed values match the DB rows.</criterion>
    <criterion id="AC-2">/importar/[batchId] shows every row of imdb_import_rows for that batch (title,
      imdb_id, result), and is only accessible by the batch's owner. Verify by: (a) as the owner, batch id
      renders a table whose row count and values match a direct SELECT against imdb_import_rows for that
      batch_id; (b) as a different authenticated user or as anon, the same URL renders Next.js's not-found
      UI (no batch data leaked).</criterion>
    <criterion id="AC-3">Every row with result = 'skipped' renders with a visually distinct Badge
      (variant="destructive") compared to 'matched' (variant="secondary") and 'created'
      (variant="default"). Verify by seeding a batch with at least one row of each result and inspecting
      the rendered Badge variant/class per row.</criterion>
    <criterion id="AC-4">app/(app)/importar/[batchId]/page.tsx correctly awaits the Promise-typed `params`
      prop (Next.js 16 contract) — verify by reading the file and confirming the async/await usage matches
      node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md's documented shape.</criterion>
    <criterion id="AC-5">A user with zero import batches sees an empty-state message on /importar (invite
      to import), not a blank table, an error, or a crash. Verify by rendering BatchHistoryList with an
      empty array.</criterion>
    <criterion id="AC-6">/importar/[batchId] includes a working "Volver a Importar" action that navigates
      back to /importar (PRD Section 7.6). Verify by inspecting the rendered link's href.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create, edit, or delete anything under supabase/migrations/ — RLS and schema for
      imdb_import_batches / imdb_import_rows are entirely RIK-1's scope. If RIK-1 hasn't landed, or its
      imdb_import_rows RLS policy is missing/incorrect, STOP and report it as a blocker in the
      verification_report instead of writing a migration or shipping an unenforced read path.</item>
    <item>Do NOT rename or restructure any existing column: imdb_id, title, result, source_type,
      total_rows, matched_rows, created_rows, skipped_rows, batch_id, user_id must stay exactly as named
      in the schema doc.</item>
    <item>Do NOT modify RIK-4's upload/dropzone/CSV-processing code in app/(app)/importar/page.tsx (if it
      exists) beyond appending the history section below it.</item>
    <item>Do NOT import lib/supabase/admin.ts anywhere in actions/ or features/import/ — this is a
      user-facing, session-scoped read path, not an ingestion routine.</item>
    <item>Do NOT write `.eq('user_id', ...)` against imdb_import_rows — the column doesn't exist there.
      Ownership flows through the batch header only.</item>
    <item>Do NOT add server-side pagination/filtering to the batch detail query — the ticket asks for all
      rows; use DataTable's client-side pagination if row count matters for rendering performance.</item>
    <item>Keep user-visible copy in Spanish and code identifiers (types, functions, variables) in English,
      per ARCHITECTURE.md.</item>
  </constraints>

  <out_of_scope>
    <item>CSV upload, parsing, IMDb matching/stub-creation logic, and user_media_status upserts — RIK-4.</item>
    <item>Database schema and RLS policies for imdb_import_batches / imdb_import_rows — RIK-1.</item>
    <item>The (app) route group's shared layout auth guard (AuthCheck, UserProvider, middleware redirect)
      — RIK-2. This ticket adds only its own defensive session check inside the Server Actions.</item>
    <item>Watchlist-removal reconciliation policy (schema doc Section 11 item 4) — RIK-4's concern.</item>
    <item>Re-running or deleting a past import batch — not requested by this ticket.</item>
  </out_of_scope>

  <implementation_notes>
    <item>services/ImdbImportServices/index.ts — class ImdbImportServices { constructor(private supabase: SupabaseClient) {} async listBatchesForUser(userId: string): Promise&lt;ImdbImportBatch[]&gt; { ... } async getBatchWithRows(batchId: string, userId: string): Promise&lt;{ batch: ImdbImportBatch; rows: ImdbImportRow[] } | null&gt; { ... } }</item>
    <item>actions/imdb-import/index.ts — export async function getImportBatches(): Promise&lt;ImdbImportBatch[]&gt; and export async function getImportBatchDetail(batchId: string): Promise&lt;{ batch: ImdbImportBatch; rows: ImdbImportRow[] } | null&gt;</item>
    <item>app/(app)/importar/[batchId]/page.tsx — export default async function Page({ params }: { params: Promise&lt;{ batchId: string }&gt; }) { const { batchId } = await params; const detail = await getImportBatchDetail(batchId); if (!detail) notFound(); ... }</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in requirements phases 1–6, created or extended as specified.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>Persist documentation per completion_report/persistence below: one CHANGELOG.md bullet under
      [Unreleased], and one specs/logs/ file.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether RIK-4's app/(app)/importar/page.tsx, services/ImdbImportServices, actions/imdb-import,
      and types already exist at execution time is unknown ahead of time. Default: check first; extend if
      present, create the minimal read-only version with a TODO(RIK-4) marker if absent.</item>
    <item>Whether RIK-1's imdb_import_rows RLS policy has actually landed is unknown ahead of time.
      Default: verify against real migration files; if missing, stop and report as a blocker rather than
      guessing or writing the migration yourself.</item>
    <item>Exact empty-state and date-formatting copy for the history list. Default: short Spanish message
      inviting the user to import their first file; localized date format consistent with the rest of the
      app (implementer's judgment, no hard requirement from the ticket).</item>
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
      <item>Anything that could not be completed, with the blocker (including, if applicable, RIK-1 or RIK-4 not having landed, or the imdb_import_rows RLS policy being missing).</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-5: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-5_import_batch_detail.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-5_import_batch_detail.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: types / services / actions / components / features / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference the ticket id (RIK-5) in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and the product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; an optional "## Screenshots" section (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the import history list" instead of naming the component, "the skipped-row badge" instead of naming the CSS variant.</item>
      <item>Keep it under 15 lines for the core comment (excluding Screenshots).</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing.</item>
      <item>Include "## Screenshots" (this ticket has user-visible UI changes — a new history list and a new detail page): list what to capture as numbered items, each with screen/area name, auth state, and what it should show. Suggest up to 4: (1) /importar with a populated history list — logged in; (2) /importar/[batchId] with a mix of matched/created/skipped rows, showing the skipped badge distinct; (3) /importar with zero batches — empty state; (4) /importar/[batchId] accessed as a non-owner — not-found state. Prefix each line with `[attach: short label]`.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable.</item>
      <item>This ticket is UI-focused (mixed with a light DB-read check): include "## Prerequisites" (dev server running, a signed-in test user, at least one imported batch with mixed results — seed via a direct SQL insert into imdb_import_batches/imdb_import_rows if RIK-4's upload UI isn't usable yet), "## UI validation" (numbered steps hitting /importar and /importar/[batchId] as owner and as a different user), "## Database validation" (a couple of read-only SQL checks confirming the displayed counts/rows match imdb_import_batches / imdb_import_rows), and "## Expected outcome" (bullets tying back to AC-1 through AC-6).</item>
      <item>Use real app paths: /importar, /importar/[batchId].</item>
      <item>SQL must be read-only SELECT statements only.</item>
    </deliverable>
  </completion_report>
</task>
```
