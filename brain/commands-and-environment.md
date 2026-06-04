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

## Functions Commands

- Build: `cd functions && npm run build`
- Serve: `cd functions && npm run serve`
- Deploy: `cd functions && npm run deploy`
- Lint: `cd functions && npm run lint`

Deploy only touched functions when possible, for example: `cd functions && firebase deploy --only functions:callGemini`.

## Swift Command

- Build simulator target: `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild build`

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
- Swift work: the Swift simulator build command above
- Functions work: `cd functions && npm run build`

Documentation-only Brain migrations do not require an app build unless code, rules, functions, or generated assets changed.
