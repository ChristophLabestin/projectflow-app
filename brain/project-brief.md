# Project Brief

Last updated: 2026-06-04

## Mission

ProjectFlow is a multi-tenant project management application for software teams, founders, startup operators, freelancers, and digital teams. It combines execution work such as projects, tasks, issues, milestones, and sprints with structured ideation through Flows and optional operational modules such as Social, Marketing, and Accounting.

The product should become a command center for moving real projects forward: capture intent, break it into work, maintain focus, govern access, and keep AI/Codex work connected to the project record.

## Success Criteria

- Users can manage tenants, projects, members, roles, tasks, issues, Flows, and project modules without leaking access across workspaces or projects.
- Project configuration, permissions, and subscription entitlements are enforced in UI and backend rules.
- The web app remains consistent with the SCSS design system, reusable component registry, sitemap, and i18n dictionaries.
- A new native iOS app (concept: [plans/ios-app-concept.md](./plans/ios-app-concept.md)) follows the web product model and design language without inventing a separate product.
- Codex and ProjectFlow integration can track coding sessions, follow-ups, and project context reliably.
- Future contributors can resume work from this Brain without hunting through scattered root docs.

## Scope

- Web app under `web/`.
- Firebase Cloud Functions under `functions/`.
- Firestore rules, indexes, and data model documentation.
- Native iOS app under `ios/` (rebuilt from scratch on 2026-10-22; concept `brain/plans/ios-app-concept.md`, contracts `brain/plans/ios-implementation-contracts.md`).
- Repo-local ProjectFlow Codex plugin under `plugins/projectflow-codex/`.
- Documentation and working memory under `brain/`.

## Non-Goals

- Do not move source-code-local README files unless intentionally redesigning module-level onboarding.
- Do not treat old plan documents as implemented reality without checking code.
- Do not add new UI frameworks, routing frameworks, or styling systems without an explicit decision.
- Do not hardcode user-facing strings in React components.

## Primary References

- Product concept: [reference/app/APP_CONCEPT.md](./reference/app/APP_CONCEPT.md)
- Permissions: [reference/app/PERMISSIONS.md](./reference/app/PERMISSIONS.md)
- Routes: [reference/app/SITEMAP.md](./reference/app/SITEMAP.md)
- Components: [reference/app/COMPONENTS.md](./reference/app/COMPONENTS.md)
- Styling: [reference/app/STYLING.md](./reference/app/STYLING.md)
- Firestore: [reference/app/FIRESTORE_STRUCTURE.md](./reference/app/FIRESTORE_STRUCTURE.md)
