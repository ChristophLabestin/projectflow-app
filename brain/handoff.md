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
- Fixed the Project Overview V2 hero More actions menu clipping by allowing `.po-hero` overflow while keeping the cover image clipped to the hero's top radius.
- Added `TaskRelationshipsPanel` to task detail with blocked-by, is-blocking, parent task, and child task links. `dependencies` remains the blocked-by source of truth, inverse blocking links are derived from other tasks, `parentTaskId` stores task hierarchy, and blocked-by/is-blocking adds automatically set the blocked task to `Blocked`.
- Removed visible element borders and border-like shadows within both Project Overview V2 and legacy overview roots, including page-launched portal modals.
- Removed the duplicate Project Overview Kanban view and made Board the single status-column view. Old `kanban` preferences fall back to `board`; Board now uses compact dark rounded lanes, pill headers, count badges, centered empty states, and standard status colors across Project Overview V2, legacy overview workspace, sprints board, and the shared Project Tasks board.
- Fixed Board dark-mode surfaces rendering white, then tuned the palette back to the app's card surfaces: lane/header surfaces use `--color-surface-card`, entries use `--color-surface-hover`, and hover states use `--color-surface-hover-light`.
- Fixed task detail subtask delete confirmation responsiveness by using explicit button types in the shared confirm modal and adding subtask-delete loading/error handling plus popover cleanup.
- Fixed task detail "not found" cases caused by missing/stale tenant context by resolving the project first and reusing the project's canonical tenant for task, subtask, member, activity, milestone, and initiative lookups.
- Fixed global topbar search missing project-name results in project context by passing the current project's canonical tenant into `AISearchBar`, using it for local and CORA search calls, attaching `tenantId` to search results, and preserving that tenant on project/task/initiative navigation.
- Added a GitHub migration/sync path: `scripts/import-github-issues-to-projectflow.mjs` imports GitHub Issues as ProjectFlow tasks with GitHub Projects v2 field snapshots; `onProjectTaskGitHubSync` creates GitHub Issues for new non-imported ProjectFlow tasks and patches linked GitHub Issues on task title/description/status changes. ProjectFlow task `5m5051ZLHm8lVrVmaDsv` and Codex session `R9kc2300qrYUSH67UQ5y` track this work.
- Redesigned the sidebar `ProjectSwitcher`: tokenized SCSS replaces inline utility styling, the trigger shows richer project/workspace context, the dropdown now has workspace entry, quick access for current/pinned projects, grouped company/workstream and other project sections, search across title/status/company context, Escape/outside-click close handling, and corrected owner/member role detection.
- Analyzed ProjectFlow as a project-management product and identified missing PM-manager capabilities to turn it from a strong task/workbench app into a reliable planning/control system: portfolio roadmap, capacity planning, acceptance criteria, risk/decision/change control, stakeholder reports, baseline/scope variance, recurring review rituals, release/QA gates, reusable templates, escalation/reminders, analytics, and dependency/critical-path views. Created ProjectFlow initiative `HbtRa4Yhd3RUwerFarOc` and 12 linked execution tasks for the findings.

## Next Best Move

Check the UI in an authenticated browser session at a real `/project/:id/tasks/:taskId`: verify command rail edits, Work/Discussion/History tabs, next-step/blocker/reminder/quick-log saves, subtasks, comments, relationships, labels, milestone, and responsive behavior. Also search for a known project title from the topbar while inside a project route and verify the result opens with the correct tenant.

## Watchouts

- Do not treat `brain/plans/` as automatically implemented state.
- Do not invent a ProjectFlow task id for this migration; create the real record once credentials are available.
- ProjectFlow tracking for the PM-core fix also failed because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the Task Full Workbench redesign also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the Project Overview menu clipping bugfix also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the task relationships expansion also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the Project Overview border removal also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the Project Overview board-view redesign also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for removing the duplicate Kanban view and consolidating Board also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the subtask delete confirmation bugfix also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the task detail tenant-context loading fix also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the global search project-name lookup fix also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the sidebar Project Switcher redesign also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- Playwright unauthenticated route QA redirects task detail URLs to `/login`; build/theme validation passed, but real task visual QA still needs an authenticated session.
- In-app Browser unauthenticated QA for Project Overview board visuals redirects to `/login`; `cd web && npm run build` passed, but real board visual QA needs an authenticated project session.
- In-app Browser QA for the Project Switcher reached the login screen at `http://127.0.0.1:5173/`; build and theme validation passed, but the dropdown interaction still needs an authenticated sidebar session.
- `web/.vite/deps/_metadata.json` is a dev-server cache change; avoid mixing it into a source commit unless intentionally tracking cache state.
- Some legacy type fields, i18n keys, docs, Firestore collection constants, and GitHub API "issues" terminology still exist where they are compatibility data, historical documentation, or GitHub-native vocabulary rather than active ProjectFlow issue-module UI.
- GitHub Issues should now map to ProjectFlow tasks, not the deprecated ProjectFlow Issues module. Use `brain/operations/github-projectflow-sync.md` for the import/sync commands and token requirements.
