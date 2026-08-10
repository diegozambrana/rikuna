# RIK-13 — Inicio (Marketing home)

| Field | Value |
|---|---|
| Ticket | RIK-13 |
| Completed | 2026-08-10 09:10 (local) |
| Log file | `specs/logs/202608100910_RIK-13_marketing_home.md` |
| Backlog spec | `specs/backlog/RIK-13_marketing_home.md` |
| Status | completed |

## Summary

Built the real marketing landing page for `/`, replacing the untouched create-next-app starter. The route now lives in a new `(marketing)` route group, reuses and extends the Header/Sidebar shell built in RIK-12 for their guest variant, and redirects any visitor with an active session straight to `/panel` (both at the middleware layer and as a Server Component backstop).

## Scope delivered

- Middleware: authenticated visitors to `/` are redirected to `/panel`, matching the existing `/auth/login` / `/auth/sign-up` pattern.
- Shared UI: `Header` now accepts `user: CurrentUser | null` and renders a guest variant (two CTA buttons) instead of the avatar/dropdown menu when there is no session; it also now selects the correct mobile nav item set (marketing vs. app) based on session state.
- Constants: new `MARKETING_NAV_ITEMS` mirroring the existing `NavItem` type.
- Features: four new marketing sections (`Hero`, `HowItWorks`, `TrustSection`, `MarketingFooter`) composed on the new `/` page.
- Routing: new `app/(marketing)/layout.tsx` (session guard + Header/Sidebar shell) and `app/(marketing)/page.tsx`; the old `app/page.tsx` starter was deleted.

## Files changed

### Created

- `constants/marketingNavigation.ts` — guest sidebar/mobile-menu nav items (Inicio, Cómo funciona, Iniciar sesión, Crear cuenta), reusing the existing `NavItem` type.
- `features/marketing/Hero.tsx` — name, Quechua meaning, tagline, and the two primary CTAs.
- `features/marketing/HowItWorks.tsx` — 4-step "Cómo funciona" section with icons.
- `features/marketing/TrustSection.tsx` — short paraphrase of the PRD's differentiators.
- `features/marketing/MarketingFooter.tsx` — login/register links only, no legal content.
- `components/layout/MarketingSidebar.tsx` — thin Client Component wrapper around `Sidebar` that supplies `MARKETING_NAV_ITEMS` from within the client bundle (see Decisions).
- `app/(marketing)/layout.tsx` — session guard (`getCurrentUser` + `redirect("/panel")`) and the guest Header/Sidebar shell.
- `app/(marketing)/page.tsx` — composes Hero, HowItWorks, TrustSection, MarketingFooter.
- `specs/logs/202608100910_RIK-13_marketing_home.md` — this file.

### Modified

- `lib/supabase/proxy.ts` — added `"/"` to `AUTH_ONLY_PATHS`, with an exact-match special case for the root path (see Decisions — `startsWith` would otherwise match every route).
- `components/layout/Header.tsx` — widened `user` prop to `CurrentUser | null`, added the guest branch (Crear cuenta / Iniciar sesión buttons), converted to a Client Component (see Decisions), and made the mobile nav trigger pick `MARKETING_NAV_ITEMS` vs. the default `APP_NAV_ITEMS` based on session state.
- `CHANGELOG.md` — added the RIK-13 entry under `[Unreleased] / Added`.

### Deleted

- `app/page.tsx` — replaced by `app/(marketing)/page.tsx`; Next.js cannot resolve `/` from two `page.tsx` files at once.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Logged in via the browser preview, navigated to `http://localhost:3011/`, confirmed `window.location.href` resolved to `/panel` without any marketing content rendering. |
| AC-2 | PASS | Logged out (cleared the Supabase auth cookie) and loaded `/`: page text shows "Rikuna", "Del quechua, \"lo que se debe ver\".", the tagline, and exactly two buttons — "Crear cuenta" (→ `/auth/sign-up`) and "Iniciar sesión" (→ `/auth/login`, clicked and confirmed navigation). |
| AC-3 | PASS | Page text/screenshot show 4 numbered steps, each with a Lucide icon: importar historial de IMDb, indicar servicio activo, recibir lista del mes, descubrir algo nuevo. |
| AC-4 | PASS | "Parte de tu historial real" section renders, explicitly stating recommendations come from the visitor's real IMDb ratings rather than a generic algorithm. |
| AC-5 | PASS | Footer renders exactly two links — "Iniciar sesión" and "Crear cuenta" — no other content. |
| AC-6 | PASS | Guest Header shows no avatar/user menu (CTA buttons instead); guest Sidebar shows exactly 4 items (Inicio, Cómo funciona, Iniciar sesión, Crear cuenta); clicking "Cómo funciona" navigated to `/#como-funciona` (anchor target confirmed present in the DOM). |
| AC-7 | PASS | `ls app/page.tsx` → not found; `ls "app/(marketing)/page.tsx"` → exists; `npm run build` completed successfully with `/` as a single route and no collision error. |

## Decisions

- **`AUTH_ONLY_PATHS` root-path matching**: the existing check used `pathname.startsWith(path)`. Adding `"/"` verbatim would have matched every route (since every pathname starts with `/`), redirecting authenticated users away from the entire authenticated app, not just `/`. Special-cased `"/"` to use exact equality (`pathname === "/"`) while leaving the existing prefix-match behavior for `/auth/login` and `/auth/sign-up` untouched.
- **Header converted to a Client Component**: passing `NavItem[]` (which embeds Lucide icon *component references*) as a prop from a Server Component (`Header`, `app/(marketing)/layout.tsx`) into a Client Component (`MobileNavTrigger`, `Sidebar`) throws at runtime — React Server Components cannot serialize function/component values across that boundary ("Only plain objects can be passed to Client Components from Server Components"). This was only discoverable by actually running the guest page in the browser, which surfaced a hard 500 error. Fixed by marking `Header` `"use client"` (it was already purely presentational, and the `signOut` server action it references remains fully usable from a client component via a form action), so it can import `MARKETING_NAV_ITEMS` directly within the client bundle instead of receiving it as a prop from a server boundary.
- **New `MarketingSidebar` wrapper instead of `<Sidebar items={MARKETING_NAV_ITEMS} />` directly in the Server Component layout**: same root cause as above — `app/(marketing)/layout.tsx` must stay a Server Component (it calls `getCurrentUser()`/`redirect`), so it cannot safely pass the icon-bearing `MARKETING_NAV_ITEMS` array into `Sidebar` (a Client Component) itself. Added a one-line `"use client"` wrapper that imports the constant internally and renders `<Sidebar items={MARKETING_NAV_ITEMS} />` with zero props crossing the server/client boundary. `Sidebar.tsx`'s own internals were not touched, matching the ticket's out-of-scope constraint.
- **Icon choices**: used the defaults suggested by the ticket (Home / HelpCircle for the guest sidebar) and picked Upload / Tv / ListChecks / Sparkles for the 4 "Cómo funciona" steps, reusing the same icons already associated with those concepts elsewhere in the app (Importar, Suscripciones, Recomendaciones) for visual consistency.
- **4 steps for "Cómo funciona"**: shipped with 4 (PRD said "3-4"), matching its own example enumeration.
- **Button variants**: "Crear cuenta" uses the default (primary) variant, "Iniciar sesión" uses `outline`, in both the Header and the Hero, consistent with existing CTA/secondary button usage elsewhere in the codebase.

## Deferred / follow-ups

- None identified — all requirements and acceptance criteria for this ticket are complete.

## Verification

- `npm run lint` — passed, no issues.
- `npm run build` — passed; `/` resolves to a single route, no route-collision error.
- Manual browser verification (see Acceptance criteria evidence above): guest `/` render, authenticated `/` → `/panel` redirect, Hero/Sidebar CTA navigation, anchor scroll link.

## Manual validation

### Prerequisites

- Dev server running (`npm run dev`).
- One account to log in with (existing Rikuna credentials).
- A logged-out browser session (or clear cookies) to view the guest homepage.

### UI validation

1. Log out (or use a fresh/incognito session) and visit `/`.
2. Confirm the Hero section shows "Rikuna", its Quechua meaning, the one-line value proposition, and two buttons: "Crear cuenta" and "Iniciar sesión".
3. Confirm the "Cómo funciona" section shows 4 steps, each with an icon: importar historial de IMDb, indicar servicio activo, recibir lista del mes, descubrir algo nuevo.
4. Confirm the trust section mentions that recommendations come from the visitor's real IMDb ratings, not a generic algorithm.
5. Confirm the footer shows only two links: "Iniciar sesión" and "Crear cuenta".
6. Click the Hero's "Crear cuenta" button — confirm it navigates to `/auth/sign-up`.
7. Go back to `/`, click the Hero's "Iniciar sesión" button — confirm it navigates to `/auth/login`.
8. Go back to `/`, confirm the guest Sidebar shows exactly four items: Inicio, Cómo funciona, Iniciar sesión, Crear cuenta.
9. Click "Cómo funciona" in the sidebar — confirm it scrolls to the how-it-works section (URL becomes `/#como-funciona`).
10. Click "Iniciar sesión" and "Crear cuenta" in the guest sidebar — confirm they navigate to `/auth/login` and `/auth/sign-up` respectively.
11. Log in with a valid account, then navigate directly to `/` — confirm you're redirected straight to `/panel` without seeing any marketing content.

### Expected outcome

- AC-1: authenticated visit to `/` redirects to `/panel`.
- AC-2: guest Hero shows name, Quechua meaning, tagline, and both CTAs, each navigating correctly.
- AC-3: "Cómo funciona" shows 4 steps with icons covering import → declare service → monthly list → discover.
- AC-4: trust section present, states recommendations come from real IMDb history.
- AC-5: footer has only login/register links, nothing else.
- AC-6: guest Header has no avatar/user menu; guest Sidebar has exactly 4 items; anchor and auth links work.
- AC-7: exactly one `page.tsx` resolves to `/`; `npm run build` succeeds.
