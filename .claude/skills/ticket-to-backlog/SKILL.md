---
name: ticket-to-backlog
description: Write English and Spanish backlog spec documents in specs/backlog/ from an analyzed ticket, including XML Claude Code prompt with completion_report. Use after /analyze-ticket or when the chat already contains ticket vs codebase analysis.
disable-model-invocation: true
---

# Ticket to Backlog

Writes two backlog documents from ticket analysis — **does not implement the ticket**.

## Mandatory reading

Read and follow **in full**:

1. `.cursor/commands/ticket-to-backlog.md` — filenames, document structure, XML prompt rules, `<completion_report>`, quality bar.

If the current conversation **does not** already contain a full analysis (discrepancies, field mapping, impacted files, open questions), read and run first:

2. `.cursor/commands/analyze-ticket.md`

## User input

Optional context from `$ARGUMENTS` (ticket ID, decisions on open questions, or "use defaults").

If ticket ID is missing from chat and arguments, ask before writing files.

## Output files

Create **both**:

1. `specs/backlog/<TICKET-ID>_<snake_case_slug>.md` — English, source of truth
2. `specs/backlog/<TICKET-ID>_<snake_case_slug>_esp.md` — Spanish narrative, XML prompt copied verbatim

Document sections (in order):

- `Ticket summary` / `Resumen del ticket`
- `Context` / `Contexto`
- `Current state analysis` / `Análisis del estado actual`
- `Implementation plan` / `Plan de implementación`
- `Claude Code prompt` / `Prompt para Claude Code` (XML `<task>` with full `<completion_report>`)

Confirm neither file exists before writing; if either exists, ask to overwrite or version.

## Guardrails

- Do not implement the ticket (no migrations, no feature code).
- Only create files under `specs/backlog/`.
- Report both paths created and a compact scope summary in chat.
