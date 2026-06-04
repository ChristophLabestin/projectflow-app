# PM-Core Simplification (Living Plan)

Date: 2026-06-02  
Initiative (local): **PM-Core & Usability 2026** — ProjectFlow project `ogZ8Pyz8pwEQtv8I64nu`  
API tracking: retry when ProjectFlow API accepts writes (403/500 as of 2026-06-02).

## Goal

- Work model: **Project → Initiative → Task**
- Remove **Flows (`ideas`)** and **Issues** from product UX and creation paths
- PM-first daily loop: Dashboard Today, Quick Capture, Focus without pin requirement
- Advanced: Finance, Brainstorm, Team, Codex (project context only)

## Execution checklist

| Phase | Status | Notes |
|-------|--------|-------|
| U1 Nav / IA | Done | Sidebar advanced section, templates, router redirects |
| R1–R2 Freeze | Done | Wizard defaults, service guards, API 410, Firestore write deny |
| U2–U3 Today / Capture | Done | Dashboard without flows/issues, Tasks quick-add |
| R3–R4 Detach / UI | Done | Health, AI search, redirects; legacy screens lazy-only |
| U4–U5 Focus / Overview | Done | Focus without pin, TopBar, overview module hide |
| R5–R6 Backend / Data | Partial | API 410, rules read-only legacy; export callable follow-up |
| R7 + U6–U8 iOS / Onboarding | Partial | iOS nav/health; full screen removal + E2E follow-up |

## Feature flag

- `VITE_PM_CORE_ONLY` — default **enabled** when unset (`true`). PM-core now hides only Flows (`ideas`/`flows`) and Issues; Sprints, Milestones, Social, Marketing, Accounting, Activities, Tasks, Initiatives, and Codex remain available when enabled for a project.

## Removed / deprecated routes (PM core)

- `/project/:id/flows`, `/ideas`, `/issues` → redirect to `/project/:id/tasks`

## Data migration (R6)

- Export `ideas` + `issues` before hard delete (admin callable TBD)
- Task fields `linkedIssueId`, `convertedIdeaId` — stop writing; preserve read-only on existing docs
