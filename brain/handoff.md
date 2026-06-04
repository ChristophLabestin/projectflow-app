# Handoff

Last updated: 2026-06-04

## Where Things Stand

The repository has been migrated into `/brain`, the active Web/Swift removal path for Flows/Ideas and Issues remains in place, and project task detail now has a Full Workbench redesign.

## What Changed Recently

- Created app-type Brain core files.
- Moved former root product, route, styling, permission, Firestore, mobile, privacy, and agent docs into `brain/reference/app/`.
- Moved old planning docs into `brain/plans/`.
- Moved provisioning and Codex API docs into `brain/operations/`.
- Moved audit docs into `brain/audits/`.
- Moved `web/docs/COMPANY_PROJECTS_PLAN.md` into `brain/web/`.
- Updated root `README.md`, `AGENTS.md`, and `GEMINI.md` to point contributors into `brain/`.
- Updated `swift/README.md` to reference migrated Brain paths.
- Verified local Markdown links resolve.
- ProjectFlow tracking was attempted but failed because `PROJECTFLOW_API_TOKEN` is missing.
- Updated PM-core config so only `ideas`/`flows` and `issues` are deprecated.
- Removed PM-core redirects from Milestones, Social, and Marketing project routes.
- Added Accounting to project sidebar navigation when the module is enabled.
- Updated PM-core tests and docs.
- Removed remaining Web imports of deleted Flow/Issue components, modals, locale chunks, and domain services.
- Removed global Flow/Issue create shortcuts, search result sections, Project Settings module toggles, Project List Flow/Issue counters, and Health scoring factors for Flow/Issue data.
- Filtered legacy pinned issue items out of the focus/pinned context and removed visible Swift pinned copy that still mentioned issues.
- Verified the Swift project no longer references deleted Flow/Issue view/store files.
- Redesigned `web/screens/ProjectTaskDetail.tsx` into a Task Full Workbench with an open header, single command rail, Work/Discussion/History tabs, next-step/blocker/reminder/quick-log task fields, flatter screenshot-aligned main work area, subtasks table, comments/history tabs, labels/dependencies/milestone/context/details/activity inspector sections, and focus/pin/edit/delete actions.
- Added optional `Task` metadata fields: `nextStep`, `blockerNote`, `reminderAt`, and `lastWorkbenchNote`.
- Rebuilt `web/src/styles/components/_project-task-detail.scss` around the screenshot-like open layout with less card nesting.
- Updated task-detail i18n keys and Brain route/styling/Firestore references.

## Next Best Move

Check the UI in an authenticated browser session at a real `/project/:id/tasks/:taskId`: verify command rail edits, Work/Discussion/History tabs, next-step/blocker/reminder/quick-log saves, subtasks, comments, dependencies, labels, milestone, and responsive behavior.

## Watchouts

- Do not treat `brain/plans/` as automatically implemented state.
- Do not invent a ProjectFlow task id for this migration; create the real record once credentials are available.
- ProjectFlow tracking for the PM-core fix also failed because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the Task Full Workbench redesign also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- Playwright unauthenticated route QA redirects task detail URLs to `/login`; build/theme validation passed, but real task visual QA still needs an authenticated session.
- `web/.vite/deps/_metadata.json` is a dev-server cache change; avoid mixing it into a source commit unless intentionally tracking cache state.
- Some legacy type fields, i18n keys, docs, Firestore collection constants, and GitHub API "issues" terminology still exist where they are compatibility data, historical documentation, or GitHub-native vocabulary rather than active ProjectFlow issue-module UI.
