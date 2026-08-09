# RIK-8 — Recomendaciones por descubrimiento

## Ticket summary

Ships the `/recomendaciones` screen: a page with two stacked blocks — (a) the subset of the user's watchlist that is available right now on their active subscription (the same cross-reference the panel uses), and (b) "Descubre algo nuevo," a live-computed list of well-rated, available, unseen titles that are **not** on the watchlist, filterable by genre. Cards in the discovery block offer "Agregar a watchlist" and "No me interesa" (`dismissed = true`).

- The discovery block must never resurface titles already on the watchlist, already watched, or already dismissed.
- The discovery block enforces the minimum rating/votes threshold from schema doc query 8.2 (`imdb_rating >= 7.0`, `imdb_votes >= 5000`) so low-vote "hidden gems" don't leak in.
- A genre filter (`Select`) narrows **both** blocks to titles carrying that genre — the base 8.2 query has no genre join, so this ticket adds one.
- "No me interesa" persists `dismissed = true` and the title stays gone across reloads.
- "Agregar a watchlist" from a discovery card must make that title appear in block (a) on the next page load.
- No team comments exist beyond the ticket text; the investigation below adds required detail (constants extraction, shared write-action reuse, genre-join extension) that the ticket implies but doesn't spell out.

---

## Context

### Original ticket

**RIK-8 — Recomendaciones por descubrimiento**

**Descripción:** Vista `/recomendaciones` con dos bloques: (a) subconjunto de la watchlist disponible ahora (reuso de la consulta del panel), y (b) descubrimiento — títulos bien calificados, disponibles, no vistos y fuera de la watchlist (consulta 8.2 del esquema), con filtro por género y acción de descartar (`dismissed`).

**Criterios de aceptación:**

- El bloque "Descubre algo nuevo" nunca incluye títulos ya en la watchlist, ya vistos, o descartados.
- El bloque respeta el umbral mínimo de calificación y de votos definido en la consulta 8.2 (evita títulos con pocos votos).
- El filtro de género reduce ambos bloques a títulos que incluyen ese género.
- "No me interesa" marca `dismissed = true` y el título no vuelve a aparecer en recomendaciones (verificar recarga).
- "Agregar a watchlist" desde una tarjeta de descubrimiento la mueve al primer bloque en la siguiente carga.

**Dependencies (per backlog v1):** `depends_on RIK-1, RIK-2, RIK-3, RIK-6`.

The ticket targets a table/query (`media_items` filtered via `imdb_rating`/`imdb_votes`) that does not exist yet in this repo — `supabase/migrations/` is not created. This is expected: RIK-1 (schema), RIK-2 (auth/routes), RIK-3 (availability ingestion) and RIK-6 (active subscription) are assumed to land first per the task brief. This document specs the ticket against the schema those tickets will produce, not against the current empty repo.

### Team comments

None were provided for this ticket beyond the description and acceptance criteria above — there is no separate "authoritative comment" overriding the description. The investigation below surfaces implied scope the description doesn't spell out verbatim (genre join, constants extraction, shared write action) and treats those as required extensions, not comments.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| "(a) subconjunto de la watchlist disponible ahora (reuso de la consulta del panel)" | The sibling backlog lists `RIK-7` (panel) as depending on `RIK-1, RIK-2, RIK-3, RIK-4, RIK-6` and `RIK-8` as depending on `RIK-1, RIK-2, RIK-3, RIK-6` — **`RIK-8` does not depend on `RIK-7`**, and both are being spec'd/implemented by parallel processes with no guaranteed order. "Reuse the panel's query" cannot mean "import from `features/panel`" — it means both tickets must share one query 8.1 implementation living in the `services/`/`actions/recommendations` layer, wherever it lands first. |
| "consulta 8.2 del esquema" ... "con filtro por género" | The verbatim query in `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Section 8.2 (lines 385–404) has **no genre filter or join at all**. Genres live in a separate many-to-many junction (`media_genres` → `genres`, Section 2.2, lines 72–104). | The genre filter is this ticket's own extension of the base query, not something to copy verbatim. Must add a join through `media_genres`/`genres` and a `WHERE genres.slug = :genre` (or equivalent PostgREST filter) to **both** blocks, while preserving `select distinct` so multi-genre titles don't duplicate. |
| Ticket does not mention where the `7.0` / `5000` thresholds live | `ARCHITECTURE.md` (line 206) explicitly names `constants/recommendationThresholds.ts` — `minRating`, `minImdbVotes`, `minVotesFloor` — as the place recommendation thresholds belong, and that file/directory does not exist yet (fresh scaffold; `constants/` is one of the directories confirmed absent). | This ticket must create `constants/recommendationThresholds.ts` and read the thresholds from it in the discovery query rather than leaving `7.0`/`5000` as magic numbers inline in a service — required by the project's own architecture doc even though the ticket text doesn't ask for it explicitly. |
| Note under the ticket: "'Agregar a watchlist' ... should reuse the shared `user_media_status` server action pattern (also used by RIK-7 and RIK-9)" | `actions/media-status/` does not exist yet. Nothing currently defines this "shared pattern" in code. | This ticket is the one that must actually create the first cut of `actions/media-status/` (add-to-watchlist, dismiss), structured so RIK-7 (mark-watched-from-card) and RIK-9 (title detail actions) can extend it later — or extend it in place if a parallel ticket created it first. |
| Ticket says nothing about layout mechanics (`Tabs` vs. stacked blocks) | `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Section 2.2 (`/recomendaciones`, lines 108–114) explicitly allows either: "dos secciones con `Tabs` o simplemente dos bloques apilados con títulos claros." | Non-blocking choice; recorded as a default below (stacked blocks, matching the AC wording "el primer bloque"). |

### Current database state

No `supabase/migrations/` exists in this repo yet. The schema below is copied from `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` (v3) and corroborated by the already-written `specs/backlog/RIK-1_database_schema_rls.md`, which confirms the DDL is taken verbatim from that PRD doc with no renames relevant to this ticket. Treat the following as ground truth once RIK-1 lands:

- **`media_items`** (Section 2.1, lines 24–68) — relevant columns: `id uuid`, `title varchar`, `slug varchar unique`, `type varchar`, `year integer`, `imdb_rating numeric(3,1)`, `imdb_votes integer`, `poster_url text`, `is_stub boolean`. RLS: public read (Section 9), write restricted to admin/ingestion.
- **`genres`** / **`media_genres`** (Section 2.2, lines 72–86) — `genres(id, name, slug unique)`; `media_genres(media_id, genre_id)` composite PK junction, indexed on `genre_id`. RLS: public read, same as parent catalog group per `RIK-1_database_schema_rls.md` Decision 3.
- **`media_availability`** (Section 3.3) — `media_id`, `platform_id`, `country varchar(2)`, `is_available boolean`. RLS: public read.
- **`user_subscriptions`** (Section 4, lines 190–215) — `user_id`, `platform_id`, `country`, `ended_on date` (`null` = active). Unique partial index guarantees at most one active row per `(user_id, platform_id, country)`. RLS: owner-only.
- **`user_media_status`** (Section 5, lines 224–253) — `user_id`, `media_id`, `watched boolean`, `want_to_watch boolean`, `dismissed boolean`, `source varchar` (`'manual' | 'imdb_ratings' | 'imdb_watchlist'`), `manually_edited boolean`, unique on `(user_id, media_id)`. RLS: owner-only. Business rule (line 257): `watched` and `want_to_watch` are independent; if both are true, `watched` wins and the title must **not** appear in "Qué ver este mes" (this rule carries over into query 8.2's discovery filter via the same `coalesce(ums.watched, false) = false` guard).

No `types/`, `services/`, `actions/`, `features/`, `constants/` directories exist in this repo as of this spec. They are expected to exist by the time this ticket executes (RIK-1/RIK-2 create the base layers per `ARCHITECTURE.md`); if they still don't, this ticket's implementer must create them following the sibling pattern documented there.

### Current logic (recommendations)

No recommendations logic exists in code — this is greenfield. The two queries this ticket implements, verbatim from `specs/RIKUNA-PRD-schema-basedatos-rikuna.md`:

**Block (a) — query 8.1, "Qué ver este mes" (lines 361–381):**

```sql
select distinct mi.*
from public.media_items mi
join public.user_media_status ums
     on ums.media_id = mi.id
    and ums.user_id = auth.uid()
    and ums.want_to_watch
    and not ums.watched
    and not ums.dismissed
join public.media_availability ma
     on ma.media_id = mi.id
    and ma.is_available
join public.user_subscriptions us
     on us.platform_id = ma.platform_id
    and us.country     = ma.country
    and us.user_id     = auth.uid()
    and us.ended_on is null
order by mi.imdb_rating desc nulls last;
```

**Block (b) — query 8.2, "Recomendaciones por descubrimiento" (lines 385–404), base version with no genre filter:**

```sql
select distinct mi.*
from public.media_items mi
join public.media_availability ma
     on ma.media_id = mi.id and ma.is_available
join public.user_subscriptions us
     on us.platform_id = ma.platform_id
    and us.country     = ma.country
    and us.user_id     = auth.uid()
    and us.ended_on is null
left join public.user_media_status ums
     on ums.media_id = mi.id and ums.user_id = auth.uid()
where coalesce(ums.watched,       false) = false
  and coalesce(ums.want_to_watch, false) = false
  and coalesce(ums.dismissed,     false) = false
  and mi.imdb_rating >= 7.0
  and mi.imdb_votes  >= 5000        -- evita "joyas" falsas con muy pocos votos
order by mi.imdb_rating desc
limit 50;
```

Product spec confirms (`RIKUNA-PRD-documento-especificacion-rikuna.md`, line 176) that these lists must be **computed live** by the app on each request, not precalculated by the external catalog process — marking a title watched or dismissed must immediately affect what block (b) returns, so this is application-layer query logic, not a materialized/cached list.

### Requested field mapping

No new columns are requested by this ticket — it is a read-query + write-action + UI ticket. The table below maps the columns the queries depend on to their status.

| Field requested | Type | Existing equivalent | Verdict |
| --- | --- | --- | --- |
| Rating threshold (`imdb_rating >= 7.0`) | numeric(3,1) comparison | `media_items.imdb_rating` (Section 2.1) | already exists (reuse) — must be sourced from `constants/recommendationThresholds.ts`, not hardcoded |
| Votes threshold (`imdb_votes >= 5000`) | integer comparison | `media_items.imdb_votes` (Section 2.1) | already exists (reuse) — same constants file |
| Genre filter | join/filter | `media_genres` / `genres.slug` (Section 2.2) | already exists (reuse) — must be added as an explicit join, absent from the base 8.2 query |
| "Dismissed" flag | boolean | `user_media_status.dismissed` (Section 5) | already exists (reuse) |
| "Add to watchlist" flag | boolean | `user_media_status.want_to_watch` (Section 5) | already exists (reuse) |
| Active subscription check | join | `user_subscriptions.ended_on is null` (Section 4) | already exists (reuse) |

### Impacted files

- `constants/recommendationThresholds.ts` (new) — extracts `7.0` / `5000` out of raw SQL per `ARCHITECTURE.md`.
- `services/RecommendationServices/index.ts` (new, or extend if a parallel RIK-7 run already created it) — centralizes queries 8.1 and 8.2 (with genre join extension) and their row mapping into `MediaItem[]`.
- `actions/recommendations/index.ts` (new, or extend) — session check, calls `RecommendationServices`, returns both blocks for the page.
- `actions/media-status/index.ts` (new, or extend) — `addToWatchlist(mediaId)` and `dismissRecommendation(mediaId)` server actions writing `user_media_status` with `manually_edited = true`, `source = 'manual'`; `revalidatePath('/recomendaciones')`. Structured for RIK-7/RIK-9 reuse per the ticket's own note.
- `types/index.ts` (modified, if not already covering it) — confirm `MediaItem` and `Genre` shapes are exported; add a small `DiscoveryFilters`-style input type if useful.
- `features/recommendations/` (new) — `RecommendationsScreen.tsx` (composes both blocks), `GenreFilterSelect.tsx` (client component driving the `?genero=` search param), `DiscoveryCard.tsx` (wraps the shared `MediaCard` with the two action buttons).
- `app/(app)/recomendaciones/page.tsx` (new) — Server Component reading `searchParams.genero`, calling `actions/recommendations`, rendering the feature screen. Lives inside the `(app)` route group so the existing auth guard applies — no new middleware work.
- `components/MediaCard/` — reused as-is for both blocks; only add the two action buttons at the composition level (`DiscoveryCard`), not inside the shared card, unless the card already supports a slot/actions prop.
- Tests — no test suite exists yet in this repo; note where discovery-query unit/integration coverage should live when a test setup is added (e.g. `services/RecommendationServices/*.test.ts`), but do not block this ticket on adding a framework.

### Decisions made

1. **Query 8.1 and 8.2 live in a new `services/RecommendationServices`**, even though it isn't named in `ARCHITECTURE.md`'s current services bullet list (that list reflects nothing having been built yet, not an exhaustive future roster). If a parallel `RIK-7` implementation already created a service exposing query 8.1, **reuse it** instead of duplicating — check `services/` before creating. Recommended default, not confirmed by the user.
2. **Genre filtering is implemented as an explicit extension** (`left join media_genres … left join genres … and (genre_slug is null or genres.slug = genre_slug)`) preserving `select distinct` on both queries, since the base 8.2 SQL has no genre awareness. Recommended default.
3. **`constants/recommendationThresholds.ts` exports `RECOMMENDATION_THRESHOLDS = { minRating: 7.0, minImdbVotes: 5000, minVotesFloor: 5000 }`**, matching the three names `ARCHITECTURE.md` already commits to (`minRating`, `minImdbVotes`, `minVotesFloor`) even though query 8.2 only uses two thresholds. `minVotesFloor` is set equal to `minImdbVotes` today as a defensive floor reserved for a future admin-tunable `minImdbVotes`; not exercised by this ticket's query. **Recommended default, unconfirmed** — flagged in `<clarify_before_coding>`.
4. **The genre filter is carried in the URL as `?genero=<slug>`**, read server-side in `app/(app)/recomendaciones/page.tsx`, rather than a client Zustand store — the only client interaction here is picking a genre and re-fetching server data, which a plain navigation/search-param round-trip handles without extra client state. Recommended default; deviates from the general "Zustand for filters" pattern in `ARCHITECTURE.md` for this specific low-complexity case.
5. **Genre dropdown options come from the full `genres` table** (`select id, name, slug from genres order by name`), not scoped to genres actually present in eligible titles. Simpler, avoids an extra aggregation query; a not-yet-eligible genre simply returns an empty block. Recommended default.
6. **Layout uses two stacked blocks**, not `Tabs` — both are allowed by `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Section 2.2; stacked blocks match the ticket AC's own wording ("el primer bloque") more directly than a tab-switch UI would. Recommended default.
7. **`actions/media-status/index.ts` is created (or extended) by this ticket** with `addToWatchlist` and `dismissRecommendation`, both doing the session check + `revalidatePath('/recomendaciones')` and, when applicable, `revalidatePath('/panel')`. This is directly requested by the ticket's own note about the shared action pattern, not a new decision — recorded here for traceability.
8. **The base query's `limit 50` on block (b) is kept as-is**; no pagination or infinite scroll is added in this ticket. Recommended default.

### Out of scope

- Building the `/panel` screen itself (RIK-7) — this ticket only needs query 8.1's result for block (a); the full panel UI (active-service header, empty-state CTA) is RIK-7's responsibility.
- Full title detail navigation target (`/titulo/[slug]`) — RIK-9. Cards here only need to link there, not implement the destination.
- "Marcar visto" from a recommendation card — not in this ticket's acceptance criteria; the shared `actions/media-status` module should be structured so RIK-9 can add it later without restructuring.
- Pagination/infinite scroll beyond the `limit 50` in query 8.2.
- `offer_type` (rental/purchase vs. subscription) distinctions — schema doc Section 11, pending item #5, unresolved.
- Any `(public)` / unauthenticated variant of `/recomendaciones` — this screen is entirely inside `(app)`; there is no public equivalent per the routes table in `ARCHITECTURE.md`.
- Admin-configurable thresholds UI — `RECOMMENDATION_THRESHOLDS` is a static code constant in this ticket, not a settings screen.

---

## Implementation plan

**Goal:** Compute and render `/recomendaciones` as two live blocks — watchlist-available (query 8.1) and discovery (query 8.2 + genre extension) — backed by a shared, reusable query and write-action layer, with thresholds pulled from `constants/recommendationThresholds.ts` instead of inline magic numbers.

**In scope:**

1. `constants/recommendationThresholds.ts` — `minRating`, `minImdbVotes`, `minVotesFloor`.
2. `services/RecommendationServices` — `getWatchlistAvailable({ genreSlug? })` (query 8.1 + genre join) and `getDiscovery({ genreSlug? })` (query 8.2 + genre join, thresholds from the constants file). Check for and reuse an existing implementation of 8.1 if `RIK-7` already shipped one.
3. `actions/recommendations` — session-checked orchestration returning `{ watchlistAvailable, discovery }` for the page; `actions/media-status` — `addToWatchlist`, `dismissRecommendation`, both `revalidatePath('/recomendaciones')`.
4. `features/recommendations` — `RecommendationsScreen`, `GenreFilterSelect` (drives `?genero=`), `DiscoveryCard` (adds the two action buttons around the shared `MediaCard`).
5. `app/(app)/recomendaciones/page.tsx` — Server Component wiring searchParams → actions → screen.

**Out of scope:** `/panel` build-out, `/titulo/[slug]` build-out, "marcar visto" from this screen, pagination, `offer_type`, public variant, threshold admin UI — see above.

**Key risks / compatibility:**

- `RIK-7` and `RIK-8` both need query 8.1 with no dependency ordering between them — risk of duplicated/divergent implementations if run out of order. Check `services/` for an existing 8.1 implementation before creating a new one.
- The `select distinct` on both queries must survive the added genre join — a title with multiple genres must not appear twice.
- `media_availability` and `user_subscriptions` will be empty until RIK-3/RIK-4 ingestion actually runs — both blocks legitimately render empty; needs a real (non-error) empty state, not a loading spinner stuck forever.
- Do not accidentally reintroduce a precalculated/cached discovery list — product spec explicitly requires live computation (`RIKUNA-PRD-documento-especificacion-rikuna.md`, line 176) so that marking watched/dismissed has immediate effect.

**Acceptance criteria mapping:**

| Ticket AC | Implementation coverage |
| --- | --- |
| Discovery block excludes watchlist/watched/dismissed titles | `getDiscovery`'s `coalesce(...) = false` guards on `watched`, `want_to_watch`, `dismissed` |
| Discovery block respects rating/votes threshold | `getDiscovery` filters using `RECOMMENDATION_THRESHOLDS.minRating` / `minImdbVotes` |
| Genre filter reduces both blocks | Genre join + filter added to both `getWatchlistAvailable` and `getDiscovery`, driven by `?genero=` |
| "No me interesa" persists and hides on reload | `dismissRecommendation` sets `dismissed = true`, `revalidatePath('/recomendaciones')` |
| "Agregar a watchlist" moves a title to block (a) on next load | `addToWatchlist` sets `want_to_watch = true`, `revalidatePath('/recomendaciones')`; block (a) query then includes it |

---

## Claude Code prompt

```xml
<task id="RIK-8" title="Recomendaciones por descubrimiento" depends_on="RIK-1, RIK-2, RIK-3, RIK-6">
  <role>
    You are a senior full-stack engineer working on Rikuna (Next.js 16 App Router + React 19 + TypeScript,
    Supabase/Postgres backend). Follow the project's layered + feature-sliced architecture exactly.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — full layered + feature-sliced layout, auth boundaries ((app)/(public)/(auth) route
      groups), the Server Actions and Services tables, and the constants/recommendationThresholds.ts mention
      (line ~206).</item>
    <item>AGENTS.md — this is a customized Next.js version; read the relevant guide under
      node_modules/next/dist/docs/ (resolved relative to AGENTS.md's directory) before writing any Next.js code.
      At minimum read node_modules/next/dist/docs/01-app/02-guides/server-actions.md,
      node_modules/next/dist/docs/01-app/02-guides/forms.md, and
      node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the commit_message
      deliverable below.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 2.2 (genres/media_genres, lines 72–104),
      Section 3.3 (media_availability), Section 4 (user_subscriptions), Section 5 (user_media_status,
      including the watched/want_to_watch independence rule at line 257), Section 8.1 (lines 361–381,
      "Qué ver este mes"), Section 8.2 (lines 385–404, discovery query — the exact base query to extend),
      Section 9 (RLS summary).</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 1 (design system: style "base-lyra", base color
      "mist") and Section 2.2's /recomendaciones entry (lines 108–114) for the two-block layout, genre Select
      placement, and the "No me interesa" button treatment.</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — line 176: recommendations must be computed live
      by the app per request, never precalculated/cached, so that marking watched/dismissed has immediate
      effect.</item>
    <item>specs/backlog/RIK-1_database_schema_rls.md — confirms the schema is implemented verbatim from the PRD
      schema doc with no renames relevant to this ticket; read its "Claude Code prompt" ground_truth_db_notes
      for the exact migration file names actually created.</item>
    <item>supabase/migrations/ — read the latest migration files (created by RIK-1) to confirm the live column
      names, types and RLS policies before writing any query against them.</item>
    <item>services/, actions/recommendations/, actions/media-status/, features/panel/ (if present) — check
      whether a parallel RIK-7 implementation already created a shared implementation of query 8.1
      ("Qué ver este mes"); if so, reuse it instead of duplicating the query.</item>
    <item>components/MediaCard/ — the shared poster+title+year+rating card component to reuse for both blocks.</item>
    <item>CHANGELOG.md — format and where to append the entry for this ticket.</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna cross-references a user's IMDb watch history against what's currently available on their active
    streaming subscription. This ticket builds /recomendaciones: two blocks. Block (a) is a subset of "Qué ver
    este mes" (watchlist titles available now on the user's active subscription, query 8.1) — reuse an existing
    implementation if one already exists from RIK-7's parallel track, otherwise implement it fresh in a way
    RIK-7 can reuse later. Block (b) is "Descubre algo nuevo" (query 8.2): well-rated, available, unseen titles
    outside the watchlist, extended with a genre filter that the base query does not have.

    No new database columns are needed — every field this ticket reads/writes already exists per schema doc
    Sections 2.1, 2.2, 3.3, 4 and 5: media_items.imdb_rating, media_items.imdb_votes, media_availability.is_available,
    user_subscriptions.ended_on, user_media_status.watched/want_to_watch/dismissed, media_genres/genres.slug.

    The 7.0 rating / 5000 votes thresholds in query 8.2 must NOT be left as inline magic numbers. Create
    constants/recommendationThresholds.ts exporting RECOMMENDATION_THRESHOLDS = { minRating: 7.0,
    minImdbVotes: 5000, minVotesFloor: 5000 } and read from it in the discovery query. minVotesFloor mirrors
    minImdbVotes today; it exists because ARCHITECTURE.md already names it, but it is not otherwise exercised
    by this ticket's logic.
  </context>

  <ground_truth_db_notes critical="true">
    <note>supabase/migrations/ does not exist in this repo until RIK-1 lands. Do not invent table/column names —
      read the actual migration files RIK-1 produces (or, if still absent, treat
      specs/RIKUNA-PRD-schema-basedatos-rikuna.md Sections 2–5 as ground truth, since RIK-1's own spec confirms
      it copies that DDL verbatim).</note>
    <note>The verbatim query 8.2 in the schema doc has NO genre filter or join. Adding one via media_genres/genres
      is this ticket's own required extension — do not present it as "the query as documented."</note>
    <note>media_genres and genres both allow public read (same RLS group as media_items) — the genre join does
      not need a service-role client; it works fine under the end user's own RLS-scoped session.</note>
    <note>user_media_status.watched and want_to_watch are independent booleans. If a title is both watched=true
      and want_to_watch=true, watched wins and it must NOT appear in either block — both queries already encode
      this via coalesce(ums.watched, false) = false, keep that guard intact.</note>
    <note>Do not import lib/supabase/admin.ts anywhere in this ticket's code — /recomendaciones is a fully
      user-facing, session-scoped screen; RLS via the user's own auth.uid() must do the filtering, not a
      service-role bypass.</note>
    <note>Do not add a new "recommendations" or "discovery" table. This is a computed read, never persisted —
      product spec explicitly requires live computation on every request so that marking a title
      watched/dismissed has immediate effect (RIKUNA-PRD-documento-especificacion-rikuna.md, line 176).</note>
    <note>RIK-8 depends on RIK-1, RIK-2, RIK-3, RIK-6 per the sibling backlog, but NOT on RIK-7 — the panel
      screen may or may not exist yet when this ticket runs. Check for an existing shared implementation of
      query 8.1 before creating a new one; do not silently duplicate it.</note>
  </ground_truth_db_notes>

  <story>
    Como usuario con una suscripción activa declarada, quiero ver, además de mi "Qué ver este mes", una sección
    de descubrimiento con títulos bien calificados y disponibles que aún no conozco ni tengo en mi lista, poder
    filtrarlos por género, y poder marcarlos como "no me interesa" o agregarlos a mi watchlist directamente desde
    la tarjeta, para decidir qué ver a continuación sin salir de la pantalla de recomendaciones.
  </story>

  <requirements>
    <phase title="Constants">
      <item>Create constants/recommendationThresholds.ts exporting RECOMMENDATION_THRESHOLDS = { minRating: 7.0,
        minImdbVotes: 5000, minVotesFloor: 5000 } as const.</item>
    </phase>

    <phase title="Services">
      <item>Check services/ for an existing implementation of query 8.1 (possibly created by a parallel RIK-7
        run). If found, reuse it. If not, create services/RecommendationServices/index.ts exporting a class that
        accepts a SupabaseClient in its constructor (dependency-injected, per ARCHITECTURE.md's service pattern)
        with:
        - getWatchlistAvailable(params?: { genreSlug?: string }): Promise&lt;MediaItem[]&gt; — query 8.1, extended
          with an optional genre join/filter, preserving DISTINCT.
        - getDiscovery(params?: { genreSlug?: string }): Promise&lt;MediaItem[]&gt; — query 8.2, using
          RECOMMENDATION_THRESHOLDS.minRating / minImdbVotes instead of inline numbers, extended with the same
          optional genre join/filter, preserving DISTINCT and the limit 50 cap.</item>
      <item>Row-map results into the existing MediaItem type from types/index.ts. Do not duplicate query shapes
        or row mapping in actions/ or in the UI layer.</item>
    </phase>

    <phase title="Actions">
      <item>Create or extend actions/recommendations/index.ts with a session-checked server function (e.g.
        getRecommendations(genreSlug?: string)) that verifies supabase.auth.getUser(), instantiates
        RecommendationServices with that same request-scoped client, and returns
        { watchlistAvailable: MediaItem[], discovery: MediaItem[] }.</item>
      <item>Create or extend actions/media-status/index.ts ("use server") with:
        - addToWatchlist(mediaId: string): Promise&lt;void&gt; — session check, upsert user_media_status with
          want_to_watch: true, manually_edited: true, source: 'manual', then revalidatePath('/recomendaciones')
          (and revalidatePath('/panel') if that route already exists).
        - dismissRecommendation(mediaId: string): Promise&lt;void&gt; — same pattern, dismissed: true.
        Structure both so RIK-7 (mark watched from panel card) and RIK-9 (title detail actions) can add sibling
        functions to this same module later without restructuring it.</item>
    </phase>

    <phase title="Features">
      <item>Create features/recommendations/RecommendationsScreen.tsx — a client or server composition component
        (per the project's "Server Components fetch, pass initial data to client feature components" pattern)
        rendering the two labeled blocks: "De tu lista de seguimiento, disponibles ahora" and "Descubre algo
        nuevo", per RIKUNA-PRD-vistas-y-estilo-rikuna.md Section 2.2.</item>
      <item>Create features/recommendations/GenreFilterSelect.tsx — a client component rendering a shadcn Select
        of genres (fetch all genres, ordered by name), that updates the ?genero=&lt;slug&gt; search param on the
        current route when changed (e.g. via useRouter + useSearchParams from next/navigation).</item>
      <item>Create features/recommendations/DiscoveryCard.tsx — wraps the shared components/MediaCard with two
        actions: "Agregar a watchlist" (calls addToWatchlist) and a discreet "No me interesa" icon button (calls
        dismissRecommendation), per the Section 2.2 UI notes. Both actions should show a loading/pending state and
        a toast (Sonner, per ARCHITECTURE.md) confirming the result.</item>
    </phase>

    <phase title="Routes">
      <item>Create app/(app)/recomendaciones/page.tsx as a Server Component. Read searchParams.genero (a genre
        slug or undefined), call the actions/recommendations function, and render RecommendationsScreen with the
        two result arrays and the current genre filter value. This route must live inside the existing (app)
        route group so the session guard already documented in ARCHITECTURE.md applies — do not add new
        middleware logic for this ticket.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">The "Descubre algo nuevo" block never includes a title that is on the user's watchlist
      (want_to_watch = true), already watched (watched = true), or dismissed (dismissed = true). Verify: seed a
      test user with one title in each state plus one eligible title, call getDiscovery, and confirm only the
      eligible title is returned.</criterion>
    <criterion id="AC-2">The discovery block excludes titles with imdb_rating &lt; RECOMMENDATION_THRESHOLDS.minRating
      or imdb_votes &lt; RECOMMENDATION_THRESHOLDS.minImdbVotes. Verify: seed one title at 6.9/10000 and one at
      7.0/4999, confirm both are excluded from getDiscovery's result; seed one at 7.0/5000, confirm it is
      included.</criterion>
    <criterion id="AC-3">Selecting a genre in the Select filters both blocks to titles carrying that genre only.
      Verify: seed two eligible discovery titles and one eligible watchlist-available title with different
      genres, select one genre in the UI (or call both service methods with genreSlug set), and confirm each
      block only returns titles tagged with that genre via media_genres/genres.</criterion>
    <criterion id="AC-4">Clicking "No me interesa" on a discovery card sets user_media_status.dismissed = true
      for that (user, media) pair, and the title does not reappear in the discovery block after a full page
      reload. Verify: call dismissRecommendation, then re-run getDiscovery (or reload /recomendaciones) and
      confirm the title is absent.</criterion>
    <criterion id="AC-5">Clicking "Agregar a watchlist" on a discovery card sets
      user_media_status.want_to_watch = true, and on the next load of /recomendaciones that title appears in
      block (a) (assuming it is also available on the user's active subscription) and no longer appears in block
      (b). Verify: call addToWatchlist, reload, confirm presence in getWatchlistAvailable and absence from
      getDiscovery.</criterion>
    <criterion id="AC-6">The 7.0 / 5000 thresholds are not hardcoded inline in the query/service — they are read
      from constants/recommendationThresholds.ts. Verify: grep services/RecommendationServices for the literals
      7.0 and 5000; they must not appear outside constants/recommendationThresholds.ts.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create any new database table or column. Every field used here already exists per schema doc
      Sections 2.1, 2.2, 3.3, 4, 5.</item>
    <item>Do NOT hardcode 7.0 or 5000 anywhere outside constants/recommendationThresholds.ts.</item>
    <item>Do NOT import lib/supabase/admin.ts from any file touched in this ticket — this is entirely a
      user-facing, RLS-scoped flow.</item>
    <item>Do NOT rename or bypass user_media_status.watched, want_to_watch, or dismissed — reuse them exactly as
      named.</item>
    <item>Do NOT duplicate the write logic for user_media_status in the UI layer or inline in the route —
      addToWatchlist/dismissRecommendation must live in actions/media-status/ so RIK-7 and RIK-9 can reuse them.</item>
    <item>Do NOT place /recomendaciones outside the (app) route group and do NOT add a (public) variant — there
      is no unauthenticated version of this screen per ARCHITECTURE.md's routes table.</item>
    <item>Do NOT lose the select distinct semantics on either query when adding the genre join — a title with
      multiple genres must not be returned twice.</item>
    <item>Do NOT build a cached/precomputed discovery list — recompute on every request per the product spec's
      explicit live-computation requirement.</item>
    <item>If services/RecommendationServices (or an equivalent already covering query 8.1) already exists from a
      parallel RIK-7 implementation, extend/reuse it — do not create a second, divergent implementation of the
      same query.</item>
  </constraints>

  <out_of_scope>
    <item>The /panel screen itself (RIK-7) — only its underlying query 8.1 result is needed here.</item>
    <item>The /titulo/[slug] detail screen (RIK-9) — cards here only need to link to it.</item>
    <item>"Marcar visto" action from a recommendation card — not required by this ticket's acceptance criteria.</item>
    <item>Pagination or infinite scroll beyond the existing limit 50 on the discovery query.</item>
    <item>offer_type (rental/purchase vs. subscription) distinctions — schema doc Section 11, unresolved.</item>
    <item>Any admin/settings UI for changing the recommendation thresholds at runtime.</item>
  </out_of_scope>

  <implementation_notes>
    <item>constants/recommendationThresholds.ts:
      export const RECOMMENDATION_THRESHOLDS = { minRating: 7.0, minImdbVotes: 5000, minVotesFloor: 5000 } as const;</item>
    <item>services/RecommendationServices/index.ts:
      class RecommendationServices { constructor(private supabase: SupabaseClient) {}
      async getWatchlistAvailable(params?: { genreSlug?: string }): Promise&lt;MediaItem[]&gt; { ... }
      async getDiscovery(params?: { genreSlug?: string }): Promise&lt;MediaItem[]&gt; { ... } }</item>
    <item>actions/recommendations/index.ts:
      export async function getRecommendations(genreSlug?: string): Promise&lt;{ watchlistAvailable: MediaItem[]; discovery: MediaItem[] }&gt;</item>
    <item>actions/media-status/index.ts:
      export async function addToWatchlist(mediaId: string): Promise&lt;void&gt;
      export async function dismissRecommendation(mediaId: string): Promise&lt;void&gt;</item>
    <item>app/(app)/recomendaciones/page.tsx signature:
      export default async function RecomendacionesPage({ searchParams }: { searchParams: Promise&lt;{ genero?: string }&gt; })
      — remember Next.js 16's async searchParams/params convention; confirm the exact API against the
      mandatory_reading Next.js docs before writing this, since this project's Next.js version may differ from
      training-data assumptions per AGENTS.md.</item>
  </implementation_notes>

  <clarify_before_coding>
    <item>Whether services/RecommendationServices already exists from a parallel RIK-7 run — default: check
      first, reuse if present, otherwise create it structured for RIK-7 to reuse later.</item>
    <item>Exact value/use of minVotesFloor in constants/recommendationThresholds.ts — default: set equal to
      minImdbVotes (5000), unused by this ticket's own logic, reserved for a future tunable minImdbVotes.</item>
    <item>Genre filter state mechanism (URL search param vs. Zustand store) — default: ?genero=&lt;slug&gt; search
      param read server-side, no client store needed for this ticket.</item>
    <item>Genre dropdown source (all genres vs. only genres present in eligible titles) — default: all rows from
      genres, ordered by name.</item>
    <item>Two-block layout mechanics (Tabs vs. stacked blocks) — default: two stacked blocks, per
      RIKUNA-PRD-vistas-y-estilo-rikuna.md Section 2.2's explicit either/or allowance.</item>
  </clarify_before_coding>

  <deliverables>
    <item>All files listed in the requirements phases above, created or extended.</item>
    <item>Run npm run lint (and any tests, if a test setup exists by the time this runs) and fix any issues
      introduced by this change.</item>
    <item>Persist documentation per the completion_report persistence block below.</item>
  </deliverables>

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
        <item>Format: `- RIK-8: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-8_discovery_recommendations.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to discovery_recommendations, matching specs/backlog/RIK-8_discovery_recommendations.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-8_discovery_recommendations.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: migration / types / services / actions / ingestion / features / components / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference the ticket id in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (for example a new feature uses the sparkles emoji, a bugfix the bug emoji, a schema or config change the wrench emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket (Linear, GitHub Issues, etc.). The audience is the ticket author and the product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; optional "Screenshots" section when visuals matter (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Translate them into product language (for example say "the recommendations page" instead of naming the component, "the dismiss action" instead of naming columns).</item>
      <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots — include a "## Screenshots" section since this ticket has user-visible UI changes. Omit only if truly nothing renders differently.</item>
      <item>Do NOT embed images in the markdown — attachments are added by the human. Instead, list what to capture as numbered items, each with: screen/area name, auth state if relevant, and what the screenshot should show. Suggest items like: "Recommendations page — logged in with active subscription: both blocks populated, genre filter visible" and "Discovery card — after clicking 'No me interesa': card removed from the list on reload."</item>
      <item>Suggest 1–4 screenshots max — only views that prove the AC.</item>
      <item>Prefix each screenshot line with a placeholder the poster can replace after attaching: `[attach: short label]` so they know which file goes where.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human (developer or QA) to confirm the work works. This ticket is UI + logic, so include both the UI validation and Logic validation sections (no schema/migration change, so omit Database validation unless the implementer added seed data worth checking).</item>
      <item>Structure: "## Prerequisites" (dev server running, a logged-in test user with an active subscription and at least a few media_items/media_availability/genres rows seeded, e.g. via RIK-1's local Supabase instance), then:
        "## UI validation" — numbered steps at /recomendaciones: confirm both blocks render, confirm genre Select narrows both blocks, click "No me interesa" on a discovery card and reload to confirm it's gone, click "Agregar a watchlist" on a discovery card and reload to confirm it now appears in the first block and no longer in the second.
        "## Logic validation" — how to directly call/inspect RecommendationServices.getDiscovery and getWatchlistAvailable (or query user_media_status) to confirm the rating/votes thresholds and the watched/want_to_watch/dismissed exclusions hold with edge-case seed rows.
        then "## Expected outcome" (bullets tying back to AC-1 through AC-6).</item>
      <item>Use the concrete route /recomendaciones. Note this route requires an active session (inside the (app) group) — there is no unauthenticated variant to test.</item>
      <item>SQL must be read-only verification queries — no INSERT/UPDATE/DELETE unless the ticket explicitly required data migration; seeding test rows for validation is fine to mention but should use the app's own actions (addToWatchlist, dismissRecommendation) or documented test fixtures, not raw writes against production-shaped tables.</item>
      <item>Do not duplicate the full PR test plan — this guide is for manual smoke testing after deploy or local run, written for someone who may not have read the PR.</item>
    </deliverable>
  </completion_report>
</task>
```
