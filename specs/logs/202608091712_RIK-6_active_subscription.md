# RIK-6 — Mis suscripciones

| Field | Value |
|---|---|
| Ticket | RIK-6 |
| Completed | 2026-08-09 17:12 (local) |
| Log file | `specs/logs/202608091712_RIK-6_active_subscription.md` |
| Backlog spec | `specs/backlog/RIK-6_active_subscription.md` |
| Status | completed |

## Summary

Delivered the `/suscripciones` screen: an activation form (platform + country picker) and a subscription history table, built on top of the `user_subscriptions` table already shipped by RIK-1. The core new logic is `SubscriptionServices.activateSubscription`, which closes any existing open row for the exact same platform+country pair (setting `ended_on` to today) before inserting the new open row, so the app always has an unambiguous "what am I paying for right now" answer per platform/country while allowing multiple simultaneous subscriptions across different platforms/countries.

## Scope delivered

- Types: `UserSubscription`, `ActivateSubscriptionInput` in the shared barrel.
- Services: `SubscriptionServices` (get active, get history, activate with close-then-insert, get known platforms).
- Actions: `actions/subscriptions` — session-checked Server Actions delegating to the service, with `revalidatePath` on `/suscripciones` and `/panel` after activation.
- UI: `ActivateSubscriptionForm`, `ActiveSubscriptionsList`, `SubscriptionHistoryTable` feature components; `Select` shadcn primitive added (base-lyra style).
- Route: `app/(app)/suscripciones/page.tsx` Server Component wiring it all together.
- Constants: curated `constants/countries.ts`.

## Files changed

### Created

- `types/index.ts` (edit, see Modified) — n/a
- `services/SubscriptionServices/index.ts` — active/history/activate/known-platforms query logic and row→DTO mapping.
- `actions/subscriptions/types.ts` — `ActivateSubscriptionActionState` discriminated union for the form's `useActionState`.
- `actions/subscriptions/getActiveSubscriptionsAction.ts` — session-checked read, delegates to service.
- `actions/subscriptions/getSubscriptionHistoryAction.ts` — session-checked read, delegates to service.
- `actions/subscriptions/getKnownPlatformsAction.ts` — session-checked read of `platforms` for the picker.
- `actions/subscriptions/activateSubscriptionAction.ts` — validates form input, calls the service, revalidates `/suscripciones` and `/panel`.
- `actions/subscriptions/index.ts` — barrel.
- `constants/countries.ts` — curated ISO-3166 alpha-2 list for the country picker.
- `features/subscriptions/ActivateSubscriptionForm.tsx` — client form (platform + country `Select`, `useActionState`, empty-state when no platforms exist).
- `features/subscriptions/ActiveSubscriptionsList.tsx` — one `Card` per open subscription.
- `features/subscriptions/SubscriptionHistoryTable.tsx` — full history, newest first, with an active/finalizada `Badge`.
- `app/(app)/suscripciones/page.tsx` — Server Component fetching active/history/platforms and rendering the feature components.
- `components/ui/select.tsx` — added via shadcn CLI (`base-lyra` style, `mist` base color) since the picker needed a `Select` primitive that didn't exist yet.

### Modified

- `types/index.ts` — added `UserSubscription` and `ActivateSubscriptionInput`.
- `services/index.ts` — exported `SubscriptionServices`.

### Deleted

- None.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Activated Netflix/BO twice for the same test user. Second activation: `select platform_id,country,started_on,ended_on from user_subscriptions order by started_on desc` showed the first Netflix/BO row with `ended_on = 2026-08-09` (today) and exactly one Netflix/BO row with `ended_on is null`. |
| AC-2 | PASS | Activated Apple TV+/AR and Netflix/BO for the same user. `select count(*) from user_subscriptions where user_id = :uid and ended_on is null` returned 2; both appeared simultaneously in the UI's "Activas" section as separate cards. |
| AC-3 | PASS | The three rows created during testing (Apple TV+/AR, closed Netflix/BO, new Netflix/BO) rendered in the history table and via `getSubscriptionHistory()` in `started_on desc` order (all same test day; SQL `order by started_on desc` is the sole sort key, verified against the `ORDER BY` clause and the query result set). |
| AC-4 | PASS | Before any activation, `getActiveSubscriptions()` for the fresh test user resolved to `[]` — confirmed both via a direct PostgREST call (`user_subscriptions?ended_on=is.null` → `[]`) and via the rendered page showing "Todavía no tienes ninguna suscripción activa." with no error. |
| AC-5 | PASS | With Apple TV+/AR and Netflix/BO both open, reactivating Netflix/BO again left Apple TV+/AR untouched — confirmed via SQL (`ended_on is null` still true for the AR row) and the UI still showing the Apple TV+ card after the second Netflix activation. |

## Decisions

- **Platforms and country list**: read `platforms` live (no seeding in this ticket); found the local DB already had 2 seeded rows (Apple TV+, Netflix) from prior RIK-3 testing — used them as-is for verification, no schema/seed changes made. `constants/countries.ts` ships a small curated list (BO, AR, CL, PE, CO, MX, US, ES) per the ticket's default.
- **Close-then-insert**: implemented as two sequential Supabase calls in `SubscriptionServices.activateSubscription`, with a defensive `catch` on Postgres `23505` (unique_violation) surfaced as a clear Spanish error message — no new RPC/migration, per the ticket's accepted tradeoff.
- **Select value display bug found and fixed during verification**: Base UI's `Select.Value` renders the raw `value` (here, a platform UUID / country code) unless given a `children` render-prop formatter — the shadcn-generated `select.tsx` primitive doesn't set this up by default. Without the fix, the trigger displayed the raw platform UUID / country code instead of its label after selection. Fixed in `ActivateSubscriptionForm.tsx` by passing a formatter function to `SelectValue` for both pickers.
- **Date display timezone bug found and fixed during verification**: `new Date("2026-08-09")` (a date-only string) is parsed as UTC midnight; formatting it with the browser's local timezone (UTC-4 in this environment) rendered "8 ago 2026" for a subscription actually started "9 ago 2026". Fixed by adding `timeZone: "UTC"` to the `Intl.DateTimeFormat` instances in `ActiveSubscriptionsList.tsx` and `SubscriptionHistoryTable.tsx`, since `started_on`/`ended_on` are date-only (no time-of-day) columns.
- **Action getters redirect to `/auth/login` on no session**, matching the stricter `getImportBatchDetail` pattern rather than the silent-empty-array `getImportBatches` pattern, since the ticket explicitly asked for "redirect or throw" — the page itself is already behind the `(app)` layout guard so this only matters for direct/out-of-band calls.

## Deferred / follow-ups

- No automated tests were added (none configured in this repo yet, out of scope per the ticket).
- Subscription-utilization statistics remain out of scope (Fase 2, per product spec) — not touched.
- Platform seeding/admin UI remains out of scope — not touched.

## Verification

- `npm run lint` — clean, no errors.
- `npx tsc --noEmit -p .` — clean, no type errors.
- Manual end-to-end verification against local Supabase (`supabase start`) using a throwaway signed-up test user (`rik6-tester@example.com`, deleted after testing) in the Browser pane: sign-up → `/suscripciones` → activate Netflix/BO → activate Apple TV+/AR → reactivate Netflix/BO → verified UI state and cross-checked with direct SQL against `user_subscriptions` at each step (see AC table above). Test user and its rows were deleted from the local DB after verification.

## Manual validation

### Prerequisites

- Dev server running (`npm run dev`).
- A logged-in test user (see RIK-2's sign-up/login flow).
- At least one row in `platforms` — if there are zero rows, the activation form will show "No hay plataformas configuradas todavía." instead of the picker; that empty state is itself testable and is expected behavior, not a bug.

### UI validation

1. Go to `/suscripciones`. With no subscriptions yet, "Activas" shows "Todavía no tienes ninguna suscripción activa." and "Historial" shows "Todavía no tienes historial de suscripciones."
2. In "Activar suscripción", pick a platform and a country, submit. Confirm a success message appears, a new card shows up under "Activas" for that platform/country, and a new row appears in "Historial" with today's date under "Desde", "—" under "Hasta", and an "Activa" badge.
3. Activate the **same** platform + country again. Confirm: the previous row now shows today's date under "Hasta" and a "Finalizada" badge in the history table; the "Activas" section still shows exactly **one** card for that platform/country (the new one).
4. Activate a **different** platform or country. Confirm both are now shown simultaneously as separate cards under "Activas".
5. Confirm the history table is ordered newest first by "Desde".

### Database validation

```sql
select user_id, platform_id, country, started_on, ended_on
from user_subscriptions
where user_id = :uid
order by started_on desc;
```

Confirm the partial-unique-index invariant holds: for any given `platform_id` + `country` pair belonging to `:uid`, at most one row has `ended_on is null`.

### Expected outcome

- Reactivating the same platform+country closes the prior row and leaves exactly one open row for that pair (AC-1).
- Distinct platform/country pairs can be open at the same time (AC-2, AC-5).
- The history table and `getSubscriptionHistory()` agree on newest-first ordering (AC-3), and a user with no subscriptions sees an empty state, not an error (AC-4).
