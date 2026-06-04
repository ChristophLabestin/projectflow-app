# ProjectFlow Codex API

Date: 2026-05-26

## Purpose

The Codex API lets coding sessions update ProjectFlow automatically from any repository. A session can start, checkpoint, finish, and create follow-up tasks without relying on manual app cleanup.

## Authentication

Use a ProjectFlow API token with the Codex Full Access preset. The current implementation reuses existing API permissions:

- `tasks:read` for listing Codex sessions and follow-ups.
- `tasks:write` for task sessions, checkpoints, finish calls, and follow-up creation.
- `initiatives:write` when starting a session with `entity: "initiative"`.

Production API base URL:

`https://europe-west3-project-manager-9d0ad.cloudfunctions.net/api`

Production web route:

`https://project-manager-9d0ad.web.app/project/{projectId}/codex`

## Endpoints

All endpoints are hosted under `/api/projectflow`.

### List Sessions

`GET /projects/:projectId/codex/sessions`

Returns the latest 100 Codex session docs ordered by `updatedAt`.

### Start Session

`POST /projects/:projectId/codex/sessions/start`

Creates or updates a linked task or initiative and opens a session in `codex_sessions`.

Important body fields:

- `externalKey`: stable idempotency key. If omitted, the API derives one from project, repo, branch, and title/request.
- `entity`: `task` or `initiative`.
- `title`, `summary`, `request`
- `repoPath`, `repoName`, `branch`, `commitSha`
- `filesTouched`, `validationStatus`

### Checkpoint Session

`POST /projects/:projectId/codex/sessions/checkpoint`

or

`POST /projects/:projectId/codex/sessions/:sessionId/checkpoint`

Records a checkpoint under `codex_sessions/:sessionId/checkpoints` and updates the parent session with latest phase, validation, and touched files.

### Finish Session

`POST /projects/:projectId/codex/sessions/finish`

or

`POST /projects/:projectId/codex/sessions/:sessionId/finish`

Marks the session as `completed`, `blocked`, or `partial`, updates the linked task or initiative, and creates optional follow-ups.

### List Follow-Ups

`GET /projects/:projectId/codex/followups`

Returns the latest 100 Codex follow-up inbox docs.

### Bulk Create Follow-Ups

`POST /projects/:projectId/codex/followups/bulk-create`

Creates or updates ProjectFlow tasks with `source: "codex_followup"` and mirrors them into `codex_followups` for the Codex Inbox.

Body:

```json
{
  "sessionId": "optional",
  "sessionExternalKey": "optional",
  "followUps": [
    {
      "title": "Add E2E coverage for Codex screen",
      "description": "Cover authenticated rendering once a seeded test user exists.",
      "priority": "Medium",
      "filesTouched": ["web/screens/ProjectCodex.tsx"]
    }
  ]
}
```

## Firestore Model

- `tenants/{tenantId}/projects/{projectId}/codex_sessions/{sessionId}`
- `tenants/{tenantId}/projects/{projectId}/codex_sessions/{sessionId}/checkpoints/{checkpointId}`
- `tenants/{tenantId}/projects/{projectId}/codex_followups/{followupId}`
- `tenants/{tenantId}/projects/{projectId}/activities/{activityId}` with `type: "codex"`
- Linked tasks use `codexManaged`, `codexSessionExternalKey`, and optional `source: "codex_followup"`.

## Plugin Package

The repo-local package lives at `plugins/projectflow-codex`.

Use:

```bash
python3 plugins/projectflow-codex/scripts/projectflow_session.py start --title "Implement feature"
python3 plugins/projectflow-codex/scripts/projectflow_session.py checkpoint --external-key "codex:..." --phase validation --validation-status passed
python3 plugins/projectflow-codex/scripts/projectflow_session.py finish --external-key "codex:..." --status completed
```
