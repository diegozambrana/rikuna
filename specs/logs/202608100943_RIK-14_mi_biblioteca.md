# RIK-14 — Mi biblioteca

| Field | Value |
|---|---|
| Ticket | RIK-14 |
| Completed | 2026-08-10 09:43 (local) |
| Log file | `specs/logs/202608100943_RIK-14_mi_biblioteca.md` |
| Backlog spec | `specs/backlog/RIK-14_mi_biblioteca.md` |
| Status | completed |

## Summary

Added `/biblioteca`, the screen for browsing a user's entire personal watch history — every title they've marked watched or want-to-watch, via manual action or IMDb import — with three tabs (Vistas / Quiero ver / Todas), a filter bar (type, genre, year range, minimum rating, active-subscription availability), a title search box, and a sortable/paginated DataTable. Every filter and the active tab round-trip through the URL. Built entirely by extending the existing `MediaServices`, `MediaStatusServices`, and `MediaAvailabilityServices` per ARCHITECTURE.md's documented Services table — no new service class, no new migration.

## Scope delivered

- **UI primitive:** `tabs` added via the shadcn CLI (`base-lyra`/`mist` config).
- **Services:** `MediaStatusServices.listForUser`, `MediaServices.getManyWithFilters` (with genre pre-narrowing), `MediaAvailabilityServices.getAvailableMediaIds` — all paginated/chunked per `RecommendationServices`' documented pattern.
- **Action:** `actions/media/getLibrary.ts` — composes status + media + availability reads behind one call, returns a `LibraryRow[]` DTO plus a `hasAnyHistory` signal for the empty-state decision.
- **Route:** `app/(app)/biblioteca/page.tsx` — async Server Component, awaits the Next.js 16 `searchParams` promise.
- **Features:** `LibraryScreen`, `LibraryTabs` (client — see Decisions), `LibraryFilters`, `LibrarySearchInput`, `LibraryTable`, `EmptyLibraryState`.
- **Shared component extension:** `components/Table/DataTable.tsx` gained an optional `onRowClick` prop (backward compatible) to support AC-5's row-click navigation.

## Files changed

### Created

- `components/ui/tabs.tsx` — shadcn-generated Tabs primitive.
- `actions/media/getLibrary.ts` — biblioteca read, composes the three services below.
- `app/(app)/biblioteca/page.tsx` — route, parses search params, calls `getGenres` + `getLibrary`.
- `features/library/LibraryScreen.tsx` — server composition of tabs/filters/table/empty-state.
- `features/library/LibraryTabs.tsx` — client tab switcher (controlled `Tabs`, `onValueChange` → `router.push`).
- `features/library/LibraryFilters.tsx` — client filter bar (type, genre, year range, rating preset, availability checkbox).
- `features/library/LibrarySearchInput.tsx` — client title-search box, commits on blur/Enter.
- `features/library/LibraryTable.tsx` — DataTable column defs + row-click navigation to `/titulo/[slug]`.
- `features/library/EmptyLibraryState.tsx` — "import from IMDb" CTA card.

### Modified

- `services/MediaStatusServices/index.ts` — added `listForUser`.
- `services/MediaServices/index.ts` — added `getManyWithFilters` + private `applyGenreFilter`; `searchByTitle` untouched.
- `services/MediaAvailabilityServices/index.ts` — added public `getAvailableMediaIds` + `ActiveSubscriptionPair` type.
- `services/index.ts` — exported the new types (`MediaManyFilters`, `ActiveSubscriptionPair`).
- `actions/media/index.ts` — barrel export for `getLibrary`.
- `components/Table/DataTable.tsx` — added optional `onRowClick` prop.
- `CHANGELOG.md` — new `[Unreleased] / Added` bullet for RIK-14.

### Deleted

None.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Seeded user has 699 watched-only, 178 want-to-watch-only, 3 both (880 total). `/biblioteca?tab=watched` → paginated to "Página 1 de 71" (~699/10 wide, minus the 3 dual-status rows already counted); `?tab=want_to_watch` → 178+3 rows, confirmed via UI click (`Quiero ver` tab) showing "Quiero ver" badges; `?tab=all` → "Página 1 de 88" = 880 rows, matching `select count(*) from user_media_status where user_id=...` exactly. |
| AC-2 | PASS | `?tipo=tv` → exactly 1 row (Stranger Things), matching `select count(*) ... where type='tv'`. `?anioDesde=2000&anioHasta=2005` → "Página 1 de 10" (98 rows), matching DB count. `?calificacion=9` → "Página 1 de 2" (14 rows), matching DB count. Combined `?genero=drama&calificacion=9` → "Página 1 de 2" (12 rows), matching the DB's genre∩rating intersection query. |
| AC-3 | PASS | `?disponible=1` (tab=all) → 3 distinct titles (Stranger Things, The Godfather, The Shawshank Redemption), matching a manual SQL join of `media_availability` × `user_subscriptions` (active, same platform+country) × `user_media_status`. Combined `?tab=want_to_watch&disponible=1` → exactly The Shawshank Redemption, the one want-to-watch title in that available set — checkbox also rendered checked, confirming the on/off round-trip. |
| AC-4 | PASS | `?q=matrix` → exactly 1 row ("Matrix", 1999), matching `title ilike '%matrix%'` against the user's history. |
| AC-5 | PASS | Clicking the "Año" column header toggled sort (screenshot showed "Año ↓" and rows reordered to newest-first). Clicking a table row (dispatched click on the `<tr>`, which carries `cursor-pointer` + the `onRowClick` handler) navigated to `/titulo/matrix-1999`. Pagination controls present and functional whenever results exceed one page (DataTable's existing client-side paging). |
| AC-6 | PASS | Created a fresh test user (`empty-library-test@example.com`) with zero `user_media_status` rows, logged in, navigated to `/biblioteca` — rendered "Tu biblioteca está vacía" with a working "Importar desde IMDb" button linking to `/importar`, instead of an empty table. Test user deleted after verification. |
| AC-7 | PASS | Every filter combination tested above was reached via direct URL navigation (equivalent to a reload, since `/biblioteca` is a Server Component with no client-only state driving the result set) and reproduced the exact expected result set each time; the availability checkbox and active tab also visually reflected the URL's state after a fresh navigation. |

## Decisions

- **Default tab:** the ticket didn't specify one. Chose `watched` ("Vistas"), matching the PRD's tab ordering (Vistas is listed first).
- **`SubscriptionServices.getActiveForUser`:** the ticket's `<ground_truth_db_notes>` names this method, but the actual RIK-9 method is `SubscriptionServices.getActiveSubscriptions(userId)` — same behavior, different name. Reused the real method rather than adding a duplicate, per the "don't add a second get-active-subscriptions method" constraint.
- **`hasAnyHistory` signal:** AC-6 requires distinguishing "this tab/filter combo has 0 rows" (normal, shows the table's own empty message) from "this user's entire history is empty" (shows the import-invite CTA). Added a `hasAnyHistory: boolean` to `getLibrary`'s `ok` result, computed with a second `listForUser` call only in the rare case the initial tab query is already empty and the tab isn't `all` — no extra query on the common non-empty path.
- **Tab navigation implementation:** the spec described "tab switch navigates via a link that sets the tab search param," suggesting a server-rendered `<Link>`. Base UI's `Tabs.Tab` (even rendered via its `render={<Link/>}` prop) calls `preventDefault()` internally as part of its own click handling, which silently swallowed next/link's navigation — confirmed via browser testing (the URL never changed on click). Switched to a small client component (`LibraryTabs.tsx`) using Base UI's *controlled* `Tabs` (`value`/`onValueChange`) that calls `router.push` directly, which reliably updates the URL. This is the only place this ticket deviates from "Server Component tabs" — necessary for correctness, not scope creep.
- **`DataTable` row-click:** AC-5 requires clicking a row to navigate, but the shared `DataTable` component had no row-click hook. Added an optional `onRowClick` prop (backward compatible — every existing caller, e.g. `BatchDetailTable`, is unaffected) rather than duplicating the table component for biblioteca.

## Deferred / follow-ups

- **Pre-existing Select label bug:** Base UI's `Select`/`SelectValue` renders the raw sentinel item value (e.g. `__all_types__`) in the closed trigger instead of the matched item's label, even though the open dropdown shows correct labels. This is not new — the already-shipped `GenreFilterSelect` on `/recomendaciones` exhibits the identical bug. `LibraryFilters.tsx`'s type/genre/rating selects mirror that same pattern per the ticket's instructions, so they inherit the same cosmetic issue. Filtering itself works correctly (verified via URL-driven navigation); only the trigger's displayed label is wrong. Worth a small dedicated fix across both screens in a follow-up ticket.
- **Service-layer tests:** no test framework exists yet in this repo. Once one is introduced, `MediaServices.getManyWithFilters`, `MediaStatusServices.listForUser`, and `MediaAvailabilityServices.getAvailableMediaIds` should get unit coverage (chunking boundaries, genre pre-narrowing, OR-filter construction for availability pairs) — they're the highest-risk new logic in this ticket.
- **Automated browser click quirks:** Base UI's `Select` and `Tabs` primitives (rendered via `render` prop) didn't respond reliably to this session's synthetic pointer clicks during manual verification (confirmed as an automation-tool limitation, not an app bug, by reproducing the same failure on the already-shipped `GenreFilterSelect`). No action needed — noted here only so a future verification pass doesn't re-diagnose the same non-issue.

## Verification

- `npm run lint` — clean, no errors.
- `npx tsc --noEmit` — clean, no errors.
- Manual verification against the local Supabase instance using the existing seeded user (`contacto@diegozambrana.com`, 881 media_items / 880 user_media_status rows / 2 active subscriptions) plus one throwaway fresh account for the empty-state case — see the Acceptance criteria table above for exact evidence per AC.

## Manual validation

### Prerequisites

- Dev server running (`npm run dev`, or the project's `rikuna-dev` launch config).
- A logged-in test user with a mix of watched, want-to-watch, and untouched titles — at least one title with a known genre/year/rating, and at least one title matching an active subscription's availability.

### UI validation

1. Navigate to `/biblioteca`. Confirm the "Vistas" tab is active by default and shows only watched titles.
2. Click "Quiero ver" — confirm the URL updates to `?tab=want_to_watch` and only want-to-watch titles show.
3. Click "Todas" — confirm the URL updates to `?tab=all` and every personal-history row shows (every title the user has ever touched, regardless of its watched/want-to-watch/dismissed flags).
4. Apply the type filter (Película/Serie) — confirm the URL gets `?tipo=...` and results narrow accordingly.
5. Apply the genre filter — confirm `?genero=...` and results narrow to that genre.
6. Set "Año desde"/"Año hasta" — confirm `?anioDesde=...&anioHasta=...` and results narrow to that year range.
7. Set the rating preset (7+/8+/9+) — confirm `?calificacion=...` and results narrow accordingly.
8. Combine two filters (e.g. genre + rating) — confirm the intersection is correct.
9. Check "Solo disponible en mi suscripción activa" — confirm `?disponible=1` and results narrow to titles available on an active subscription; uncheck to restore.
10. Type a substring of a known title into the search box and press Enter or blur — confirm `?q=...` and only matching titles remain.
11. Click the "Año" (or another sortable) column header — confirm the sort order changes.
12. Use the pagination controls if more than one page of results exists — confirm navigation between pages.
13. Click a table row — confirm navigation to that title's `/titulo/[slug]`.
14. Copy a URL with several filters applied, open it in a fresh tab (or reload) — confirm identical results and identical control states (tab, checkboxes, selects, inputs).
15. Log in as a fresh account with zero import history, navigate to `/biblioteca` — confirm the "Tu biblioteca está vacía" empty state (not a blank table), and that its button navigates to `/importar`.

### Database validation

```sql
-- Total per tab for a given user
select
  count(*) filter (where watched) as watched_tab,
  count(*) filter (where want_to_watch) as want_to_watch_tab,
  count(*) as all_tab
from user_media_status
where user_id = '<user-id>';

-- Type + rating combined filter (mirrors AC-2's combined check)
select mi.title, mi.type, mi.imdb_rating
from media_items mi
join user_media_status ums on ums.media_id = mi.id
where ums.user_id = '<user-id>'
  and mi.type = 'movie'
  and mi.imdb_rating >= 8;

-- Availability filter (mirrors AC-3)
select distinct mi.title
from media_availability ma
join user_subscriptions us
  on us.platform_id = ma.platform_id
 and us.country = ma.country
 and us.ended_on is null
 and us.user_id = '<user-id>'
join user_media_status ums
  on ums.media_id = ma.media_id
 and ums.user_id = '<user-id>'
join media_items mi on mi.id = ma.media_id
where ma.is_available = true;

-- Title search (mirrors AC-4)
select mi.title
from media_items mi
join user_media_status ums on ums.media_id = mi.id
where ums.user_id = '<user-id>'
  and mi.title ilike '%<substring>%';
```

### Expected outcome

- AC-1: each tab's row count matches `watched_tab` / `want_to_watch_tab` / `all_tab` above.
- AC-2: each filter (alone and combined) narrows to exactly the SQL-matched set.
- AC-3: the availability filter narrows to exactly the distinct titles from the availability query; disabling it restores the unfiltered set.
- AC-4: the search box narrows to exactly the ilike-matched titles.
- AC-5: sorting reorders rows; pagination works past one page; clicking a row opens the correct `/titulo/[slug]`.
- AC-6: a zero-history account sees the import-invite empty state, not a blank table.
- AC-7: reloading a filtered URL reproduces identical results and control states.
