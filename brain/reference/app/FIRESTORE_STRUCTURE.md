# Firestore Database Structure

## **Legend**
- 📂 **Collection**
- 📄 **Document**
- `path/to/resource` (Firestore Path)

---

## **Public / System Collections**
These collections are largely public or allow unauthenticated access (e.g., for landing page forms).

*   📂 **`waitlist`** (Public Read/Write)
    *   📄 `{email}`: Waitlist entry
*   📂 **`newsletter`** (Public Read/Write)
    *   📄 `{email}`: Newsletter subscription
*   📂 **`contact_submissions`** (Public Create)
    *   📄 `{docId}`: Contact form messages
*   📂 **`blog_posts`** (Public Read)
    *   📄 `{postId}`: Blog content
*   📂 **`news`** (Public Read)
    *   📄 `{docId}`: News items
*   📂 **`legal_documents`** (Public Read; writes via Cloud Functions only) — contract `brain/plans/legal-consent-contract.md`
    *   📄 `{type}` (`privacy` | `terms` | `imprint`): `acceptanceRequired`, `currentVersion`, `title {de,en}`,
        `versions[]` = `{version, changeType, effectiveAt, publishedAt, summary {de,en}}`
    *   📂 `versions/{n}` (Public Read, immutable): `title`, `content {de,en}` (Markdown), `summary`, `changeType`
        (`requiresAcceptance` | `notifyOnly`), `notifyByEmail`, `effectiveAt`, `publishedAt`, `publishedBy`
    *   📂 `drafts/current` (platform admin read): editable draft + `baseVersion`
*   📂 **`legal_acceptances`** (owner `get` only; written by `acceptLegalDocuments`/`declineLegalDocuments`)
    *   📄 `{uid}`: `docs.{type} = {version, acceptedAt, platform (web|desktop|ios), appVersion, decision}`
    *   📂 `events/{id}`: audit trail `{type, version, decision (accepted|acknowledged|declined), platform, appVersion, at}`.
        Included in `exportMyData`, deleted by `deleteMyAccount`.
*   📂 **`legal_mail_jobs`** (Functions/Admin-SDK only)
    *   📄 `{type}_v{n}`: `status` (pending|running|done), `open`, `sendAfter`, `cursor`, `leaseUntil`, `counts {sent, skipped, failed}`
    *   📂 `recipients/{uid}`: per-recipient send log (`sending` → `sent` | `failed`), created before sending = dedupe
*   📂 **`public_initiative_feedback`** (Functions/Admin-SDK only — not in rules)
    *   📄 `{token}`: Public index for an initiative feedback form (tokenized)
*   📂 **`public_project_intake`** (Functions/Admin-SDK only — not in rules)
    *   📄 `{token}`: Public index for a **project intake** form. Holds `tenantId`, `projectId`,
        `projectTitle`, `enabled`, copy, and sanitized `categories` (each with `fields`). Read/written
        only by `getProjectIntakeForm`/`submitProjectIntake`/`saveProjectIntakeConfig` (Admin SDK
        bypasses rules), exactly like `public_initiative_feedback`. Public route: `/feedback/project/{token}`.

---

## **Core Application Data**

### 📂 **`users`**
**Path:** `/users/{userId}`
**Access:** User reads/writes own profile; Authenticated users can read.
**Schema:** `User`
- `uid`: string
- `email`: string
- `displayName`: string
- `photoURL`: string
- `photoFileId`: string (Optional, points to `tenants/{tenantId}/files/{fileId}`)
- `coverFileId`: string (Optional, points to `tenants/{tenantId}/files/{fileId}`)
- `aiUsage`: Object (Token limits and usage)
- `geminiConfig`: Object (API key, token limit)
- `privacySettings`: Object
- `fcmTokens`: string[] (Push notification device tokens)
- `fcmUpdatedAt`: Timestamp
- `webPush`: Object (web push state)
  - `enabled`: boolean
  - `lastTokenSyncAt`: Timestamp
  - `permission`: string (`granted`, `denied`, `default`)
- `pinnedItems`: Object[] (quick-access task/personal-task cache)
- `focusItemId`: string | null (currently selected focus item)
- `focusState`: Object | null (persisted cross-device focus loop)
  - `itemId`: string
  - `itemType`: `"task" | "personal-task"` (legacy `"issue"` may exist in stored data)
  - `title`: string
  - `projectId`: string (optional for personal tasks)
  - `tenantId`: string (optional)
  - `status`: `"active" | "snoozed" | "blocked"`
  - `startedAt`, `snoozedUntil`, `blockedAt`, `updatedAt`: ISO date strings
  - `lastAction`: `"started" | "resumed" | "snoozed" | "blocked" | "completed" | "cleared"`
- `notificationPrefs`: Object (optional, contract C3; the server applies the defaults in brackets)
  - `timezone`: IANA zone [`Europe/Berlin`] — used by the scheduled nudges
  - `push` / `email`: `{ assignments, mentions, comments, due, reminders }` booleans [push: all `true`; email: assignments + mentions `true`, rest `false`]
  - `morningBriefing`: `{ enabled, time }` [`false`, `08:00`]; `dayClose`: `{ enabled, time }` [`false`, `17:30`]
  - Read by `onNotificationCreated` (per channel + category; the in-app doc is always kept; invites/join requests/diagnostics are transactional and ignore the toggles) and `sendNudges`. The user language for server copy is `users/{uid}.language`.
- Writes to `focusState` trigger `onUserFocusChanged` (Live Activity push, contract C5).

#### ↳ 📂 **`devices`** *(iOS, owner only)*
**Path:** `/users/{userId}/devices/{deviceId}` — `{ platform: "ios", fcmToken, liveActivityStartToken?, appVersion, locale, timezone, updatedAt }`, written by the iOS app. `onUserFocusChanged` uses `fcmToken` as the FCM target and `liveActivityStartToken` for push-to-start.

#### ↳ 📂 **`liveActivities`** *(iOS, owner only)*
**Path:** `/users/{userId}/liveActivities/{activityId}` — `{ deviceId, pushToken, itemId, itemType, updatedAt }`, written by the app when an activity starts and deleted when it ends (the server deletes the doc itself when it sends `end`).

#### ↳ 📂 **`nudgeLog`** *(server only)*
**Path:** `/users/{userId}/nudgeLog/{yyyy-mm-dd}` (the user's *local* day) — `{ date, timezone, sent: string[], skipped: string[], briefingStops?: number, updatedAt }`. Idempotency marker of `sendNudges`; clients can neither read nor write it (rules `if false`).

#### ↳ 📂 **`private`** *(owner-only secrets)*
**Path:** `/users/{userId}/private/{docId}`
**Access:** Only the owning user (and Cloud Functions via admin SDK). Never put secrets on `users/{uid}` itself — every signed-in user can read it.
- `github`: `{ token: string, updatedAt: Timestamp }` — the user's GitHub access token (OAuth link or manual PAT). Written by Settings / Project Edit via `setGithubToken`/`clearGithubToken` in `web/services/domain/usersService.ts`. Client GitHub calls use the *current* user's token; `onProjectTaskGitHubSync` uses the project owner's (fallback: task creator/owner). Projects and tenant member docs do not store GitHub tokens.

### 📂 **`tenants`** (Workspaces)
**Path:** `/tenants/{tenantId}` — `tenantId` is a random document id (never the owner's uid; changed 2026-09-26).
**Access:** Any member (incl. guests) can read; Owner/Admin can update (only the Owner may change `ownerId`); only the Owner can delete. A signed-in user may create a tenant whose `ownerId` is their uid.
**Schema:** `Tenant`
- `tenantId`: string (mirrors the doc id)
- `name`: string
- `ownerId`: string (uid of the Owner)
- `createdBy`: string, `createdAt` / `updatedAt`: Timestamp

Every account owns at least one workspace (created on first sign-in by `WorkspaceProvider`) and can belong to any number of others. The active workspace is cached per user in localStorage (`projectflow.activeTenant.{uid}`) and in `users/{uid}.lastTenantId`; switching reloads the app.

#### ↳ 📂 **`members`**
**Path:** `/tenants/{tenantId}/members/{userId}` — the single source of truth for access.
**Schema:** `TenantMembership`
- `uid`: string
- `role`: "Owner" | "Admin" | "Member" | "Guest"
  - Owner/Admin: everything; Admin cannot grant/revoke Admin or touch the Owner.
  - Member: all workspace data.
  - Guest: only projects whose `memberIds` contain them (plus docs addressed to them, e.g. notifications).
- `roleIds`: string[] (stacked CUSTOM role doc ids; see `roles` below)
- `displayName`, `email`, `photoURL`: profile snapshot for member lists
- `invitedBy`, `inviteId`: set when joined through an invitation
- `joinedAt`: Timestamp, `groupIds`: string[]

Members are created only by (a) the workspace creator bootstrapping themselves as Owner in the same batch as the tenant doc, (b) admins, or (c) the `acceptWorkspaceInvite` Cloud Function. Self-join is not possible. "My workspaces" = collection-group query `members where uid == me` (index override in `firestore.indexes.json`).

#### ↳ 📂 **`invitations`**
**Path:** `/tenants/{tenantId}/invitations/{inviteId}` — the doc id is the secret in the invite link `/invite/{tenantId}/{inviteId}`.
- `kind`: "email" | "link"; `email`: lowercased address (email kind) or null
- `role`: "Admin" | "Member" | "Guest" (Admin only by the Owner); `projectIds`: string[] added to project `memberIds` on accept (required for guests)
- `status`: "pending" | "accepted" | "revoked"; `expiresAt` (ISO, 14 days); `maxUses`, `uses`
- `tenantName`, `invitedBy`, `invitedByName`, `createdAt`, accept/revoke metadata
**Access:** admins create/list/revoke; any signed-in user may `get` by id (landing page); invitees with a *verified* email can query their pending invitations via collection group. Acceptance runs in `acceptWorkspaceInvite` (checks status, expiry, uses and email match; never downgrades an existing role). `sendInvitation` emails the link (admins only).

#### ↳ 📂 **`roles`** *(Discord-style custom role definitions)*
**Path:** `/tenants/{tenantId}/roles/{roleId}`
**Access:** Tenant members read; tenant Owner writes (Firestore rules). 
**Schema:** `FirestoreRole` (node-model `Role`)
- `name`, `color`, `description`, `position` (higher = more authority)
- `isSystem`: boolean, `systemKey`: "OWNER" | "MEMBER" | "GUEST" | null
- `permissions`: `{ allow: PermissionNode[]; deny: PermissionNode[] }` (deny overrides allow)
- `createdBy`, `createdAt`, `updatedAt`
- Only **custom** roles are stored here. System roles (Owner/Member/Guest) are code-defined
  (`SYSTEM_ROLE_DEFAULTS` in `web/services/permissionService.ts`). Evaluation: `PermissionContext`
  loads these docs + `member.roleIds` and applies the implicit Member + Owner/Guest system roles.
- Legacy `tenant.customRoles[]` (array on the tenant doc) is deprecated and no longer written.

#### ↳ 📂 **`users/{userId}/personalTasks`**
**Path:** `/tenants/{tenantId}/users/{userId}/personalTasks/{taskId}`
**Access:** The owning user can read/write; other tenant members must not see private personal tasks.
**Schema highlights:**
- `ownerId`: string
- `tenantId`: string
- `title`: string
- `description`: string
- `priority`: string
- `isCompleted`: boolean
- `createdAt`: Timestamp
- `completedAt`: Timestamp (optional)
- `source`: string (for example `"ios_share_extension"`)
- `sourceUrl`: string (optional)
- `shareCaptureId`: string (optional, native Share Sheet import id)


### 📂 **`docs`** (Wiki & Docs, 2026-10-23)
**Path:** `/tenants/{tenantId}/docs/{docId}` — page **metadata only** (the tree loads it live): `{ tenantId, spaceType: 'workspace'|'project', projectId|null, parentId|null, order (float), title, icon|null, excerpt (≤200), searchText (lowercase, ≤6000), bodyChunks, bodyRev, bodySize, linkedTaskRefs[], mentionTaskRefs[], taskRefs[] ("projectId/taskId", union), outLinks[] (mentioned docIds → backlinks), mentionedUserIds[], createdBy, updatedBy, updatedByName, createdAt, updatedAt, archivedAt|null, archivedBy, archivedRoot }`. `tenantId/spaceType/projectId/createdBy/createdAt` are immutable.
- `body/{n}` — editor JSON as string chunks `{ i, data }` ≤300k UTF-16 units each (1 MiB safe); saves run in a transaction that checks `bodyRev`.
- `versions/{id}` — `{ data|null, title, size, reason: autosave|manual|restore|before-restore|conflict, createdBy, createdByName, createdAt }`; autosave at most every 10 min, last 50 kept.
- `editors/{uid}` — presence heartbeat `{ uid, name, photoURL, at }` (shown as "X is editing" when < 90 s old).
- Access: workspace pages full members; project pages like project tasks (guests of that project). Guest queries must filter `spaceType == 'project'` + `projectId`. Hard delete: author or Owner/Admin. Trigger `onWikiDocWritten` emits `doc.created|updated|archived|restored|deleted` (updates throttled to one per page + person per 10 min).

### 📂 **`docTemplates`** (custom wiki templates)
**Path:** `/tenants/{tenantId}/docTemplates/{id}` — `{ name, description, icon, data (Tiptap JSON string), createdBy, createdAt }`; full members (generic tenant rule).
User prefs: `/tenants/{tenantId}/users/{uid}/prefs/wiki` — `{ favorites: docId[], recent: [{ docId, at }] }`.

### 📂 **`activity`** (workspace activity stream, 2026-10-23)
**Path:** `/tenants/{tenantId}/activity/{eventId}`
- Typed, server-written events (`emitActivityEvent`, `functions/src/activity-events.ts`): `{ v, type, domain, actor{kind,id,name,photoURL?,client?,automationId?,automationRunId?,automationDepth?}, cause{kind,id,automationRunId?,depth}, actorId, object{type,id,title,parentType?,parentId?}, projectId|null, projectTitle?, changes?, meta?, source, createdAt, expireAt }`. Contract and type list: `brain/plans/activity-events-contract.md`.
- Written by `onTaskWritten`/`onSubtaskWritten`/`onCommentCreated`/`onProjectWritten` next to the legacy `projects/{p}/activities` entries. TTL 365 days on `expireAt`.
- Access: full members read all; guests only events of their projects and only with a `projectId` filter (`==`/`in`); no client writes.

### 📂 **`insights_daily`** / **`insights_reports`** (2026-10-23)
**Path:** `/tenants/{tenantId}/insights_daily/{YYYY-MM-DD|latest}`, `/tenants/{tenantId}/insights_reports/{isoWeek}-{lang}`
- `insights_daily`: `{ v, day, weeks[12], projects[{ id, title, status, created[], completed[], cycleDaysSum[], cycleCount[], scope[], done[], open, overdue, blocked, dueNext7, onTime, late, activity7d, health, people{uid:[open,overdue,dueNext7]} }], truncated, computedAt }` from `computeWorkspaceInsights` (daily 03:30 Berlin) / `refreshWorkspaceInsights` (callable, 10-min cooldown).
- `insights_reports`: `{ week, language, markdown, createdBy, createdAt }` from `generateWeeklyInsightsReport` (OpenAI).
- Access: full members read; guests none; no client writes.

#### ↳ 📂 **`notifications`**
**Path:** `/tenants/{tenantId}/notifications/{notificationId}`
**Schema:** `Notification`
- `userId`: string (Recipient)
- `type`: string
- `title`: string
- `message`: string
- `read`: boolean
- `createdAt`: Timestamp
- `projectId`: string (Optional)
- `taskId`: string (Optional)
- `issueId`: string (Optional)
- `actorId`: string (Optional)
- `actorName`: string (Optional)
- `actorPhotoURL`: string (Optional)
- `initiativeId`, `commentId`, `reminderId`: string (Optional)
- `deepLink`: string (Optional, in-app route such as `/tasks` or `/?mode=close`; set for reminders and nudges, otherwise derived from the ids)
- `diagnostic`: Object (Optional, present for `diagnostic_test` notifications)
- `params`: Object (Optional, written by the triggers since 2026-10-23) — values for the localized web copy: `taskTitle`, `subtaskTitle`, `projectTitle`, `status`, `previousStatus`, `dueDate`, `previousDueDate`, `commentSnippet` (only non-empty keys, except `dueDate`/`previousDueDate` on `task_due_changed`, which may be `''`). `title`/`message` stay as English fallback for iOS and push.
- `type` values: `task_assigned`, `subtask_assigned`, `task_completed`, `task_status_changed`, `task_due_changed`, `comment_added`, `comment_mention` (task/subtask/comment triggers), `project_member_added`, `project_member_joined` (`onProjectWritten`), `reminder`, `task_due_today`, `task_overdue`, `morning_briefing`, `day_close` (scheduled functions), `diagnostic_test` (`sendTestNotification`). Clients can no longer create notifications (rules: `create: false`); legacy `project_invite`/`project_shared` docs may still exist.
- Server-created docs use deterministic ids (`{eventId}-{type}-{uid}`, `reminder-{doc}-{reminder}-{uid}`, `nudge-{type}-{day}-{uid}`, `overdue-{taskId}-{localDueDay}-{uid}`) so retried triggers do not duplicate them. `task_overdue` fires once per task + due day + assignee (max 25 new per user per day) and is written into the task's own tenant.
- Access (rules): only the recipient (`userId == auth.uid`, still a workspace member) may read, delete, and update `read`/`readAt`; nobody else in the workspace can see or forge them. `notificationDeliveryLogs` are recipient-read-only, server-written.
- Push (contract C4): FCM `data` = `notificationId, tenantId, type, projectId, taskId, initiativeId, deepLink, threadId` (+ `title`, `message` for web); APNs `aps`: `sound`, `mutable-content: 1`, `thread-id` (`projectId || tenantId`), `category` (`PF_ASSIGNMENT`, `PF_MENTION`, `PF_COMMENT`, `PF_DUE`, `PF_REMINDER`, `PF_BRIEFING`, `PF_DAYCLOSE`, else `PF_GENERIC`) and `badge` = unread docs of the user in that tenant.

#### ↳ 📂 **`notificationDeliveryLogs`**
**Path:** `/tenants/{tenantId}/notificationDeliveryLogs/{logId}`
**Schema:** Delivery status emitted by `functions/src/notifications.ts`
- `notificationId`: string
- `userId`: string
- `channel`: `"email" | "fcm"`
- `status`: `"sent" | "failed" | "skipped"`
- `reason`: string
- `details`: Object (attempt counts, invalid token counts, or error details)
- `createdAt`: Timestamp

#### ↳ 📂 **`notificationDiagnostics`**
**Path:** `/tenants/{tenantId}/notificationDiagnostics/{userId}`
**Schema:** Per-user diagnostic throttle and state written by the `sendTestNotification` callable.
- `userId`: string
- `tenantId`: string
- `lastTestNotificationAt`: Timestamp
- `lastTokenCount`: number
- `updatedAt`: Timestamp

#### ↳ 📂 **`secrets`** *(Functions-only, never client-readable)*
**Path:** `/tenants/{tenantId}/secrets/{secretId}`
**Storage integration secret doc:** `/tenants/{tenantId}/secrets/fileStorage`
- `activeProvider`: `"firebase" | "s3" | "googleDrive"`
- `s3`: object
  - `endpoint`, `region`, `bucket`, `pathPrefix`, `forcePathStyle`
  - `accessKeyId`, `secretAccessKey`
  - `connectedAt`, `lastTestedAt`
- `googleDrive`: object
  - `connected`, `folderId`, `folderName`, `email`, `scope`
  - `accessToken`, `refreshToken`, `tokenExpiryDate`
  - `connectedAt`, `lastTestedAt`, `lastError`
- `updatedAt`, `updatedBy`

**OAuth transient state subcollection:**
`/tenants/{tenantId}/secrets/fileStorage/file_storage_auth_states/{stateId}`
- `tenantId`, `userId`, `csrf`, `createdAt`, `expiresAt`

#### ↳ 📂 **`files`** *(Canonical tenant file metadata; writes via Functions only)*
**Path:** `/tenants/{tenantId}/files/{fileId}`
**Schema highlights:**
- `tenantId`, `module`, `projectId`, `entityType`, `entityId`
- `provider`: `"firebase" | "s3" | "googleDrive"`
- `requestedProvider`: selected provider at upload time
- `fallbackToFirebase`: boolean
- `fileName`, `mimeType`, `sizeBytes`, `status`
- `providerRef`: object
  - Firebase: `firebasePath`
  - S3: `bucket`, `key`, `region`, `endpoint`, `forcePathStyle`
  - Google Drive: `fileId`, `folderId`
- `createdBy`, `createdAt`, `updatedAt`

#### ↳ 📂 **`file_upload_drafts`** *(Transient upload sessions; Functions-only)*
**Path:** `/tenants/{tenantId}/file_upload_drafts/{draftId}`
**Schema highlights:**
- Upload request context (`module`, `entityType`, `entityId`, `projectId`)
- File info (`fileName`, `mimeType`, `sizeBytes`)
- Provider routing (`requestedProvider`, `resolvedProvider`, `fallbackReason`, `providerRef`)
- `createdBy`, `createdAt`, `expiresAt`

#### ↳ 📂 **`transactions`** *(Legacy Finance V1, read-only after V2 cutover)*
**Path:** `/tenants/{tenantId}/transactions/{transactionId}`
**Schema:** `Transaction`
- `tenantId`: string
- `userId`: string
- `type`: "income" | "expense"
- `date`: Timestamp
- `category`: string
- `amount`: number
- `notes`: string
- `isRecurring`: boolean
- `recurringId`: string (Optional reference to recurring entry)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

#### ↳ 📂 **`recurringTransactions`** *(Legacy Finance V1, read-only after V2 cutover)*
**Path:** `/tenants/{tenantId}/recurringTransactions/{recurringId}`
**Schema:** `RecurringTransaction`
- `tenantId`: string
- `userId`: string
- `type`: "income" | "expense"
- `frequency`: "daily" | "weekly" | "monthly" | "yearly"
- `startDate`: Timestamp
- `endDate`: Timestamp (Optional)
- `category`: string
- `amount`: number
- `notes`: string
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

#### ↳ 📂 **`finance_*`** *(Finance V2 domain; critical writes only via Cloud Functions)*
**Path pattern:** `/tenants/{tenantId}/finance_*/{docId}`
**Core collections:**
- `finance_accounts` (Kontenplan + SKR/DATEV mapping)
- `finance_fiscal_years`
- `finance_periods` (Open / SoftClosed / Closed)
- `finance_journal_entries` (Header)
- `finance_journal_lines` (Soll/Haben Zeilen)
- `finance_customers`, `finance_vendors`
- `finance_invoices`, `finance_credit_notes`, `finance_bills`
- `finance_payments`, `finance_payment_allocations`
- `finance_bank_accounts`, `finance_bank_transactions`, `finance_reconciliations`
- `finance_subscriptions`, `finance_subscription_events`
- `finance_assets`, `finance_depreciation_schedules`
- `finance_budgets`, `finance_forecasts`
- `finance_scenarios` (BWL/AI/Token Planung)
- `finance_recurring_templates` (single -> recurring conversion templates)
- `finance_allocation_rules` (project overhead/profitability allocation logic)
- `finance_documents`, `finance_document_versions` (uploaded invoice/docs + versioning/hash/meta)
- `finance_jobs` (async orchestration for long-running finance actions)
- `finance_operation_runs` (unified runtime run state with steps/warnings/artifacts/idempotency)
- `finance_operation_templates` (saved payload presets for operation reuse)
- `finance_operation_approvals` (pending confirmations for high-risk/confirmation-gated runs)
- `finance_tax_codes`, `finance_tax_periods`, `finance_tax_reports`
- `finance_exports` (DATEV/CSV jobs + artifacts)
- `finance_sync_connections`, `finance_sync_runs` (external sync connectors + run history)
- `finance_audit_log` (immutable audit trail)
- `finance_settings` (`financeSchemaVersion: 2`, currency, defaults)

#### ↳ 📂 **`projects`**
**Path:** `/tenants/{tenantId}/projects/{projectId}`
**Schema:** `Project`
- `title`: string
- `description`: string
- `status`: "Active" | "Completed" | ...
- `projectType`: `"standard" | "software" | "creative"` (Project Brief classification)
- `projectCategory`: `"general" | "software" | "creative" | "client_delivery" | "operations" | "marketing" | "finance" | "startup_company" | "personal"` (durable project class)
- `templateId`: `"blank" | "software_release" | "creative_project" | "client_delivery" | "startup_company_formation" | "marketing_campaign" | "internal_operations" | "finance_setup"` (creation/behavior template)
- `companyProjectId`: string (optional link from a normal project to a startup/company project)
- `companyProjectRole`: `"product" | "marketing" | "finance" | "legal" | "operations" | "funding" | "research" | "other"` (relationship label for company workstream grouping)
- `operatingMode`: `"explore" | "build" | "ship" | "maintain"` (current execution mode)
- `dateConfidence`: `"fixed" | "target" | "rough" | "unknown"` (how firm the project dates are)
- `brief`: Object (lightweight project contract)
  - `objective`: string
  - `successCriteria`: string[]
  - `scope`: string
  - `decisionOwner`: string
  - `cadence`: `"daily" | "weekly" | "biweekly" | "monthly" | "ad-hoc"`
- `operatingModel`: Object (`mode`, `cadence`, `dateConfidence`) used by overview and future automation
- `riskRegister`: Array of `{ id, title, mitigation, severity, status, createdAt }`
- `healthSnapshot`: Object (optional durable score/status/trend snapshot)
- `startupProfile`: Object (optional company/startup formation profile)
  - `workingName`: string
  - `targetCustomer`: string
  - `formationStatus`: `"idea" | "validating" | "preparing" | "filed" | "registered" | "operating"`
  - `businessModel`: `"saas" | "service" | "marketplace" | "commerce" | "content" | "hardware" | "agency" | "other"`
  - `fundingRoute`: `"bootstrapped" | "grant" | "loan" | "angel" | "vc" | "crowdfunding" | "revenue_funded" | "undecided"`
  - `jurisdictionCountry`: string
  - `jurisdictionRegion`: string
  - `jurisdictionTemplateId`: `"global_generic" | "de_generic" | "us_generic"`
  - `jurisdictionSources`: Array of `{ id, labelKey, url, publisher, lastReviewedAt }` official-source metadata used by jurisdiction-aware seed work
  - `jurisdictionSourcesReviewedAt`: string
  - `advisorReviewRequired`: boolean
  - `regulatedIndustryStatus`: `"yes" | "no" | "unknown"`
  - `hasCoFounders`: boolean
  - `hasEmployeesPlanned`: boolean
  - `targetLaunchDate`: string
  - `selectedTrackIds`: `("validation" | "legal_formation" | "finance_accounting" | "compliance" | "product_delivery" | "marketing_sales" | "funding" | "operations")[]`
- `startupReadiness`: Object (optional readiness checklist summary for company/startup projects)
  - `legalStructureDecided`, `founderAgreementReady`, `ipAssignmentReady`, `registrationSubmitted`, `registrationConfirmed`, `taxSetupReady`, `bankAccountReady`, `bookkeepingReady`, `privacyDocsReady`, `requiredPermitsKnown`, `launchOfferReady`, `firstChannelReady`: boolean
- `ownerId`: string
- `modules`: string[] (Enabled modules like 'tasks', 'marketing'; deprecated ids such as 'social' are dropped via `PM_CORE_DEPRECATED_MODULES`)
- `externalResources`: Array of sidebar resources with optional `{ type, sensitivity, restrictedToRoleIds, advisorReviewRequired, sourceTemplateId, sourceReferenceId, lastReviewedAt }` metadata. Legal, finance, compliance, funding, and advisor resources should be classified so the UI can warn/filter by project role.
- `visibilityGroupIds`: string[]
- `coverImage`: string (Legacy URL)
- `coverImageFileId`: string (Optional, managed file reference)
- `squareIcon`: string (Legacy URL)
- `squareIconFileId`: string (Optional, managed file reference)
- `screenshots`: string[] (Legacy URLs)
- `screenshotFileIds`: string[] (Optional, managed file references)
- `intakeForm`: Object (optional) — public **project intake** config. `{ enabled, token, title, description, submitLabel, successMessage, allowAttachments, maxAttachments, autoCreateTask, categories: [{ id, label, icon, description, enabled, fields: IntakeField[] }] }`. Written only by the `saveProjectIntakeConfig` Cloud Function; when `enabled`, mirrored to `public_project_intake/{token}`.
- `nextReminderAt`: ISO string, server-maintained by `onProjectWritten` (earliest `!isCompleted && !sentAt` reminder, absent when none). `deliverReminders` scans it via a collection-group index. Never write it from a client.
- `reminders`: Array of project-level follow-up reminders. Each reminder is `{ id, title, remindAt, linkedType, linkedId, linkedTitle, isCompleted, createdAt, completedAt, createdBy, recipientIds, notifyAssignees, sentAt }` (`createdBy`/`recipientIds`/`notifyAssignees` are written by the client; `sentAt` by `deliverReminders`; `recipientIds` defaults to `[createdBy]`, legacy reminders without `createdBy` go to the project owner / task assignees); `linkedType` can be `project`, `task`, or `initiative`. Project Overview merges these with task-level reminders for the operational follow-up strip.

> **Project Subcollections**
> These collections exist *within* a project document.

*   **`tasks`**
    *   📄 `Task`: `{ title, status, assigneeIds, dueDate, priority, dependencies, parentTaskId, nextStep, blockerNote, reminderAt, reminders, nextReminderAt, tenantId, projectId, createdBy, updatedBy, updatedAt, completedAt, completedBy, lastWorkbenchNote, externalKey, codexSessionId, source, templateId, templateTrack, templateSeedId, sourceReferences, githubRepo, githubIssueNumber, githubIssueUrl, githubIssueNodeId, githubIssueState, githubProjectV2Fields, githubSyncedAt, githubSyncError, githubSyncDisabled, ... }`
        *   Task relationship fields are optional and live on the task document: `dependencies` stores task ids that block this task, inverse "is blocking" links are derived from other tasks' `dependencies`, and `parentTaskId` stores the parent task for task-to-task hierarchy. Adding blocked-by/is-blocking links should mark the blocked task `status: "Blocked"`.
        *   Full Workbench fields are optional task metadata: `nextStep` is the next concrete action, `blockerNote` explains blocked work, `reminders` stores multiple task-level follow-up reminders, `reminderAt` mirrors the earliest open reminder date for legacy/sort compatibility, and `lastWorkbenchNote` stores the latest quick-log note. Reminders are delivered by the scheduled `deliverReminders` function (see below); `reminderAt` (single legacy date) is *not* delivered.
        *   **Server-owned side effects (contract C1, `functions/src/task-triggers.ts`).** Every client write to a task/subtask/initiative/comment sets `updatedBy` (uid) and `updatedAt`. `onTaskWritten` then (a) keeps `status: "Done"` ⇔ `isCompleted: true` (+ `completedAt`/`completedBy`; legacy `Todo` untouched; only the field that changed decides the direction, `status` wins when both changed), (b) heals missing `tenantId`/`projectId` from the path, (c) maintains `nextReminderAt`, (d) writes activity entries (created, completed/reopened, status, priority, assignment, due date) with the actor snapshot, (e) syncs project `progress` (count aggregations; done = `isCompleted || status Done`), (f) creates `task_assigned` / `task_completed` notification docs. `onSubtaskWritten` (activity + `subtask_assigned`) and `onCommentCreated` (comment activity, `comment_added` to task assignees + creator, `comment_mention` parsed from `@Name` in the text plus optional `mentionedUserIds`) do the same. Deleted-task/-subtask activities stay client-side (only the client knows who deleted).
        *   **`systemWriteAt`** (Timestamp/ISO): stamped by server patches, `deliverReminders`, the seed and `scripts/backfill-task-fields.mjs`. A write that *changes* it never produces activity entries, notifications or a progress sync (loop guard + silent bulk writes). Do not set it from a client.
        *   **Assignees:** the effective assignee set is `assigneeIds ∪ {assigneeId}`; notifications fire only for members *added* to that set, so backfilling `assigneeIds` from `assigneeId` is silent. Unassigned tasks count as their owner's (web "my tasks" rule); `scripts/backfill-task-fields.mjs` materialises this as `assigneeIds: [ownerId]`.
        *   Startup/company template seeds use `source: "template"` or `source: "official_template"`, `templateId: "startup_company_formation"`, `templateTrack`, `templateSeedId`, and optional `sourceReferences` to keep generated work editable, filterable, and source-auditable.
        *   GitHub Issues are imported as tasks with `source: "github_issue"` and `externalKey: "github:{owner/repo}:issue:{number}"`. GitHub Projects v2 field snapshots live in `githubProjectV2Fields`. ProjectFlow-to-GitHub sync uses `githubIssueNumber`, `githubIssueUrl`, `githubIssueState`, and `githubSyncedAt`; `githubSyncDisabled` opts out per task.
    *   📄 `Initiative`: `{ title, status, priority, externalKey, source, templateId, templateTrack, templateSeedId, sourceReferences, successMetric, ... }`
    *   📄 `Milestone`: `{ title, status, dueDate, riskRating, externalKey, source, templateId, templateTrack, templateSeedId, sourceReferences, ... }`
*   **Retired (data retained, closed to clients by `isRetiredProjectCollection()` in `firestore.rules`, 2026-10-22):** `socialCampaigns`, `socialPosts`, `socialAssets`, `social_integrations` (platform tokens), `social_strategy`, `caption_presets`, `paidAds`, `emailTemplates`, `email_templates`, `email_components`, `marketing_recipients`, `marketing_recipient_columns`, `marketing_groups`, `marketing_group_columns`. Also removed from the app earlier: `issues`, `ideas`, `flows`. Only the Marketing blog remains in use.
*   **`sprints`**
    *   📄 `Sprint`: `{ name, goal, startDate, endDate, status }`
*   **`submissions`** *(External project intake — see `intakeForm` above)*
    *   📄 `ProjectSubmission`: `{ categoryId, categoryLabel, status: "new"|"reviewed"|"accepted"|"archived", title, description, submitter: { name, email, company }, fields: SubmittedField[], attachments: Attachment[], linkedTaskId, source: "public-form", submittedAt, createdAt }`. Created by `submitProjectIntake` (Admin SDK). Project members read/triage via the project `{document=**}` rule; status/convert/delete happen client-side. Attachments live in Storage at `project-intake/{tenantId}/{projectId}/{submissionId}/…` and are served via signed URLs.
*   **`activities`**
    *   📄 `Activity`: `{ action, target, user, details, type, ... }` (Legacy free-text audit log; Codex activity uses `type: "codex"`). Still written; the typed stream is `tenants/{t}/activity`. Shown as "Earlier activity" on `/project/:id/activity`.
*   **`comments`** _(Implied)_
    *   📄 `Comment`: `{ content, targetId, targetType, userId, userDisplayName, userPhotoURL, mentionedUserIds?, updatedBy, createdAt }`. Created by clients (web `addComment`/`addIdeaComment`, iOS); `onCommentCreated` writes the activity + notifications.
*   **`codex_sessions`**
    *   📄 `CodexSession`: `{ title, status, phase, externalKey, taskId, initiativeId, repoPath, branch, filesTouched, lastValidationStatus, ... }`
    *   ↳ 📂 `checkpoints/{checkpointId}`: `{ phase, summary, validationStatus, filesTouched, commands, createdAt }`
*   **`codex_followups`**
    *   📄 `CodexFollowUp`: `{ title, status, priority, taskId, sessionId, externalKey, filesTouched, ... }`

## **Global Module Collections**
These collections are at the root level but often contain `projectId` references to link them to specific projects.

_Legacy top-level `social_*` collections have no rules anymore (client access denied); the Social module is removed._

---

## **Realtime Database (Presence — not Firestore)**

User presence / online-state lives in **Firebase Realtime Database**, not Firestore,
because RTDB `onDisconnect` reliably marks users offline on connection loss.

*   **`/status/{tenantId}/{uid}`**
    *   `uid`, `displayName`, `photoURL`, `email`
    *   `state`: `"online" | "idle" | "busy" | "offline"`
    *   `currentProjectId`: string | null (project the user is currently viewing)
    *   `lastChanged`: RTDB server timestamp (ms)
*   Rules (`database.rules.json`): `/status/{tenantId}` read = any authed user (tradeoff:
    presence is cross-tenant readable; future upgrade gates on mirrored membership);
    `/status/{tenantId}/{uid}` write = self only.
*   Client: `web/services/domain/presenceService.ts` + `web/hooks/usePresence.ts`.
    Requires `VITE_FIREBASE_DATABASE_URL`; presence is disabled (no online indicators)
    when unset. The former Firestore `presence` subcollections are retired.

## **Collection Groups (Queries)**
Workspace isolation: screens only show data of the active workspace. Collection-group queries must filter on something the rules can prove:

*   **`members`**: `where uid == me` → the user's workspaces.
*   **`invitations`**: `where email == myVerifiedEmail and status == 'pending'`.
*   **`projects`**: only by `tenantId`-scoped docs a member can read; project lists use `tenants/{active}/projects` (guests: `where memberIds array-contains uid`).
*   **`tasks`** / **`initiatives`**: always with `where tenantId == activeTenant`.
    *   "My tasks" (full members, iOS): `collectionGroup('tasks').where('tenantId','==',t).where('assigneeIds','array-contains',uid)` — composite index `tasks(tenantId ASC, assigneeIds CONTAINS)` (and `+ isCompleted ASC` for open-only). Allowed by `canAccessScopedDoc` for full members; guests and queries without `tenantId` are rejected (covered by `functions/scripts/firestore-rules-test.js`). Guests: one listener per project they belong to.
    *   Reminder scan (server): `nextReminderAt <= now` on collection groups `tasks` and `projects` (single-field collection-group index overrides in `firestore.indexes.json`).
*   `activities`, `subtasks`: no collection-group rule — read them via their project path.
