# Decision Log

Last updated: 2026-06-04

## Decision Entries

- 2026-06-04: Adopt `/brain` as the repository living knowledge base.
  - Rationale: root Markdown and `docs/` had become scattered, making agent re-entry slower and less reliable.
  - Decision: scaffold an app-type Brain, move former root docs into `brain/reference/app/`, move old `docs/` content into themed Brain folders, and keep only conventional root Markdown entry points.
  - Alternatives considered: keep the old docs folder and add an index; create a new Brain without moving historical docs.
  - Consequences: future project context starts in `brain/README.md`; legacy docs remain available but are no longer the top-level navigation system.

- 2026-09-26: Multi-workspace tenancy with invitations.
  - Rationale: tenant id == owner uid made ownership untransferable, let anyone who knew a uid self-join a tenant, and gave users no way to belong to several workspaces.
  - Decision: random tenant ids with `ownerId`; access only via `tenants/{t}/members/{uid}` with roles Owner/Admin/Member/Guest; invitations (email or link) accepted server-side by `acceptWorkspaceInvite`; guests scoped to projects via `memberIds`; the UI shows only the active workspace and switches via the sidebar switcher (full reload).
  - Alternatives considered: keep uid-tenants and add extra workspaces beside them (two identity models); client-side acceptance guarded by rules (complex cross-document rules, weaker guarantees).
  - Consequences: no data migration needed (fresh Firebase project `projectflow-labestin`); old invite routes (`/invite/:tenantId`, `/join…`, `/invite-project…`) removed; cross-workspace "shared projects" lists are replaced by workspace switching.

## Follow-Ups

- Create ProjectFlow tracking record once `PROJECTFLOW_API_TOKEN` is available.
