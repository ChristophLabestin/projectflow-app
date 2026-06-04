# Constraints

Last updated: 2026-06-04

## Hard Constraints

- Web code is TypeScript and React.
- Styling is SCSS only; use tokens from `web/styles/_tokens.scss` and [reference/app/STYLING.md](./reference/app/STYLING.md).
- User-facing strings must be in `web/locales/en.ts` and `web/locales/de.ts`.
- Routing must remain centralized in `Router.tsx`.
- Native browser dialogs are not allowed; use shared modal or confirmation components.
- Permission and entitlement checks must be enforced in UI and backend rules.
- Secrets belong in local environment files or deployment configuration, not committed docs.
- Root-level Markdown should remain intentionally sparse after the Brain migration.

## Assumptions

- `brain/reference/app/` is the migrated location for formerly root-level authoritative docs.
- `brain/plans/` contains planning material that may be partially implemented; code must be checked before treating plans as current state.
- The ProjectFlow project id for tracking this repo is `ogZ8Pyz8pwEQtv8I64nu`.
- ProjectFlow API tracking requires `PROJECTFLOW_API_TOKEN`, which was not available during the 2026-06-04 Brain migration.

## Non-Goals

- No product behavior was changed by the Brain migration.
- No web, Swift, functions, Firestore rules, or deployment behavior was changed by the Brain migration.
- The migration does not certify that every historical plan is implemented or current.
