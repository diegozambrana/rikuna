# RIK-11 — Public list sharing and public title page (no session)

## Ticket summary

Rikuna's MVP includes one deliberate exception to "everything requires a session": a user can mark a list public and share a link that works for anyone, logged in or not. This ticket builds that exception end to end — the `(public)` route group's real pages (`/l/[codigo]` for a shared list, and the logged-out branch of `/titulo/[slug]`), plus the missing piece of schema it depends on: a globally-unique `public_code` on `user_lists`, since the internal `slug` is only unique per user and cannot safely be the public identifier once multiuser opens (schema doc Section 11.6).

- Add a new migration giving `user_lists` a `public_code` column, generated once when a list is first made public, and use it (never `slug`) as the `/l/[codigo]` identifier.
- Implement `getPublicListUrl`, which RIK-10 leaves as a placeholder for "copiar enlace".
- `/l/[codigo]` must render with zero session and show only that list's name, description and title grid — nothing else from the owner's account.
- Making a list private must make `/l/[codigo]` stop resolving for everyone except the owner.
- Clicking a title from the public list must reach the public branch of `/titulo/[slug]` — the same route used by authenticated users (RIK-9), gated by an `isPublicView` flag rather than a duplicated route, since Next.js route groups cannot resolve the same URL twice.
- No team comments exist beyond the ticket's own note, which is treated as authoritative scope: this ticket closes RIK-10's placeholder and extends RIK-9's component instead of building either from scratch.

---

## Context

### Original ticket

**RIK-11 — Public list and public title page (no session)**

Routes under `(public)`: `/l/[codigo]` to view a public list without an account, and the public variant of `/titulo/[slug]` without the actions that require a session. Per schema doc Section 9.2, a list's public identifier must be different from the internal `slug` (unique only per user) so it doesn't collide between accounts once multiuser opens — use a separate short code for the public link.

**Acceptance criteria (as written):**
- `/l/[codigo]` is reachable without a session (incognito window) and does not go through the `(app)` guard.
- The public view shows only the list's name, description and a grid of its titles — nothing from the rest of the owner's account (no history, no subscriptions, no other lists).
- Marking the list private makes `/l/[codigo]` stop resolving (404 or equivalent) for any visitor who is not the owner.
- From `/l/[codigo]`, clicking a title goes to the public variant of `/titulo/[slug]`, with no "mark watched" or "add to list" buttons; if those controls are shown at all, they lead to login instead of executing the action.
- The public code is globally unique (it does not reuse `user_lists`'s internal `slug`).

**Note:** `user_lists`, `list_items`, and the `(public)` route group do not exist in the codebase yet — they are the responsibility of RIK-1 (schema) and RIK-2 (route groups), both sibling tickets in flight. This ticket's own schema change (the `public_code` column) is an ALTER on top of RIK-1's table, delivered as a new, separately-timestamped migration — never an edit to RIK-1's file.

### Team comments

The ticket text itself carries a scope-defining note (no separate team comments exist for this ticket), treated as authoritative:

> This ticket both finishes RIK-10's "copiar enlace" placeholder (implementing `getPublicListUrl`) and adds the public-read branch to RIK-9's `/titulo/[slug]` component. Cross-check `RIKUNA-PRD-vistas-y-estilo-rikuna.md` Section 2.3 for the minimal public layout (no nav, just logo + login/signup CTA) and Section 3 ("border radius 0 on every component" — the Lyra style constraint applies here too). This is the ticket most sensitive to the privacy rule in `RIKUNA-PRD-documento-especificacion-rikuna.md` Section 11 ("a list is public only if the owner explicitly marks it, and only that one list becomes visible") — the acceptance criteria and constraints must be airtight about not leaking owner account data.

This redirects scope in two concrete ways worth calling out:
1. `getPublicListUrl` is **not** RIK-10's function to write — RIK-10 only wires the "copiar enlace" button's UI; this ticket owns the function itself, because it can't exist before `public_code` exists.
2. `/titulo/[slug]`'s public branch is an **extension** of RIK-9's component (via a prop/flag), not a second route — the "public" and "authenticated" ficha are the same physical page.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| Routes live "under `(public)`" | `app/` currently has only `layout.tsx`, `page.tsx`, `globals.css`, `favicon.ico` (Create Next App scaffold) — no `(public)`, `(app)`, or `(auth)` folders exist yet; RIK-2 (dependency) only *reserves* the concept in `ARCHITECTURE.md` | This ticket creates the `(public)` group's layout and its first two real pages, not just an addition to an existing group. |
| Public identifier must differ from `user_lists.slug` | `user_lists` doesn't exist in the database yet either — `supabase/migrations/` is empty; RIK-1's own backlog spec (`specs/backlog/RIK-1_database_schema_rls.md`) confirms it will create `user_lists` exactly per schema doc Section 6, with **no** `public_code` column | This ticket's migration is an ALTER against a table that doesn't exist until RIK-1 lands — it must be a new, later-timestamped file, never a merge into RIK-1's migration. |
| `/titulo/[slug]` "public variant... without actions that require a session" | `ARCHITECTURE.md`'s `features/title` entry already models this as **one** shared component "with an `isPublicView` flag gating the personal-action buttons" — and Next.js route groups explicitly forbid two folders resolving to the same URL (`route-groups.md`: "Conflicting paths... would both resolve to `/about` and cause an error") | There cannot be a separate `app/(app)/titulo/[slug]` and `app/(public)/titulo/[slug]`. There is exactly one physical route; whichever group it lives in, the page must determine session state itself (not rely on a route-group-level guard) to decide which branch to render. |
| Implicit assumption: auth guard is `middleware.ts` (per `ARCHITECTURE.md`'s own wording) | This is Next.js 16. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`: "The `middleware.js` file convention has been **deprecated** in Next.js 16 and renamed to `proxy.js`." The project root guard file that RIK-2 must have produced is `proxy.ts`, exporting a `proxy` function — not `middleware.ts` | AC-1's verification ("does not go through the `(app)` guard") must be checked against the real root file, whichever RIK-2 actually created. If it is still named `middleware.ts` when this ticket lands, that is itself a defect this ticket should flag (not silently work around), since `middleware.ts` has no effect in Next 16 beyond a deprecation shim. |
| "Copiar enlace" reads as already functional per RIK-10's own description | RIK-10 is itself unimplemented (parallel sibling); its ticket text describes the button but not the URL-generation logic, and this ticket's own note explicitly assigns `getPublicListUrl` here | This ticket, not RIK-10, is where `getPublicListUrl` is implemented and first wired to a real `public_code`. |

### Current database state

Nothing exists yet in `supabase/migrations/` (confirmed empty). Per RIK-1's own backlog spec, `user_lists` will be created as:

```sql
create table if not exists public.user_lists (
    id          uuid default gen_random_uuid() not null primary key,
    created_at  timestamptz default now() not null,
    updated_at  timestamptz default now() not null,
    user_id     uuid not null references auth.users(id) on delete cascade,
    name        varchar not null,
    slug        varchar not null,
    description text,
    is_public   boolean default false not null,
    constraint user_lists_user_slug_uq unique (user_id, slug)
);

create table if not exists public.list_items (
    id         uuid default gen_random_uuid() not null primary key,
    created_at timestamptz default now() not null,
    list_id    uuid not null references public.user_lists(id) on delete cascade,
    media_id   uuid not null references public.media_items(id) on delete cascade,
    sort_order integer default 0 not null,
    note       text,
    constraint list_items_uq unique (list_id, media_id)
);
```

RLS (RIK-1, from schema doc Section 9.2, applied verbatim):

```sql
create policy "user_lists_select" on public.user_lists
    for select using (is_public or auth.uid() = user_id);

create policy "list_items_select" on public.list_items
    for select using (
        exists (
            select 1 from public.user_lists l
            where l.id = list_items.list_id
              and (l.is_public or l.user_id = auth.uid())
        )
    );

grant select on public.user_lists to anon, authenticated;
grant select on public.list_items to anon, authenticated;
```

**Critical takeaway for this ticket:** this RLS pattern already does the heavy lifting for AC-3 ("private list stops resolving"). When `is_public = false`, an anonymous request's `auth.uid()` is `null`, so `user_lists_select` evaluates to `false` and Postgres returns **zero rows** — no application-level "is this list private" branch is strictly required to enforce privacy, though the page must still turn "zero rows" into a `notFound()` (404), not a blank/broken page. `list_items_select` inherits the same guarantee transitively, so a public list's items are also RLS-safe without extra filtering.

There is no existing `public_code` column, no lookup table, and no code anywhere in the repo that generates or resolves one — greenfield within this ticket.

### Current logic (public reads)

No current implementation exists (fresh codebase). The closest ground truth is `ARCHITECTURE.md`'s stated intent:

> Public reads (`/l/[codigo]`) go through **services** directly from a Server Component using the anonymous-capable server client — they don't need an `actions/` entry since there's no mutation or session check involved.

and the Features table's description of `features/title`:

> Detail view — shared between authenticated and public variants, with an `isPublicView` flag gating the personal-action buttons

Both are directives to follow, not code to diff against.

### Requested field mapping

| Field requested | Type | Existing equivalent | Action |
| --- | --- | --- | --- |
| Public list identifier ("código corto") | short unique string | `user_lists.slug` exists but is unique only per `(user_id, slug)` — explicitly disqualified by the ticket itself | **Must be created** — new column `user_lists.public_code varchar unique`, populated on first publish |
| List name / description shown publicly | text | `user_lists.name`, `user_lists.description` (from RIK-1) | Already exists (reuse) |
| Title grid (poster, title, year, rating) | derived | `list_items` → `media_items` (`title`, `poster_url`, `year`, `imdb_rating`, `slug`, `is_stub`) | Already exists (reuse) |
| `getPublicListUrl` | function | RIK-10 leaves it as a named placeholder, no implementation anywhere | **Must be created** in this ticket |
| Public branch of `/titulo/[slug]` | route/prop | `features/title` component (RIK-9, in flight) already designed for an `isPublicView` flag per `ARCHITECTURE.md` | Extend existing component; do not fork a new route |
| `(public)` route layout | UI shell | Does not exist; `ARCHITECTURE.md` reserves "logo + auth links, no nav" as the intended shape | **Must be created** — `app/(public)/layout.tsx` |

### Impacted files

**migration**
- `supabase/migrations/<timestamp>_user_lists_public_code.sql` (new) — adds `public_code` to `user_lists`, timestamped after RIK-1's two migrations.

**types**
- `types/UserList.ts` (or the `types/index.ts` barrel entry, whichever convention RIK-1/RIK-10 land with) — add `publicCode: string | null`.

**services**
- `services/ListServices/index.ts` — add `getPublicListByCode(client, code)` (scoped select, list + items + media), and generate/persist `public_code` inside the visibility-update method when a list transitions to public for the first time.

**lib**
- `lib/urls.ts` (new) — `getPublicListUrl(publicCode: string | null): string | null`, a pure formatting helper with no DB access.

**actions**
- `actions/lists/index.ts` — visibility-toggle action calls the service method that assigns `public_code` on first publish and returns it in the DTO so `getPublicListUrl` has something to format.

**routes / app**
- `app/(public)/layout.tsx` (new) — minimal shell: logo + login/signup CTA, no nav, per vistas doc Section 2.3.
- `app/(public)/l/[codigo]/page.tsx` (new) — Server Component, reads via `services/ListServices` directly (no `actions/` entry needed), calls `notFound()` on a missing/private list.
- `app/(public)/titulo/[slug]/page.tsx` (or wherever RIK-9 physically placed `/titulo/[slug]` — relocate if RIK-9 nested it inside `app/(app)/`, since that would make it unreachable without a session) — add the `isPublicView` branch.
- Root `proxy.ts` (Next 16 name for what `ARCHITECTURE.md` calls `middleware.ts`) / `lib/supabase/proxy.ts` — verify the pass-through matcher already covers `(public)` paths and the (possibly relocated) `/titulo/[slug]`; fix if RIK-2 didn't anticipate a route living outside `(app)` while still needing to be visited by authenticated users too.

**features / components**
- `features/lists/public/` (new) — presentational grid for the public list view.
- `features/title/` — extend with an `isPublicView` prop (RIK-9's component).
- `components/MediaCard/` — reuse if RIK-7/RIK-9 have already created it by implementation time; otherwise create a minimal local card here and leave a consolidation TODO (do not block this ticket on sibling merge order).

**tests**
- No test suite exists yet in this project. Note where component/route tests should live once a runner is introduced; do not add a test harness as part of this ticket.

### Decisions made

1. **`public_code` lives as a column on `user_lists`**, not a separate lookup table — the ticket's own suggested primary option, and simplest given RLS is already scoped per-row on `user_lists`. *Recommended default, not confirmed by a human.*
2. **Generation strategy:** a short (10-character) URL-safe random string (e.g. `crypto.randomUUID()` stripped of hyphens and truncated, or an equivalent CSPRNG-backed generator), assigned once the first time a list is set `is_public = true`, with collision handling via retry against the DB's unique constraint (Postgres error `23505`) rather than relying on probability alone. The code is **stable** across later public/private toggles — turning a list private and public again reuses the same code, it does not rotate. *Recommended default.*
3. **`getPublicListUrl` location:** `lib/urls.ts`, a pure function taking a `publicCode` and returning `/l/${publicCode}` (relative, so the caller controls origin) or `null` if the list has no code yet. Used by both the visibility-toggle action's return value and the "copiar enlace" button in RIK-10's UI. *Recommended default.*
4. **Physical location of `/titulo/[slug]`:** must resolve to a single route outside the `(app)` auth guard (e.g. `app/(public)/titulo/[slug]/page.tsx`, or an unglouped `app/titulo/[slug]/page.tsx` if that reads more naturally once RIK-9 lands) — the page determines session state itself via `supabase.auth.getUser()` (no throw/redirect) and passes the result down as `isPublicView` to `features/title`. If RIK-9 shipped it inside `app/(app)/titulo/[slug]`, this ticket must relocate it. *Recommended default / correction, flagged for verification against RIK-9's actual output.*
5. **Logged-out personal-action buttons:** default to **not rendering** "mark watched" / "add to list" controls for a logged-out visitor at all (replaced by a login/signup CTA per PRD Section 7.10), rather than rendering dead buttons that redirect to login on click. Both satisfy the ticket's acceptance criterion as written ("si se muestran, llevan a login"), but hiding is simpler and matches the PRD's own described public ficha. *Recommended default.*
6. **`MediaCard` reuse is opportunistic, not blocking.** If it doesn't exist yet when this ticket is implemented, build a minimal local card for the public grid and flag it for later consolidation — do not wait on RIK-7/RIK-9 merge order. *Recommended default.*

### Out of scope

- Cross-account discovery / public profiles (explicitly Fase 3 in the PRD roadmap, Section 12).
- Rotating or expiring `public_code` on republish — the code is stable for the list's lifetime once assigned (see Decision 2).
- Rate limiting or abuse protection on the public routes — not named in any acceptance criterion.
- Full SEO/OG metadata generation for shared lists — only the `noindex` behavior `notFound()` already provides for free is in scope; a dedicated `generateMetadata`/OG-image pass is future work.
- Building `(app)`'s guard itself, `user_lists`/`list_items` tables, or `features/title`'s authenticated branch — those are RIK-2, RIK-1, and RIK-9 respectively; this ticket only extends/verifies them.

---

## Implementation plan

**Goal:** wire the one deliberate unauthenticated surface in Rikuna — a public list and its titles — end to end, from a new `public_code` column through to two real pages, without ever letting an anonymous request touch anything else in the owner's account.

**In scope:**
1. New migration: `user_lists.public_code varchar unique`, plus a lookup index, added on top of RIK-1's schema (never editing RIK-1's file).
2. `types/UserList` gains `publicCode`.
3. `services/ListServices`: `getPublicListByCode()` (scoped read: list + items + media only, explicit column list, no `user_id`/owner data in the returned shape) and public-code assignment inside the existing visibility-update path.
4. `lib/urls.ts`: `getPublicListUrl()`.
5. `actions/lists`: wire the visibility toggle to persist/return `public_code`.
6. `app/(public)/layout.tsx`: minimal shell (logo + login/signup CTA, no nav).
7. `app/(public)/l/[codigo]/page.tsx`: Server Component, `notFound()` on missing/private list.
8. `/titulo/[slug]`: confirm or relocate to a location reachable without a session; add `isPublicView` gating in `features/title`.
9. Verify root `proxy.ts` / `lib/supabase/proxy.ts` truly passes through `(public)` paths and `/titulo/[slug]`.

**Out of scope:** see above — discovery, code rotation, rate limiting, full OG metadata, and anything belonging to RIK-1/RIK-2/RIK-9's own scope.

**Key risks / compatibility:**
- The single biggest risk is accidental data leakage: any query on the public path that isn't scoped to exactly the requested list/media rows (e.g. joining `user_subscriptions` or `user_media_status`, or `select *` on `user_lists` and forwarding it whole to the client) would violate the PRD's Section 11 privacy rule. Explicit column selection in `getPublicListByCode` is mandatory, not just relying on RLS.
- Next.js route groups cannot have two folders resolve to the same URL — this constrains where `/titulo/[slug]` can physically live; getting this wrong is a build-time error, not a subtle bug, but only once someone tries to add both.
- `proxy.ts` vs `middleware.ts` naming: if RIK-2 used the deprecated name, this ticket should surface that rather than route around it silently.

**Acceptance criteria mapping:**

| AC | Satisfied by |
| --- | --- |
| AC-1 | `app/(public)/l/[codigo]/page.tsx` outside `(app)`; verified pass-through in `proxy.ts` |
| AC-2 | `getPublicListByCode`'s explicit column selection; no other service call from the public page |
| AC-3 | RLS zero-row behavior on `is_public = false` + `notFound()` when the service returns nothing |
| AC-4 | `isPublicView` branch in `features/title`; no session-gated buttons execute |
| AC-5 | New `public_code` column + unique constraint + retry-on-collision generation, independent of `slug` |

---

## Claude Code prompt

```xml
<task id="RIK-11" title="Public list sharing and public title page (no session)" depends_on="RIK-1, RIK-2, RIK-9, RIK-10">
  <role>
    You are a senior full-stack engineer on Rikuna, a Next.js 16 (App Router) + React 19 + TypeScript
    personal streaming-rotation planner backed by Supabase (Postgres + RLS). You build one vertical
    slice end to end, following this repo's layered + feature-sliced architecture exactly.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — layered + feature-sliced layout, the (public) route group's deliberate
      auth-boundary exception, the Services/Actions/Features conventions, and the exact reserved
      shapes this ticket must fill in (ListServices' public-list read path, features/title's
      isPublicView flag).</item>
    <item>AGENTS.md — this is not the Next.js you know; breaking changes vs. training data. Before
      touching routing or the auth-guard file, read the real docs under
      node_modules/next/dist/docs/ (resolved from the repo root) rather than assuming prior
      knowledge.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md —
      confirms middleware.js is deprecated and renamed to proxy.js in Next.js 16. If the project's
      root guard file is still named middleware.ts, that is itself a defect to flag, not something
      to silently work around.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md — the
      real proxy.ts API: default/named export "proxy", the "config.matcher" shape, and pass-through
      patterns for excluding specific paths.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md —
      confirms two route-group folders can never resolve to the same URL path (build error). This is
      why /titulo/[slug] must be exactly one physical route, not one per group.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md —
      params is a Promise; use the PageProps&lt;'/route/[param]'&gt; typed helper (already used in
      app/layout.tsx via LayoutProps&lt;"/"&gt;) for the new dynamic pages.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md — notFound()
      behavior: throws, terminates the segment's render, injects a noindex meta tag. Call it directly
      in the render path (a Server Component or a function it awaits), not inside a try/catch you
      don't rethrow through.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the
      completion_report's commit_message deliverable.</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — Section 7.10 (public list screen
      spec), Section 11 ("a list is public only if the owner explicitly marks it, and only that one
      list becomes visible — never the rest of the account").</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 9.2 (the exact RLS SQL this ticket's
      queries rely on) and Section 11.6 (the public_code gap this ticket resolves).</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 2.3 (public zone: minimal layout, no
      nav, logo + login/signup CTA; the public /titulo/[slug] variant) and Section 3 (Lyra style:
      border-radius 0 on every generated component).</item>
    <item>specs/backlog/RIK-1_database_schema_rls.md — ground truth for the real user_lists /
      list_items columns, RLS policies and migration filenames this ticket's migration must follow
      and come after.</item>
    <item>components.json — real project config: style "base-lyra" (migrated off Radix onto
      @base-ui/react), baseColor "mist". Do not assume plain "lyra"/Radix from the PRD's older config
      snippet.</item>
    <item>components/ui/button.tsx and lib/utils.ts — the only existing UI primitive and the cn()
      helper; match their conventions (border-radius already forced to 0 via "rounded-none") for any
      new component.</item>
    <item>CHANGELOG.md — format and where to append the entry for this ticket.</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna has exactly one unauthenticated, read-only surface: a list the owner has explicitly marked
    public, reachable at /l/[codigo], plus that list's titles' detail pages at /titulo/[slug] in a
    read-only branch. Everything else in the product requires a session. RIK-1 (schema) creates
    user_lists / list_items with RLS already allowing anon SELECT when is_public = true (Section 9.2).
    RIK-2 (routing) reserves the (public) route group and its pass-through in the auth guard. RIK-9
    builds the authenticated /titulo/[slug] as one component gated by an isPublicView flag (per
    ARCHITECTURE.md). RIK-10 builds /mis-listas and /mis-listas/[slug], including a "copiar enlace"
    button that is a UI placeholder — it does not yet have a real URL to copy.

    This ticket is what makes the placeholder real and what actually builds the two (public) pages.
    Nothing in this ticket exists yet: no (public) route group folder, no ListServices,
    no lib/urls.ts, no public_code column. Do not assume any of it is already wired.
  </context>

  <ground_truth_db_notes critical="true">
    <note>supabase/migrations/ will contain, by the time this ticket lands, at least
      &lt;timestamp&gt;_create_mvp_schema.sql and &lt;timestamp+1&gt;_enable_rls_policies.sql from
      RIK-1. Read the actual files present at implementation time — do not assume exact filenames,
      only that user_lists and list_items exist with the columns and RLS shown in
      specs/RIKUNA-PRD-schema-basedatos-rikuna.md Section 6 and Section 9.2. Your new migration must
      be timestamped strictly after RIK-1's migrations.</note>
    <note>user_lists has NO public_code column yet. Do not assume it exists. Add it via
      `alter table public.user_lists add column if not exists public_code varchar;` plus a unique
      index `create unique index if not exists user_lists_public_code_uq on public.user_lists
      (public_code) where public_code is not null;` (a partial unique index tolerates multiple NULLs
      for lists never made public, and is at least as safe as a bare UNIQUE constraint). Do NOT add
      a NOT NULL constraint — the column starts NULL for every list until first publish, and there is
      no production data to backfill (pre-launch project).</note>
    <note>user_lists.slug is unique only per (user_id, slug) — schema doc Section 11.6 explicitly
      forbids using it as the public identifier. Never read or write user_lists.slug for anything
      related to the public route; use public_code exclusively for /l/[codigo].</note>
    <note>RLS on user_lists (`user_lists_select`: `is_public or auth.uid() = user_id`) and list_items
      (inherits via EXISTS on the parent list) already do the privacy enforcement for anon requests —
      when is_public = false, an anonymous SELECT returns zero rows, full stop. Do not add a
      redundant "if not owner and not public, block" check in application code as a substitute for
      RLS; DO add a notFound() call when the service returns no row, since RLS alone produces an
      empty result, not an HTTP 404.</note>
    <note>Both `grant select on public.user_lists to anon, authenticated;` and the equivalent for
      list_items are required for RLS to even be evaluated for the anon role (RIK-1's own migration
      note: "sin este grant, RLS nunca llega a evaluarse"). Verify these grants exist before assuming
      a debugging session about "public lists returning nothing for anon" is an RLS policy bug rather
      than a missing grant.</note>
    <note>Next.js 16 deprecates middleware.ts in favor of proxy.ts at the project root (see
      mandatory_reading). ARCHITECTURE.md's own prose still says "middleware.ts" — treat that as
      stale terminology, not instruction. Find and read whatever file RIK-2 actually produced before
      writing anything about the guard. If it is proxy.ts, verify its matcher/pass-through logic
      (likely delegated to lib/supabase/proxy.ts's updateSession()) already excludes `(public)` route
      paths; if it is still middleware.ts, flag this explicitly in your verification_report as a
      defect for RIK-2 rather than silently renaming it yourself as part of this ticket (out of
      scope) — unless fixing it is the only way to satisfy AC-1, in which case do the minimal rename
      and note it clearly as an out-of-scope fix you had to make.</note>
    <note>Next.js route groups cannot have two folders resolve to the same URL (route-groups.md:
      "Routes in different groups should not resolve to the same URL path... would cause an error").
      /titulo/[slug] must be exactly ONE physical folder. If RIK-9 placed it at
      app/(app)/titulo/[slug]/page.tsx, that location is unreachable by an anonymous visitor because
      it sits inside the (app) auth-guarded layout tree — you must relocate it (e.g. to
      app/(public)/titulo/[slug]/page.tsx, or an ungrouped app/titulo/[slug]/page.tsx) as part of this
      ticket, preserving RIK-9's component logic, and have the page itself check
      supabase.auth.getUser() (no throw/redirect) to decide which branch to render.</note>
    <note>media_items, list_items carry no per-user data — they are safe to join for the public grid
      as-is. Do NOT join user_subscriptions, user_media_status, or any other user_lists row belonging
      to the same owner into the public read path, even if convenient — that is exactly the leak the
      PRD's Section 11 privacy rule forbids.</note>
  </ground_truth_db_notes>

  <story>
    As a visitor without a Rikuna account, when someone shares a list link with me, I want to open it
    and see that list's titles immediately — no signup, no login — and when I click through to a
    title, I want to see its public details without being asked to create an account, except when I
    try to use an action (mark watched, add to list) that genuinely requires one.
    (Synthesized from specs/RIKUNA-PRD-documento-especificacion-rikuna.md Section 7.10 — the ticket
    itself did not include an explicit user story.)
  </story>

  <requirements>
    <phase title="1. Database migration">
      <item>Create supabase/migrations/&lt;YYYYMMDDHHMMSS&gt;_user_lists_public_code.sql, timestamped
        after RIK-1's migrations (check the real files present in supabase/migrations/ and pick a
        later timestamp).</item>
      <item>alter table public.user_lists add column if not exists public_code varchar; — nullable,
        no default, no backfill (no production data exists).</item>
      <item>create unique index if not exists user_lists_public_code_uq on public.user_lists
        (public_code) where public_code is not null;</item>
      <item>Do NOT edit RIK-1's migration files. Do NOT add RLS policies here — Section 9.2's existing
        policies on user_lists already cover the new column since RLS is row-level, not
        column-level.</item>
    </phase>

    <phase title="2. Types">
      <item>Add publicCode: string | null to the UserList type (types/UserList.ts, or the matching
        entry in types/index.ts's barrel — check which convention RIK-1/RIK-10 actually used and
        extend it, do not duplicate or overwrite existing exports).</item>
    </phase>

    <phase title="3. Services">
      <item>In services/ListServices/index.ts (create if RIK-10 hasn't yet, extend if it has), add:
        getPublicListByCode(client: SupabaseClient, code: string): Promise&lt;PublicListView | null&gt;
        — selects an explicit column list from user_lists (id, name, slug is NOT selected/exposed,
        description, public_code) filtered by public_code = code, joined to list_items -> media_items
        with an explicit column list (title, slug, year, poster_url, imdb_rating, is_stub, sort_order).
        Order items by sort_order. Return null when no row comes back (RLS already filtered private
        lists to zero rows) so the caller can notFound().</item>
      <item>Add or extend the existing visibility-update method (whatever RIK-10 named it, e.g.
        updateVisibility/setPublic) so that when a list transitions from is_public = false to true and
        public_code is currently null, generate a new code (see Phase 4 helper) and persist it in the
        same update. Do not regenerate or clear public_code when toggling back to private, or when
        re-publishing a list that already has a code.</item>
      <item>No cookies(), revalidatePath, or auth checks belong in this file per ARCHITECTURE.md —
        those stay in actions/.</item>
    </phase>

    <phase title="4. Public code generation and URL helper">
      <item>Create lib/urls.ts (or extend it if it already exists) exporting:
        generatePublicListCode(): string — a 10-character URL-safe random string, e.g. derived from
        crypto.randomUUID() with hyphens stripped and truncated, or an equivalent CSPRNG source. This
        can live in lib/urls.ts or directly inside ListServices — prefer lib/urls.ts if the codebase
        has no other precedent, so it is reusable and independently testable.
        getPublicListUrl(publicCode: string | null): string | null — returns `/l/${publicCode}` or
        null when there is no code yet (list never published).</item>
      <item>The service method from Phase 3 must retry code generation on a Postgres unique-violation
        error (code 23505) up to a small bounded number of attempts (e.g. 5) rather than assuming the
        random string can never collide.</item>
    </phase>

    <phase title="5. Actions">
      <item>In actions/lists/index.ts (create if missing, extend if RIK-10 created it), the
        server-action wrapping the visibility toggle must call the updated service method and return
        the list's public_code (and/or the formatted URL via getPublicListUrl) in its response DTO, so
        the "copiar enlace" UI (RIK-10) has something real to copy. Verify session
        (supabase.auth.getUser()) and ownership before allowing the toggle, per this project's normal
        actions-layer pattern.</item>
      <item>revalidatePath the list's owner-facing route (/mis-listas/[slug]) after the toggle; the
        public /l/[codigo] route does not need revalidation triggers from this action since it always
        reads live.</item>
      <item>Public reads themselves (GET /l/[codigo], GET /titulo/[slug] public branch) do NOT need an
        actions/ entry — call services/ListServices directly from the Server Component, per
        ARCHITECTURE.md's explicit guidance for this exact case.</item>
    </phase>

    <phase title="6. (public) route group and pages">
      <item>Create app/(public)/layout.tsx: minimal shell per vistas doc Section 2.3 — Rikuna
        logo/name linking home, and login/signup CTAs. No nav, no account menu. Respect the Lyra
        border-radius-0 constraint on anything rendered (Section 3) — reuse components/ui/button.tsx
        as-is, it already forces rounded-none.</item>
      <item>Create app/(public)/l/[codigo]/page.tsx as an async Server Component using
        PageProps&lt;'/l/[codigo]'&gt; for typed params (params is a Promise — await it). Call
        services/ListServices.getPublicListByCode with the anon-capable server client
        (createClient() from lib/supabase/server). If null, call notFound(). Render the list's name,
        description, and a grid of its titles via a presentational component (Phase 7). Each title
        links to /titulo/[media.slug].</item>
      <item>Locate wherever RIK-9 actually placed /titulo/[slug]. If it is inside
        app/(app)/titulo/[slug]/page.tsx, relocate the page to a location reachable without a session
        (app/(public)/titulo/[slug]/page.tsx is the recommended default — see ground_truth note on
        route groups). Preserve RIK-9's data-fetching and component logic; the only functional
        addition is: (a) check session server-side without redirecting, (b) pass an isPublicView
        boolean into features/title, (c) when isPublicView is true, do not render session-gated
        actions as clickable buttons (default: omit them; a CTA to /auth/login is an acceptable
        alternative per the ticket's own acceptance criterion, but do not wire them to silently no-op
        or throw).</item>
      <item>This route must remain fully dynamic (do not add generateStaticParams for /l/[codigo] —
        list contents and privacy state can change at any time and must be read per-request).</item>
    </phase>

    <phase title="7. Features and components">
      <item>Create features/lists/public/ with a presentational component (e.g. PublicListGrid.tsx)
        that takes the list + items data and renders name, description, and a grid of MediaCard-style
        tiles (poster, title, year, imdb_rating badge), with zero session-dependent affordances.</item>
      <item>Check components/MediaCard/ first. If RIK-7/RIK-9 have already created it by
        implementation time, reuse it directly. If not, build a minimal local card in
        features/lists/public/ with the same visual contract (AspectRatio-reserved poster, title,
        year, rating Badge) and leave a one-line TODO comment pointing at future consolidation — do
        not block this ticket on sibling merge order.</item>
      <item>Extend features/title's component with an isPublicView prop: when true, hide (or disable
        + redirect-to-login, per the Decision in the backlog doc) "mark watched" and "add/remove from
        list" controls; the "Dónde ver" / cast / rating sections remain visible since they are not
        session-gated data.</item>
      <item>Check components/ui/ before adding any new shadcn primitive (Card, Badge, AspectRatio are
        likely needed and may not exist yet — add them via the shadcn CLI using this project's real
        style "base-lyra" and baseColor "mist" from components.json, matching button.tsx's
        conventions, rather than hand-rolling one the CLI already provides).</item>
    </phase>

    <phase title="8. Proxy / route-guard verification">
      <item>Read whatever root guard file RIK-2 produced (proxy.ts per Next 16 convention, or
        middleware.ts if RIK-2 used the deprecated name) and lib/supabase/proxy.ts's updateSession().
        Confirm its matcher/pass-through logic already excludes (public) group paths (/l/*) and the
        (possibly relocated) /titulo/[slug]. If /titulo/[slug] moved out of (app) as part of Phase 6
        and the guard was special-casing it as an (app) path, update the pass-through list so it is
        never redirected to /auth/login regardless of session state.</item>
      <item>Do not rewrite RIK-2's guard logic wholesale — make the minimal change needed so an
        anonymous incognito request to /l/[codigo] and /titulo/[slug] never redirects.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">/l/[codigo] for a published list, requested with no session cookie present
      (simulate an incognito request — no sb-access-token / sb-refresh-token cookies), returns a 200
      with the list content and does not redirect to /auth/login. Verify by reading the resolved
      middleware/proxy matcher config and by an actual unauthenticated request against a locally
      published list.</criterion>
    <criterion id="AC-2">The public list page's rendered output (and the server-side data it fetched)
      contains only that list's name, description, and its media_items grid — no fields from
      user_subscriptions, user_media_status, or any other user_lists row of the same owner. Verify by
      reading services/ListServices.getPublicListByCode's exact select statement (explicit column
      list, no wildcard, no join beyond list_items/media_items) and confirming no other service is
      called from app/(public)/l/[codigo]/page.tsx.</criterion>
    <criterion id="AC-3">Toggling a list's is_public to false makes a subsequent anonymous request to
      its /l/[codigo] return a 404 (via notFound()). Verify with a query as the anon role directly
      against user_lists filtered by the code (expect zero rows) and by hitting the route
      unauthenticated after the toggle.</criterion>
    <criterion id="AC-4">From the rendered public list grid, clicking a title navigates to
      /titulo/[slug] and that page renders with isPublicView = true: no "mark watched" or "add to
      list" button executes a mutation without a session — either the controls are absent, or clicking
      them navigates to /auth/login. Verify by reading features/title's isPublicView branch and by
      confirming no server action call happens without a prior supabase.auth.getUser() success.</criterion>
    <criterion id="AC-5">user_lists.public_code has a unique constraint (verify via
      information_schema or \d user_lists) and is never derived from or equal to user_lists.slug for
      any row that has both set — verify by reading the generation code path (Phase 4) and confirming
      it never reads the slug column.</criterion>
    <criterion id="AC-6">The root guard file (proxy.ts / middleware.ts, whichever exists) and
      lib/supabase/proxy.ts's pass-through logic explicitly account for /l/* and /titulo/* as
      unauthenticated-allowed paths — verify by reading the matcher/config and the updateSession()
      implementation.</criterion>
    <criterion id="AC-7">getPublicListUrl(publicCode) returns a working /l/&lt;code&gt; path for a
      published list and null for an unpublished one, and RIK-10's "copiar enlace" UI (if present by
      implementation time) is wired to call it rather than construct the URL inline — verify by
      reading lib/urls.ts and its call site(s).</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT edit RIK-1's migration files. This ticket's schema change is a new, separately
      timestamped migration.</item>
    <item>Do NOT use or expose user_lists.slug anywhere on the public path — public_code is the only
      identifier /l/[codigo] accepts.</item>
    <item>Do NOT import lib/supabase/admin.ts anywhere in this ticket's code — this is entirely a
      normal RLS-governed, user/anon-facing flow, not ingestion.</item>
    <item>Do NOT create a second physical route for /titulo/[slug]. There is exactly one page; the
      authenticated/public distinction is a runtime session check plus a component prop, never a
      duplicated app/ folder.</item>
    <item>Do NOT let any public-path query join or select user_subscriptions, user_media_status, or
      any user_lists row other than the one matching the requested public_code.</item>
    <item>Do NOT add a NOT NULL constraint or a default value to user_lists.public_code — it is null
      until first publish, by design.</item>
    <item>Do NOT regenerate or clear public_code when a list is toggled private then public again —
      it is stable for the list's lifetime once first assigned.</item>
    <item>Do NOT introduce rounded corners on any new component — components.json's style is
      "base-lyra" (Base UI, not Radix) and every existing primitive forces radius to 0
      (see components/ui/button.tsx's "rounded-none").</item>
    <item>Do NOT add generateStaticParams to app/(public)/l/[codigo]/page.tsx — this route must read
      live, per-request data.</item>
  </constraints>

  <out_of_scope>
    <item>Cross-account list discovery, public profiles — explicitly Fase 3 (multiuser opening) per
      the PRD roadmap, not this ticket.</item>
    <item>Rate limiting or bot/abuse protection on public routes — no acceptance criterion requires
      it.</item>
    <item>Full SEO/Open Graph metadata generation for shared lists (custom generateMetadata, OG
      images) — only notFound()'s built-in noindex behavior is in scope.</item>
    <item>Building user_lists/list_items themselves, the (app) auth guard's core logic, or
      features/title's authenticated-branch functionality from scratch — those belong to RIK-1, RIK-2,
      and RIK-9 respectively. This ticket only extends/relocates/verifies them where the public branch
      requires it.</item>
    <item>A "reconciliation" UI for what happens to an already-shared link when a list is deleted
      (deleting the list cascades list_items via existing FK ON DELETE CASCADE, and the public route
      naturally 404s afterward — no extra UI is required beyond the existing notFound() path).</item>
  </out_of_scope>

  <implementation_notes>
    <item>services/ListServices/index.ts — class ListServices { constructor(private supabase:
      SupabaseClient) {}; getPublicListByCode(code: string): Promise&lt;PublicListView | null&gt;;
      setVisibility(listId: string, isPublic: boolean): Promise&lt;UserList&gt;; ...whatever RIK-10
      already added, extended rather than replaced }</item>
    <item>lib/urls.ts — export function generatePublicListCode(): string; export function
      getPublicListUrl(publicCode: string | null): string | null;</item>
    <item>app/(public)/l/[codigo]/page.tsx — export default async function
      PublicListPage({ params }: PageProps&lt;'/l/[codigo]'&gt;) { const { codigo } = await params;
      ... }</item>
    <item>features/title's isPublicView prop should be a plain boolean threaded from the page's own
      supabase.auth.getUser() check — do not have features/title re-check auth itself (keep the
      session check at the page/Server-Component boundary, per this project's existing
      Server-Component-fetches/Client-feature-receives-props pattern).</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases above, created or modified.</item>
    <item>Run npm run lint and fix any issues introduced by this change.</item>
    <item>No automated tests exist in this project yet; do not add a test framework as part of this
      ticket — note in the verification_report where tests should live once one exists.</item>
    <item>Persist documentation per completion_report/persistence below.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Exact physical location RIK-9 chose for /titulo/[slug] cannot be known until that ticket
      lands. Default: relocate to app/(public)/titulo/[slug]/page.tsx if it was placed inside
      app/(app)/, preserving RIK-9's logic. Proceed with this default if RIK-9's actual location is
      ambiguous or undocumented at implementation time.</item>
    <item>Whether the root guard file is named proxy.ts or (deprecated) middleware.ts depends on
      RIK-2's actual output. Default: read whichever exists, treat proxy.ts as correct and
      middleware.ts as a defect to flag (not silently rename) unless renaming is the only way to
      satisfy AC-1.</item>
    <item>Whether components/MediaCard/ exists yet depends on RIK-7/RIK-9 merge order. Default: reuse
      if present, otherwise build a minimal local equivalent in features/lists/public/ and leave a
      consolidation TODO.</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-7): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-11: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-11_public_list_sharing.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-11_public_list_sharing.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: migration / types / services / actions / features / components / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-11 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file.</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; optional "Screenshots" section (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the shareable list link" instead of naming a column, "the public title page" instead of naming a component.</item>
      <item>Keep it under 15 lines for the core comment (excluding Screenshots).</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing.</item>
      <item>Include a "## Screenshots" section — this ticket has user-visible UI changes (a new public screen). List 1–4 items to capture, each with screen/area name, auth state, and what it should show, for example: "Public list — logged out: shared list page showing name, description, and title grid, no account menu"; "Public title page — logged out: title detail with no 'mark watched'/'add to list' buttons executing"; "Owner's list view: 'copy link' now produces a working shareable URL". Prefix each with `[attach: short label]`.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human to confirm the work works.</item>
      <item>This ticket is Mixed UI + DB, so include:
        "## Prerequisites" (dev server running, a published test list with at least one title, an
        incognito/private browser window, a second regular browser window signed in as the list
        owner),
        "## UI validation" — numbered steps covering: (1) as the owner, mark a list public and copy
        its link; (2) in an incognito window, open that link and confirm no login redirect and no
        account nav; (3) confirm only name/description/title grid render; (4) click a title and
        confirm the public title page has no working "mark watched"/"add to list" actions; (5) back
        in the owner's window, toggle the list back to private; (6) reload the same incognito link and
        confirm a 404,
        "## Database validation" — read-only SQL against user_lists/list_items to confirm public_code
        uniqueness and that a private list's row is invisible to the anon role,
        then "## Expected outcome" (bullets tying back to AC-1 through AC-7).</item>
      <item>Use concrete app paths: /mis-listas/[slug] (owner toggling visibility and copying the
        link), /l/[codigo] (public list), /titulo/[slug] (public title page). Note explicitly that
        /l/[codigo] and the public /titulo/[slug] branch are (public) routes requiring no
        session.</item>
      <item>SQL must be read-only verification queries only.</item>
    </deliverable>
  </completion_report>
</task>
```
