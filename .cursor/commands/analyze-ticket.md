---
description: Analyze a ticket (description + comments) against the real state of the Rikuna codebase, DB and domain logic before any implementation
alwaysApply: false
---

# Analyze Ticket

Deep-analysis pass for a single ticket **before** writing any code or spec document. The goal is to produce a trustworthy picture of what the ticket really asks, what already exists in the project, and what is genuinely missing.

The output of this command is a **chat analysis only** — do not create files, do not modify code, do not run migrations. The follow-up command `/ticket-to-backlog` turns this analysis into the spec documents.

## Input

The user pastes the ticket. Expect any subset of:

- Ticket ID (e.g. `RIK-12`) and title
- Description / context / requirements
- Acceptance criteria
- Comments from the team (these often **override or reinterpret** the original description — treat the newest comment as the most authoritative)
- SQL stubs, query sketches, field tables, screenshots

If the ticket ID is missing, ask for it — it determines the filenames later.

## Ground rules

1. **Never trust the ticket's schema/table/field names.** Tickets are frequently written against the PRD or an outdated mental model that does not match the database. Verify every table, column, type and default against `supabase/migrations/` and cross-check with `specs/RIKUNA-PRD-schema-basedatos-rikuna.md`.
2. **Comments outrank the description.** When a comment redirects the work (e.g. "table X doesn't exist yet, do it on table Y instead"), the comment is the real scope. Call out the discrepancy explicitly.
3. **Reuse before adding.** A field that "must be created" often already exists under a different name. Every proposed new column must be justified against what is already in the schema.
4. **Distinguish "exists in DB" from "used by the code".** A column can exist and be persisted but never read by services or UI. That distinction changes the scope substantially.
5. **Respect auth boundaries.** Rikuna has a deliberate `(public)` route group for unauthenticated reads (`/l/[codigo]`, public title pages). Do not assume every screen requires a session or that every query filters by `user_id`.
6. **Do not invent.** If something cannot be determined from the codebase, it becomes an open question, not an assumption.

## Investigation checklist

Work through these in order. Use parallel searches where possible. Read actual files — do not infer from filenames.

### 1. Ticket decomposition

- Extract: ticket ID, title, stated goal, explicit requirements, acceptance criteria, dependencies (blocks / blocked by).
- List every entity the ticket names (tables, columns, routes, features, components, ingestion routines).
- Note every enum value, default, threshold and type the ticket specifies.
- Summarize what each comment changes relative to the description.

### 2. Database reality check

- Search `supabase/migrations/` for each table the ticket names. Confirm the real name and casing (this project uses `snake_case` tables, e.g. `media_availability`, while tickets often use informal names like "availability links").
- Cross-check table purpose and relationships in `specs/RIKUNA-PRD-schema-basedatos-rikuna.md` — especially availability upsert/expire logic (Section 3.3) and public list visibility (Section 9.2).
- If a named table does not exist anywhere, say so plainly and identify what the real target is.
- For each column the ticket wants: confirm whether it already exists, and with which type, default, constraint.
- Check later migrations for alterations — the schema doc may lag behind the latest migration.
- Check for dependent objects that would break: views, RLS policies, triggers, functions. Remember **per-user isolation** via `user_id` on personal tables and the **public-by-flag** exception on `user_lists` / `list_items`.

### 3. Types layer

- Read the matching `types/<Resource>.ts` (or `types/index.ts` barrel) and confirm the TypeScript shape.
- Note both the read model and any update/input model if they are separate types.

### 4. Services and actions

- Read `services/<Resource>Services/*` — explicit column lists in queries and row mappers are common; new columns must be added there or they silently return `undefined`.
- Read `actions/<resource>/*` for orchestration, session checks, `revalidatePath` targets, and how DB rows are mapped into domain inputs.
- Confirm whether the change belongs in a user-facing action (RLS + anon key) or in `ingestion/` (service role via `lib/supabase/admin.ts` only).

### 5. Domain logic (when the ticket touches calculations, ingestion or recommendations)

Identify which area is affected and read the real implementation:

| Area | Where to look |
| --- | --- |
| Catalog ingestion | `ingestion/catalog/` — snapshot create, upsert `media_items` / `media_availability`, expire stale rows |
| IMDb CSV import | `ingestion/imdb-import/` — batch rows, stub `media_items`, match by `imdb_id` |
| Recommendations / panel | `actions/recommendations/`, `constants/recommendationThresholds.ts`, schema doc Sections 8.1–8.2 |
| Availability display | `services/MediaAvailabilityServices`, `components/AvailabilityBadge/` |
| Public reads | `services/ListServices` public path, `app/(public)/`, `lib/supabase/proxy.ts` + `middleware.ts` |

State the **current behaviour** verbatim (query, filter, threshold) and the **requested behaviour**, then diff them.

### 6. UI, routes and features

- Cross-check screen requirements against `specs/RIKUNA-PRD-vistas-y-estilo-rikuna.md` and product flows in `specs/RIKUNA-PRD-documento-especificacion-rikuna.md`.
- Locate the affected slice under `features/<resource>/...` (or note if the feature folder does not exist yet — mirror a sibling per `ARCHITECTURE.md`).
- Identify the matching route under `app/` — pay attention to `(app)` vs `(public)` vs `(auth)` route groups.
- Identify form/persist helpers, Zustand stores, and shared widgets (`MediaCard`, `DataTable`, shadcn primitives under `components/ui/`).
- User-visible copy is **Spanish**; code identifiers and developer strings are **English** (see `ARCHITECTURE.md`).

### 7. Tests

- Find existing tests that construct the affected row/type — added required fields will break their fixtures. If no test suite exists yet, note that and recommend where tests should live when added.

## Required output

Produce this structure in chat. Be concrete: real file paths, real column names, real types.

### A. Ticket summary

One short paragraph: what the ticket wants, in plain language.

### B. Ticket vs. reality discrepancies

Call out every mismatch up front — this is the most valuable part of the analysis.

| Ticket says | Reality in codebase | Impact |
| --- | --- | --- |

### C. Current state

What already exists, split into:

- **Schema**: table, columns, types, defaults, constraints, RLS notes
- **Code usage**: which of those columns services/actions/UI actually read vs. merely persist
- **Current behaviour**: verbatim query, filter or UI rule, with a code reference

### D. Field-by-field mapping

For every field the ticket requests:

| Field requested | Type requested | Existing equivalent | Verdict |
| --- | --- | --- | --- |

Verdict is one of: `already exists (reuse)`, `exists under another name (reuse/rename)`, `must be created`, `redundant — covered by FK/other field`.

### E. Impacted files

Grouped by layer (migration / types / services / actions / ingestion / features / components / app routes / middleware / tests), with a one-line reason each.

### F. Open questions

Numbered list. Each question must be a real blocker or a decision only the team can make. For each, state your **recommended default** so the work is not blocked if nobody answers.

### G. Proposed scope

- **In scope** — what this ticket should deliver
- **Out of scope** — explicitly deferred, with the reason (e.g. "depends on catalog ingestion that is not wired yet")
- **Risk notes** — backward-compatibility concerns, data-loss risks, public-route exposure, RLS gaps, things that could break other tickets

## Clarifying questions

Ask questions when the answer would change the implementation. Prefer asking as a short structured set rather than one at a time, and always pair each question with your recommended default so the analysis can proceed either way.

Good reasons to ask:

- The ticket names a table/column that does not exist and more than one real target is plausible.
- A requested field duplicates an existing one and renaming would be a breaking change.
- A recommendation or availability rule needs reference data with no obvious source table.
- The ticket's default value contradicts the current column default and existing rows would be affected.
- The ticket touches public visibility but does not say whether unauthenticated access is required.
- Acceptance criteria are untestable as written.

Do not ask about things you can determine by reading the codebase. Read first.

## Closing

End with a single line stating whether the ticket is **ready to spec** (`/ticket-to-backlog`) or **blocked** pending answers to specific open questions.

This command is available in chat with `/analyze-ticket`.
