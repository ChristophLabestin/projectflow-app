# ProjectFlow Codex Plugin

This repo-local plugin package gives Codex a durable workflow for keeping ProjectFlow current while work happens in other repositories.

## What It Syncs

- Session start: upserts a ProjectFlow task or initiative and opens a Codex session record.
- Checkpoints: records phase, summary, touched files, commands, and validation status.
- Finish: marks the linked task or initiative as done, blocked, or partial.
- Follow-ups: creates actionable ProjectFlow tasks and a Codex Inbox item for each follow-up.

## Required Configuration

Set these values in the Codex environment or local shell profile:

- `PROJECTFLOW_API_BASE_URL`: API root, for example `https://europe-west3-project-manager-9d0ad.cloudfunctions.net/api`.
- `PROJECTFLOW_API_TOKEN`: ProjectFlow API token with the Codex Full Access preset.
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
