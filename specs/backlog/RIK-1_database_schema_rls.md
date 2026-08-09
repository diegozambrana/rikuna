# RIK-1 — Esquema de base de datos y RLS

## Ticket summary

This is the foundation ticket for Rikuna: it creates the entire MVP database schema (14 tables) and its Row Level Security policies as Supabase migrations, so every later ticket (auth, ingestion, imports, panel, lists) has real tables to build against. No `depends_on` — this ticket has no dependencies and everything else in the sibling backlog (RIK-2 … RIK-11) depends on it, directly or transitively.

- Create all 14 MVP tables (`media_items`, `genres`, `media_genres`, `people`, `media_people`, `platforms`, `catalog_snapshots`, `media_availability`, `user_subscriptions`, `user_media_status`, `user_lists`, `list_items`, `imdb_import_batches`, `imdb_import_rows`) with the exact types, constraints and indexes from the schema doc.
- Create the `updated_at` trigger function and wire it to `media_items`, `user_subscriptions`, `user_media_status`, `user_lists`.
- Enable RLS on every table and implement the three access patterns from Section 9: public-read/service-write catalog tables, fully private owner-only tables, and the mixed public/private case on `user_lists`/`list_items` (including the `grant select ... to anon`).
- Acceptance criteria require verifying cross-user isolation with two real test accounts and verifying anonymous (`anon`) access to public vs. private lists — this is a live-database check, not just a DDL review.

## Context

### Original ticket

**Descripción:** Crear las migraciones de Supabase (`supabase/migrations/`) para todas las tablas del MVP: `media_items`, `genres`, `media_genres`, `people`, `media_people`, `platforms`, `catalog_snapshots`, `media_availability`, `user_subscriptions`, `user_media_status`, `user_lists`, `list_items`, `imdb_import_batches`, `imdb_import_rows`. Incluye índices, constraints, triggers de `updated_at` y las políticas de RLS descritas en la Sección 9 del esquema (lectura pública de catálogo, aislamiento por dueño en datos personales, caso mixto público/privado en `user_lists`/`list_items`, incluyendo el `grant select ... to anon`).

**Criterios de aceptación:**

- [ ] Todas las tablas del esquema v3 existen con los tipos, constraints e índices definidos en `RIKUNA-PRD-schema-basedatos-rikuna.md`.
- [ ] RLS está habilitado en todas las tablas con datos de usuario; un usuario autenticado no puede leer ni escribir filas de `user_subscriptions`, `user_media_status`, `imdb_import_batches`/`rows` de otro usuario (verificado con dos cuentas de prueba).
- [ ] `user_lists`/`list_items` son legibles sin sesión (`anon`) solo cuando `is_public = true`; una lista privada devuelve vacío para `anon` y para otro usuario autenticado.
- [ ] `media_items`, `platforms`, `media_availability`, `catalog_snapshots`, `genres`, `people` son de lectura pública y de escritura solo para el rol de servicio.

This is the tracker's paste, verbatim — no additional team comments exist for this ticket.

### Team comments

None. This ticket was provided without follow-up discussion; every scoping call below is a recommended default derived directly from the schema PRD, not a team decision.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| "Crear las migraciones de Supabase (`supabase/migrations/`)" | `supabase/` does not exist at all — no directory, no `config.toml`, no prior migrations | This is a from-scratch creation, not an addition to an existing migration history. The implementing agent may need to scaffold `supabase/` itself (e.g. `supabase init`) before adding migration files. |
| Ticket references "las políticas de RLS descritas en la Sección 9 del esquema" | Section 9's table only names `user_media_status`, `user_subscriptions`, `user_lists`, `list_items`, `imdb_import_batches`, `imdb_import_rows` and the catalog group `media_items, genres, people, platforms, media_availability, catalog_snapshots` explicitly — it does **not** mention the junction tables `media_genres` / `media_people` | These two tables have no owner column and are pure catalog data (many-to-many links between `media_items` and `genres`/`people`), so the same public-read/service-write pattern as their parent tables applies. Treated as an extension of the documented rule, not a new rule — flagged as a default below. |
| Ticket says "triggers de `updated_at`" | The trigger function `public.handle_updated_at()` referenced by name in schema doc Sections 2.1, 4 and 5 is never actually defined in the doc | The function must be created by this migration before the triggers that call it — it is implied, not spelled out. Standard Supabase idiom: `new.updated_at = now(); return new;`. |
| Ticket says AC covers "RLS está habilitado en todas las tablas con datos de usuario" | To make AC-4 true ("escritura solo para el rol de servicio" on catalog tables), RLS must actually be enabled on the **catalog** tables too, not just the personal-data ones | Without `ENABLE ROW LEVEL SECURITY` on `media_items` etc., Supabase's default project-level grants (`authenticated` role typically has table-level INSERT/UPDATE/DELETE via default privileges) would let a logged-in user write directly to catalog tables even with a permissive SELECT policy in place. This is a load-bearing correction — see `ground_truth_db_notes` in the prompt. |

### Current database state

No `supabase/migrations/` directory exists — there is no current database state to reconcile. `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` (schema v3, Sections 2–9) is being treated as the schema ground truth for this ticket, per the task brief, since it is the first migration ever written for this project. All 14 tables, every column, type, default, constraint and index below are copied from that document, not re-derived.

Confirmed empty / absent before this ticket:

- `supabase/` — directory does not exist (`ls` confirms).
- `types/`, `services/`, `actions/`, `ingestion/`, `hooks/`, `stores/`, `constants/`, `middleware.ts` — none exist.
- `package.json` — no `@supabase/ssr`, `@supabase/supabase-js`, or any other stack dependency from `ARCHITECTURE.md` is installed yet. Irrelevant to this ticket (pure SQL, no client code), but confirms nothing downstream can be wired up yet either.

### Current logic (schema / RLS)

Not applicable — there is no existing logic to diff against. The "current" schema is the empty state.

### Requested field mapping

Not applicable in the usual sense (every field is a net-new creation, not a rename/reuse decision) — the schema doc is instead the exact DDL source. The table below records only the two ambiguous extensions the ticket text doesn't spell out verbatim.

| Field / policy requested | Type / shape | Existing equivalent | Action |
| --- | --- | --- | --- |
| `public.handle_updated_at()` trigger function | plpgsql trigger function | None — referenced but never defined in schema doc | Must be created |
| RLS on `media_genres`, `media_people` | public-read policy, no write policy | Not named in Section 9's table | Must be created (extend the catalog-group pattern) |
| RLS on `imdb_import_rows` | owner-only via join | Section 9.1's `auth.uid() = user_id` pattern doesn't apply directly — table has no `user_id` column | Must be created as an EXISTS-subquery policy joining to `imdb_import_batches.user_id`, mirroring the `list_items` pattern in Section 9.2 but without the public branch |

### Impacted files

- `supabase/migrations/<timestamp>_create_mvp_schema.sql` (new) — all 14 tables, indexes, constraints, `handle_updated_at()` function, triggers.
- `supabase/migrations/<timestamp+1>_enable_rls_policies.sql` (new) — `enable row level security` on all 14 tables, all RLS policies from Section 9, the `grant select ... to anon, authenticated` statements.
- `supabase/config.toml` (new, if not already scaffolded) — required for local `supabase start` / `supabase db reset` to exist and run migrations during verification.
- `CHANGELOG.md` (modified) — one bullet under `[Unreleased] / Added`.
- `specs/logs/<YYYYMMDDHHmm>_RIK-1_database_schema_rls.md` (new) — work log.

No `types/`, `services/`, `actions/`, or `app/` files are impacted — this ticket is database-only.

### Decisions made

1. **Two migration files, not one.** `..._create_mvp_schema.sql` (DDL) and `..._enable_rls_policies.sql` (RLS + grants), applied in that order. Rationale: mirrors the ticket description's own two-part structure ("tablas... Incluye índices, constraints, triggers... y las políticas de RLS") and keeps a schema-only rollback distinct from a policy-only rollback. **Recommended default, not confirmed by the user.**
2. **`handle_updated_at()` uses the standard Supabase idiom** (`new.updated_at = now(); return new;`, `language plpgsql`, `security definer` not required since it only touches `NEW`). **Recommended default.**
3. **`media_genres` and `media_people` get the same public-read/service-write RLS as their parent catalog tables**, even though Section 9's table doesn't name them explicitly — they hold no owner column and are pure catalog linkage data. **Recommended default.**
4. **`imdb_import_rows` RLS is an EXISTS-subquery policy against `imdb_import_batches.user_id`** (owner-only, no public branch), since it has no `user_id` column of its own. **Recommended default.**
5. **Explicit `grant select on <table> to anon, authenticated` added to every public catalog table** (`media_items`, `genres`, `media_genres`, `people`, `media_people`, `platforms`, `catalog_snapshots`, `media_availability`), not only `user_lists`/`list_items` as literally shown in Section 9.2. Rationale: Section 9.2's own warning — "sin este grant, RLS nunca llega a evaluarse" — applies equally to every table `anon` must read; relying on assumed default Supabase project grants is not verifiable from this repo alone. **Recommended default.**
6. **Section 11 open items are explicitly deferred**, not solved here (see Out of scope). They affect ingestion/product logic, not the DDL/RLS shape.

### Out of scope

- `seasons` / `episodes` tables — schema doc Section 2.3 explicitly states these are unchanged from a prior schema and "no forma parte del MVP." Not created in this ticket.
- Ingestion upsert/expire logic (Section 3.3) and product queries (Section 8.1–8.3) — these are query-layer/application logic for RIK-3, RIK-4, RIK-7, RIK-8, not DDL.
- `types/`, `services/`, `actions/` TypeScript layers — belong to whichever ticket first needs them (RIK-2 onward), per `ARCHITECTURE.md`.
- Auth routes, `middleware.ts`, route guards — RIK-2.
- Seed/fixture data — not requested by the ticket.
- Section 11 pending decisions (series catalog completeness, deep links, stub enrichment process, watchlist-removal reconciliation policy, `offer_type` scope, public list slug global uniqueness) — flagged as follow-ups, not resolved by this migration.

---

## Implementation plan

**Goal:** Stand up the complete Rikuna v3 schema and its RLS model as the first Supabase migrations in this repo, so every dependent ticket has real tables, constraints and access rules to build against.

**In scope:**

1. **Migration 1 (DDL)** — `public.handle_updated_at()` function, then all 14 tables in dependency order (catalog → availability → personal → imports), with every index/constraint from schema doc Sections 2–7, and `updated_at` triggers on the four tables that have the column.
2. **Migration 2 (RLS)** — enable RLS on all 14 tables; public-read/service-write policies + explicit `anon`/`authenticated` grants for the 8 catalog-domain tables; owner-only policies (direct `user_id`) for `user_subscriptions`, `user_media_status`, `imdb_import_batches`; owner-only EXISTS policy for `imdb_import_rows`; the mixed public/private pattern verbatim from Section 9.2 for `user_lists`/`list_items`, including its `grant select ... to anon, authenticated`.
3. **Local verification** — scaffold `supabase/` if absent, run the migrations against a local Supabase instance, create two test auth users, and confirm each acceptance criterion with real queries under each role (`anon`, user A, user B, `service_role`).

**Out of scope:** `seasons`/`episodes`, ingestion routines, product queries, TypeScript layers, auth/middleware, seed data, Section 11 decisions — see above for reasons.

**Key risks / compatibility:**

- Forgetting to enable RLS on catalog tables silently breaks AC-4 (default grants would let authenticated users write to `media_items` etc.).
- Missing the `anon`/`authenticated` grants makes RLS policies unreachable even if correct — Section 9.2's own documented failure mode.
- `imdb_import_rows` needs a join-based policy, not the simple `auth.uid() = user_id` pattern — easy to get wrong by copying Section 9.1 verbatim.

**Acceptance criteria mapping:**

| Ticket AC | Implementation coverage |
| --- | --- |
| All v3 tables exist with correct types/constraints/indexes | Migration 1, verified via `information_schema` queries |
| RLS enabled + cross-user isolation on personal tables | Migration 2, verified with two test accounts against `user_subscriptions`, `user_media_status`, `imdb_import_batches`/`rows` |
| `user_lists`/`list_items` public-only-when-flagged | Migration 2 Section 9.2 pattern, verified as `anon` and as a second authenticated user |
| Catalog tables public-read / service-write-only | Migration 2 catalog-group policies + grants, verified as `anon` and as an authenticated non-service user |

---

## Claude Code prompt

```xml
<task id="RIK-1" title="Esquema de base de datos y RLS">
  <role>
    You are a senior full-stack engineer working on Rikuna (Next.js 16 App Router + Supabase/Postgres),
    tasked with building the FOUNDATION database migration for the project. Nothing else in the codebase
    depends on this being done any particular way except that the table/column names and RLS behavior must
    match the schema doc exactly, since every future ticket (auth, ingestion, imports, panel, recommendations,
    lists) is built against this schema.
  </role>

  <mandatory_reading>
    <item path="ARCHITECTURE.md">Layered + feature-sliced layout; read the "Database (migrations)" and
      "Supabase integration" sections. Confirms: per-user isolation via user_id + RLS on all tables,
      public-by-flag exception on user_lists/list_items, UUID PKs, imdb_id as universal join key,
      time-aware availability model, and the rule "Do not edit existing migration files; add a new
      YYYYMMDDHHMMSS_&lt;name&gt;.sql for schema changes."</item>
    <item path="AGENTS.md">Read for the Next.js version-caveat pointer. This ticket does not touch any
      Next.js application code (no app/, no client/server components) — it is pure SQL migrations under
      supabase/migrations/ — so the node_modules/next/dist/docs/ reading requirement does not apply here.</item>
    <item path=".cursor/commands/makecommit.md">Commit message format and emoji mapping needed for the
      commit_message deliverable below.</item>
    <item path="specs/RIKUNA-PRD-schema-basedatos-rikuna.md">THE PRIMARY SOURCE for this ticket. Sections 2–7
      contain the exact, copy-ready SQL DDL for every table (columns, types, defaults, constraints, indexes).
      Section 9 (especially 9.1 and 9.2) contains the exact, copy-ready RLS policy SQL, including the anon
      grant. Section 11 lists open product/schema questions that are explicitly OUT OF SCOPE for this ticket —
      read it so you flag them correctly instead of trying to resolve them.</item>
    <item path="CHANGELOG.md">Format and where to append the [Unreleased] entry.</item>
    <item path="specs/logs/README.md">Work log filename convention and template to follow.</item>
  </mandatory_reading>

  <context>
    This repository has NO supabase/ directory yet — no config.toml, no prior migrations. This is the very
    first migration ever written for this project. Nothing in types/, services/, actions/, ingestion/ exists
    either, and none of those layers should be created by this ticket — it is strictly database DDL + RLS.
    package.json currently has no @supabase/* dependency; that is expected and irrelevant here since this
    ticket writes no application code.

    The schema is called "v3" in the PRD doc. It replaces older, undocumented iterations — do not look for or
    reconcile against any prior schema version; specs/RIKUNA-PRD-schema-basedatos-rikuna.md Sections 2–9 is the
    single source of truth for this ticket.
  </context>

  <ground_truth_db_notes critical="true">
    <note>supabase/ does not exist at all in this repo (verified: `ls supabase` fails). You must scaffold it
      (e.g. `supabase init`, or manually create supabase/config.toml + supabase/migrations/) before you can add
      migration files and run them locally for verification.</note>
    <note>The trigger function public.handle_updated_at() is referenced BY NAME in schema doc Sections 2.1
      (media_items), 4 (user_subscriptions) and 5 (user_media_status) via `create or replace trigger ... execute
      function public.handle_updated_at()`, but the function itself is never defined anywhere in the doc. You
      must create it in your DDL migration, before any trigger references it. Standard Supabase idiom:
      `new.updated_at = now(); return new;` in `plpgsql`.</note>
    <note>Only 4 of the 14 tables have an updated_at column and therefore a trigger: media_items,
      user_subscriptions, user_media_status, user_lists. Do NOT add updated_at (or its trigger) to the other 10
      tables — the schema doc deliberately omits it there (e.g. catalog_snapshots, media_availability, list_items,
      imdb_import_batches, imdb_import_rows use created_at/first_seen_at/last_seen_at instead, or no timestamp
      at all).</note>
    <note>RLS must be ENABLED on ALL 14 tables, not only the ones holding personal data. Reason: Supabase's
      default project-level privileges typically grant the `authenticated` role table-level INSERT/UPDATE/DELETE
      on public schema tables. If you enable RLS only on the personal-data tables and merely add a permissive
      SELECT policy to catalog tables (media_items, genres, media_genres, people, media_people, platforms,
      catalog_snapshots, media_availability) WITHOUT enabling RLS on them, those default grants would still let
      an authenticated end user write to media_items directly — silently failing acceptance criterion "de
      escritura solo para el rol de servicio". Enable RLS + add a SELECT-only policy + add no write policy on
      those tables; service_role bypasses RLS automatically in Supabase (BYPASSRLS) so ingestion still works.</note>
    <note>Section 9's RLS table in the schema doc does not explicitly list media_genres or media_people (the
      junction tables). Treat them as part of the same catalog group as their parents (media_items, genres,
      people): enable RLS, add a public SELECT policy (`using (true)`), add no write policy, and add the same
      explicit `grant select ... to anon, authenticated` as the other catalog tables.</note>
    <note>imdb_import_rows has NO user_id column — only batch_id referencing imdb_import_batches.user_id. The
      simple Section 9.1 pattern (`auth.uid() = user_id`) does not apply to this table. Build an EXISTS-subquery
      policy joining to imdb_import_batches, structurally similar to the list_items policy in Section 9.2, but
      WITHOUT any public/anon branch — imdb_import_rows is never publicly readable, only owner-readable via its
      parent batch's user_id.</note>
    <note>Section 9.2's own text explains why the explicit `grant select ... to anon, authenticated` is required
      in addition to the RLS policy: "sin este grant, RLS nunca llega a evaluarse y el visitante no ve nada."
      Apply the same explicit grant statement to every table anon/authenticated must read from — not just
      user_lists/list_items — rather than assuming Supabase's default project grants already cover it.</note>
    <note>seasons and episodes tables are explicitly declared NOT part of the MVP in schema doc Section 2.3
      ("Se mantiene igual que en tu esquema actual... No se detalla aquí porque no cambia y no forma parte del
      MVP."). Do not create them.</note>
    <note>Table and column names in the schema doc are the final names — do not rename anything for
      "consistency" or convention reasons (e.g. keep imdb_id, not imdbId or tconst; keep want_to_watch, not
      wantToWatch).</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="0. Scaffold supabase/ if absent">
      <item>Confirm whether supabase/config.toml exists. If not, initialize the local Supabase project
        structure so `supabase start` / `supabase db reset` work for verification later in this task.</item>
    </phase>

    <phase title="1. Migration: create_mvp_schema (DDL)">
      <item>Create supabase/migrations/&lt;YYYYMMDDHHMMSS&gt;_create_mvp_schema.sql using the current
        timestamp at creation time (do not reuse a placeholder timestamp).</item>
      <item>Define public.handle_updated_at() first (see ground_truth_db_notes).</item>
      <item>Create tables in this order, copying DDL verbatim from the cited schema doc sections, including
        every column, type, default, constraint and index exactly as written:
        media_items (2.1), genres + media_genres (2.2), people + media_people (2.2), platforms (3.1),
        catalog_snapshots (3.2), media_availability (3.3 DDL only — NOT the upsert/expire application logic),
        user_subscriptions (4), user_media_status (5), user_lists + list_items (6),
        imdb_import_batches + imdb_import_rows (7.1).</item>
      <item>Attach the updated_at trigger only to media_items, user_subscriptions, user_media_status,
        user_lists, exactly as shown in the doc.</item>
    </phase>

    <phase title="2. Migration: enable_rls_policies (RLS + grants)">
      <item>Create supabase/migrations/&lt;YYYYMMDDHHMMSS+1&gt;_enable_rls_policies.sql, timestamped after
        migration 1.</item>
      <item>Enable RLS on all 14 tables.</item>
      <item>Catalog group (media_items, genres, media_genres, people, media_people, platforms,
        catalog_snapshots, media_availability): one public SELECT policy per table (`using (true)`), no write
        policy, plus `grant select on public.&lt;table&gt; to anon, authenticated;` for each.</item>
      <item>Owner-only group with a direct user_id column (user_subscriptions, user_media_status,
        imdb_import_batches): apply the Section 9.1 "owner_all" pattern verbatim to each.</item>
      <item>imdb_import_rows: EXISTS-subquery owner-only policy joining to imdb_import_batches.user_id (see
        ground_truth_db_notes) — no public branch.</item>
      <item>user_lists + list_items: apply Section 9.2's SQL verbatim — select/insert/update/delete policies
        on user_lists, select/all policies on list_items, and the `grant select on public.user_lists,
        public.list_items to anon, authenticated;` statements.</item>
    </phase>

    <phase title="3. Local verification">
      <item>Start/reset a local Supabase instance and apply both migrations.</item>
      <item>Run information_schema checks confirming every table/column/constraint/index from Sections 2–7
        exists as specified.</item>
      <item>Confirm relrowsecurity = true for all 14 tables (pg_class / pg_tables).</item>
      <item>Create two test auth users (A and B). As user A: insert rows into user_subscriptions,
        user_media_status, imdb_import_batches (and a row in imdb_import_rows under that batch). As user B (and
        as anon), attempt to SELECT and UPDATE user A's rows in each of those four tables and confirm zero rows
        / permission denial.</item>
      <item>Create one user_lists row for user A with is_public = false and one with is_public = true, each
        with at least one list_items row. As anon and as user B, confirm the private list and its items return
        zero rows, and the public list and its items are fully readable.</item>
      <item>As anon and as an authenticated non-service user, confirm SELECT succeeds and INSERT/UPDATE/DELETE
        are denied on media_items, platforms, media_availability, catalog_snapshots, genres, people (and
        media_genres, media_people).</item>
      <item>Update a row in media_items, user_subscriptions, user_media_status and user_lists and confirm
        updated_at changes; confirm it does NOT exist as a column on the other 10 tables.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">All 14 tables (media_items, genres, media_genres, people, media_people, platforms,
      catalog_snapshots, media_availability, user_subscriptions, user_media_status, user_lists, list_items,
      imdb_import_batches, imdb_import_rows) exist with the exact columns, types, defaults, constraints and
      indexes from schema doc Sections 2–7. Verify via information_schema.columns / pg_indexes queries per
      table, diffed against the doc.</criterion>
    <criterion id="AC-2">RLS is enabled (relrowsecurity = true) on all 14 tables. Verify via
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace`.</criterion>
    <criterion id="AC-3">An authenticated user cannot read or write another user's rows in
      user_subscriptions, user_media_status, imdb_import_batches or imdb_import_rows. Verify with two real
      test accounts (A, B): rows created by A return zero rows and reject writes when queried/mutated as B.</criterion>
    <criterion id="AC-4">user_lists / list_items are readable without a session (anon) only when
      is_public = true; a private list returns zero rows both for anon and for a different authenticated user.
      Verify by querying as anon and as user B against a list owned by user A, both is_public states.</criterion>
    <criterion id="AC-5">media_items, platforms, media_availability, catalog_snapshots, genres, people (and
      the media_genres / media_people junction tables) are publicly readable (anon SELECT succeeds) and reject
      INSERT/UPDATE/DELETE from anon and from a regular authenticated (non-service-role) user. Verify by
      attempting each operation under both roles and confirming SELECT succeeds while writes are denied.</criterion>
    <criterion id="AC-6">updated_at auto-updates on media_items, user_subscriptions, user_media_status and
      user_lists after an UPDATE, via the public.handle_updated_at() trigger function. Verify by updating one
      row per table and comparing updated_at before/after.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT edit or delete any existing migration file — there are none yet, but if any exist by the time
      you run this, add a NEW timestamped file instead of touching them, per ARCHITECTURE.md.</item>
    <item>Do NOT rename any table or column from the exact names in specs/RIKUNA-PRD-schema-basedatos-rikuna.md
      Sections 2–7 (e.g. keep imdb_id, want_to_watch, is_stub, last_snapshot_id verbatim).</item>
    <item>Do NOT create seasons or episodes tables — explicitly out of MVP per Section 2.3.</item>
    <item>Do NOT implement the media_availability upsert/expire logic from Section 3.3, or the product queries
      from Section 8 — those are ingestion/query-layer work for other tickets (RIK-3, RIK-4, RIK-7, RIK-8), not
      DDL for this one.</item>
    <item>Do NOT create any types/, services/, actions/, ingestion/, hooks/, stores/ files or install any
      @supabase/* package — this ticket is database-only.</item>
    <item>Do NOT grant INSERT/UPDATE/DELETE to anon or authenticated on any catalog table — only SELECT.
      Service-role writes bypass RLS automatically and need no explicit grant.</item>
    <item>Do NOT add an updated_at column or trigger to any table other than media_items, user_subscriptions,
      user_media_status, user_lists.</item>
  </constraints>

  <out_of_scope>
    <item>seasons / episodes tables (Section 2.3 — explicitly not MVP).</item>
    <item>Catalog ingestion routines and the availability upsert/expire logic (Section 3.3) — RIK-3.</item>
    <item>IMDb CSV import processing logic (Section 7.3) — RIK-4 / RIK-5.</item>
    <item>Product queries (Section 8.1–8.3: "Qué ver este mes", discovery recommendations, "aún no visto") —
      RIK-7 / RIK-8.</item>
    <item>Auth routes, middleware, route guards — RIK-2.</item>
    <item>TypeScript types/, services/, actions/ layers — later tickets, once this schema exists.</item>
    <item>Seed or fixture data beyond what is strictly needed to create the two test auth users for RLS
      verification.</item>
    <item>Section 11 pending product/schema decisions (series catalog completeness, deep links per title,
      stub-enrichment process, watchlist-removal reconciliation policy, offer_type scope, public list slug
      global uniqueness) — flag these as follow-ups in the completion report; do not attempt to resolve them
      in this migration.</item>
  </out_of_scope>

  <implementation_notes>
    <item>Use `gen_random_uuid()` for UUID defaults exactly as the doc specifies — confirm the pgcrypto/
      pgcrypto-equivalent extension is available in the target Postgres (Supabase enables this by default via
      `pgcrypto` or built-in `gen_random_uuid()` in Postgres 15+; no extra `create extension` statement should
      be needed on a standard Supabase project, but verify locally and add it only if `gen_random_uuid()`
      actually fails).</item>
    <item>Timestamp the two migration files with the actual completion time (YYYYMMDDHHMMSS), migration 2's
      timestamp strictly after migration 1's.</item>
    <item>When testing RLS as a specific user without a real HTTP session, use Postgres role/JWT claim
      simulation (e.g. `set local role authenticated; select set_config('request.jwt.claims',
      json_build_object('sub', '&lt;test-user-uuid&gt;')::text, true);`) or the Supabase CLI's local auth
      tooling — whichever is available in this environment — rather than skipping the live verification.</item>
  </implementation_notes>

  <deliverables>
    <item>supabase/migrations/&lt;timestamp&gt;_create_mvp_schema.sql</item>
    <item>supabase/migrations/&lt;timestamp+1&gt;_enable_rls_policies.sql</item>
    <item>supabase/config.toml if it had to be scaffolded</item>
    <item>Run `npm run lint` and fix any introduced issues (should be none — no TypeScript/JS touched).</item>
    <item>Persist documentation per completion_report/persistence below: one CHANGELOG.md bullet under
      [Unreleased] and one specs/logs/ file.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Two migration files (DDL then RLS) vs. one combined file — proceeding with two, matching the
      ticket's own two-part description. Confirm with the user before merging into one if preferred.</item>
    <item>handle_updated_at() implementation — proceeding with the standard minimal
      `new.updated_at = now(); return new;` version since the schema doc names but never defines it.</item>
    <item>media_genres / media_people RLS — proceeding by extending the documented catalog-group pattern to
      these two junction tables, since Section 9's table doesn't name them explicitly but they have no owner
      column.</item>
    <item>imdb_import_rows RLS — proceeding with an EXISTS-subquery owner-only policy against
      imdb_import_batches.user_id, since the table has no user_id column of its own and Section 9 gives no
      explicit SQL for it.</item>
    <item>Explicit anon/authenticated SELECT grants on all 8 catalog tables — proceeding with adding them
      explicitly (not just user_lists/list_items as literally shown in 9.2), to avoid depending on unverified
      default Supabase project grants.</item>
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
        <item>Format: `- RIK-1: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-1_database_schema_rls.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to database_schema_rls, matching specs/backlog/RIK-1_database_schema_rls.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-1_database_schema_rls.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: migration / types / services / actions / ingestion / features / components / routes — here it will be almost entirely "migration"), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-1 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a schema/config change uses the wrench emoji 🔧, unless this reads more like a new feature ✨ — pick whichever the mapping best supports).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables (e.g. "the database backing every other Rikuna screen is now in place"); a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a closing "Notes" line naming the deferred Section-11 items in plain language.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the streaming catalog and per-user watch data now have a real, secured home" instead of naming tables.</item>
      <item>No Screenshots section — this ticket has no user-visible UI.</item>
      <item>Keep it under 15 lines.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. This ticket is Database/schema-only, so include ONLY a
        "## Prerequisites" section (local Supabase running, two test auth users created) and a
        "## Database validation" section with runnable, READ-ONLY SQL in fenced blocks — one query per
        acceptance criterion, using the real table/column names from this ticket, stating what each query
        should return (row presence/absence, relrowsecurity = true, permission-denied errors). Do not include a
        "## UI validation" section — there is none.</item>
      <item>End with "## Expected outcome" — 3-4 bullets tying back to AC-1 through AC-6.</item>
    </deliverable>
  </completion_report>
</task>
```
