# Architecture

Last updated: 2026-06-04

## High-Level Design

ProjectFlow is a Firebase-backed, multi-tenant app.

- Tenants are top-level workspaces with members, roles, settings, projects, and subscription state.
- Projects live under tenants and contain tasks, issues, Flows, milestones, sprints, module settings, project membership, lifecycle metadata, and Codex session records.
- Users are global identities with profile, preferences, memberships, focus state, pinned items, and mobile import surfaces.
- Permissions use a Discord-style role model with hierarchy, stacked roles, project roles, external collaborators, and deny-overrides.
- Modules are project-configurable and must be hidden and blocked when disabled.
- AI entitlement and quota behavior depends on subscription tier and license mode.

## Critical Paths

- Authentication and tenant membership resolution.
- Permission evaluation for all privileged reads and writes.
- Project module visibility and action gating.
- Task, Flow, issue, notification, and focus-state workflows.
- Codex session and follow-up synchronization into ProjectFlow.
- Firestore security rules and Cloud Functions validation for backend enforcement.
- i18n dictionary coverage for user-facing strings.

## Change Hotspots

- Route changes: update router and [reference/app/SITEMAP.md](./reference/app/SITEMAP.md).
- Reusable UI changes: update [reference/app/COMPONENTS.md](./reference/app/COMPONENTS.md).
- Styling changes: use SCSS tokens and update [reference/app/STYLING.md](./reference/app/STYLING.md).
- Product rules: update [reference/app/APP_CONCEPT.md](./reference/app/APP_CONCEPT.md).
- Permission behavior: update [reference/app/PERMISSIONS.md](./reference/app/PERMISSIONS.md) and backend enforcement.
- Data model changes: update [reference/app/FIRESTORE_STRUCTURE.md](./reference/app/FIRESTORE_STRUCTURE.md), Firestore rules, and indexes as needed.
- Notification and mobile surfaces: cross-check [plans/projectflow-retention-implementation-plan.md](./plans/projectflow-retention-implementation-plan.md), [operations/projectflow-production-provisioning.md](./operations/projectflow-production-provisioning.md), and Swift coverage.
