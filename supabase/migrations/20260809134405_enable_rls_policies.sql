-- RIK-1: Row Level Security for the Rikuna MVP schema (v3)
-- Source of truth: specs/RIKUNA-PRD-schema-basedatos-rikuna.md, Section 9.
--
-- RLS is enabled on ALL 14 tables, not only the ones holding personal data.
-- Reason: Supabase's default project-level privileges grant the `authenticated`
-- role table-level INSERT/UPDATE/DELETE on public schema tables. Enabling RLS
-- only on personal-data tables would leave catalog tables writable by any
-- authenticated end user. service_role bypasses RLS automatically (BYPASSRLS),
-- so ingestion routines are unaffected.
--
-- auth.uid() calls are wrapped in `(select auth.uid())` per Supabase's RLS
-- performance guidance (initplan caching instead of a per-row function call).
-- This is behaviorally identical to the doc's bare `auth.uid()` — same rows
-- match, only evaluation cost differs.

-- ---------------------------------------------------------------------------
-- Catalog group: public read, no write policy (service_role bypasses RLS).
-- media_genres / media_people are treated as part of this group even though
-- Section 9's table doesn't name them explicitly — they have no owner column
-- and belong to the same public catalog data as their parent tables.
-- ---------------------------------------------------------------------------
alter table public.media_items        enable row level security;
alter table public.genres             enable row level security;
alter table public.media_genres       enable row level security;
alter table public.people             enable row level security;
alter table public.media_people       enable row level security;
alter table public.platforms          enable row level security;
alter table public.catalog_snapshots  enable row level security;
alter table public.media_availability enable row level security;

create policy "media_items_select" on public.media_items
    for select using (true);
create policy "genres_select" on public.genres
    for select using (true);
create policy "media_genres_select" on public.media_genres
    for select using (true);
create policy "people_select" on public.people
    for select using (true);
create policy "media_people_select" on public.media_people
    for select using (true);
create policy "platforms_select" on public.platforms
    for select using (true);
create policy "catalog_snapshots_select" on public.catalog_snapshots
    for select using (true);
create policy "media_availability_select" on public.media_availability
    for select using (true);

-- Without this grant, RLS never gets evaluated and anon/authenticated see
-- nothing (Section 9.2's own explanation, applied to every publicly-read table).
grant select on public.media_items        to anon, authenticated;
grant select on public.genres             to anon, authenticated;
grant select on public.media_genres       to anon, authenticated;
grant select on public.people             to anon, authenticated;
grant select on public.media_people       to anon, authenticated;
grant select on public.platforms          to anon, authenticated;
grant select on public.catalog_snapshots  to anon, authenticated;
grant select on public.media_availability to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner-only group with a direct user_id column — Section 9.1 pattern.
-- ---------------------------------------------------------------------------
alter table public.user_subscriptions  enable row level security;
alter table public.user_media_status   enable row level security;
alter table public.imdb_import_batches enable row level security;

create policy "owner_all" on public.user_subscriptions
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "owner_all" on public.user_media_status
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "owner_all" on public.imdb_import_batches
    for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- imdb_import_rows: no user_id column of its own — ownership is derived via
-- batch_id -> imdb_import_batches.user_id. Never publicly readable.
-- ---------------------------------------------------------------------------
alter table public.imdb_import_rows enable row level security;

create policy "owner_all" on public.imdb_import_rows
    for all using (
        exists (
            select 1 from public.imdb_import_batches b
            where b.id = imdb_import_rows.batch_id
              and b.user_id = (select auth.uid())
        )
    ) with check (
        exists (
            select 1 from public.imdb_import_batches b
            where b.id = imdb_import_rows.batch_id
              and b.user_id = (select auth.uid())
        )
    );

-- ---------------------------------------------------------------------------
-- 9.2 user_lists + list_items — the mixed public/private case.
-- ---------------------------------------------------------------------------
alter table public.user_lists enable row level security;
alter table public.list_items enable row level security;

-- Lectura: pública si is_public=true (incluye rol "anon", es decir sin sesión),
-- o si el que consulta es el dueño
create policy "user_lists_select" on public.user_lists
    for select using (is_public or (select auth.uid()) = user_id);

create policy "user_lists_write" on public.user_lists
    for insert with check ((select auth.uid()) = user_id);
create policy "user_lists_update" on public.user_lists
    for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_lists_delete" on public.user_lists
    for delete using ((select auth.uid()) = user_id);

-- list_items hereda la visibilidad de su lista padre
create policy "list_items_select" on public.list_items
    for select using (
        exists (
            select 1 from public.user_lists l
            where l.id = list_items.list_id
              and (l.is_public or l.user_id = (select auth.uid()))
        )
    );

create policy "list_items_write" on public.list_items
    for all using (
        exists (select 1 from public.user_lists l where l.id = list_items.list_id and l.user_id = (select auth.uid()))
    ) with check (
        exists (select 1 from public.user_lists l where l.id = list_items.list_id and l.user_id = (select auth.uid()))
    );

-- El rol "anon" (visitante sin sesión) necesita el grant, además de la policy;
-- sin este grant, RLS nunca llega a evaluarse y el visitante no ve nada
grant select on public.user_lists  to anon, authenticated;
grant select on public.list_items  to anon, authenticated;
