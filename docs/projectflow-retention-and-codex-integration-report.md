# ProjectFlow Retention, Notification, and Codex Integration Report

Date: 2026-05-26  
Scope: Web app, iOS app, Cloud Functions, ProjectFlow API, and Codex workflow integration  
Repo: `/Users/christophlabestin/Documents/GitHub/projectflow-app`

## Executive Summary

ProjectFlow currently has the bones of a serious execution system: projects, tasks, issues, flows, initiatives, notifications, pinned work, API tokens, and a Codex CLI skill already exist. The reason it is easy to neglect after a day is not that the app lacks project management features. The reason is that ProjectFlow is not yet aggressive enough about four loops:

1. **Re-entry loop:** bringing the user back into the right work at the right time.
2. **Capture loop:** making it cheaper to put work into ProjectFlow than to keep it in memory, chat, notes, or Codex output.
3. **Execution-truth loop:** making ProjectFlow update itself when real work happens elsewhere, especially when Codex is working in other repos.
4. **Project-intent loop:** making every active project explicit about outcome, success, scope, owners, risks, and operating cadence.

The highest leverage direction is to make ProjectFlow less like a destination app and more like an operating layer for daily work. The app should know what matters today, why a project exists, what "good" means for that project, when to interrupt, and how to silently absorb progress from Codex, GitHub, mobile capture, and notifications.

The first implementation wave should focus on reliability, not novelty:

- Make push delivery real on iOS and web.
- Add notification preferences and a notification diagnostics screen so the user can see why something did or did not reach them.
- Turn the dashboard into a daily re-entry cockpit with one obvious next action.
- Add a lightweight Project Brief model so project health, reminders, and Codex updates can be judged against success criteria instead of only raw activity.
- Build a "Focus Keeper" flow across web and iOS: one current focus item, persistent reminders, completion/block actions, and a daily recovery prompt.
- Harden the existing ProjectFlow API/Codex skill into a first-class ProjectFlow Codex integration plugin so every Codex session in any repo creates or updates ProjectFlow work automatically.

The most important strategic idea: **ProjectFlow must become the place that remembers and resumes work for you, not another app you must remember to maintain.**

## Current Repo Reality

This report is grounded in the current repository structure and docs.

### Existing Web Surfaces

- `web/screens/Dashboard.tsx` already computes a command-center style dashboard: overdue tasks, due-today tasks, scheduled-today tasks, blocked tasks, urgent issues, review ideas, risk projects, and focus tasks.
- `web/components/TopBar.tsx` already has pinned task/focus-item affordances through `PinnedTasksToggle`.
- `web/components/NotificationDropdown.tsx` and `web/screens/Notifications.tsx` provide in-app notifications, unread counts, notification navigation, join-request actions, and mark-read/delete actions.
- `web/services/notificationService.ts` creates and subscribes to Firestore notifications under `tenants/{tenantId}/notifications`.
- `web/components/SettingsModal.tsx` already has API token generation, including a "Codex Full Access" preset with project/task/initiative permissions.
- There is no visible PWA manifest, service worker, web push registration, or Firebase Messaging web integration in the current `web/` app.

### Existing Project Data Model

- `web/types.ts` defines `Project` with title, description, progress, status, project state, start/due dates, owner, media, priority, visibility, modules, resources, members, roles, GitHub fields, personal-project flag, and overview layout.
- `web/screens/CreateProjectWizard.tsx` asks for creation method, name, description, project type, modules, team/visibility, dates, priority, status, media, links, and optional GitHub repo.
- The project type currently only drives module defaults and software-specific GitHub setup; it is not persisted as a durable project-management classification.
- `web/services/geminiService.ts` can generate a richer `ProjectBlueprint` with target audience, milestones, initial tasks, and tech stack, but project creation only persists the project basics plus generated milestones/tasks.
- `web/types.ts` gives initiatives `outcome`, `successMetric`, and `health`, while the parent `Project` lacks equivalent outcome and success fields.
- `web/services/healthService.ts` already computes useful derived health from deadlines, task completion, blockers, dependencies, issues, milestones, sprints, activity, comments, and setup gaps. The missing input is not raw execution data; it is project intent.

### Existing iOS Surfaces

- `swift/projectflow/AppDelegate.swift` requests push authorization, registers for remote notifications, wires Firebase Messaging, and captures FCM tokens.
- `swift/projectflow/PushTokenManager.swift` stores FCM tokens under `/users/{userId}.fcmTokens`.
- `swift/projectflow/NotificationStore.swift` listens to tenant notifications in Firestore and drives the iOS notifications list.
- `swift/projectflow/NotificationsView.swift` supports notification list, mark-read, delete, clear-all, and project deep links.
- `swift/projectflow/DashboardView.swift` already has active projects, quick actions, focus snapshot, calendar, charts, pinned tasks, and notification navigation.
- `swift/projectflow/SnapToFlowView.swift` exists, which means a mobile-first capture concept has already started.
- `MOBILE_INNOVATION.md` already proposes Snap-to-Flow, Dynamic Island Focus Keeper, Walk & Log, widgets, Share Sheet, and geofenced context.

### Existing Backend Surfaces

- `functions/src/notifications.ts` reacts to new tenant notification documents and sends email.
- That function currently does **not** send FCM/APNs push notifications, despite iOS token registration existing.
- `functions/src/scheduler.ts` already contains scheduled jobs for social posts, sprints, and daily health snapshots. This is the right place to add daily agenda/digest and stale-work nudges.
- `functions/src/projectflow-api.ts` exposes REST endpoints for projects, tasks, initiatives, subtasks, issues, ideas, milestones, sprints, categories, mindmaps, project groups, comments, and activities.
- `functions/src/authUtils.ts` and `functions/src/workspace-admin.ts` support API tokens, but current token permissions are mainly project/task/initiative oriented.

### Existing Codex Integration

- A local ProjectFlow Codex skill exists at `~/.codex/skills/projectflow/`.
- The skill supports repo linking through `.projectflow/project.json`, API token auth, task/initiative CRUD, and deterministic checkpoint syncing through `sync checkpoint`.
- The local repo is already linked to project `ogZ8Pyz8pwEQtv8I64nu` under tenant `l5hkY1MDnGaiKzEHlS53VfVRpLJ2`.
- In this session, `sync checkpoint` returned HTTP 500. This matches existing `GOTCHAS.md` notes that ProjectFlow task/initiative writes can fail while app work succeeds.

## Root Problem

The user problem is not "I need more reminders." It is:

> ProjectFlow does not yet know enough about each project, create enough unavoidable re-entry points into work, or automatically absorb work done outside ProjectFlow.

That has five practical causes.

### 1. Notifications Are Not a Reliable Delivery System Yet

Current notification documents reach:

- In-app web notification center.
- In-app iOS notification center.
- Email through `functions/src/notifications.ts`.

They do not appear to reliably reach:

- iOS push from the backend.
- Web push/PWA notifications.
- Home screen widgets.
- Live Activities.
- A diagnostic surface that explains delivery failures.

iOS token registration exists, but backend push fanout does not. That creates a dangerous false sense of coverage: the app asks for notification permission and stores FCM tokens, but notification creation currently triggers email only.

### 2. The App Relies Too Much on Manual Return

The dashboard has strong calculations, but a user must remember to open the web or iOS app. If they do not, ProjectFlow does not actively recover them into the day.

The right model is:

- Morning: "Here is the smallest useful plan for today."
- During work: "You picked this focus item; continue, complete, snooze, or mark blocked."
- End of day: "Here is what moved, what is still open, and what Codex touched."
- After inactivity: "You have not updated ProjectFlow since yesterday. Pick one recovery action."

### 3. Codex Work Happens Outside ProjectFlow

The user is using Codex as a real execution agent across many repos. If Codex implements a feature, fixes a bug, writes a report, or discovers follow-up work but ProjectFlow only sees that when someone manually updates it, ProjectFlow will always lag behind reality.

That breaks trust. A task system becomes optional when it is not the truth.

### 4. Capture Is Not Yet Ambient Enough

Work enters the user's day through:

- Codex sessions.
- Browser research.
- GitHub/CI.
- Mobile moments.
- Screenshots.
- Voice thoughts.
- Client messages.
- Whiteboards.

ProjectFlow currently has good structured modules, but it needs more "capture from anywhere" paths so the default behavior becomes "send it to ProjectFlow" instead of "remember it."

### 5. The Project Model Does Not Yet Capture the Project Contract

The current project entity says that a project exists, when it starts or ends, which modules are enabled, and who can access it. That is enough for lightweight task tracking. It is not enough for strong project management.

Missing management context:

- What outcome should this project create?
- What success criteria will prove it worked?
- What is explicitly in scope and out of scope?
- What deliverables are expected?
- Who is the decision owner?
- Which stakeholders matter?
- What assumptions, constraints, risks, and dependencies are known from the start?
- How often should ProjectFlow check in, report status, or escalate silence?
- What project type or operating mode should shape health scoring and dashboards?

Without this, ProjectFlow can detect symptoms but not judge intent. It can say a task is overdue, but not whether the overdue task matters to the promised outcome. It can detect scope creep from task volume, but not compare new work to an agreed scope. It can say activity is stale, but not know whether the project is intentionally paused, blocked by a decision, or waiting on an external dependency.

## Product Principle

ProjectFlow should optimize for this sentence:

> At any moment, ProjectFlow tells me what matters next and captures what changed without me babysitting it.

That implies several design rules:

- Every notification must be actionable or dismissible.
- Every reminder must explain why it is appearing.
- Every daily re-entry should show one recommended next action, not a dashboard wall.
- Every external automation should write progress back to ProjectFlow.
- Every Codex session should leave behind a ProjectFlow task, update, or explicit "nothing to track" record.
- Every notification channel should have diagnostics because silent failure destroys trust.
- Every active project should have a lightweight brief that defines outcome, success, scope, owner, risks, and operating cadence.

## Project Data Model Improvements

The current data model should be widened before ProjectFlow tries to become more proactive. Otherwise notifications, dashboard ranking, and Codex automation will keep optimizing around urgency and recency rather than actual project importance.

### Recommended Project Model Split

Keep `Project` as the top-level document, but stop treating it as one flat metadata bucket. Conceptually split project data into these groups:

```text
ProjectCore
  title
  description
  status
  projectType
  operatingMode
  priority
  startDate
  dueDate
  ownerId
  decisionOwnerId
  modules
  visibility

ProjectBrief
  objective
  desiredOutcome
  successCriteria[]
  inScope[]
  outOfScope[]
  deliverables[]
  targetAudience
  stakeholders[]
  assumptions[]
  constraints[]

ProjectOperatingModel
  reviewCadence
  reportingCadence
  staleAfterDays
  escalationPolicy
  notificationProfile
  defaultFocusMode

ProjectRiskRegister
  risks[]
  dependencies[]
  openDecisions[]

ProjectHealthSnapshot
  score
  status
  reasons[]
  recommendedActions[]
  scheduleConfidence
  scopeConfidence
  lastMeaningfulUpdateAt
  nextReviewAt
```

Implementation can start as nested optional fields on `Project` and move to subcollections later if write volume or permissions require it.

### Minimum Fields to Ask During Project Creation

Do not turn project creation into a long enterprise form. Ask enough to make the project manageable, then let ProjectFlow progressively complete the brief.

Required or strongly encouraged:

1. **Objective:** one sentence for why the project exists.
2. **Success criteria:** two to five measurable or observable signs that the project is successful.
3. **Scope:** what is in, plus at least one explicit out-of-scope boundary for non-trivial projects.
4. **Decision owner:** who can decide tradeoffs when scope, deadline, or quality conflict.
5. **Target date and confidence:** date plus confidence, not just date.
6. **Top risks or constraints:** one to three known risks at creation.
7. **Operating cadence:** weekly, twice weekly, milestone-based, or ad hoc.

Optional, progressive fields:

- Stakeholders.
- Deliverables.
- Dependencies.
- Assumptions.
- Budget or capacity.
- Reporting expectations.
- Automation preferences.

### Project Templates Should Shape the Questions

The current project type choices are useful but too broad. They should become durable templates that control default fields, modules, health rules, and automations.

Recommended starter templates:

- Software release.
- Client delivery.
- Internal operations.
- Product discovery.
- Marketing campaign.
- Content/social campaign.
- Finance/accounting project.
- Personal focus project.

Each template should define:

- Default modules.
- Required brief fields.
- Suggested success criteria.
- Default health weights.
- Default notification/reporting cadence.
- Suggested initial milestones.

### Health Should Become Explainable Against the Brief

`healthService.ts` already detects deadline pressure, overdue tasks, blockers, dependencies, issue backlog, stale activity, and setup gaps. The next version should add brief-aware factors:

- Missing objective or success criteria.
- Active project with no decision owner.
- Delivery deadline with no deliverables or milestones.
- Tasks added outside declared scope.
- High-risk project with no mitigation owner.
- Review cadence missed.
- Success criteria not linked to any task, milestone, initiative, or metric.
- Project marked healthy but no activity touched the stated outcome.

The dashboard should then show not only "this is risky," but "this is risky because the promised outcome is not being advanced."

### Codex Should Update Project Intent, Not Only Tasks

Codex integration should be allowed to write structured project-management evidence:

- Add a discovered risk.
- Add an open decision.
- Mark a success criterion as supported by completed work.
- Add a follow-up under an existing deliverable.
- Flag scope drift when implemented work falls outside the brief.
- Append validation evidence to a project or initiative.

This makes Codex a project-management participant, not only a task updater.

## Web App Improvements

### 1. Turn Dashboard Into a Daily Re-entry Cockpit

Current `Dashboard.tsx` already computes the right raw signals. The next step is to make the first viewport less about general status and more about one decision:

- "Continue focus item"
- "Start today's first task"
- "Review a blocker"
- "Catch up after inactivity"
- "Pick a project to resume"

Recommended first viewport:

- One primary action: the single best next work item.
- Two secondary actions: "Snooze" and "Pick different focus."
- Compact counts: overdue, due today, blocked, review.
- Last ProjectFlow update: "Last activity was 22h ago" when relevant.
- Codex activity note: "Codex updated 3 tasks since you last opened ProjectFlow" once the integration exists.

Existing code to reuse:

- `web/screens/Dashboard.tsx` command items.
- `web/components/TopBar.tsx` pinned/focus item.
- `web/context/PinnedTasksContext` and pinned task model.

New concept:

- `DailyFocusPlan` model generated from tasks, issues, initiatives, project risk, due dates, and Codex updates.
- Store the user's chosen focus item so web, iOS, widgets, and Codex all agree on the same current target.

### 2. Promote Pinned Tasks Into a Real Focus System

Pinned tasks are useful, but they should become an active focus loop.

Recommended behavior:

- A user can select exactly one "current focus."
- The focus item appears in the top bar, mobile dashboard, widget, and notifications.
- Starting focus optionally starts a timer or session.
- After configurable inactivity, ProjectFlow nudges: "Still working on this, done, blocked, or snooze?"
- Completing focus marks the task done or opens the completion sheet.
- Blocking focus creates an issue or updates task status.
- Snoozing focus asks for a time.

Why this matters:

- The app stops being a backlog.
- It becomes an external memory for the current commitment.
- It gives notifications a legitimate reason to interrupt.

Likely files:

- `web/components/TopBar.tsx`
- `web/components/PinnedTasksModal.tsx`
- `web/context/PinnedTasksContext.tsx`
- `swift/projectflow/PinnedTasksStore.swift`
- `swift/projectflow/PinnedTasksSheet.swift`
- `swift/projectflow/DashboardView.swift`

Suggested data fields:

```text
users/{userId}
  focusState:
    tenantId
    projectId
    itemType: task | issue | initiative | flow
    itemId
    title
    startedAt
    lastNudgedAt
    snoozedUntil
    status: active | paused | blocked | completed
```

### 3. Add Web Push and PWA Installation

The web app currently has in-app notifications but no obvious PWA/web push layer.

Recommended implementation:

- Add `web/public/manifest.webmanifest`.
- Add `web/public/firebase-messaging-sw.js` or equivalent service worker.
- Register Firebase Messaging in the web app.
- Store web push tokens alongside device metadata.
- Add a settings/diagnostics panel for web notification permission and last token sync.
- Add a small "Install ProjectFlow" prompt only when useful, not as a generic banner.

This should not be a cosmetic PWA effort. The goal is:

- Browser-level reminders when ProjectFlow is closed.
- Badge count support where available.
- Fast app launching back into exact task/issue/initiative routes.

Likely files:

- `web/services/firebase.ts`
- `web/services/notificationService.ts`
- `web/components/SettingsModal.tsx`
- `web/screens/Notifications.tsx`
- `functions/src/notifications.ts`
- `FIRESTORE_STRUCTURE.md`

### 4. Make Notifications Actionable, Not Just Informational

The notification center should become an action center.

Recommended notification actions:

- Task assigned: open, start focus, snooze, mark done.
- Due soon: start focus, reschedule, snooze.
- Overdue: reschedule, complete, mark blocked.
- Comment mention: reply, open, mark resolved.
- Initiative update: review, create follow-up task.
- Codex checkpoint: view diff summary, approve follow-ups, mark task done.
- Project stale: resume project, create daily plan, archive/pause.

The web dropdown should not mark notifications read on hover. Reading should be intentional or happen after opening/acting. Hover-to-read can accidentally clear things the user has not processed.

Likely files:

- `web/components/NotificationDropdown.tsx`
- `web/screens/Notifications.tsx`
- `web/services/notificationService.ts`
- `web/locales/en.ts`
- `web/locales/de.ts`

### 5. Add Notification Preferences and Delivery Diagnostics

This is critical. If the user says notifications are not reaching them, the app needs to answer why.

Recommended diagnostics screen:

- Push permission: granted/denied/not requested.
- iOS token status: last synced, token count.
- Web token status: supported, registered, last synced.
- Email delivery: SMTP configured, last send status.
- Last notification document created.
- Last push attempt.
- Last email attempt.
- Muted projects or quiet hours.
- Active tenant mismatch warning.
- "Send test notification" button.

Recommended settings:

- Channel toggles: in-app, email, web push, iOS push.
- Quiet hours.
- Daily digest time.
- Due-soon timing.
- Overdue escalation.
- Focus nudge cadence.
- Project-level mute.
- Codex session updates on/off.

Suggested data:

```text
users/{userId}/notificationSettings/default
  channels:
    inApp: true
    email: true
    webPush: true
    mobilePush: true
  quietHours:
    enabled: true
    start: "22:00"
    end: "07:30"
    timezone: "Europe/Berlin"
  dueSoon:
    enabled: true
    offsetsMinutes: [1440, 120, 15]
  focusNudges:
    enabled: true
    idleMinutes: 45
  digests:
    morning: "08:30"
    evening: "17:30"
```

```text
tenants/{tenantId}/notificationDeliveryLogs/{logId}
  notificationId
  userId
  channel: email | fcm | webPush | inApp
  status: queued | sent | failed | skipped
  reason
  providerMessageId
  createdAt
```

### 6. Create a "Forgotten Work" Recovery Flow

If the user neglects ProjectFlow for a day, ProjectFlow should not wait passively.

Trigger:

- No meaningful ProjectFlow activity for 20-28 hours.
- Open tasks due today/overdue exist, or active projects had recent Codex/GitHub movement.

Recovery prompt:

- "Resume yesterday's focus"
- "Plan today"
- "Review Codex changes"
- "Snooze all until tomorrow"

This should appear:

- On web dashboard first viewport.
- As a mobile push.
- In daily email digest if push fails.

Likely backend:

- Scheduled function in `functions/src/scheduler.ts`.
- Reuses notification creation pipeline.

### 7. Add Calendar Blocks and Intentional Work Sessions

The current app has a calendar route and dashboard date logic. Add a simple "work session" model:

- Start focus session.
- Optional duration.
- Optional project.
- Optional task.
- Completion summary.

This gives ProjectFlow a personal productivity layer without becoming a time tracker.

Useful notifications:

- "Your planned ProjectFlow block starts now."
- "You planned ProjectFlow work but have not started the focus item."
- "Session ended. Mark done, blocked, or continue?"

### 8. Add a Browser Quick Capture Extension Later

This is not first-wave, but it matters.

Browser extension actions:

- Save current URL as project resource.
- Create task from selected text.
- Create flow idea from page.
- Attach screenshot to task/issue.
- Send to active focus item.

This complements web push/PWA but should come after core notification reliability.

## iOS App Improvements

### 1. Finish the Push Delivery Loop

iOS currently registers push tokens, but backend notification fanout is missing. This should be the first mobile retention fix.

Required changes:

- Update `functions/src/notifications.ts` to fetch `/users/{userId}.fcmTokens`.
- Send FCM notification payloads for eligible notification docs.
- Include deep-link metadata: tenantId, projectId, taskId, issueId, flowId, initiativeId.
- Add delivery logs.
- Remove invalid tokens when FCM reports permanent token failures.
- Respect notification settings and quiet hours.

iOS app changes:

- Handle notification tap routing in `AppDelegate.swift` or a notification coordinator.
- Route to exact task/issue/flow/initiative, not only project.
- Update badge count from unread notifications.
- Add "Send test push" diagnostics.

### 2. Add Dynamic Island / Live Activity Focus Keeper

`MOBILE_INNOVATION.md` already proposes this, and it is exactly aligned with the user's problem.

Behavior:

- Starting a focus item starts a Live Activity.
- Compact Dynamic Island shows active task and elapsed time.
- Expanded Dynamic Island shows title, project, timer, complete, blocked, and snooze.
- Lock Screen shows the active focus item.
- Ending/completing focus updates the activity.

This turns the phone itself into the re-entry point.

Likely files/new modules:

- `swift/projectflow/FocusActivityAttributes.swift`
- `swift/projectflow/FocusActivityManager.swift`
- `swift/projectflow/DashboardView.swift`
- `swift/projectflow/TasksView.swift`
- `swift/projectflow/ProjectTaskDetailView.swift`

### 3. Add Interactive Home Screen Widgets

Widgets are the strongest low-friction retention surface after push.

Recommended widgets:

- Small: current focus item + status.
- Medium: top 3 today tasks with complete/snooze actions.
- Medium: pinned project health + next action.
- Lock screen: one focus item or overdue count.

Use WidgetKit with App Groups if needed. Keep the first version read-heavy if interactive actions are too much initially.

### 4. Add Notification Action Buttons

Mobile push notifications should support actions:

- Complete.
- Snooze 1h.
- Mark blocked.
- Start focus.
- Open.

This matters because the user may not need to open the app to keep ProjectFlow truthful.

### 5. Add Share Sheet Capture

The Share Sheet concept in `MOBILE_INNOVATION.md` is strategically correct.

Recommended first version:

- Share URL/text/image into ProjectFlow.
- Choose active project or current focus item.
- Create task, flow, issue, or resource.
- Default to "inbox" if the user does not choose a project.

Why this matters:

- Capture becomes faster than forgetting.
- Mobile becomes a useful input layer, not just a viewer.

### 6. Add Voice Capture

"Walk & Log" should be implemented as a quick capture tool, not only issue creation.

Capture modes:

- Task.
- Issue.
- Flow idea.
- Project update.
- Codex follow-up note.

The app can infer type, but the user should be able to change it before saving.

### 7. Add Local Notification Fallbacks

Not every reminder needs a backend roundtrip.

Use local notifications for:

- Focus session check-ins.
- User-scheduled reminders.
- "Nudge me in 1h."
- Offline-created reminders.

Use backend push for:

- Cross-device events.
- Team events.
- Codex updates.
- Daily digests.
- Stale project detection.

### 8. Improve Mobile Notification Onboarding

Do not ask for push permission cold on first launch. Ask after value is clear.

Recommended flow:

1. User picks or creates first focus item.
2. App says: "ProjectFlow can remind you when this needs attention."
3. Request notification permission.
4. Immediately send a local or backend test notification.
5. Show "Notifications are ready" or explain what failed.

## Codex Integration Strategy

The Codex integration is more important than another dashboard polish pass. If Codex does real work but ProjectFlow does not update, ProjectFlow will always feel optional.

The repo already has a strong start:

- ProjectFlow API endpoints exist.
- API token creation exists.
- A local ProjectFlow Codex skill exists.
- `.projectflow/project.json` linking exists.
- Deterministic `externalKey` checkpoint upserts exist.

The next step is to turn this into a robust ProjectFlow Codex Integration Suite.

### Recommended Architecture

Use three layers:

1. **ProjectFlow API hardening** in the app/backend.
2. **ProjectFlow Codex plugin/skill** installed in Codex.
3. **Repo-local AGENTS.md contracts** that tell Codex when and how to sync.

### Layer 1: API Hardening

The ProjectFlow API should add one high-level endpoint for Codex sessions.

Instead of making Codex orchestrate many low-level task/initiative/comment calls, expose:

```text
POST /api/projectflow/codex/sessions/start
POST /api/projectflow/codex/sessions/checkpoint
POST /api/projectflow/codex/sessions/finish
POST /api/projectflow/codex/followups/bulk-create
```

Session start payload:

```json
{
  "tenantId": "tenant-id",
  "projectId": "project-id",
  "repoRoot": "/Users/name/Documents/GitHub/project",
  "repoName": "project",
  "branch": "main",
  "request": "Fix notifications",
  "scope": "web,functions",
  "mode": "task|initiative",
  "externalKey": "sha256"
}
```

Checkpoint payload:

```json
{
  "sessionId": "codex-session-id",
  "phase": "start|progress|validation|success|failure",
  "summary": "Implemented push fanout and ran web build.",
  "filesChanged": [
    "functions/src/notifications.ts",
    "web/services/notificationService.ts"
  ],
  "validation": [
    { "command": "cd web && npm run build", "status": "passed" }
  ],
  "pendingDeployment": [
    "firebase deploy --only functions:onNotificationCreated"
  ]
}
```

Finish payload:

```json
{
  "sessionId": "codex-session-id",
  "status": "done|blocked|partial",
  "summary": "Report written and tracking attempted.",
  "finalFilesChanged": [
    "docs/projectflow-retention-and-codex-integration-report.md"
  ],
  "followUps": [
    {
      "title": "Implement ProjectFlow push fanout",
      "description": "Use FCM tokens from users docs and add delivery logs.",
      "priority": "High"
    }
  ]
}
```

Why this matters:

- Codex gets one stable contract.
- ProjectFlow owns mapping to tasks, initiatives, comments, activity, and notifications.
- The API can be idempotent by `externalKey`.
- Failures become easier to diagnose.

### Layer 2: Codex Plugin / Skill

Build a dedicated ProjectFlow Codex plugin bundle. It should include:

- A `projectflow` skill for agent behavior.
- An MCP server exposing higher-level ProjectFlow tools.
- A CLI fallback using the existing `projectflow_cli.py`.
- Setup docs and a one-command repo linker.

Recommended tools:

```text
projectflow.link_repo
projectflow.show_link
projectflow.start_session
projectflow.checkpoint
projectflow.finish_session
projectflow.create_followups
projectflow.list_my_focus
projectflow.set_focus
projectflow.search_work
projectflow.attach_artifact
```

Recommended plugin behavior:

- On any non-trivial coding task, create or upsert a ProjectFlow task.
- On major feature/route/migration work, create or upsert a ProjectFlow initiative and attach execution tasks.
- On test/build failure, checkpoint as blocked or partial with exact command and error summary.
- On success, mark the task done and add validation status.
- On discovered follow-ups, bulk-create tasks and write doc references.
- On deployment-required work, create pending deployment tasks.
- On user asking "what did you do?", read the ProjectFlow task and local git diff.

Important: keep the plugin explicit and reliable before trying to make it magical. A predictable "sync start/checkpoint/finish" workflow is more valuable than hidden background automation that silently fails.

### Layer 3: Repo-Local Agent Contracts

Every important repo should include a short ProjectFlow block in `AGENTS.md`.

Suggested snippet:

```md
## ProjectFlow Tracking

- This repo is linked to ProjectFlow project `<projectId>`.
- For substantial work, Codex must create or update a ProjectFlow task at start and finish.
- For major features, migrations, new routes/screens/resources, create or update a ProjectFlow initiative first.
- Include scope summary, touched files, validation commands, deployment status, and follow-up items.
- If ProjectFlow sync fails, continue the repo work, record the failure locally, and retry before final response.
```

This repo already follows that pattern. The next step is to make it easy to apply across Monoria, Grade Manager, Quivena, MyLife, and other active projects.

## ProjectFlow Features Specifically for Codex Work

### 1. Codex Activity Feed

Add a project-level feed filter:

- Human activity.
- Codex activity.
- GitHub activity.
- Deployment activity.
- Failed validation.

Each Codex activity should include:

- Repo.
- Branch.
- Request summary.
- Files touched.
- Validation.
- Final status.
- Linked task/initiative.

### 2. Codex Session Detail Page

Add a detail surface under a project:

```text
/project/:id/codex-sessions/:sessionId
```

It should show:

- Original request.
- Started/finished timestamps.
- Agent status.
- Repo and branch.
- Linked task/initiative.
- Touched files.
- Validation commands.
- Follow-ups created.
- Deployment notes.
- Final summary.

This page would make Codex work reviewable inside ProjectFlow.

### 3. Codex Inbox

When Codex discovers follow-ups but cannot safely implement them in the current session, they should land in a project "Codex Inbox."

Inbox item states:

- Proposed.
- Accepted.
- Converted to task.
- Dismissed.
- Needs clarification.

This prevents Codex from spamming real tasks while still preserving useful discoveries.

### 4. Cross-Repo Daily Digest

Because the user uses Codex across many projects, ProjectFlow should provide:

- "What Codex changed today."
- "Tasks completed by Codex."
- "Blocked sessions."
- "Follow-ups waiting for approval."
- "Deployments pending."

This digest is a retention feature because it gives the user a reason to open ProjectFlow every day.

### 5. Commit/PR Linking

The plugin should capture:

- Branch name.
- Latest commit hash after the session.
- PR URL if created.
- CI status if known.

Then ProjectFlow tasks can show:

- Linked commits.
- Open PRs.
- Failed checks.
- Deployment status.

This turns ProjectFlow into a real work ledger, not just a planning tool.

## Notification Architecture

### Event Model

Do not treat notifications as free-form messages only. Add event types with structured routing.

Recommended categories:

- `assignment`
- `due_soon`
- `overdue`
- `focus_checkin`
- `blocked`
- `mention`
- `invite`
- `review_needed`
- `project_stale`
- `project_brief_incomplete`
- `project_review_due`
- `scope_drift`
- `decision_needed`
- `codex_checkpoint`
- `codex_followup`
- `deployment_pending`
- `daily_digest`

Each notification should include:

```text
category
severity: info | action | warning | critical
actionState: open | acted | snoozed | dismissed
primaryAction
secondaryActions[]
deepLink
expiresAt
deliveryPolicy
```

### Delivery Policy

Add a delivery policy layer so not every notification goes everywhere.

Examples:

- Mentions: in-app + push immediately.
- Due in 24h: digest unless high priority.
- Due in 15m: push if enabled.
- Focus check-in: local notification or push, not email.
- Daily digest: push + email if user has been inactive.
- Codex success: in-app only unless deployment is pending.
- Codex failure/blocker: push + in-app.
- Project stale: digest first, push after repeated inactivity.

### Backend Pipeline

Update `functions/src/notifications.ts` from "email on create" to "delivery orchestrator."

Pipeline:

1. Notification doc is created.
2. Load recipient settings.
3. Determine eligible channels.
4. Respect quiet hours and snooze.
5. Send email/push/web push as needed.
6. Record delivery logs.
7. Update aggregate unread/badge count.
8. Remove invalid tokens.

Pseudo-flow:

```text
onNotificationCreated
  load user
  load settings
  load device tokens
  classify notification
  for each channel:
    if allowed:
      send
      log success/failure
    else:
      log skipped reason
```

### Delivery Diagnostics Are Non-Negotiable

For the user's stated problem, diagnostics are part of the feature, not an admin extra.

Minimum diagnostic output:

- "Last notification created: 10:42"
- "Email sent: yes/no"
- "Mobile push sent: no, no token found"
- "Web push sent: no, permission denied"
- "Quiet hours skipped until 07:30"
- "Token invalid, please re-open iOS app"
- "SMTP not configured"

## Habit Loop Design

ProjectFlow should use rituals, not random reminders.

### Morning Ritual

Time: user-configured, default 08:30 local time.

Message:

- "Today's plan is ready."
- Shows 1 recommended focus item.
- Shows due/overdue/blocker count.
- One tap opens dashboard daily plan.

### Midday Check

Only if:

- Focus item is active and no progress for configured duration.
- Due-today items remain.
- A Codex blocker occurred.

Actions:

- Continue.
- Done.
- Blocked.
- Snooze.

### End-of-Day Wrap

Time: user-configured, default 17:30.

Shows:

- Completed today.
- Still open.
- Codex work completed.
- Follow-ups needing approval.
- Tomorrow's first suggested item.

### Recovery After Neglect

If ProjectFlow has not been opened/updated in a day:

- Do not shame the user.
- Ask for one action.

Example:

```text
ProjectFlow has 4 items that need a decision.
Start with: "Finish notification report"?
[Start] [Plan today] [Snooze]
```

## Prioritized Roadmap

### Phase 0: Add the Project Brief Foundation

Goal: ProjectFlow can understand what each project is supposed to accomplish before it starts ranking, nudging, or summarizing work.

Tasks:

1. Add optional `brief`, `operatingModel`, `riskRegister`, and `healthSnapshot` fields to the project model.
2. Persist durable `projectType` and `operatingMode` instead of using project type only for module defaults.
3. Rework create project into a lightweight Project Brief flow: objective, success criteria, scope, decision owner, risk, date confidence, cadence.
4. Update AI blueprint generation so target audience, suggested tech stack, success criteria, risks, and assumptions can be saved into the project brief.
5. Add Project Overview sections for "Project contract" and "Operating state."
6. Extend health scoring with brief-aware setup gaps and explainable recommended actions.

Validation:

- Create a project from scratch and see the brief persisted.
- Create a project from AI and confirm the richer blueprint fields are preserved.
- Open Project Overview and see the objective, success criteria, scope, owner, risks, and cadence.
- Confirm a project missing success criteria or decision owner is treated as an incomplete setup, not as healthy by default.

### Phase 1: Fix the Broken Notification Loop

Goal: notifications actually reach the user and failures are explainable.

Tasks:

1. Add backend FCM fanout in `functions/src/notifications.ts`.
2. Add delivery logs under `tenants/{tenantId}/notificationDeliveryLogs`.
3. Add notification settings and quiet hours.
4. Add iOS notification tap routing to task/issue/flow/initiative.
5. Add badge count updates.
6. Add web push/PWA support.
7. Add notification diagnostics and "send test notification."

Validation:

- Create notification doc manually.
- Confirm web in-app notification appears.
- Confirm email sends or logs skipped reason.
- Confirm iOS push sends to registered token.
- Confirm web push sends when permission is granted.
- Confirm failure reasons are visible in diagnostics.

### Phase 2: Build the Daily Focus Loop

Goal: ProjectFlow tells the user what to do next and keeps the active work visible.

Tasks:

1. Create shared focus state model.
2. Upgrade pinned task UI into current focus UI.
3. Add dashboard daily re-entry card.
4. Add focus start/complete/block/snooze actions.
5. Add scheduled focus nudges.
6. Add end-of-day wrap.

Validation:

- Select focus on web, see it on iOS.
- Select focus on iOS, see it on web.
- Snooze suppresses nudges until the right time.
- Complete action updates task and clears focus.
- Block action updates status or creates issue.

### Phase 3: Make Mobile Ambient

Goal: the phone keeps ProjectFlow present without forcing the full app open.

Tasks:

1. Add Live Activity Focus Keeper.
2. Add home screen widgets.
3. Add notification action buttons.
4. Add Share Sheet capture.
5. Expand Snap-to-Flow.
6. Add voice quick capture.

Validation:

- Focus item appears on Lock Screen/Dynamic Island.
- Widget reflects current focus.
- Push actions update Firestore.
- Share Sheet creates a task/flow/resource.

### Phase 4: Productize Codex Integration

Goal: Codex work updates ProjectFlow automatically across all repos.

Tasks:

1. Harden ProjectFlow API idempotent session endpoints.
2. Add Codex session and activity models.
3. Package a ProjectFlow Codex plugin/skill.
4. Add repo linker command and status diagnostics.
5. Add bulk follow-up capture.
6. Add Codex activity feed in web.
7. Add daily Codex digest notification.

Validation:

- Start Codex work in another repo.
- ProjectFlow task/initiative appears.
- Session checkpoints are logged.
- Build/test status appears.
- Finish marks task done or blocked.
- Follow-ups are captured without manual copy/paste.

### Phase 5: Intelligent Recovery and Prioritization

Goal: ProjectFlow becomes proactive without becoming noisy, and it prioritizes work against the project brief rather than only against deadlines and recent activity.

Tasks:

1. Add stale project detection.
2. Add "silent but risky" project nudges.
3. Add project health push rules.
4. Add AI-assisted daily plan generation.
5. Add GitHub/CI/deployment integration.
6. Add notification quality metrics.
7. Add brief-aware priority ranking: success criteria impact, risk severity, decision urgency, scope drift, and cadence misses.

Validation:

- App generates useful daily plans.
- User can explain why every nudge appeared.
- No duplicate notifications across channels.
- Quiet hours and snooze are respected.
- Daily plan distinguishes urgent noise from work that moves the declared project outcome.

## Recommended First Implementation Slice

Do this first:

### Slice: Project Brief, Notification Reliability, and Daily Re-entry

Backend:

- Add Project Brief fields to the project schema and API serialization.
- Update `functions/src/notifications.ts` to send FCM push using `/users/{userId}.fcmTokens`.
- Add delivery log docs.
- Add skip reasons for quiet hours, missing tokens, disabled channel, and send failures.

Web:

- Rework create project to ask for objective, success criteria, scope boundary, decision owner, top risks, date confidence, and cadence.
- Add Project Overview "Project contract" and "Operating state" sections.
- Extend health service with setup gaps for missing brief fields.
- Add notification diagnostics under settings or `/notifications`.
- Add web push token registration.
- Add PWA manifest/service worker.
- Add "Send test notification."

iOS:

- Route notification taps to exact destination.
- Update app badge.
- Show push/token status in settings.

Dashboard:

- Add "Resume today" card using current `Dashboard.tsx` command calculations plus project brief relevance.
- Add one primary next action.

Codex:

- Fix or harden API task/initiative checkpoint writes.
- Add a session-level endpoint or at least make current `sync checkpoint` reliable.

This slice directly addresses the user's complaint: forgetting the app, notifications not reaching them, and projects feeling too vague to manage well.

## Suggested ProjectFlow Initiative

Create an initiative in the ProjectFlow project:

Title:

```text
Project Brief, Retention, Notifications, and Codex Integration
```

Success metric:

```text
ProjectFlow understands what each active project is supposed to achieve and reliably pulls the user back into the next useful action across web, iOS, and Codex-driven work, with visible delivery diagnostics and automatic Codex session tracking.
```

Initial execution tasks:

1. Add Project Brief fields, create-project capture, and overview presentation.
2. Extend health scoring and dashboard ranking with brief-aware signals.
3. Implement backend push fanout and delivery logs.
4. Add notification preferences and diagnostics.
5. Add web PWA/web-push registration.
6. Add iOS push deep-link routing and badge updates.
7. Add shared focus state and daily re-entry card.
8. Add ProjectFlow Codex session endpoint.
9. Package ProjectFlow Codex plugin/skill.
10. Add Codex activity feed and daily digest.

## Risks and Guardrails

### Risk: Overasking During Project Creation

The Project Brief is necessary, but a heavy creation form will make capture worse.

Guardrails:

- Keep quick create available.
- Ask only the fields needed for current management quality.
- Let AI draft the brief from one paragraph.
- Allow "fill later" for optional fields.
- Show setup completeness as a useful signal, not a scolding banner.

### Risk: Project Brief Becomes Static Documentation

If the brief is created once and never revisited, it becomes stale paperwork.

Guardrails:

- Treat the brief as a living project contract.
- Ask for review when scope changes, date confidence drops, or risks become blockers.
- Link success criteria to tasks, milestones, initiatives, or metrics.
- Let Codex propose brief updates when implementation discovers reality changes.
- Show "last reviewed" and "next review" on the project overview.

### Risk: Notification Noise

More notifications can make the problem worse.

Guardrails:

- Default to daily digest for low urgency.
- Push only actionable or time-sensitive items.
- Always include snooze.
- Show why a notification appeared.
- Add per-project mute.

### Risk: Codex Task Spam

If every tiny Codex action creates a task, ProjectFlow becomes cluttered.

Guardrails:

- Use one session task per user request.
- Use initiatives only for major/multi-file work.
- Put uncertain discoveries into Codex Inbox before converting to tasks.
- Use deterministic external keys to upsert, not duplicate.

### Risk: False Trust in Push

If the app says notifications are enabled but delivery silently fails, the user will stop trusting it.

Guardrails:

- Add delivery logs.
- Add settings diagnostics.
- Add test notification.
- Remove invalid tokens.
- Show last successful push time.

### Risk: ProjectFlow API Instability

Codex sync returned HTTP 500 during this report session. Existing docs already note similar 500/503 failures.

Guardrails:

- Make checkpoint endpoints idempotent.
- Return JSON errors, not HTML error pages.
- Add API health checks.
- Add CLI retry with backoff.
- Keep local fallback notes when sync fails.

## Concrete File Impact Map

### Web

- `web/types.ts`: add project brief, operating model, risk register, health snapshot, project type, and date-confidence fields.
- `web/screens/CreateProjectWizard.tsx`: capture Project Brief fields without turning quick create into a heavy form.
- `web/components/project/ProjectEditModal.tsx`: add a dedicated Brief/Operating Model tab or section.
- `web/screens/ProjectOverview.tsx`: show Project Contract, Operating State, risks, open decisions, and setup completeness.
- `web/services/geminiService.ts`: extend project blueprint generation to return success criteria, scope, assumptions, constraints, risks, and operating cadence.
- `web/services/domain/projectAdminService.ts` and `web/services/domain/projectsService.ts`: sanitize and persist the new project-management fields.
- `web/services/healthService.ts`: add brief-aware health factors and recommendations.
- `web/screens/Dashboard.tsx`: daily re-entry card, one next action, recovery prompt.
- `web/components/TopBar.tsx`: promote pinned focus state.
- `web/components/PinnedTasksModal.tsx`: focus start/snooze/block/complete actions.
- `web/components/NotificationDropdown.tsx`: actionable notifications, avoid hover-read behavior.
- `web/screens/Notifications.tsx`: notification diagnostics, delivery status, action buttons.
- `web/services/notificationService.ts`: web push token registration, richer notification schema helpers.
- `web/components/SettingsModal.tsx`: preferences, quiet hours, test notification, API/Codex setup diagnostics.
- `web/public/manifest.webmanifest`: PWA install support.
- `web/public/firebase-messaging-sw.js`: background web push.
- `web/locales/en.ts` and `web/locales/de.ts`: all new user-facing strings.

### iOS

- `swift/projectflow/AppDelegate.swift`: notification tap routing and action handling.
- `swift/projectflow/PushTokenManager.swift`: token metadata and invalidation recovery.
- `swift/projectflow/NotificationStore.swift`: richer notification action state.
- `swift/projectflow/NotificationsView.swift`: diagnostics and actions.
- `swift/projectflow/DashboardView.swift`: current focus and recovery prompt.
- `swift/projectflow/PinnedTasksStore.swift`: shared focus state.
- New WidgetKit target: focus/today widgets.
- New ActivityKit module: Live Activity Focus Keeper.
- New Share Extension: save to ProjectFlow.

### Functions

- `functions/src/notifications.ts`: delivery orchestrator for email, mobile push, web push.
- `functions/src/scheduler.ts`: morning digest, end-of-day wrap, stale-project nudges.
- `functions/src/projectflow-api.ts`: Project Brief fields in project endpoints, Codex session endpoints, and better idempotency.
- `functions/src/workspace-admin.ts`: token scopes and Codex setup helpers.
- `functions/src/authUtils.ts`: add permissions for Codex session/comment/activity scopes if needed.

### Docs

- `FIRESTORE_STRUCTURE.md`: notification settings, delivery logs, focus state, Codex sessions.
- `PERMISSIONS.md`: notification management and Codex session permissions.
- `SITEMAP.md`: Project Brief/contract surfaces and Codex sessions route if implemented.
- `COMPONENTS.md`: new reusable focus/diagnostics components.
- `GOTCHAS.md`: any deployment or notification delivery pitfalls.

## Final Recommendation

Do not start with the flashiest idea. Start by making ProjectFlow impossible to silently neglect:

1. **Make every active project explicit about outcome, success, scope, owner, risk, and cadence.**
2. **Make notifications truly deliver across iOS, web push, email, and in-app.**
3. **Make failures visible through diagnostics.**
4. **Make the first dashboard action obvious and brief-aware.**
5. **Make one focus item follow the user across web, mobile, widgets, and push.**
6. **Make Codex automatically write its work and discovered project-management evidence into ProjectFlow across repos.**

Once those loops work, ProjectFlow will stop feeling like another destination and start feeling like the daily execution system it is supposed to be.
