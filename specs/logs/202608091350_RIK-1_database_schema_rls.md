# RIK-1 — Database schema and RLS

| Field | Value |
|---|---|
| Ticket | RIK-1 |
| Completed | 2026-08-09 13:50 (local) |
| Log file | `specs/logs/202608091350_RIK-1_database_schema_rls.md` |
| Backlog spec | `specs/backlog/RIK-1_database_schema_rls.md` |
| Status | completed |

## Summary

Delivered the foundational Postgres schema and Row Level Security policies for Rikuna as two migrations under `supabase/migrations/`, matching `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Sections 2–9 verbatim. Every future ticket (auth, ingestion, imports, panel, recommendations, lists) now has a real schema and per-user isolation to build against. Verified locally against a running Supabase instance with two real test auth accounts, not just by reading the SQL.

## Scope delivered

- DDL for all 14 MVP tables (catalog, availability, personal data, imports), the `public.handle_updated_at()` trigger function, and its trigger on the 4 tables that have `updated_at`.
- RLS enabled on all 14 tables, with public-read/no-write policies for the 8 catalog-group tables (including the two junction tables), owner-only policies for the 4 direct-`user_id` tables, an EXISTS-subquery owner policy for `imdb_import_rows`, and the mixed public/private policies for `user_lists` / `list_items`.
- Explicit `grant select ... to anon, authenticated` on every publicly-read table.
- Full local verification: schema/index/constraint diff against the doc, `relrowsecurity` check, and live RLS behavior tests using two real Supabase Auth users plus the `anon` role.

## Files changed

### Created

- `supabase/migrations/20260809134328_create_mvp_schema.sql` — DDL for all 14 tables + `handle_updated_at()` + the 4 `updated_at` triggers.
- `supabase/migrations/20260809134405_enable_rls_policies.sql` — RLS enable + policies + grants for all 14 tables.
- `CHANGELOG.md` — appended one `[Unreleased] / Added` bullet for RIK-1.
- `specs/logs/202608091350_RIK-1_database_schema_rls.md` — this file.

### Modified

- None (no `supabase/config.toml` scaffolding was needed — `supabase/` already existed in the repo with `config.toml` in place).

### Deleted

- None.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | `information_schema.columns` column counts per table matched the doc exactly (media_items=22, genres=3, media_genres=2, people=4, media_people=5, platforms=6, catalog_snapshots=8, media_availability=10, user_subscriptions=9, user_media_status=13, user_lists=8, list_items=6, imdb_import_batches=11, imdb_import_rows=10). `pg_indexes` showed the expected index count per table and `pg_constraint` showed every PK/unique/FK/check constraint from Sections 2–7 (e.g. `media_items_imdb_id_uq`, `media_availability_uq`, `user_media_status_rating_chk`, `user_subscriptions_active_uq`). |
| AC-2 | PASS | `select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'` returned `relrowsecurity = t` for all 14 tables. |
| AC-3 | PASS | Created real auth users A (`2e9f0658-4183-4a34-baee-5c406f8afe2c`) and B (`c2a5c3cb-9d70-45ba-b688-2e05d229c8f6`) via the GoTrue admin API. Inserted rows as A into `user_subscriptions`, `user_media_status`, `imdb_import_batches`, `imdb_import_rows` (JWT simulated via `set local role authenticated; select set_config('request.jwt.claims', ...)`). As B: `select count(*)` on all four returned 0, and `update` statements against A's rows affected 0 rows. |
| AC-4 | PASS | Created one private (`is_public=false`) and one public (`is_public=true`) `user_lists` row for A, each with one `list_items` row. As B and as `anon`: private list and its items returned 0 rows; public list and its items returned 1 row each (fully readable). |
| AC-5 | PASS | As `anon`: `select` on `media_items`/`platforms` returned rows (1 each, the seeded fixtures), `select` on the empty catalog tables returned 0 rows with no error; `insert into platforms` raised `new row violates row-level security policy for table "platforms"`. As authenticated non-owner (user A, who owns no catalog rows): `insert into media_items` raised the same RLS violation; `update media_items` and `delete from platforms` both affected 0 rows (no write policy exists, so USING evaluates to false for every row). |
| AC-6 | PASS | Updated one row each in `media_items`, `user_subscriptions`, `user_media_status`, `user_lists` (1s apart via `pg_sleep(1)`) and confirmed `updated_at` advanced on all four. A follow-up `information_schema.columns` query for `updated_at` across the other 10 tables returned 0 rows, confirming the column does not exist there. |

## Decisions

- **Two migration files** (DDL then RLS), matching the ticket's own two-part phrasing — not merged into one.
- **`handle_updated_at()`** implemented as the standard minimal `new.updated_at = now(); return new;` in `plpgsql`, since the schema doc names it but never defines it.
- **`media_genres` / `media_people`** were added to the catalog RLS group (public SELECT policy, explicit anon/authenticated grant, no write policy) even though Section 9's table doesn't name them explicitly — they're junction tables for public catalog data with no owner column, so the same pattern applies.
- **`imdb_import_rows`** uses an EXISTS-subquery policy against `imdb_import_batches.user_id` (no public branch), since the table has no `user_id` column of its own and Section 9 gives no explicit SQL for it.
- **Explicit anon/authenticated SELECT grants** were added to all 8 catalog tables (not just `user_lists`/`list_items` as literally shown in 9.2), per the ticket's own reasoning in Section 9.2: without the grant, RLS never gets evaluated and the row is invisible regardless of the policy.
- **`(select auth.uid())`** was used instead of a bare `auth.uid()` in every RLS policy (owner-only tables and `user_lists`/`list_items`). This is Supabase's documented RLS performance pattern (wrapping the function call lets Postgres cache it once via an initplan instead of calling it per row) and is behaviorally identical to the doc's literal SQL — same rows match either way, confirmed by the AC-3/AC-4 test results above.

## Deferred / follow-ups

- Section 11 pending product/schema decisions were **not** resolved in this migration, per the ticket's explicit scope:
  1. Full series catalog completeness for `media_availability` — depends on the external ingestion process (RIK-3).
  2. Deep links per title in `media_availability.url` — depends on the external ingestion process (RIK-3).
  3. Stub-enrichment process for `is_stub = true` titles created from CSV import — future ticket, not yet assigned.
  4. Watchlist-removal reconciliation policy (option (b), "keep and report," is recommended in the doc but not enforced anywhere yet) — owns by RIK-4/RIK-5 (IMDb import processing).
  5. `offer_type` scope (subscription vs. rent/buy) — column exists with a default, but no ticket yet decides whether rent/buy will actually be populated.
  6. Public list slug global uniqueness — `user_lists_user_slug_uq` is per-user only; the public share link (`/l/[codigo]`) will need a separate globally-unique code, per the doc's own recommendation — owned by RIK-11 (public list sharing).
- The media-availability upsert/expire application logic (Section 3.3) and the Section 8 product queries were intentionally not implemented — DDL only, per ticket scope (owned by RIK-3, RIK-7, RIK-8 respectively).

## Verification

- `supabase db reset` — applied both migrations cleanly from scratch (twice: once for testing, once more to leave a clean local database after RLS testing).
- `information_schema.columns` / `pg_indexes` / `pg_constraint` diffed against the schema doc, table by table.
- `pg_class.relrowsecurity` checked for all 14 tables.
- Live RLS behavior verified with two real Supabase Auth users (created via the local GoTrue admin API) and the `anon` role, using `set local role` + `set_config('request.jwt.claims', ...)` to simulate each identity per the ticket's own suggested approach.
- `npm run lint` — passed with no output (no TypeScript/JS was touched by this ticket).

## Manual validation

See the `manual_validation` deliverable in the PR/issue description for the exact runnable SQL — reproduced here for the audit trail:

### Prerequisites

- Local Supabase running: `supabase start` (or already running via `supabase status`).
- Two test auth users created via the GoTrue admin API (see commands below) — replace the UUIDs in the queries with the ones returned.

```bash
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"user-a@example.com","password":"Password123!","email_confirm":true}'
```

### Database validation

```sql
-- AC-1: all 14 tables exist
select table_name from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
-- Expect: catalog_snapshots, genres, imdb_import_batches, imdb_import_rows,
-- list_items, media_availability, media_genres, media_items, media_people,
-- people, platforms, user_lists, user_media_status, user_subscriptions

-- AC-2: RLS enabled everywhere
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
-- Expect: relrowsecurity = true for all 14 rows

-- AC-3: owner isolation (run as user B via set_config, after A has inserted rows)
select count(*) from public.user_subscriptions where user_id = '<user-a-uuid>';
select count(*) from public.imdb_import_rows where batch_id = '<a-batch-uuid>';
-- Expect: 0 in both cases

-- AC-4: public/private list visibility (run as anon or user B)
select count(*) from public.user_lists where id = '<a-private-list-uuid>';
select count(*) from public.user_lists where id = '<a-public-list-uuid>';
-- Expect: 0 for the private list, 1 for the public list

-- AC-5: catalog read/write (run as anon or authenticated)
select count(*) from public.media_items; -- Expect: succeeds, returns rows
insert into public.platforms (name, slug) values ('x', 'x'); -- Expect: permission-denied / RLS violation error

-- AC-6: updated_at trigger
update public.user_lists set description = 'test' where id = '<a-list-uuid>' returning updated_at;
-- Expect: updated_at is newer than before the UPDATE
```

### Expected outcome

- AC-1/AC-2: schema and RLS enablement match the doc exactly, confirmed via catalog queries above.
- AC-3: user B and anonymous requests see zero rows and cannot mutate user A's private-data rows.
- AC-4: a private list is invisible without ownership; a public list and its items are visible to anyone, session or not.
- AC-5/AC-6: the catalog is publicly readable but not writable by end users, and `updated_at` auto-advances only on the 4 documented tables.
