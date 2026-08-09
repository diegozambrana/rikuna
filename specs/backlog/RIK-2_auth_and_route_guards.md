# RIK-2 — Autenticación y estructura de rutas

## Ticket summary

Rikuna needs a working sign-up/login/logout/password-recovery flow on Supabase Auth, plus the three route groups (`(auth)`, `(app)`, `(public)`) and the session guard that makes `(app)` private while leaving `(public)` open — this is the ticket that turns the bare Create Next App scaffold into an app real users can actually enter. It depends on RIK-1 (DB schema + RLS) only for `auth.users` and the RLS-protected personal tables existing; it does not touch any migration itself.

- A user can register, log in, log out, and recover/update their password by email.
- Any route under `(app)` redirects to `/auth/login` when there is no session.
- Routes under `(public)` are reachable without a session and are never touched by the `(app)` guard (the group and its guard support must exist now even though RIK-11 builds the real public pages later).
- A user who is already authenticated and visits `/auth/login` or `/auth/sign-up` is redirected to `/panel`.
- Invalid credentials show a clear inline error — never a silent failure.
- No team comments exist beyond the ticket paste — the description and acceptance criteria below are the full scope.
- **Investigation surfaced one framework-level correction that changes how this ticket must be built**: this project runs Next.js 16, which deprecated and renamed the root `middleware.ts` file convention to `proxy.ts` (exported function `proxy`, not `middleware`). The ticket text and `ARCHITECTURE.md` both still say `middleware.ts` — that name must not be used. See discrepancies table below.

---

## Context

### Original ticket

**Descripción:** Implementar login, registro, recuperación y actualización de contraseña (`/auth/login`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password`) con Supabase Auth (`@supabase/ssr`), y establecer los tres route groups (`(auth)`, `(app)`, `(public)`) con el guard de sesión en `middleware.ts` / `lib/supabase/proxy.ts`, tal como describe `ARCHITECTURE.md`.

**Criterios de aceptación:**

- [ ] Un usuario puede registrarse, iniciar sesión, cerrar sesión, y recuperar/actualizar su contraseña por correo.
- [ ] Cualquier ruta bajo `(app)` redirige a `/auth/login` si no hay sesión.
- [ ] Las rutas bajo `(public)` (lista pública, ficha de título pública — implementadas en un ticket posterior, RIK-11, pero el route group y el middleware deben soportarlas desde ya) son accesibles sin sesión y no son interceptadas por el guard de `(app)`.
- [ ] Un usuario ya autenticado que visita `/auth/login` o `/auth/sign-up` es redirigido a `/panel`.
- [ ] Credenciales inválidas muestran un error claro en el formulario (no un fallo silencioso).

This ticket depends on RIK-1 (schema + RLS). No other blocking dependency.

### Team comments

None. This is the tracker's paste verbatim, with one clarifying note from the task brief: `ARCHITECTURE.md` already documents the module responsibilities (`lib/supabase/server.ts`, `client.ts`, `admin.ts`, `proxy.ts`), the note that `admin.ts` must **not** be wired into this ticket's auth actions, that `app/layout.tsx` needs `ThemeProvider`/`Toaster` added (first ticket touching the root layout), and that `(app)`'s own layout does the `AuthCheck`/redirect/`UserProvider` wrapping — but building `/panel` itself is RIK-7's job; a minimal placeholder page is enough here to prove the guard works. All of this is treated as part of the ticket's real scope, not a separate comment thread.

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |
| Session guard goes in `middleware.ts` (ticket text and `ARCHITECTURE.md` §Routing both say this) | Next.js 16 (installed: `next@16.3.0`) **deprecated the `middleware.ts` file convention and renamed it to `proxy.ts`** at the project root, with the exported function renamed `middleware` → `proxy` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, `middleware.md`). `AGENTS.md` explicitly warns to check `node_modules/next/dist/docs/` before writing code because "APIs, conventions, and file structure may all differ from your training data." | Must create `proxy.ts` at the repo root (not `middleware.ts`), exporting `proxy(request)` (or a default export) plus a `matcher` config. This is unrelated to — and must not be confused with — `lib/supabase/proxy.ts`, a different file at a different path that only exports the `updateSession()` helper the root `proxy.ts` calls. |
| `ARCHITECTURE.md` lists `/titulo/[slug]` only under the authenticated **App** zone routing table | `RIKUNA-PRD-vistas-y-estilo-rikuna.md` §2 ("Público") lists the **same URL** `/titulo/[slug]` again as "variante de solo lectura sin acciones personales" — i.e. one shared route, not two, branching on session inside the page (`ARCHITECTURE.md` §Features confirms: `title` feature is "shared between authenticated and public variants, with an `isPublicView` flag"). | The `(app)` guard must **not** blanket-protect everything outside `(auth)`/`(public)`, or it would force a login redirect on `/titulo/[slug]` for anonymous visitors, breaking the public title-page requirement (built later in RIK-9). The guard needs an explicit allowlist of protected path prefixes rather than a default-deny-except-public rule. See Decisions made #2. |
| Ticket implies `supabase/` already has structure to plug `middleware`/`proxy.ts` into | `supabase/` does not exist at all yet (confirmed: no directory). It is created by RIK-1, a dependency of this ticket, and RIK-1's own backlog spec notes it may create `supabase/config.toml` "si no está ya scaffolded." | If this ticket runs before RIK-1 lands, `supabase/config.toml` / `supabase/templates/` won't exist; auth email template link customization (see Decisions made #7) must be a TODO in that case, not a hard requirement. |
| `ARCHITECTURE.md` says the `(app)` layout "wraps children in `UserProvider`" backed by `stores/UserStore.ts` (Zustand) | `package.json` has no `zustand` dependency, and the task brief explicitly scopes this ticket to installing only `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, and `sonner` — "this is the first ticket that needs" those four, implying `zustand` is intentionally not part of this ticket. | `UserProvider` is implemented with React Context in this ticket, not Zustand. `stores/UserStore.ts` is deferred to whichever future ticket first needs reactive client-side user-state mutation. See Decisions made #4. |
| `components.json` / `ARCHITECTURE.md` reference shadcn/ui "Lyra" style | `components.json` actually has `"style": "base-lyra"` (Base UI variant — per `.agents/skills/migrate-radix-to-base/`, this project already migrated off Radix) and only `components/ui/button.tsx` exists | Auth forms need `Input`, `Label`, `Card`, `Alert` primitives added via `shadcn` CLI (already a dependency, v4.16.2) using the `base-lyra` registry before building screens — not assumed to already exist. |

### Current database state

Not directly touched by this ticket (no migration created here). For context: `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` shows every personal table (`user_subscriptions`, `user_media_status`, `user_lists`, `imdb_import_batches`) with `user_id uuid not null references auth.users(id) on delete cascade` (lines 195, 228, 270, 300) — `auth.users` is Supabase Auth's own managed table, unaffected by whether RIK-1's migrations have landed yet. There is **no `profiles` (or similar) table** anywhere in the schema doc — nothing to join against for a display name.

`supabase/migrations/` does not exist in this repo yet (RIK-1 dependency). If it exists by the time this ticket runs, skim the latest file only to confirm nothing changed about `auth.users`/RLS assumptions above — this ticket adds no migration of its own.

### Current logic (routing / auth)

Nothing exists yet: no `middleware.ts`/`proxy.ts`, no `lib/supabase/`, no `app/auth/*`, no route groups. `app/layout.tsx` is still the Create Next App default plus project font setup — English metadata ("Create Next App"), no `ThemeProvider`, no `Toaster`:

```12:32:app/layout.tsx
export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, robotoSlabHeading.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

`app/globals.css` already has the `base-lyra`/`mist` design tokens (light + `.dark` variants) wired via `@theme inline`, so dark-mode CSS is ready — only `ThemeProvider` wiring (`next-themes`, `class` attribute, `defaultTheme="dark"`) is missing.

### Requested field mapping

| Field requested | Type | Existing equivalent | Action |
| --- | --- | --- | --- |
| `correo` / `contraseña` (login, sign-up) | Supabase Auth built-in | `auth.users.email` / `auth.users.encrypted_password`, managed entirely by Supabase Auth | Already exists (reuse) — call `supabase.auth.signInWithPassword` / `signUp` |
| `nombre` (sign-up form field, per `RIKUNA-PRD-vistas-y-estilo-rikuna.md` §2.1) | text | None — no `profiles` table in the RIK-1 schema doc | Must be created, but **not** as a DB column: store as Supabase Auth `user_metadata.full_name` via `signUp({ options: { data: { full_name } } })` |
| Session used by the `(app)` guard | n/a | None yet | Must be created — new `getCurrentUser()` helper in `lib/supabase/server.ts` wrapping `supabase.auth.getUser()` |
| `user_id` FK on personal tables | uuid → `auth.users(id)` | Already defined in the schema doc (RIK-1's concern, not this ticket's) | Already exists (reuse) — no change needed here |

### Impacted files

**Config / dependencies**
- `package.json` (modified) — add `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, `sonner`. Do not add `zustand`, `react-hook-form`, `@tanstack/react-table` (out of scope, see Decisions made #4/#5).
- `.env.example` (created) — placeholders for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. No real `.env*` file is created or committed.

**`lib/supabase/`**
- `lib/supabase/server.ts` (created) — `createClient()` via `createServerClient` bound to `await cookies()` (Next.js 15+/16 `cookies()` is async); `getCurrentUser()` helper.
- `lib/supabase/client.ts` (created) — `createClient()` via `createBrowserClient`.
- `lib/supabase/admin.ts` (created) — service-role client, `import 'server-only'`, reserved for `ingestion/`. Created for the module boundary to exist, but not imported anywhere in this ticket.
- `lib/supabase/proxy.ts` (created) — `updateSession(request)`: refreshes the auth cookie, applies the protected-prefix redirect and the authenticated-visiting-`/auth/*` redirect.

**Root proxy (Next.js 16 convention)**
- `proxy.ts` (created, repo root — **not** `middleware.ts`) — imports `updateSession`, exports `proxy(request)` + `matcher` config excluding static assets.

**Server Actions**
- `actions/auth/types.ts` (created) — `AuthActionState` shape for `useActionState`.
- `actions/auth/signIn.ts`, `signUp.ts`, `signOut.ts`, `forgotPassword.ts`, `updatePassword.ts` (created).
- `actions/auth/index.ts` (created) — barrel export, per `ARCHITECTURE.md`'s `actions/` convention.

**Routes**
- `app/(auth)/layout.tsx` (created) — redirects to `/panel` if a session already exists; minimal centered shell.
- `app/(auth)/auth/login/page.tsx`, `sign-up/page.tsx`, `forgot-password/page.tsx`, `update-password/page.tsx` (created).
- `app/(auth)/auth/confirm/route.ts` (created) — `token_hash` + `type` OTP verification (signup confirmation, password recovery links).
- `app/(auth)/auth/callback/route.ts` (created) — `code` exchange (PKCE), for parity with `ARCHITECTURE.md`'s explicit mention even though no OAuth provider is configured yet.
- `app/(app)/layout.tsx` (created) — `AuthCheck` (redirect to `/auth/login?next=...` if no session), loads `getCurrentUser()`, wraps children in `UserProvider`.
- `app/(app)/panel/page.tsx` (created) — minimal placeholder ("Panel — próximamente", real build is RIK-7) proving the guard works.
- `app/(public)/layout.tsx` (created) — minimal shell (logo + login/sign-up links only, per `ARCHITECTURE.md` §Shared UI).
- `app/(public)/l/[codigo]/page.tsx` (created) — minimal placeholder so AC-3 is verifiable end-to-end now; RIK-11 replaces its content.
- `app/layout.tsx` (modified) — add `ThemeProvider` (`next-themes`, dark default) and `Toaster` (`sonner`); update `metadata` to Spanish/Rikuna copy.

**Shared UI / state**
- `components/providers/UserProvider.tsx` (created) — React Context (not Zustand — see Decisions made #4).
- `hooks/useSession.ts` (created) — reads the `UserProvider` context.
- `components/ui/input.tsx`, `label.tsx`, `card.tsx`, `alert.tsx` (created via `shadcn` CLI, `base-lyra` style, matching `components.json`).

**Supabase project config**
- `supabase/config.toml` / `supabase/templates/*.html` (modified if present, else TODO) — point the recovery/confirmation email links at `/auth/confirm`.

**Docs**
- `CHANGELOG.md` (modified) — one bullet under `[Unreleased] / Added`.
- `specs/logs/<timestamp>_RIK-2_auth_and_route_guards.md` (created) — work log.

**Explicitly not touched:** no file named `middleware.ts` anywhere; no `supabase/migrations/*` file; no `stores/UserStore.ts`; no `types/index.ts` additions (nothing here maps to a schema doc entity).

### Decisions made

1. **Root proxy file follows the Next.js 16 convention: `proxy.ts` at the repo root, not `middleware.ts`**, exporting `proxy(request)`. This corrects both the ticket text and `ARCHITECTURE.md`, which predate this framework change. Recommended default, not confirmed by a human.
2. **The `(app)` guard in `lib/supabase/proxy.ts` uses an explicit allowlist of protected path prefixes** (`/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`) rather than "protect everything except `(auth)`/`(public)`." Rationale: `/titulo/[slug]` is dual-purpose (see discrepancies table) and must never be forced through the login redirect — its own optional-session handling arrives with RIK-9. Recommended default.
3. **Sign-up's "nombre" field is stored as Supabase Auth `user_metadata.full_name`**, not a new DB column/table — no `profiles` table exists in the RIK-1 schema doc and creating one is out of scope for an auth-routing ticket. Recommended default.
4. **`UserProvider` uses React Context, not Zustand.** `zustand` is not an installed dependency, and the task brief scopes this ticket's new dependencies to `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, `sonner` only. `stores/UserStore.ts` is deferred to the first ticket that actually needs reactive client-side mutation of user state (likely RIK-7 or later). Recommended default.
5. **Auth forms use native `<form>` + Server Actions with React 19's `useActionState`**, not `react-hook-form`. `react-hook-form` is listed in `ARCHITECTURE.md` for schema-driven/tabular forms and isn't installed yet; a 2–4 field auth form doesn't need it, and pulling it in here would front-load a dependency this ticket doesn't otherwise require. Recommended default.
6. **One placeholder page is added under `(public)`** (`app/(public)/l/[codigo]/page.tsx`) purely so AC-3 (pass-through, no redirect) is verifiable end-to-end in this ticket, mirroring the placeholder already sanctioned for `(app)/panel`. RIK-11 replaces its content; this ticket must not build real public-list logic. Recommended default.
7. **`/auth/confirm/route.ts` (token_hash + type) is the primary flow; `/auth/callback/route.ts` (code exchange) is built for parity with `ARCHITECTURE.md`**, even with no OAuth provider configured yet — cheap to add, keeps the module boundary `ARCHITECTURE.md` documents intact for whenever OAuth or magic links are added. Recommended default.
8. **Supabase Auth email template link targets are updated only if `supabase/config.toml` already exists** (i.e. RIK-1 landed first); otherwise the implementer leaves a `TODO` comment in `auth/confirm/route.ts` rather than scaffolding Supabase project config that isn't clearly this ticket's to own. Recommended default.
9. **No `.env.local`/`.env` file is created or committed** — only `.env.example` with placeholder values, consistent with the safety rule against downloading/committing secrets. Non-negotiable, not really a "decision" so much as a hard constraint.

### Out of scope

- Building `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`, `/titulo/[slug]` for real — later tickets (RIK-6 through RIK-10), this ticket only needs the guard to work and a placeholder to prove it.
- `stores/UserStore.ts` (Zustand) and `hooks/useActiveSubscription` — deferred, see Decisions made #4.
- OAuth / social login providers — not requested, no provider configured in this project yet.
- Full `Header`/`Nav` authenticated shell (`components/layout/`) — RIK-7 builds the real navigation; `(app)/panel` placeholder needs nothing more than a logout control to prove AC-1.
- Email template visual design/wording — only the redirect link target matters for this ticket's flow to function; cosmetic template content is not in scope.
- Rate limiting / CAPTCHA / bot protection on auth forms — not requested by the ticket or the PRD.
- A `profiles` (or similar) database table — see Decisions made #3.

---

## Implementation plan

**Goal:** Wire Supabase Auth end-to-end (sign up, log in, log out, recover/update password) and make the three route groups real, so `(app)` is provably private, `(public)` is provably open, and every later ticket has a working session to build against.

**In scope**
1. Add `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, `sonner` to `package.json`; create `.env.example`.
2. Build `lib/supabase/server.ts`, `client.ts`, `admin.ts` (client factories) and `lib/supabase/proxy.ts` (`updateSession()` with the protected-prefix allowlist).
3. Create the root `proxy.ts` (Next.js 16 convention — **not** `middleware.ts`) calling `updateSession()`.
4. Build `actions/auth/` (signIn, signUp, signOut, forgotPassword, updatePassword) as `useActionState`-compatible Server Actions.
5. Build `app/(auth)/*` screens and `auth/confirm` + `auth/callback` route handlers; `app/(auth)/layout.tsx` redirects an already-authenticated visitor to `/panel`.
6. Build `app/(app)/layout.tsx` (`AuthCheck` + `UserProvider`) and a minimal `app/(app)/panel/page.tsx` placeholder.
7. Build `app/(public)/layout.tsx` and one placeholder page (`/l/[codigo]`) to make the pass-through provable.
8. Update root `app/layout.tsx` with `ThemeProvider` (dark default) and `Toaster`; fix metadata to Rikuna/Spanish.
9. Add `Input`/`Label`/`Card`/`Alert` shadcn primitives; build `UserProvider` (Context) and `useSession` hook.

**Out of scope:** real `/panel`/`/biblioteca`/etc. screens, Zustand `UserStore`, OAuth, Header/Nav shell, email template design, CAPTCHA — see Out of scope above for reasoning.

**Key risks / compatibility**
- Getting the `(app)` protected-prefix list wrong is the single highest-risk item: too broad silently blocks `/titulo/[slug]`'s future public variant; too narrow leaves a personal route unprotected. Constraints below name the exact list.
- `middleware.ts` vs `proxy.ts` is an easy mistake for an agent trained on pre-16 Next.js — called out explicitly in constraints and mandatory reading.
- `cookies()` must be awaited (Next.js 15+/16) inside `lib/supabase/server.ts`, or the Supabase server client silently gets a stale/empty cookie jar.

**Acceptance criteria mapping**

| AC | Satisfied by |
| --- | --- |
| AC-1 | `actions/auth/*` + `app/(auth)/auth/*` pages cover sign up, log in, log out, forgot/update password, all backed by real Supabase Auth calls |
| AC-2 | `lib/supabase/proxy.ts` protected-prefix check redirects to `/auth/login?next=...` |
| AC-3 | `(public)` route group + placeholder page reachable without a session, `updateSession()` never applies the protected-prefix check outside the allowlist |
| AC-4 | `app/(auth)/layout.tsx` checks session and redirects to `/panel` |
| AC-5 | `useActionState` error branch renders a shadcn `Alert` with the Supabase Auth error message |
| AC-6 (derived) | Root file is `proxy.ts`, not `middleware.ts` — verified by file listing |
| AC-7 (derived) | `/titulo` is absent from `PROTECTED_PREFIXES` — verified by reading `lib/supabase/proxy.ts` |

---

## Claude Code prompt

```xml
<task id="RIK-2" title="Autenticación y estructura de rutas" depends_on="RIK-1">
  <role>
    You are a senior full-stack engineer working on Rikuna, a Next.js 16 (App Router) + React 19 + TypeScript +
    Supabase project. You write English code, comments and identifiers; user-visible copy is Spanish.
  </role>

  <mandatory_reading>
    <item>ARCHITECTURE.md — read in full before writing anything. Sections "Routing (app/)" and "Supabase integration (lib/supabase/)" define this ticket's module boundaries exactly.</item>
    <item>AGENTS.md — this project's Next.js version may differ from your training data; it explicitly instructs reading node_modules/next/dist/docs/ before coding.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md — CRITICAL: Next.js 16 deprecated and renamed the root `middleware.ts` file convention to `proxy.ts`, and the exported function from `middleware` to `proxy`. Do not create `middleware.ts`.</item>
    <item>node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md — `cookies()` from `next/headers` is async in this Next.js version; every call site in `lib/supabase/server.ts` must `await cookies()`.</item>
    <item>.cursor/commands/makecommit.md — commit message format and emoji mapping for the commit_message deliverable below.</item>
    <item>specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md — Section 2 ("Mapa de vistas") for the Auth screens' exact content/fields and the Público-zone note that `/titulo/[slug]` is a read-only variant of the same URL, not a separate route.</item>
    <item>specs/RIKUNA-PRD-schema-basedatos-rikuna.md — Section 9 (RLS) and Section 10 (relationship map) to confirm every personal table's `user_id` references `auth.users(id)`; you are not creating or altering any of these tables.</item>
    <item>specs/RIKUNA-PRD-documento-especificacion-rikuna.md — line mentioning "correo transaccional: confirmación de cuenta y recuperación de contraseña" as the product requirement behind the confirm/recovery email flow.</item>
    <item>app/layout.tsx, app/globals.css, lib/utils.ts, components.json, package.json, components/ui/button.tsx — read these real files before touching them; globals.css already has base-lyra/mist dark-mode tokens wired, only ThemeProvider plumbing is missing.</item>
    <item>supabase/migrations/ — if this directory exists (RIK-1 landed), skim the latest file only to reconfirm auth.users/RLS assumptions above; you are not adding a migration.</item>
    <item>CHANGELOG.md — read the [Unreleased] section format before appending.</item>
    <item>specs/logs/README.md — work log template and filename convention.</item>
  </mandatory_reading>

  <context>
    Rikuna is pre-launch, freshly scaffolded (Create Next App base), no production data. This ticket depends on
    RIK-1 only for `auth.users` (Supabase Auth's own managed table) and the RLS-protected personal tables existing —
    it adds no migration itself. Nothing under lib/, actions/, app/auth, or route groups exists yet; only
    app/layout.tsx, app/page.tsx, app/globals.css, lib/utils.ts, and components/ui/button.tsx exist so far.
    package.json currently has none of @supabase/ssr, @supabase/supabase-js, next-themes, or sonner — install
    exactly these four for this ticket. Do NOT install zustand, react-hook-form, or @tanstack/react-table; they
    belong to later tickets per ARCHITECTURE.md and are out of scope here.
  </context>

  <ground_truth_db_notes critical="true">
    <note>Next.js 16 renamed the root `middleware.ts` file convention to `proxy.ts`, and the exported function from `middleware` to `proxy`. Create `proxy.ts` at the repository root (same level as `app/`), exporting `proxy(request: NextRequest)` (or a default export) plus an exported `config` object with a `matcher`. Never create a file named `middleware.ts`.</note>
    <note>`lib/supabase/proxy.ts` is a DIFFERENT file at a different path — it only exports the `updateSession(request)` helper that the root `proxy.ts` imports and calls. Do not merge these two files or put Next.js's `proxy`/`config` exports inside `lib/supabase/proxy.ts`.</note>
    <note>`cookies()` from `next/headers` is async in this Next.js version. Every usage inside `lib/supabase/server.ts` (and anywhere else you read/write cookies server-side) must `await cookies()` before calling any method on the result.</note>
    <note>There is no `profiles` (or similarly named) table anywhere in the RIK-1 schema. Do not create one. The sign-up form's "nombre" field is stored via `supabase.auth.signUp({ options: { data: { full_name } } })` (Supabase Auth `user_metadata`), never as a new column or table.</note>
    <note>`/titulo/[slug]` appears in BOTH the authenticated App zone (ARCHITECTURE.md routing table) and the Público zone (RIKUNA-PRD-vistas-y-estilo-rikuna.md §2) as the SAME URL — it is one shared route with an `isPublicView` flag (built later in RIK-9), not two separate pages. The `(app)` guard's protected-prefix allowlist below must never include `/titulo` — this is intentional, not an omission.</note>
    <note>Every personal table (`user_subscriptions`, `user_media_status`, `user_lists`, `imdb_import_batches`) references `auth.users(id)` via `user_id`. `auth.users` is managed entirely by Supabase Auth — you never write to it directly; `supabase.auth.signUp`/`signInWithPassword`/`signOut`/`resetPasswordForEmail`/`updateUser` are the only entry points.</note>
    <note>`lib/supabase/admin.ts` (service-role client) must be created for the module boundary ARCHITECTURE.md documents, but must NOT be imported by anything in `actions/auth/` or any client bundle in this ticket — it is reserved exclusively for `ingestion/`.</note>
    <note>`components.json` has `"style": "base-lyra"` (Base UI, not Radix) and `"baseColor": "mist"`. Only `components/ui/button.tsx` exists under `components/ui/` today — add `input`, `label`, `card`, `alert` via the `shadcn` CLI (already a dependency) before building the auth screens; do not hand-write shadcn primitives from scratch.</note>
  </ground_truth_db_notes>

  <story>
    As a Rikuna user, I want to create an account, log in, log out, and recover a forgotten password by email, so
    that I can access my private planner data — and I want the parts of the app that require no account (shared
    lists, later) to stay reachable without being forced through a login wall.
  </story>

  <requirements>
    <phase title="1. Dependencies and env">
      <item>Add `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, `sonner` to `package.json` (dependencies) and install them.</item>
      <item>Create `.env.example` at the repo root with placeholder values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Do not create or commit a real `.env`/`.env.local` file.</item>
    </phase>

    <phase title="2. Supabase client layer (lib/supabase/)">
      <item>`lib/supabase/server.ts`: export `async function createClient()` using `createServerClient` from `@supabase/ssr`, bound to `await cookies()` from `next/headers` (getAll/setAll cookie methods per the `@supabase/ssr` Next.js App Router recipe). Export `async function getCurrentUser()` that calls `supabase.auth.getUser()` and returns `{ id, email, fullName } | null` (fullName from `user_metadata.full_name`).</item>
      <item>`lib/supabase/client.ts`: export `function createClient()` using `createBrowserClient` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`.</item>
      <item>`lib/supabase/admin.ts`: export `function createAdminClient()` using `createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`. Start the file with `import "server-only"`. Add a comment stating it is reserved for `ingestion/` and must never be imported from `actions/` or client code.</item>
      <item>`lib/supabase/proxy.ts`: export `async function updateSession(request: NextRequest): Promise<NextResponse>`. It must: (1) create a Supabase server client bound to the request/response cookies per the `@supabase/ssr` proxy recipe, (2) call `supabase.auth.getUser()` to refresh the session cookie, (3) define `const PROTECTED_PREFIXES = ["/panel", "/biblioteca", "/mis-listas", "/suscripciones", "/importar", "/perfil"]` and redirect to `/auth/login?next=<pathname>` when the request path starts with one of these and there is no user, (4) redirect an authenticated user visiting `/auth/login` or `/auth/sign-up` to `/panel`, (5) otherwise return the refreshed response unchanged. `/titulo` must NOT be in `PROTECTED_PREFIXES` (see ground_truth note).</item>
    </phase>

    <phase title="3. Root proxy.ts (Next.js 16 convention)">
      <item>Create `proxy.ts` at the repository root importing `updateSession` from `@/lib/supabase/proxy` and exporting `export function proxy(request: NextRequest) { return updateSession(request); }`.</item>
      <item>Export a `config` object with a `matcher` excluding `_next/static`, `_next/image`, and common static file extensions, e.g. `matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]`.</item>
    </phase>

    <phase title="4. Auth Server Actions (actions/auth/)">
      <item>`actions/auth/types.ts`: `export type AuthActionState = { status: "idle" | "error" | "success"; message?: string }`.</item>
      <item>`actions/auth/signIn.ts`: `signIn(prevState: AuthActionState, formData: FormData): Promise<AuthActionState>` — calls `supabase.auth.signInWithPassword`; on error return `{ status: "error", message }` (never throw, never silently no-op — this is what satisfies AC-5); on success `redirect("/panel")`.</item>
      <item>`actions/auth/signUp.ts`: same shape, calls `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: <origin>/auth/confirm } })`.</item>
      <item>`actions/auth/signOut.ts`: calls `supabase.auth.signOut()`, then `redirect("/auth/login")`.</item>
      <item>`actions/auth/forgotPassword.ts`: calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/confirm?type=recovery })`; always return a success-shaped state regardless of whether the email exists (standard practice — do not leak account existence).</item>
      <item>`actions/auth/updatePassword.ts`: calls `supabase.auth.updateUser({ password })` (requires the recovery session set by `auth/confirm`); on success `redirect("/panel")`.</item>
      <item>`actions/auth/index.ts`: barrel re-exporting all of the above, per ARCHITECTURE.md's `actions/` convention.</item>
    </phase>

    <phase title="5. (auth) route group">
      <item>`app/(auth)/layout.tsx`: server component; calls `getCurrentUser()`; if a user exists, `redirect("/panel")` (this satisfies the ticket's "already authenticated visiting /auth/login or /auth/sign-up" AC for every page in this group, since it wraps all of them). Minimal centered shell — logo/name only, no nav.</item>
      <item>`app/(auth)/auth/login/page.tsx`: client component form (email, password) using `useActionState(signIn, { status: "idle" })`; on `status === "error"` render a shadcn `Alert` (destructive variant) with `message`. Links to `/auth/sign-up` and `/auth/forgot-password`.</item>
      <item>`app/(auth)/auth/sign-up/page.tsx`: form (nombre, correo, contraseña, confirmación) using `useActionState(signUp, ...)`; inline validation that password === confirmation before submit; same error-alert pattern on failure.</item>
      <item>`app/(auth)/auth/forgot-password/page.tsx`: single-field (correo) form using `useActionState(forgotPassword, ...)`; on success show a confirmation message ("revisa tu correo"), not a redirect.</item>
      <item>`app/(auth)/auth/update-password/page.tsx`: two-field (nueva contraseña, confirmación) form using `useActionState(updatePassword, ...)`.</item>
      <item>`app/(auth)/auth/confirm/route.ts`: `GET` route handler reading `token_hash` and `type` from the URL, calling `supabase.auth.verifyOtp({ type, token_hash })`, then redirecting to `/auth/update-password` when `type === "recovery"` or to `/panel` otherwise; redirect to `/auth/login?error=...` on verification failure.</item>
      <item>`app/(auth)/auth/callback/route.ts`: `GET` route handler reading `code` from the URL, calling `supabase.auth.exchangeCodeForSession(code)`, redirecting to `/panel` on success or `/auth/login?error=...` on failure.</item>
    </phase>

    <phase title="6. (app) route group">
      <item>`app/(app)/layout.tsx`: server component; calls `getCurrentUser()`; if no user, `redirect("/auth/login?next=" + encodeURIComponent(currentPath))` (this is the AuthCheck ARCHITECTURE.md describes — belt-and-suspenders with the proxy-level check, since Server Functions bypass proxy matchers per the Next.js docs' own warning). Wrap children in `<UserProvider user={user}>`.</item>
      <item>`app/(app)/panel/page.tsx`: minimal placeholder — "Panel — próximamente" heading, current user's email, and a form calling `signOut` with a submit button labeled "Cerrar sesión". This is explicitly NOT the real panel (RIK-7); it exists only to prove the guard and logout work end-to-end.</item>
    </phase>

    <phase title="7. (public) route group">
      <item>`app/(public)/layout.tsx`: minimal shell per ARCHITECTURE.md §Shared UI — logo with link to `/auth/login`, no nav, no session check.</item>
      <item>`app/(public)/l/[codigo]/page.tsx`: placeholder page rendering the `codigo` param and "Lista pública — próximamente" — no data fetching, no auth check. Exists solely to make AC-3 verifiable now; RIK-11 replaces this file's contents.</item>
    </phase>

    <phase title="8. Root layout, theme, toasts, UI primitives">
      <item>Add `input`, `label`, `card`, `alert` to `components/ui/` via the `shadcn` CLI using this project's `base-lyra` registry/style (do not hand-author them).</item>
      <item>`components/providers/UserProvider.tsx`: React Context provider taking a `user` prop (the shape returned by `getCurrentUser()`), exposing it via a `useUserContext` hook.</item>
      <item>`hooks/useSession.ts`: thin wrapper calling `useUserContext()` from `UserProvider`, returning `{ user, isAuthenticated }`.</item>
      <item>Update `app/layout.tsx`: wrap `{children}` in `next-themes`' `ThemeProvider` (`attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}` — dark default per ARCHITECTURE.md) and render `<Toaster />` from `sonner`. Update `metadata` to Spanish/Rikuna copy (title "Rikuna", a short Spanish description) instead of the Create Next App default.</item>
    </phase>

    <phase title="9. Supabase email templates (best-effort)">
      <item>If `supabase/config.toml` already exists (RIK-1 landed), update the recovery and confirmation email template link targets to point at `/auth/confirm` with the appropriate `type`/`token_hash` params, per the Supabase `@supabase/ssr` recipe. If it does not exist yet, add a `// TODO(RIK-2):` comment inside `app/(auth)/auth/confirm/route.ts` documenting that the Supabase project's email templates still need this link-target change (via Dashboard or `supabase/config.toml` once scaffolded) — do not scaffold `supabase/` yourself in this ticket.</item>
    </phase>
  </requirements>

  <acceptance_criteria>
    <criterion id="AC-1">A user can sign up, log in, log out, and recover/update a password by email. Verify manually with `npm run dev`: sign up a test account, confirm via the emailed link (or local Supabase Inbucket if available), log out, log back in, trigger forgot-password, follow the recovery link, set a new password, log in with the new password.</criterion>
    <criterion id="AC-2">Any route under `(app)` redirects to `/auth/login` when there is no session. Verify: with no session cookie, request `/panel` — expect a redirect response to `/auth/login` (check both the proxy-level redirect and the `(app)/layout.tsx` fallback independently, e.g. by temporarily bypassing one).</criterion>
    <criterion id="AC-3">Routes under `(public)` are reachable without a session and are never redirected by the `(app)` guard. Verify: with no session cookie, request `/l/anything` — expect HTTP 200 rendering the placeholder, no redirect.</criterion>
    <criterion id="AC-4">An already-authenticated user visiting `/auth/login` or `/auth/sign-up` is redirected to `/panel`. Verify: with a valid session cookie, request `/auth/login` — expect a redirect response to `/panel`.</criterion>
    <criterion id="AC-5">Invalid credentials show a clear inline error, not a silent failure. Verify: submit `/auth/login` with a wrong password — expect the page to re-render with a visible `Alert` containing an error message, not a blank reload or console-only error.</criterion>
    <criterion id="AC-6">The session-refresh/guard file is `proxy.ts` at the repository root, not `middleware.ts`. Verify by file listing: `ls proxy.ts` succeeds, `ls middleware.ts` fails.</criterion>
    <criterion id="AC-7">`/titulo` is not present in the `(app)` guard's protected-prefix list, so a future unauthenticated request to `/titulo/[slug]` (built in RIK-9) will not be forced through the login redirect. Verify by reading `PROTECTED_PREFIXES` in `lib/supabase/proxy.ts`.</criterion>
  </acceptance_criteria>

  <constraints>
    <item>Do NOT create a file named `middleware.ts` anywhere — Next.js 16 uses `proxy.ts` at the project root with an exported `proxy` function.</item>
    <item>Do NOT import `lib/supabase/admin.ts` from `actions/auth/*`, any route handler in this ticket, or any client component — it is reserved exclusively for `ingestion/` per ARCHITECTURE.md.</item>
    <item>Do NOT create a `profiles` table, migration, or any `supabase/migrations/*` file — this ticket adds no migration. The sign-up "nombre" field is Supabase Auth `user_metadata` only.</item>
    <item>Do NOT add `zustand`, `react-hook-form`, or `@tanstack/react-table` to `package.json` — out of scope for this ticket.</item>
    <item>Do NOT include `/titulo` (or any prefix that would match it) in the `(app)` guard's protected-prefix list.</item>
    <item>Do NOT build real `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`, or `/l/[codigo]` screens beyond the minimal placeholders specified in phases 6 and 7.</item>
    <item>Do NOT create or commit a real `.env`/`.env.local` file, or hardcode any real Supabase URL/key — `.env.example` with placeholders only.</item>
    <item>User-visible copy (form labels, buttons, error/success messages, placeholder text) is Spanish; code identifiers, comments, and commit messages are English, per ARCHITECTURE.md.</item>
    <item>Every new shadcn primitive under `components/ui/` must be added via the `shadcn` CLI using this project's configured `base-lyra` style/registry — do not hand-write Radix- or plain-HTML-based primitives that diverge from the existing `button.tsx`.</item>
  </constraints>

  <out_of_scope>
    <item>Building the real `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`, `/titulo/[slug]` screens — later tickets (RIK-6 through RIK-10).</item>
    <item>`stores/UserStore.ts` (Zustand) and `hooks/useActiveSubscription` — deferred to whichever ticket first needs reactive client-side user-state mutation.</item>
    <item>OAuth / social login providers — not requested.</item>
    <item>Full `Header`/`Nav` authenticated shell (`components/layout/`) — RIK-7's job.</item>
    <item>Email template visual design — only the link target matters here.</item>
    <item>Rate limiting, CAPTCHA, or bot protection on auth forms.</item>
    <item>Any `supabase/migrations/*` file — this ticket is routing/auth-plumbing only.</item>
  </out_of_scope>

  <implementation_notes>
    <item>`lib/supabase/server.ts` and `lib/supabase/proxy.ts` both need the standard `@supabase/ssr` cookie-forwarding pattern (`getAll`/`setAll` on the cookie store) — implement it once and keep both call sites consistent with each other so refreshed cookies actually propagate.</item>
    <item>`getCurrentUser()` should call `supabase.auth.getUser()` (which revalidates against the Supabase Auth server), not `getSession()` (which only reads the local JWT) — this is the Supabase-recommended pattern for any server-side code making an authorization decision.</item>
    <item>Prefer `redirect()` from `next/navigation` inside Server Actions/Server Components for the "already authenticated" and "logged out" redirects; use `NextResponse.redirect()` only inside `proxy.ts`/route handlers.</item>
  </implementation_notes>

  <deliverables>
    <item>All files listed in the requirements phases above, created or modified as specified.</item>
    <item>Run `npm run lint` and fix any issues introduced by this change.</item>
    <item>No test framework exists yet in this repo — do not introduce one for this ticket; note in the verification report where auth-flow tests should live once a framework is added (e.g. alongside `lib/supabase/` and `actions/auth/`).</item>
    <item>Persist documentation per the completion_report's persistence block below (CHANGELOG.md bullet + specs/logs/ file).</item>
  </deliverables>

  <clarify_before_coding>
    <item>Protected-prefix list for the `(app)` guard (`/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`) — default: proceed with this exact list, excluding `/titulo`, per Decisions made #2. If the team later adds an `(app)` route not in this list, it will silently be unprotected until the list is updated — flag this as a follow-up if noticed.</item>
    <item>Whether `UserProvider` should already be Zustand-backed — default: React Context only for this ticket, per Decisions made #4; revisit when a ticket needs reactive client-side user mutation.</item>
    <item>Whether to customize Supabase email templates now — default: only if `supabase/config.toml` already exists (RIK-1 landed first); otherwise leave a TODO, per Decisions made #8.</item>
  </clarify_before_coding>

  <completion_report>
    When finished, produce the verification report first, persist changelog and work log,
    then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
    goes in its OWN fenced code block — do not merge them into one block.
    Present deliverables in this order: pr_description, commit_message, issue_comment,
    manual_validation (manual_validation MUST be last — it is the human test guide).

    <verification_report>
      <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
      <item>For EACH acceptance criterion (AC-1 … AC-7): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
      <item>Every decision made where the spec was ambiguous, and why that option was chosen.</item>
      <item>Any TODO or follow-up left behind, and which future ticket should own it.</item>
      <item>Anything that could not be completed, with the blocker.</item>
    </verification_report>

    <persistence required="true">
      Read CHANGELOG.md and specs/logs/README.md before writing.

      <changelog>
        <item>Append ONE bullet to CHANGELOG.md under [Unreleased] in the correct category: Added / Changed / Fixed / Removed.</item>
        <item>Format: `- RIK-XXX: Short user-facing summary (1–2 lines).` Reference the ticket id; no file paths, no column names.</item>
        <item>Keep changelog concise — technical detail belongs in the specs log, not here.</item>
      </changelog>

      <work_log>
        <item>Create specs/logs/&lt;YYYYMMDDHHmm&gt;_&lt;TICKET-ID&gt;_&lt;snake_case_slug&gt;.md where YYYYMMDDHHmm is the completion timestamp (year, month, day, hour, minute — no separators; local time at completion). Example: 202608091430_RIK-12_public_list_view.md.</item>
        <item>Use the template in specs/logs/README.md: metadata table, summary, scope delivered, files changed (created/modified/deleted), AC table with verdicts and evidence, decisions, deferred/follow-ups, verification commands run, and a "## Manual validation" section copied from the manual_validation deliverable.</item>
        <item>Set snake_case_slug to `auth_and_route_guards`, matching specs/backlog/RIK-2_auth_and_route_guards.md.</item>
        <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
        <item>Link to specs/backlog/RIK-2_auth_and_route_guards.md in the metadata table.</item>
        <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
      </work_log>
    </persistence>

    <deliverable name="pr_description" format="markdown code block">
      <item>English markdown, ready to paste as the pull request description.</item>
      <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: config / lib / actions / routes / components), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope — mention the email-template TODO here if left).</item>
      <item>Reference the ticket id in the first line.</item>
      <item>Technical tone is expected here — the audience is a code reviewer.</item>
    </deliverable>

    <deliverable name="commit_message" format="single-line code block">
      <item>Exactly one line, ready to paste in a terminal: git commit -m "[icon] [type]: [detail]"</item>
      <item>Follow .cursor/commands/makecommit.md: [type] is only Fix or Feature; [detail] is at most 64 characters; [icon] comes from the emoji mapping in that file (a new feature uses ✨).</item>
      <item>English, imperative, no ticket id inside the detail unless it still fits under 64 characters.</item>
    </deliverable>

    <deliverable name="issue_comment" format="markdown code block">
      <item>English markdown, ready to paste as a comment on the issue tracker ticket. The audience is the ticket author and product owner, NOT a developer.</item>
      <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; a "## Screenshots" section (this ticket has user-visible UI); a closing "Notes" line only when something was deferred or needs a decision.</item>
      <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Say "the login screen" instead of naming a component, "the account area" instead of naming a route group.</item>
      <item>Keep the core comment under 15 lines (excluding Screenshots).</item>
      <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>
      <item>Screenshots — list what to capture as numbered items, each with: screen/area name, auth state, and what it should show. Suggest 3–4: (1) login screen with an invalid-credentials error showing, (2) sign-up screen, (3) the account area right after logging in, (4) an attempt to open the account area while logged out, showing the redirect to login. Prefix each with `[attach: short label]`.</item>
    </deliverable>

    <deliverable name="manual_validation" format="markdown code block">
      <item>English markdown — the LAST deliverable. A practical guide for a human to confirm the work works.</item>
      <item>This ticket is UI-focused with a routing/auth dimension — include "## Prerequisites" (dev server running, Supabase project env vars set, a way to receive the confirmation/recovery email or access Supabase's local Inbucket), then "## UI validation" with numbered steps covering: sign up, confirm email, log in, wrong-password error, visiting /panel while logged out (expect redirect to /auth/login), visiting /auth/login while logged in (expect redirect to /panel), visiting /l/anything while logged out (expect it to load, no redirect), forgot password → recovery email → update password → log in with new password, log out.</item>
      <item>Use concrete app paths: `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password`, `/panel`, `/l/[codigo]`.</item>
      <item>Add a short "## Expected outcome" (1–3 bullets tying back to AC-1 through AC-5).</item>
    </deliverable>
  </completion_report>
</task>
```
