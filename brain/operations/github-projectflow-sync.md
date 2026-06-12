# GitHub ProjectFlow Sync

Date: 2026-06-04

## Purpose

ProjectFlow can import GitHub Issues into project Tasks and preserve GitHub Projects v2 field data for migration away from GitHub issue/project management.

GitHub Issues are represented as ProjectFlow tasks, not as the deprecated ProjectFlow Issues module.

## Import Existing GitHub Issues

Use the repo-local import script:

```bash
node scripts/import-github-issues-to-projectflow.mjs \
  --repo owner/repo \
  --projectflow-project-id PROJECTFLOW_PROJECT_ID \
  --github-token GITHUB_TOKEN \
  --projectflow-token PROJECTFLOW_API_TOKEN \
  --github-project-owner OWNER \
  --github-project-number PROJECT_NUMBER
```

Run a preview first:

```bash
node scripts/import-github-issues-to-projectflow.mjs \
  --repo owner/repo \
  --projectflow-project-id PROJECTFLOW_PROJECT_ID \
  --github-token GITHUB_TOKEN \
  --dry-run
```

The GitHub token needs repository issue read access. To read Projects v2 fields, it also needs project read access, commonly `read:project` for classic PATs or equivalent fine-grained permissions.

## Mapping

- GitHub issue title -> ProjectFlow task title.
- GitHub issue body + source footer -> task description.
- GitHub labels -> task `category`; priority is inferred from common labels such as urgent, critical, p0, high, p1, low, and p3.
- GitHub state -> `Done` for closed issues, otherwise status is inferred from the GitHub Projects v2 Status/State field when present.
- GitHub Projects v2 Due Date/Due/Deadline -> task `dueDate`.
- GitHub assignees -> task `assigneeIds` only when an `--assignee-map` JSON file maps GitHub login to ProjectFlow uid.
- GitHub issue identity -> task `externalKey`, `source`, `githubRepo`, `githubIssueNumber`, `githubIssueUrl`, `githubIssueNodeId`, and `githubIssueState`.
- GitHub Projects v2 fields -> task `githubProjectV2Fields`.

The import is idempotent through `externalKey: "github:{owner/repo}:issue:{number}"`.

## ProjectFlow To GitHub

The Cloud Function `onProjectTaskGitHubSync` watches task writes at:

`tenants/{tenantId}/projects/{projectId}/tasks/{taskId}`

When a project has `githubIssueSync: true` and `githubRepo`, newly created non-imported ProjectFlow tasks create a GitHub Issue automatically. The sync uses a project-level `githubToken` only when present, otherwise it falls back to the project owner's account-level `users/{uid}.githubToken`. Imported GitHub tasks are guarded by `source: "github_issue"` and `externalKey: "github:..."` so they do not create duplicate GitHub Issues.

For tasks already linked to a GitHub issue, changes to title, description, status, or completion state patch the GitHub issue. `Done` or `isCompleted: true` closes the GitHub issue; other states keep it open.

## Deployment

After changing the sync function:

```bash
cd functions && npm run build
firebase deploy --only functions:onProjectTaskGitHubSync
```

If `functions/src/projectflow-api.ts` changed too, deploy the API function that hosts the ProjectFlow API route.
