# Session Log

## Entry Format

- Date: YYYY-MM-DD
- Goal:
- Actions:
- Validation:
- Next:

## Recent Sessions

- Date: 2026-06-04
  - Goal: make the GitHub connect action work when a user is already linked to GitHub through Firebase Auth but ProjectFlow has no stored repo API token.
  - Actions: changed GitHub linking to request `repo`, `read:project`, and `user` scopes and fall back to `reauthenticateWithPopup` when the provider is already linked; changed the account UI to distinguish account-level GitHub integration tokens from Firebase sign-in links; added a GitHub disconnect action that removes the ProjectFlow token and unlinks the Firebase GitHub provider when another login method exists; added project settings success/error toasts, repo loading feedback, and a manual token fallback for accounts already linked to another Firebase user; changed task GitHub sync to use project repo settings plus the project owner's account-level token when no project token exists; hardened OAuth popup MFA sign-in so GitHub/Google login opens the 2FA code step or shows a localized setup error instead of leaking the raw Firebase error; hotfixed the deployed blank screen by moving Rollup `commonjsHelpers.js` into a neutral Vite chunk so `vendor` no longer circularly evaluates through `data-tools` before React is initialized; added missing auth-screen flow hero translations.
  - Validation: `cd web && npm run build` passed; `cd functions && npm run build` passed; targeted `git diff --check` passed; production preview and deployed Firebase Hosting were checked with Playwright and no `createContext` page error remained. The ProjectFlow checkpoint retry after the hosting hotfix returned `HTTP 401: Invalid token`, so the hotfix is recorded locally in this log and `brain/reference/app/GOTCHAS.md`.
  - ProjectFlow tracking: task `r7TrNrYlxo4SZaOM6Jyf`, Codex session `fa9DXo8E9q5VcpY6cF4l`.
  - Next: verify in an authenticated browser that clicking GitHub connect opens the popup, stores `users/{uid}.githubToken`, loads repositories, allows selecting a repo plus enabling issue sync, and that GitHub sign-in with MFA shows the ProjectFlow 2FA screen.

- Date: 2026-06-04
  - Goal: make the sidebar Project Switcher smarter and visually calmer.
  - Actions: refactored `ProjectSwitcher` into a tokenized component with a richer trigger, quick access for current/pinned projects, grouped company/workstream project rows, search across project/status/company context, Escape/outside-click close behavior, corrected owner/member role detection, and localized labels; added `project-switcher` SCSS and registered it in both style entrypoints; added per-user recent project access tracking in `localStorage` so the lower project sections sort by last opened time, with project timestamps as fallback.
  - Validation: `cd web && npm run build` passed; `cd web && npm run lint:theme` passed after the redesign and again after the recent-access sorting change; in-app Browser loaded `http://127.0.0.1:5173/`, confirmed the app renders without framework overlay, and captured the unauthenticated login screen. Authenticated Sidebar dropdown interaction remains unverified because the local browser redirects to `/login` without credentials.
  - Next: create the ProjectFlow tracking task after `PROJECTFLOW_API_TOKEN` is available; verify the real project-switcher dropdown in an authenticated sidebar session with current, pinned, company, linked, and ungrouped projects.

- Date: 2026-06-04
  - Goal: make global search find projects by project name from project context.
  - Actions: passed the current project's canonical tenant from `AppLayout` through `TopBar` into `AISearchBar`; used that tenant for local search and CORA context calls; added `tenantId` to search results and preserved it when navigating to project, task, and initiative hits.
  - Validation: `cd web && npm run build` passed.
  - Next: create the ProjectFlow tracking task after `PROJECTFLOW_API_TOKEN` is available; verify in an authenticated browser by searching a known project title from inside a project route.

- Date: 2026-06-04
  - Goal: add a GitHub Issues/Projects v2 migration path into ProjectFlow tasks and automatic ProjectFlow task to GitHub issue creation.
  - Actions: added task-level GitHub metadata fields; expanded the ProjectFlow task API/upsert path to persist GitHub issue identity and Projects v2 snapshots; added `scripts/import-github-issues-to-projectflow.mjs` with REST issue import, GraphQL Projects v2 field capture, dry-run, comments, and assignee mapping; added `onProjectTaskGitHubSync` to create GitHub Issues for new non-imported tasks and patch linked GitHub Issues on task changes; documented the workflow in `brain/operations/github-projectflow-sync.md` and Firestore Brain docs.
  - Validation: `node --check scripts/import-github-issues-to-projectflow.mjs` passed; `node scripts/import-github-issues-to-projectflow.mjs --help` passed; `cd functions && npm run build` passed; `cd web && npm run build` passed; targeted `git diff --check` passed.
  - ProjectFlow tracking: task `5m5051ZLHm8lVrVmaDsv`, Codex session `R9kc2300qrYUSH67UQ5y`.
  - Next: dry-run the import against a real GitHub repo/token; deploy `onProjectTaskGitHubSync` and the ProjectFlow API host function once credentials are ready.

- Date: 2026-06-04
  - Goal: restore task detail loading when tenant context is missing or stale.
  - Actions: changed the task detail loader to resolve the project first, derive the canonical tenant id from that project, and then load task, subtasks, members, activity, milestones, and initiative context with the resolved tenant instead of relying only on the URL query or cached tenant.
  - Validation: `cd web && npm run build` passed; `cd web && npm run lint:theme` passed; targeted `git diff --check` passed.
  - Next: verify in an authenticated session from Project Tasks, Project Overview, Dashboard, notifications, and global task search links.

- Date: 2026-06-04
  - Goal: analyze what ProjectFlow still needs to work as a full project-management system and create ProjectFlow tasks for the findings.
  - Actions: read the required Brain entry files, reviewed product concept, sitemap, data model, active project/task/milestone/sprint surfaces, and ProjectFlow API docs; identified gaps around portfolio roadmap, capacity planning, acceptance criteria, risk/decision/change control, stakeholder reporting, baseline variance, recurring review rituals, release/QA gates, reusable PM templates, escalation reminders, analytics, and dependency/critical path visibility.
  - Validation: after the API token was supplied, ProjectFlow API upsert calls created initiative `HbtRa4Yhd3RUwerFarOc` plus 12 linked tasks in project `ogZ8Pyz8pwEQtv8I64nu`.
  - ProjectFlow tracking: initiative `HbtRa4Yhd3RUwerFarOc`; tasks `o8haNuF93UW5iDdNrjsa`, `j1XB7PI2ziX85q5Bk4z7`, `Yf954J1Ou5nLFxeO9zyo`, `XbvFJaOg8gqfVN2wpH2u`, `DlSw4GtCO1gXAFtiOmfD`, `CfLNsR25l0tacsHvJVzW`, `42d8n7wRBQdyS6Y2BJ8C`, `VB9NMpfu7YHHMfJPDzKV`, `TsLqKW1koWUb2PBhJTVn`, `iAsD8tEcEca2dniEg6Pq`, `8keWE1L8juPV9uPU77pV`, and `xyqvBWfoCU0CPQqOAroT`.
  - Next: prioritize the created tasks into roadmap slices and decide which PM control loop should be implemented first.

- Date: 2026-06-04
  - Goal: make Board columns the same visual length.
  - Actions: gave shared ProjectBoard, Project Overview work board, and V2 board lane bodies a shared responsive body height with internal vertical scrolling so short and long columns align.
  - Validation: `cd web && npm run build` passed; targeted `git diff --check` passed.
  - Next: repeat authenticated visual QA on a real Board with uneven task counts.

- Date: 2026-06-04
  - Goal: tune Board dark-mode surfaces to use the app's card palette instead of hard black.
  - Actions: changed shared ProjectBoard, Project Overview board styles, V2 board styles, and board task cards to use `--color-surface-card` for lanes/headers, `--color-surface-hover` for entries, and `--color-surface-hover-light` for entry hover states; normalized board text to standard main/muted text tokens.
  - Validation: `cd web && npm run build` passed; targeted `git diff --check` passed.
  - Next: repeat authenticated visual QA on a real Board in dark mode.

- Date: 2026-06-04
  - Goal: fix Board dark-mode lanes rendering as white.
  - Actions: changed Board header/lane/card color mixes from theme-flipping `--color-primary` to theme-invariant `--color-absolute-black` across shared ProjectBoard, Project Overview board styles, V2 board styles, and board task cards; added `--color-absolute-black`/`--color-absolute-white` to the `web/src` token file so all style bundles resolve the invariant tokens.
  - Validation: `cd web && npm run build` passed; targeted `git diff --check` passed; verified no Board dark-surface mixes still use `--color-primary`.
  - Next: repeat authenticated visual QA on a real Board in dark mode.

- Date: 2026-06-04
  - Goal: remove the duplicate Project Overview Kanban view and consolidate Board as the compact status-column view.
  - Actions: removed Project Overview Kanban view options, types, routing, locale labels, V2 renderer, legacy overview renderer, and unused Kanban components/styles; mapped stored `kanban` preferences to `board`; changed Board to fixed status columns with Backlog, To-do/Open, In Progress, Review, On Hold, Blocked, and Done; tightened spacing and applied standard status color tokens to dots/counts.
  - Validation: `cd web && npm run build` passed; targeted `git diff --check` passed; Project Overview Kanban references are gone from the overview code paths. Authenticated visual QA remains pending because local unauthenticated routes redirect to `/login`.
  - Next: create ProjectFlow tracking after `PROJECTFLOW_API_TOKEN` is available; repeat authenticated visual QA on real board data.

- Date: 2026-06-04
  - Goal: fix the task detail subtask delete confirmation.
  - Actions: made shared confirmation buttons explicitly `type="button"`; added a subtask-delete loading state, visible task-detail error message, and cleanup for open task-detail popovers before opening the subtask delete confirmation.
  - Validation: `cd web && npm run build` passed; `cd web && npm run lint:theme` passed; targeted `git diff --check` passed.
  - Next: verify in an authenticated task detail session that clicking confirm deletes a subtask and shows the loading state.

- Date: 2026-06-04
  - Goal: restyle the Project Overview board view to match the provided dark rounded-column reference.
  - Actions: redesigned the V2 `po-kanban` surface and the workspace Kanban variant with a dark dotted canvas, pill-shaped column headers, right-aligned count badges, large rounded drop zones, centered uppercase empty states, and token-based card hover states; removed the workspace override that flattened Kanban back into divider columns.
  - Validation: `cd web && npm run build` passed; In-app Browser loaded `http://localhost:3000/` but redirected to `/login`, so authenticated Project Overview visual QA remains pending. Browser console showed the existing Tailwind CDN warning on the login page.
  - Next: create the ProjectFlow tracking task after `PROJECTFLOW_API_TOKEN` is available; repeat visual QA in an authenticated project overview board session with real project data.

- Date: 2026-06-04
  - Goal: remove visible element borders from Project Overview.
  - Actions: added scoped border/shadow resets for both Project Overview V2 (`.po`) and legacy Project Overview (`.project-overview-container`) so overview-specific cards, buttons, rows, panels, and page-launched portal modals render without visible element borders while leaving other app screens untouched.
  - Validation: `cd web && npm run build` passed; Playwright rendered the built ProjectOverview CSS against representative V2, legacy overview, common modal, Project Edit modal, and Health modal elements and confirmed transparent border colors plus no box shadows.
  - Next: create the ProjectFlow tracking task after `PROJECTFLOW_API_TOKEN` is available; optionally repeat visual QA in an authenticated project overview session with real project data.

- Date: 2026-06-04
  - Goal: expand task detail relationships.
  - Actions: added a flat `TaskRelationshipsPanel` to the task detail inspector for blocked-by, is-blocking, parent task, and child task links; kept `dependencies` as the blocked-by source of truth, derived inverse blocking links from project tasks, added optional `parentTaskId`, added relationship i18n/styling/docs, and fixed malformed escaped template strings in current task-detail links/classes.
  - Validation: `cd web && npm run build` passed; `cd web && npm run lint:theme` passed; Playwright smoke against `http://127.0.0.1:5173/project/demo/tasks/demo-task` loaded the app and redirected to `/login` because the route requires authentication.
  - Next: run authenticated QA on a real task to verify linking/unlinking blocked-by, is-blocking, parent, and child task relationships plus status automation; create ProjectFlow tracking after `PROJECTFLOW_API_TOKEN` is available.

- Date: 2026-06-04
  - Goal: fix the clipped Project Overview action menu.
  - Actions: changed the V2 project hero container to allow overflow for the More actions dropdown while clipping only the cover image to preserve rounded top corners.
  - Validation: `cd web && npm run build` passed.
  - Next: create the ProjectFlow tracking task after `PROJECTFLOW_API_TOKEN` is available; optionally verify the opened menu in an authenticated browser session.

- Date: 2026-06-04
  - Goal: redesign project task detail into a Full Workbench workspace.
  - Actions: replaced the old card-heavy task detail composition with an open command header, single editable command rail, Work/Discussion/History tabs, flatter screenshot-aligned work area, subtasks table, inspector rail, and additive task metadata fields for next step, blocker note, reminder date, and quick log; updated i18n, Task typing, and Brain references.
  - Validation: `cd web && npm run build` passed; `cd web && npm run lint:theme` passed; Playwright desktop/mobile smoke reached `/login` because task detail requires authentication and showed no route runtime errors before redirect.
  - Next: run authenticated browser QA against a real project task with subtasks, labels, dependencies, milestone, comments, and activity; create ProjectFlow tracking after `PROJECTFLOW_API_TOKEN` is available.

- Date: 2026-06-04
  - Goal: finish Claude's removal of Flows/Ideas and Issues from active app surfaces.
  - Actions: removed remaining Web imports of deleted Flow/Issue modules; disabled Flow stage locale loading; removed global Flow/Issue create shortcuts, toast issue creation, pinned project Flow/Issue actions, search Flow/Issue result sections, project-settings Flow/Issue module toggles, project-list Flow/Issue counters, and Health scoring/spotlight factors for Flow/Issue data; filtered legacy pinned issue items; updated Health tests; adjusted remaining Swift pinned copy.
  - Validation: `cd web && npm run build` passed; `cd web && npm run test:run` passed (37 tests; existing FinanceTracking `act(...)` warnings remain); `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild build` passed.
  - Next: with `PROJECTFLOW_API_TOKEN`, create/update the ProjectFlow tracking task; do a browser smoke test on a real project for nav, settings, search, pinned project, project list, and health details.

- Date: 2026-06-04
  - Goal: restore PM-core project modules except Flows/Ideas and Issues.
  - Actions: changed PM-core default/deprecated module lists; restored Milestones, Social, Marketing, Sprints, Accounting, and Activity in project nav policy; removed PM-core route redirects from restored modules; added Accounting sidebar entry; updated focused tests and PM-core docs.
  - Validation: `cd web && npm run test:run -- pmCore` passed; `cd web && npm run build` passed; running dev server still returns HTTP 200 at `http://127.0.0.1:3000/`.
  - Next: verify in the browser on a real project with restored modules enabled; create ProjectFlow tracking record after `PROJECTFLOW_API_TOKEN` is available.

- Date: 2026-06-04
  - Goal: migrate ProjectFlow repository documentation to a `/brain` living knowledge base and clean root Markdown clutter.
  - Actions: scaffolded app-type Brain; moved former root docs to `brain/reference/app/`; moved old `docs/` plans, operations notes, and audits into Brain folders; moved `web/docs/COMPANY_PROJECTS_PLAN.md` to `brain/web/`; rewrote Brain core files; updated root `README.md`, `AGENTS.md`, `GEMINI.md`; updated `swift/README.md` migrated references.
  - Validation: local Markdown link checker passed; root Markdown inventory is reduced to `README.md`, `AGENTS.md`, `GEMINI.md`, plus module-local Swift docs.
  - Next: create the ProjectFlow tracking record after `PROJECTFLOW_API_TOKEN` is available.

- Date: 2026-06-04
  - Goal: fix deployed dark-mode sidebar color regressions.
  - Actions: rebound Tailwind CDN utility colors in `web/index.html` to theme RGB CSS variables; added missing RGB theme tokens across both style token entrypoints; gave Sidebar controls explicit token-based classes for the new-project button, active nav state, icons, indicators, and badges.
  - Validation: `cd web && npm run build` passed; `cd web && npm run lint:theme` passed; targeted `git diff --check` passed; Playwright verified production preview and deployed Firebase Hosting dark-mode computed colors/screenshots for the affected sidebar slice.
  - Next: repeat visual QA on the authenticated production app with real sidebar data.
