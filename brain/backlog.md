# Backlog

Last updated: 2026-06-13

## Priority Work

- Collaboration/Team/Presence rebuild: see [plans/collaboration-team-presence-rebuild-plan.md](plans/collaboration-team-presence-rebuild-plan.md). Done: presence → RTDB (`onDisconnect`), rules hardening, workspace permission model anchored in DB (role docs + member `roleIds`, multi-role UI). **Remaining: project-scope permission convergence** (project membership `roleIds`, Project Owner role docs, project role UI; remove legacy `rolesService` `customRoles[]`, `getWorkspaceRoles`, orphaned `WorkspaceRolesTab`). Deploy: `firebase deploy --only firestore:rules,database` + enable RTDB / set `VITE_FIREBASE_DATABASE_URL`.
- Configure `PROJECTFLOW_API_TOKEN` and create the missing ProjectFlow initiative/task for the Brain migration session.
- During the next feature session, verify that the new Brain reading order is enough to start work without consulting old root docs.
- Consider converting the most important historical plans into shorter durable Brain summaries as they become active again.

## Later Opportunities

- Rename migrated legacy docs to lowercase kebab-case if link churn is acceptable.
- Add a lightweight link-check script for Markdown references.
- Add ADRs for major product choices that are currently embedded in long plans.

## Dependencies

- ProjectFlow API credentials are required for session/task tracking.
