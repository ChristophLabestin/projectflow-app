# Repository Guidelines

ProjectFlow is a multi-tenant project management app for execution, structured ideation
through Flows, optional operational modules, permissions, AI assistance, and Codex
session tracking. Surfaces: React/TypeScript/Vite web app (`web/`), Firebase Cloud
Functions (`functions/`), native iOS app (`ios/`, rebuilt from scratch on 2026-10-22; concept
`brain/plans/ios-app-concept.md`, conventions `ios/README.md`; `swift/` is the legacy app).

## Token-Budget (gemessen 2026-10-23: 45 Tage, 50 Sessions, 589M effektive Tokens)
Teilweise erzwungen über `.claude/token-guard.json` (Hook). Bewusster Einmal-Bypass:
`CLAUDE_ALLOW_IMAGE_READ=1` (Bilder) bzw. `CLAUDE_TOKEN_GUARD=0` (alles).
- Kontext: Ø 324k Tokens pro Turn, 23 % der Turns über 500k; Cache-Reads sind 76 % der Kosten.
  Neue Aufgabe → neue Session; Zwischenstand in `brain/handoff.md` statt im Verlauf mitschleppen.
- Bilder = 25 % des Tool-Outputs (803 Bilder, davon 167 PNG-Reads aus `/tmp`). Bild-Reads sind
  gesperrt. Browser (Claude_Browser 271, claude-in-chrome 208 Bilder): Route/Selektoren aus dem
  Code ableiten, Aktionen in `browser_batch` bündeln, Zustand über `read_page`/`find`/`get_page_text`
  prüfen, Screenshots mit `scale: 0.5`, einer als Nachweis am Ende. `Claude_Browser__computer`-
  Screenshots werden automatisch auf scale 0.5 gesetzt.
- iOS-Simulator (115 Bilder): Tap-Ziele aus dem SwiftUI-Code ableiten, Eingaben bündeln, Screenshot
  nur nach einem zu prüfenden Zustandswechsel und als Abschluss — nie nach jedem Tap, nie
  `simctl io screenshot` + Read. Ablauf für beide: Skill `pf-ui-check`.
- Reads: 66 % ohne offset/limit, 179 Mehrfach-Reads (`brain/plans/ios-app-concept.md` 14× in einer
  Session). Erst `rg -n`, dann Read mit offset/limit; Dateien über 500 Zeilen (85 Quelldateien)
  werden ohne offset/limit blockiert. Brain-/Plan-Docs: `rg -n '^## '`, dann nur den Abschnitt.
- 38 Re-Reads nach eigenem Edit: Edit/Write melden Fehler selbst — nicht nachlesen.
- Bash: `sed` 0.9M Tokens (1008 Aufrufe, Ø 894) → `sed -n`-Bereiche höchstens 120 Zeilen.
  Einzelne `grep`/`rg`/`cat` ohne Begrenzung werden nach 120/250 Zeilen gekappt.
- Generierte Ordner (`node_modules`, `web/dist`, `functions/lib`, `swift/build`, `.xcodebuild`,
  `package-lock.json`) sind für Read gesperrt.
- Pflichtchecks (Build der berührten Surface, visuelle Prüfung, Live-Reproduktion) gelten
  unverändert — sie werden günstiger erfüllt, nicht übersprungen.

## Brain First
- The living project knowledge base is `brain/`.
- Start every substantive session with `brain/README.md`, `brain/current-focus.md`, `brain/handoff.md`, and `brain/agent-operating-manual.md`; then open the smallest relevant durable file (see "Start Here" in `brain/README.md`).
- Former root docs and the old `docs/` folder have moved into `brain/reference/`, `brain/plans/`, `brain/operations/`, `brain/audits/`, and `brain/web/`.
- Keep root Markdown intentionally sparse; put durable project knowledge in the smallest correct Brain file.

## Project Structure & Module Organization
- `web/index.tsx` bootstraps the app; `web/App.tsx` currently hosts routing and global providers.
- `web/components/` holds reusable UI (subfolders by domain); `web/screens/` holds page-level views with matching `.scss` files.
- `web/styles/` contains SCSS tokens and global styles (`web/styles/_tokens.scss`, `web/styles/index.scss`).
- `web/context/`, `web/hooks/`, `web/services/`, `web/utils/`, `web/types/` provide shared state, data access, helpers, and typings.
- `web/locales/` stores i18n dictionaries; `web/assets/` stores static files; `functions/` contains Firebase Cloud Functions (`functions/src` -> `functions/lib`).
- `ios/` is the SwiftUI app (XcodeGen `project.yml`, package `Packages/ProjectFlowKit`, widgets/share/notification extensions).
- `desktop/` is the Electron desktop app around the hosted web app (concept `brain/plans/desktop-electron-concept.md`; releases via `.github/workflows/desktop-release.yml`).

## Build, Test, and Development Commands
- `cd web && npm install` installs web dependencies.
- `cd web && npm run dev` starts the Vite dev server.
- `cd web && npm run build` produces a production build in `web/dist/`.
- `cd web && npm run preview` serves the built app locally.
- `cd web && npm run lint:theme` checks for invalid theme token usage.
- `cd web && npm run test` runs Vitest in watch mode.
- `cd web && npm run test:run` runs Vitest once.
- `cd web && npm run test:e2e` runs Playwright E2E tests (expects a running web server or PLAYWRIGHT_BASE_URL).
- `cd web && npm run deploy` builds and deploys hosting (requires Firebase CLI).
- Cloud Functions: `cd functions && npm run build|serve|deploy|lint`.
- Desktop app: `bash scripts/dev-desktop.sh` (signed in against emulators), `npm --prefix desktop run build` (typecheck + bundle); release = tag `v<desktop version>` (see `brain/commands-and-environment.md`).
- After completing a task, run the build for the surface you touched:
  - Web app work: `cd web && npm run build`.
  - iOS app work: `cd ios && xcodegen generate`, then `xcodebuild -project ios/ProjectFlow.xcodeproj -scheme ProjectFlow -destination 'generic/platform=iOS Simulator' -derivedDataPath .xcodebuild build` (conventions in `ios/README.md`).
- After changing Cloud Functions, deploy only the functions you touched (for example: `cd functions && firebase deploy --only functions:callGemini`).
- After changing Firestore rules or indexes, deploy them to Firebase (for example: `firebase deploy --only firestore:rules` or `firebase deploy --only firestore:indexes`).
- Full command and environment reference: `brain/commands-and-environment.md`.
- Keep reasoning/output minimal while running builds; return to normal detail after builds succeed.

## Coding Style & Naming Conventions
- TypeScript + React with 4-space indentation and single quotes; keep imports grouped.
- SCSS only; use tokens from `web/styles/_tokens.scss` and rules in `brain/reference/app/STYLING.md`. Avoid Tailwind or hardcoded colors.
- Component files use PascalCase (`Button.tsx`), hooks use `useX`, SCSS files use kebab-case (`project-board.scss`).
- User-facing strings belong in `web/locales/en.ts` and `web/locales/de.ts` (no hardcoded copy).
- Avoid native browser dialogs; prefer shared modal/confirmation components.
- Prefer reusable components (update `brain/reference/app/COMPONENTS.md`); keep routing centralized
  (update `brain/reference/app/SITEMAP.md`).
- Follow `brain/reference/app/PERMISSIONS.md` and `brain/reference/app/APP_CONCEPT.md` for permissions and product rules.

## Testing Guidelines
- No root test runner is configured yet; coverage is not enforced.
- If you introduce tests, co-locate them near the feature and add a script to `package.json` (for example, `test`), then document it here.

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and scoped by change (for example, `Refactor pinned tasks modal`).
- PRs should include a summary, linked issue (if any), and screenshots for UI updates.
- When adding routes/components/styles, update `brain/reference/app/SITEMAP.md`, `brain/reference/app/COMPONENTS.md`, and `brain/reference/app/STYLING.md` as needed.

## Documentation & Configuration Notes
- Start with `brain/README.md` and `brain/agent-operating-manual.md` for the current project rules and required docs.
- Use `brain/reference/app/APP_DOCS_INDEX.md` and `brain/reference/app/AI_AGENT_INSTRUCTIONS.md` as migrated historical source material when deeper detail is needed.
- Set secrets in `web/.env.local` (for example, `GEMINI_API_KEY`); avoid committing sensitive credentials.
- Always log new pitfalls, edge cases, or workflow surprises in `brain/reference/app/GOTCHAS.md`.
- For every substantial implementation or bugfix session, create or update a task in the **ProjectFlow** ProjectFlow project (`projectId: ogZ8Pyz8pwEQtv8I64nu`) with a concise scope summary, touched areas, validation status, and pending deployment/follow-up items.
- Whenever a **new** follow-up item is discovered (bug, TODO, enhancement, missing test), create a ProjectFlow task for it in the linked project and document it in the relevant project docs (`brain/reference/app/SITEMAP.md`, `brain/reference/app/COMPONENTS.md`, `brain/reference/app/STYLING.md`, `brain/reference/app/APP_CONCEPT.md`, `brain/reference/app/PERMISSIONS.md`, or `brain/reference/app/GOTCHAS.md` with task id if no better fit).
- For major feature work, migrations, new routes/screens/resources, or plan-mode sessions, create or upsert a **ProjectFlow initiative** first and attach follow-on execution tasks to it with `initiativeId`.
- Keep small bug fixes and narrow edits on task tracking only; initiatives are for mini-project scope inside a project.
