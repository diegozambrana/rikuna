-- RIK-4: authenticated INSERT policies for IMDb import stub creation.
-- Source of truth: specs/RIKUNA-PRD-schema-basedatos-rikuna.md, Section 7.3.
--
-- RIK-1's RLS migration (20260809134405) only granted SELECT on the catalog
-- group (media_items, genres, media_genres, people, media_people) — there was
-- no authenticated-role write policy at all, so a user-triggered IMDb import
-- could not create stub titles/genres/people without a service-role client.
-- This is policy-only: no table or column changes, RIK-1 still owns the schema.
--
-- media_items is scoped to `is_stub = true` so an authenticated user can only
-- ever insert a stub row (never a fully-enriched one) through this path.
-- genres/people/media_genres/media_people have no owner or stub concept of
-- their own, so the insert is unrestricted for the authenticated role, same
-- as the ingestion/catalog/ service-role path would produce.

create policy "media_items_insert_stub" on public.media_items
    for insert to authenticated
    with check (is_stub = true);

create policy "genres_insert" on public.genres
    for insert to authenticated
    with check (true);

create policy "people_insert" on public.people
    for insert to authenticated
    with check (true);

create policy "media_genres_insert" on public.media_genres
    for insert to authenticated
    with check (true);

create policy "media_people_insert" on public.media_people
    for insert to authenticated
    with check (true);
