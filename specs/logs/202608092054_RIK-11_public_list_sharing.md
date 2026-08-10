# RIK-11 — Public list sharing and public title page (no session)

| Field | Value |
|---|---|
| Ticket | RIK-11 |
| Completed | 2026-08-09 20:54 (local) |
| Log file | `specs/logs/202608092054_RIK-11_public_list_sharing.md` |
| Backlog spec | `specs/backlog/RIK-11_public_list_sharing.md` |
| Status | completed |

## Summary

Public list sharing is now real: publishing a list from `/mis-listas/[slug]` generates a globally-unique, stable share code, and `/l/[codigo]` renders that list's titles to anyone without a session. `/titulo/[slug]` was already relocated and made session-aware by RIK-9, so this ticket only had to build the DB column, the code-generation/retry logic, the public read path, and the actual `/l/[codigo]` page — RIK-9's public title branch and RIK-2's route guard needed no changes, only verification.

## Scope delivered

- **DB:** `user_lists.public_code` (nullable, partial-unique) added via a new migration.
- **Types:** `UserList.publicCode` added.
- **Services:** `ListServices.getPublicListByCode` (explicit-column public read) and `ListServices.setListVisibility` rewritten to generate-and-retry a code on first publish, keep it stable afterward, and use RLS-driven zero-row enforcement as the ownership check.
- **Lib:** `lib/lists/getPublicListUrl.ts` filled in (`generatePublicListCode`, `getPublicListUrl`).
- **Actions:** `setListVisibilityAction` now returns the list's `publicCode` so the UI has a real URL to copy.
- **Features:** `features/lists/ListDetail.tsx` wired to the real code (copy-link only enabled while currently public); new `features/lists/public/PublicListGrid.tsx` presentational component (reuses the existing `MediaCard`).
- **Routes:** `app/(public)/l/[codigo]/page.tsx` implemented for real (was a "próximamente" placeholder); `app/(public)/layout.tsx` gained a sign-up CTA alongside the existing login link.
- **Verified, unchanged:** `app/(public)/titulo/[slug]/page.tsx` (RIK-9 already placed it correctly and wired `isPublicView`), `proxy.ts` / `lib/supabase/proxy.ts` (RIK-2 already used an allowlist of protected prefixes, so `/l/*` and `/titulo/*` were already pass-through).

## Files changed

### Created

- `supabase/migrations/20260809170000_user_lists_public_code.sql` — adds `user_lists.public_code` + partial unique index.
- `features/lists/public/PublicListGrid.tsx` — read-only grid for the public list page, zero session-dependent affordances.

### Modified

- `types/index.ts` — `UserList.publicCode: string | null`.
- `services/ListServices/index.ts` — row mapping includes `public_code`; `setListVisibility` now generates/retries a code and returns `UserList`; new `getPublicListByCode` + `PublicListView` type.
- `services/index.ts` — export `PublicListView`.
- `lib/lists/getPublicListUrl.ts` — real `getPublicListUrl` + new `generatePublicListCode`.
- `actions/lists/types.ts` — `ListMutationResult` gains optional `publicCode`.
- `actions/lists/setListVisibility.ts` — returns `publicCode` from the updated list.
- `features/lists/ListDetail.tsx` — tracks `publicCode` locally, copy-link only enabled while public.
- `app/(public)/l/[codigo]/page.tsx` — real implementation (was a placeholder).
- `app/(public)/layout.tsx` — added a sign-up link next to the existing login link.

### Deleted

- None.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | `curl` with no cookies against a published list's `/l/[codigo]` returned `HTTP 200` with the list's real name/items in the body, no `Location` header. Confirmed via a full UI cycle too (sign-up → create list via SQL fixture → toggle public → copy-link enabled). |
| AC-2 | PASS | `getPublicListByCode`'s select is `id, name, description, public_code, list_items(sort_order, media_items(id, slug, title, year, poster_url, imdb_rating, is_stub))` — explicit columns, no `*`, no join beyond `list_items`/`media_items`. `app/(public)/l/[codigo]/page.tsx` calls only this one method. |
| AC-3 | PASS | Toggled the same list back to private via the real UI, then: `curl` (no cookies) against the same `/l/[codigo]` returned `HTTP 404`; a direct `set role anon; select ... from user_lists where public_code = '...'` returned `0` rows. |
| AC-4 | PASS | `curl` (no cookies) against `/titulo/the-shawshank-redemption-1994` returned `HTTP 200` with 3 links to `/auth/login` (nav + both action buttons) and no "Volver al panel" back-link — matches `isPublicView`'s redirect-to-login branch in `TitleActions.tsx`, built by RIK-9. No server action fires without a prior `getUser()` success (`TitleActions` never calls `markWatched`/`addToWatchlist` in the `isPublicView` branch). |
| AC-5 | PASS | `\d public.user_lists` shows `"user_lists_public_code_uq" UNIQUE, btree (public_code) WHERE public_code IS NOT NULL`. `generatePublicListCode` (`lib/lists/getPublicListUrl.ts`) derives the code from `crypto.randomUUID()` only — `getPublicListByCode`/`setListVisibility` never read `user_lists.slug`. |
| AC-6 | PASS | `proxy.ts` matcher runs on everything except static assets; `lib/supabase/proxy.ts`'s `PROTECTED_PREFIXES` is an allowlist (`/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`) that never included `/l` or `/titulo`, so both were already pass-through before this ticket. Confirmed live: `curl` (no cookies) to `/mis-listas` → `307` to `/auth/login`; to `/l/[codigo]` and `/titulo/[slug]` → `200`. |
| AC-7 | PASS | `getPublicListUrl(publicCode)` returned `/l/820b47780d` for the published test list and the button was disabled (shows null) while private. `features/lists/ListDetail.tsx`'s `handleCopyLink` calls `getPublicListUrl`, never builds the path inline. |

## Decisions

- **`lib/lists/getPublicListUrl.ts` over a new `lib/urls.ts`.** RIK-10 already reserved this exact file as a stub with a `TODO(RIK-11)` marker; extending it (and adding `generatePublicListCode` alongside) matches the codebase's own "extend, don't duplicate" convention instead of introducing a second home for the same concern.
- **`getPublicListUrl` takes `publicCode: string | null`, not a `UserList`.** The ticket's own `implementation_notes` specify this signature; it also decouples the helper from the full list shape, so `ListDetail.tsx` can hold `publicCode` in local state independent of the (unrevalidated-on-the-client) `list` prop after a toggle.
- **Copy-link only enabled while `isPublic` is true**, even though `public_code` itself is preserved when private. A private list's link 404s, so surfacing it as copyable would be misleading; the code's stability is an internal guarantee (AC-3/decision above), not a promise that the link always resolves.
- **RLS zero-row `.single()` as the ownership check**, not a separate `if (owner !== user)` guard — mirrors the pattern already used elsewhere in this codebase (`deleteList`, `renameList`) and flagged by the graph report's own "Ownership verification via two-step fetch + RLS zero-row enforcement" hyperedge.
- **Left `app/(public)/titulo/[slug]/page.tsx`, `proxy.ts`, and `lib/supabase/proxy.ts` untouched.** RIK-9 already placed the title page correctly outside `(app)` and wired `isPublicView` end-to-end; RIK-2's guard already used an allowlist (not a blocklist), so `/l/*` and `/titulo/*` were never at risk of being redirected. No "middleware.ts vs proxy.ts" defect existed to flag — RIK-2 used `proxy.ts` from the start.
- **`app/(public)/l/[codigo]/page.tsx` uses the `PageProps<"/l/[codigo]">` typed helper**, per the ticket's own `implementation_notes` — `.next/types/routes.d.ts` confirmed the route is registered for it, unlike the inline `Promise<{ slug: string }>` style RIK-9/RIK-10 used for their own pages. `titulo/[slug]/page.tsx` (RIK-9's file) was left on its original inline typing since it already works correctly and rewriting it wasn't necessary to satisfy any AC.

## Deferred / follow-ups

- No sign-out control exists anywhere in the UI yet (not part of RIK-11's scope) — noticed while manually verifying AC-1 against a real session; a future ticket building the authenticated app shell/nav should add one.
- No automated test framework exists in this project yet. Once one is added, this ticket's logic should get: a unit test for `generatePublicListCode`/`getPublicListUrl`, a unit test for `ListServices.setListVisibility`'s retry-on-23505 branch (mocked client), and an integration test asserting `getPublicListByCode` returns `null` for a private list under the `anon` role.
- Open Graph / social-preview metadata for shared list links is explicitly out of scope per the ticket (`out_of_scope`); only `notFound()`'s built-in `noindex` applies today.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `supabase db push --local` — applied `20260809170000_user_lists_public_code.sql` successfully; `\d public.user_lists` confirms the column and partial unique index.
- Full manual cycle against the local dev server (see Acceptance criteria table above for the exact commands/queries): sign-up → SQL-seeded test list → publish via real UI → `curl` anon 200 → toggle private via real UI → `curl` anon 404 + anon-role SQL zero-row check → re-publish → same `public_code` confirmed stable. Test list and test auth user were deleted afterward.

## Manual validation

### Prerequisites

- Dev server running (`npm run dev`).
- A published test list with at least one title (create one from `/mis-listas`, add a title, then toggle it public — see step 1 below).
- An incognito/private browser window (for the anonymous checks).
- A second regular browser window signed in as the list owner.

### UI validation

1. As the owner, open `/mis-listas/[slug]` for a list with at least one title. Toggle the switch to "Pública" and click "Copiar enlace" — it should now be enabled and copy a `/l/...` URL (a toast confirms both the visibility change and the copy).
2. In an incognito window, paste and open that `/l/[codigo]` link. Confirm: no redirect to `/auth/login`, no account menu — only the Rikuna logo, "Iniciar sesión" and "Registrarse" links in the header.
3. Confirm the page shows only the list's name, description, and a grid of its titles (poster, title, year, rating) — nothing about subscriptions or watch status.
4. Click a title from the grid. Confirm `/titulo/[slug]` opens with no working "Marcar como visto" / "Agregar a watchlist" actions — clicking either navigates to `/auth/login` instead of mutating anything.
5. Back in the owner's window, toggle the same list back to "Privada".
6. Reload the same incognito `/l/[codigo]` link — confirm it now shows a 404 (not-found) page.

### Database validation

Read-only checks against a local Supabase instance (`psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"`):

```sql
-- public_code is unique whenever assigned (partial index tolerates NULLs)
\d public.user_lists
-- expect: "user_lists_public_code_uq" UNIQUE, btree (public_code) WHERE public_code IS NOT NULL

-- a private list is invisible to the anon role, even by exact code match
set role anon;
select count(*) from user_lists where public_code = '<the code from step 1>';
-- expect: 0 once the list has been toggled back to private
reset role;
```

### Expected outcome

- AC-1: the published list opens with no session and no redirect.
- AC-2: only name, description, and the title grid render — no personal data from any other table.
- AC-3: toggling private makes the same link 404 for anonymous visitors.
- AC-4: the public title page never lets an anonymous visitor mutate watched/watchlist state.
- AC-5: `public_code` is unique and unrelated to `slug`.
- AC-6: `/l/*` and `/titulo/*` are never redirected to login, with or without a session.
- AC-7: the "Copiar enlace" button always reflects a real, working URL — or is disabled — never a broken/placeholder link.
