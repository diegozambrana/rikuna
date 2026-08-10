# RIK-12 — App shell: Header + Sidebar navigation

| Field | Value |
|---|---|
| Ticket | RIK-12 |
| Completed | 2026-08-10 09:07 (local) |
| Log file | `specs/logs/202608100907_RIK-12_app_shell_navigation.md` |
| Backlog spec | `specs/backlog/RIK-12_app_shell_navigation.md` |
| Status | completed |

## Summary

Built the shared authenticated app shell — `Header` (logo, mobile nav trigger, avatar + account `DropdownMenu`) and `Sidebar` (desktop collapsible rail + mobile `Sheet`) — and wired both into `app/(app)/layout.tsx` around the existing auth guard. Every route in the `(app)` group now has consistent navigation chrome instead of a bare page with no way to move between screens.

## Scope delivered

- Added `dropdown-menu`, `sheet`, `separator` shadcn primitives (style `base-lyra`, base color `mist`) via the CLI.
- Added `constants/navigation.ts` with the six authenticated nav items (label, href, Lucide icon).
- Added `ThemeToggle` (light/dark flip, no "system" option, matches root `enableSystem={false}`).
- Added `SidebarNavItem` (active-route highlight, collapsed-mode `Tooltip`) and `Sidebar` (desktop rail with collapse toggle + `SidebarMobileSheet` reusing the same item list/renderer).
- Added `MobileNavTrigger` (client-only hamburger + Sheet open state, keeps `Header` a Server Component).
- Added `Header` (Server Component; avatar initials with `fullName` → `email` → `"?"` fallback; account menu: name/email header, Perfil link, theme toggle, sign out via the existing `actions/auth/signOut` Server Action).
- Wired `Header` + `Sidebar` + collapsible content area into `app/(app)/layout.tsx` without touching the guard/`UserProvider` logic.

## Files changed

### Created

- `constants/navigation.ts` — typed `NavItem[]` for the six authenticated routes.
- `components/layout/ThemeToggle.tsx` — light/dark toggle, rendered as its own `DropdownMenuItem` row.
- `components/layout/SidebarNavItem.tsx` — single nav row with active-state + collapsed tooltip.
- `components/layout/Sidebar.tsx` — desktop rail (`Sidebar`) and mobile `Sheet` variant (`SidebarMobileSheet`), sharing one internal item-list renderer.
- `components/layout/MobileNavTrigger.tsx` — client wrapper owning the mobile Sheet's open state so `Header` can stay server-rendered.
- `components/layout/Header.tsx` — top bar: wordmark, mobile trigger, avatar/account menu.
- `components/ui/dropdown-menu.tsx`, `components/ui/sheet.tsx`, `components/ui/separator.tsx` — shadcn CLI output.

### Modified

- `app/(app)/layout.tsx` — added `Header` + `Sidebar` composition around `{children}`; guard and `UserProvider` wrap unchanged.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Navigated to /panel, /recomendaciones, /biblioteca, /mis-listas, /suscripciones on a desktop viewport; Header and Sidebar rendered on every route. |
| AC-2 | PASS | On /panel only "Qué ver este mes" was highlighted; navigating to /suscripciones moved the highlight to "Mis suscripciones" and nowhere else. |
| AC-3 | PASS | Clicked the collapse chevron: labels disappeared, rail narrowed to icon-only width; hovering an icon in that state showed a Tooltip with the item's label. |
| AC-4 | PASS | Resized to 375×812: no inline sidebar rendered; hamburger icon opened a Sheet sliding in from the left with all six items, each a working link. |
| AC-5 | PASS | Opened the avatar menu: name/email header, separator, "Perfil", "Cambiar tema" (with icon), separator, red "Cerrar sesión" — in that exact order. |
| AC-6 | PASS | Clicked "Cambiar tema": `<html>` class flipped `dark` → `light` immediately, colors inverted; navigated to /biblioteca and the light theme persisted. |
| AC-7 | PASS | Clicked "Cerrar sesión": redirected to /auth/login, the `sb-*-auth-token` cookie was cleared (`document.cookie` empty), and a direct request to /panel redirected back to /auth/login. |
| AC-8 | PASS | Cleared `user_metadata.full_name` via the Supabase admin API for the test account: avatar showed "C" (from the email) and the menu header showed "Sin nombre" / the email — no blank space or "null". Restored `full_name` afterward. |
| AC-9 | PASS | With the session cookie cleared, a direct request to /panel redirected to /auth/login before any shell rendered (no flash of Header/Sidebar). |

## Decisions

- **RSC boundary fix (not in the original spec):** `NavItem.icon` holds a live Lucide component reference, which cannot be passed as a prop from a Server Component to a Client Component (React rejects non-plain-object values, including `forwardRef` components, crossing that boundary). `Sidebar` and `MobileNavTrigger` now default their `items` prop to `APP_NAV_ITEMS` internally (`items = APP_NAV_ITEMS`) and their Server Component callers (`app/(app)/layout.tsx`, `Header.tsx`) render them with no `items` prop at all, so the icon-bearing array never crosses the Server→Client boundary. The `items` prop itself stays typed and overridable for a future Client Component caller.
- **"Cambiar tema" as a self-contained row:** `ThemeToggle` renders its own `DropdownMenuItem` (icon + label + `onClick`) rather than being a bare icon button dropped inside a separately-authored item, because `Header` is a Server Component and cannot attach a client `onClick` handler to a `DropdownMenuItem` it renders directly. `closeOnClick={false}` keeps the menu open after toggling.
- **`DropdownMenuLabel` requires `DropdownMenuGroup`:** Base UI's `Menu.GroupLabel` throws ("MenuGroupContext is missing") unless wrapped in `Menu.Group`. The account-header row is wrapped in a `DropdownMenuGroup` even though it has no sibling items, to satisfy this internal requirement.
- **Sign-out button composition:** kept the exact `<form action={signOut}><button type="submit">…</button></form>` shape requested by the ticket, given `p-0` on the destructive `DropdownMenuItem` and full-width/height padding on the inner `<button>` so the whole row is one click target.

## Deferred / follow-ups

- Sidebar collapse state is not persisted across reloads (explicitly out of scope per the ticket).
- `signOut`'s redirect target (`/auth/login` vs `/`) was left untouched per the ticket's default.
- The unauthenticated Marketing Header/Sidebar variant (RIK-13) is out of scope here; `Header`/`Sidebar`'s generic `items`/`user` props were kept specifically so RIK-13 can reuse them.

## Verification

- `npm run lint` — clean.
- `npx tsc --noEmit` — clean.
- Manual browser verification against the local dev server + local Supabase instance (see Acceptance criteria table).

## Manual validation

### Prerequisites

- Dev server running (`npm run dev`).
- A logged-in test user (any Supabase Auth account with a confirmed email).
- Optional: a second test account with no `full_name` set in `user_metadata`, to check the initials/name fallback.

### UI validation

1. Log in and confirm you land on `/panel` with the Header at the top and the Sidebar on the left (desktop width).
2. Click each of the six Sidebar items in turn — "Qué ver este mes" (`/panel`), "Recomendaciones" (`/recomendaciones`), "Mi biblioteca" (`/biblioteca`), "Mis listas" (`/mis-listas`), "Mis suscripciones" (`/suscripciones`), "Importar desde IMDb" (`/importar`) — and confirm only the current route's item is highlighted each time.
3. Click the collapse chevron at the bottom of the Sidebar: confirm labels disappear and the rail narrows to icon-only. Hover an icon and confirm a Tooltip shows its label. Click again to expand.
4. Resize the browser to a mobile width (e.g. 375px) and reload: confirm no inline sidebar is shown. Click the hamburger icon in the Header and confirm a Sheet slides in from the side with all six items, each a working link that also closes the Sheet on navigation.
5. Click the avatar in the top right: confirm the menu shows, top to bottom, your name and email (non-interactive), a separator, "Perfil", "Cambiar tema", a separator, and a red "Cerrar sesión".
6. Click "Cambiar tema": confirm the whole app switches between light and dark immediately and the menu stays open. Navigate to another `(app)` route and confirm the chosen theme is still applied.
7. Click "Cerrar sesión": confirm you're redirected to `/auth/login`. Then request `/panel` directly and confirm it redirects back to `/auth/login` instead of rendering the shell.

### Expected outcome

- AC-1: Header + Sidebar render on every `(app)` route.
- AC-2: Exactly one Sidebar item is highlighted, matching the current route.
- AC-3: Collapse/expand works; collapsed icons show a Tooltip on hover.
- AC-4: Mobile hides the inline Sidebar; the hamburger opens the same six items in a Sheet.
- AC-5: Avatar menu content and order match the spec exactly.
- AC-6: Theme toggle is immediate and persists across navigation within the session.
- AC-7: Sign-out clears the session and blocks direct access to `/panel` afterward.
- AC-8: A user with no `full_name` gets sensible fallback initials/name text, never blank or "null".
- AC-9: The auth guard still blocks unauthenticated shell access with no flash of protected UI.
