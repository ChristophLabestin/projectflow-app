# ProjectFlow Codex Plugin

This repo-local plugin package gives Codex a durable workflow for keeping ProjectFlow current while work happens in other repositories.

## What It Syncs

- Session start: upserts a ProjectFlow task or initiative and opens a Codex session record.
- Checkpoints: records phase, summary, touched files, commands, and validation status.
- Finish: marks the linked task or initiative as done, blocked, or partial.
- Follow-ups: creates actionable ProjectFlow tasks and a Codex Inbox item for each follow-up.

## Recommended: MCP with sign-in (no script needed)

Codex, Claude Code and other agents can use the ProjectFlow MCP server directly — the `codex_*` tools cover start, checkpoint, finish and follow-ups:

```bash
codex mcp add projectflow --url https://app.getprojectflow.com/mcp
codex mcp login projectflow
```

Setup for every client: ProjectFlow → Workspace settings → AI & integrations. The script below stays for CI and shells without MCP.

## Required Configuration (script)

Set these values in the Codex environment or local shell profile:

- `PROJECTFLOW_API_BASE_URL`: API root, for example `https://europe-west3-projectflow-labestin.cloudfunctions.net/api`.
- `PROJECTFLOW_API_TOKEN`: a personal access token (`pfp_…`, Workspace settings → AI & integrations → Personal access tokens, "Read & write"). Legacy workspace tokens (`pfat_…`, Codex Full Access preset) keep working.
- `PROJECTFLOW_PROJECT_ID`: default ProjectFlow project id for the current repo.

Optional:

- `PROJECTFLOW_TENANT_ID`: tenant override when the API token is not tenant-scoped.

## CLI Examples

```bash
python3 plugins/projectflow-codex/scripts/projectflow_session.py start \
  --project-id ogZ8Pyz8pwEQtv8I64nu \
  --title "Implement retention phase" \
  --summary "Starting backend and web Codex integration" \
  --entity task

python3 plugins/projectflow-codex/scripts/projectflow_session.py checkpoint \
  --project-id ogZ8Pyz8pwEQtv8I64nu \
  --external-key "codex:example" \
  --phase validation \
  --summary "Functions build passed" \
  --validation-status passed \
  --file functions/src/projectflow-api.ts

python3 plugins/projectflow-codex/scripts/projectflow_session.py finish \
  --project-id ogZ8Pyz8pwEQtv8I64nu \
  --external-key "codex:example" \
  --status completed \
  --summary "Implemented and validated"
```
