# Commands and Environment

Last updated: 2026-06-04

## Setup

- Install web dependencies: `cd web && npm install`
- Set local Gemini secret: create `web/.env.local` with `GEMINI_API_KEY`.
- Configure ProjectFlow Codex tracking only when available:
  - `PROJECTFLOW_API_BASE_URL`
  - `PROJECTFLOW_API_TOKEN`
  - `PROJECTFLOW_PROJECT_ID=ogZ8Pyz8pwEQtv8I64nu`

## Web Commands

- Dev server: `cd web && npm run dev`
- Production build: `cd web && npm run build`
- Preview build: `cd web && npm run preview`
- Theme lint: `cd web && npm run lint:theme`
- Vitest watch: `cd web && npm run test`
- Vitest once: `cd web && npm run test:run`
- Playwright E2E: `cd web && npm run test:e2e`
- Firebase hosting deploy: `cd web && npm run deploy`

## Local Emulator Workflow (seeded demo data)

Use this to QA signed-in screens without touching production.
1. `export PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH` (the Firestore emulator needs Java).
2. `firebase emulators:start --only auth,firestore,storage,functions --project demo-projectflow` (ports in `firebase.json`: auth 9099, firestore 8085, storage 9199, functions 5001; build functions first).
3. `node scripts/seed-emulator.mjs` wipes the emulator and seeds:
   - workspace "Demo Studio" (owner `demo@projectflow.test` / `projectflow-demo`) with 4 projects covering overdue, today, blocked and unassigned tasks, subtasks, initiatives, a sprint and milestones;
   - "Berger Agency", where the demo user is a Guest on one project;
   - a pending email invitation from "Romero Labs".
4. `cd web && npm run dev:emulator` (mode `emulator` → `.env.emulator` sets `VITE_USE_FIREBASE_EMULATORS=true`; also available as `web-emulator` in `.claude/launch.json`).

**One command, already signed in:** `npm --prefix web run dev:e2e` (launch config `web-e2e`) runs `scripts/dev-e2e.sh`: builds functions, starts Auth/Firestore/Storage/Functions emulators on their own port block (9631/8631/9632/5631, override via `AUTH_PORT` etc.) so it does not collide with other local Firebase projects, seeds the demo workspace, adds `outsider@projectflow.test` / `pf-outsider-e2e` (no workspace, for permission tests) and starts Vite auto-signed-in as the demo owner (`E2E_LOGIN=outsider` to sign in as the outsider, `E2E_FUNCTIONS=0` to skip functions). Auto-login only exists in dev builds with emulators.

**Security tests** (from `functions/`): `npm run test:rules` (Firestore rules, 33 checks), `node scripts/storage-rules-test.js` under `firebase emulators:exec --only firestore,storage`, `npm run test:account-data` (GDPR export/erasure). `RULES_PATH=<file>` runs the Firestore suite against another rules file (e.g. an older version) for comparison.


## Functions Commands

- Build: `cd functions && npm run build`
- Serve: `cd functions && npm run serve`
- Deploy: `cd functions && npm run deploy`
- Lint: `cd functions && npm run lint`

Deploy only touched functions when possible, for example: `cd functions && firebase deploy --only functions:callGemini`.

## iOS

- Regenerate the Xcode project after adding/removing files: `cd ios && xcodegen generate`
- Simulator build: `xcodebuild -project ios/ProjectFlow.xcodeproj -scheme ProjectFlow -destination 'platform=iOS Simulator,name=ProjectFlow iPhone 18 Pro' -derivedDataPath .xcodebuild build`
- The `ProjectFlow` scheme runs the `Emulator` configuration against `scripts/dev-e2e.sh` (default ports auth 9631, firestore 8631, functions 5631; override per launch with `SIMCTL_CHILD_PF_EMULATOR_*_PORT`). Launch args: `-pfAutoLogin` (demo user), `-pfOpenURL /project/<id>` (open a screen).
- Lint: `cd ios && swiftlint lint --quiet` (colour literals and native controls are errors).
- Conventions: [ios/README.md](../ios/README.md).

## Desktop (Electron)

- Concept: [plans/desktop-electron-concept.md](./plans/desktop-electron-concept.md). Package `desktop/` (TypeScript, bundled by esbuild; `npm --prefix desktop install` once).
- **Signed in, fully local:** `bash scripts/dev-desktop.sh` (`npm --prefix desktop run dev:e2e`) starts `dev-e2e.sh` (emulators + seed + auto-login Vite) in its own process group, picks a free app port, and launches Electron against it with a fresh profile and CDP on `127.0.0.1:9333` (`DEBUG_PORT`). `E2E_LOGIN=outsider`, `E2E_FUNCTIONS=0`, `DESKTOP_REUSE=1 PORT=<port>` (attach to a running web-e2e), `DESKTOP_KEEP_PROFILE=1`; emulator port overrides as in dev-e2e (`AUTH_PORT=9671 FIRESTORE_PORT=8671 STORAGE_PORT=9672 FUNCTIONS_PORT=5671` when another worktree's emulators hold the defaults).
- Against a running dev server: `npm --prefix desktop run dev` (`PF_DESKTOP_URL`, default `http://localhost:3000`). Against production: `npm --prefix desktop start`.
- Typecheck + bundle: `npm --prefix desktop run build`. Unsigned app bundle: `npm --prefix desktop run pack` (`release/`); installers `dist:mac` / `dist:win` need signing credentials.
- Tray icons are generated from `desktop/assets/glyph.svg`: `cd desktop && npx electron scripts/render-icons.cjs`.

## Firestore Commands

- Deploy rules: `firebase deploy --only firestore:rules`
- Deploy indexes: `firebase deploy --only firestore:indexes`

## ProjectFlow Codex Plugin

- Start session: `python3 plugins/projectflow-codex/scripts/projectflow_session.py start --project-id ogZ8Pyz8pwEQtv8I64nu --title "<scope>" --summary "<context>" --entity task`
- Start initiative: `python3 plugins/projectflow-codex/scripts/projectflow_session.py start --project-id ogZ8Pyz8pwEQtv8I64nu --title "<scope>" --summary "<context>" --entity initiative`
- Checkpoint: `python3 plugins/projectflow-codex/scripts/projectflow_session.py checkpoint --project-id ogZ8Pyz8pwEQtv8I64nu --external-key "<key>" --phase validation --summary "<summary>" --validation-status passed --file <path>`
- Finish: `python3 plugins/projectflow-codex/scripts/projectflow_session.py finish --project-id ogZ8Pyz8pwEQtv8I64nu --external-key "<key>" --status completed --summary "<summary>"`

## Validation Rule

After completing a task, run the build for the surface touched:

- Web work: `cd web && npm run build`
- Functions work: `cd functions && npm run build`

Documentation-only Brain migrations do not require an app build unless code, rules, functions, or generated assets changed.

## CI/CD Secrets

`.github/workflows/ci.yml` (PR + main + manual) runs web lint/test/build, functions lint/build and Firestore rules tests (needs Java). `firebase-hosting-deploy.yml` runs only via `workflow_run` after CI succeeded on a `main` push, or manually (`workflow_dispatch`).

Required GitHub secrets: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_VAPID_KEY`, `VITE_SENTRY_DSN` (optional; no DSN = error reporting is a no-op), `FIREBASE_SERVICE_ACCOUNT_PROJECTFLOW_LABESTIN`. Typecheck is still non-blocking until the TS error backlog is cleared.
