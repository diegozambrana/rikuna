---
description: End-to-end ticket workflow — analyze a ticket against the Rikuna codebase and write its English + Spanish spec documents in specs/backlog/ in a single request
alwaysApply: false
---

# Spec Ticket

Runs the full ticket workflow in one request: investigate the ticket against the real state of the codebase, then write its spec documents with the coding-agent prompt to `specs/backlog/`.

Use this when the ticket is reasonably well defined and you want the finished documents in one pass. Use the split commands instead when you want to review the analysis before committing to a scope:

- `/analyze-ticket` — analysis only, no files written
- `/ticket-to-backlog` — documents only, from an analysis already in the chat

## Rules source

Do not restate the rules here. Load and apply both command files in full:

1. `.cursor/commands/analyze-ticket.md` — ground rules, investigation checklist, required analysis output.
2. `.cursor/commands/ticket-to-backlog.md` — filename convention, document structure, XML prompt requirements, `<completion_report>`, quality bar.

This command only defines how the two phases are sequenced and where the single question checkpoint sits.

## Input

The user pastes the ticket description plus any team comments. The ticket ID is required — it determines the filenames. If it is missing, ask for it before starting.

## Sequence

### Phase 1 — Investigate (silent)

Run the full investigation checklist from `analyze-ticket.md`. Read real files; verify every table, column, type and default against `supabase/migrations/` and `specs/RIKUNA-PRD-schema-basedatos-rikuna.md`. Do not narrate each step — a short progress note when you find something load-bearing is enough.

### Phase 2 — Question checkpoint (single, batched)

This is the **only** point where you stop. Classify every open question:

**Blocking** — must be answered before writing the documents:

- The ticket names a table or column that does not exist and more than one real target is plausible.
- A requested field duplicates an existing one and reusing vs. renaming is a breaking-change decision.
- The requested default contradicts the current column default in a way that would alter existing rows.
- A recommendation or availability rule needs reference data with no candidate source table.
- The ticket touches public sharing but does not clarify whether unauthenticated access is required.
- Acceptance criteria are untestable as written.

**Non-blocking** — proceed with the recommended default and record it under `Decisions made` and in `<clarify_before_coding>`:

- Naming of new files, functions or types.
- Which existing feature slice to mirror.
- Test placement and granularity.
- Anything where a wrong guess is cheap to correct and breaks nothing.

If there are blocking questions, present them all at once with your recommended default for each, then wait. Never ask them one at a time across several turns — that defeats the purpose of a single-request command.

If there are none, continue straight to Phase 3 without stopping.

If the user answers only some questions, or replies with something like "proceed" / "usa los defaults", continue using the recommended defaults for the rest and mark them as unconfirmed in the document.

### Phase 3 — Write the documents

Write **both** files following `ticket-to-backlog.md` exactly:

1. `specs/backlog/<TICKET-ID>_<snake_case_slug>.md` — primary, fully English: `Ticket summary`, `Context`, `Current state analysis`, `Implementation plan`, then `Claude Code prompt` with the full `<completion_report>` block.
2. `specs/backlog/<TICKET-ID>_<snake_case_slug>_esp.md` — same structure with Spanish headings and prose, and the XML prompt copied verbatim and untranslated.

Identifiers stay verbatim in both files: table names, column names, file paths, type names and SQL are never translated.

Confirm neither file already exists before writing. If either does, ask whether to overwrite or version it.

### Phase 4 — Report

In chat, report:

1. The two paths created.
2. A compact version of the analysis: the ticket-vs-reality discrepancies, the field mapping verdicts, and the scope the prompt covers. Keep it readable — the user should be able to sanity-check the scope without opening the file.
3. Every decision recorded as an unconfirmed default, so the user can correct it before handing the prompt to the coding agent.
4. Whether the prompt is ready to execute or still blocked.
5. That completed implementations will persist `CHANGELOG.md` and `specs/logs/<YYYYMMDDHHmm>_<TICKET-ID>_<slug>.md` per `<completion_report>` `<persistence>`.

## Guardrails

- Never skip Phase 1 to save time. A prompt built on the ticket's unverified table and column names is worse than no prompt, and this command's whole value is that the prompt is grounded in the real schema.
- Never write the documents while a blocking question is unanswered.
- Do not implement the ticket. This command produces analysis and spec documents only — no migrations, no code changes, no `supabase` commands.
- The only files this command creates are the two under `specs/backlog/`.

This command is available in chat with `/spec-ticket`.
