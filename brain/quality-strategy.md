# Quality Strategy

Last updated: 2026-06-04

## Quality Goals

- Permission, membership, entitlement, and module gating must not regress.
- UI should remain consistent with the SCSS design system and component registry.
- User-facing text must remain i18n-ready.
- Firestore rules, indexes, and Cloud Functions should stay aligned with documented data model changes.
- Documentation should lead agents to current source material without stale root-path assumptions.

## Validation Layers

- Web build: `cd web && npm run build`
- Web unit tests: `cd web && npm run test:run`
- Web E2E: `cd web && npm run test:e2e`
- Theme lint: `cd web && npm run lint:theme`
- Functions build: `cd functions && npm run build`
- Swift build: `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild build`
- Documentation verification: `rg` for stale links and `git status --short` for expected moves.

## Release Confidence

- Match validation to the touched surface.
- For doc-only migrations, link and structure verification is sufficient unless generated docs feed a build pipeline.
- If validation cannot run, record the reason in [handoff.md](./handoff.md).
