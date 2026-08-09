# RIK-5 — Detalle de importación

| Field | Value |
|---|---|
| Ticket | RIK-5 |
| Completed | 2026-08-09 16:15 (local) |
| Log file | `specs/logs/202608091615_RIK-5_import_batch_detail.md` |
| Backlog spec | `specs/backlog/RIK-5_import_batch_detail.md` |
| Status | completed |

## Summary

Added the read-only history and detail views on top of RIK-4's IMDb import: an "Importaciones
anteriores" section appended to `/importar` listing every past batch (date, type, summary counters),
and a new `/importar/[batchId]` page showing every row of one batch (title, IMDb id, result) with a
color-coded result badge. RIK-1 and RIK-4 had both already landed, so this ticket only added read
methods/actions on top of their existing schema, service, and action files — no new tables, no
mutation paths.

## Scope delivered

- Services: `listBatchesForUser` and `getBatchWithRows` added to the existing `ImdbImportServices`,
  plus a row mapper (`mapImportRowRow`) so `result`/`imdb_id`/`title` are never dropped.
- Actions: `getImportBatches` and `getImportBatchDetail` added to the existing `actions/imdb-import`
  barrel, each with its own defensive `supabase.auth.getUser()` check.
- Shared UI: new `components/Table/DataTable.tsx`, a generic TanStack Table v9 wrapper (client-side
  sorting + pagination) built on the `@tanstack/react-table/legacy` compatibility API. `badge.tsx`,
  `card.tsx`, `table.tsx` already existed from RIK-4, so no new shadcn primitives were needed.
  `@tanstack/react-table` was installed (previously absent from `package.json`).
- Features: `ImportResultBadge`, `BatchHistoryList`, `BatchDetailTable` under
  `features/import/components/`.
- Routes: `/importar` extended with a history section below RIK-4's existing upload form (upload
  code untouched); new `app/(app)/importar/[batchId]/page.tsx` with the Next.js 16
  `params: Promise<...>` contract.

## Files changed

### Created

- `services/ImdbImportServices.ts` (extended, not new file) — see Modified.
- `actions/imdb-import/getImportBatches.ts` — `getImportBatches()` Server Action.
- `actions/imdb-import/getImportBatchDetail.ts` — `getImportBatchDetail(batchId)` Server Action.
- `components/Table/DataTable.tsx` — generic TanStack Table wrapper (sorting + client pagination).
- `features/import/components/ImportResultBadge.tsx` — result → Spanish label + Badge variant map.
- `features/import/components/BatchHistoryList.tsx` — batch list cards + empty state.
- `features/import/components/BatchDetailTable.tsx` — `DataTable` columns for title/imdb_id/result.
- `app/(app)/importar/[batchId]/page.tsx` — batch detail route.

### Modified

- `services/ImdbImportServices.ts` — added `listBatchesForUser`, `getBatchWithRows`,
  `mapImportRowRow`; added `ImdbImportRow` to the type import.
- `actions/imdb-import/index.ts` — barrel now also exports `getImportBatches`,
  `getImportBatchDetail`.
- `app/(app)/importar/page.tsx` — became an async Server Component; appended the history section
  below the existing `UploadForm` (upload code itself untouched).
- `package.json` / `package-lock.json` — added `@tanstack/react-table`.
- `CHANGELOG.md` — added the RIK-5 bullet under `[Unreleased] / Added`.

### Deleted

None.

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | Seeded two batches for one test user via direct SQL (`ratings`, 2 days old; `watchlist`, now), each with `total_rows=3, matched_rows=1, created_rows=1, skipped_rows=1`. `/importar` rendered "Lista de seguimiento" (9 ago, newest) above "Calificaciones" (7 ago), each showing Total 3 / Reconocidos 1 / Creados 1 / Omitidos 1 — matching the seeded rows exactly, most-recent-first. |
| AC-2 | PASS | (a) As the owner, `/importar/22222222-...` rendered exactly the 3 seeded `imdb_import_rows` for that batch with correct title/imdb_id/result (`Broken Row`/`tt0000000`/Omitido, `Some New Stub Title`/`tt9999999`/Creado, `The Shawshank Redemption`/`tt0111161`/Reconocido) — a straight match against the `insert` statements used to seed them. (b) Signed in as a second, unrelated authenticated user and requested the same URL: rendered Next.js's `404: This page could not be found.` page, no batch data present in the response. |
| AC-3 | PASS | Screenshot of the detail table shows "Omitido" rendered in the destructive (red-tinted) badge style, visually distinct from "Creado" (default/light badge) and "Reconocido" (secondary/muted badge) — confirmed via `ImportResultBadge`'s variant map (`skipped→destructive`, `created→default`, `matched→secondary`) and the rendered screenshot. |
| AC-4 | PASS | `app/(app)/importar/[batchId]/page.tsx` is `async function Page({ params }: { params: Promise<{ batchId: string }> })` with `const { batchId } = await params` before any data fetch — matches `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`'s documented shape verbatim. |
| AC-5 | PASS | The second test user (zero batches) saw "Todavía no importaste ningún archivo. Sube tu primer CSV de IMDb para empezar." under "Importaciones anteriores" instead of an empty table or error. |
| AC-6 | PASS | Detail page renders a `Button` with `render={<Link href="/importar" />}` and label "Volver a Importar"; inspected the rendered page text/DOM and the link is present and points to `/importar`. |

## Decisions

- **TanStack Table major-version mismatch.** `AGENTS.md` warns this Next.js install has breaking
  changes vs. training data; the same turned out to be true for `@tanstack/react-table`, which
  installed as `9.1.2` — a genuinely different API from the v8 (`useReactTable`) shape assumed by
  most training data (no `useReactTable` export at all; state is now atom/store-based). Rather than
  hand-roll the new `tableFeatures()` composition API, `DataTable` uses the package's own documented
  v8 compatibility layer (`@tanstack/react-table/legacy`: `useLegacyTable`, `getCoreRowModel`,
  `getSortedRowModel`, `getPaginationRowModel`, `LegacyColumnDef`) plus `flexRender` from the main
  export. This is a real, typed, first-party API (not a hack) and keeps `DataTable`'s call shape
  familiar for whoever touches it next; confirmed via `node_modules/@tanstack/react-table/dist/legacy.d.ts`
  and a clean `npx tsc --noEmit`.
- **Row ordering for `getBatchWithRows`.** The ticket allows "title or insertion order"; sorted by
  `title asc` since IMDb CSV rows have no natural sequence column and alphabetical is more useful
  for scanning a detail table than insertion order.
- **`getImportBatchDetail` redirects to `/auth/login` on no session** (matching the ticket's stated
  default), while **`getImportBatches` returns `[]`** — the natural "no data" value for a list
  action, consistent with how the page already handles an empty history.
- **`ImportResultBadge` fallback variant is `outline`**, not reused from `matched`/`created`/`skipped`,
  so an unexpected/`pending` result value is visually distinguishable from all three defined states
  rather than silently aliasing one of them.
- **Base UI `Button` has no `asChild`** (unlike the Radix-style API assumed by habit) — it uses a
  `render` prop (`ComponentRenderFn` or `ReactElement`) per `@base-ui/react/button`. Used
  `render={<Link href="/importar" />}` with `nativeButton={false}` (the link isn't a real `<button>`),
  confirmed against `node_modules/@base-ui/react/button/Button.d.ts` and `internals/types.d.ts`.

## Deferred / follow-ups

- None specific to this ticket's own scope — RIK-1 and RIK-4 had both already landed cleanly with no
  blockers (verified imdb_import_rows RLS is the EXISTS-subquery, owner-only policy the spec expects).

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (`eslint`, no errors/warnings).
- Manual browser verification against the local Supabase instance (`supabase status` confirmed
  running): signed up two real test users, seeded two batches / four rows via direct SQL insert,
  exercised `/importar` and `/importar/[batchId]` as owner, as a different authenticated user, and as
  anon — see Acceptance criteria evidence above. Seeded rows and both test users were deleted after
  verification (`delete from imdb_import_batches ...` cascades to `imdb_import_rows`; `delete from
  auth.users ...`) to leave the local database clean.

## Manual validation

Copy from the `manual_validation` deliverable below.
