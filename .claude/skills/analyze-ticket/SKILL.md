---
name: analyze-ticket
description: Analyze a Linear/Jira ticket against the real FlowLogic codebase, database schema, and HVAC engine before writing code or backlog specs. Use when the user pastes a ticket, asks to analyze FLO-XXX, or wants ticket vs codebase discrepancies.
disable-model-invocation: true
---

# Analyze Ticket

Deep-analysis pass for a single ticket **before** writing any code or spec document.

## Mandatory reading

Read and follow **in full** before investigating:

1. `.cursor/commands/analyze-ticket.md` — ground rules, 7-step checklist, required output structure.

Also read when relevant:

- `.cursor/rules/english-code.mdc`
- `AGENTS.md` (Next.js docs path)

## User input

Ticket content from `$ARGUMENTS`. If empty, ask the user to paste:

- Ticket ID (required, e.g. `FLO-106`)
- Title, description, requirements, acceptance criteria
- Team comments (newest comment may override the description)
- SQL stubs, formulas, screenshots

## Execution rules

- **Output is chat only** — do not create files, do not modify code, do not run migrations.
- Verify every table and column against `supabase/migrations/` — never trust ticket naming (`ENG_LineOutput` vs `eng_line_output`).
- Produce all sections A–G from the Cursor command file.
- End with whether the ticket is **ready to spec** (`/ticket-to-backlog`) or **blocked**.

## Next step

When analysis is approved, run `/ticket-to-backlog` or `/spec-ticket` to write `specs/backlog/`.
