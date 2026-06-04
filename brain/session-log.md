# Session Log

## Entry Format

- Date: YYYY-MM-DD
- Goal:
- Actions:
- Validation:
- Next:

## Recent Sessions

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
