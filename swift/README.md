# iOS App (Swift)

This folder contains the SwiftUI multi-platform app. The iOS MVP should mirror the web app's core workflows while staying slim (no social/marketing modules).

## Start Here (Root Docs)
- `../brain/README.md` (living knowledge base entry)
- `../brain/agent-operating-manual.md` (current agent rules)
- `../brain/reference/app/APP_DOCS_INDEX.md` (migrated authoritative index)
- `../brain/reference/app/APP_CONCEPT.md` (product scope + module rules)
- `../brain/reference/app/PERMISSIONS.md` (permission gating)
- `../brain/reference/app/FIRESTORE_STRUCTURE.md` (data model + paths)
- `../brain/reference/app/STYLING.md` (design language + tokens to mirror)
- `../brain/reference/app/COMPONENTS.md` (UI patterns to map into SwiftUI)
- `../brain/reference/app/SITEMAP.md` (page coverage; exclude social/marketing for MVP)
- `../brain/reference/app/PRIVACY_POLICY_BRIEF.md` (data handling expectations)

## Design Parity
- Match the monochrome design system from `../brain/reference/app/STYLING.md`.
- Support light and dark mode with a centralized theme layer.

## Firebase Setup
- Add `GoogleService-Info.plist` to the iOS target in `swift/`.
- Keep secrets out of git; follow root `.gitignore` rules.

## Workflow
- After completing each task in `../brain/reference/app/IOS_APP_IMPLEMENTATION_PLAN.md`, make a commit.
