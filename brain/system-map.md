# System Map

Last updated: 2026-06-04

## Primary Components

- `web/`: Vite, React, TypeScript web application. `web/index.tsx` bootstraps the app; `web/App.tsx` hosts global providers; routing is centralized in `Router.tsx`.
- `web/components/`: reusable UI components grouped by domain.
- `web/screens/`: page-level views with matching SCSS files.
- `web/styles/`: SCSS tokens and global styles, especially `web/styles/_tokens.scss` and `web/styles/index.scss`.
- `web/context/`, `web/hooks/`, `web/services/`, `web/utils/`, `web/types/`: shared state, data access, helpers, and typings.
- `web/locales/`: English and German i18n dictionaries.
- `functions/`: Firebase Cloud Functions source in `functions/src`, compiled output in `functions/lib`.
- `swift/`: SwiftUI iOS companion app plus ambient and share extensions.
- `plugins/projectflow-codex/`: repo-local Codex plugin and CLI workflow for linking coding work back to ProjectFlow.
- `brain/`: living project knowledge base and migrated documentation.

## Boundaries

- Web UI owns user interaction patterns, route structure, reusable components, and SCSS implementation.
- Firestore and Cloud Functions are the authoritative enforcement layer for data access, permissions, notifications, AI usage, and ProjectFlow API workflows.
- Swift mirrors selected product surfaces and must align with the documented web/product model.
- Brain files guide contributors; source code remains the source of truth when docs and implementation conflict.

## External Dependencies

- Firebase Hosting, Firestore, Cloud Functions, and Firebase CLI.
- Gemini API configuration through `web/.env.local` for local AI features.
- Apple platform provisioning for iOS App Group, APNs, and signed-release verification.
- ProjectFlow Codex API credentials through `PROJECTFLOW_API_BASE_URL`, `PROJECTFLOW_API_TOKEN`, and `PROJECTFLOW_PROJECT_ID`.

## Migrated Documentation Locations

- Former root project docs: [reference/app/](./reference/app/)
- Former `docs/` plans: [plans/](./plans/)
- Former `docs/` operations notes: [operations/](./operations/)
- Former `docs/audits/`: [audits/](./audits/)
- Former `web/docs/`: [web/](./web/)
