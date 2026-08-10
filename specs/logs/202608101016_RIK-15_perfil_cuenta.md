# RIK-15 — Perfil / cuenta

| Field | Value |
|---|---|
| Ticket | RIK-15 |
| Completed | 2026-08-10 10:16 (local) |
| Log file | `specs/logs/202608101016_RIK-15_perfil_cuenta.md` |
| Backlog spec | `specs/backlog/RIK-15_perfil_cuenta.md` |
| Status | completed |

## Summary

Added the `/perfil` route: a read-only account screen showing the signed-in user's name and email, a
light/dark theme switch (a separate `Switch`-shaped control from RIK-12's icon-button `ThemeToggle`,
per the PRD), and a destructive "Cerrar sesión" button wired to the existing `signOut` server action.
No new service, action, or database work — the screen composes context and hooks that already existed.

## Scope delivered

- New feature-sliced screen under `features/profile/` reading from the already-hydrated
  `useSession()`/`UserProvider` context (no redundant server-side `getCurrentUser()` call).
- New two-state theme `Switch` reading/writing `next-themes`' `useTheme()`, independent from RIK-12's
  avatar-menu toggle but reflecting the same underlying theme state.
- New thin `app/(app)/perfil/page.tsx` route composing the screen — already covered by
  `PROTECTED_PREFIXES` in `lib/supabase/proxy.ts`, no middleware change needed.

## Files changed

### Created

- `features/profile/ThemeSwitch.tsx` — labeled Switch control for light/dark theme, hydration-safe.
- `features/profile/ProfileScreen.tsx` — account info, theme switch, and sign-out sections.
- `app/(app)/perfil/page.tsx` — thin route rendering `ProfileScreen`.

### Modified

- `CHANGELOG.md` — added the RIK-15 entry under `[Unreleased] / Added`.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Logged in as `contacto@diegozambrana.com`, navigated to `/perfil`: page text showed "Nombre: diego zambrana" and "Correo: contacto@diegozambrana.com". |
| AC-2 | PASS | Clicked the Switch on `/perfil`: `document.documentElement.className` flipped `dark` → `light`. Opened the avatar menu's "Cambiar tema" (RIK-12) and confirmed it toggled the same `<html>` class back to `dark`, then re-visited `/perfil` and the Switch reflected the updated state. |
| AC-3 | PASS | Clicked "Cerrar sesión": `window.location.href` became `/auth/login`. A subsequent direct request to `/perfil` redirected to `/auth/login?next=%2Fperfil`. |
| AC-4 | PASS | Created a throwaway local Supabase test user with no `full_name` in `user_metadata` (via the GoTrue admin API against the local `127.0.0.1:54321` instance, same pattern used in `specs/logs/202608091350_RIK-1_database_schema_rls.md`), logged in, and `/perfil` rendered "Nombre: Sin nombre" with the email still correct. Test user deleted after verification. |

## Decisions

- **Read-only name/email, no edit form** — per the ticket's Decision 1 and the ground-truth note that no
  `updateProfile`/`updateUser` action exists anywhere in `actions/`. Editable fields are a follow-up
  ticket's scope, not this one's.
- **Separate `ThemeSwitch` component, not a reused `ThemeToggle`** — per the PRD's Section 1.5 "Switch
  para tema" for this screen specifically, distinct from RIK-12's icon-button avatar-menu control
  (Section 1.6). Both read the same `useTheme()` hook, so they stay in sync without shared state.
- **Theme label copy**: "Modo oscuro" (default from the ticket's `clarify_before_coding`, unconfirmed
  otherwise).
- **Mount-guard on the theme Switch's `checked` state** (`useSyncExternalStore`-based `useMounted()`,
  not in the ticket's implementation notes) — found and fixed during verification. `next-themes`'
  `resolvedTheme` is `undefined` during SSR but already resolved on the client's first render pass,
  which reliably produced a React hydration mismatch on every load of `/perfil` (confirmed via
  `read_console_messages`, reproduced on repeated fresh loads, fixed and reverified with zero console
  errors). This screen renders the Switch unconditionally on initial paint, unlike RIK-12's
  `ThemeToggle`, which only mounts once the avatar dropdown is opened and so never hits the SSR path.
  A plain `useState` + `useEffect(() => setMounted(true), [])` guard was tried first but is rejected by
  this repo's `react-hooks/set-state-in-effect` ESLint rule; `useSyncExternalStore` with an
  always-`false` server snapshot and always-`true` client snapshot avoids that lint error while giving
  the same SSR-safe guarantee.

## Deferred / follow-ups

- Editable name/email (and the corresponding `updateProfile` action) — explicitly out of scope per the
  ticket; candidate for a future ticket if confirmed wanted.
- Avatar image upload and account deletion — not requested by the PRD for this screen.

## Verification

- `npm run lint` — clean, no errors or warnings.
- `graphify update .` — ran after the initial file creation and again after the hydration-guard fix.
- Manual UI verification in the Browser pane against the local dev server (`localhost:3011`) — see
  Acceptance criteria evidence above.

## Manual validation

### Prerequisites

- Dev server running (`npm run dev`, `localhost:3011`).
- A logged-in test user.
- Optionally, a second test user with no display name set (empty/absent `full_name` in
  `user_metadata`) to check the fallback.

### UI validation

1. Log in and navigate to `/perfil`.
2. Confirm the account name and email render as read-only text and match the logged-in account. If
   using a test user with no display name, confirm "Sin nombre" renders instead of blank space or
   "null".
3. Toggle the "Modo oscuro" switch. Confirm the whole app immediately flips between light and dark
   (colors invert). Open the avatar menu (top right) and confirm its own theme control reflects the
   same state.
4. Click "Cerrar sesión". Confirm you're redirected to `/auth/login`.
5. With the session now cleared, request `/perfil` directly. Confirm it redirects back to
   `/auth/login`.

### Expected outcome

- AC-1: Name (or "Sin nombre" fallback) and email render correctly as read-only text.
- AC-2: The Switch and the avatar menu's theme control drive the same theme state; toggling either is
  reflected by the other.
- AC-3: Sign-out redirects to `/auth/login`, and `/perfil` is no longer reachable without logging in
  again.
- AC-4: A user with no `full_name` sees "Sin nombre" instead of blank space, "null", or a crash.
