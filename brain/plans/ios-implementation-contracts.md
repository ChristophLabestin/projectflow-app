# iOS Implementation Contracts

Last updated: 2026-10-22 · Companion to [ios-app-concept.md](./ios-app-concept.md) (v2 + §12 decisions).

These are the binding data and behaviour contracts between the backend (`functions/`), the web app
(`web/`) and the new iOS app (`ios/`). Work packages implement against this file. If a contract has to
change, change it here first and mention it in the work-package report.

---

## C1. Writes and server-side side effects

- Every client write to a task, initiative, subtask or comment sets `updatedBy: <uid>` and
  `updatedAt: serverTimestamp()` (task docs: keep the existing `updatedAt` format if one exists; the
  trigger must accept ISO strings and Timestamps).
- Task docs always carry `tenantId` and `projectId` (backfill where missing, see C7).
- Firestore triggers own these side effects (clients no longer do them):
  - `isCompleted` ⇄ `status` consistency (`status: 'Done'` ⇔ `isCompleted: true`; `completedAt`,
    `completedBy` set/cleared). Legacy `Todo` is treated as `Open` but not rewritten.
  - Activity entries in `tenants/{t}/projects/{p}/activities` for status, priority, completion,
    assignment, due-date changes and new comments (actor = `updatedBy`, fallback `ownerId`).
  - Project `progress` sync after task create/complete/delete.
  - Notification documents (`tenants/{t}/notifications`) for: new assignees (`task_assigned`),
    subtask assignee (`subtask_assigned`), comments (`comment_added` to task assignees + creator,
    excluding the author), mentions (`comment_mention`), completion (`task_completed` to creator if not
    the actor). Mentions are parsed server-side from the comment content (same format the web editor
    writes) plus an optional `mentionedUserIds` array on the comment.
  - Trigger names: `onTaskWritten`, `onSubtaskWritten`, `onCommentCreated` (europe-west3).
- Web removes the duplicated client-side calls (`logActivity`, `syncProjectProgress`, `notify*`) for
  the covered events. Project invites and workspace invites stay as they are.
- Native clients write by full path `tenants/{t}/projects/{p}/tasks/{id}` (never a tenant-wide scan).

## C2. Reminders

`ProjectReminder` (on `Task.reminders[]` and `Project.reminders[]`) gains:

```ts
createdBy?: string;        // uid; set by the client on create
recipientIds?: string[];   // default [createdBy]
notifyAssignees?: boolean; // "Auch Zuständige erinnern"; recipients ∪ task assignees at send time
sentAt?: string;           // ISO; set by the server when delivered
```

- Server maintains `nextReminderAt` (ISO string, earliest reminder with `!isCompleted && !sentAt`,
  absent when none) on task and project docs inside `onTaskWritten` / an `onProjectWritten` trigger.
- Scheduled function `deliverReminders` (every 5 min) queries collection groups `tasks` and `projects`
  where `nextReminderAt <= now`, sends a notification doc of type `reminder` per recipient, marks
  `sentAt`, recomputes `nextReminderAt`.
- Legacy reminders without `createdBy`: recipients = task assignees (task) / project owner (project);
  reminders whose `remindAt` is older than 24 h at first scan are marked `sentAt` without sending.

## C3. Notification preferences and nudges

`users/{uid}.notificationPrefs` (all optional; defaults in brackets):

```ts
notificationPrefs?: {
  timezone?: string;                 // IANA, ['Europe/Berlin']
  push?:  { assignments?: boolean; mentions?: boolean; comments?: boolean; due?: boolean; reminders?: boolean; }   // [all true]
  email?: { assignments?: boolean; mentions?: boolean; comments?: boolean; due?: boolean; reminders?: boolean; }   // [assignments, mentions true; rest false]
  morningBriefing?: { enabled?: boolean; time?: string };  // ['HH:mm'; false, '08:00']
  dayClose?:        { enabled?: boolean; time?: string };  // [false, '17:30']
}
```

- New notification `type` values: `reminder`, `task_due_today`, `morning_briefing`, `day_close`.
- Scheduled function `sendNudges` (every 15 min) evaluates per-user local time:
  - `morning_briefing`: once per local day at/after `time`; title = headline sentence (same keys as
    `dashboard.route.statement.*`, in the user's `language`), body = counts; deep link `/`.
  - `task_due_today`: once per local day at the briefing time (or 08:00), one doc summarising tasks
    due today that are not done; deep link `/tasks`.
  - `day_close`: once per local day at `time` if the user had a plan today; deep link `/?mode=close`.
  - Idempotency marker: `users/{uid}/nudgeLog/{yyyy-mm-dd}` with sent types.
- `onNotificationCreated` respects `notificationPrefs` per channel and category before sending push
  or email. The in-app notification doc is always kept.

## C4. Push payload (FCM → APNs)

`onNotificationCreated` sends:

- `notification.title` / `notification.body` as today.
- `data`: `notificationId, tenantId, type, projectId, taskId, initiativeId, deepLink, threadId`.
- `apns.payload.aps`: `sound: 'default'`, `mutable-content: 1`, `thread-id: projectId || tenantId`,
  `category` by type:

| type | category |
|---|---|
| `task_assigned`, `subtask_assigned` | `PF_ASSIGNMENT` |
| `comment_mention` | `PF_MENTION` |
| `comment_added` | `PF_COMMENT` |
| `task_due_today` | `PF_DUE` |
| `reminder` | `PF_REMINDER` |
| `morning_briefing` | `PF_BRIEFING` |
| `day_close` | `PF_DAYCLOSE` |
| anything else | `PF_GENERIC` |

- `aps.badge`: number of unread notification docs for that user in that tenant (count aggregation).
- Device tokens: iOS keeps adding its FCM token to `users/{uid}.fcmTokens` (unchanged contract).

## C5. Devices, focus sync, Live Activity

- `users/{uid}/devices/{deviceId}`: `{ platform: 'ios', fcmToken, appVersion, locale, timezone,
  liveActivityStartToken?, updatedAt }` (written by iOS).
- `users/{uid}/liveActivities/{activityId}`: `{ deviceId, pushToken, itemId, itemType, updatedAt }`
  (written by iOS when an activity starts; deleted when it ends).
- Trigger `onUserFocusChanged` (`users/{uid}` write where `focusState` changed):
  - focus cleared/completed → `end` event to every live activity token, then delete the docs;
  - focus changed/updated → `update` event with the new content state;
  - focus started and no live activity exists → `start` event to every `liveActivityStartToken`.
  - Sent via FCM HTTP v1 `apns.live_activity_token`; `aps.event`, `aps.timestamp`,
    `aps.content-state`, and for start `aps.attributes-type: 'FocusActivityAttributes'` + `aps.attributes`.
- Content state JSON (Swift `FocusActivityAttributes.ContentState`):
  `{ title: string, projectName?: string, nextStep?: string, status: 'active'|'snoozed'|'blocked',
  startedAt: number (epoch seconds), snoozedUntil?: number }`.
- Attributes JSON: `{ itemId: string, itemType: string, tenantId: string, projectId?: string }`.
- Web subscribes to `users/{uid}` in realtime (focus + pins) instead of a one-shot read.
- `pinnedItems` changes use a Firestore transaction (read-modify-write) instead of a debounced
  whole-array overwrite.

## C6. Auth

- Passkey option generation uses `userVerification: 'required'` (registration and authentication).
- Native passkeys use RP ID `app.getprojectflow.com`; the expected origin for native assertions is
  `https://app.getprojectflow.com` — must be accepted by `functions/src/passkeys.ts`.
- Sign in with Apple via Firebase provider `apple.com` on web (`OAuthProvider('apple.com')`) and iOS
  (`ASAuthorizationAppleIDProvider` + nonce → `OAuthProvider.appleCredential`). Account linking from
  the security settings on both platforms. iOS revokes the Apple token on account deletion
  (`Auth.auth().revokeToken(withAuthorizationCode:)`).
- `acceptWorkspaceInvite` error `invite-email-mismatch` gets a localized explanation that mentions
  Apple "Hide My Email" and offers link invites / account linking.

## C7. Queries, indexes, backfill

- "My tasks" (full members): collection group `tasks` with `where('tenantId','==',t)` and
  `where('assigneeIds','array-contains',uid)`. Composite collection-group index required.
- Guests / external collaborators: one listener per project they are a member of.
- Personal tasks: `tenants/{t}/users/{uid}/personalTasks`.
- Notifications: `tenants/{t}/notifications` where `userId == uid` order by `createdAt desc` limit 100.
- `scripts/backfill-task-fields.mjs` (dry-run by default, `--apply`, `--emulator`): sets missing
  `tenantId`, `projectId`, and `assigneeIds` (from legacy `assigneeId`, else `ownerId` when no assignee).
- Indexes for `nextReminderAt` (collection groups `tasks`, `projects`).

## C8. Universal links

`web/public/.well-known/apple-app-site-association` adds `applinks` for app id
`48BM67TY9G.de.christophlabestin.projectflow` with paths `/project/*`, `/tasks*`, `/notifications*`,
`/invite/*`, `/join/*`, `/` . Custom URL scheme `projectflow://` mirrors the same paths.

## C9. Shared logic and golden fixtures

- Pure TS modules in `web/utils/`: `dayPlan.ts` (plan stops, headline statement key + value, day
  band segments, counts, overnight items, waiting-on-me, more count; includes personal tasks),
  `dueBuckets.ts`, `attention.ts`, and the existing `globalSearch.ts` query parser.
- Fixtures in `shared/fixtures/<module>/*.json` as `{ "name", "input", "expected" }`; the input uses
  plain JSON (ISO strings, a fixed `now` and `timeZone`). `shared/fixtures/README.md` documents every
  input/output field. Vitest runs all fixtures; the iOS `PFDomain` XCTests run the same files.
- Edge cases required: time zones around midnight, date-only strings, Timestamp-like
  `{seconds, nanoseconds}`, legacy `Todo`, `isCompleted` vs `status` disagreement, personal tasks,
  more than 4 overdue items.

## C10. Status text colours (AA)

Web tokens `--color-status-<status>-text` (light / dark):
backlog `#475569`/`#94A3B8`, open `#1D4ED8`/`#60A5FA`, in-progress `#0369A1`/`#0EA5E9`,
review `#B45309`/`#F59E0B`, on-hold `#4B5563`/`#9CA3AF`, blocked `#B91C1C`/`#F87171`,
done `#047857`/`#10B981`, planning `#6D28D9`/`#A78BFA`. Pills keep the 12 % tint of the base colour.

## C11. iOS environment

- Bundle id `de.christophlabestin.projectflow`, team `48BM67TY9G`, app group
  `group.de.christophlabestin.projectflow`, keychain group `48BM67TY9G.de.christophlabestin.projectflow.shared`.
- Build configuration `Emulator` (default for Run): Firebase project `demo-projectflow`, emulator host
  `127.0.0.1`, ports from `scripts/dev-e2e.sh` (auth 9631, firestore 8631, storage 9632,
  functions 5631), demo login `demo@projectflow.test` / `projectflow-demo`.
- Build configuration `Release`/`Debug`: `GoogleService-Info.plist` of project `projectflow-labestin`.
