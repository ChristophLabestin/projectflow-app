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

## Deferred Items

Deferred because they require additional product design, entitlement work, or new app targets:

- WidgetKit target.
- ActivityKit Live Activity target.
- Share Sheet extension.
- Codex MCP/plugin packaging.
- Web push production VAPID key provisioning.
- Live deployment of functions.

## Validation Plan

- [x] `cd functions && npm run build`
- [x] `cd web && npm run build`
- [x] `cd web && npm run test:run -- healthService`
- [x] `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild-retention build`
- [x] Browser smoke at `http://127.0.0.1:3001/notifications`: app booted and protected route redirected to login. Authenticated dashboard/notification rendering was not exercised because no logged-in local browser session was available.
- [x] Browser smoke at `http://127.0.0.1:3001/projects`: app booted and protected route redirected to `/login` without console/page errors. Authenticated create-project and project-overview rendering were not exercised because no logged-in local browser session was available.

## ProjectFlow Tracking

ProjectFlow initiative sync was attempted at the start and completion of the first implementation session and returned HTTP 500 HTML responses both times. The follow-up implementation session attempted `projectflow_cli.py sync checkpoint --entity initiative --phase start` and received HTTP 403 `Insufficient permissions`. Local docs and this git diff are the durable record until the ProjectFlow API accepts tracking updates again.
