# ProjectFlow — Claude Code Entry

The durable knowledge base for this repository is the **ProjectFlow Brain** (`brain/`).
This file is the Claude Code entry point; the full work rules live in [AGENTS.md](./AGENTS.md).

## Read First (every substantive session)

1. [brain/README.md](./brain/README.md) — map of the knowledge base
2. [brain/current-focus.md](./brain/current-focus.md) — active work state
3. [brain/handoff.md](./brain/handoff.md) — latest transfer-ready summary
4. [brain/agent-operating-manual.md](./brain/agent-operating-manual.md) — mandatory rules before editing code or docs

Then open the smallest relevant durable file for the task (see the Brain README's "Start Here").

## Quick Context

ProjectFlow is a multi-tenant project management app for execution, structured ideation
through Flows, optional operational modules, permissions, AI assistance, and Codex
session tracking. Surfaces: a React/TypeScript/Vite web app (`web/`), Firebase Cloud
Functions (`functions/`), and a Swift companion app (`swift/`).

## Project Structure

- `web/` — React + TS + Vite app. `index.tsx` bootstraps; `App.tsx`/`Router.tsx` host routing and providers.
  - `web/components/` reusable UI · `web/screens/` page views (+ matching `.scss`)
  - `web/styles/` SCSS tokens & globals · `web/context/`, `web/hooks/`, `web/services/`, `web/utils/`, `web/types/`
  - `web/locales/` i18n (`en.ts`, `de.ts`) · `web/assets/` static files
- `functions/` — Firebase Cloud Functions (`src` → `lib`)
- `swift/` — Swift companion app (`projectflow.xcodeproj`)
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firebase.json` — Firebase config

## Key Rules

- **Brain first**: keep durable facts in the smallest correct Brain file; keep root Markdown sparse.
- **Styling**: SCSS only. Use tokens from `web/styles/_tokens.scss` and the rules in
  [brain/reference/app/STYLING.md](./brain/reference/app/STYLING.md). No Tailwind, no hardcoded colors.
- **Components**: prefer reusable components; update [brain/reference/app/COMPONENTS.md](./brain/reference/app/COMPONENTS.md).
- **Routing**: keep it centralized; update [brain/reference/app/SITEMAP.md](./brain/reference/app/SITEMAP.md).
- **i18n**: no hardcoded user-facing strings — put copy in `web/locales/en.ts` and `web/locales/de.ts`.
- **Dialogs**: avoid native browser dialogs; use shared modal/confirmation components.
- **Permissions & product rules**: follow [brain/reference/app/PERMISSIONS.md](./brain/reference/app/PERMISSIONS.md)
  and [brain/reference/app/APP_CONCEPT.md](./brain/reference/app/APP_CONCEPT.md).
- **Style/naming**: TypeScript + React, 4-space indent, single quotes, grouped imports.
  Components PascalCase, hooks `useX`, SCSS files kebab-case.
- **Gotchas**: log new pitfalls in [brain/reference/app/GOTCHAS.md](./brain/reference/app/GOTCHAS.md).
- **Tracking**: for substantial implementation/bugfix sessions, create or update a task in the
  ProjectFlow project (`projectId: ogZ8Pyz8pwEQtv8I64nu`); use initiatives for mini-project scope.
  See [AGENTS.md](./AGENTS.md) for the full tracking policy.

## Common Commands

| Task | Command |
| --- | --- |
| Install web deps | `cd web && npm install` |
| Dev server | `cd web && npm run dev` |
| Web build (after web work) | `cd web && npm run build` |
| Web tests (once) | `cd web && npm run test:run` |
| E2E tests | `cd web && npm run test:e2e` |
| Theme lint | `cd web && npm run lint:theme` |
| Functions build | `cd functions && npm run build` |
| Swift sim build | `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild build` |

After a task, run the build for the surface you touched. Deploy only what you changed
(`firebase deploy --only functions:<name>` / `firebase deploy --only firestore:rules`).
Full command and environment reference: [brain/commands-and-environment.md](./brain/commands-and-environment.md).

## Secrets

Set secrets in `web/.env.local` (e.g. `GEMINI_API_KEY`). Never commit credentials.
