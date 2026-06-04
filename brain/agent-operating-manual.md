# Agent Operating Manual

Last updated: 2026-06-04

## Reading Order

For every substantive session:

1. [README.md](./README.md)
2. [current-focus.md](./current-focus.md)
3. [handoff.md](./handoff.md)
4. The relevant domain file:
   - product: [project-brief.md](./project-brief.md), [product-and-users.md](./product-and-users.md), [reference/app/APP_CONCEPT.md](./reference/app/APP_CONCEPT.md)
   - permissions: [reference/app/PERMISSIONS.md](./reference/app/PERMISSIONS.md)
   - routes: [reference/app/SITEMAP.md](./reference/app/SITEMAP.md)
   - components: [reference/app/COMPONENTS.md](./reference/app/COMPONENTS.md)
   - styling: [reference/app/STYLING.md](./reference/app/STYLING.md)
   - data model: [reference/app/FIRESTORE_STRUCTURE.md](./reference/app/FIRESTORE_STRUCTURE.md)
   - operations: [release-and-operations.md](./release-and-operations.md), [operations/](./operations/)

Do not load the entire Brain by default. Start narrow and expand only when the task needs more context.

## Mandatory Project Rules

- TypeScript and React web work lives under `web/`; reusable UI belongs in `web/components/`; page views belong in `web/screens/`.
- Routing stays centralized in `Router.tsx`; do not introduce a new routing framework unless explicitly requested.
- Styling is SCSS only. Use tokens from `web/styles/_tokens.scss` and rules in [reference/app/STYLING.md](./reference/app/STYLING.md). Do not introduce Tailwind or hardcoded colors.
- User-facing strings belong in `web/locales/en.ts` and `web/locales/de.ts`.
- Prefer shared components and update [reference/app/COMPONENTS.md](./reference/app/COMPONENTS.md) when adding reusable UI.
- Update [reference/app/SITEMAP.md](./reference/app/SITEMAP.md) when routes or page status change.
- Update [reference/app/APP_CONCEPT.md](./reference/app/APP_CONCEPT.md) or [reference/app/PERMISSIONS.md](./reference/app/PERMISSIONS.md) when product rules, module rules, roles, or entitlements change.
- Avoid native browser dialogs. Use shared modal or confirmation components.

## Brain Update Rules

At the end of a substantial session, update:

- [current-focus.md](./current-focus.md) with the live state and next actions.
- [handoff.md](./handoff.md) with a concise transfer summary.
- [session-log.md](./session-log.md) with what changed and how it was validated.
- [decision-log.md](./decision-log.md) if a durable choice was made.
- [known-issues.md](./known-issues.md) or [open-questions.md](./open-questions.md) if new risk or uncertainty appeared.

When a document category is unclear, prefer the smallest correct file. Do not duplicate long content across multiple Brain files.

## ProjectFlow Tracking

For substantial implementation, bugfix, migration, or planning work:

- Create or update a ProjectFlow task in project `ogZ8Pyz8pwEQtv8I64nu`.
- For major multi-file migrations or feature work, create or upsert a ProjectFlow initiative first.
- Attach execution tasks to the initiative when appropriate.
- If ProjectFlow API credentials are missing or the API fails, record the failure in [known-issues.md](./known-issues.md) and [handoff.md](./handoff.md); do not invent a task id.

## Trust and Uncertainty

- Treat files under `reference/app/` as migrated authoritative source material unless a core Brain file explicitly supersedes them.
- Treat files under `plans/` as plan or report context; verify whether implementation has happened before acting on them.
- Mark uncertain facts with `Needs verification:` and include the file or command that should resolve the uncertainty.
- Prefer current code over stale docs when they conflict, then update the smallest relevant doc.

## Collaboration Norms

- Leave the repo easier to resume than you found it.
- Do not leave new follow-up work only in chat. Put it in ProjectFlow when possible and in the Brain when the API is unavailable.
- Keep handoffs direct: current state, changed files, validation, next move, watchouts.
