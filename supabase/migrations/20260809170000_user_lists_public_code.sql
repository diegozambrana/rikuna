-- RIK-11: Public list sharing — adds the globally-unique short code that
-- backs /l/[codigo]. Source of truth: specs/RIKUNA-PRD-schema-basedatos-rikuna.md
-- Section 11.6 — user_lists.slug is unique only per (user_id, slug) and must
-- never be used as the public identifier for a shared list.
--
-- Nullable, no default, no backfill: a list has no public_code until the
-- first time it is published (see services/ListServices.setListVisibility).
-- No RLS changes needed here — Section 9.2's existing user_lists policies
-- are row-level and already cover this new column.

alter table public.user_lists
    add column if not exists public_code varchar;

-- Partial unique index tolerates multiple NULL rows (lists never published)
-- while guaranteeing every assigned code is globally unique.
create unique index if not exists user_lists_public_code_uq
    on public.user_lists (public_code)
    where public_code is not null;
