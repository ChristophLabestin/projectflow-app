# iOS App Implementation Plan (MVP)

## Goals & Scope
Build a slimmed-down iOS variant of the web app (in `swift/`) that preserves the same visual language and core workflows. The MVP includes: login, dashboard, project overview, notifications, project list/status, CRUD for projects/tasks/flows/issues, and viewing pinned tasks + pinned project. Social and marketing modules are excluded. The macOS variant is planned later; structure the codebase to make it reusable.

## References (Root Docs to Follow)
- `APP_DOCS_INDEX.md` (starting index for project rules)
- `APP_CONCEPT.md` (modules, tiers, data model, flows)
- `PERMISSIONS.md` (role gating + action rules)
- `FIRESTORE_STRUCTURE.md` (collections/paths)
- `STYLING.md` and `docs/STYLING.md` (design tokens + SCSS design language to mirror)
- `COMPONENTS.md` (UI patterns to mirror in SwiftUI)
- `SITEMAP.md` (page coverage; exclude social/marketing)
- `PRIVACY_POLICY_BRIEF.md` (data handling expectations)

## Architecture & Tech Choices
- SwiftUI + MVVM (or equivalent) with a shared data layer for reuse across iOS/macOS.
- Firebase iOS SDKs: Auth, Firestore, Storage, Functions, Messaging (for push).
- Feature modules aligned with the web app: Projects, Tasks, Flows, Issues, Notifications, Pinned.
- Use Firestore as the source of truth and keep parity with `firestore.rules` and `FIRESTORE_STRUCTURE.md`.

## Design System & Theming
- Mirror the monochrome design language from `STYLING.md`. Map SCSS tokens to SwiftUI Colors/Typography/Spacing.
- Create a centralized Theme layer with light/dark mode support that follows the web token hierarchy.
- Build a small reusable component set (Button, Card, Input, Modal/Sheet, Badge, EmptyState, ListRow) that maps to `COMPONENTS.md`.

## Data & Auth Integration
- Implement Firebase Auth using the same providers configured for the web app (see `web/services/firebase.ts` and Firebase console).
- Enforce permission checks per `PERMISSIONS.md` on all write operations and privileged reads.
- Align data models to `FIRESTORE_STRUCTURE.md` for Projects, Tasks, Flows, Issues, Notifications, and Pinned items.
- Use snapshot listeners for realtime updates on dashboard, project overview, and notifications.

## Feature Plan (MVP)
- **Login**: Email/password and any enabled OAuth providers; persistent session; logout.
- **Dashboard**: Key metrics, recent activity, and quick access to pinned items.
- **Projects**: List with status, create/edit/archive, and basic metadata edits.
- **Project Overview**: Summary, status, activity feed, and linked tasks/flows/issues.
- **Tasks**: CRUD, status updates, assignments (as allowed), and list/detail views.
- **Flows**: CRUD and basic stage/status updates.
- **Issues**: CRUD and status/priority updates.
- **Notifications**: In-app list + push notifications for key events.
- **Pinned**: View pinned project and pinned tasks; allow pin/unpin actions.

## Implementation Phases
1. **Foundation**: Firebase setup, environment config, app shell, routing/navigation, and base UI components.
2. **Design System**: Theme tokens, typography, spacing, and core components with light/dark mode.
3. **Auth & Permissions**: Auth flows, user session handling, and permission enforcement.
4. **Data Layer**: Firestore models, repositories, and realtime listeners.
5. **Core Screens**: Dashboard, Projects list/detail, Project Overview, Notifications.
6. **CRUD Modules**: Tasks, Flows, Issues, Projects (create/edit/delete).
7. **Pinned Features**: Read/write pinned project and pinned tasks.
8. **Polish & QA**: Error states, offline handling, analytics, and performance checks.

## Implementation Task List (Checkable)
- [x] Confirm Firebase iOS app registration and add `GoogleService-Info.plist` to `swift/`.
- [x] Create a shared `Theme` module mirroring `STYLING.md` tokens (light + dark).
- [x] Build core SwiftUI components aligned with `COMPONENTS.md`.
- [x] Implement navigation shell (tabs/stack) for Dashboard, Projects, Notifications, Settings.
- [x] Wire Firebase Auth with configured providers and session persistence.
- [x] Implement MFA and passkey sign-in for the iOS login flow.
- [x] Implement permission checks based on `PERMISSIONS.md` for all write actions.
- [x] Create Firestore models + repositories aligned with `FIRESTORE_STRUCTURE.md`.
- [x] Implement dashboard data aggregation and realtime updates.
- [x] Build Projects list + status display with project CRUD.
- [x] Build Project Overview with activity feed and linked entities.
- [x] Implement Tasks CRUD (list, detail, edit, status updates).
- [x] Implement Flows CRUD (list, detail, edit, status updates).
- [x] Implement Issues CRUD (list, detail, edit, status/priority updates).
- [x] Add notifications screen and FCM push registration.
- [x] Implement pinned project and pinned tasks (read/write + UI).
- [x] Add offline/error handling and loading/empty states.
- [x] Validate UI parity with web app design language in light/dark mode.
- [x] Document iOS module coverage and MVP exclusions in `SITEMAP.md`.

## Remaining Implementation Tasks (Gaps to Close)
- [ ] Add OAuth provider sign-in (Apple/Google or other configured providers) to match web auth options.
- [ ] Implement TOTP MFA flow (authenticator app codes) alongside existing phone MFA.
- [ ] Add project archive flow (soft archive) in UI + repository updates; avoid hard delete where archive is expected.
- [ ] Surface task assignments + due dates in task editor/list and persist to Firestore.
- [ ] Surface issue assignees + due dates in issue editor/list and persist to Firestore.
- [ ] Write project activity items on CRUD operations so Project Overview activity feed is populated.
- [ ] Add notification deep links (open project/task/issue) and optional local creation hooks for key events.
- [ ] Expand Settings (profile summary, security options, workspace context).
- [ ] Add workspace selector to set `activeTenantId` when a user belongs to multiple tenants.
