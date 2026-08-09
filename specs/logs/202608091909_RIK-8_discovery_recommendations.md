# RIK-8 — Recomendaciones por descubrimiento

| Field | Value |
|---|---|
| Ticket | RIK-8 |
| Completed | 2026-08-09 19:09 (local) |
| Log file | `specs/logs/202608091909_RIK-8_discovery_recommendations.md` |
| Backlog spec | `specs/backlog/RIK-8_discovery_recommendations.md` |
| Status | completed |

## Summary

Added `/recomendaciones`: two stacked blocks — a subset of "Qué ver este mes" (watchlist titles
available now) reused from RIK-7's `RecommendationServices`, and "Descubre algo nuevo" (query 8.2:
well-rated, available, unseen titles outside the watchlist), both filterable by genre via a
`?genero=<slug>` search param. Each discovery card can be added to the watchlist or dismissed
("No me interesa") with an optimistic UI update and a confirmation toast.

## Scope delivered

- **Constants:** `constants/recommendationThresholds.ts` (rating/votes thresholds for query 8.2).
- **Services:** extended RIK-7's `RecommendationServices` — genre filter added to
  `getMonthlyWatchlist`, new `getDiscovery` (query 8.2), new `getGenres`; extended
  `MediaStatusServices` with `addToWatchlist` / `dismissRecommendation`.
- **Actions:** `actions/recommendations/getRecommendations`, `actions/recommendations/getGenres`,
  `actions/media-status/addToWatchlist`, `actions/media-status/dismissRecommendation`.
- **Features:** `features/recommendations/RecommendationsScreen.tsx`,
  `GenreFilterSelect.tsx`, `DiscoveryCard.tsx`.
- **Routes:** `app/(app)/recomendaciones/page.tsx`.

## Files changed

### Created

- `constants/recommendationThresholds.ts` — `RECOMMENDATION_THRESHOLDS` (minRating, minImdbVotes, minVotesFloor).
- `actions/recommendations/getRecommendations.ts` — session-checked read returning both blocks.
- `actions/recommendations/getGenres.ts` — public genre list for the filter Select.
- `actions/media-status/addToWatchlist.ts` — shared "add to watchlist" write path.
- `actions/media-status/dismissRecommendation.ts` — shared "no me interesa" write path.
- `features/recommendations/RecommendationsScreen.tsx` — two-block layout, client component holding optimistic discovery state.
- `features/recommendations/GenreFilterSelect.tsx` — client Select updating `?genero=` via the router.
- `features/recommendations/DiscoveryCard.tsx` — `MediaCard` + add/dismiss actions with pending state and toasts.
- `app/(app)/recomendaciones/page.tsx` — Server Component route, async `searchParams`, Suspense + skeleton.
- `specs/logs/202608091909_RIK-8_discovery_recommendations.md` — this file.

### Modified

- `services/RecommendationServices.ts` — added `RecommendationQueryParams` (`genreSlug`), genre-filter helper, `getDiscovery`, `getGenres`; `getMonthlyWatchlist` now takes an optional `params` arg (backward compatible, existing panel caller unaffected).
- `services/MediaStatusServices/index.ts` — added `addToWatchlist` and `dismissRecommendation` (upsert against `user_media_status_uq`).
- `services/index.ts` — barrel export for `RecommendationQueryParams`.
- `actions/recommendations/index.ts` — barrel exports for `getRecommendations` and `getGenres`.
- `actions/media-status/index.ts` — barrel exports for the two new actions.
- `CHANGELOG.md` — one bullet under `[Unreleased] > Added`.

### Deleted

None.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Live UI with a seeded dataset (one title each: watched, want_to_watch, dismissed, plus one eligible) on an active Netflix/BO subscription: discovery block rendered only the eligible title and one unrelated-genre eligible title; the watched/want_to_watch/dismissed titles were absent. |
| AC-2 | PASS | Seeded 6.9/10000 and 7.0/4999 titles (both excluded from discovery in the live check above) and a 7.0/5000 title ("RIK8 Disc Eligible", confirmed present). `grep -n "7\.0\|5000" services/RecommendationServices.ts` → no matches (thresholds only referenced via the constant), satisfying AC-6 simultaneously. |
| AC-3 | PASS | Selected "Drama" in the genre Select in the live UI: block (a) narrowed from 3 titles to 2 (the comedia-tagged watchlist title disappeared), block (b) narrowed from 2 titles to 1 (the comedia-tagged discovery title disappeared); URL updated to `?genero=drama`. |
| AC-4 | PASS | Clicked "No me interesa" on a discovery card — card was removed optimistically with a confirmation toast. DB check: `dismissed=true, manually_edited=true, source='manual'` for that row. Full page reload confirmed the title no longer appears in discovery. |
| AC-5 | PASS | Clicked "Agregar a watchlist" on a discovery card. DB check: `want_to_watch=true`. Full page reload confirmed the title now appears in block (a) and is absent from block (b). |
| AC-6 | PASS | `grep -n "7\.0\|5000" services/RecommendationServices.ts` returns no matches — both thresholds are only read via `RECOMMENDATION_THRESHOLDS.minRating` / `.minImdbVotes`. |

## Decisions

- **Reused RIK-7's `MonthlyPick` DTO instead of the ticket's literal `MediaItem` return type.** RIK-7 had already landed a working, tested `RecommendationServices.getMonthlyWatchlist` returning a query-shaped `MonthlyPick` (exactly the fields `MediaCard` needs) rather than the full `MediaItem` row. The ticket's own `<clarify_before_coding>` defaults to "reuse if present" for query 8.1, and duplicating a second near-identical DTO/service to satisfy the literal `MediaItem` signature would violate the ticket's own anti-duplication constraint. `getDiscovery` and `getRecommendations` follow the same `MonthlyPick` shape for consistency. All acceptance criteria (which reference database columns and behavior, not TypeScript type names) are unaffected.
- **`addToWatchlist` / `dismissRecommendation` return `Promise<void>` and throw on failure** (matching the ticket's literal signature), rather than RIK-7's `{success, error}` result-object convention used by `markWatched`. `DiscoveryCard` wraps each call in try/catch inside a `useTransition`, catching the thrown error for the toast — this keeps the two new actions' public signature exactly as specified while still supporting the required loading/toast UX.
- **Genre filter decomposed as an additional RLS-scoped query** (`applyGenreFilter`, joining `media_genres`/`genres` by slug then intersecting in memory), consistent with RIK-7's existing decomposition of the `media_availability` ↔ `user_subscriptions` join — PostgREST still can't embed either as one query, and this ticket forbids a new view/RPC to work around it.
- **`getGenres` lives on `RecommendationServices`** rather than a new dedicated service — it's only consumed by this screen's filter and genres has no other owning service yet; revisit if `/biblioteca` (which also needs a genre filter per `vistas-y-estilo-rikuna.md`) wants to share it.
- **`RecommendationsScreen` resets its optimistic discovery state on prop change via the render-time "adjusting state" pattern**, not a `useEffect`, per the project's `react-hooks/set-state-in-effect` lint rule (caught by `npm run lint`).
- **No navigation to `/titulo/[slug]`** was wired from either card — that route doesn't exist yet (RIK-9), matching this ticket's own out-of-scope note and RIK-7's identical precedent.

## Deferred / follow-ups

- Click-through from `MediaCard`/`DiscoveryCard` to `/titulo/[slug]` — deferred to RIK-9, same as the panel screen.
- No nav-shell link to `/recomendaciones` was added — no shared navigation component exists yet in the codebase (panel, suscripciones, and importar are all reached by direct URL today too); revisit when a nav shell ticket lands.
- `getGenres`'s ownership (`RecommendationServices` vs. a dedicated `GenreServices`) may want revisiting once `/biblioteca`'s genre filter is built.

## Verification

- `npm run lint` — clean, no new issues (one `react-hooks/set-state-in-effect` error was found and fixed during development).
- `npx tsc --noEmit` — clean.
- Local Supabase (`127.0.0.1:54322`) — seeded a throwaway auth user (`rik8-tester@example.com`) and 9 `media_items` covering every AC edge case (rating/votes thresholds, watched/want_to_watch/dismissed exclusions, two genres) via direct SQL; verified all 6 ACs live in the Browser pane; deleted all seeded rows and the test user afterward (DB row counts confirmed back to pre-test baseline).
- Live browser walkthrough against `npm run dev` (port 3011): both blocks render correctly, genre filter narrows both blocks, dismiss and add-to-watchlist both show a toast, update optimistically, and persist correctly across a full reload.

## Manual validation

```markdown
## Prerequisites

- Dev server running: `npm run dev` (port 3011).
- A logged-in test user with an active subscription (via `/suscripciones`) and, ideally, a few
  `media_items` / `media_availability` / `genres` rows seeded on that platform+country (local
  Supabase instance from RIK-1).

## UI validation

1. Visit `/recomendaciones`. Confirm both blocks render: "De tu lista de seguimiento, disponibles
   ahora" and "Descubre algo nuevo", the latter with a genre Select above it.
2. Select a genre in the Select. Confirm both blocks narrow to titles tagged with that genre only,
   and the URL gains `?genero=<slug>`.
3. On a card in "Descubre algo nuevo", click "No me interesa". Confirm the card disappears
   immediately (no page reload) with a confirmation toast. Reload the page and confirm it does not
   reappear.
4. On another discovery card, click "Agregar a watchlist". Confirm the card disappears from
   "Descubre algo nuevo" with a confirmation toast. Reload the page and confirm the title now
   appears in "De tu lista de seguimiento, disponibles ahora" (assuming it's available on your
   active subscription).

## Logic validation

- Call `RecommendationServices.getDiscovery(userId)` (or inspect `user_media_status` for the test
  user) directly to confirm: titles with `imdb_rating < 7.0` or `imdb_votes < 5000` are excluded;
  titles with `watched`, `want_to_watch`, or `dismissed` set to `true` are excluded; a title that is
  both `watched=true` and `want_to_watch=true` does not appear in either block.
- Call `RecommendationServices.getMonthlyWatchlist(userId)` to confirm it only returns titles with
  `want_to_watch=true`, `watched=false`, `dismissed=false`, available on an active subscription.

## Expected outcome

- Discovery never shows a watched, watchlisted, or dismissed title (AC-1).
- Discovery excludes anything below the rating/votes thresholds (AC-2).
- The genre filter narrows both blocks to matching titles only (AC-3).
- Dismissing a discovery card persists and the title stays gone after reload (AC-4).
- Adding a discovery card to the watchlist persists, and the title moves from block (b) to block
  (a) on the next load (AC-5).
```
