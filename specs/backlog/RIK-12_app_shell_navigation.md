# RIK-12 — App shell: Header + Sidebar navigation

## Ticket summary

Build the `Header` and `Sidebar` shell components the authenticated zone has never had, and wire them into `app/(app)/layout.tsx` so every page under `/panel`, `/recomendaciones`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, and `/perfil` renders inside real navigation instead of bare content.

- Header: logo linking to `/panel`, and an `Avatar` + `DropdownMenu` on the right showing the user's name/email, a link to `/perfil`, a light/dark theme toggle, a separator, and a destructive "Cerrar sesión" item wired to the existing `signOut` server action.
- Sidebar: always visible on desktop (collapsible), becomes a `Sheet` opened from a header hamburger icon on mobile. Six items — Qué ver este mes, Recomendaciones, Mi biblioteca, Mis listas, Mis suscripciones, Importar desde IMDb — each linking to its route with an active-route highlight.
- This is the highest-impact gap found against `specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md` (Section 1.6): `app/(app)/layout.tsx` currently renders zero chrome, so every authenticated screen shipped so far (RIK-6 through RIK-11) has no way to navigate between screens except typing URLs.
- No team comments — this ticket is derived directly from a gap analysis against the current repo, not from a pasted tracker ticket. Font family / typography is explicitly out of scope per the requester.
- `/biblioteca` and `/perfil` are sidebar/menu link targets whose actual pages ship in sibling tickets (RIK-14, RIK-15) — linking to them here is intentional forward-wiring, not a bug.

---

## Context

### Original ticket

No tracker ticket exists for this work. It was scoped from a direct comparison between `specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md` Section 1.6 ("Layouts compartidos — Header + Sidebar") and the real state of `app/(app)/layout.tsx`, `components/`, and `features/`, run against `graphify-out/GRAPH_REPORT.md` first per this repo's `CLAUDE.md` graphify rule (confirmed no existing Header/Sidebar/DropdownMenu node in the graph, and no community covering this area — the gap is real, not a naming mismatch).

PRD requirements folded in here (Section 1.6, verbatim intent):

- Three of the PRD's four layout variants share the same two components (Header, Sidebar) with different content depending on session state; this ticket builds the **authenticated variant** only. The unauthenticated (Marketing) variant is RIK-13's job, reusing what this ticket ships.
- Header, authenticated: logo → `/panel` on the left; `Avatar` + `DropdownMenu` on the right. Menu: non-interactive name/email header, separator, "Perfil" → `/perfil`, "Cambiar tema" (toggle, no submenu since the app is dark-only today — see ground truth notes), separator, "Cerrar sesión" (destructive style, calls the sign-out action, redirects to `/`).
- Mobile header: a menu icon (`≡`) that opens the Sidebar as a side `Sheet`.
- Sidebar, authenticated: always visible on desktop, collapsible; items — Qué ver este mes (`/panel`, `Home`/`LayoutDashboard`), Recomendaciones (`/recomendaciones`, `Sparkles`), Mi biblioteca (`/biblioteca`, `Library`), Mis listas (`/mis-listas`, `ListVideo`), Mis suscripciones (`/suscripciones`, `Tv`), Importar desde IMDb (`/importar`, `Upload`). The active route is highlighted. "Perfil" and "Cerrar sesión" are explicitly **not** duplicated in the sidebar — they live only in the avatar menu.
- Suggested components (PRD Section 1.5/1.6): `Avatar`, `DropdownMenu`, `DropdownMenuItem`, `Separator`, `Button`, `Sheet`, `Tooltip` (collapsed-sidebar labels).

### Team comments

None — see Original ticket above for how this ticket's scope was derived instead.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| PRD Section 1.3 documents `components.json` as `"style": "lyra"` (Radix-based shadcn) | Real `components.json` in the repo is `"style": "base-lyra"` — the Base UI variant (`@base-ui/react`, not Radix) | Every shadcn primitive added here (`dropdown-menu`, `sheet`, `separator`) must be the Base UI variant added via the CLI with the project's real config; do not hand-author Radix APIs |
| PRD implies Header/Sidebar are new, unstarted work | `ARCHITECTURE.md` (currently modified, uncommitted, on `main`) already documents the **target** shape in detail: a `components/layout/` folder with `Header` + `Sidebar`, a routing table listing every route's shell, and `lib/supabase/proxy.ts`'s `PROTECTED_PREFIXES` already includes `/biblioteca` and `/perfil` even though those pages don't exist yet | Treat `ARCHITECTURE.md`'s uncommitted routing/shell section as the authoritative target design, not a hypothesis — this ticket implements it rather than inventing a new structure |
| Ticket domain (PRD) doesn't mention any existing sign-out mechanism | `actions/auth/signOut.ts` already exists, exported from `actions/auth/index.ts`: a `"use server"` function that calls `supabase.auth.signOut()` and `redirect("/auth/login")` | Reuse it as-is inside the avatar menu; do not write a second sign-out action. Note: PRD Section 1.6 says the menu item "redirige a `/`" — the existing action redirects to `/auth/login` instead (see Decisions) |
| PRD assumes a theme submenu ("claro/oscuro") | `app/layout.tsx` configures `next-themes` with `attribute="class" defaultTheme="dark" enableSystem={false}` — there are only two themes in play (no "system" option), and no `ThemeToggle` component exists anywhere yet | A single-click light/dark toggle is sufficient; no three-way submenu is needed |
| PRD lists "Perfil" and theme toggle as menu items assuming a full account page | `/perfil` does not exist yet (ships in RIK-15, not yet spec'd at ticket-write time — actually spec'd alongside this one, see Related tickets) | Link to `/perfil` regardless; Next.js does not error at build time for a `<Link>` to a route that doesn't exist yet, only at click-time until RIK-15 lands |

### Current database state

Not applicable — this ticket touches no tables. `getCurrentUser()` (`lib/supabase/server.ts`) already returns everything the Header needs:

```ts
export type CurrentUser = {
  id: string
  email: string | null
  fullName: string | null
}
```

There is no avatar-image URL anywhere in this type or in Supabase Auth user metadata usage elsewhere in the repo — the avatar must render initials only, the same pattern `features/title/CastList.tsx` already uses (`initials()` helper, first letters of up to two space-separated name parts, uppercased) via `AvatarFallback`.

### Current logic (`app/(app)/layout.tsx`)

Verbatim, the entire file today:

```tsx
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/supabase/server"
import { UserProvider } from "@/components/providers/UserProvider"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser()

  // Belt-and-suspenders with the proxy-level check: Server Functions bypass
  // proxy matchers, so this Server Component check is the real backstop.
  if (!user) {
    redirect("/auth/login")
  }

  return <UserProvider user={user}>{children}</UserProvider>
}
```

It performs the auth guard and hydrates `UserProvider`/`useSession()`/`useUserContext()` (`components/providers/UserProvider.tsx`, `hooks/useSession.ts`) — both of which this ticket keeps unchanged — but renders **no chrome at all**. Confirmed via `grep` across `app/(app)/**` and `components/`/`features/` that no file matching `Sidebar`, `Header`, or `DropdownMenu` exists anywhere in the repo.

`lib/supabase/proxy.ts` (`updateSession`, called from the root `proxy.ts` per the Next.js 16 root-guard convention already in place) already protects `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil` at the middleware layer — this ticket's Server Component guard in `(app)/layout.tsx` stays as the documented "belt-and-suspenders" backstop and is not touched beyond wrapping its return value in the new shell.

### Requested field mapping

Not applicable — no persisted fields are requested by this ticket; it is UI-only, consuming the already-shaped `CurrentUser` type.

### Impacted files

**Components (new)**
- `components/layout/Header.tsx` — logo, avatar/dropdown menu, mobile hamburger trigger.
- `components/layout/Sidebar.tsx` — nav item list, active-route highlight, desktop collapse state, mobile `Sheet` body.
- `components/layout/SidebarNavItem.tsx` — single link + icon + label + `Tooltip` (collapsed state), reused by both desktop and mobile renderings.
- `components/layout/ThemeToggle.tsx` — small `useTheme()`-backed toggle, used inside the avatar `DropdownMenu`.
- `constants/navigation.ts` — the six-item nav list (`{ label, href, icon }`) as a single source of truth for `Sidebar`, so RIK-13's marketing variant and any future breadcrumb/mobile-title logic don't hand-copy the list.

**App routes (modified)**
- `app/(app)/layout.tsx` — compose `Header` + `Sidebar` around `{children}`, still inside `UserProvider`, still gated by the existing `redirect` check.

**UI primitives (new via shadcn CLI, `base-lyra` style)**
- `components/ui/dropdown-menu.tsx`, `components/ui/sheet.tsx`, `components/ui/separator.tsx` — none of the three exist today (confirmed via `ls components/ui/`); `avatar.tsx`, `button.tsx`, `tooltip.tsx` already exist and are reused as-is.

**No changes** to `services/`, `actions/` (beyond importing the existing `signOut`), `types/`, or any `supabase/migrations/` file.

### Decisions made

1. **Sign-out redirect target: keep the existing `actions/auth/signOut.ts` behavior (`/auth/login`), not the PRD's literal `/`.** Rationale: the action already exists and is presumably exercised by other flows; rewriting its redirect target is a one-line, low-risk change but out of this ticket's actual scope (navigation chrome, not auth flow behavior). Recommended default, unconfirmed — flagged in `<clarify_before_coding>`.
2. **Theme toggle is a single click-to-flip control (light ⇄ dark), not a three-way "claro/oscuro/sistema" submenu.** Rationale: `enableSystem={false}` in the existing `ThemeProvider` config means "system" was already deliberately excluded; matching that in the new toggle avoids introducing a third state the app doesn't otherwise support. Confirmed against real config, not a guess.
3. **Desktop sidebar collapse state is local component state (`useState`), not persisted to `localStorage` or a Zustand store.** Rationale: `ARCHITECTURE.md`'s `stores/` section describes Zustand for state actually shared across features (filters, UI flags reused elsewhere) — a single collapse boolean scoped to one layout doesn't meet that bar. Persistence across reloads is a cheap follow-up, not a blocker for this ticket. Recommended default.
4. **New `constants/navigation.ts` single source of truth for the six nav items**, instead of inlining the array in `Sidebar.tsx`. Rationale: `ARCHITECTURE.md`'s `constants/` folder already exists for exactly this kind of static configuration (`recommendationThresholds.ts`, `platforms.ts`), and RIK-13's Marketing sidebar variant will need its own separate item list — keeping the App list in its own named export makes the two easy to tell apart. Recommended default.
5. **Avatar renders initials only (`AvatarFallback`), never `AvatarImage`.** Rationale: `CurrentUser` has no avatar URL field anywhere in the codebase or Supabase Auth usage; inventing one is out of scope. Confirmed via `types` and `lib/supabase/server.ts`.
6. **Header/Sidebar accept `user: CurrentUser` and the nav item list as explicit props, not via `useSession()`/context lookups inside the components themselves.** Rationale: `ARCHITECTURE.md`'s stated pattern is "Server Components fetch via actions/services and pass initial data as props" — `(app)/layout.tsx` already has `user` in scope from `getCurrentUser()`, so threading it as a prop keeps `Header`/`Sidebar` framework-agnostic enough for RIK-13 to reuse with different (or absent) user data, without a second context provider. Recommended default, directly enables RIK-13's reuse plan.

### Out of scope

- The Marketing (unauthenticated) Header/Sidebar variant and the `/` page itself — RIK-13, which depends on this ticket's components existing.
- The `/biblioteca` and `/perfil` page bodies — RIK-14 and RIK-15 respectively; this ticket only links to them.
- Persisting sidebar collapse state across reloads — cheap follow-up, not required for the PRD's stated behavior ("colapsable" doesn't require persistence).
- Changing `signOut`'s redirect target from `/auth/login` to `/` — one-line follow-up if the PRD's literal wording is confirmed as a real requirement (see Decision 1).
- Editing `middleware.ts`/`lib/supabase/proxy.ts` — already correctly configured for every route this ticket links to.

---

## Implementation plan

**Goal:** Give every authenticated screen real navigation chrome by building `Header` + `Sidebar` once, in `components/layout/`, and composing them into `app/(app)/layout.tsx` — closing the single largest gap between the shipped app and `RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md`.

**In scope:**
1. Add missing shadcn primitives: `dropdown-menu`, `sheet`, `separator` (Base UI / `base-lyra` variant, via CLI).
2. `constants/navigation.ts` — the six-item authenticated nav list.
3. `components/layout/ThemeToggle.tsx` — `useTheme()` light/dark flip control.
4. `components/layout/SidebarNavItem.tsx` — link + icon + label + active-state styling + collapsed-state `Tooltip`.
5. `components/layout/Sidebar.tsx` — desktop always-visible/collapsible rail using the nav items; mobile `Sheet` body reusing the same item list.
6. `components/layout/Header.tsx` — logo → `/panel`, mobile hamburger opening the `Sidebar`'s `Sheet`, `Avatar` + `DropdownMenu` (name/email header, Perfil, ThemeToggle, separator, destructive Cerrar sesión calling `signOut`).
7. Wire both into `app/(app)/layout.tsx` around `{children}`, without touching the existing redirect guard or `UserProvider` wrap.

**Out of scope:** Marketing variant (RIK-13), `/biblioteca` and `/perfil` page content (RIK-14/RIK-15), collapse-state persistence, `signOut` redirect-target change — see Out of scope above.

**Key risks / compatibility:**
- This ticket changes `app/(app)/layout.tsx`, which every authenticated route (`/panel` through `/importar/[batchId]`) already renders through — a layout-level runtime error here breaks every one of them. Keep the change additive (wrap `{children}`, don't restructure the guard/provider).
- Linking to `/biblioteca` and `/perfil` before RIK-14/RIK-15 land is intentional, not a defect — Next.js only 404s on click, it doesn't fail the build.
- `Header`/`Sidebar` must render correctly with `fullName: null` (a user who never set a display name) — fall back to `email` for both the visible label and the initials input.

**Acceptance criteria mapping:**

| AC | Satisfied by |
| --- | --- |
| AC-1 | `Header` renders on every `(app)` route via the layout change |
| AC-2 | `Sidebar` six items, `constants/navigation.ts`, active-route highlight via `usePathname()` |
| AC-3 | `Sidebar` desktop collapse behavior |
| AC-4 | `Sheet`-based mobile sidebar triggered from `Header`'s hamburger icon |
| AC-5 | `DropdownMenu` structure: name/email, Perfil, ThemeToggle, separator, destructive Cerrar sesión |
| AC-6 | `ThemeToggle` flips `next-themes`' resolved theme class |
| AC-7 | `signOut` form action inside the `DropdownMenuItem` |
| AC-8 | Avatar `AvatarFallback` initials fallback for missing name |

---

## Claude Code prompt

```xml
<task id="RIK-12" title="App shell: Header + Sidebar navigation">

  <role>
    You are a senior full-stack engineer working on Rikuna, a Next.js 16 (App Router) + React 19 +
    TypeScript + Supabase project. You follow the project's layered + feature-sliced architecture
    strictly: app/ (routes) -> features/ (screens) -> actions/ ("use server") -> services/ (data access),
    with components/ reserved for shared, cross-feature UI.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — read in full. It is currently MODIFIED and UNCOMMITTED on the working tree
      (confirmed via `git status`/`git diff`) and already documents the target shape this ticket
      implements: a `components/layout/` folder with `Header` + `Sidebar`, the full routing table (every
      path's shell), and the `(marketing)`/`(auth)`/`(app)`/`(public)` route-group boundaries. Treat its
      routing table and Shared UI section as the authoritative target design, not a draft to second-guess.</item>
    <item>AGENTS.md — this project runs Next.js 16, which has breaking changes vs. your training data.
      Read node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md before touching
      app/(app)/layout.tsx if you need to confirm redirect() semantics inside a Server Component layout
      (unchanged behavior expected — you are not modifying the guard logic itself).</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the completion
      report's commit deliverable.</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md Section 1.6 ("Layouts compartidos — Header +
      Sidebar") — the full authenticated-variant spec: header contents, avatar menu items and order,
      sidebar item list with suggested icons, mobile behavior (Sheet from a header hamburger icon),
      desktop collapse behavior with Tooltip on collapsed items. Section 1.5 for the general
      component-per-need mapping (Avatar, DropdownMenu, Sheet, Tooltip, Separator, Button).</item>
    <item>app/(app)/layout.tsx — the exact current file (~15 lines): the auth guard
      (`getCurrentUser()` + `redirect("/auth/login")` if absent) and the `UserProvider` wrap. Your change
      must be additive around `{children}` — do not remove or reorder the guard or the provider.</item>
    <item>lib/supabase/server.ts — read the `CurrentUser` type (`id`, `email`, `fullName`, all but `id`
      nullable) and `getCurrentUser()`. This is the only user data available; there is no avatar-image
      field anywhere in this project.</item>
    <item>components/providers/UserProvider.tsx and hooks/useSession.ts — existing context/hook you are
      NOT changing; `Header`/`Sidebar` receive `user` as an explicit prop from the layout instead of
      reading this context internally (see ground truth notes).</item>
    <item>actions/auth/signOut.ts and actions/auth/index.ts — the existing, already-implemented sign-out
      Server Action (`supabase.auth.signOut()` then `redirect("/auth/login")`). Reuse it exactly as-is;
      do not write a second sign-out action.</item>
    <item>app/layout.tsx — the root layout's existing `ThemeProvider` config
      (`attribute="class" defaultTheme="dark" enableSystem={false}`) from `next-themes`, and the existing
      `TooltipProvider` wrap (already present — do not add a second one).</item>
    <item>components.json — confirm the real shadcn config: `"style": "base-lyra"` (Base UI, not Radix),
      `"baseColor": "mist"`, `"iconLibrary": "lucide"`. Every new component you add via the CLI must use
      this config.</item>
    <item>components/ui/avatar.tsx, components/ui/button.tsx, components/ui/tooltip.tsx — existing
      primitives to reuse as-is; do not regenerate them.</item>
    <item>features/title/CastList.tsx — read its local `initials(name: string)` helper (first letters of
      up to two space-separated name parts, uppercased). Mirror this exact behavior locally in
      components/layout/Header.tsx rather than importing it (it is not exported) or inventing a different
      algorithm.</item>
    <item>lib/supabase/proxy.ts — confirm `PROTECTED_PREFIXES` already includes `/biblioteca` and
      `/perfil` even though those pages don't exist in the repo yet. This is intentional forward-wiring
      from a prior change, not something to "fix" — your new Sidebar/menu links to those paths are
      expected to 404 on click until sibling tickets RIK-14/RIK-15 ship, which is acceptable.</item>
    <item>CHANGELOG.md — format and where to append the new entry under [Unreleased].</item>
    <item>specs/logs/README.md — work log filename convention and template.</item>
  </mandatory_reading>

  <context>
    Rikuna's authenticated zone ((app) route group: /panel, /recomendaciones, /biblioteca, /mis-listas,
    /suscripciones, /importar, /titulo/[slug] when a session exists) has shipped seven feature tickets
    (RIK-6 through RIK-11) with zero shared navigation chrome. app/(app)/layout.tsx today only performs
    the auth redirect and wraps children in UserProvider — there is no Header, no Sidebar, no way to move
    between screens except editing the URL bar. This ticket closes that gap by building the two shared
    layout components the PRD (vistas-y-estilo-rikuna-v2.md Section 1.6) has always specified, and wiring
    them into the one layout file every authenticated route already passes through.

    getCurrentUser() (lib/supabase/server.ts) returns exactly: { id: string, email: string | null,
    fullName: string | null }. There is no avatar-image URL anywhere in this project — the avatar must
    render initials via AvatarFallback only, falling back to email when fullName is null (some accounts
    may never set a display name via Supabase Auth's user_metadata.full_name).

    next-themes is already configured at the root (app/layout.tsx) with enableSystem={false} — there are
    only two themes in play (light, dark), no "system" option, so the theme control this ticket adds is a
    simple flip toggle, not a three-way selector.

    actions/auth/signOut.ts already exists and is fully implemented — a "use server" function that calls
    supabase.auth.signOut() and redirect("/auth/login"). Call it from the avatar menu's "Cerrar sesión"
    item; do not duplicate its logic.

    This ticket is the first of a four-ticket series closing PRD gaps (RIK-12 App shell, RIK-13 Marketing
    home, RIK-14 Mi biblioteca, RIK-15 Perfil). RIK-13's Marketing (unauthenticated) Header/Sidebar variant
    is expected to REUSE the components this ticket builds (with a different user value and a different
    nav item list), so keep Header and Sidebar's props generic (explicit user/items props, no internal
    context reads) rather than hard-coding authenticated-only assumptions into their implementation.
  </context>

  <ground_truth_db_notes critical="true">
    <note>No database work is involved in this ticket — these are codebase ground-truth facts, not schema
      facts, but are just as load-bearing.</note>
    <note>components.json's real "style" value is "base-lyra" (the Base UI variant of shadcn), NOT "lyra"
      as specs/RIKUNA-PRD-vistas-y-estilo-rikuna-v2.md Section 1.3 documents — the project migrated off
      Radix. Add dropdown-menu, sheet, and separator via the shadcn CLI using the project's actual
      configured style; do not hand-write Radix-specific primitive APIs.</note>
    <note>components/ui/avatar.tsx, button.tsx, and tooltip.tsx already exist — do not regenerate or
      overwrite them. dropdown-menu.tsx, sheet.tsx, and separator.tsx do NOT exist yet (confirmed via
      `ls components/ui/`) and must be added.</note>
    <note>app/layout.tsx already wraps the whole app in a single TooltipProvider (from
      components/ui/tooltip.tsx) — do not add a second TooltipProvider in Header or Sidebar; just use
      Tooltip/TooltipTrigger/TooltipContent directly, they will find the existing provider.</note>
    <note>ARCHITECTURE.md's Server Actions table already lists `auth` — "Sign in, sign up, sign out (used
      by the Header's user menu), password reset" — confirming actions/auth/signOut.ts is the intended,
      pre-existing sign-out call site for exactly this ticket's menu item.</note>
    <note>The CurrentUser type has NO avatar-image field. Do not add one, do not fetch a Gravatar or any
      external avatar service — AvatarFallback with computed initials is the complete, intended
      implementation.</note>
    <note>lib/supabase/proxy.ts's PROTECTED_PREFIXES array already includes "/biblioteca" and "/perfil".
      These routes do not have page.tsx files yet — linking the Sidebar/avatar-menu to them is correct and
      intentional; they will 404 on click until RIK-14/RIK-15 ship, which is acceptable and expected, not a
      bug to work around in this ticket.</note>
    <note>app/(app)/layout.tsx's existing redirect() call and UserProvider wrap must remain exactly as
      they are — this ticket only adds Header/Sidebar composition around {children}, it does not restructure
      the guard.</note>
  </ground_truth_db_notes>

  <requirements>
    <phase title="UI primitives">
      <item>Add dropdown-menu, sheet, and separator via the shadcn CLI using the project's real
        components.json config (style: base-lyra, baseColor: mist, iconLibrary: lucide). Do not hand-author
        these — use the CLI so the generated code matches the Base UI variant exactly.</item>
    </phase>

    <phase title="Constants">
      <item>Create constants/navigation.ts exporting a typed, ordered array of the six authenticated nav
        items, e.g. `export type NavItem = { label: string; href: string; icon: LucideIcon }` and
        `export const APP_NAV_ITEMS: NavItem[] = [...]` with: "Qué ver este mes" -> /panel (Home or
        LayoutDashboard icon), "Recomendaciones" -> /recomendaciones (Sparkles), "Mi biblioteca" ->
        /biblioteca (Library), "Mis listas" -> /mis-listas (ListVideo), "Mis suscripciones" ->
        /suscripciones (Tv), "Importar desde IMDb" -> /importar (Upload). Import icon components from
        lucide-react.</item>
    </phase>

    <phase title="Theme toggle">
      <item>Create components/layout/ThemeToggle.tsx as a Client Component using useTheme() from
        next-themes (already a dependency and already provided at the root). Render a single icon button
        (e.g. Sun/Moon from lucide-react, swapped by resolvedTheme) that flips between "light" and "dark"
        on click — do not add a "system" option, matching the root ThemeProvider's enableSystem={false}.
        This component is designed to be dropped inside a DropdownMenuItem (as the "Cambiar tema" row) in
        Header.tsx.</item>
    </phase>

    <phase title="Sidebar">
      <item>Create components/layout/SidebarNavItem.tsx: a Client Component taking one NavItem plus an
        `collapsed: boolean` prop. Renders a Link styled as a nav row (icon + label), using usePathname()
        to detect whether its own href is the active route (exact match or prefix match for nested routes
        like /mis-listas/[slug] and /importar/[batchId]) and applying a distinct active style/background in
        that case. When collapsed is true, hide the label and wrap the icon-only button in a Tooltip
        showing the label (per PRD 1.6's "Tooltip en modo colapsado").</item>
      <item>Create components/layout/Sidebar.tsx: a Client Component accepting `items: NavItem[]`. Desktop:
        always-visible vertical rail, with a collapse toggle button (chevron icon) that flips local
        useState boolean `collapsed`, animating/resizing width between an expanded and icon-only state,
        rendering each item via SidebarNavItem. Mobile: the SAME item list rendered inside a Sheet whose
        open state is controlled by a prop from Header (`open`, `onOpenChange`) — do not duplicate the
        item-rendering logic between desktop and mobile, extract a shared internal list-rendering
        subcomponent or map if needed, but reuse SidebarNavItem in both.</item>
    </phase>

    <phase title="Header">
      <item>Create components/layout/Header.tsx: a Server Component (no "use client" at the top level)
        accepting `user: CurrentUser` as a prop. Left: Rikuna wordmark/logo as a Link to /panel. Right: on
        mobile, a hamburger IconButton that opens the Sidebar's Sheet (this requires a small client-only
        wrapper around the open/close boolean — extract a client subcomponent, e.g.
        components/layout/MobileNavTrigger.tsx, that owns the useState and renders both the trigger button
        and <Sidebar items={APP_NAV_ITEMS} ... /> in its mobile/Sheet mode, so Header itself can stay a
        Server Component). On the right, an Avatar + DropdownMenu: Avatar shows AvatarFallback with
        initials computed from user.fullName (falling back to user.email when fullName is null; render "?"
        only if both are null, which should not happen for an authenticated user but must not crash).
        DropdownMenu content, top to bottom: a non-interactive header row showing user.fullName ?? "Sin
        nombre" and user.email; DropdownMenuSeparator; a "Perfil" item (Link to /perfil); a "Cambiar tema"
        item embedding ThemeToggle (or triggering the same toggle logic inline — keep it a single click
        target, not a nested menu); DropdownMenuSeparator; a destructive-styled "Cerrar sesión" item that
        is a <form action={signOut}><button type="submit">...</button></form> so the existing Server Action
        fires directly without extra client-side plumbing.</item>
    </phase>

    <phase title="Wire into the layout">
      <item>Modify app/(app)/layout.tsx: after the existing `if (!user) redirect(...)` check, render
        `<UserProvider user={user}>` wrapping a flex layout that composes `<Header user={user} />`, the
        desktop `<Sidebar items={APP_NAV_ITEMS} />`, and `{children}` in a content area (e.g. Sidebar fixed
        to the left on desktop via flex/grid, main content scrollable next to it, Header spanning the top).
        Do not change the guard logic or remove the UserProvider wrap — only add the shell composition
        around what it already renders.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">Every route under app/(app)/ (verify with /panel, /recomendaciones,
      /mis-listas, /suscripciones, /importar) renders the Header at the top and the Sidebar on desktop
      viewport widths. Verify: navigate to each route in a desktop-sized browser and confirm both are
      visible.</criterion>
    <criterion id="AC-2">The Sidebar lists exactly the six items from constants/navigation.ts in order,
      each a working Link to its route, and the item matching the current route is visually distinguished
      from the others. Verify: navigate to /panel and confirm only "Qué ver este mes" is highlighted;
      navigate to /suscripciones and confirm only "Mis suscripciones" is highlighted.</criterion>
    <criterion id="AC-3">On desktop, clicking the Sidebar's collapse control switches it to an icon-only
      width and back, and in the collapsed state hovering an icon shows its label in a Tooltip. Verify:
      click the collapse toggle, confirm labels disappear and the rail narrows; hover an icon and confirm a
      Tooltip with the item's label appears.</criterion>
    <criterion id="AC-4">On a mobile-width viewport, the Sidebar is not rendered inline; a hamburger icon
      in the Header opens it as a Sheet sliding in from the side, containing the same six items. Verify:
      resize to a mobile width (e.g. 375px), confirm no inline sidebar, click the hamburger icon, confirm
      the Sheet opens with all six items and each is a working link.</criterion>
    <criterion id="AC-5">Clicking the Avatar opens a DropdownMenu showing (top to bottom): a
      non-interactive row with the user's name and email, a separator, "Perfil", a theme toggle control,
      another separator, and a destructive-styled "Cerrar sesión" item — in that exact order. Verify: open
      the menu as a logged-in user and inspect the rendered order and styling (destructive item visually
      distinct, e.g. red text).</criterion>
    <criterion id="AC-6">Clicking the theme toggle switches the app between light and dark mode
      immediately, and the choice is reflected on next navigation within the same session (next-themes'
      standard class-on-html behavior). Verify: toggle from dark to light, confirm the `class` attribute on
      `&lt;html&gt;` changes and background/foreground colors invert; navigate to another (app) route and
      confirm the chosen theme persists.</criterion>
    <criterion id="AC-7">Clicking "Cerrar sesión" signs the user out and redirects to a login-reachable
      page (per the existing signOut action's behavior, /auth/login), and a subsequent direct navigation to
      /panel redirects back to /auth/login. Verify: click the item, confirm redirect, confirm the Supabase
      session cookie is cleared, confirm /panel now redirects to /auth/login.</criterion>
    <criterion id="AC-8">A user whose fullName is null (only email set) sees valid initials (derived from
      the email) in the Avatar and a valid non-empty label in the dropdown's name row (e.g. falling back to
      the email string) — the UI does not render blank space, "null", or crash. Verify: seed or use a test
      account with no full_name in user_metadata, confirm the Avatar and menu header both render sensible
      fallback text.</criterion>
    <criterion id="AC-9">app/(app)/layout.tsx's existing auth guard is unchanged in behavior — an
      unauthenticated request to any (app) route still redirects to /auth/login before any shell renders.
      Verify: clear the session cookie, request /panel directly, confirm the redirect happens (no flash of
      Header/Sidebar with no user).</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a new sign-out action — reuse actions/auth/signOut.ts exactly as it exists
      today.</item>
    <item>Do NOT modify app/(app)/layout.tsx's redirect/guard logic or remove the UserProvider wrap — only
      add shell composition around {children}.</item>
    <item>Do NOT hand-write Radix-based component internals — this project's shadcn style is "base-lyra"
      (Base UI); add dropdown-menu, sheet, and separator via the CLI.</item>
    <item>Do NOT add a "system theme" option — the root ThemeProvider has enableSystem={false}
      deliberately; the new toggle must only flip between "light" and "dark".</item>
    <item>Do NOT invent an avatar-image field or fetch an external avatar service — initials via
      AvatarFallback only, per the real CurrentUser type.</item>
    <item>Do NOT build the /biblioteca or /perfil page bodies — those are RIK-14 and RIK-15. Linking to
      them from the Sidebar/menu is in scope; their content is not.</item>
    <item>Do NOT build the unauthenticated (Marketing) Header/Sidebar variant or touch app/page.tsx —
      that is RIK-13. Do keep Header/Sidebar's props (user, items) generic enough that RIK-13 can reuse
      them without modification.</item>
    <item>Do NOT add a second TooltipProvider — app/layout.tsx already provides one globally.</item>
    <item>User-visible copy is Spanish; code identifiers, comments, and commit/PR text are English, per
      ARCHITECTURE.md's "Conventions worth preserving".</item>
    <item>Do not touch font-family/typography configuration (app/layout.tsx's font variables,
      globals.css font tokens) — explicitly out of scope for this ticket per the requester.</item>
  </constraints>

  <out_of_scope>
    <item>Marketing (unauthenticated) Header/Sidebar variant and the `/` page — RIK-13, which depends on
      this ticket's components.</item>
    <item>/biblioteca and /perfil page content — RIK-14 and RIK-15.</item>
    <item>Persisting sidebar collapse state across page reloads (localStorage/cookie) — cheap follow-up,
      not required by the PRD's stated behavior.</item>
    <item>Changing signOut's redirect target from /auth/login to / — flagged as a possible follow-up if
      the PRD's literal wording is confirmed as intentional, not done here.</item>
    <item>Any change to middleware.ts, lib/supabase/proxy.ts, or PROTECTED_PREFIXES — already correctly
      configured.</item>
    <item>Font family / typography — explicitly excluded from this whole gap-analysis pass by the
      requester.</item>
  </out_of_scope>

  <implementation_notes>
    <item>constants/navigation.ts — `export type NavItem = { label: string; href: string; icon:
      import("lucide-react").LucideIcon }`.</item>
    <item>components/layout/SidebarNavItem.tsx — `export function SidebarNavItem({ item, collapsed }: {
      item: NavItem; collapsed: boolean })`.</item>
    <item>components/layout/Sidebar.tsx — `export function Sidebar({ items, mobile, open, onOpenChange }: {
      items: NavItem[]; mobile?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void })` or an
      equivalent split into two small components (e.g. SidebarDesktop / SidebarMobileSheet) sharing
      SidebarNavItem — pick whichever keeps Header a Server Component, since the mobile trigger's open
      state must live in a Client Component.</item>
    <item>components/layout/Header.tsx — `export function Header({ user }: { user: CurrentUser })`.</item>
    <item>components/layout/ThemeToggle.tsx — `"use client"`, `const { resolvedTheme, setTheme } =
      useTheme()`, `setTheme(resolvedTheme === "dark" ? "light" : "dark")`.</item>
    <item>Local initials helper in Header.tsx, mirroring features/title/CastList.tsx's algorithm: split on
      spaces, take up to 2 parts, first letter of each, uppercased, joined; fall back to the first
      character of the email (uppercased) when fullName is null.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases, created and wired end-to-end into
      app/(app)/layout.tsx.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>No test suite exists yet — do not add one.</item>
  </deliverables>

  <clarify_before_coding>
    <item>Whether signOut should redirect to "/" instead of "/auth/login" to match the PRD's literal
      wording. Default if unconfirmed: leave actions/auth/signOut.ts untouched (redirects to
      /auth/login).</item>
    <item>Exact icon choice for "Qué ver este mes" — PRD suggests Home or LayoutDashboard. Default if
      unconfirmed: Home (matches the "landing page after login" framing more directly).</item>
    <item>Whether the sidebar collapse control lives inside the Sidebar itself or in the Header. Default if
      unconfirmed: inside Sidebar, as a small chevron button at its own top/bottom edge, since it is
      Sidebar-local state.</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-9): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-12: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_RIK-12_app_shell_navigation.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion).</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to app_shell_navigation, matching specs/backlog/RIK-12_app_shell_navigation.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-12_app_shell_navigation.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: components / constants / app routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
      <item>Reference the ticket id in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (for example a new feature uses the sparkles emoji, a bugfix the bug emoji, a schema or config change the wrench emoji).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket (Linear, GitHub Issues, etc.). The audience is the ticket author and the product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a "## Screenshots" section since this ticket is fully user-visible UI; a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or type names, no framework or library names. Translate them into product language (say "the navigation menu" instead of naming the component, "the account menu" instead of "DropdownMenu").</item>
      <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots: list 3-4 numbered items, each with screen/area name and what it should show — e.g. "Desktop panel with sidebar expanded", "Desktop sidebar collapsed showing icon-only rail", "Mobile view with the navigation menu open", "Account menu open showing name, profile link, theme toggle, and sign out". Prefix each with `[attach: short label]`.</item>
      <item>Do NOT embed images — attachments are added by the human.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. This ticket is UI-focused: include "## Prerequisites" (dev server running, a logged-in test user; optionally one with no display name set to check the fallback), then "## UI validation" with numbered steps covering: desktop navigation across all six sidebar items and the active-route highlight, sidebar collapse/expand with tooltip check, mobile viewport hamburger-to-Sheet flow, the avatar menu's full content and order, the theme toggle's visual effect and persistence across navigation, and sign-out followed by a direct /panel request confirming the redirect.</item>
      <item>Then "## Expected outcome" (bullets tying back to AC-1 through AC-9).</item>
      <item>Use concrete app paths: /panel, /recomendaciones, /biblioteca, /mis-listas, /suscripciones, /importar.</item>
      <item>No database validation section — this ticket has no schema/data component.</item>
    </deliverable>
  </completion_report>
</task>
```
