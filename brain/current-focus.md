# Current Focus

Last updated: 2026-06-04

## Current Objective

Task detail now has a Full Workbench redesign while Flows/Ideas and Issues removal remains carried through for active Web and Swift app surfaces.

## Active Threads

- Brain scaffold: completed with the `brain-folder-bootstrapper` app project type.
- Documentation migration: former root docs moved into `brain/reference/app/`; former `docs/` content moved into `brain/plans/`, `brain/operations/`, `brain/audits/`, and `brain/reference/legacy-agent/`.
- Entry-point cleanup: root `README.md`, `AGENTS.md`, and `GEMINI.md` now point to `brain/`.
- ProjectFlow tracking: attempted to create a ProjectFlow initiative, but the local environment lacks `PROJECTFLOW_API_TOKEN`.
- PM-core module policy: `tasks`, `initiatives`, `sprints`, `milestones`, `activity`, `social`, `marketing`, `accounting`, and `codex` are available; legacy `ideas`/`flows` and `issues` are deprecated, filtered from PM-core module controls, and guarded from direct project nav.
- Follow-up removal pass: Web no longer imports deleted Flow/Issue component/service modules; global create shortcuts, pinned project actions, search sections, Project Settings module options, project-list counters, and Health scoring no longer surface Flow/Issue modules. Swift builds after the deleted Flow/Issue views/stores and remaining pinned-copy cleanup.
- Task detail Full Workbench: `/project/:id/tasks/:taskId` was redesigned with an open header, single command rail, Work/Discussion/History tabs, flatter screenshot-aligned work area, next-step/blocker/reminder/quick-log fields, subtasks table, and inspector rail.

## Blockers and Unknowns

- ProjectFlow API tracking cannot be completed from this environment until `PROJECTFLOW_API_TOKEN` is configured.
- Browser QA for authenticated task detail is limited in the current shell because Playwright redirects unauthenticated task URLs to `/login`.
- Some migrated reference docs still carry old titles or historical phrasing. Keep them as source material unless actively modernizing that domain.
- `web/.vite/deps/_metadata.json` is modified by the running dev server cache and is not part of the PM-core source change.

## Next Actions

- Export `PROJECTFLOW_API_TOKEN` and create/update the missing ProjectFlow task for the Flow/Issue removal and PM-core cleanup.
- Re-run task detail QA in an authenticated browser session and inspect a real task with subtasks, dependencies, labels, comments, and milestone data.
- Use the new Brain reading order on the next implementation session and adjust if anything is hard to find.
- Gradually summarize high-value material from long legacy plans into core Brain files when it becomes active again.
- If committing this PM-core fix, review the large mixed worktree carefully: Claude's prior Swift/Functions/Web deletions are interleaved with the follow-up Web cleanup and Brain updates from this session.
