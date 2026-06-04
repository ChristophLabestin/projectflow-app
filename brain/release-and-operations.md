# Release and Operations

Last updated: 2026-06-04

## Release Surfaces

- Web app: Vite build and Firebase Hosting.
- Cloud Functions: Firebase Functions build and function-scoped deploys.
- Firestore: rules and indexes deploy independently.
- iOS app: Xcode simulator build for validation; production release requires Apple provisioning, App Group, APNs, and signing checks.
- ProjectFlow Codex plugin: local CLI scripts plus ProjectFlow API credentials.

## Operational References

- Production provisioning: [operations/projectflow-production-provisioning.md](./operations/projectflow-production-provisioning.md)
- Codex API: [operations/projectflow-codex-api.md](./operations/projectflow-codex-api.md)
- Known gotchas: [reference/app/GOTCHAS.md](./reference/app/GOTCHAS.md), [known-issues.md](./known-issues.md)

## Release Confidence

- Run the build for every touched surface.
- For web UI changes, prefer browser or Playwright verification when route behavior, layout, or interactions changed.
- For functions changes, build locally and deploy only touched functions.
- For Firestore changes, deploy only rules or indexes as appropriate.
- For documentation-only Brain changes, verify links and repo structure; no app build is required.

## Current Operational Caveat

ProjectFlow API tracking could not be performed on 2026-06-04 because `PROJECTFLOW_API_TOKEN` was not present in the environment.
