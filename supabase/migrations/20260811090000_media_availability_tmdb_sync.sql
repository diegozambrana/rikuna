-- RIK-17: availability sync from the TMDB watch providers API
-- (/movie/{id}/watch/providers, /tv/{id}/watch/providers).
--
-- Adds (a) the per-row control column that tracks whether a media_items row
-- has already had its availability pass — same shape as tmdb_sync_status
-- (20260810180000) — and (b) a provenance column on media_availability.
--
-- Why `source` is not optional: ingestion/catalog/run.ts closes every load
-- with MediaAvailabilityServices.expireStale(), which flips is_available=false
-- for any row of that platform+country whose last_snapshot_id isn't this run's
-- — including the rows where it is NULL. The rows this new sync writes belong
-- to no snapshot, so without this column the next catalog load would silently
-- switch off every TMDB-sourced link and the ficha's "Dónde ver" section would
-- empty itself with no trace. With `source`, each path only expires its own.
-- The default 'catalog' is correct for the rows that already exist: today
-- ingestion/catalog is the table's only writer.
--
-- Known trade-off, deliberately accepted: media_availability_uq stays
-- (media_id, platform_id, country, offer_type) WITHOUT source. If the catalog
-- and TMDB describe the same combination they share one row and the last
-- writer owns `source` — a catalog row touched by TMDB becomes 'tmdb' and
-- stops being expirable by expireStale. That's fine (TMDB is the fresher
-- source and reconcileForMedia does expire it), whereas adding source to the
-- unique key would produce duplicate badges on the ficha.
--
-- Why the availability timestamp IS a new column, unlike RIK-16 which reused
-- enriched_at: enriched_at means "the title's own metadata was filled in".
-- Overloading it would make a re-run of either sync indistinguishable from
-- the other.
--
-- Idempotent: `add column if not exists` / `create index if not exists`.
-- No RLS changes — writes go through the service-role client
-- (ingestion/availability-sync), and the existing media_items_select /
-- media_availability_select `using (true)` policies plus the table-level
-- `grant select` already cover the new columns.
-- ---------------------------------------------------------------------------
alter table public.media_items
    add column if not exists availability_sync_status varchar default 'pending' not null;
    -- 'pending' | 'synced' | 'not_found' | 'failed'

alter table public.media_items
    add column if not exists availability_synced_at timestamptz;

-- Partial index shaped after the only query that matters, listPending:
-- "pending AND tmdb_id is not null, oldest first". Indexing the status alone
-- wouldn't serve the second predicate, which is what excludes the titles that
-- haven't been through the TMDB details sync yet — those have no tmdb_id to
-- query watch providers with, and they enter this queue on their own the
-- moment /sincronizar fills it in.
create index if not exists media_items_availability_sync_idx
    on public.media_items (created_at)
    where availability_sync_status = 'pending' and tmdb_id is not null;

alter table public.media_availability
    add column if not exists source varchar default 'catalog' not null;
    -- 'catalog' (ingestion/catalog) | 'tmdb' (ingestion/availability-sync)

-- Serves reconcileForMedia's "what does this title currently have from TMDB"
-- read, which is the first thing every synced title does.
create index if not exists media_availability_source_idx
    on public.media_availability (media_id, source) where is_available;
