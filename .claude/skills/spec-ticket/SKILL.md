---
name: spec-ticket
description: End-to-end ticket workflow for FlowLogic — analyze a ticket against the codebase and write English + Spanish backlog specs in specs/backlog/ with Claude Code XML prompt. Use when the user wants backlog documents in one pass from a pasted Linear ticket.
disable-model-invocation: true
---

# Spec Ticket

Full ticket workflow in one request: investigate → (optional question checkpoint) → write backlog specs.

**Does not implement the ticket.**

## Mandatory reading

Read and follow **in full**:

1. `.cursor/commands/spec-ticket.md` — phase sequencing and question checkpoint
2. `.cursor/commands/analyze-ticket.md` — investigation checklist
3. `.cursor/commands/ticket-to-backlog.md` — document structure, XML prompt, quality bar

## User input

Paste the full ticket via `$ARGUMENTS`. Required: ticket ID (e.g. `FLO-106`). Include description, acceptance criteria, and team comments.

If ticket ID is missing, ask before starting Phase 1.

## Sequence

1. **Investigate** — Run `analyze-ticket.md` checklist silently; verify schema against `supabase/migrations/`.
2. **Question checkpoint** — Batch all blocking questions once with recommended defaults; skip if none.
3. **Write documents** — Both files in `specs/backlog/` per `ticket-to-backlog.md`:
   - `<TICKET-ID>_<slug>.md` (English)
   - `<TICKET-ID>_<slug>_esp.md` (Spanish + identical XML)
4. **Report** — Paths, compact analysis, unconfirmed defaults, ready/blocked status.

## Guardrails

- Never skip investigation.
- Never write backlog while blocking questions are unanswered.
- Only create files under `specs/backlog/`.
- Identifiers (tables, columns, paths, SQL) stay verbatim in both languages.

## After backlog exists

To implement, run Claude Code on the `## Claude Code prompt` XML from the generated file. The `<completion_report>` will update `CHANGELOG.md`, `specs/logs/`, and produce PR/commit/Linear/manual-validation deliverables.
