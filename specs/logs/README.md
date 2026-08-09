# Implementation logs

One file per completed ticket implementation. Created by the coding agent when finishing work from a `specs/backlog/` prompt (see `<completion_report>` / `<persistence>` in those specs).

## Filename

```
<YYYYMMDDHHmm>_<TICKET-ID>_<snake_case_slug>.md
```

Examples:

- `202608091430_RIK-12_public_list_view.md`
- `202608101015_RIK-8_subscription_picker.md`

- **Timestamp prefix** = completion time when the implementation finished: `YYYYMMDDHHmm` (year, month, day, hour, minute — no separators). Use the local time at completion.
- **Ticket ID** = tracker id (e.g. `RIK-12`).
- **Slug** = same snake_case slug as the matching `specs/backlog/` document.

Files sort chronologically by filename. Multiple completions of the same ticket produce separate log files (different timestamps).

## Relationship to other artifacts

| Artifact | Purpose | Audience |
|---|---|---|
| `CHANGELOG.md` | Short, cumulative release notes | Everyone; release history |
| `specs/logs/*.md` | Detailed work record for one ticket | Developers; audit and onboarding |
| `specs/backlog/*.md` | Pre-implementation spec + XML prompt | Planning and agent execution |

Do not paste the full file list into `CHANGELOG.md` — keep changelog bullets user-facing (1–3 lines). Put technical detail here.

## Log template

Copy this structure when creating a new log file:

```markdown
# <TICKET-ID> — <title>

| Field | Value |
|---|---|
| Ticket | <TICKET-ID> |
| Completed | <YYYY-MM-DD HH:mm> (local) |
| Log file | `specs/logs/<YYYYMMDDHHmm>_<TICKET-ID>_<slug>.md` |
| Backlog spec | `specs/backlog/<file>.md` |
| Status | completed / partial |

## Summary

2–4 sentences: what was delivered and why it matters.

## Scope delivered

- Bullet list of outcomes (layer-oriented: DB, types, services, actions, ingestion, UI).

## Files changed

### Created

- `path/to/file` — reason

### Modified

- `path/to/file` — reason

### Deleted

- `path/to/file` — reason (if any)

## Acceptance criteria

| ID | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS / FAIL / PARTIAL | How it was verified |

## Decisions

- Decision and rationale (only non-obvious choices).

## Deferred / follow-ups

- TODO items and suggested future ticket (if any).

## Verification

- Commands run (`npm run lint`, tests) and result.

## Manual validation

Copy from the `manual_validation` deliverable: UI steps, SQL checks, or other validation guide tailored to this ticket.
```
