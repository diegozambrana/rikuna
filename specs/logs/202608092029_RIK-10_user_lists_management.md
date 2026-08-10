# RIK-10 — Mis listas: owner-side list management

| Field | Value |
|---|---|
| Ticket | RIK-10 |
| Completed | 2026-08-09 20:29 (local) |
| Log file | `specs/logs/202608092029_RIK-10_user_lists_management.md` |
| Backlog spec | `specs/backlog/RIK-10_user_lists_management.md` |
| Status | completed |

## Summary

Delivered full owner-side CRUD for `user_lists`/`list_items`: creating, renaming, and deleting lists; adding and removing titles from a list (both from the list detail screen and from a reusable `AddToListDialog`); drag-to-reorder with `@dnd-kit`; and a public/private visibility toggle with a share-link button that's stubbed out pending RIK-11's short-code mechanism. Everything is scoped through Postgres RLS (owner-only writes, mixed public/private reads), with no new migration, no service-role usage, and no public short-code column added.

## Scope delivered

- **Types**: `UserList`, `ListItem` in `types/index.ts`.
- **Services**: `ListServices` (create/rename/delete/add/remove/reorder/visibility/list reads, including the item-count and contains-media projections); added `MediaServices.searchByTitle` for the list-detail search-and-add control (no prior catalog search method existed to reuse).
- **Actions**: `actions/lists/*` — one Server Action per mutation, each re-verifying the session and calling the matching service on the session-bound client; `revalidatePath` on `/mis-listas` and the affected `/mis-listas/[slug]`.
- **Shared helper**: `lib/lists/getPublicListUrl.ts` — stub, always returns `null`, TODO referencing RIK-11.
- **shadcn primitives**: `dialog`, `switch`, `tooltip`, `alert-dialog`, `checkbox` added in the `base-lyra` style; wrapped the app in `TooltipProvider`.
- **Components**: `components/Dialog/AddToListDialog.tsx` — self-contained trigger + Dialog, checkbox per owned list, toggling calls the add/remove actions.
- **Features**: `features/lists/ListGrid.tsx`, `CreateListDialog.tsx` (create + rename), `ListDetail.tsx`, `SortableListItemCard.tsx`, `TitleSearchAndAdd.tsx`.
- **Routes**: `app/(app)/mis-listas/page.tsx`, `app/(app)/mis-listas/[slug]/page.tsx` (awaits the `params` Promise per this Next.js version).

## Files changed

### Created

- `types/index.ts` (edit, see Modified) — `UserList`/`ListItem` types.
- `services/ListServices/index.ts` — CRUD + read-shape service for lists/items.
- `lib/lists/getPublicListUrl.ts` — RIK-11 stub.
- `actions/lists/{types,createList,renameList,deleteList,addListItem,removeListItem,reorderListItems,setListVisibility,getListsContainingMedia,index}.ts` — Server Actions.
- `actions/media/searchTitles.ts` — catalog search Server Function for the add-title control.
- `components/ui/{dialog,switch,tooltip,alert-dialog,checkbox}.tsx` — shadcn base-lyra primitives.
- `components/Dialog/AddToListDialog.tsx` — shared add-to-list dialog for RIK-9 to import.
- `features/lists/{ListGrid,CreateListDialog,ListDetail,SortableListItemCard,TitleSearchAndAdd}.tsx`.
- `app/(app)/mis-listas/page.tsx`, `app/(app)/mis-listas/[slug]/page.tsx`.

### Modified

- `types/index.ts` — added `UserList`, `ListItem`.
- `services/MediaServices/index.ts` — added `searchByTitle` + `MediaSearchResult`.
- `services/index.ts` — exported `ListServices` and its read-shape types; exported `MediaSearchResult`.
- `actions/media/index.ts` — exported `searchTitles`.
- `app/layout.tsx` — wrapped the app in `TooltipProvider` (required by the new `tooltip` primitive).
- `package.json` / `package-lock.json` — added `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

### Deleted

None.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Live in browser (local Supabase, throwaway account): created "Clásicos de fin de semana" via the Dialog — appeared in the grid instantly with 0 títulos and a "Privada" badge, confirmed by `select * from user_lists` (row present, correct slug/description). Renamed to "Clásicos renombrados" via the same Dialog in edit mode — header updated without a manual reload, `select name, slug from user_lists` showed the name changed and the slug unchanged (`clasicos-de-fin-de-semana`). Deleted via the AlertDialog — redirected to `/mis-listas` with an empty grid, and a direct `GET /mis-listas/clasicos-de-fin-de-semana` returned the Next.js 404 page. |
| AC-2 | PASS | Added "The Godfather", "Friends", "Stranger Things" via the list-detail search-and-add control — each produced a `list_items` row for the correct `(list_id, media_id)` pair (verified by SQL join to `media_items`). Removed "Friends" via the card's "Quitar" button — row disappeared from `list_items`. Separately verified `AddToListDialog` end-to-end by temporarily mounting it in `ListDetail` with a known `mediaId` (The Shawshank Redemption) — checking the box inserted the `list_items` row, unchecking it deleted the row (both confirmed by SQL); the temporary mount was removed before finishing, `ListDetail.tsx` ships without it. |
| AC-3 | PASS | Toggled the Switch to public — label flipped to "Pública" instantly (no reload); `select is_public from user_lists` showed `true`; an anon REST call (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) against `user_lists?slug=eq....` returned the row. Toggled back to private — label flipped instantly, `is_public` was `false` in SQL, and the same anon REST call returned `[]` — RIK-1's `user_lists_select` policy demonstrated working end-to-end through this UI. |
| AC-4 | PASS | Dragged "Stranger Things" (3rd) to 1st position (verified via a scripted native `PointerEvent` sequence, since the automation harness's synthetic clicks don't satisfy dnd-kit's `PointerSensor`/`KeyboardSensor` activation — this is a test-tooling limitation, not an app issue). Grid re-rendered in the new order; `select title, sort_order from list_items order by sort_order` matched. Reloaded `/mis-listas/[slug]` — the same order rendered from the server, confirming persistence survives a fresh page load, not just client state. |
| AC-5 | PASS | Two real Supabase Auth accounts. Seeded a private list owned by account A. Logged in as account B (cookies cleared, fresh sign-in) — `/mis-listas` grid was empty (no trace of A's list), and `GET /mis-listas/lista-privada-de-a` returned the Next.js notFound page (not a 403, not A's data) — matches `getListBySlug`'s explicit `user_id` filter, not just RLS. |
| AC-6 | PASS | Before deleting "Clásicos renombrados" it held 2 `list_items` rows; after the AlertDialog-confirmed delete, `select count(*) from list_items` was `0` and `select count(*) from user_lists` was `0` — `ON DELETE CASCADE` confirmed, no orphaned rows, no explicit cleanup code needed. |
| AC-7 | PASS | `lib/lists/getPublicListUrl.ts` exists, is called from `ListDetail`'s "Copiar enlace" button (disabled + tooltip "Disponible próximamente" while it returns `null`). Grepped the full diff for `public_code`, `share_code`, `short_code` (and variants) — no matches; no new column, table, or route was introduced for public sharing. |

## Decisions

- **Drag library**: used `@dnd-kit/core` + `@dnd-kit/sortable` as the ticket's default, since no equivalent was already in `package.json`.
- **Slug immutability on rename**: kept the default — slug never changes after creation; rename only updates `name`/`description`. The list's current slug travels as a hidden form field so the rename action knows which detail path to revalidate.
- **Public link placeholder UX**: kept the default — a disabled `Button` + explanatory `Tooltip` ("Disponible próximamente"), rather than hiding the button.
- **No catalog search method existed to reuse** (the spec assumed one from RIK-3/RIK-9): added `MediaServices.searchByTitle` — a small `ilike` search capped at 10 results, ordered by rating. `/biblioteca` (which will need its own, richer search/filter UI) isn't built yet.
- **Reads via Server Actions for client components, not Server Components**: `getListsContainingMediaAction` and `searchTitles` are `"use server"` functions even though they're pure reads, because they're called from client components (`AddToListDialog`, `TitleSearchAndAdd`) which have no other way to reach a service — Server Component reads (the `/mis-listas` and `/mis-listas/[slug]` pages) call `ListServices` directly per the ticket's explicit instruction.
- **Client-side data flow**: `ListDetail` manages its item list and visibility flag as local optimistic state (mirroring the existing `PanelGrid`/`DiscoveryCard` pattern in this codebase) rather than relying on Next.js's automatic post-action route refresh; `CreateListDialog` explicitly calls `router.refresh()` on success since it has no local list state to update itself (it's reused on both the grid and the detail header).
- **`react-hooks/set-state-in-effect` lint rule**: this project's ESLint config flags any synchronous `setState` at the top level of a `useEffect` body (not inside a `.then`/`.catch`/timer callback). Fixed by (a) deriving `AddToListDialog`'s loading state from `lists === null` instead of a separate flag, (b) replacing `CreateListDialog`'s `useActionState` + effect-that-closes-the-dialog with a manual `startTransition` submit handler (so "close on success" happens in the event handler, not an effect), and (c) moving `TitleSearchAndAdd`'s "too short, clear results" branch into a render-time computed value instead of a synchronous effect `setState`.
- **`DndContext` needs an explicit `id`**: without one, dnd-kit's internal id generator produced a server/client hydration mismatch on the `aria-describedby` attribute of the drag handle (visible in the dev console, cosmetic only, but a real hydration warning). Fixed with `id={`list-items-${list.id}`}` on the `DndContext`.
- **Client-component barrel import trap**: `actions/media/index.ts` re-exports `getTitleDetail` (a Server-Component-only helper, no `"use server"` directive, imports `lib/supabase/server.ts`). Importing `searchTitles` from that barrel inside `TitleSearchAndAdd.tsx` (a client component) pulled the whole barrel — including `getTitleDetail` and, transitively, `server-only`-guarded services — into the client bundle and broke the build. Fixed by importing `searchTitles` from its own file (`@/actions/media/searchTitles`) instead of the barrel. Worth flagging for RIK-9 or a follow-up: any future client component that needs a Server Function from `actions/media` should do the same, or the barrel should be split into read-only (Server-Component-only) vs. Server Function exports.

## Deferred / follow-ups

- **`getPublicListUrl` real implementation** — RIK-11 (short public code column/table + route).
- **"Agregar a lista" trigger button on `/titulo/[slug]`** — RIK-9's scope; `AddToListDialog` is ready to be imported and given a trigger.
- **Richer catalog search** (filters, pagination) for `/biblioteca` — out of scope here; `MediaServices.searchByTitle` is intentionally minimal.
- **`list_items.note` editing UI** — column exists, typed, no UI required per this ticket.
- **Bulk multi-select add/remove** — out of scope.
- **Test runner** — none exists in this repo yet; once one is introduced, list service/action tests should live under a `services/ListServices/__tests__/` or equivalent convention matching whatever pattern is chosen project-wide.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (0 errors after fixing 3 `react-hooks/set-state-in-effect` violations).
- Manual end-to-end verification against local Supabase (`supabase start`) using two throwaway auth accounts (`rik10-tester-a@example.com`, `rik10-tester-b@example.com`) and the pre-existing 4-row local catalog (`The Godfather`, `Friends`, `Stranger Things`, `The Shawshank Redemption`) in the Browser pane — see the AC table above for the full walk-through. Both throwaway accounts and all seeded/created rows were deleted afterward; local `user_lists`/`list_items` are back to 0 rows and `media_items` is back to its pre-test 4 rows.

## Manual validation

See the `manual_validation` deliverable below (identical content, included in the PR/ticket write-up).

### Prerequisites

- Dev server running (`npm run dev`).
- Two Supabase accounts, logged into two separate browser sessions (or one incognito window).
- At least one existing title in the catalog to add to a list.

### UI validation

1. Go to `/mis-listas` as account A. Expect an empty state with a "Nueva lista" button.
2. Click "Nueva lista", fill in a name (and optional description), submit. Expect the dialog to close and the new list to appear in the grid immediately, with a "Privada" badge and "0 títulos".
3. Click the pencil icon on the card, change the name, save. Expect the card's name to update immediately; the URL/slug should not change.
4. Open the list. Use the search box to find a title and click "Agregar". Expect the title's poster card to appear in the grid immediately.
5. Render `AddToListDialog` for that same title's `mediaId` (or wait for RIK-9's trigger once wired) — check the box for this list; expect a success toast and the title to already show checked. Uncheck it; expect the title to disappear from the list.
6. Add at least two titles, then drag one poster card to a different position. Expect the grid to reorder immediately. Reload the page — expect the same order to still be shown.
7. Toggle the "Pública"/"Privada" switch. Expect the label to flip immediately, no reload needed.
8. Click "Eliminar", confirm in the alert dialog. Expect a redirect to `/mis-listas` with the list no longer in the grid.
9. As account B, go to `/mis-listas` — expect to never see any of account A's lists. Navigate directly to one of account A's list URLs (e.g. `/mis-listas/<a-slug>`) — expect a 404 "not found" page, not an error page and not account A's data.

### Database validation

```sql
-- Visibility toggle persisted
select id, name, is_public from user_lists where slug = '<slug>';

-- Item order after a drag-reorder
select li.sort_order, mi.title
from list_items li
join media_items mi on mi.id = li.media_id
where li.list_id = '<list-id>'
order by li.sort_order;

-- Row absence after delete
select count(*) from list_items where list_id = '<deleted-list-id>';
select count(*) from user_lists where id = '<deleted-list-id>';
```

### Expected outcome

- A signed-in user can fully manage their own lists (create, rename, delete, add/remove titles, reorder, toggle visibility) without ever touching another user's data.
- Deleting a list leaves no orphaned `list_items` rows.
- The public link button exists and is intentionally inert until RIK-11 ships the real short-code mechanism.
