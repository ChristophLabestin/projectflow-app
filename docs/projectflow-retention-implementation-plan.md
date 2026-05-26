# ProjectFlow Retention Implementation Plan

Date: 2026-05-26  
Source report: `docs/projectflow-retention-and-codex-integration-report.md`  
Initial implementation slice: notification reliability diagnostics, daily re-entry, focus usability, and iOS notification routing

## Goal

ProjectFlow should become difficult to neglect because it actively answers three questions:

1. What should I resume now?
2. Did ProjectFlow try to reach me, and why did or did it not work?
3. Can Codex and mobile usage keep ProjectFlow truthful without manual cleanup?

## Phased Plan

### Phase 0: Project Brief Foundation

Outcome: every important project has a lightweight contract: objective, success criteria, scope, decision owner, risks, and cadence.

Implementation tasks:

- Add optional `brief`, `operatingModel`, `riskRegister`, and `healthSnapshot` fields to `Project`.
- Persist durable `projectType`, `operatingMode`, and date-confidence fields.
- Extend create-project with progressive Project Brief capture.
- Preserve quick-create so capture does not become too heavy.
- Show Project Contract and Operating State on project overview.
- Add brief-aware setup gaps to `web/services/healthService.ts`.

Acceptance:

- A new project can be created with objective, success criteria, scope, decision owner, risk, and cadence.
- Project overview shows the contract without forcing users into settings.
- Health explains missing brief fields as setup gaps, not generic risk.

### Phase 1: Notification Reliability

Outcome: notification docs create an explainable delivery attempt across email, mobile push, and future web push.

Implementation tasks:

- Convert `functions/src/notifications.ts` from email-only to a delivery orchestrator.
- Send FCM to tokens stored on `/users/{userId}.fcmTokens`.
- Record `tenants/{tenantId}/notificationDeliveryLogs/{logId}` for sent, skipped, and failed channels.
- Remove invalid tokens after permanent FCM failures.
- Add web notification diagnostics and web token registration.
- Add iOS token diagnostics and exact notification destination routing.

Acceptance:

- A notification document creates delivery logs.
- A user can see whether web push is supported, granted, missing configuration, or registered.
- iOS notification list routes to task, issue, flow, or project destinations.

### Phase 2: Daily Re-entry and Focus Loop

Outcome: dashboard and pinned work make one next action obvious.

Implementation tasks:

- Add a dashboard "Resume today" card that promotes the top command item.
- Let task/issue command items become focus items from the dashboard.
- Upgrade pinned task focus UI with start/snooze/complete/block affordances.
- Persist focus metadata in user profile.
- Mirror focus state in the iOS dashboard.

Acceptance:

- The first dashboard viewport shows one primary next action.
- Starting focus pins the item, sets it as current focus, and opens the quick-access surface.
- The current focus is visible in web top bar and iOS dashboard.

### Phase 3: Mobile Ambient Surfaces

Outcome: iOS keeps ProjectFlow visible without forcing the full app open.

Implementation tasks:

- Add notification tap handling to bring users back to the notification/action surface.
- Add local focus reminder fallback.
- Add WidgetKit focus/today widgets.
- Add ActivityKit Live Activity Focus Keeper.
- Add Share Sheet capture.

Acceptance:

- The app can recover from a push tap into a useful in-app route.
- Widgets show current focus/today work.
- Share Sheet can create at least one ProjectFlow item.

### Phase 4: Codex Integration

Outcome: Codex sessions update ProjectFlow automatically across repos.

Implementation tasks:

- Harden current ProjectFlow API checkpoint endpoints and return JSON errors.
- Add Codex session start/checkpoint/finish endpoints.
- Add Codex session activity model.
- Add Codex activity feed and Codex Inbox.
- Package a ProjectFlow Codex plugin/skill with repo linking and session tools.
- Add bulk follow-up creation.

Acceptance:

- Starting a Codex task creates or upserts a ProjectFlow task/initiative.
- Checkpoints record files touched and validation status.
- Finish marks work done/blocked/partial and creates follow-ups.
- API failures are diagnosable and do not return HTML 500 pages.

## Initial Slice Implemented In This Pass

This pass intentionally implements a narrow end-to-end slice:

- Backend: FCM fanout and delivery logs for notification docs.
- Web: web push registration helper, notification diagnostics, dashboard resume/focus action, and removal of hover-to-read behavior.
- iOS: notification delivery status card, stored FCM token visibility, unread badge update, and in-app notification deep links to task/issue/flow/project details.
- Docs: Firestore and gotcha updates for the new delivery/logging model.

## Phase 0 Implemented In Follow-up Pass

- Data model: added optional `projectType`, `operatingMode`, `dateConfidence`, `brief`, `operatingModel`, `riskRegister`, and `healthSnapshot` fields to `Project`.
- Creation: added a progressive Project Brief step to the create-project wizard while preserving quick-create defaults.
- Editing: added Project Brief fields to the project settings general tab.
- Overview: added a default Project Contract overview card with objective, scope, success criteria, operating state, decision owner, and primary risk.
- Health: added `project_brief_gap` and `project_brief_ready` health factors plus a focused recommendation for missing brief fields.
- API: allowed Project Brief fields through the ProjectFlow API project create/update field allowlist.

## Phase 2 Implemented In Continuation Pass

- Shared focus state: added `users/{userId}.focusState` alongside `focusItemId` and `pinnedItems`.
- Web dashboard: prioritizes an active, snoozed, or blocked focus item in the first resume card before generic command items.
- Web top bar: shows the current focus status directly as active, snoozed, or blocked.
- Pinned task workspace: added start/resume, snooze, block, and complete controls in full and compact quick-access modes.
- iOS dashboard: mirrors the current focus item and status from the shared profile document.
- iOS pinned sheet: can start, snooze, or block focus from pinned items.

## Phase 3 Implemented In Continuation Pass

- iOS ambient model: added an App Group-backed focus snapshot and share-capture queue shared by the app, WidgetKit extension, Live Activity, and Share Sheet extension.
- Local reminder fallback: current focus now schedules an actionable local reminder unless the item is blocked or completed.
- Notification actions: ProjectFlow push/local notifications register Start Focus, Snooze, Blocked, Complete, and Open actions; background actions update Firestore focus/task state.
- WidgetKit: added Focus and Today widgets that render the current focus from the shared snapshot.
- ActivityKit: added a Focus Keeper Live Activity/Dynamic Island surface for the current active or snoozed focus.
- Share Sheet: added a native share extension that captures text/URLs into the App Group queue; the app imports queued captures as tenant-scoped personal tasks on launch/activation.
- Backend push metadata: FCM payloads now include title/message data and APNs category metadata so iOS can show the ProjectFlow action set.

## Phase 4 Implemented In Continuation Pass

- Backend API: added Codex session start/checkpoint/finish endpoints, JSON error hardening, activity logging, linked task/initiative updates, and bulk follow-up creation.
- Firestore model: added project-scoped `codex_sessions`, `codex_sessions/{sessionId}/checkpoints`, and `codex_followups`.
- Web app: added `/project/:id/codex` with session status, latest validation, touched files, and Codex Inbox follow-ups; also added Codex activity filtering.
- Navigation: added Codex to project context navigation, breadcrumbs, and project nav customization.
- Plugin package: added `plugins/projectflow-codex` with plugin manifest, skill instructions, and a `projectflow_session.py` session client.
- Docs: added `docs/projectflow-codex-api.md` plus Firestore, permissions, sitemap, component, styling, and gotcha updates.

## Phase 5 Production Rollout

- Deployed `functions:api` to `project-manager-9d0ad` in `europe-west3`.
- Deployed Firebase Hosting for `project-manager-9d0ad`.
- Verified production ProjectFlow API Codex routes return JSON for missing auth and unknown endpoints.
- Verified hosted `/project/:id/codex` resolves to the SPA with HTTP 200.
- Created ProjectFlow follow-up task `fOa0q1dGYfexIdGCO25C` for `functions.config()` migration before March 2026.
- Created ProjectFlow follow-up task `qJdKkyiHALJYNwyMxz8w` for the invalid `googleDriveStorageCallback` hosting rewrite.

## Phase 6 Production Provisioning Readiness

- Added `scripts/check-retention-provisioning.sh` to verify web push wiring, local VAPID configuration, iOS entitlement files, App Group membership, APNs entitlement presence, Xcode entitlement references, and optional signed `.app` release entitlements.
- Added `web/.env.example` so Firebase web config and `VITE_FIREBASE_VAPID_KEY` are explicit without committing secrets.
- Added `docs/projectflow-production-provisioning.md` with the concrete Firebase VAPID, Apple App Group, APNs, Firebase APNs, and signed-release verification checklist.
- Verified the repo-side App Group entitlement is present for the main app, ambient extension, and share extension.
- Verified the main app declares APNs entitlement locally, with the expected development value in the source entitlements file.
- Confirmed local `web/.env.local` does not currently include `VITE_FIREBASE_VAPID_KEY`; web push token registration remains externally blocked until that public Firebase Web Push certificate key is provided in the build environment.
- Release-profile APNs production status remains externally blocked until a signed distribution `.app` can be inspected with `scripts/check-retention-provisioning.sh --signed-app`.

## Phase 7 Test Notification Diagnostics

- Added callable `sendTestNotification` to create a self-addressed `diagnostic_test` notification through the same tenant notification collection and downstream delivery trigger.
- Added per-user diagnostic throttle state under `tenants/{tenantId}/notificationDiagnostics/{userId}` so the test action cannot be spammed.
- Added a Send test action to `/notifications` delivery diagnostics.
- Added a recent delivery attempts feed on `/notifications` backed by `notificationDeliveryLogs` so FCM/email sent, skipped, and failed states are visible in the app.
- Extended the notification type model, locales, styles, Firestore docs, production checklist, and component/sitemap docs for the diagnostic path.

## Deferred Items

Deferred because they require external console/provisioning access or a signed release artifact:

- Add `VITE_FIREBASE_VAPID_KEY` to local/production web build environments and redeploy hosting. ProjectFlow task: `u7rRtb9TrHuLWxHKgYhl`.
- Enable/verify Apple Developer App Group and Push capabilities, upload/verify Firebase APNs credentials, archive with a distribution profile, then run the signed `.app` entitlement check. ProjectFlow task: `YYawDDhIJguHIFkKqrZD`.

## Validation Plan

- [x] `cd functions && npm run build`
- [x] `cd web && npm run build`
- [x] `cd web && npm run test:run -- healthService`
- [x] `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild-retention build`
- [x] Phase 3: `cd functions && npm run build`
- [x] Phase 3: `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild build`
- [x] Phase 4: `cd functions && npm run build`
- [x] Phase 4: `cd web && npm run build`
- [x] Phase 4: `cd web && npm run lint:theme`
- [x] Phase 4: `python3 -m py_compile plugins/projectflow-codex/scripts/projectflow_session.py`
- [x] Phase 4: `PYTHONPATH=/tmp/projectflow-plugin-validate-pyyaml python3 /Users/christophlabestin/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/projectflow-codex`
- [x] Phase 4: `git diff --check`
- [x] Phase 4: Playwright smoke at `http://127.0.0.1:3002/project/ogZ8Pyz8pwEQtv8I64nu/codex`: protected route redirected to `/login` without console/page errors. Authenticated Codex feed rendering was not exercised because no logged-in local browser session was available.
- [x] Phase 5: `firebase deploy --only functions:api --project project-manager-9d0ad`
- [x] Phase 5: `firebase deploy --only hosting --project project-manager-9d0ad`
- [x] Phase 5: `curl -i https://europe-west3-project-manager-9d0ad.cloudfunctions.net/api/projectflow/projects/ogZ8Pyz8pwEQtv8I64nu/codex/sessions` returned JSON HTTP 401 for missing token.
- [x] Phase 5: `curl -i https://europe-west3-project-manager-9d0ad.cloudfunctions.net/api/projectflow/not-a-real-endpoint` returned JSON HTTP 404 with supported endpoints.
- [x] Phase 5: `curl -I https://project-manager-9d0ad.web.app/project/ogZ8Pyz8pwEQtv8I64nu/codex` returned HTTP 200.
- [x] Phase 6: `bash -n scripts/check-retention-provisioning.sh`
- [x] Phase 6: `scripts/check-retention-provisioning.sh` passed with expected external provisioning warnings for missing local VAPID key and absent signed `.app` artifact.
- [x] Phase 6: `cd web && npm run build`
- [x] Phase 6: `git diff --check`
- [x] Phase 7: `cd functions && npm run build`
- [x] Phase 7: `cd web && npm run build`
- [x] Phase 7: `cd web && npm run lint:theme`
- [x] Phase 7: `firebase deploy --only functions:sendTestNotification,functions:onNotificationCreated --project project-manager-9d0ad --non-interactive`
- [x] Phase 7: `firebase deploy --only hosting --project project-manager-9d0ad --non-interactive`
- [x] Phase 7: `curl -i -X POST https://europe-west3-project-manager-9d0ad.cloudfunctions.net/sendTestNotification` returned JSON HTTP 401 for missing auth.
- [x] Phase 7: `curl -I https://project-manager-9d0ad.web.app/notifications` returned HTTP 200.
- [x] Phase 7: Playwright smoke at `http://127.0.0.1:3004/notifications`: protected route redirected to `/login`; no page errors. Existing Tailwind CDN warning remains documented in `SITEMAP.md`.
- [x] Phase 7: `git diff --check`
- [x] Browser smoke at `http://127.0.0.1:3001/notifications`: app booted and protected route redirected to login. Authenticated dashboard/notification rendering was not exercised because no logged-in local browser session was available.
- [x] Browser smoke at `http://127.0.0.1:3001/projects`: app booted and protected route redirected to `/login` without console/page errors. Authenticated create-project and project-overview rendering were not exercised because no logged-in local browser session was available.

## ProjectFlow Tracking

ProjectFlow initiative sync was attempted at the start and completion of the first implementation session and returned HTTP 500 HTML responses both times. The follow-up implementation session attempted `projectflow_cli.py sync checkpoint --entity initiative --phase start` and received HTTP 403 `Insufficient permissions`.

Phase 3 task sync succeeded on 2026-05-26. Task `kCvs5jcVE7Yc1YaaoYQ3` in project `ogZ8Pyz8pwEQtv8I64nu` was marked Done and a checkpoint comment was created with validation and provisioning follow-up notes.

Phase 4 task sync started successfully on 2026-05-26 by reusing task `kCvs5jcVE7Yc1YaaoYQ3` and moving it back to In Progress for the Codex integration phase.

Phase 5 production rollout task `SLzYFAwq5uOF2Lzr5aUT` was created on 2026-05-26 and moved to In Progress before deployment.

Phase 6 production provisioning readiness task `j1lLmvFhPKf6TUYUXGLC` was created on 2026-05-26 and moved to In Progress before adding the readiness checker and provisioning docs.

Phase 7 test notification diagnostics task `lmwbiojy4nXONLYQoiG7` was created on 2026-05-26 and moved to In Progress before adding the self-test callable and delivery-log UI.
