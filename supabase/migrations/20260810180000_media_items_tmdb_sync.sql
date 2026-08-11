-- RIK-16: TMDB catalog sync — adds the per-row control column that tracks
-- whether a media_items row has already been enriched from the TMDB API.
--
-- Both existing insert paths (services/ImdbImportServices.findOrCreateMediaItem
-- and services/MediaServices.upsertOrCreateStub) create rows with is_stub=true
-- and leave tmdb_id, poster_url, description, original_title, end_year,
-- content_rating, imdb_url and enriched_at NULL. Nothing ever filled them in,
-- so every row in the catalog is a stub today.
--
-- Why a dedicated status column and not just `tmdb_id is null`: a title TMDB
-- genuinely doesn't have must be distinguishable from one that was never
-- attempted, otherwise every run re-fetches the same hopeless rows forever.
-- The timestamp side is NOT duplicated — the schema already carries
-- enriched_at (Section 2.1, unused until now) and the sync writes it.
--
-- Idempotent: `add column if not exists` / `create index if not exists`.
-- No RLS changes — the sync writes through the service-role client
-- (ingestion/tmdb-sync), which bypasses RLS, and the existing
-- "media_items_select using (true)" policy already covers counting pending
-- rows from an end-user session.
-- ---------------------------------------------------------------------------
alter table public.media_items
    add column if not exists tmdb_sync_status varchar default 'pending' not null;
    -- 'pending' | 'synced' | 'not_found' | 'failed'

-- Partial index: the only query that matters is "give me the next N pending",
-- and once the catalog is synced the pending set is empty or tiny.
create index if not exists media_items_tmdb_sync_idx
    on public.media_items (tmdb_sync_status) where tmdb_sync_status = 'pending';
