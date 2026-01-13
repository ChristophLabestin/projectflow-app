# iOS App (Swift)

This folder contains the SwiftUI multi-platform app. The iOS MVP should mirror the web app's core workflows while staying slim (no social/marketing modules).

## Start Here (Root Docs)
- `../APP_DOCS_INDEX.md` (authoritative index)
- `../APP_CONCEPT.md` (product scope + module rules)
- `../PERMISSIONS.md` (permission gating)
- `../FIRESTORE_STRUCTURE.md` (data model + paths)
- `../STYLING.md` (design language + tokens to mirror)
- `../COMPONENTS.md` (UI patterns to map into SwiftUI)
- `../SITEMAP.md` (page coverage; exclude social/marketing for MVP)
- `../PRIVACY_POLICY_BRIEF.md` (data handling expectations)

## Design Parity
- Match the monochrome design system from `../STYLING.md`.
- Support light and dark mode with a centralized theme layer.

## Firebase Setup
- Add `GoogleService-Info.plist` to the iOS target in `swift/`.
- Keep secrets out of git; follow root `.gitignore` rules.

## Workflow
- After completing each task in `../IOS_APP_IMPLEMENTATION_PLAN.md`, make a commit.
