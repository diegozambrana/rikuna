# RIK-7 — Panel principal ("Qué ver este mes")

## Ticket summary

Rikuna's landing screen after login, `/panel`, must show the product's central cross-reference: titles that are simultaneously (1) on the user's watchlist, (2) available on a streaming service the user actually subscribes to right now, and (3) not yet watched or dismissed — ordered by IMDb rating. This is the query given verbatim in `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Section 8.1. The screen needs a header showing the active subscription(s), a counter of exact matches, a poster grid with a rating badge, an inline "mark watched" action that removes the card without a full page reload, and an empty state pointing to `/suscripciones` when there is no active subscription.

- Grid shows only: `want_to_watch = true`, not `watched`, not `dismissed`, and available (`is_available = true`) on a platform+country the user currently subscribes to (`user_subscriptions.ended_on is null`).
- Counter must equal exactly the number of rendered cards, live-updated after any card is removed.
- "Mark watched" from a card removes it from the grid without reloading the page.
- No active subscription → empty state with a direct button to `/suscripciones`.
- Initial load must feel instant even with a multi-thousand-row personal history — verify with realistic seeded volume, not just a handful of rows.
- Team comment (authoritative): the "mark watched" write must reuse the exact same `user_media_status` write pattern that RIK-9 (title detail) will also need, as one shared server action rather than two independent implementations.

---

## Context

### Original ticket

**RIK-7 — Panel principal ("Qué ver este mes")**

**Descripción:** Vista de aterrizaje `/panel` con el cruce central del producto: watchlist ∩ disponible en el servicio activo ∩ no visto, ordenado por calificación IMDb (consulta 8.1 del esquema). Incluye encabezado con servicio/país activo, contador de coincidencias, cuadrícula de resultados y acción de marcar visto directo desde la tarjeta.

**Criterios de aceptación:**

- La cuadrícula solo muestra títulos que están en la watchlist del usuario, disponibles (`is_available = true`) en su suscripción activa, y no marcados como vistos ni descartados.
- El contador refleja exactamente la cantidad de tarjetas mostradas.
- Marcar "visto" desde una tarjeta la quita de la lista sin recargar la página completa.
- Sin suscripción activa declarada, se muestra un estado vacío con botón directo a `/suscripciones`.
- La carga inicial se siente instantánea con un historial de varios miles de títulos (verificar con datos de prueba de volumen realista).

The ticket's own wording says "su suscripción activa" (singular). This does **not** match the real schema: `user_subscriptions` explicitly supports multiple simultaneous active rows for different platform/country pairs (see `user_subscriptions_active_uq`, a partial unique index scoped per platform+country, not per user). This is called out as a discrepancy below and resolved with a default in "Decisions made."

### Team comments

> The exact query is given verbatim in schema doc Section 8.1 — point the coding agent there directly. Cross-check `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Section 2.2 (`/panel` or `/`) for exact card/header content (service+country header, counter copy example "23 títulos de tu lista disponibles ahora", poster grid with rating badge, skeleton loading state). "Marcar visto" action should follow the same `user_media_status` write pattern that RIK-9 (title detail) also uses — note this shared pattern as a constraint so both tickets converge on one server action rather than duplicating logic (e.g. a shared `actions/mediaStatus/markWatched.ts`).

This comment is authoritative and drives two decisions:

1. The panel's query logic must match Section 8.1 verbatim in its joins/filters/ordering (projection may be narrowed — see below).
2. The "mark watched" write path must be built as a single reusable server action, not duplicated when RIK-9 is implemented later. The comment's suggested path `actions/mediaStatus/markWatched.ts` uses camelCase; the real project convention (confirmed in `ARCHITECTURE.md`'s Server Actions table) is kebab-case `actions/media-status/`. The shared action is placed at `actions/media-status/markWatched.ts` to follow that existing convention instead of the comment's literal path.

Section 8.1, copied verbatim from `specs/RIKUNA-PRD-schema-basedatos-rikuna.md`:

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

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| "Encabezado con servicio/país activo" (singular active service) | `user_subscriptions_active_uq` is a partial unique index on `(user_id, platform_id, country) where ended_on is null` — a user can hold **multiple** concurrently active subscriptions across different platform/country pairs (confirmed by RIK-6's own AC: "Es posible tener más de una suscripción activa simultánea si son plataforma/país distintos"). | Header and query must handle N ≥ 0 active subscriptions, not exactly one. Resolved as a default below (badge per active subscription). |
| Comment's suggested shared-action path `actions/mediaStatus/markWatched.ts` | `ARCHITECTURE.md`'s Server Actions table uses kebab-case folder names (`media-status`, `imdb-import`, etc.), not camelCase. | Shared action is placed at `actions/media-status/markWatched.ts` to match the existing project convention rather than the comment's literal casing. |
| "Cuadrícula de resultados" content, cross-referenced against both PRD docs | `RIKUNA-PRD-documento-especificacion-rikuna.md` §7.2 lists card fields as poster, título, año, calificación IMDb, **géneros**. `RIKUNA-PRD-vistas-y-estilo-rikuna.md` §2.2 (the dedicated UI/style spec, more detailed and more recent in intent) lists poster, título, año, `Badge` con calificación IMDb — no géneros. Section 8.1's query also does not join `genres`/`media_genres` at all. | Adding genres would require an extra join per card (or a second query), working against the "must feel instant" requirement. Default: follow §2.2 and the literal 8.1 query — no genre badges in the panel grid for this ticket. Recorded as a decision below. |
| No pagination/limit mentioned for the "instant load with thousands of titles" requirement | Section 8.1's query has no `LIMIT`, unlike Section 8.2's discovery query which caps at 50. The *intersection* set (watchlist ∩ available ∩ unwatched) is expected to stay small in practice even with a large personal history, because it's bounded by watchlist size, not catalog size. | Default: no hard limit for MVP; rely on the existing composite indexes (see Ground truth notes) and verify with realistic seeded volume per AC-5. If verification proves the unbounded query is too slow, add pagination as a documented deviation, not a silent scope change. |

### Current database state

No `supabase/migrations/` directory exists yet in this repository — RIK-1 has not landed at the time this spec was written. This ticket is authored **assuming RIK-1, RIK-2, RIK-3, RIK-4, and RIK-6 have already been implemented** (per their own backlog specs) by the time a coding agent picks this ticket up. The tables and columns below are taken verbatim from `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` (RIK-1's source of truth) — the coding agent must re-verify them against the actual migration files in `supabase/migrations/` before writing any query, since the schema doc could have drifted from what RIK-1 actually shipped.

Relevant columns (all pre-existing, no new column required by this ticket):

- `public.media_items`: `id uuid`, `imdb_id varchar unique`, `type varchar`, `title varchar`, `slug varchar unique`, `year integer`, `poster_url text`, `imdb_rating numeric(3,1)`, `imdb_votes integer`, `is_stub boolean default false`. Index `media_items_rating_idx on (imdb_rating desc nulls last)` — matches the required sort exactly.
- `public.user_media_status`: `id uuid`, `user_id uuid`, `media_id uuid`, `watched boolean default false`, `watched_at timestamptz`, `personal_rating smallint`, `want_to_watch boolean default false`, `dismissed boolean default false`, `source varchar default 'manual'`, `manually_edited boolean default false`. Unique constraint `(user_id, media_id)`. Index `ums_user_want_idx on (user_id, want_to_watch) where want_to_watch`.
- `public.media_availability`: `id uuid`, `media_id uuid`, `platform_id uuid`, `country varchar(2)`, `is_available boolean default true`, `last_seen_at timestamptz`, `last_snapshot_id uuid`. Unique `(media_id, platform_id, country, offer_type)`. Index `media_availability_lookup_idx on (platform_id, country, is_available)`.
- `public.user_subscriptions`: `id uuid`, `user_id uuid`, `platform_id uuid`, `country varchar(2)`, `started_on date`, `ended_on date` (null = active). Partial unique index `user_subscriptions_active_uq on (user_id, platform_id, country) where ended_on is null`. Index `user_subscriptions_active_idx on (user_id) where ended_on is null`.
- `public.platforms`: `id uuid`, `name varchar`, `slug varchar unique`.

RLS (per schema doc §9): `media_items`/`media_availability`/`platforms` are publicly readable; `user_media_status`/`user_subscriptions` are owner-only via `auth.uid() = user_id`. Both `actions/recommendations/*` and `actions/media-status/*` must run under the user's own session (RLS-scoped client from `lib/supabase/server.ts`), never `lib/supabase/admin.ts`.

**Code usage today:** none — `services/`, `actions/`, `features/`, `components/` beyond `components/ui/button.tsx` do not exist in the repository yet (confirmed by directory listing at spec time). `ARCHITECTURE.md` describes their target shape but nothing has been scaffolded except the Next.js/shadcn base and `components/ui/button.tsx`.

### Current logic (panel / recommendations)

There is no `/panel` route with real content yet. `app/page.tsx` is still the unmodified Create Next App placeholder. Per this ticket's ground truth, RIK-2 (auth/routing, a separate ticket) is expected to create `app/(app)/panel/page.tsx` as a bare placeholder solely to prove the auth guard redirects correctly — this ticket **replaces that placeholder's content** with the real screen; it does not create the route from nothing.

`ARCHITECTURE.md`'s Server Actions table already earmarks `actions/recommendations` for "'Qué ver este mes' and discovery queries (Sections 8.1–8.2 of the schema doc)" and `actions/media-status` for "Mark watched / want-to-watch / dismissed (`user_media_status` writes)" — both folders are named but not yet implemented. The `services/index.ts` list in `ARCHITECTURE.md` does **not** include a dedicated recommendations service; see "Decisions made" for how this ticket resolves that gap.

### Requested field mapping

| Field requested | Type | Existing equivalent | Action |
| --- | --- | --- | --- |
| Poster | `media_items.poster_url text` | Exists | Reuse |
| Title | `media_items.title varchar` | Exists | Reuse |
| Year | `media_items.year integer` | Exists | Reuse |
| IMDb rating badge | `media_items.imdb_rating numeric(3,1)` | Exists | Reuse |
| Stub-title handling | `media_items.is_stub boolean` | Exists | Reuse — `MediaCard` must render a poster placeholder gracefully when `is_stub = true` per `ARCHITECTURE.md` conventions |
| Active service/country header | `user_subscriptions.platform_id` → `platforms.name`, `user_subscriptions.country`, filtered by `ended_on is null` | Exists | Reuse — one badge per active row, see Decisions |
| Match counter | Not a DB field — derived from grid length | N/A | Compute client-side from the rendered list, kept in sync on optimistic removal |
| Mark watched write | `user_media_status.watched`, `watched_at`, `manually_edited`, `source` | Exists | Reuse via shared `markWatched` action — no new column |

No migration is required for this ticket.

### Impacted files

- **services**: `services/RecommendationServices.ts` (new) — `getMonthlyWatchlist(supabase, userId)` implementing Section 8.1's join/filter/order logic with an explicit, narrowed column projection (see Decisions). `services/SubscriptionServices.ts` (existing, from RIK-6) — add/reuse a method returning all currently active subscriptions with their platform name and country. `services/MediaStatusServices.ts` (existing, from RIK-4) — add/reuse a `markWatched(supabase, userId, mediaId)` method. `services/index.ts` — export `RecommendationServices`.
- **actions**: `actions/recommendations/getMonthlyWatchlist.ts` (new) — session check, calls `RecommendationServices`. `actions/media-status/markWatched.ts` (new, shared with future RIK-9) — session check, calls `MediaStatusServices.markWatched`, `revalidatePath('/panel')` (and `/biblioteca` per `ARCHITECTURE.md`'s stated pattern). Barrel `index.ts` files for both folders.
- **components**: `components/MediaCard/` (new, shared per `ARCHITECTURE.md` — "the single most reused component across panel, recommendations, biblioteca, lists, and public list view") — poster with `AspectRatio` reserved space, title, year, rating `Badge`, inline mark-watched button. shadcn additions needed via `components.json` (`style: base-lyra`, `baseColor: mist`): `Skeleton`, `Badge`, `Card`, `AspectRatio` (only `button.tsx` exists today).
- **features**: `features/panel/` (new) — `PanelHeader.tsx` (active-subscription badges + counter), `PanelGrid.tsx` (client component, optimistic removal on mark-watched), `EmptySubscriptionState.tsx`, a small client hook/store holding the current picks array so the counter and grid stay in sync after a card is removed.
- **app routes**: `app/(app)/panel/page.tsx` (replace RIK-2's placeholder) — Server Component fetching via the two new actions, `Suspense` boundary with a skeleton fallback for perceived instant load, renders `EmptySubscriptionState` when there are zero active subscriptions.
- **middleware**: none — `/panel` already sits inside `(app)`, guarded by RIK-2.
- **tests**: none exist yet in the repo; not introduced by this ticket (see Out of scope).

### Decisions made

1. **Multiple active subscriptions in the header.** Render one compact badge per currently active `user_subscriptions` row (platform name + country), sorted by `started_on desc`. When there is exactly one, this matches the product spec's single-badge example ("Apple TV+ · Bolivia"). *Recommended default, not confirmed by a human — record as unconfirmed in the prompt.*
2. **No dedicated `RecommendationServices` was listed in `ARCHITECTURE.md`'s services table.** A new `services/RecommendationServices.ts` is created instead of bolting this three-way join onto `MediaAvailabilityServices` or `MediaStatusServices`, because Section 8.1 (and later 8.2 for RIK-8) is its own cross-domain query family, and giving it a dedicated home avoids overloading either existing service with joins outside its one-line stated purpose. *Recommended default.*
3. **Column projection narrowed from `mi.*`.** The literal query in Section 8.1 selects `mi.*`, which includes `metadata jsonb` and `description text` — unnecessary payload for a poster grid and directly counter to the "feels instant" requirement. The service selects an explicit column list (`id, slug, title, year, poster_url, imdb_rating, imdb_votes, is_stub`) while preserving the exact same joins, filters, and `order by imdb_rating desc nulls last`. *Recommended default.*
4. **No genre badges in the panel grid**, following `vistas-y-estilo-rikuna.md` §2.2 over `documento-especificacion-rikuna.md` §7.2, and matching the literal 8.1 query (no genre join). *Recommended default.*
5. **No `LIMIT` added to the panel query** for MVP; the intersection is expected to be small regardless of total history size. Verify against seeded volume test data per AC-5 before shipping; if the query proves slow, document the deviation rather than silently paginating. *Recommended default.*
6. **Shared `markWatched` action path is `actions/media-status/markWatched.ts`** (kebab-case, matching `ARCHITECTURE.md`), not the ticket comment's literal `actions/mediaStatus/markWatched.ts`. *Confirmed by cross-checking `ARCHITECTURE.md`'s existing folder-naming convention — not a guess.*
7. **`markWatched` sets `watched = true`, `watched_at = now()`, `manually_edited = true`, `source = 'manual'`**, and does not touch `want_to_watch`. This mirrors RIK-9's own stated acceptance criterion for the same write pattern verbatim, since the action is explicitly shared between both tickets. *Confirmed by RIK-9's AC wording in `specs/RIKUNA-BACKLOG-v1-rikuna.md`.*
8. **"Without a full page reload" is implemented as client-side optimistic removal from local state, in addition to the server action + `revalidatePath('/panel')`.** `revalidatePath` alone triggers a soft RSC refresh (not a browser reload) but would still show a network round-trip before the card disappears; optimistic removal makes it instant, then reconciles silently on the server response. *Recommended default.*

### Out of scope

- `/recomendaciones` discovery block (Section 8.2 query, genre filter, "no me interesa") — RIK-8.
- `/titulo/[slug]` detail page UI — RIK-9. Only the shared `markWatched` action is built here for RIK-9 to reuse later.
- Changing/activating subscriptions — full CRUD for `user_subscriptions` is RIK-6; this ticket only reads active rows and links to `/suscripciones`.
- Automated test suite — no test infrastructure exists yet in this repository; not introduced here.
- Pagination/infinite scroll for the panel grid — deferred unless volume verification in AC-5 proves it necessary; if so, flag as a follow-up ticket rather than expanding this one's scope.

---

## Implementation plan

**Goal:** Build the real `/panel` screen against the actual RIK-1 schema and the verbatim Section 8.1 query, replacing RIK-2's placeholder, with a shared `markWatched` write path that RIK-9 will also consume.

**In scope:**

1. `services/RecommendationServices.ts` — `getMonthlyWatchlist(supabase, userId)` implementing Section 8.1's joins/filters/order with a narrowed column projection; export from `services/index.ts`.
2. Extend `services/SubscriptionServices.ts` with a method to fetch all currently active subscriptions joined to `platforms.name`.
3. Extend `services/MediaStatusServices.ts` with `markWatched(supabase, userId, mediaId)`.
4. `actions/recommendations/getMonthlyWatchlist.ts` — session check + service call.
5. `actions/media-status/markWatched.ts` — session check + service call + `revalidatePath('/panel')` and `/biblioteca`. Shared module for RIK-9.
6. `components/MediaCard/` — poster (`AspectRatio`-reserved), title, year, rating `Badge`, inline mark-watched action; graceful `is_stub` handling. Add missing shadcn primitives (`Skeleton`, `Badge`, `Card`, `AspectRatio`) via the CLI, respecting `style: base-lyra` / `baseColor: mist` and the Lyra zero-border-radius rule.
7. `features/panel/` — `PanelHeader` (active-subscription badges + counter), `PanelGrid` (optimistic removal), `EmptySubscriptionState`.
8. `app/(app)/panel/page.tsx` — replace placeholder; Server Component fetching both actions in parallel, `Suspense` + skeleton fallback, renders empty state when there are zero active subscriptions.
9. Seed realistic volume test data locally (several thousand `user_media_status`/`media_availability` rows) and verify query latency / index usage before calling AC-5 done.

**Out of scope:** `/recomendaciones` (RIK-8), `/titulo/[slug]` (RIK-9), subscription CRUD (RIK-6), automated tests (no infra yet), pagination (only if volume testing proves necessary).

**Key risks / compatibility:**

- This ticket assumes RIK-1/2/3/4/6 have already landed. If `supabase/migrations/`, `types/`, `services/`, `actions/`, `features/` are still missing when work starts, stop and report the blocked dependency rather than inventing schema or scaffolding those tickets' scope.
- `user_subscriptions` allows multiple simultaneous active rows — do not assume exactly one in either the query or the header UI.
- Keep `actions/recommendations` and `actions/media-status` on the RLS-scoped client (`lib/supabase/server.ts`); never import `lib/supabase/admin.ts` here.

**Acceptance criteria mapping:**

| AC | Satisfied by |
| --- | --- |
| AC-1 | `RecommendationServices.getMonthlyWatchlist` reproducing Section 8.1's filters exactly |
| AC-2 | Counter derived from the same array rendered as cards, updated on every optimistic removal |
| AC-3 | `markWatched` action + optimistic client-side removal, no `window.location`/full reload |
| AC-4 | `EmptySubscriptionState` rendered when the active-subscriptions query returns zero rows |
| AC-5 | Narrowed projection, existing composite indexes, verified against seeded volume data |
| AC-6 | Shared `actions/media-status/markWatched.ts` module, not duplicated per screen |

---

## Claude Code prompt

```xml
<task id="RIK-7" title="Panel principal (Qué ver este mes)" depends_on="RIK-1,RIK-2,RIK-3,RIK-4,RIK-6">
  <role>
    You are a senior full-stack engineer working on Rikuna, a personal streaming-rotation planner built with
    Next.js 16 (App Router) and React 19 on top of Supabase (Postgres + Auth + RLS). You follow the project's
    layered + feature-sliced architecture strictly: app/ (thin routes) -> actions/ (server actions) ->
    services/ (Supabase query/DTO layer) -> features/ (client screens) -> components/ (shared UI).
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — layered + feature-sliced layout, auth route groups, actions/services conventions, ingestion vs user-facing boundaries.</item>
    <item>AGENTS.md — this Next.js install has breaking changes vs. your training data. Before writing any App Router, Server Action, caching, or Suspense/streaming code, read the relevant guide under node_modules/next/dist/docs/ (resolved from AGENTS.md's directory) and heed deprecation notices.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping used by this task's completion_report.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 8.1 (the exact query this ticket implements), Section 3.3 (availability upsert/expire logic, for context only — not modified here), Section 4 (user_subscriptions), Section 5 (user_media_status), Section 9 (RLS).</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 2.2 ("/ o /panel") for exact header/counter/grid/skeleton content, and Section 3 for the Lyra style rules (zero border-radius, AspectRatio-reserved posters).</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — Section 7.2 (panel purpose) and Section 11 ("debe sentirse instantáneo aun con miles de títulos") for the performance requirement's product rationale.</item>
    <item>components.json — confirm style: base-lyra, baseColor: mist before adding any shadcn component.</item>
    <item>The most recent migration file(s) in supabase/migrations/ (created by RIK-1) — verify the real column names/types/defaults for media_items, media_availability, user_subscriptions, user_media_status, platforms match this task's ground_truth_db_notes before writing any query. If supabase/migrations/ does not exist yet, STOP and report RIK-1 as an unmet dependency — do not invent the schema.</item>
    <item>types/index.ts, services/index.ts, actions/ (existing barrels from RIK-1/2/3/4/6) — reuse existing types and service methods where they already cover this ticket's needs (e.g. UserSubscription, MediaItem, an existing MediaStatusServices class) instead of recreating them.</item>
    <item>CHANGELOG.md — format and where to append entries.</item>
    <item>specs/logs/README.md — work log filename and template.</item>
  </mandatory_reading>

  <context>
    Rikuna's landing screen after login is /panel: the intersection of what the user wants to watch, what is
    currently available on a streaming service they subscribe to, and what they have not watched yet. This is
    the product's core value proposition. RIK-2 will have already created app/(app)/panel/page.tsx as a bare
    placeholder solely to prove the auth guard redirects unauthenticated visitors correctly — this task
    replaces that placeholder's content with the real screen, it does not create the route from nothing.

    None of services/, actions/, features/, components/ (beyond components/ui/button.tsx) existed when this
    spec was authored. This task assumes RIK-1 (schema/RLS), RIK-2 (auth/routing), RIK-3 (catalog ingestion),
    RIK-4 (IMDb import), and RIK-6 (subscriptions) have already landed their own services/actions/types. Reuse
    what they already built; do not re-implement their scope.
  </context>

  <ground_truth_db_notes critical="true">
    <note>The exact query this ticket implements lives verbatim in specs/RIKUNA-PRD-schema-basedatos-rikuna.md Section 8.1. Preserve its joins, filters, and `order by imdb_rating desc nulls last` exactly. You MAY narrow the column projection away from the literal `mi.*` (see below) but must not change which rows match.</note>
    <note>media_items real columns used here: id, imdb_id, type, title, slug, year, poster_url, imdb_rating (numeric(3,1), nullable), imdb_votes, is_stub (boolean, default false). There is a real index media_items_rating_idx on (imdb_rating desc nulls last) — your query's ORDER BY should be able to use it.</note>
    <note>user_media_status real columns: user_id, media_id, watched, watched_at, want_to_watch, dismissed, source ('manual' | 'imdb_ratings' | 'imdb_watchlist'), manually_edited. Unique constraint on (user_id, media_id) — a want_to_watch=true row is guaranteed to already exist for anything visible in the panel, so markWatched must be an UPDATE, not a blind upsert. Index ums_user_want_idx on (user_id, want_to_watch) where want_to_watch exists to accelerate this ticket's query.</note>
    <note>media_availability real columns: media_id, platform_id, country, is_available, last_seen_at, last_snapshot_id. Unique (media_id, platform_id, country, offer_type). Index media_availability_lookup_idx on (platform_id, country, is_available) exists to accelerate this ticket's query.</note>
    <note>user_subscriptions: a user CAN have MULTIPLE simultaneously active rows for different platform_id/country pairs. "Active" means ended_on is null — there is no boolean/status column. The partial unique index user_subscriptions_active_uq is scoped to (user_id, platform_id, country), not to the user alone. Do NOT assume exactly one active subscription in either the query or the header UI; render one badge per active row.</note>
    <note>There is no country column on media_items. Country is only a property of media_availability and user_subscriptions rows.</note>
    <note>RLS: media_items/media_availability/platforms are publicly readable. user_media_status/user_subscriptions are owner-only via auth.uid() = user_id. Use the RLS-scoped server client from lib/supabase/server.ts in both new actions folders — never lib/supabase/admin.ts, which is reserved for ingestion/ only.</note>
    <note>No new migration is required by this ticket. If any column referenced above is missing when you inspect the actual migration files, STOP and report the discrepancy instead of adding a migration yourself outside RIK-1's scope.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="Services">
      <item>Create services/RecommendationServices.ts exporting a class/object with getMonthlyWatchlist(supabase: SupabaseClient, userId: string) implementing Section 8.1's join/filter/order logic. Select an explicit column list (id, slug, title, year, poster_url, imdb_rating, imdb_votes, is_stub) instead of the literal `mi.*` — do not select description or metadata, they are unused by the grid and unnecessarily inflate the response. Export it from services/index.ts.</item>
      <item>Extend the existing subscriptions service (from RIK-6) with a method returning all rows where ended_on is null for the current user, joined to platforms.name, ordered by started_on desc. Reuse the existing service/class name and file if RIK-6 already created one — do not create a duplicate service.</item>
      <item>Extend the existing media-status service (from RIK-4) with markWatched(supabase, userId, mediaId): update the existing user_media_status row (do not insert) setting watched = true, watched_at = now(), manually_edited = true, source = 'manual'. Do not touch want_to_watch. Reuse the existing service file/class if RIK-4 already created one.</item>
    </phase>

    <phase title="Actions">
      <item>Create actions/recommendations/getMonthlyWatchlist.ts ("use server"): verify the session via supabase.auth.getUser(), instantiate RecommendationServices with the session-bound client, call getMonthlyWatchlist, return the rows.</item>
      <item>Create actions/media-status/markWatched.ts ("use server"): this is a SHARED action — RIK-9 (title detail) will also call it later, do not scope it to the panel screen only. Verify the session, call the service's markWatched, then revalidatePath('/panel') and revalidatePath('/biblioteca'). Return a small result object the client can use to reconcile optimistic UI (success boolean, error message on failure).</item>
      <item>Add/confirm barrel index.ts files for both actions/recommendations/ and actions/media-status/.</item>
    </phase>

    <phase title="Components">
      <item>Add missing shadcn primitives via the project's configured registry (components.json: style base-lyra, baseColor mist): Skeleton, Badge, Card, AspectRatio. Confirm zero border-radius is applied per the Lyra style rule in vistas-y-estilo-rikuna.md Section 3 — override any default radius token if the generator does not already force it to 0.</item>
      <item>Create components/MediaCard/ as a shared component (it will be reused by RIK-8, biblioteca, lists, and the public list view later — keep its props generic, not panel-specific): poster with AspectRatio-reserved space (so the layout does not jump before the image loads), title, year, an IMDb rating Badge, and a slot for an inline "mark watched" action. When is_stub is true, render a poster placeholder and do not assume poster_url/description exist.</item>
    </phase>

    <phase title="Features">
      <item>Create features/panel/PanelHeader.tsx: renders one compact badge per active subscription (platform name + country), and the counter copy "{count} título(s) de tu lista disponible(s) ahora" (Spanish, matching the product spec's example "23 títulos de tu lista disponibles ahora" — handle singular/plural correctly).</item>
      <item>Create features/panel/PanelGrid.tsx as a client component: receives the initial getMonthlyWatchlist result as props, holds it in local state, renders a MediaCard per item. On mark-watched: optimistically remove the card from local state immediately (so it disappears without waiting on the network), call the markWatched action, and on failure re-insert the card and show an error via Sonner (the project's toast library). The counter in PanelHeader must reflect this same local state, not a separate count.</item>
      <item>Create features/panel/EmptySubscriptionState.tsx: Spanish copy explaining there is no active subscription, with a Button linking to /suscripciones ("Configurar mi suscripción" per vistas-y-estilo-rikuna.md's own copy for this exact state).</item>
    </phase>

    <phase title="Routes">
      <item>Replace the placeholder content of app/(app)/panel/page.tsx (created by RIK-2) with a Server Component: fetch active subscriptions and, only if at least one exists, fetch getMonthlyWatchlist (both via the new actions), in parallel where possible. Wrap the grid fetch in a Suspense boundary with a Skeleton grid fallback matching vistas-y-estilo-rikuna.md's stated skeleton loading state. Render EmptySubscriptionState when there are zero active subscriptions instead of running the watchlist query at all.</item>
    </phase>

    <phase title="Verification">
      <item>Seed realistic volume test data locally (several thousand user_media_status rows and a matching spread of media_availability rows) to verify AC-5. If no seed script exists yet in this repo, write a throwaway local script or SQL block for this verification only — do not commit a permanent seed script unless one is clearly expected elsewhere in the project; note this choice in the completion report.</item>
      <item>Confirm via EXPLAIN (or equivalent) that the query benefits from ums_user_want_idx and media_availability_lookup_idx, not a sequential scan, at that data volume.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">The grid renders only titles where want_to_watch = true, watched = false, dismissed = false, and available (is_available = true) on a platform+country matching one of the user's currently active subscriptions. Verify by seeding a mixed dataset (some watched, some dismissed, some unavailable, some on a platform the user does not subscribe to) and confirming only the true-positive rows render.</criterion>
    <criterion id="AC-2">The counter's number always equals the number of MediaCard elements currently rendered, including immediately after an optimistic removal (not just on initial load). Verify by counting rendered cards vs. the displayed counter value before and after a mark-watched click.</criterion>
    <criterion id="AC-3">Clicking "mark watched" on a card removes it from the grid without a full browser navigation/reload (no window.location usage, no full-page Server Component remount from scratch) — the card disappears immediately (optimistic) and the underlying user_media_status row is confirmed updated server-side (watched = true, manually_edited = true, source = 'manual').</criterion>
    <criterion id="AC-4">With zero rows in user_subscriptions where ended_on is null for the current user, the page renders EmptySubscriptionState with a working Button/link to /suscripciones, and does not attempt to run or render results from getMonthlyWatchlist.</criterion>
    <criterion id="AC-5">With several thousand seeded user_media_status/media_availability rows for a test user, the panel's initial data fetch is verified fast (confirm index usage per the Verification phase) and the Suspense/skeleton fallback is visibly used during the fetch rather than a blank screen.</criterion>
    <criterion id="AC-6">The mark-watched write logic exists in exactly one place, actions/media-status/markWatched.ts, callable by both this screen and (later) RIK-9's title detail screen — verify by inspection that no duplicate user_media_status write logic for "mark watched" exists elsewhere in the diff.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a new Supabase migration for this ticket — all required tables/columns/indexes are RIK-1's scope. If something referenced in ground_truth_db_notes is missing from the real migrations, STOP and report it as a blocked dependency.</item>
    <item>Do NOT import lib/supabase/admin.ts from actions/recommendations/ or actions/media-status/ — both are user-facing, session-scoped flows and must rely on RLS via the regular server client.</item>
    <item>Do NOT rename or alter any column on media_items, user_media_status, media_availability, or user_subscriptions.</item>
    <item>Do NOT assume exactly one active subscription anywhere — the query and the header must both support zero, one, or many active user_subscriptions rows.</item>
    <item>Do NOT add a genre join/filter to the panel grid in this ticket (see Decisions in the backlog doc) — that belongs to a future ticket if ever needed.</item>
    <item>Do NOT implement /recomendaciones, /titulo/[slug], or subscription activation/editing in this ticket — those are RIK-8, RIK-9, and RIK-6 respectively.</item>
    <item>All user-visible copy must be Spanish; all code identifiers, comments, and commit/PR text must be English, per ARCHITECTURE.md.</item>
    <item>Respect the Lyra style rule: zero border-radius on all generated components; MediaCard posters must reserve space via AspectRatio before the image loads.</item>
  </constraints>

  <out_of_scope>
    <item>/recomendaciones discovery block (Section 8.2 query, genre filter, dismiss action) — RIK-8.</item>
    <item>/titulo/[slug] detail screen UI — RIK-9. Only the shared markWatched action is delivered here.</item>
    <item>Subscription activation, editing, or history UI — RIK-6 owns /suscripciones itself; this ticket only reads active rows and links out to it.</item>
    <item>Automated tests — no test infrastructure exists in this repository yet; do not introduce a test runner as a side effect of this ticket.</item>
    <item>Pagination/infinite scroll for the panel grid — only add if your AC-5 volume verification proves the unbounded query is too slow, and if so, document it explicitly as a deviation in the verification report rather than silently changing scope.</item>
  </out_of_scope>

  <implementation_notes>
    <item>Suggested service signature: `getMonthlyWatchlist(supabase: SupabaseClient, userId: string): Promise&lt;MonthlyPick[]&gt;` where MonthlyPick is a narrow type (id, slug, title, year, posterUrl, imdbRating, imdbVotes, isStub) colocated with the service rather than added to the shared types/index.ts barrel, since it is a query-shaped projection, not a 1:1 table type.</item>
    <item>Suggested action signature: `markWatched(mediaId: string): Promise&lt;{ success: boolean; error?: string }&gt;`.</item>
    <item>Mobile-first layout: per documento-especificacion-rikuna.md Section 11, the "what do I watch now" decision is typically made in front of the TV with a phone in hand — the grid must be usable at small viewport widths, not just desktop.</item>
  </implementation_notes>

  <clarify_before_coding>
    <item>Header treatment for multiple simultaneously active subscriptions was not specified by the ticket. Default: one compact badge per active subscription, sorted by started_on desc. Proceed with this default; do not block on it.</item>
    <item>Whether the panel grid needs pagination at very large scale was not specified. Default: no limit for MVP, verify with seeded volume data; only add pagination if verification proves it necessary, and document the deviation. Proceed with this default; do not block on it.</item>
  </clarify_before_coding>

  <deliverables>
    <item>All files listed in the requirements phases above, working end to end.</item>
    <item>Run npm run lint and fix any issues introduced by this change. There is no test suite yet, so no test command to run.</item>
    <item>Persist documentation per completion_report/persistence below.</item>
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
        <item>Format: `- RIK-7: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-7_monthly_watch_panel.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Link to specs/backlog/RIK-7_monthly_watch_panel.md in the metadata table.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: services / actions / components / features / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-7 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; an optional "Screenshots" section (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the main dashboard" instead of naming the route, "the subscription badge" instead of naming a component, "the watchlist matching logic" instead of naming a query.</item>
      <item>Keep it under 15 lines for the core comment (excluding Screenshots). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Include a "## Screenshots" section (this ticket has user-visible UI): list 1–4 items, each with screen/area name, auth state, and what it should show — e.g. "Panel — with an active subscription: header badge, counter text, poster grid with rating badges", "Panel — no active subscription: empty state with the button to subscriptions", "Panel — after marking a title watched: card removed, counter updated". Prefix each with `[attach: short label]` since the human attaches the actual image.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. Include "## Prerequisites" (dev server running, a logged-in test user, an active subscription for the positive-path steps, seeded watchlist/availability data), then "## UI validation" with numbered steps covering: viewing /panel with an active subscription and matching titles, marking one watched and confirming it disappears with the counter updating without a page reload, and viewing /panel with zero active subscriptions to confirm the empty state and its link to /suscripciones. Also include "## Database validation" with a read-only SQL query against user_media_status confirming a marked title now has watched = true, manually_edited = true, source = 'manual'. End with "## Expected outcome" (1–3 bullets tying back to the acceptance criteria).</item>
      <item>Use concrete app paths: /panel, /suscripciones.</item>
      <item>SQL must be read-only verification queries only.</item>
    </deliverable>
  </completion_report>
</task>
```
