# Current Focus

Last updated: 2026-06-04

## Current Objective

Task detail now has a Full Workbench redesign plus richer task-to-task relationships while Flows/Ideas and Issues removal remains carried through for active Web and Swift app surfaces.

## Active Threads

- Brain scaffold: completed with the `brain-folder-bootstrapper` app project type.
- Documentation migration: former root docs moved into `brain/reference/app/`; former `docs/` content moved into `brain/plans/`, `brain/operations/`, `brain/audits/`, and `brain/reference/legacy-agent/`.
- Entry-point cleanup: root `README.md`, `AGENTS.md`, and `GEMINI.md` now point to `brain/`.
- ProjectFlow tracking: attempted to create a ProjectFlow initiative, but the local environment lacks `PROJECTFLOW_API_TOKEN`.
- PM-core module policy: `tasks`, `initiatives`, `sprints`, `milestones`, `activity`, `social`, `marketing`, `accounting`, and `codex` are available; legacy `ideas`/`flows` and `issues` are deprecated, filtered from PM-core module controls, and guarded from direct project nav.
- Follow-up removal pass: Web no longer imports deleted Flow/Issue component/service modules; global create shortcuts, pinned project actions, search sections, Project Settings module options, project-list counters, and Health scoring no longer surface Flow/Issue modules. Swift builds after the deleted Flow/Issue views/stores and remaining pinned-copy cleanup.
- Task detail Full Workbench: `/project/:id/tasks/:taskId` was redesigned with an open header, single command rail, Work/Discussion/History tabs, flatter screenshot-aligned work area, next-step/blocker/reminder/quick-log fields, subtasks table, and inspector rail.
- Task relationships: task detail now supports blocked-by, is-blocking, parent task, and child task links in the inspector; blocked-by/is-blocking actions automatically set the blocked task status to `Blocked`.
- GitHub migration path: GitHub Issues can now be imported as ProjectFlow tasks through `scripts/import-github-issues-to-projectflow.mjs`, including GitHub Projects v2 field snapshots. A Functions trigger can create/update GitHub Issues from linked ProjectFlow tasks when project GitHub sync is enabled. ProjectFlow tracking task: `5m5051ZLHm8lVrVmaDsv`.
- Project Overview V2: the hero More actions menu no longer clips inside the header container; the cover image remains clipped to the rounded top corners.
- Project Overview visual polish: visible element borders and border-like shadows are suppressed inside both V2 and legacy overview roots, including portal modals opened from the overview page.
- Project Overview board view: the duplicate Project Overview Kanban view has been removed; Board is now the single status-column view with compact dark rounded lanes, standard status colors, and migrated `kanban` preferences falling back to `board`.
- Project Overview board dark mode: board lane/header surfaces now use the normal card surface tokens, and task entries sit one step lighter on hover-aware surface tokens.
- Sidebar Project Switcher: redesigned with tokenized SCSS, a richer current-context trigger, quick access for current/pinned projects, grouped company/workstream lists, search across project/status/company context, Escape close behavior, and corrected owner/member role fallback. Build and theme lint pass; authenticated dropdown QA is still pending.
- Global search project lookup: the topbar search now receives the current project's canonical tenant, passes it into local and CORA searches, stores tenant ids on search results, and navigates project/task/initiative hits with `?tenant=...` so project-name searches do not silently query the wrong workspace.

## Blockers and Unknowns

- ProjectFlow API tracking cannot be completed from this environment until `PROJECTFLOW_API_TOKEN` is configured.
- Browser QA for authenticated task detail and Project Overview board visuals is limited in the current shell because unauthenticated project URLs redirect to `/login`.
- Browser QA for the sidebar Project Switcher is limited for the same reason: the local app renders the login screen without an authenticated session.
- Authenticated QA for the topbar search should verify searching a known project name from inside a project route and opening that result.
- Some migrated reference docs still carry old titles or historical phrasing. Keep them as source material unless actively modernizing that domain.
- `web/.vite/deps/_metadata.json` is modified by the running dev server cache and is not part of the PM-core source change.

## Next Actions

- Export `PROJECTFLOW_API_TOKEN` and create/update the missing ProjectFlow task for the Flow/Issue removal and PM-core cleanup.
- Create the missing ProjectFlow task for the Project Overview menu clipping bugfix after `PROJECTFLOW_API_TOKEN` is available.
- Create the missing ProjectFlow task for the Project Overview border removal after `PROJECTFLOW_API_TOKEN` is available.
- Create the missing ProjectFlow task for the Project Overview board-view redesign after `PROJECTFLOW_API_TOKEN` is available.
- Create the missing ProjectFlow task for the Project Overview Board/Kanban consolidation after `PROJECTFLOW_API_TOKEN` is available.
- Create the missing ProjectFlow task for the global search project-name lookup fix after `PROJECTFLOW_API_TOKEN` is available.
- Create the missing ProjectFlow task for the sidebar Project Switcher redesign after `PROJECTFLOW_API_TOKEN` is available.
- Re-run task detail QA in an authenticated browser session and inspect a real task with subtasks, relationships, labels, comments, and milestone data.
- Re-run topbar search QA in an authenticated browser session and search for a project by title.
- Re-run Project Overview board QA in an authenticated browser session with real tasks/initiatives in the status-column Board view.
- Re-run Project Switcher QA in an authenticated browser session with current, pinned, company, linked, and ungrouped projects.
- Use the new Brain reading order on the next implementation session and adjust if anything is hard to find.
- Gradually summarize high-value material from long legacy plans into core Brain files when it becomes active again.
- If committing this PM-core fix, review the large mixed worktree carefully: Claude's prior Swift/Functions/Web deletions are interleaved with the follow-up Web cleanup and Brain updates from this session.
