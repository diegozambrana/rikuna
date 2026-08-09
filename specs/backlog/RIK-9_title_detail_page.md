# RIK-9 — Ficha de título y marcado manual

## Ticket summary

Build the authenticated title detail screen at `/titulo/[slug]` — poster, synopsis, year, IMDb rating/votes, genres, cast, the user's personal rating if present, and a "Dónde ver" section listing available platforms with the one matching the user's active subscription highlighted. Add manual watched/watchlist toggles that write directly to `user_media_status` without requiring a CSV reimport, and a graceful degraded state for `is_stub` titles.

- Mark/unmark watched and add/remove watchlist from the ficha must update `user_media_status` with `manually_edited = true` and `source = 'manual'`.
- "Dónde ver" only lists platforms with `is_available = true` for that title, highlighting the one matching the user's active subscription.
- A title with `is_stub = true` shows a "limited information" notice and does not break layout from a missing poster/synopsis/cast.
- The ficha must be reachable by click from panel, recommendations, and own lists — none of which exist yet (RIK-7, RIK-8, RIK-10), so this ticket's job is to expose the stable route/contract those tickets will link to.
- The manual-mark write action is designed once, here, as the canonical action other tickets (RIK-7, RIK-8) reuse — no duplicate mutation logic should appear later.
- No team comments exist beyond the ticket text and the routing/architecture note that shipped with this spec request; both are treated as authoritative and are folded into Context/Decisions below.

---

## Context

### Original ticket

**RIK-9 — Ficha de título y marcado manual**

Descripción: Vista autenticada `/titulo/[slug]` con poster, sinopsis, año, calificación IMDb y votos, géneros, elenco, calificación personal si existe, y sección "Dónde ver" listando plataformas disponibles con enlace, destacando la que coincide con la suscripción activa. Incluye las acciones de marcado manual (visto/no visto, agregar/quitar de watchlist) sin depender de reimportar CSV, y el estado especial para títulos `is_stub`.

Criterios de aceptación:
- Marcar/desmarcar visto y agregar/quitar de watchlist desde la ficha actualiza `user_media_status` con `manually_edited = true` y `source = 'manual'`.
- La sección "Dónde ver" solo lista plataformas con `is_available = true` para ese título, y resalta la que coincide con la suscripción activa del usuario.
- Un título con `is_stub = true` muestra un aviso de "información limitada" y no rompe el layout por falta de poster/sinopsis/elenco.
- La ficha es alcanzable por click desde el panel, recomendaciones y listas propias.

Dependencies: `depends_on` RIK-1 (schema), RIK-2 (auth/route structure), RIK-3 (availability ingestion). None of the three exist in the repo yet at spec time — this document is written against their *documented* shape (schema doc, ARCHITECTURE.md) and must be re-verified once they actually land.

### Team comments

One comment shipped alongside the ticket text, authoritative over the bare description:

> "The manual-marking write should be the SHARED server action other tickets (RIK-7, RIK-8) also call — design it once here as the canonical `actions/mediaStatus/*` and have this ticket's constraints say so explicitly so later tickets don't duplicate it. Cross-check `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Section 2.2 (`/titulo/[slug]`) for the two-column layout, cast avatars, "Tu servicio" badge, and stub-title placeholder treatment, and `RIKUNA-PRD-documento-especificacion-rikuna.md` Section 7.7."

A second, structural note (from the routing investigation, not the ticket author) flags that `/titulo/[slug]` is documented **twice** in the PRDs — once as the authenticated ficha (vistas doc §2.2) and once as "the same ficha, without session-only actions" (vistas doc §2.3) — and that these are the same URL, not two routes. That note directly shapes the Implementation plan and Decisions below.

The `actions/mediaStatus/*` casing in the comment does **not** match the codebase's real naming convention — see discrepancies table.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| Team comment names the canonical action folder `actions/mediaStatus/*` (camelCase) | `ARCHITECTURE.md`'s Server Actions table names it `media-status` (kebab-case), matching every sibling folder (`media`, `subscriptions`, `lists`, `imdb-import`, `recommendations`) | Use `actions/media-status/` — a camelCase folder would be the only inconsistent one in the whole `actions/` tree |
| PRD `vistas-y-estilo-rikuna.md` lists `/titulo/[slug]` under "Zona App (requiere sesión)" §2.2 **and** under "Zona Pública" §2.3 as if they were two independent screens | It is the **same URL**. The Next.js App Router errors on two `page.tsx` files resolving to the same path across route groups, so this can only be one physical route with session-conditional rendering — exactly what `ARCHITECTURE.md`'s Features table already documents: *"title — Detail view — shared between authenticated and public variants, with an `isPublicView` flag gating the personal-action buttons."* | This ticket must place the page **outside** the blanket-redirect `(app)` route group and thread an `isPublicView` flag through the shared component from day one, even though only the authenticated branch has functional acceptance criteria here |
| PRD `vistas-y-estilo-rikuna.md` §1.3 documents `components.json` as `"style": "lyra"` (Radix-based shadcn) | Real `components.json` in the repo is `"style": "base-lyra"` — the Base UI variant, since the project has migrated off Radix | Any shadcn primitive added for this screen (`Avatar`, `Badge`, `Card`, `Alert`, `Skeleton`) must be the Base UI variant; do not assume Radix APIs |
| Ticket criteria say "alcanzable por click desde el panel, recomendaciones y listas propias" | None of `/panel`, `/recomendaciones`, `/mis-listas` exist yet — they are RIK-7, RIK-8, RIK-10, all of which `depends_on` this ticket, not the other way around | This AC can only be verified as "the route exists and is a stable contract other tickets can `<Link>` to" — not an actual click-through, which is impossible until those tickets land |
| Ticket implies "Dónde ver" data is simply available | `media_availability` will be empty until RIK-3 (catalog ingestion) actually runs — this ticket must render a correct **empty state**, not assume rows exist | Not a blocker, but the empty-platforms case is part of the acceptance bar, not an edge case to skip |

### Current database state

No `supabase/migrations/` directory exists in the repo yet (confirmed via `ls supabase/` — not found). Everything below is the **documented** shape from `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` v3, which RIK-1 is expected to implement verbatim. Re-verify column names/defaults against the real migration before writing queries once RIK-1 merges.

**`media_items`** (relevant columns): `id uuid pk`, `imdb_id varchar unique`, `type varchar`, `title varchar`, `year integer`, `description text`, `poster_url text`, `imdb_rating numeric(3,1)`, `imdb_votes integer`, `imdb_url text`, `is_stub boolean default false not null` (indexed via `media_items_stub_idx` where `is_stub`), `slug varchar unique`.

**`genres` / `media_genres`**: `genres(id, name, slug)`; `media_genres(media_id, genre_id)` composite PK.

**`people` / `media_people`**: `people(id, imdb_id, name, photo_url)`; `media_people(media_id, person_id, role, character_name, sort_order)` — `role` is `'actor' | 'director' | 'writer' | 'creator'`, ordered by `sort_order` via `media_people_media_idx`.

**`platforms`**: `id, name, slug, logo_url, provider_id_movie, provider_id_tv`.

**`media_availability`**: `media_id, platform_id, country, url, offer_type default 'subscription'`, `is_available boolean default true not null`, `last_seen_at`, `last_snapshot_id`. Unique on `(media_id, platform_id, country, offer_type)`. Indexed `(platform_id, country, is_available)` and `(media_id) where is_available`.

**`user_subscriptions`**: `user_id, platform_id, country, started_on, ended_on` (`null` = active/current). Unique partial index ensures at most one active row per `(user_id, platform_id, country)`; a user **can** have several concurrently-active subscriptions across different platforms.

**`user_media_status`** — the table this ticket writes to:

```sql
watched           boolean default false not null,
watched_at        timestamptz,
personal_rating   smallint,             -- 1-10, read-only in this ticket
want_to_watch     boolean default false not null,
want_added_at     timestamptz,
dismissed         boolean default false not null,
source            varchar default 'manual' not null,   -- 'manual' | 'imdb_ratings' | 'imdb_watchlist'
manually_edited   boolean default false not null,
constraint user_media_status_uq unique (user_id, media_id)
```

Schema doc's explicit business rules (§5) that this ticket must respect:
- `watched` and `want_to_watch` are **independent** booleans — never model as one status enum.
- `manually_edited = true` exists specifically so a later CSV reimport never overwrites a manual edit — every write this ticket makes must set it.
- There is no "watchlist" table; "watchlist" in the ticket == `want_to_watch` + `want_added_at` on this same row.

**RLS (schema doc §9)**: `media_items`, `genres`, `people`, `platforms`, `media_availability` are **publicly readable**, including by the `anon` role — write is admin/ingestion only. `user_media_status` is **owner-only** for both read and write (`owner_all` policy, `auth.uid() = user_id`). This means: reads for the ficha's catalog data can run under any client, but the personal-status read/write must run through the request-scoped, cookie-bound Supabase client so RLS resolves `auth.uid()` — never `lib/supabase/admin.ts`.

**Code usage**: none yet — `services/`, `actions/`, `types/`, `features/` are all empty/missing directories in the repo today (confirmed via `find`). This ticket is greenfield for all of them, built against RIK-1's documented schema and RIK-2's documented auth pattern.

### Current logic (title/ficha)

No existing implementation. `ARCHITECTURE.md`'s relevant statements (verbatim, since they are the load-bearing design decisions for this ticket):

> `(app)`: authenticated area — nav shell, `AuthCheck` using `createClient()` from `@/lib/supabase/server`, redirects unauthenticated users to `/auth/login`...
> `(public)`: unauthenticated, read-only content — **public lists and public title pages**. Must not sit inside `(app)` or be touched by its auth guard...
> `title` (features/) — Detail view — shared between authenticated and public variants, with an `isPublicView` flag gating the personal-action buttons.
> `AvailabilityBadge/` — shows which platform(s) a title is on, highlighting the user's active subscription.
> `media-status` (actions/) — Mark watched / want-to-watch / dismissed (`user_media_status` writes).
> marking watched revalidates `/panel`, `/biblioteca`, and the affected `/titulo/[slug]`.

`AvailabilityBadge` is explicitly a **shared** component (`components/`, not `features/`) precisely because "Dónde ver" logic will be reused later by panel/recommendations — build it there now rather than inside `features/title/`.

### Requested field mapping

Every field the ticket asks to display or write already exists in the documented schema — nothing is new.

| Field requested | Type | Existing equivalent | Action |
| --- | --- | --- | --- |
| Poster | image | `media_items.poster_url` (text, nullable) | already exists (reuse) |
| Sinopsis | text | `media_items.description` (text, nullable) | already exists (reuse) |
| Año | number | `media_items.year` (integer, nullable) | already exists (reuse) |
| Calificación IMDb + votos | number | `media_items.imdb_rating` (numeric 3,1), `media_items.imdb_votes` (integer) | already exists (reuse) |
| Géneros | list | `genres` via `media_genres` | already exists (reuse) |
| Elenco | list | `people` via `media_people` where `role = 'actor'`, ordered by `sort_order` | already exists (reuse) |
| Calificación personal | number | `user_media_status.personal_rating` (smallint 1-10) — **read-only** in this ticket, no rating input UI in the ACs | already exists (reuse) |
| "Dónde ver" (plataformas + enlace) | list | `media_availability` (`is_available = true`) joined to `platforms`, cross-referenced against `user_subscriptions` (`ended_on is null`) for the highlight | already exists (reuse) |
| Marcado visto/no visto | boolean write | `user_media_status.watched` + `watched_at` | already exists (reuse) |
| Agregar/quitar watchlist | boolean write | `user_media_status.want_to_watch` + `want_added_at` | already exists (reuse) |
| `is_stub` special state | boolean read | `media_items.is_stub` | already exists (reuse) |

No migration is required for this ticket.

### Impacted files

**App routes**
- `app/(public)/titulo/[slug]/page.tsx` — new. The single physical route for both variants (see Decisions #1). Awaits `params` (Next.js 16 async `params`), optionally reads the session, calls `actions/media/getTitleDetail`, renders `features/title/TitleDetail`.

**Actions**
- `actions/media/getTitleDetail.ts` (+ `actions/media/index.ts` barrel) — new. Orchestrates the three services below into one DTO; does not require a session (works for both variants).
- `actions/media-status/index.ts` (+ discrete functions) — new. The **canonical** shared write action: `markWatched`, `markNotWatched`, `addToWatchlist`, `removeFromWatchlist`. Session check, ownership via `auth.uid()`, `revalidatePath` for `/panel`, `/biblioteca`, `/titulo/[slug]`.

**Services**
- `services/MediaServices/index.ts` — new. `getBySlugWithDetails(supabase, slug)`: title + genres + cast.
- `services/MediaAvailabilityServices/index.ts` — new. `getAvailableForMedia(supabase, mediaId)`: `is_available = true` rows joined to `platforms`.
- `services/MediaStatusServices/index.ts` — new. `getForUser(supabase, userId, mediaId)` (read), `upsertStatus(supabase, userId, mediaId, patch)` (write, upsert on the `(user_id, media_id)` unique constraint).
- `services/SubscriptionServices/index.ts` — new, minimal. `getActiveForUser(supabase, userId)` only — enough to compute the "Tu servicio" match. Full subscription CRUD belongs to RIK-6; flag this so RIK-6 extends rather than duplicates this file.
- `services/index.ts` — new barrel, exports all of the above.

**Features**
- `features/title/TitleDetail.tsx` — new. Server component, two-column layout (poster + info) per vistas doc §2.2.
- `features/title/TitleActions.tsx` — new. Client component: watched + watchlist toggle buttons, `useTransition`, calls `actions/media-status` directly, Sonner toast feedback.
- `features/title/CastList.tsx` — new. Cast avatar row.
- `features/title/WhereToWatch.tsx` — new. "Dónde ver" section, composes `components/AvailabilityBadge`.
- `features/title/StubNotice.tsx` — new. `Alert` for `is_stub = true`.

**Components (shared)**
- `components/AvailabilityBadge/AvailabilityBadge.tsx` — new. Deliberately promoted to `components/` (not `features/title/`) per `ARCHITECTURE.md`'s own Shared UI section, so RIK-7/RIK-8 reuse it instead of rebuilding it.
- `components/ui/*` — add via `shadcn` CLI (Base UI / `base-lyra` variant, already configured in `components.json`): `avatar`, `badge`, `card`, `alert`, `skeleton`. Only `button.tsx` exists today.

**Types**
- No new base type needed — `MediaItem`, `Genre`, `Person`, `Platform`, `MediaAvailability`, `UserSubscription`, `UserMediaStatus` are expected from RIK-1's `types/index.ts`. Define the aggregate read shape (`TitleDetailDTO` or similar) locally in `actions/media/getTitleDetail.ts` rather than adding it to the shared barrel — it's a view-specific composite, not a table-backed type.

**Tests**
- No test framework is configured in `package.json` yet (no `jest`/`vitest`). Do not add a new framework as part of this ticket; note in the work log where tests should live once one exists (co-located `__tests__` next to `services/MediaStatusServices/`).

### Decisions made

1. **Physical route location: `app/(public)/titulo/[slug]/page.tsx`, not `(app)`.** Rationale: `ARCHITECTURE.md` explicitly assigns "public title pages" to the `(public)` group; Next.js cannot resolve the same path from two route groups; and the Features table already documents one shared component gated by `isPublicView`. The page performs its own optional session read (`supabase.auth.getUser()`) instead of relying on `(app)`'s blanket redirect. **Unconfirmed default** — grounded in `ARCHITECTURE.md`'s own text, but no ticket spelled out the routing mechanics explicitly. Recorded in `<clarify_before_coding>`.
2. **Authenticated nav chrome rendered directly by the page, not inherited from a layout.** Since `(public)/layout.tsx` is documented as minimal (logo + auth links only), the authenticated branch of `/titulo/[slug]` must import and render `components/layout/Header` / `Nav` itself when a session is present, rather than assuming a parent layout provides them. **Unconfirmed default.**
3. **Only the authenticated branch is functionally required by this ticket's four ACs.** The `isPublicView` flag and its read-only rendering path are structurally built now (buttons hidden/redirect-to-login), but full manual QA of the anonymous branch is deferred to RIK-11, since RIK-10 (list sharing) hasn't landed and there's no way to reach this page without a session yet except direct URL entry. Confirmed low-risk default.
4. **Canonical action folder is `actions/media-status/`** (kebab-case), correcting the team comment's `actions/mediaStatus/*` casing to match `ARCHITECTURE.md`'s documented convention.
5. **Title-detail reads go through `actions/media/getTitleDetail.ts`**, matching `ARCHITECTURE.md`'s explicit assignment of "Title detail reads" to the `media` actions folder, rather than the Server Component querying services directly (which is only the documented pattern for the truly public list read path).
6. **No Zustand store for this screen.** The two toggle buttons use `useTransition` and call the server action directly; a client store would add indirection `ARCHITECTURE.md` doesn't mandate for every feature (it says stores are used "e.g." for filters/UI flags, not universally).
7. **AC "alcanzable por click desde panel, recomendaciones y listas propias" is verified as a route-contract check**, not a click-through, since none of those source screens exist yet. Recorded explicitly so the verification report doesn't overstate what was tested.
8. **`personal_rating` is read-only in this ticket.** The ticket's own acceptance criteria only ask for watched/watchlist toggles; no rating-input UI is in scope.

### Out of scope

- Building `/panel`, `/recomendaciones`, `/mis-listas` or `MediaCard` — those are RIK-7, RIK-8, RIK-10 and are not blocked by this ticket; this ticket only guarantees the `/titulo/[slug]` contract they will link to.
- The anonymous/no-session rendering branch's full UX polish and "create your own list" CTA — deferred to RIK-11, which depends on RIK-10.
- Full `user_subscriptions` CRUD (activate/close/history) — RIK-6 owns that; this ticket adds only the minimal active-subscription read needed for the "Tu servicio" highlight.
- Stub enrichment (populating poster/synopsis/cast for `is_stub` titles) — schema doc §11.3 flags this as an unresolved backend process outside any current ticket; this ticket only renders the notice.
- Adding to a personal list ("agregar a lista") — mentioned in the PRD's action list for the ficha (documento-especificación §7.7) but not in this ticket's actual acceptance criteria, and depends on `user_lists`/`list_items` (RIK-10). Left as a visible TODO hook in `TitleActions.tsx`, not implemented.
- A test framework — none exists in the repo; not introduced here.

---

## Implementation plan

**Goal:** Ship the single, session-aware `/titulo/[slug]` route with full authenticated behavior (read + manual watched/watchlist writes + availability highlight + stub handling), built so the already-documented public variant only needs a content branch added later, not a relocation.

**In scope:**
1. Services: `MediaServices.getBySlugWithDetails`, `MediaAvailabilityServices.getAvailableForMedia`, `MediaStatusServices.getForUser` + `upsertStatus`, `SubscriptionServices.getActiveForUser`.
2. Actions: `actions/media/getTitleDetail.ts` (read orchestration), `actions/media-status/` (canonical write action — `markWatched`, `markNotWatched`, `addToWatchlist`, `removeFromWatchlist`), each setting `source = 'manual'`, `manually_edited = true`, with `revalidatePath('/panel')`, `revalidatePath('/biblioteca')`, `revalidatePath('/titulo/[slug]')`.
3. Route: `app/(public)/titulo/[slug]/page.tsx` — async `params`, optional session read, renders `features/title/TitleDetail` with `isPublicView`.
4. Feature components: `TitleDetail`, `TitleActions` (client), `CastList`, `WhereToWatch`, `StubNotice`.
5. Shared component: `components/AvailabilityBadge/AvailabilityBadge.tsx`.
6. shadcn additions (Base UI/`base-lyra`): `avatar`, `badge`, `card`, `alert`, `skeleton`.

**Out of scope:** panel/recommendations/lists screens, full subscription CRUD, stub enrichment, add-to-list action, test framework — see Out of scope above for reasons.

**Key risks / compatibility:**
- Route-group placement (`(public)` vs `(app)`) is the single biggest structural risk — if RIK-2 lands with a different `(app)`/`(public)` boundary than documented here, this route may need to move. Flagged loudly in `<clarify_before_coding>`.
- `media_availability` will legitimately be empty until RIK-3 runs; "Dónde ver" must render a correct, non-broken empty state.
- RLS: personal-status reads/writes must use the cookie-bound server client, never `admin.ts`, or every write will silently fail under RLS.

**Acceptance criteria mapping:**

| AC | Satisfied by |
| --- | --- |
| AC-1/2 | `markWatched`/`markNotWatched` in `actions/media-status/`, upserting `watched`, `source='manual'`, `manually_edited=true` |
| AC-3/4 | `addToWatchlist`/`removeFromWatchlist` in `actions/media-status/`, same guarantee on `want_to_watch` |
| AC-5 | `MediaAvailabilityServices.getAvailableForMedia` filters `is_available = true` |
| AC-6 | `WhereToWatch` + `AvailabilityBadge`, cross-referencing `SubscriptionServices.getActiveForUser` |
| AC-7 | `StubNotice` + defensive rendering (`poster_url`/`description`/cast all optional) in `TitleDetail` |
| AC-8 | Stable `/titulo/[slug]` route confirmed reachable by direct navigation (click-through deferred per Decision #7) |

---

## Claude Code prompt

```xml
<task id="RIK-9" title="Ficha de título y marcado manual" depends_on="RIK-1, RIK-2, RIK-3">

  <role>
    You are a senior full-stack engineer working on Rikuna, a Next.js 16 (App Router) + React 19 +
    TypeScript + Supabase project. You follow the project's layered + feature-sliced architecture
    strictly: app/ (routes) -> features/ (screens) -> actions/ ("use server") -> services/ (data access).
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — layered + feature-sliced layout, route groups ((app)/(public)/(auth)), auth
      boundaries, ingestion vs user actions, Server Actions table, Services table, Features table.
      Pay special attention to the line: "title — Detail view — shared between authenticated and public
      variants, with an isPublicView flag gating the personal-action buttons" and the (public) group's
      description ("public lists and public title pages").</item>
    <item>AGENTS.md — this project runs Next.js 16, which has breaking changes vs. your training data.
      Read node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
      before writing the page component: `params` is a Promise and must be awaited (or unwrapped with
      `use()` in a Client Component). Read
      node_modules/next/dist/docs/01-app/02-guides/server-actions.md before writing actions/media-status/ —
      note the session/ownership guidance (derive identity from the session, never trust an id owner
      field the client claims).</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the completion
      report's commit deliverable.</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md Section 7.7 ("Ficha de título") — content
      and action list for this screen.</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md Sections 1 (design system: style is documented as
      "lyra" there but the REAL components.json says "base-lyra" — see ground truth notes), 2.2
      (authenticated ficha: two-column layout, cast avatars, "Tu servicio" badge, stub placeholder), and
      2.3 (public variant note — same ficha, no session-only actions).</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md Sections 2 (media_items, genres, people), 3
      (platforms, media_availability), 4 (user_subscriptions), 5 (user_media_status — read this one
      fully, it has the business rules this ticket must not violate), and 9 (RLS table + the owner_all
      policy pattern).</item>
    <item>components.json — confirm the real shadcn config (style, baseColor, aliases) before adding any
      component.</item>
    <item>app/layout.tsx — existing root layout conventions (font variables, `cn`, `LayoutProps<'/'>`
      typed helper) to match when creating nested layouts/pages.</item>
    <item>supabase/migrations/ — read the latest timestamped file(s) once RIK-1 has landed. Confirm real
      column names/types/defaults for media_items, genres, media_genres, people, media_people, platforms,
      media_availability, user_subscriptions, user_media_status BEFORE writing any query. Do not trust
      this document's schema recall over the actual migration file.</item>
    <item>types/index.ts (from RIK-1) — reuse the existing MediaItem, Genre, Person, Platform,
      MediaAvailability, UserSubscription, UserMediaStatus types. Do not redefine them.</item>
    <item>lib/supabase/server.ts and lib/supabase/client.ts (from RIK-2) — the request-scoped Supabase
      client factories. lib/supabase/admin.ts (from RIK-2) must NOT be imported anywhere in this ticket's
      code — it is ingestion-only.</item>
    <item>CHANGELOG.md — format and where to append the new entry under [Unreleased].</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna is a personal streaming-rotation planner. The title detail ("ficha") screen at
    /titulo/[slug] is where a user reads everything about one title (poster, synopsis, year, IMDb
    rating/votes, genres, cast, their own rating if any) and decides what to do about it: mark it
    watched, add/remove it from their watchlist, and see which of their currently-paid streaming
    services actually carries it.

    The database (RIK-1, documented in specs/RIKUNA-PRD-schema-basedatos-rikuna.md) already has every
    column this screen needs — nothing new is created by this ticket:
    - media_items: imdb_id, type, title, year, description, poster_url, imdb_rating, imdb_votes,
      imdb_url, is_stub (boolean, default false), slug (unique).
    - genres / media_genres, people / media_people (role='actor' for cast, ordered by sort_order).
    - platforms, media_availability (media_id, platform_id, country, url, offer_type, is_available,
      unique on media_id+platform_id+country+offer_type).
    - user_subscriptions (user_id, platform_id, country, started_on, ended_on — null ended_on = active;
      a user can have several concurrently active subscriptions on different platforms).
    - user_media_status (user_id, media_id — unique together; watched, watched_at, personal_rating,
      want_to_watch, want_added_at, dismissed, source default 'manual', manually_edited default false).

    "Watchlist" in this ticket's language IS want_to_watch/want_added_at on user_media_status — there is
    no separate watchlist table. watched and want_to_watch are independent booleans, never a single
    status enum: a title can be both watched=true and want_to_watch=true simultaneously (the schema doc
    explicitly allows this and says "watched wins" for exclusion from recommendation queries — not
    relevant to this ticket, but do not "clean up" want_to_watch when marking watched).

    The write action this ticket builds (actions/media-status/) is the SHARED, canonical mutation point.
    RIK-7 (panel) and RIK-8 (discovery recommendations) will later call the exact same exported
    functions from their own client components — do not build a parallel/duplicate mutation path for
    them to reinvent; export cleanly-named functions from actions/media-status/index.ts.
  </context>

  <ground_truth_db_notes critical="true">
    <note>supabase/migrations/ does not exist in the repo at spec-writing time. This ticket depends on
      RIK-1 landing first. Re-read the actual migration before writing any query — do not assume the
      schema doc's SQL is byte-identical to what RIK-1 shipped.</note>
    <note>There is no "watchlist" table. Watchlist add/remove writes want_to_watch + want_added_at on
      user_media_status, the same row watched/watched_at lives on (unique per user_id+media_id).</note>
    <note>Every manual write (watched toggle, watchlist toggle) MUST set source = 'manual' AND
      manually_edited = true on the row, every time — not just on first insert. This is what protects the
      row from being silently overwritten by a future IMDb CSV reimport (RIK-4).</note>
    <note>user_media_status has RLS restricted to the owner (auth.uid() = user_id) for BOTH read and
      write. Every query/mutation against it must run through the request-scoped, cookie-bound Supabase
      client (lib/supabase/server.ts's createClient()) so auth.uid() resolves inside Postgres. Do NOT use
      lib/supabase/admin.ts anywhere in actions/ or services/ touched by this ticket — that client is
      reserved for ingestion/ only and bypasses RLS entirely.</note>
    <note>media_items, genres, people, platforms, media_availability are PUBLICLY readable per RLS
      (including the anon role) — reading them does not require a session. Only the personal-status join
      (user_media_status) and the active-subscription lookup (user_subscriptions) require one.</note>
    <note>media_items.is_stub is a real, already-indexed boolean column (media_items_stub_idx WHERE
      is_stub) — treat it as a first-class UI state per ARCHITECTURE.md's "Conventions worth preserving"
      section, not an edge case. poster_url, description, and any media_people rows can all be NULL/empty
      simultaneously on a stub row; the layout must not crash or leave visible gaps.</note>
    <note>components.json's real "style" value is "base-lyra" (the Base UI variant of shadcn), NOT "lyra"
      as specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md Section 1.3 documents — the project migrated off
      Radix. Add shadcn components with the project's actual configured style; do not hand-write
      Radix-specific primitive APIs.</note>
    <note>/titulo/[slug] is documented in the PRDs as if it were two screens (authenticated §2.2 vs.
      public §2.3 of vistas-y-estilo-rikuna.md), but it is ONE URL. Next.js cannot resolve the same path
      from two route groups. Place the single page.tsx under app/(public)/titulo/[slug]/ — ARCHITECTURE.md
      explicitly assigns "public title pages" to the (public) group — and make the page itself decide
      what to render based on whether a session exists, rather than relying on a route group's layout to
      gate it. Do NOT create app/(app)/titulo/[slug]/page.tsx — that would collide with the (public) one
      if it also existed, and this ticket standardizes on (public) as the single physical location.</note>
    <note>(public)'s layout is documented as intentionally minimal (logo + auth links, no nav sidebar).
      When a session IS present, this page must render the authenticated nav chrome itself (import
      components/layout/Header and components/layout/Nav directly), because it will not inherit them from
      a (public) parent layout.</note>
    <note>Next.js 16: the `params` prop passed to a page.tsx is a Promise — `const { slug } = await
      params` in the Server Component (or `use(params)` if it were a Client Component, which it is not
      here).</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="Services">
      <item>Create services/MediaServices/index.ts exporting class MediaServices with method
        getBySlugWithDetails(supabase, slug): fetches the media_items row by slug, plus its genres (via
        media_genres join) and cast (media_people where role='actor', ordered by sort_order). Returns null
        if no row matches the slug (the page must 404 in that case).</item>
      <item>Create services/MediaAvailabilityServices/index.ts exporting class MediaAvailabilityServices
        with method getAvailableForMedia(supabase, mediaId): returns media_availability rows where
        is_available = true for that media_id, joined to platforms for name/slug/logo_url/url.</item>
      <item>Create services/MediaStatusServices/index.ts exporting class MediaStatusServices with:
        getForUser(supabase, userId, mediaId) — returns the existing row or null;
        upsertStatus(supabase, userId, mediaId, patch) — upserts on the (user_id, media_id) unique
        constraint, always forcing source='manual' and manually_edited=true on the written row regardless
        of what patch contains for those two fields.</item>
      <item>Create services/SubscriptionServices/index.ts exporting class SubscriptionServices with
        getActiveForUser(supabase, userId): returns all user_subscriptions rows where ended_on is null for
        that user (a user may have several active subscriptions across platforms). This is a MINIMAL
        service for this ticket's "Tu servicio" highlight only — do not build activate/close/history
        methods here, that is RIK-6's scope; leave the file easy for RIK-6 to extend.</item>
      <item>Create or extend services/index.ts as the barrel exporting all of the above.</item>
    </phase>

    <phase title="Actions — reads">
      <item>Create actions/media/getTitleDetail.ts (and actions/media/index.ts barrel if it doesn't
        exist) exporting an async function getTitleDetail(slug: string) that: creates the request-scoped
        Supabase client; reads the current user via supabase.auth.getUser() (optional — do NOT redirect if
        absent, this function must work for both the authenticated and future public branch); calls
        MediaServices.getBySlugWithDetails, MediaAvailabilityServices.getAvailableForMedia, and — only
        when a user is present — MediaStatusServices.getForUser and SubscriptionServices.getActiveForUser;
        composes and returns a single DTO (define its shape locally in this file, e.g. TitleDetailDTO) that
        includes: the media item, genres, cast, availability rows, the user's personal status (or null),
        the user's active subscriptions (empty array if none/no session), and isPublicView: boolean (true
        when there is no session). Return null if the slug does not match any media_items row.</item>
    </phase>

    <phase title="Actions — writes (the canonical shared action)">
      <item>Create actions/media-status/index.ts with the "use server" directive at the top, exporting
        four functions: markWatched(mediaId: string), markNotWatched(mediaId: string),
        addToWatchlist(mediaId: string), removeFromWatchlist(mediaId: string). Each: reads the session via
        the request-scoped client and returns/throws an explicit unauthorized result if there is none
        (never trust a userId passed from the client — derive it from the session only); calls
        MediaStatusServices.upsertStatus with the appropriate patch (markWatched: watched=true,
        watched_at=now(); markNotWatched: watched=false; addToWatchlist: want_to_watch=true,
        want_added_at=now(); removeFromWatchlist: want_to_watch=false), always forcing source='manual' and
        manually_edited=true inside the service, not just in the action; calls revalidatePath for '/panel',
        '/biblioteca', and the current '/titulo/[slug]' path after a successful write.</item>
      <item>These four exports are the ONLY place user_media_status is written to from the UI layer for
        this ticket. Do not add a second mutation path anywhere in features/title/.</item>
    </phase>

    <phase title="Route">
      <item>Create app/(public)/titulo/[slug]/page.tsx as an async Server Component. Await params to get
        slug. Call getTitleDetail(slug); call notFound() from next/navigation if it returns null. Render
        features/title/TitleDetail with the resulting DTO as props.</item>
    </phase>

    <phase title="Features">
      <item>Create features/title/TitleDetail.tsx (Server Component): two-column layout (poster + info)
        per vistas-y-estilo-rikuna.md Section 2.2 — poster (or placeholder when poster_url is
        null/is_stub), title, year, IMDb rating Badge + vote count, genre badges, synopsis (or omitted
        gracefully when null), CastList, personal rating display if personalStatus?.personal_rating is
        present, StubNotice when is_stub, WhereToWatch section, and TitleActions. When isPublicView is
        true, render TitleActions in a read-only mode (buttons link to /auth/login instead of firing the
        action) — this branch does not need full polish per this ticket's scope, just must not crash or
        expose write controls to an anonymous visitor.</item>
      <item>Create features/title/TitleActions.tsx as a Client Component: two toggle controls (watched,
        watchlist) reflecting the current personalStatus, using useTransition to call
        markWatched/markNotWatched/addToWatchlist/removeFromWatchlist from actions/media-status directly,
        with Sonner toast feedback on success/error. Accepts an isPublicView prop; when true, render
        disabled/login-linking buttons instead of wiring the server actions.</item>
      <item>Create features/title/CastList.tsx: horizontal-scroll row of cast Avatars (name +
        character_name), gracefully rendering nothing (not a broken layout) when the cast array is
        empty.</item>
      <item>Create features/title/WhereToWatch.tsx: renders the "Dónde ver" heading and, for each
        available platform row, a components/AvailabilityBadge instance; renders a clear, non-broken empty
        state when the availability array is empty (do not hide the whole section silently — say
        something like "Sin disponibilidad confirmada por ahora").</item>
      <item>Create features/title/StubNotice.tsx: an Alert with Spanish copy substantially similar to
        "Información limitada — este título se completará pronto", rendered only when is_stub is
        true.</item>
    </phase>

    <phase title="Shared component">
      <item>Create components/AvailabilityBadge/AvailabilityBadge.tsx: takes one availability row
        (platform name/slug/url) plus a boolean isActiveSubscription; renders a Badge/Button-like element
        linking to the platform url (or a general platforms fallback if url is null), visually
        highlighted (e.g. a distinct Badge variant plus a "Tu servicio" label) when
        isActiveSubscription is true. This component must be usable standalone by future tickets
        (RIK-7/RIK-8) — no title-page-specific coupling in its props.</item>
    </phase>

    <phase title="UI primitives">
      <item>Add the shadcn components this screen needs via the CLI, using the project's real configured
        style (base-lyra) and baseColor (mist) from components.json: avatar, badge, card, alert, skeleton.
        Do not hand-author Radix-based primitives.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Clicking "marcar como visto" on the ficha for a title with no prior
      user_media_status row creates one with watched=true, source='manual', manually_edited=true.
      Verify: `select watched, source, manually_edited from user_media_status where user_id = :uid and
      media_id = :mid;` returns (true, 'manual', true).</criterion>
    <criterion id="AC-2">Clicking the same control again (un-marking) updates the existing row to
      watched=false while source stays 'manual' and manually_edited stays true. Verify: same query, watched
      now false, other two columns unchanged.</criterion>
    <criterion id="AC-3">Clicking "agregar a watchlist" sets want_to_watch=true, want_added_at not null,
      source='manual', manually_edited=true. Verify: equivalent SQL query on want_to_watch/want_added_at.</criterion>
    <criterion id="AC-4">Clicking "quitar de watchlist" sets want_to_watch=false while manually_edited
      stays true and source stays 'manual'. Verify: same query pattern.</criterion>
    <criterion id="AC-5">The "Dónde ver" section renders exactly the platforms whose media_availability
      row has is_available = true for that media_id, and none with is_available = false. Verify: compare
      rendered platform names against `select p.name from media_availability ma join platforms p on
      p.id = ma.platform_id where ma.media_id = :mid and ma.is_available;` — must match exactly; seed one
      is_available=false row for the same title and confirm it is absent from the UI.</criterion>
    <criterion id="AC-6">Among the platforms shown, the one matching a row in the user's active
      user_subscriptions (same platform_id + country, ended_on is null) is visually distinguished (e.g. a
      "Tu servicio" badge). Verify: seed an active subscription matching one listed platform and confirm
      only that one AvailabilityBadge renders in its highlighted state.</criterion>
    <criterion id="AC-7">A title with is_stub = true and null poster_url/description and no
      media_people rows renders the "información limitada" notice and a complete, non-broken layout
      (placeholder poster, no missing-section gaps, no thrown error). Verify: seed such a row, navigate to
      its /titulo/[slug], confirm no console/render error and the notice is visible.</criterion>
    <criterion id="AC-8">The ficha is reachable at a stable /titulo/[slug] URL for any existing slug via
      direct navigation, and the page composes cleanly enough (typed props, exported component) that a
      future <Link href={`/titulo/${slug}`}> from another screen requires no changes to this route.
      Verify: direct navigation succeeds; note in the verification report that click-through from
      panel/recommendations/lists cannot be tested because those screens do not exist yet (RIK-7, RIK-8,
      RIK-10).</criterion>
    <criterion id="AC-9">actions/media-status/index.ts is the only file in the diff that writes to
      user_media_status, and its four exported functions are the ones features/title/TitleActions.tsx
      calls — no parallel/duplicate mutation logic exists elsewhere in the diff. Verify: grep the diff for
      "user_media_status" writes; only services/MediaStatusServices/index.ts (the data-access layer) and
      actions/media-status/index.ts (the orchestration layer) should reference it for writes.</criterion>
    <criterion id="AC-10">Calling any of the four actions/media-status functions without a valid session
      does not write to user_media_status (returns/throws an explicit unauthorized result instead).
      Verify: read the auth-check code path in actions/media-status/index.ts and confirm it runs before
      any service call, or exercise it directly with no session cookie present.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a new migration under supabase/migrations/ — every field this ticket needs
      already exists per RIK-1's documented schema. If, after reading the real migration, a genuinely
      required column is missing, stop and report it rather than guessing a shape.</item>
    <item>Do NOT rename or drop any existing column, especially user_media_status.source,
      user_media_status.manually_edited, or media_items.is_stub.</item>
    <item>Do NOT import lib/supabase/admin.ts from anywhere touched by this ticket (actions/, services/,
      features/, app/(public)/titulo/). It is ingestion-only.</item>
    <item>Do NOT create app/(app)/titulo/[slug]/page.tsx. The single physical route lives at
      app/(public)/titulo/[slug]/page.tsx per the ground truth notes above.</item>
    <item>Do NOT build a second mutation path for watched/watchlist state outside
      actions/media-status/index.ts's four exported functions — that folder is the canonical, shared
      action other tickets will call.</item>
    <item>Do NOT add a rating-input UI — personal_rating is read-only display in this ticket.</item>
    <item>Do NOT implement /panel, /recomendaciones, /mis-listas, MediaCard, or full
      user_subscriptions CRUD — out of scope, owned by other tickets.</item>
    <item>Do NOT hand-write Radix-based component internals — this project's shadcn style is
      "base-lyra" (Base UI), confirmed in the real components.json.</item>
    <item>User-visible copy is Spanish; code identifiers, comments, and commit/PR text are English, per
      ARCHITECTURE.md's "Conventions worth preserving".</item>
  </constraints>

  <out_of_scope>
    <item>Panel, recommendations, and mis-listas screens (RIK-7, RIK-8, RIK-10) — this ticket only
      guarantees the /titulo/[slug] route contract they will link to.</item>
    <item>Full anonymous/no-session UX polish for the public variant, including a "create your own list"
      CTA — deferred to RIK-11.</item>
    <item>user_subscriptions activate/close/history management — RIK-6.</item>
    <item>Stub enrichment process that fills in poster/synopsis/cast for is_stub titles — unresolved
      backend process per schema doc Section 11.3, not owned by any current ticket.</item>
    <item>"Agregar a lista" action from the ficha — depends on RIK-10 (user_lists/list_items); leave a
      visible TODO hook in TitleActions.tsx, do not implement the dialog/logic.</item>
    <item>Introducing a test framework — none exists in the repo; note where tests should live once one
      is added, do not add one now.</item>
  </out_of_scope>

  <implementation_notes>
    <item>services/MediaServices/index.ts — `class MediaServices { constructor(private supabase:
      SupabaseClient) {} async getBySlugWithDetails(slug: string): Promise&lt;TitleWithDetails | null&gt;
      {...} }` (name the local composite type here, do not add it to types/index.ts).</item>
    <item>services/MediaStatusServices/index.ts — `async upsertStatus(userId: string, mediaId: string,
      patch: Partial&lt;Pick&lt;UserMediaStatus, 'watched'|'watched_at'|'want_to_watch'|'want_added_at'&gt;&gt;)`
      — always spreads `{ ...patch, source: 'manual', manually_edited: true }` into the upsert payload,
      `.upsert(..., { onConflict: 'user_id,media_id' })`.</item>
    <item>actions/media-status/index.ts — each exported function signature is
      `export async function markWatched(mediaId: string): Promise&lt;{ ok: true } | { ok: false; error:
      string }&gt;` (same shape for the other three) so TitleActions.tsx can branch on the result for the
      toast.</item>
    <item>app/(public)/titulo/[slug]/page.tsx — `export default async function TituloPage({ params }:
      PageProps&lt;'/titulo/[slug]'&gt;) { const { slug } = await params; ... }` — use the generated
      PageProps helper (per node_modules/next/dist/docs Next 16 typegen convention) rather than a hand
      written Promise type when possible; fall back to an explicit `Promise&lt;{ slug: string }&gt;` type
      if `next typegen` output isn't available in this environment.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases, created and wired together end-to-end (route ->
      feature -> action -> service -> Supabase).</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>No test suite exists yet — do not add one, but note in the work log where MediaStatusServices
      tests should live once a framework is introduced.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether app/(public)/titulo/[slug]/page.tsx (this ticket's chosen location) matches how RIK-2
      actually structures the (app)/(public)/(auth) route groups once it lands — if RIK-2's real auth
      guard is implemented differently (e.g. a per-route allowlist inside a single root layout instead of
      route-group-level guards), adjust the physical file location accordingly but keep the
      isPublicView-gated single-component contract. Default if unconfirmed: proceed with
      app/(public)/titulo/[slug]/page.tsx as specified.</item>
    <item>Whether the authenticated nav chrome (Header/Nav) should be imported directly into this page
      (this ticket's default, since (public)'s layout is minimal) or whether RIK-2 introduces a different
      shared-chrome mechanism. Default if unconfirmed: import components/layout/Header and
      components/layout/Nav directly in the authenticated branch.</item>
    <item>Naming of the four actions/media-status exports (markWatched/markNotWatched/addToWatchlist/
      removeFromWatchlist) — cheap to rename later since this is the only ticket calling them so far.
      Default if unconfirmed: keep the names as specified so RIK-7/RIK-8 can grep for them.</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-10): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-9: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-9_title_detail_page.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to title_detail_page, matching specs/backlog/RIK-9_title_detail_page.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-9_title_detail_page.md in the metadata table.</item>
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
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Translate them into product language (for example say "the title page" instead of naming the component, "the watched toggle" instead of naming columns).</item>
      <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots — include a "## Screenshots" section, since this ticket has user-visible UI: list 1-4 numbered items, each with screen/area name, auth state, and what the screenshot should show (e.g. "Title page — with active subscription: /titulo/[a known slug] showing the highlighted 'Tu servicio' platform badge"; "Title page — stub title: the limited-information notice with placeholder poster"). Suggest at most 4.</item>
      <item>Do NOT embed images in the markdown — attachments are added by the human. Prefix each screenshot line with `[attach: short label]`.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human (developer or QA) to confirm the work works.</item>
      <item>This ticket is Mixed UI + Database — include "## Prerequisites" (dev server running, a logged-in test user, at least one seeded media_items row with a slug, ideally one is_stub=true row and one row with a matching media_availability + user_subscriptions pair), then "## UI validation" (numbered steps: navigate to /titulo/[known-slug], toggle watched, toggle watchlist, observe toast + button state change, navigate to the stub-title slug and observe the notice, observe the "Tu servicio" highlighted badge), then "## Database validation" (runnable read-only SQL against user_media_status and media_availability matching the acceptance criteria queries above, using the real table/column names), then "## Expected outcome" (bullets tying back to AC-1 through AC-10).</item>
      <item>Use concrete app paths: /titulo/[slug]. Note that /panel, /recomendaciones, /mis-listas are not yet built, so entry points other than direct URL navigation cannot be manually tested for this ticket.</item>
      <item>SQL must be read-only verification queries only.</item>
    </deliverable>
  </completion_report>
</task>
```
