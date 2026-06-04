# ProjectFlow Brain

This directory is the living knowledge base for `projectflow-app`.

It replaces the previous loose root Markdown set and the old `docs/` folder. The goal is fast re-entry for humans and AI agents: read a small number of files, understand the current state, then open deeper references only when the task needs them.

## Start Here

1. Read [current-focus.md](./current-focus.md) for the active work state.
2. Read [handoff.md](./handoff.md) for the latest transfer-ready summary.
3. Read [agent-operating-manual.md](./agent-operating-manual.md) before editing code or docs.
4. Read the smallest relevant durable file for the work:
   - Product and user rules: [project-brief.md](./project-brief.md), [product-and-users.md](./product-and-users.md), [reference/app/APP_CONCEPT.md](./reference/app/APP_CONCEPT.md)
   - Routes and UI: [reference/app/SITEMAP.md](./reference/app/SITEMAP.md), [reference/app/COMPONENTS.md](./reference/app/COMPONENTS.md), [reference/app/STYLING.md](./reference/app/STYLING.md)
   - Permissions and data: [reference/app/PERMISSIONS.md](./reference/app/PERMISSIONS.md), [reference/app/FIRESTORE_STRUCTURE.md](./reference/app/FIRESTORE_STRUCTURE.md)
   - Release and operations: [release-and-operations.md](./release-and-operations.md), [operations/](./operations/)

## Operating Rules

- Keep durable facts in durable files. Do not let `current-focus.md` become an archive.
- Keep `handoff.md` short, current, and useful for the next contributor.
- Record major decisions in [decision-log.md](./decision-log.md); create an ADR in [decisions/](./decisions/) only when the decision needs tradeoff detail.
- Record session outcomes in [session-log.md](./session-log.md); use [sessions/](./sessions/) only for deeper notes.
- Update the smallest correct file instead of duplicating the same fact across many files.
- Treat files under `reference/`, `plans/`, `operations/`, `audits/`, and `web/` as migrated source material. Promote high-value durable facts into core Brain files when they become active guidance.

## Folder Map

- [reference/app/](./reference/app/) holds the former root project docs: product concept, permissions, sitemap, styling, component registry, Firestore structure, iOS/mobile plans, privacy brief, gotchas, and AI instructions.
- [reference/legacy-agent/](./reference/legacy-agent/) holds older styling migration and theming notes that predated the Brain system.
- [plans/](./plans/) holds implementation plans, product strategy reports, and roadmap-style documents.
- [operations/](./operations/) holds provisioning, Codex API, deployment, and runtime operations notes.
- [audits/](./audits/) holds audit reports and dated verification records.
- [web/](./web/) holds web-specific planning material that previously lived under `web/docs/`.

## Core Documents

- [project-brief.md](./project-brief.md): durable mission, success criteria, scope, and non-goals.
- [current-focus.md](./current-focus.md): live objective, active threads, blockers, and next actions.
- [agent-operating-manual.md](./agent-operating-manual.md): mandatory work rules for agents.
- [system-map.md](./system-map.md): repository, app, functions, Swift companion, plugin, and integration map.
- [architecture.md](./architecture.md): high-level architecture, critical paths, and change hotspots.
- [constraints.md](./constraints.md): hard constraints, assumptions, and non-goals.
- [commands-and-environment.md](./commands-and-environment.md): setup, build, test, deploy, and environment notes.
- [quality-strategy.md](./quality-strategy.md): validation expectations and confidence layers.
- [known-issues.md](./known-issues.md): confirmed rough edges and workarounds.
- [open-questions.md](./open-questions.md): unresolved questions that need decisions or evidence.
- [backlog.md](./backlog.md): important work beyond the current session.

## Migration Note

On 2026-06-04, the repository moved from scattered root Markdown plus `docs/` to this Brain structure. Root-level Markdown is now intentionally limited to conventional entry files such as `README.md`, `AGENTS.md`, and `GEMINI.md`.
