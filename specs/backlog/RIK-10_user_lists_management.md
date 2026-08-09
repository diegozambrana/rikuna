# RIK-10 — Mis listas

## Ticket summary

A logged-in user needs full self-service control over their own curated lists of titles: create a list, rename it, delete it, add or remove titles (both from inside the list and from a title's detail page), reorder titles within a list, and flip a list between private and public. This ticket delivers the **owner-side** screens (`/mis-listas`, `/mis-listas/[slug]`) and all the mutations behind them, on top of the `user_lists` / `list_items` tables that RIK-1 creates.

- Create, rename, delete a list; add/remove titles from the list detail screen and from the title detail page.
- Toggle a `Switch` on `/mis-listas/[slug]` to flip `user_lists.is_public`; the toggle and its persistence are this ticket's job — the actual public page that renders the shared link is RIK-11.
- Drag-to-reorder titles inside a list persists `list_items.sort_order` and survives a reload.
- RLS (already defined by RIK-1) must keep one user from seeing or editing another user's private lists — this ticket must not introduce an app-layer bypass (e.g. never using `lib/supabase/admin.ts` here).
- No comments beyond the ticket text were supplied for this run — description and acceptance criteria are the full scope.

---

## Context

### Original ticket

**RIK-10 — Mis listas**

**Descripción:** Gestión libre de listas propias: `/mis-listas` (listado con nombre, cantidad de títulos, badge de visibilidad, crear nueva) y `/mis-listas/[slug]` (detalle con títulos, reordenamiento, cambio de visibilidad y copiar enlace si es pública), sobre `user_lists`/`list_items`.

**Criterios de aceptación:**
- Un usuario puede crear, renombrar, eliminar una lista, y agregar/quitar títulos (desde la lista o desde la ficha de título).
- Cambiar el switch de visibilidad de una lista a pública genera de inmediato un enlace compartible funcional (implementado end-to-end en RIK-11, pero el toggle y la persistencia de `is_public` son de este ticket); cambiarla a privada invalida el acceso público en la siguiente carga.
- Reordenar títulos dentro de una lista persiste el `sort_order` y se refleja tras recargar.
- Un usuario no puede ver ni editar listas de otro usuario que no sean públicas (verificar con dos cuentas).

**Depends on:** RIK-1 (`Esquema de base de datos y RLS`), RIK-2 (`Autenticación y estructura de rutas`), RIK-9 (`Ficha de título y marcado manual`). **Blocks:** RIK-11 (`Lista pública`).

At spec time none of RIK-1, RIK-2, RIK-9 have landed — `supabase/migrations/`, `types/`, `services/`, `actions/`, `features/`, `app/(app)/` do not exist yet in this repository. This document assumes all three dependencies land first, exactly as described in the schema PRD (`specs/RIKUNA-PRD-schema-basedatos-rikuna.md`, Section 6 and 9.2) and re-derives nothing — the coding agent executing the prompt below must re-verify the real migration file before writing code (see Ground truth notes in the prompt).

### Team comments

None provided for this run. Two boundary notes were supplied directly by the requester (not the ticket tracker) and are treated as authoritative scope constraints, folded into `<constraints>` and `<out_of_scope>` below:

1. `user_lists.slug` is unique **per user only** (`user_lists_user_slug_uq`), not globally. The schema doc's own "Pendientes" section (11.6) flags this and recommends the public link use a **separate, globally-unique short code** instead of the internal slug, specifically to avoid collisions across users once multiuser (Fase 3) opens.
2. RIK-10 (this ticket) keeps using the internal per-user `slug` for the **owner's own** `/mis-listas/[slug]` routes. The separate public code (new column or table — undecided) is **RIK-11's** responsibility. This ticket must expose the "copy link" affordance as a thin interface point — a `getPublicListUrl(list)` helper — rather than inventing the public code mechanism itself, so the two tickets compose without colliding on the same file.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| Ticket implies the public link is "generated immediately" on toggle | Schema doc Section 11.6: the internal `slug` is per-user unique only; no global public-code column/table exists yet, and inventing one here would collide with RIK-11's design decision | This ticket must NOT build the real shareable link. It persists `is_public` and renders the toggle/button through a stub `getPublicListUrl(list)` that returns a placeholder until RIK-11 implements it |
| Ticket references `user_lists`/`list_items` as if already migrated | `supabase/migrations/` does not exist yet in this repo; the DDL only exists in `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Section 6 | The coding agent must re-read the actual landed migration (from RIK-1) before writing queries — column names/casing here are sourced from the PRD, not verified code |
| Ticket doesn't mention which UI kit variant to use | `components.json` shows `"style": "base-lyra"` with `@base-ui/react` in `package.json` — the project has migrated off Radix onto Base UI, even though both PRD docs (`vistas-y-estilo-rikuna.md` Section 1.3, `documento-especificacion...`) describe plain `"lyra"` (Radix-based shadcn) | All new shadcn primitives (`Dialog`, `Switch`, `Tooltip`) must be added in the `base-lyra` style; do not copy Radix-flavored code from the PRD examples |
| Ticket doesn't say how a title is added to a list from the list side vs. the title side | PRD (`vistas-y-estilo-rikuna.md` 1.5, 2.2) shows two distinct UX entry points: a checkbox-list `Dialog`/`Popover` from the title detail page, and a reorderable grid with implied add/remove from the list detail page | Needs two different UI pieces sharing the same two Server Actions (`addListItem` / `removeListItem`) — detailed in Implementation plan |

### Current database state

Per `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` Section 6 (the migration itself does not exist in this repo yet — re-verify against the real file once RIK-1 lands):

```sql
create table if not exists public.user_lists (
    id          uuid        default gen_random_uuid() not null primary key,
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
create index if not exists list_items_list_idx on public.list_items (list_id, sort_order);
```

RLS (Section 9.2 — "the mixed public/private case"):

- `user_lists_select`: `using (is_public or auth.uid() = user_id)` — public rows readable by anyone (including `anon`), private rows only by the owner.
- `user_lists_write` / `user_lists_update` / `user_lists_delete`: all gated on `auth.uid() = user_id`.
- `list_items_select`: inherits from the parent list's visibility via an `exists` subquery on `user_lists`.
- `list_items_write` (all operations): gated on the current user owning the parent `user_lists` row — **not** a direct `user_id` column on `list_items` itself, because `list_items` has no `user_id` column.
- `grant select on user_lists, list_items to anon, authenticated` is required alongside the policies (already part of RIK-1's migration — this ticket does not re-issue it).

No new columns, tables, or migrations are required by this ticket. `ON DELETE CASCADE` on both FKs already means deleting a `user_lists` row removes its `list_items` rows without extra application code.

**Code usage today:** none — `services/`, `actions/`, `types/`, `features/` do not exist in this repo. This ticket is the first to write to `list_items` for manual list management (RIK-9 only reads/writes `user_media_status`, and triggers the "add to list" entry point but does not itself own list mutation logic).

### Current logic (list management)

No existing implementation — greenfield within the constraints above.

### Requested field mapping

| Field requested | Type | Existing equivalent | Action |
| --- | --- | --- | --- |
| List name | text | `user_lists.name` | already exists (reuse) |
| List description | text, optional | `user_lists.description` | already exists (reuse) |
| List visibility | boolean | `user_lists.is_public` | already exists (reuse) |
| List URL identifier (owner routes) | text | `user_lists.slug` (unique per `user_id`, not global) | already exists (reuse) — owner routes only, per the boundary note above |
| Public shareable code | text | none — explicitly out of scope for this ticket (RIK-11 decision: new column or table) | must be created, but NOT by this ticket — build only the `getPublicListUrl(list)` interface point |
| Title membership in a list | relation | `list_items` (`list_id`, `media_id`) | already exists (reuse) |
| Manual order within a list | integer | `list_items.sort_order` | already exists (reuse) |
| Per-item note | text, optional | `list_items.note` | already exists (reuse) — not in this ticket's acceptance criteria; expose the column in the type but no UI is required to satisfy AC-1..AC-4 |

### Impacted files

- **types** — `types/index.ts` (or `types/UserList.ts` / `types/ListItem.ts` if that barrel pattern is already split by RIK-9): add/confirm `UserList` and `ListItem` interfaces matching the real migration columns (camelCase mapped from snake_case).
- **services** — new `services/ListServices/index.ts`: owner-scoped CRUD (`getUserLists`, `getListBySlug`, `createList`, `renameList`, `deleteList`, `addListItem`, `removeListItem`, `reorderListItems`, `setListVisibility`). No public-read method is added here — that is RIK-11's addition to this same class.
- **actions** — new `actions/lists/index.ts`: `"use server"` wrappers around each mutation, session check via `supabase.auth.getUser()`, `revalidatePath('/mis-listas')` and `revalidatePath('/mis-listas/[slug]', 'page')` (via the real slug) as appropriate.
- **lib** — new `lib/lists/getPublicListUrl.ts`: stub helper `getPublicListUrl(list: UserList): string | null`, returns `null` until RIK-11 implements the real code.
- **components** — new `components/ui/dialog.tsx`, `components/ui/switch.tsx`, `components/ui/tooltip.tsx` (via `shadcn add`, `base-lyra` style, if not already added by an earlier ticket); new `components/Dialog/AddToListDialog.tsx` (shared checkbox-list dialog, consumed by RIK-9's title detail trigger and reusable from the list detail screen).
- **features** — new `features/lists/` slice: list grid + create/edit dialog for `/mis-listas`; detail screen (visibility switch, copy-link button+tooltip, reorderable grid, inline title search-and-add) for `/mis-listas/[slug]`; a small Zustand store for local drag state if the drag library needs one.
- **app routes** — new `app/(app)/mis-listas/page.tsx` and `app/(app)/mis-listas/[slug]/page.tsx` (Server Components; `params` is a `Promise` in this Next.js version — must `await params`).
- **dependencies** — likely new `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` in `package.json` for accessible drag-to-reorder (see Decisions made).
- **tests** — none exist yet in this repo; no test files are added by this ticket. Note where they should live once a test runner is introduced: `services/ListServices/*.test.ts`, `actions/lists/*.test.ts`.

### Decisions made

1. **Public link stays a stub in this ticket.** `getPublicListUrl(list)` returns `null` (or another explicit "not ready" sentinel) regardless of `is_public`; the Copy Link `Button` renders disabled with a `Tooltip` explaining the link isn't available yet. **Confirmed by requester** (explicit boundary instruction), not by the ticket text itself.
2. **`slug` is immutable after creation.** Renaming a list only updates `name`/`description`, never `slug` — this avoids breaking a link the user already shared and matches "renombrar" in the AC referring to the display name. Recommended default, unconfirmed.
3. **Slug generation on create.** Derive a kebab-case slug from `name` at creation time; on a `user_lists_user_slug_uq` collision for that user, append a short numeric suffix and retry once. Recommended default, unconfirmed.
4. **Drag-to-reorder library.** Use `@dnd-kit/core` + `@dnd-kit/sortable` (keyboard-accessible, React 19-compatible) rather than hand-rolled HTML5 drag events. Recommended default, unconfirmed — a native-DnD fallback is acceptable if the team wants zero new dependencies, at the cost of keyboard accessibility.
5. **Reorder persistence shape.** `reorderListItems(listId, orderedMediaIds: string[])` upserts `sort_order` for every row in one call (`supabase.from('list_items').upsert(rows, { onConflict: 'list_id,media_id' })`) rather than N sequential updates. Recommended default, unconfirmed.
6. **Two add-to-list UX entry points, one action pair.** The title-detail trigger (owned by RIK-9) and the list-detail "add title" search (owned by this ticket) both call the same `addListItemAction` / `removeListItemAction` — no duplicated mutation logic. Recommended default, unconfirmed.
7. **Reads bypass `actions/`.** Both page Server Components call `ListServices` directly with the session-bound server client (mirrors the pattern implied by ARCHITECTURE.md for authenticated reads) — only mutations go through `actions/lists`. Recommended default, unconfirmed.

### Out of scope

- `/l/[codigo]` public list page and the public `/titulo/[slug]` variant — RIK-11.
- The globally-unique public short code column/table and its generation/collision logic — RIK-11's schema decision, not this ticket's.
- The trigger button placement on `/titulo/[slug]` itself — RIK-9 owns that page; this ticket only ships the reusable `AddToListDialog` component RIK-9 imports.
- Per-item `note` editing UI — the column exists and is typed, but no acceptance criterion requires surfacing it.
- Bulk multi-select add/remove across many titles at once — one-at-a-time add/remove satisfies the AC.
- Any test suite scaffolding — none exists in the repo yet.

---

## Implementation plan

**Goal:** ship owner-side CRUD and reordering for `user_lists` / `list_items` behind `/mis-listas` and `/mis-listas/[slug]`, using the RLS RIK-1 already defines, without touching anything RIK-11 owns.

**In scope:**
1. Confirm/extend `types/index.ts` with `UserList` and `ListItem`, matching the real landed migration.
2. `services/ListServices/index.ts` — owner-scoped query/mutation methods listed above.
3. `actions/lists/index.ts` — session-checked Server Action wrappers with `revalidatePath`.
4. `lib/lists/getPublicListUrl.ts` — stub interface point for RIK-11.
5. Add `base-lyra` shadcn primitives needed (`dialog`, `switch`, `tooltip`) if not already present.
6. `components/Dialog/AddToListDialog.tsx` — shared checkbox-list dialog (lists × membership toggle for one `mediaId`).
7. `features/lists/` — list grid + create/edit `Dialog` for `/mis-listas`; detail screen with `Switch`, disabled copy-link `Button`+`Tooltip`, drag-reorderable grid, and an inline title search-and-add control for `/mis-listas/[slug]`.
8. `app/(app)/mis-listas/page.tsx` and `app/(app)/mis-listas/[slug]/page.tsx` — Server Components, `await params`.

**Out of scope:** see above — public rendering, public code mechanism, RIK-9's own trigger wiring.

**Key risks / compatibility:**
- RLS on `list_items` has no `user_id` column — ownership checks route through `user_lists`; a buggy `addListItemAction` that doesn't scope by the caller's own list will simply fail at the DB (RLS denies), which is correct, but the action should surface a clean error rather than a raw Postgres error.
- `params` is a `Promise` in this Next.js version (see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`) — a synchronous destructure will break the dynamic route.
- Deleting a list is irreversible (`AlertDialog` confirmation required per PRD Section 1.5) and cascades `list_items` via FK — no orphan cleanup code needed, but the confirmation UX is required.

**Acceptance criteria mapping:**

| AC | Satisfied by |
| --- | --- |
| AC-1 | `createList`/`renameList`/`deleteList` actions + `/mis-listas` create `Dialog` + `/mis-listas/[slug]` rename/delete controls |
| AC-2 | `addListItem`/`removeListItem` actions, wired from both `AddToListDialog` (title-detail entry point) and the list-detail search-and-add control |
| AC-3 | `setListVisibility` action persisting `is_public`; `Switch` on `/mis-listas/[slug]`; public read invalidation is inherited automatically from RIK-1's RLS policy (`is_public or auth.uid() = user_id`), needs no extra code here |
| AC-4 | `reorderListItems` action upserting `sort_order`; drag grid calls it on drop; reload re-fetches via `getListBySlug`, confirming persistence |
| AC-5 (cross-account isolation) | RLS policies from RIK-1 (`user_lists_select`, `list_items_select`/`write`) plus the route using the session-bound server client only — never `admin.ts` |

---

## Claude Code prompt

```xml
<task id="RIK-10" title="Mis listas — owner-side list management" depends_on="RIK-1,RIK-2,RIK-9">
  <role>
    You are a senior full-stack engineer on Rikuna, a Next.js 16 (App Router) + React 19 + TypeScript + Supabase
    personal streaming-rotation planner. You follow the project's layered + feature-sliced architecture strictly.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — layered + feature-sliced layout, auth route groups, services/actions boundary, ingestion vs. user-facing admin.ts rule.</item>
    <item>AGENTS.md — this Next.js version has breaking changes vs. your training data; read the relevant guide under node_modules/next/dist/docs/ before writing route code.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md — confirms `params` is a Promise in app/(app)/mis-listas/[slug]/page.tsx; you must `await params`.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping needed for the commit_message deliverable.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 6 (user_lists/list_items DDL), Section 9.2 (mixed public/private RLS pattern), Section 11.6 (slug is per-user unique only — do not treat it as a public code).</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 1.5 (component-per-need mapping: Dialog for create/edit, Switch for visibility, Button+Tooltip for copy-link, Dialog/Popover with checkboxes for add-to-list) and Section 2.2 (/mis-listas and /mis-listas/[slug] screen content).</item>
    <item>components.json — real style is "base-lyra" (Base UI), not the "lyra" (Radix) the PRD text describes; generate all new shadcn primitives in base-lyra.</item>
    <item>package.json — confirm current dependencies before adding @dnd-kit/* or any other new package.</item>
    <item>The most recent migration touching user_lists / list_items in supabase/migrations/ — the authoritative column list, casing, and constraints (this spec's DDL is sourced from the PRD, not verified code).</item>
    <item>types/index.ts, services/index.ts, actions/index.ts (or their barrel equivalents) if they exist — to see what RIK-1/RIK-2/RIK-9 already established for UserList, ListItem, and the session-check pattern used by other actions/ folders.</item>
    <item>Any existing components/MediaCard/ implementation — list grids reuse it; do not create a second title-card component.</item>
    <item>CHANGELOG.md — format and where to append entries under [Unreleased].</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna lets a user build free-form lists of titles (user_lists) with ordered items (list_items), each list
    either private (owner-only) or public (readable without a session, once RIK-11 ships the actual public page).
    RIK-1 creates both tables with RLS already handling the public/private read split; RIK-2 creates the
    (app) route group and its auth guard; RIK-9 creates /titulo/[slug] and will import a shared "add to list"
    dialog component from this ticket. This ticket is the FIRST to write to list_items.

    user_lists columns (verify against the real migration before coding): id (uuid pk), created_at, updated_at,
    user_id (uuid, references auth.users, cascade), name (text), slug (text, unique per user_id via
    user_lists_user_slug_uq — NOT globally unique), description (text, nullable), is_public (boolean, default false).

    list_items columns: id (uuid pk), created_at, list_id (uuid, references user_lists, cascade), media_id
    (uuid, references media_items, cascade), sort_order (integer, default 0), note (text, nullable). Unique
    constraint list_items_uq on (list_id, media_id) — a title can only appear once per list.

    list_items has NO user_id column of its own — ownership is entirely inherited through list_id -> user_lists.user_id.
    Every list_items mutation must be scoped through a list the caller owns; rely on RLS to enforce this at the
    database layer (do not attempt to replicate ownership logic in application code beyond what's needed for a
    clean error message).
  </context>

  <ground_truth_db_notes critical="true">
    <note>user_lists.slug is unique only per (user_id, slug), NOT globally. Never use it as, or build it into, a public sharing code — that is a deliberate, separate mechanism RIK-11 owns.</note>
    <note>There is no public-code column on user_lists yet, and this ticket must not add one. Build the "copy link" affordance as a call to a getPublicListUrl(list: UserList): string | null stub in lib/lists/getPublicListUrl.ts that currently always returns null. RIK-11 will replace the body of this function; do not change its signature without a reason documented in this ticket's completion report.</note>
    <note>RLS for user_lists/list_items (already applied by RIK-1's migration, do not re-issue the policies or the anon/authenticated grants): user_lists_select uses (is_public or auth.uid() = user_id); user_lists_write/update/delete require auth.uid() = user_id; list_items_select and list_items_write both check ownership via an EXISTS subquery against user_lists — there is no direct RLS column on list_items itself.</note>
    <note>ON DELETE CASCADE is already defined on list_items.list_id -> user_lists.id. Deleting a list does not require any explicit cleanup of its items in application code.</note>
    <note>components.json declares "style": "base-lyra" and package.json includes @base-ui/react — this project uses Base UI, not Radix, despite what the PRD prose says. Add new shadcn primitives (dialog, switch, tooltip) with the base-lyra style.</note>
    <note>Lyra styling means border-radius 0 everywhere — do not add rounded-* classes to any new component.</note>
    <note>lib/supabase/admin.ts (service-role client) must never be imported by anything under actions/lists or services/ListServices — this feature is entirely user-scoped and RLS-enforced, exactly like the rest of the (app) zone.</note>
    <note>params in app/(app)/mis-listas/[slug]/page.tsx is a Promise in this Next.js version — write `const { slug } = await params;` inside an async Server Component, not a synchronous destructure.</note>
  </ground_truth_db_notes>

  <story>
    As a signed-in Rikuna user, I want to freely create, rename, and delete my own lists, add or remove titles
    from them (from the list itself or from a title's detail page), reorder titles within a list, and toggle a
    list public or private, so that I can curate and eventually share collections of what I want to watch,
    while keeping the rest of my account private by default.
  </story>

  <requirements>
    <phase title="Dependencies">
      <item>Add @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities to package.json for accessible drag-to-reorder, unless the team has already added an equivalent library — check package.json first. If you choose a native-HTML5-DnD fallback instead, document the tradeoff (loses keyboard accessibility) in the completion report's decisions.</item>
    </phase>

    <phase title="Types">
      <item>In types/index.ts (or the established per-resource file pattern from earlier tickets), confirm or add UserList { id, createdAt, updatedAt, userId, name, slug, description, isPublic } and ListItem { id, createdAt, listId, mediaId, sortOrder, note } with camelCase fields mapped from the real snake_case columns.</item>
      <item>Add a ListWithItemCount (or equivalent) read shape for the /mis-listas grid (name, slug, isPublic, itemCount) if the plain UserList type doesn't already carry a count — do not add an itemCount column to the table; compute it in the service query (e.g. a count aggregate or a second query).</item>
    </phase>

    <phase title="Services">
      <item>Create services/ListServices/index.ts exporting a class that takes a SupabaseClient in its constructor, mirroring the pattern of other services/ folders.</item>
      <item>getUserLists(userId): fetch all of the caller's own lists with an item count.</item>
      <item>getListBySlug(userId, slug): fetch one owned list plus its list_items joined to media_items (for MediaCard rendering), ordered by sort_order. Return null if not found or not owned (RLS + explicit user_id filter, not just RLS alone, so a not-owned-but-still-public list correctly resolves as "not my list" on this owner-only route rather than silently rendering someone else's public list).</item>
      <item>createList(userId, { name, description }): generate a kebab-case slug from name; on a user_lists_user_slug_uq collision for that user, append a short numeric suffix and retry once.</item>
      <item>renameList(id, { name, description }): update name/description only — never touch slug.</item>
      <item>deleteList(id): delete the user_lists row; rely on ON DELETE CASCADE for list_items.</item>
      <item>addListItem(listId, mediaId): insert into list_items with sort_order = current max + 1 for that list; handle the list_items_uq unique violation gracefully (treat "already in list" as a no-op success, not an error).</item>
      <item>removeListItem(listId, mediaId): delete the matching row.</item>
      <item>reorderListItems(listId, orderedMediaIds: string[]): upsert sort_order for every row in one call using onConflict: 'list_id,media_id', setting sort_order to each item's index in the array.</item>
      <item>setListVisibility(listId, isPublic: boolean): update is_public.</item>
      <item>getListsContainingMedia(userId, mediaId): for AddToListDialog — return the caller's lists plus a boolean of whether mediaId is already in each, in one query.</item>
    </phase>

    <phase title="Actions">
      <item>Create actions/lists/index.ts with "use server" Server Actions wrapping every ListServices mutation above (not the reads — reads happen directly from Server Components per the pattern implied by ARCHITECTURE.md).</item>
      <item>Every action calls supabase.auth.getUser() first and returns an explicit error/redirect if unauthenticated, instantiates ListServices with the same session-bound client, then calls the matching service method.</item>
      <item>After createList/renameList/deleteList/setListVisibility: revalidatePath('/mis-listas') and, where a specific list's own page is affected, revalidatePath(`/mis-listas/${slug}`).</item>
      <item>After addListItem/removeListItem/reorderListItems: revalidatePath(`/mis-listas/${slug}`) for the affected list, and revalidatePath for the title's own page if you have the slug available (coordinate with RIK-9's title-page revalidation pattern if it already exists).</item>
    </phase>

    <phase title="Shared helper">
      <item>Create lib/lists/getPublicListUrl.ts exporting getPublicListUrl(list: UserList): string | null. For now, always return null regardless of list.isPublic — this is intentionally a stub RIK-11 will implement. Add a TODO comment referencing RIK-11.</item>
    </phase>

    <phase title="Components">
      <item>Add base-lyra shadcn primitives dialog, switch, tooltip if not already present in components/ui/ (check first — RIK-9 may have added some already).</item>
      <item>Create components/Dialog/AddToListDialog.tsx: given a mediaId, fetch the caller's lists via getListsContainingMedia, render each as a checkbox row (checked = already contains the title), toggling calls addListItemAction/removeListItemAction. This component takes no assumptions about where it's triggered from — RIK-9 will import and trigger it from /titulo/[slug]; this ticket does not add that trigger button itself.</item>
    </phase>

    <phase title="Features — /mis-listas">
      <item>features/lists/ListGrid.tsx (or similar): render the user's lists as cards — name, item count, visibility Badge (Pública/Privada), click-through to /mis-listas/[slug].</item>
      <item>features/lists/CreateListDialog.tsx: a Dialog with name + description fields, reused for both "Nueva lista" (create) and rename (edit) per the PRD's "Dialog para crear/editar" — pass an optional existing list to switch modes.</item>
      <item>Empty state when the user has no lists yet: message + "Nueva lista" button.</item>
    </phase>

    <phase title="Features — /mis-listas/[slug]">
      <item>features/lists/ListDetail.tsx: header with name, description, a Switch bound to setListVisibilityAction, and a Button+Tooltip "Copiar enlace" that is disabled (tooltip explains "Disponible próximamente") when getPublicListUrl(list) returns null — which it always does for now.</item>
      <item>Reorderable grid of MediaCard using @dnd-kit sortable context; on drag end, call reorderListItemsAction(listId, newOrderedMediaIds) and optimistically update local state (Zustand store or component state) while the request is in flight.</item>
      <item>An inline title search-and-add control (Input or Command per the PRD's search component guidance) that queries existing catalog search (reuse whatever MediaServices search method RIK-3/RIK-9 already established) and calls addListItemAction(listId, mediaId) on selection.</item>
      <item>Remove-from-list action (icon button per card) calling removeListItemAction.</item>
      <item>Rename/delete controls: reuse CreateListDialog for rename; an AlertDialog-confirmed delete that redirects to /mis-listas on success.</item>
      <item>Not-found handling: if getListBySlug returns null (list doesn't exist or the caller doesn't own it), render Next.js notFound().</item>
    </phase>

    <phase title="Routes">
      <item>app/(app)/mis-listas/page.tsx: async Server Component, get the session user, call ListServices(supabase).getUserLists(userId) directly, pass initial data into the ListGrid feature component.</item>
      <item>app/(app)/mis-listas/[slug]/page.tsx: async Server Component with `params: Promise<{ slug: string }>` — await params, call getListBySlug(userId, slug), notFound() if null, otherwise render ListDetail with initial data.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">A user can create a list (name + optional description) via the Dialog on /mis-listas, see it appear in the grid with 0 items, rename it via the same Dialog in edit mode (name changes, slug does not), and delete it via a confirmed AlertDialog, after which it no longer appears in the grid and a direct GET to its old /mis-listas/[slug] returns notFound(). Verify: UI flow plus a SELECT on user_lists showing the row created/updated/absent.</criterion>
    <criterion id="AC-2">A user can add a title to a list from the list detail screen's search-and-add control, and remove it from the same screen; a user can also add/remove the same title to/from one of their lists via AddToListDialog (simulate RIK-9's trigger by rendering the component directly with a known mediaId if /titulo/[slug] isn't wired yet). Verify: list_items row appears/disappears for the correct (list_id, media_id) pair.</criterion>
    <criterion id="AC-3">Toggling the Switch on /mis-listas/[slug] to public immediately persists user_lists.is_public = true (no page reload required to see the Switch reflect the new state); toggling back to private persists is_public = false. Verify: SELECT is_public after each toggle, and confirm the RLS policy (user_lists_select) means an anon/other-user client can no longer read that row once is_public = false — this is enforced by RIK-1's existing policy, not new code, but must be demonstrated working end-to-end here.</criterion>
    <criterion id="AC-4">Dragging a title to a new position within a list's grid persists the new sort_order and the new order survives a full page reload (not just client state). Verify: drag two items, reload the page, confirm the rendered order matches, and SELECT list_items ORDER BY sort_order for that list_id matches the displayed order.</criterion>
    <criterion id="AC-5">A second user account cannot see or edit the first user's private list: navigating to the first user's /mis-listas/[slug] as the second user returns notFound() (not a 403 page, not the other user's data), and the second account's /mis-listas grid never shows the first account's lists. Verify with two real accounts (or two Supabase sessions) end-to-end.</criterion>
    <criterion id="AC-6">Deleting a list removes its list_items rows without orphaning them (ON DELETE CASCADE). Verify: SELECT count(*) from list_items where list_id = &lt;deleted id&gt; returns 0 after deletion.</criterion>
    <criterion id="AC-7">getPublicListUrl(list) exists in lib/lists/getPublicListUrl.ts, is called by the Copy Link button, and this ticket introduces no public short-code column, table, or route — grep the diff for any new column/table named anything like public_code/share_code/short_code and confirm there is none.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a new Supabase migration — user_lists and list_items already exist from RIK-1. If the real migration's columns differ from this prompt's ground_truth_db_notes, stop and reconcile against the actual file before writing queries; do not silently invent columns.</item>
    <item>Do NOT rename or drop user_lists.slug, and do NOT make it globally unique — it stays the internal per-user identifier used only by /mis-listas/[slug].</item>
    <item>Do NOT implement the public short code column/table/generation logic, and do NOT add a real implementation inside getPublicListUrl — it must remain a stub returning null, per the RIK-11 boundary.</item>
    <item>Do NOT import lib/supabase/admin.ts anywhere in actions/lists or services/ListServices.</item>
    <item>Do NOT touch app/(public)/ or any (public) route group files — this ticket is entirely inside (app).</item>
    <item>Do NOT add Radix-based shadcn components — this project uses the base-lyra (Base UI) style exclusively.</item>
    <item>Do NOT add rounded corners (Lyra style mandates border-radius 0) on any new component.</item>
    <item>Do NOT build a second title-card component if components/MediaCard/ already exists from an earlier ticket — reuse it.</item>
  </constraints>

  <out_of_scope>
    <item>/l/[codigo] public list page and the public /titulo/[slug] variant — RIK-11.</item>
    <item>The globally-unique public short code mechanism itself — RIK-11's schema decision.</item>
    <item>Placing the "Agregar a lista" trigger button on /titulo/[slug] — RIK-9 owns that page; this ticket only ships the AddToListDialog component for RIK-9 to import.</item>
    <item>Editing list_items.note — the column exists and is typed but no UI is required for it.</item>
    <item>Bulk multi-select add/remove of titles.</item>
    <item>Any automated test suite — none exists in this repo yet.</item>
  </out_of_scope>

  <implementation_notes>
    <item>Slug generation suggestion: a small kebab-case slugify (lowercase, strip diacritics, replace non-alphanumerics with hyphens) plus a retry-with-suffix loop bounded to a handful of attempts, to avoid infinite loops on a pathological name.</item>
    <item>reorderListItems upsert shape: rows = orderedMediaIds.map((mediaId, index) => ({ list_id: listId, media_id: mediaId, sort_order: index })); supabase.from('list_items').upsert(rows, { onConflict: 'list_id,media_id' }) — this only works if the unique constraint name/columns match list_items_uq exactly; verify against the real migration.</item>
    <item>getListBySlug should filter by both slug and the caller's own user_id explicitly in the query (not rely on RLS alone) so that a public list belonging to someone else never renders on this owner-only route just because RLS would technically allow reading it.</item>
  </implementation_notes>

  <deliverables>
    <item>All source files listed in the requirements phases above.</item>
    <item>Run npm run lint and fix any issues introduced by this change.</item>
    <item>No test files (none exist yet in this repo) — note in the completion report where they should live once a test runner is introduced.</item>
    <item>Persist documentation per <completion_report>/<persistence> below: one bullet in CHANGELOG.md under [Unreleased], and one file in specs/logs/.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Drag-to-reorder library: defaulting to @dnd-kit/core + @dnd-kit/sortable. If the team prefers zero new dependencies, fall back to native HTML5 drag events and note the accessibility tradeoff.</item>
    <item>Slug immutability on rename: defaulting to never changing slug after creation. If the team wants renaming to also regenerate the slug, that changes the AC-1 verification and needs a redirect strategy for the old URL.</item>
    <item>Public link placeholder UX: defaulting to a disabled Button + explanatory Tooltip when getPublicListUrl returns null. If the team wants the button hidden entirely instead of disabled, adjust ListDetail accordingly — either satisfies AC-7.</item>
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
        <item>Format: `- RIK-10: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-10_user_lists_management.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Link to specs/backlog/RIK-10_user_lists_management.md in the metadata table.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: types / services / actions / components / features / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference RIK-10 in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses the sparkles emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a "## Screenshots" section (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "your lists page" instead of naming the route, "the visibility toggle" instead of naming the column, "the share link button" instead of naming the helper function.</item>
      <item>Keep it under 15 lines for the core comment (excluding Screenshots). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Include "## Screenshots" (this ticket has user-visible UI): list 3–4 items, each with a placeholder like [attach: label] — e.g. "My lists — grid with a private and a public list", "List detail — visibility switch and disabled share button", "List detail — drag-reordered grid after reload", "Cross-account check — second account cannot open the first account's private list".</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human to confirm the work works.</item>
      <item>This ticket is Mixed UI + Database — include both "## UI validation" and "## Database validation".</item>
      <item>"## Prerequisites": dev server running, two Supabase test accounts logged into two browser sessions (or one incognito), at least one existing title in the catalog to add to a list.</item>
      <item>"## UI validation": numbered steps covering create list, rename, add a title from the list detail search, add/remove the same title via the add-to-list dialog, drag-reorder and reload, toggle visibility, delete a list, and the cross-account check at /mis-listas/[slug] with the second account's session — each step states the expected visible result.</item>
      <item>"## Database validation": read-only SQL against user_lists and list_items confirming is_public, sort_order after reorder, and row absence after delete — use the real table/column names from the codebase.</item>
      <item>"## Expected outcome": 1–3 bullets tying back to the acceptance criteria.</item>
    </deliverable>
  </completion_report>
</task>
```
