---
name: projectflow-codex
description: Use when Codex should link a repository to ProjectFlow, start a coding session, record checkpoints, finish work, or create ProjectFlow follow-up tasks from a coding session.
---

# ProjectFlow Codex

Use this skill when a coding task should keep ProjectFlow truthful without manual cleanup.

## Required Context

- Project id from `.projectflow/project.json`, `PROJECTFLOW_PROJECT_ID`, or the user.
- API base URL from `PROJECTFLOW_API_BASE_URL`.
- API token from `PROJECTFLOW_API_TOKEN`.
- Optional tenant id from `PROJECTFLOW_TENANT_ID`.

## Workflow

1. Start a session before meaningful edits:
   - `python3 plugins/projectflow-codex/scripts/projectflow_session.py start --title "<scope>" --summary "<starting context>"`
2. Record checkpoints after meaningful milestones:
   - include `--phase`, `--summary`, one or more `--file`, and `--validation-status` when available.
3. Finish the session:
   - use `--status completed`, `--status blocked`, or `--status partial`.
   - add follow-ups with `--follow-up-title` for new work discovered during implementation.

## Guidance

- Use `--entity initiative` when the work is a multi-route feature, migration, or broad plan session.
- Use `--entity task` for normal implementation slices.
- Keep checkpoint summaries concise and evidence-based.
- Put new TODOs into follow-ups instead of leaving them only in chat.
- Keep the ProjectFlow task or initiative status aligned with the actual session outcome.
