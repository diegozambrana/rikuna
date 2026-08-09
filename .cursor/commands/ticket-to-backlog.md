---
description: Turn an analyzed ticket into English + Spanish spec documents in specs/backlog/ with a ready-to-paste XML prompt for the coding agent
alwaysApply: false
---

# Ticket to Backlog

Second half of the ticket workflow. Takes the analysis produced by `/analyze-ticket` and writes two spec documents to `specs/backlog/` — an English primary and a Spanish companion — containing the ticket context, the codebase analysis, and a self-contained XML prompt ready to paste into Claude Code or Cursor Agent.

## Prerequisite

This command consumes the output of `/analyze-ticket`. Before writing anything:

1. Check whether the current chat already contains that analysis (ticket vs. reality discrepancies, current state, field mapping, impacted files, open questions).
2. If it does **not**, run the `/analyze-ticket` investigation first — do not write a spec from the ticket text alone. A prompt built on unverified table and column names is worse than no prompt.
3. If open questions from the analysis are still unanswered, ask them now. If the user declines to answer, record the recommended default under `Decisions made` and inside the prompt's `<clarify_before_coding>`.

## Filenames

Every ticket produces **two** files:

```
specs/backlog/<TICKET-ID>_<snake_case_slug>.md        # primary, fully English
specs/backlog/<TICKET-ID>_<snake_case_slug>_esp.md    # Spanish narrative
```

- `<TICKET-ID>` exactly as the tracker shows it, uppercase (e.g. `RIK-12`).
- `<snake_case_slug>` is 2–5 lowercase words describing the deliverable, underscore-separated. Derive it from the ticket title, not from the ticket description.
- Slug convention examples: `RIK-12_public_list_view.md`, `RIK-8_subscription_picker.md`.
- Before writing, list `specs/backlog/` and confirm neither file already exists. If either does, ask whether to overwrite or version it.

## Language

The primary file is the **source of truth** and is shared with the team, so it is fully English. The `_esp.md` file is a reading aid.

| File            | Narrative sections | XML prompt                               |
| --------------- | ------------------ | ---------------------------------------- |
| `<slug>.md`     | English            | English                                  |
| `<slug>_esp.md` | Spanish            | English — **identical**, copied verbatim |

- The XML prompt is **never translated**. It is consumed by a coding agent that must produce English code and comments per `ARCHITECTURE.md`, and a translated prompt would drift from the primary file.
- Copy the prompt block into `_esp.md` byte-for-byte. If the prompt is later edited, edit the primary file and re-copy — never patch one file only.
- Both files keep the same section order and the same tables, so they can be diffed side by side.

## Document structure

Four narrative blocks plus the prompt, in this order. This is the **primary** file (English).

````markdown
# <TICKET-ID> — <Ticket title>

## Ticket summary

<2–5 sentences at the very top — readable without scrolling the full document.
State: who benefits, what they need to do, and the main outcome.
Then 3–6 bullets for the essential requirements and acceptance criteria in plain language.
If team comments redirected scope, say so in one line.
Do NOT duplicate verbatim tables from below — this is the elevator pitch of what the ticket asks for.>

---

## Context

### Original ticket

<Verbatim-faithful restatement of the ticket: goal, requirements, field tables, query sketches,
acceptance criteria, blocks/blocked-by. Preserve the ticket's own tables and SQL.
Immediately after, one short note if the ticket targets something that does not exist
in the codebase.>

### Team comments

<Each relevant comment, who wrote it, and what it changes relative to the description.
Include SQL stubs and formulas verbatim inside fenced blocks. Make explicit which
comment is authoritative.>

---

## Current state analysis

### Ticket vs. codebase discrepancies

| Ticket says | Reality in codebase | Impact |
| ----------- | ------------------- | ------ |

### Current database state

<Real table name and casing, existing columns with type/default/constraint, RLS notes, and — critically —
which of those columns the code actually reads vs. merely persists.>

### Current logic (<affected module>)

<Verbatim current query, filter, ingestion step or UI behaviour, with a code reference block pointing at the real file
and line range.>

### Requested field mapping

| Field requested | Type | Existing equivalent | Action |
| --------------- | ---- | ------------------- | ------ |

### Impacted files

<Grouped by layer: migration / types / services / actions / ingestion / features / components / app routes / middleware / tests.
One line each with the reason.>

### Decisions made

<Numbered. Each decision, the rationale, and whether it was confirmed by the user or is a
recommended default awaiting confirmation.>

### Out of scope

<Deferred items with the reason.>

---

## Implementation plan

<Synthesis placed immediately BEFORE the Claude Code prompt — the "what we will actually do"
summary after analysis. Audience: developer about to run the prompt or reviewer skimming the doc.

Structure:
- **Goal** — one sentence tying ticket intent to the real codebase (not the ticket's imaginary schema).
- **In scope** — numbered or bulleted deliverables, ordered by vertical slice (migration → types → services → actions → ingestion if applicable → features → components → routes → middleware). Each bullet is actionable ("Add column X", "Wire field into ListServices public read", "Expose toggle on /mis-listas/[slug]").
- **Out of scope** — one line each, why deferred.
- **Key risks / compatibility** — only if non-obvious (RLS, public routes, stub media_items, data migration).
- **Acceptance criteria mapping** — short table or list: AC-id → how implementation satisfies it.

Do NOT paste the full XML prompt here. Keep this section under ~40 lines when possible.>
---

## Claude Code prompt

```xml
<task id="..." title="...">
  ...
</task>
```
````

### Spanish companion file

`<slug>_esp.md` mirrors the structure one-to-one with these headings, and reuses the exact same tables and code references translated into Spanish:

| Primary (English)                       | `_esp.md` (Spanish)                     |
| --------------------------------------- | --------------------------------------- |
| `## Ticket summary`                     | `## Resumen del ticket`                 |
| `## Context`                            | `## Contexto`                           |
| `### Original ticket`                   | `### Ticket original`                   |
| `### Team comments`                     | `### Comentarios del equipo`            |
| `## Current state analysis`             | `## Análisis del estado actual`         |
| `### Ticket vs. codebase discrepancies` | `### Discrepancias ticket vs. proyecto` |
| `### Current database state`            | `### Estado actual en la base de datos` |
| `### Current logic (...)`               | `### Lógica actual (...)`               |
| `### Requested field mapping`           | `### Mapeo de campos solicitados`       |
| `### Impacted files`                    | `### Archivos impactados`               |
| `### Decisions made`                    | `### Decisiones tomadas`                |
| `### Out of scope`                      | `### Fuera de alcance`                  |
| `## Implementation plan`                | `## Plan de implementación`             |
| `## Claude Code prompt`                 | `## Prompt para Claude Code`            |

Add a one-line note under the title of `_esp.md` pointing at the primary file as the source of truth, and keep the XML prompt untranslated.

Identifiers are never translated in either file: table names, column names, file paths, type names, enum values and SQL stay verbatim. Only prose, table headers and explanatory notes are translated.

## XML prompt requirements

The prompt must be **self-contained**: a fresh agent with no chat history must be able to execute it. Never write "as discussed above" or reference the document's own analysis sections — restate the facts inside the prompt.

### Element order and purpose

| Element                                   | Required                   | Content                                                                                                                         |
| ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `<task id title>`                         | yes                        | Add `depends_on="RIK-xx"` when the ticket is blocked by another                                                                 |
| `<role>`                                  | yes                        | Senior full-stack engineer on Rikuna (Next.js 16 App Router + Supabase)                                                         |
| `<mandatory_reading>`                     | yes                        | Exact file paths to read first — architecture docs, then the real files the change touches                                      |
| `<context>`                               | yes                        | Background, existing fields with their real types/defaults, and what is genuinely new                                           |
| `<ground_truth_db_notes critical="true">` | when DB is involved        | One `<note>` per verified fact that contradicts what an agent would otherwise assume                                            |
| `<story>`                                 | when the ticket has one    | User story, verbatim                                                                                                            |
| `<requirements>`                          | yes                        | Ordered `<phase title="...">` blocks following the vertical slice: DB → types → services → actions → ingestion → features → routes |
| `<acceptance_criteria>`                   | yes                        | `<criterion id="AC-1">` … each independently verifiable, with the verification method inline                                    |
| `<constraints>`                           | yes                        | Hard prohibitions, especially "do NOT rename existing column X", "do NOT import admin.ts from user-facing actions"              |
| `<out_of_scope>`                          | yes                        | Explicitly deferred work, so the agent does not expand scope                                                                    |
| `<implementation_notes>`                  | when useful                | Concrete file paths and function signatures to create                                                                           |
| `<deliverables>`                          | yes                        | Artifacts, tests, `CHANGELOG.md` entry, `specs/logs/` work log, and "run lint/typecheck and fix introduced issues"              |
| `<clarify_before_coding>`                 | when open questions remain | Each with the default to proceed with if unanswered                                                                             |
| `<completion_report>`                     | yes                        | Verification report + persisted changelog/log + PR, commit, issue-tracker comment and manual validation deliverables — see below |

### `<mandatory_reading>` rules

Always include, in this order:

1. `ARCHITECTURE.md` — layered + feature-sliced layout, auth boundaries, ingestion vs user actions.
2. `AGENTS.md` — Next.js version caveats; read the relevant doc under `node_modules/next/dist/docs/` when there is any Next.js work.
3. `.cursor/commands/makecommit.md` — the commit format and emoji mapping needed by the `<completion_report>` commit deliverable.
4. The relevant PRD under `specs/` when the ticket touches product behaviour or UI (`RIKUNA-PRD-documento-especificacion-rikuna.md`, `RIKUNA-PRD-schema-basedatos-rikuna.md`, `RIKUNA-PRD-vistas-y-estilo-rikuna.md`).
5. Every real file the change touches, by exact path, with a short reason.
6. The most recent related migration in `supabase/migrations/`, so the agent sees current schema truth.
7. `CHANGELOG.md` — format and where to append entries.
8. `specs/logs/README.md` — work log filename and template.

### `<deliverables>` rules

Always end with:

- Run `npm run lint` (and tests when added) and fix introduced issues.
- Persist documentation via `<completion_report>` `<persistence>`: one bullet in `CHANGELOG.md` under `[Unreleased]` and one file in `specs/logs/`.

### `<ground_truth_db_notes>` rules

This is the highest-value element — it prevents the agent from coding against the ticket's imaginary schema. One `<note>` per fact, phrased as a correction:

- Real table name and casing when the ticket used a different one.
- Columns that already exist and must be reused instead of created.
- Columns that do **not** exist and must not be assumed.
- Real column names for concepts the ticket names differently.
- RLS and public-read exceptions (`user_lists.is_public`, `(public)` routes).
- Dependent objects that will break: views, RLS policies, triggers.

### `<acceptance_criteria>` rules

- Give every criterion a stable `id` (`AC-1`, `AC-2`, …) so the completion report can answer each one.
- Derive them from the ticket's own criteria, then add any the analysis proved necessary (backward compatibility, no data loss, public access when required).
- Make each one verifiable and say how: a SQL query, a filter result, an observable UI state, a passing test.
- Escape XML entities: `&lt;`, `&gt;`, `&amp;`.

### `<completion_report>` — always include

Three parts: the verification report (read once, by the developer), **persisted project documentation** (written to disk), and four copy-paste deliverables (GitHub, git, issue tracker and manual validation). Verbatim shape:

```xml
<completion_report>
  When finished, produce the verification report first, persist changelog and work log,
  then the four copy-paste deliverables. Everything in English. Each copy-paste deliverable
  goes in its OWN fenced code block — do not merge them into one block.
  Present deliverables in this order: pr_description, commit_message, issue_comment,
  manual_validation (manual_validation MUST be last — it is the human test guide).

  <verification_report>
    <item>A summary of every change made, grouped by file (created / modified / deleted) with a one-line reason each.</item>
    <item>For EACH acceptance criterion (AC-1 … AC-n): the criterion id, a PASS / FAIL / PARTIAL verdict, and the concrete evidence used to verify it (query output, test name, filter result, or UI state). Do not mark a criterion PASS without evidence.</item>
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
      <item>Set snake_case_slug to match the backlog spec filename (e.g. public_list_view for specs/backlog/RIK-12_public_list_view.md).</item>
      <item>If that exact log path already exists (same-minute collision), append a dated "## Addendum YYYY-MM-DD HH:mm" section at the bottom — do not overwrite prior work.</item>
      <item>Link to the backlog spec path in the metadata table when one exists under specs/backlog/.</item>
      <item>In the chat response after persistence, state the exact paths written: CHANGELOG.md and the specs/logs/ file.</item>
    </work_log>
  </persistence>

  <deliverable name="pr_description" format="markdown code block">
    <item>English markdown, ready to paste as the pull request description.</item>
    <item>Structure: "## Summary" (2–4 sentences on what changed and why), "## Changes" (bullets grouped by layer: migration / types / services / actions / ingestion / features / components / routes), "## Acceptance criteria" (one line per AC-x with its verdict), "## Test plan" (checklist of how a reviewer verifies it), "## Notes" (only when there are TODOs, follow-ups or deferred scope).</item>
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
    <item>Structure: one opening line stating the work is done and what it enables; a short "What changed" list in plain language; an "Acceptance criteria" list restating each AC in business terms with a done / not done marker; optional "Screenshots" section when visuals matter (see below); a closing "Notes" line only when something was deferred or needs a decision.</item>
    <item>NON-TECHNICAL: no file paths, no column or table names, no type names, no framework or library names, no SQL. Translate them into product language (for example say "the subscription picker" instead of naming the component, "the watched filter on the library" instead of naming columns).</item>
    <item>Keep it under 15 lines for the core comment (excluding the Screenshots section). State outcomes, not implementation.</item>
    <item>When a criterion is not fully met, say so plainly and state what is missing — never overstate completion.</item>

    <item>Screenshots — include a "## Screenshots" section ONLY when the ticket has user-visible UI changes (new screen, layout, form fields, public share page, styling). Omit for pure backend, schema-only, ingestion-only, or config tickets with no visual delta.</item>
    <item>Do NOT embed images in the markdown — attachments are added by the human. Instead, list what to capture as numbered items, each with: screen/area name, auth state if relevant, and what the screenshot should show (e.g. "Public list — logged out: shared list at /l/abc123 with poster grid and no personal actions").</item>
    <item>Suggest 1–4 screenshots max — only views that prove the AC.</item>
    <item>Prefix each screenshot line with a placeholder the poster can replace after attaching: `[attach: short label]` so they know which file goes where.</item>
  </deliverable>

  <deliverable name="manual_validation" format="markdown code block">
    <item>English markdown — the LAST deliverable. A practical guide for a human (developer or QA) to confirm the work works. Tailor content to what the ticket actually changed; UI and database sections are NOT both mandatory.</item>

    <item>Classify the ticket and include ONLY the sections that apply:
      - UI-focused (new screens, forms, layout, navigation, public vs authenticated views): include "## UI validation" with numbered steps — route/URL, auth state, precondition (e.g. active subscription), each click/input, and the expected visible result per step.
      - Database or schema (migrations, columns, constraints, seeds): include "## Database validation" with runnable SQL in fenced blocks — use real table/column names from the codebase; state what each query should return (row count, column presence, sample values).
      - Ingestion / business logic (catalog snapshots, IMDb import, recommendations): include "## Logic validation" — inputs to set, how to trigger the routine or query, and the expected outcome; add SQL only when it helps inspect persisted outputs.
      - Mixed UI + DB/logic: include both relevant sections (and Logic if calculations changed).
      - Other (config, CI, docs-only, refactor with no user-visible change): include "## How to validate" — analyze what changed and propose the most direct check (command to run, file to inspect, test to execute, or observable side effect).
    </item>

    <item>Structure when multiple sections apply:
      "## Prerequisites" (dev server running, env vars, seed data, user to log in as — only what is needed),
      then the applicable section(s) above,
      then "## Expected outcome" (1–3 bullets tying back to acceptance criteria).</item>

    <item>Use concrete app paths from this project when known (e.g. `/panel`, `/biblioteca`, `/mis-listas`, `/l/[codigo]`, `/importar`, `/suscripciones`, `/titulo/[slug]`). Note `(public)` routes when the ticket touches unauthenticated access.</item>
    <item>SQL must be read-only verification queries — no INSERT/UPDATE/DELETE unless the ticket explicitly required data migration and the user must confirm migrated rows.</item>
    <item>Do not duplicate the full PR test plan — this guide is for manual smoke testing after deploy or local run, written for someone who may not have read the PR.</item>
  </deliverable>
</completion_report>
```

Adapt the parenthetical examples in `issue_comment` and route examples in `manual_validation` to the ticket's own domain. Keep the `issue_comment` prohibition list intact — it stops column names from reaching stakeholders. Keep the `manual_validation` rule that UI and DB sections are optional and must match what the ticket actually changed.

## Quality bar

Before saving, verify the document against each of these:

- Every table, column, type and file path in the prompt was confirmed by reading the codebase — not copied from the ticket.
- Every field the ticket asked to create was checked against existing columns, and reuse decisions are stated in `<constraints>`.
- Each `AC-x` is verifiable and has a stated verification method.
- Nothing in the prompt depends on the document's narrative sections or on chat history.
- Recommendation/availability rules that need reference data with no source table are handled with an explicit fallback plus a `TODO`, and are not left blocking the migration.
- Constraints name the specific columns that must not be renamed or dropped, and call out `admin.ts` boundaries when ingestion is involved.
- Any DB change is described as a **new** timestamped migration in `supabase/migrations/` — never an edit to an existing one.
- Public-route and RLS implications are explicit when the ticket touches lists, title pages or shared links.
- The primary file is fully English; `_esp.md` has Spanish prose with the XML prompt copied verbatim and untranslated.
- Both files exist, have the same section order (`Ticket summary` → `Context` → analysis → `Implementation plan` → prompt), and their prompt blocks are identical.
- `Ticket summary` at the top is a short elevator pitch of what the ticket asks; `Implementation plan` before the prompt summarizes what will be built after analysis.
- `<completion_report>` includes `<persistence>` requiring updates to `CHANGELOG.md` and a new `specs/logs/` file.
- `<completion_report>` carries the verification report plus PR description, commit message, non-technical issue comment, and manual validation guide — each in its own fenced block; manual_validation is always last.
- The commit deliverable points at `.cursor/commands/makecommit.md` rather than restating the emoji mapping.
- The issue comment rules forbid file paths, table/column names and library names, with domain-appropriate replacement examples; UI tickets should include an optional Screenshots section with capture instructions, not embedded images.

## Closing

After writing both files, report in chat:

1. The two paths created.
2. A 3–5 line summary of the scope the prompt covers.
3. Any open question still awaiting an answer, and the default the prompt will proceed with.

This command is available in chat with `/ticket-to-backlog`.
