# RIK-2 — Autenticación y estructura de rutas

| Field | Value |
|---|---|
| Ticket | RIK-2 |
| Completed | 2026-08-09 15:05 (local) |
| Log file | `specs/logs/202608091505_RIK-2_auth_and_route_guards.md` |
| Backlog spec | `specs/backlog/RIK-2_auth_and_route_guards.md` |
| Status | completed |

## Summary

Implemented Supabase Auth end-to-end (sign up, log in, log out, forgot/update password) and the three route groups `(auth)` / `(app)` / `(public)`, with a `proxy.ts` session guard that protects the private area while leaving public routes and the future public title-page variant reachable without a session. `lib/supabase/{client,server,admin}.ts` and `lib/supabase/proxy.ts` already existed from prior scaffolding and were extended/rewritten rather than created from scratch.

## Scope delivered

- DB: none (this ticket adds no migration, as scoped).
- Lib: `getCurrentUser()` added to `lib/supabase/server.ts`; `lib/supabase/admin.ts` (service-role client) created; `lib/supabase/middleware.ts` replaced by `lib/supabase/proxy.ts` implementing an explicit `PROTECTED_PREFIXES` allowlist (excluding `/titulo`) instead of the prior default-deny-except-public pattern.
- Root: `proxy.ts` created (Next.js 16 convention, not `middleware.ts`).
- Actions: `actions/auth/{signIn,signUp,signOut,forgotPassword,updatePassword,types,index}.ts` — `useActionState`-compatible Server Actions.
- Routes: `(auth)` login/sign-up/forgot-password/update-password pages, `auth/confirm` and `auth/callback` route handlers; `(app)` layout + placeholder `/panel`; `(public)` layout + placeholder `/l/[codigo]`.
- UI: `input`/`label`/`card`/`alert` added via the `shadcn` CLI (`base-lyra` style); `UserProvider` (React Context) + `useSession` hook; root layout updated with `ThemeProvider` (dark default) and `Toaster`.
- Dependencies: added `next-themes`, `sonner` (`@supabase/ssr`/`@supabase/supabase-js` were already installed).

## Files changed

### Created

- `.env.example` — placeholder Supabase env vars.
- `lib/supabase/admin.ts` — service-role client, reserved for `ingestion/`.
- `lib/supabase/proxy.ts` — `updateSession()` with the protected-prefix allowlist.
- `proxy.ts` — repo-root Next.js 16 proxy, delegates to `updateSession()`.
- `actions/auth/{types,signIn,signUp,signOut,forgotPassword,updatePassword,index}.ts` — auth Server Actions.
- `app/(auth)/layout.tsx` — shared auth shell (no blanket redirect, see Decisions).
- `app/(auth)/auth/login/{page.tsx,LoginForm.tsx}` — login screen (`page.tsx` does the "already authenticated" redirect, `LoginForm.tsx` is the client form).
- `app/(auth)/auth/sign-up/{page.tsx,SignUpForm.tsx}` — sign-up screen, same split.
- `app/(auth)/auth/forgot-password/page.tsx` — password-recovery request screen.
- `app/(auth)/auth/update-password/page.tsx` — new-password screen.
- `app/(auth)/auth/confirm/route.ts` — verifies both `code` (PKCE) and `token_hash`+`type` email-link formats.
- `app/(auth)/auth/callback/route.ts` — OAuth code-exchange handler (parity, no provider configured yet).
- `app/(app)/layout.tsx` — `AuthCheck` + `UserProvider` wrapper.
- `app/(app)/panel/page.tsx` — placeholder panel proving the guard + logout.
- `app/(public)/layout.tsx` — minimal public shell.
- `app/(public)/l/[codigo]/page.tsx` — placeholder public list page.
- `components/providers/UserProvider.tsx`, `hooks/useSession.ts`.
- `components/ui/{input,label,card,alert}.tsx` — via `shadcn` CLI.
- `.claude/launch.json` — local dev-server preview config (tooling, not app code).

### Modified

- `lib/supabase/server.ts` — added `getCurrentUser()` / `CurrentUser` type.
- `app/layout.tsx` — `ThemeProvider`, `Toaster`, Spanish/Rikuna metadata, `suppressHydrationWarning`.
- `package.json` — added `next-themes`, `sonner`.
- `supabase/config.toml` — `[auth].site_url` / `additional_redirect_urls` corrected from the CLI's default `127.0.0.1:3000` to `localhost:3011` (+ `127.0.0.1:3011` and wildcard paths), matching this project's actual dev port (`next dev -p 3011`). Without this fix, confirmation/recovery email links pointed at the wrong port and Supabase silently stripped the `redirect_to` path when it didn't match the allow-list.

### Deleted

- `lib/supabase/middleware.ts` — superseded by `lib/supabase/proxy.ts` (Next.js 16 rename + allowlist rewrite).

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Manually verified full loop in the browser against local Supabase + Mailpit: sign-up → auto-login (local `enable_confirmations=false`) → logout → login → wrong-password error → forgot-password → recovery email received → update-password → login with new password, all succeeded. |
| AC-2 | PASS | Unauthenticated request to `/panel` and to `/biblioteca` (a not-yet-built protected prefix) both redirected to `/auth/login?next=...` at the proxy level, confirmed via `window.location.href`. |
| AC-3 | PASS | Unauthenticated request to `/l/anything` returned the placeholder page with no redirect (`get_page_text` showed "Lista pública — próximamente / Código: anything"). |
| AC-4 | PASS | Authenticated request to `/auth/login` redirected to `/panel` (verified before and after the layout refactor described in Decisions). |
| AC-5 | PASS | Submitting `/auth/login` with a wrong password re-rendered the form with a visible destructive `Alert` ("Invalid login credentials"), no silent failure. |
| AC-6 | PASS | `ls proxy.ts` succeeds; `ls middleware.ts` fails (file removed). |
| AC-7 | PASS | `PROTECTED_PREFIXES` in `lib/supabase/proxy.ts` contains `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil` — no `/titulo`. |

## Decisions

- **`(auth)` layout no longer redirects every authenticated visitor to `/panel`.** The original plan put that check in the shared layout, but `/auth/update-password` legitimately needs an authenticated *recovery* session to work — manual testing showed the blanket guard bounced a user straight to `/panel` immediately after clicking their recovery email, before they could ever set a new password. Moved the "already authenticated → redirect" check into `login/page.tsx` and `sign-up/page.tsx` only, which is exactly AC-4's actual scope. `login/page.tsx` and `sign-up/page.tsx` are now thin async server components that do the check and render a `LoginForm`/`SignUpForm` client component.
- **`app/(auth)/auth/confirm/route.ts` handles both `code` (PKCE) and `token_hash`+`type`.** The installed `@supabase/ssr` client defaults to the PKCE flow, so `resetPasswordForEmail`/`signUp` email links arrive with a `code` param, not `token_hash` — the original plan (token_hash-only in `confirm`, code-only in `callback`) didn't match what Supabase actually sends for email links in this SDK version. `callback/route.ts` is kept as-is for OAuth parity.
- **`supabase/config.toml` `site_url`/`additional_redirect_urls` corrected to the project's real dev port (3011) and host (`localhost`, matching the preview environment's tunnel).** The Supabase CLI scaffold defaulted to `127.0.0.1:3000`; left as-is, every confirmation/recovery email link would silently point at the wrong port/host. This is local dev config, not a migration.
- **`lib/supabase/{client,server,proxy}.ts` keep the pre-existing `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env var (`.env.local` already had it wired) rather than renaming to `NEXT_PUBLIC_SUPABASE_ANON_KEY`** as the original ticket text assumed — avoids an unnecessary rename of already-working, already-committed client factories.
- **Session checks use `supabase.auth.getUser()` everywhere** (both `lib/supabase/proxy.ts` and `getCurrentUser()`), replacing the pre-existing scaffold's `getClaims()` in the old `middleware.ts`, per the ticket's own `implementation_notes` and to keep both call sites consistent.
- All other recommended defaults from `<clarify_before_coding>` were followed as-is: the protected-prefix list, React Context (not Zustand) for `UserProvider`, and the Supabase email-template TODO was not needed — `config.toml` has no active custom templates, so the built-in template already honors the `emailRedirectTo`/`redirectTo` passed at call time once the allow-list matched.

## Deferred / follow-ups

- Building the real `/panel`, `/biblioteca`, `/mis-listas`, `/suscripciones`, `/importar`, `/perfil`, `/titulo/[slug]` screens — RIK-6 through RIK-10.
- `stores/UserStore.ts` (Zustand) — first ticket needing reactive client-side user-state mutation.
- OAuth providers, rate limiting/CAPTCHA on auth forms — not requested.
- No test framework exists yet in this repo; auth-flow tests should live alongside `lib/supabase/` and `actions/auth/` once one is introduced.

## Verification

- `npx tsc --noEmit` — no errors.
- `npm run lint` — no errors.
- Manual end-to-end browser verification against local Supabase (`supabase start`) + Mailpit for all 7 acceptance criteria (see table above).

## Manual validation

### Prerequisites

- `npm run dev` running (port 3011).
- Local Supabase running (`supabase start`) with Mailpit for email capture, or a real SMTP-backed project.
- Consistently use ONE host for the whole session (`localhost:3011` or `127.0.0.1:3011`, matching `supabase/config.toml`'s `site_url`) — mixing hosts breaks session cookies since they're host-scoped.

### UI validation

1. Go to `/auth/sign-up`, fill nombre/correo/contraseña, submit — expect either immediate login (if `enable_confirmations=false` locally) or a "revisa tu correo" message.
2. If a confirmation email was sent, open it in Mailpit and follow the link — expect landing on `/panel`.
3. Log out from `/panel`.
4. Go to `/auth/login`, submit a wrong password — expect an inline red error, no redirect.
5. Log in with the correct password — expect landing on `/panel`.
6. While logged out, visit `/panel` — expect redirect to `/auth/login`.
7. While logged in, visit `/auth/login` — expect redirect to `/panel`.
8. While logged out, visit `/l/anything` — expect it to load (no redirect), showing the codigo placeholder.
9. Go to `/auth/forgot-password`, submit your test account's email — expect a success message and a "Reset your password" email.
10. Follow the recovery link — expect landing on `/auth/update-password` (NOT bounced to `/panel`).
11. Set a new password — expect redirect to `/panel`.
12. Log out, log back in with the NEW password — expect success.

### Expected outcome

- All 5 original acceptance criteria (AC-1 through AC-5) hold, plus the two derived file/config checks (AC-6, AC-7).
- No user is ever forced through a login wall to reach `/l/[codigo]`, and no unauthenticated user reaches `/panel` or the other protected prefixes.
