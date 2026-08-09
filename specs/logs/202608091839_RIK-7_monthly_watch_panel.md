# RIK-7 — Panel principal (Qué ver este mes)

| Field | Value |
|---|---|
| Ticket | RIK-7 |
| Completed | 2026-08-09 18:39 (local) |
| Log file | `specs/logs/202608091839_RIK-7_monthly_watch_panel.md` |
| Backlog spec | `specs/backlog/RIK-7_monthly_watch_panel.md` |
| Status | completed |

## Summary

Replaced the `/panel` placeholder (RIK-2) with the real "Qué ver este mes" screen: a header
showing one badge per active subscription plus a live counter, and a poster grid of watchlist
titles that are currently available on a subscribed platform+country and not yet watched. Marking
a title watched removes it from the grid instantly (optimistic UI) and persists through a shared
server action that RIK-9's title detail screen will reuse.

## Scope delivered

- **Services:** `RecommendationServices.getMonthlyWatchlist` (Section 8.1 logic), `SubscriptionServices.getActiveSubscriptionsWithPlatform` (new method, existing file), new `MediaStatusServices.markWatched`.
- **Actions:** `actions/recommendations/getMonthlyWatchlist`, `actions/media-status/markWatched` (shared write path), `actions/subscriptions/getActiveSubscriptionsWithPlatformAction`.
- **Components:** `components/MediaCard` (shared, generic), `components/ui/skeleton.tsx` + `components/ui/aspect-ratio.tsx` (added via shadcn CLI, base-lyra style, zero border-radius confirmed).
- **Features:** `features/panel/PanelHeader.tsx`, `features/panel/PanelGrid.tsx` (client, optimistic state), `features/panel/EmptySubscriptionState.tsx`.
- **Routes:** `app/(app)/panel/page.tsx` rewritten as a Server Component with a Suspense-wrapped grid fetch and a Skeleton fallback.
- **Verification:** transactional SQL seed against local Supabase (rolled back, no persisted data) to confirm index usage at volume; live UI walkthrough with a throwaway auth user (deleted after).

## Files changed

### Created

- `services/RecommendationServices.ts` — Section 8.1 query, decomposed into RLS-scoped, index-backed queries (see Decisions).
- `services/MediaStatusServices/index.ts` — did not exist yet despite being named in ARCHITECTURE.md; owns the single `markWatched` write.
- `actions/recommendations/getMonthlyWatchlist.ts`, `actions/recommendations/index.ts` — session-checked wrapper around the service.
- `actions/media-status/markWatched.ts`, `actions/media-status/types.ts`, `actions/media-status/index.ts` — shared mark-watched action (AC-6).
- `actions/subscriptions/getActiveSubscriptionsWithPlatformAction.ts` — panel-specific active-subscriptions read (platform name embedded, sorted by started_on desc); RIK-6's original action is untouched.
- `components/MediaCard/index.tsx` — shared poster card (AspectRatio-reserved space, is_stub-aware, optional mark-watched slot).
- `components/ui/skeleton.tsx`, `components/ui/aspect-ratio.tsx` — added via `npx shadcn@latest add skeleton aspect-ratio`.
- `features/panel/PanelHeader.tsx` — subscription badges + counter copy (pure, receives `count` as a prop).
- `features/panel/PanelGrid.tsx` — client component: local state, optimistic mark-watched, renders `PanelHeader` internally so the counter always reflects the same array the grid renders from.
- `features/panel/EmptySubscriptionState.tsx` — zero-subscription empty state with a link to `/suscripciones`.
- `specs/logs/202608091839_RIK-7_monthly_watch_panel.md` — this file.

### Modified

- `app/(app)/panel/page.tsx` — placeholder replaced with the real screen (Server Component, Suspense + Skeleton fallback, EmptySubscriptionState branch).
- `services/SubscriptionServices/index.ts` — added `getActiveSubscriptionsWithPlatform` (new method; `getActiveSubscriptions` untouched, still used by `/suscripciones`).
- `services/index.ts` — barrel exports for `RecommendationServices`, `MediaStatusServices`, `ActiveSubscriptionWithPlatform`.
- `actions/subscriptions/index.ts` — barrel export for the new action.
- `CHANGELOG.md` — one bullet under `[Unreleased] > Added`.

### Deleted

None.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Live UI run with a mixed dataset (available+watchlist, watched, dismissed, wrong-platform, no-availability, stub) via a throwaway auth user: only the 3 true-positive titles rendered ("Panel Test Movie One", "Two", "Six (stub)"); watched/dismissed/wrong-platform titles correctly excluded. Cross-checked at volume: a SQL cross-check comparing the decomposed service queries against the literal Section 8.1 single-query join returned identical row counts (1500 vs 1500) over ~157k `user_media_status` / ~81k `media_availability` rows. |
| AC-2 | PASS | Live UI: counter read "3 títulos de tu lista disponibles ahora" with 3 cards rendered; after marking one watched, counter updated to "2 títulos..." with exactly 2 cards, no separate count source (`PanelGrid` derives both from the same `picks` state array). |
| AC-3 | PASS | Live UI: clicking the check button removed the card immediately (optimistic, no navigation — URL unchanged, no full remount). DB confirmed after the click: `watched=true`, `watched_at` set, `manually_edited=true`, `source='manual'` for that row. |
| AC-4 | PASS | Live UI: with the test user's only subscription ended (`ended_on` set), `/panel` rendered `EmptySubscriptionState` ("Sin suscripción activa") with a working button linking to `/suscripciones` (verified via click — landed on `/suscripciones` and rendered RIK-6's screen). `getMonthlyWatchlist` is only called from inside the branch that requires `subscriptions.length > 0` (see `app/(app)/panel/page.tsx`), so it never runs in this state. |
| AC-5 | PASS | Seeded (in a rolled-back transaction) ~157k `user_media_status` rows and ~81k `media_availability` rows across many users/platforms so the target user+platform slice was a small fraction of each table. `EXPLAIN ANALYZE` confirmed `Bitmap Index Scan on ums_user_want_idx` for the want-to-watch query and `Bitmap Index Scan on media_availability_lookup_idx` for the availability query — no sequential scans, sub-millisecond execution. The Suspense boundary + Skeleton fallback is wired in `app/(app)/panel/page.tsx` around the async `PanelGridSection`. |
| AC-6 | PASS | Verified by inspection: the only `user_media_status` "mark watched" write lives in `services/MediaStatusServices/index.ts`, called exclusively from `actions/media-status/markWatched.ts`. `ImdbImportServices.upsertUserMediaStatus` (RIK-4) is a distinct upsert path for CSV import and does not overlap. |

## Decisions

- **PostgREST can't express the `media_availability` ↔ `user_subscriptions` join** (matched on `platform_id`+`country`, not a foreign key) as a single embedded `select`, and this ticket forbids a new migration/RPC/view to work around it. `RecommendationServices.getMonthlyWatchlist` decomposes Section 8.1 into three RLS-scoped, index-backed queries (want-to-watch candidates → availability intersection → media_items fetch) instead. A SQL cross-check against the literal single-query join confirmed identical row sets at volume (see AC-1 evidence).
- **PostgREST's local `max_rows` is 1000** and `.in()` filters degrade past a few hundred UUIDs on a GET request. Added a small `paginate()` helper (loops on `.range()`) and chunked `.in()` calls (200 ids/batch) inside `RecommendationServices` so correctness holds at the "several thousand rows" volume AC-5 requires, not just at small scale.
- **Service method signature** follows the codebase's existing constructor-DI convention (`new Service(client)`, methods take only business params) rather than the ticket's informally "suggested" `getMonthlyWatchlist(supabase, userId)` two-arg shape, for consistency with `SubscriptionServices`, `MediaAvailabilityServices`, and `ImdbImportServices`.
- **`SubscriptionServices.getActiveSubscriptions` was left untouched**; added `getActiveSubscriptionsWithPlatform` as a new method (embeds `platforms.name`, sorted `started_on desc`) so `/suscripciones` (RIK-6) is unaffected and the panel gets exactly the shape its header needs.
- **PanelHeader is a pure component** (`subscriptions`, `count` props) rendered *inside* `PanelGrid` (the client component holding local state), not as a separate sibling fetched by the server — this is how the counter mechanically stays derived from the same array the grid renders (AC-2), without inventing a fourth shared-state file beyond the three named in the ticket.
- **Base UI's `Button` needed `nativeButton={false}`** when composed with `render={<Link .../>}` in `EmptySubscriptionState` — caught via a live console-error check during manual verification (Base UI logs a runtime warning, not a build-time error, when a `render` target isn't a real `<button>` and `nativeButton` is left at its default `true`).
- **No new migration** — all columns/indexes referenced matched the RIK-1 migrations as documented in the ticket's `ground_truth_db_notes`; nothing to report as a blocked dependency.

## Deferred / follow-ups

- Click-through from a `MediaCard` to `/titulo/[slug]` was deliberately left out of `MediaCard` itself — that route doesn't exist yet (RIK-9). `MediaCard` stays a static display component today; whichever feature wires up detail navigation can wrap it in a `Link` without touching the shared component.
- No pagination was added to the panel grid — AC-5's volume verification showed sub-millisecond, index-backed queries at ~157k/~81k background rows, so an unbounded query was not shown to be a problem. Revisit only if real production volume proves otherwise.

## Verification

- `npm run lint` — clean, no new issues.
- `npx tsc --noEmit` — clean.
- Local Supabase (Docker, `127.0.0.1:54322`) — transactional SQL seed + `EXPLAIN ANALYZE` for AC-5 (rolled back, no data persisted); a separate throwaway auth user + dataset for the live UI walkthrough (deleted after, DB confirmed back to its pre-session row counts).
- Live browser walkthrough (Browser pane) against `npm run dev` on port 3011: login, panel with matching/excluded titles, mark-watched optimistic removal + DB confirmation, empty-state with working link to `/suscripciones`, mobile viewport (375×812) sanity check on the login/empty-state path.

## Manual validation

```markdown
## Prerequisites

- Dev server running: `npm run dev` (port 3011).
- A logged-in test user.
- For the positive-path steps: an active subscription for that user (via `/suscripciones`) and at least one title in their watchlist that is available on that subscription's platform+country.

## UI validation

1. Log in and visit `/panel`. Confirm the header shows one badge per active subscription (platform name + country) and a counter reading "N título(s) de tu lista disponible(s) ahora", matching the number of poster cards shown.
2. Click the check button on any card. Confirm the card disappears immediately (no page reload) and the counter updates to match the new card count.
3. In `/suscripciones`, end your only active subscription (or use a fresh account with none). Revisit `/panel` and confirm it shows the empty state ("Sin suscripción activa") with a button that takes you to `/suscripciones`, and no poster grid or counter renders.

## Database validation

```sql
-- Replace :user_id and :media_id with the row you marked watched in step 2.
select watched, watched_at, manually_edited, source
from user_media_status
where user_id = :user_id and media_id = :media_id;
-- Expect: watched = true, watched_at is not null, manually_edited = true, source = 'manual'.
```

## Expected outcome

- Only watchlist titles that are unwatched, not dismissed, and available on an active subscription appear in the panel (AC-1).
- Marking a title watched updates the UI and the database consistently, without a full page reload (AC-2, AC-3).
- Zero active subscriptions shows a clear empty state instead of an empty or broken grid (AC-4).
```
