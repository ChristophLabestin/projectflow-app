# Release and Operations

Last updated: 2026-06-04

## Release Surfaces

- Web app: Vite build and Firebase Hosting.
- Cloud Functions: Firebase Functions build and function-scoped deploys.
- Firestore: rules and indexes deploy independently.
- iOS app (`ios/`, SwiftUI, iOS 26.2+): simulator build for validation (see [commands-and-environment.md](./commands-and-environment.md)); production release needs the Apple portal setup (App ID capabilities: Push, Sign in with Apple, Associated Domains, App Group `group.de.christophlabestin.projectflow`, keychain group), an APNs auth key in Firebase, and a signed-release entitlement check. `web/public/.well-known/apple-app-site-association` lists bundle `48BM67TY9G.de.christophlabestin.projectflow` for webcredentials and applinks.
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
