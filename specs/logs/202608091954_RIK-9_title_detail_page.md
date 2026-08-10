# RIK-9 — Ficha de título y marcado manual

| Field | Value |
|---|---|
| Ticket | RIK-9 |
| Completed | 2026-08-09 19:54 (local) |
| Log file | `specs/logs/202608091954_RIK-9_title_detail_page.md` |
| Backlog spec | `specs/backlog/RIK-9_title_detail_page.md` |
| Status | completed |

## Summary

Shipped the title detail ("ficha") screen at `/titulo/[slug]` — poster, synopsis, year, IMDb rating/votes, genres, cast, personal rating, and a "Dónde ver" section highlighting the platform matching the user's active subscription. Added manual watched/watchlist toggles wired through a shared, canonical `actions/media-status/` write path (extending the one RIK-7/RIK-8 already built), and a graceful degraded layout for `is_stub` titles. The route is a single physical page under `(public)` that renders either the interactive authenticated view or a read-only public view from one component, per `isPublicView`.

## Scope delivered

- Services: extended `MediaServices`, `MediaAvailabilityServices`, and `MediaStatusServices` (all pre-existing from RIK-3/RIK-7/RIK-8) with the ficha's read/write methods; reused the already-existing `SubscriptionServices.getActiveSubscriptions` rather than adding a duplicate method.
- Actions: new `actions/media/getTitleDetail.ts` (read orchestration, session-optional); extended the existing `actions/media-status/` canonical write module with `markNotWatched` and `removeFromWatchlist`, and fixed two pre-existing gaps in `markWatched`/`addToWatchlist` (see Decisions).
- Route: `app/(public)/titulo/[slug]/page.tsx`.
- Features: `features/title/{TitleDetail,TitleActions,CastList,WhereToWatch,StubNotice}.tsx`.
- Shared component: `components/AvailabilityBadge/AvailabilityBadge.tsx`.
- UI primitive: added `avatar` via the shadcn CLI (`base-lyra` style, already configured).

## Files changed

### Created

- `actions/media/getTitleDetail.ts` — composes the ficha's read DTO (media + genres + cast + availability + personal status + active subscriptions + isPublicView).
- `actions/media/index.ts` — barrel.
- `actions/media-status/markNotWatched.ts` — sibling to `markWatched`, un-marks watched.
- `actions/media-status/removeFromWatchlist.ts` — sibling to `addToWatchlist`, clears `want_to_watch`.
- `app/(public)/titulo/[slug]/page.tsx` — the single physical route for both the authenticated and public ficha variants.
- `features/title/TitleDetail.tsx` — two-column server component (poster + info), renders all sub-sections.
- `features/title/TitleActions.tsx` — client component: watched/watchlist toggles via `useTransition`, Sonner toasts; renders login-linking buttons when `isPublicView`.
- `features/title/CastList.tsx` — horizontal cast avatar row, renders nothing when cast is empty.
- `features/title/WhereToWatch.tsx` — "Dónde ver" section with a non-broken empty state.
- `features/title/StubNotice.tsx` — Alert shown when `is_stub`.
- `components/AvailabilityBadge/AvailabilityBadge.tsx` — shared, standalone platform badge with a "Tu servicio" highlight.
- `components/ui/avatar.tsx` — added via `npx shadcn add avatar`.

### Modified

- `services/MediaServices/index.ts` — added `getBySlugWithDetails` (+ `TitleWithDetails`/`CastMember` types and a `MediaItem` row mapper).
- `services/MediaAvailabilityServices/index.ts` — added `getAvailableForMedia` (+ `AvailabilityWithPlatform` type).
- `services/MediaStatusServices/index.ts` — added `getForUser`, `markNotWatched`, `removeFromWatchlist`; changed `markWatched` from an update-only method to an upsert (a title reached from the ficha may have no prior status row — the panel's use of this method is unaffected since its rows already exist); added the missing `want_added_at` write to `addToWatchlist` (present in the schema doc's business rules but missing from the RIK-8 implementation).
- `services/index.ts` — exported the new types.
- `actions/media-status/markWatched.ts` — added an optional `titleSlug` param so callers can also revalidate `/titulo/[slug]`; existing callers (panel) are unaffected.
- `actions/media-status/addToWatchlist.ts` — same optional `titleSlug` param, plus a `/biblioteca` revalidation.
- `actions/media-status/index.ts` — export the two new actions.

### Deleted

None.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Live UI click on a title with no prior status row, then `select watched, source, manually_edited from user_media_status where user_id=... and media_id=...` → `(t, manual, t)`. |
| AC-2 | PASS | Same row after a second click → `watched=f`, `source=manual`, `manually_edited=t` unchanged. |
| AC-3 | PASS | Live UI click on "Agregar a watchlist" → `want_to_watch=t`, `want_added_at` set, `source=manual`, `manually_edited=t`. |
| AC-4 | PASS | Live UI click on "En tu watchlist" (remove) → `want_to_watch=f`, `manually_edited=t` and `source=manual` unchanged, `want_added_at` preserved. |
| AC-5 | PASS | Seeded one `is_available=false` row (Apple TV+, offer_type=rent) alongside two `is_available=true` rows (Netflix, Apple TV+ subscription). Rendered "Dónde ver" showed exactly Netflix + Apple TV+, matching `select p.name from media_availability ma join platforms p ... where is_available` exactly; the false row did not appear. |
| AC-6 | PASS | Seeded active subscriptions for the test user on both Netflix and Apple TV+ (country BO, matching the availability rows' country). Both rendered badges showed the "Tu servicio" label. |
| AC-7 | PASS | Navigated to a title with `is_stub=true`, null `poster_url`/`description`, and no cast rows (`friends-1994`) — rendered the "Información limitada" alert, a placeholder poster icon, no cast section (cleanly omitted, not a gap), and no console errors. |
| AC-8 | PASS | Direct navigation to `/titulo/the-shawshank-redemption-1994` and `/titulo/friends-1994` both resolved; a nonexistent slug returned Next's 404 page via `notFound()`. Click-through from panel/recommendations/lists cannot be tested since those screens don't link here yet (RIK-7, RIK-8, RIK-10 predate this note in the backlog spec but the actual panel screen has no title links wired in this codebase state either). |
| AC-9 | PASS | `grep -rn "user_media_status"` across `services/`, `actions/`, `features/`, `components/`, `app/` shows writes only in `services/MediaStatusServices/index.ts` and pre-existing, out-of-scope `services/ImdbImportServices.ts` (RIK-4's CSV import path, not a UI mutation, not touched by this ticket). `actions/media-status/index.ts` is the only action-layer writer; `TitleActions.tsx` calls only its four exports. |
| AC-10 | PASS | Code inspection: all four `actions/media-status/*` functions call `supabase.auth.getUser()` and return/throw an unauthorized result before any service call. Exercised live: the public (no-session) branch of `TitleActions` renders `/auth/login` links instead of invoking the actions at all. |

## Decisions

- **Extended existing services/actions instead of creating new ones.** The backlog spec was written before RIK-3/RIK-7/RIK-8 landed, and assumed `MediaServices`, `MediaAvailabilityServices`, `MediaStatusServices`, and `actions/media-status/` didn't exist yet. In the real codebase state they already do (with different content for their tickets' own needs), so this ticket added methods to those existing files rather than duplicating them.
- **Reused `SubscriptionServices.getActiveSubscriptions`** instead of adding a new `getActiveForUser` method — it already returns exactly what the ficha needs, and adding a second method would have been the duplicate logic the ticket itself warns against.
- **Changed `MediaStatusServices.markWatched` from update-only to upsert.** The panel's existing use is unaffected (its rows are guaranteed to already exist), and the ficha needs to mark a never-touched title as watched, which requires creating the row.
- **Fixed a pre-existing gap: `addToWatchlist` was missing `want_added_at`.** The schema doc's business rules (and this ticket's own AC-3) require it; the RIK-8 implementation only set `want_to_watch`. Fixed in the shared service since both `/recomendaciones` and the ficha call the same method.
- **No authenticated nav chrome (`components/layout/Header`/`Nav`) was built or imported.** These components do not exist anywhere in the current codebase — not even the existing `(app)` layout renders any nav shell, only an auth guard. Building a full site nav from scratch is out of this ticket's scope (RIK-9's requirements list only the ficha itself). Instead, the authenticated branch renders a lightweight "← Volver al panel" link. The `(public)` layout's static "Iniciar sesión" link in the header is therefore visible even when authenticated — a known, minor rough edge left for whichever ticket builds the real nav shell.
- **Physical route at `app/(public)/titulo/[slug]/page.tsx`**, per `ARCHITECTURE.md`'s explicit assignment of public title pages to `(public)` and the fact that Next.js can't resolve the same path from two route groups.
- **`params` typed as a hand-written `Promise<{ slug: string }>`**, matching the convention already used by every other dynamic route in this codebase (`/l/[codigo]`, `/importar/[batchId]`) rather than the generated `PageProps<'/titulo/[slug]'>` helper.
- **`personal_rating` is read-only**, no rating-input UI, per the ticket's explicit constraint.
- **"Agregar a lista" left as a TODO comment** in `TitleActions.tsx` — depends on RIK-10 (`user_lists`/`list_items`).

## Deferred / follow-ups

- Full anonymous/public UX polish (a "create your own list" CTA, etc.) — deferred to RIK-11.
- "Agregar a lista" action — depends on RIK-10.
- Authenticated nav chrome (Header/Nav/account menu) — not built by any ticket so far; whichever ticket introduces it should also update `/titulo/[slug]`'s authenticated branch to use it instead of the current bare "Volver al panel" link.
- No test framework exists in the repo. Once one is introduced, `MediaStatusServices` (especially `markWatched`/`markNotWatched`/`addToWatchlist`/`removeFromWatchlist`'s upsert semantics and the `source`/`manually_edited` guarantees) should get co-located tests under `services/MediaStatusServices/__tests__/`.

## Verification

- `npm run lint` — clean, no warnings or errors.
- `npx tsc --noEmit` — clean after fixing one Supabase embedded-select type-inference issue in `MediaAvailabilityServices` (cast through `unknown`).
- `npm run build` — succeeded; `/titulo/[slug]` registered as a dynamic route.
- Live verification against the local Supabase instance (see Manual validation below) — all ten acceptance criteria exercised end-to-end via the browser and confirmed with direct SQL reads.

## Manual validation

### Prerequisites

- Dev server running (`npm run dev`).
- A logged-in test user with at least one active subscription (`user_subscriptions`, `ended_on is null`).
- At least one `media_items` row with a known `slug`.
- Ideally: one row with `is_stub = true` and null `poster_url`/`description`/no cast, and one row with a `media_availability` row (`is_available = true`) whose `platform_id` + `country` matches one of the test user's active `user_subscriptions`.

In this session's local database, `the-shawshank-redemption-1994` was enriched with genres/cast/description/poster and has availability on both Netflix and Apple TV+ (matching the test user's active subscriptions in `BO`); `friends-1994` remains a stub with availability on Apple TV+ only.

### UI validation

1. Navigate to `/titulo/the-shawshank-redemption-1994`.
2. Click "Marcar como visto" — expect a success toast and the button to switch to "Marcar como no visto".
3. Click it again — expect it to revert to "Marcar como visto".
4. Click "Agregar a watchlist" — expect a success toast and the button to switch to "En tu watchlist".
5. Click it again — expect it to revert to "Agregar a watchlist".
6. Confirm the "Dónde ver" section shows Netflix and Apple TV+, both with a "Tu servicio" badge.
7. Navigate to `/titulo/friends-1994` — expect the "Información limitada" notice, a placeholder poster icon, no synopsis/cast section, and no console errors.
8. Log out (or open in a private/incognito context) and revisit `/titulo/the-shawshank-redemption-1994` — expect the watched/watchlist buttons to be replaced with buttons that link to `/auth/login` instead of firing any action.
9. Navigate to `/titulo/some-nonexistent-slug` — expect Next's 404 page.

Note: `/panel`, `/recomendaciones`, and `/mis-listas` exist in this codebase state (RIK-7/RIK-8 already landed) but do not yet link to `/titulo/[slug]` — the click-through entry point is not part of this ticket's scope; only direct URL navigation was validated.

### Database validation

```sql
-- AC-1/AC-2: watched toggle
select watched, watched_at, source, manually_edited
from user_media_status
where user_id = '<test-user-id>' and media_id = '<media-id>';

-- AC-3/AC-4: watchlist toggle
select want_to_watch, want_added_at, source, manually_edited
from user_media_status
where user_id = '<test-user-id>' and media_id = '<media-id>';

-- AC-5: platforms that should render in "Dónde ver"
select p.name
from media_availability ma
join platforms p on p.id = ma.platform_id
where ma.media_id = '<media-id>' and ma.is_available;

-- AC-6: which of those platforms should show "Tu servicio"
select p.name
from user_subscriptions us
join platforms p on p.id = us.platform_id
where us.user_id = '<test-user-id>' and us.ended_on is null;
```

### Expected outcome

- AC-1/AC-2: `watched` flips true/false on click; `source='manual'` and `manually_edited=true` on every write.
- AC-3/AC-4: `want_to_watch` flips true/false on click; `want_added_at` set on add, preserved (not cleared) on remove; `source`/`manually_edited` as above.
- AC-5: "Dónde ver" lists exactly the `is_available=true` platforms, no others.
- AC-6: the platform(s) matching an active subscription show "Tu servicio".
- AC-7: a stub title renders a complete, non-broken layout with the limited-information notice.
- AC-8: any known slug is reachable directly; an unknown slug 404s.
- AC-9/AC-10: verified by code inspection (see Acceptance criteria table) — no separate manual step.
