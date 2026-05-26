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
- `pinnedItems`: Object[] (quick-access task/issue/personal-task cache)
- `focusItemId`: string | null (currently selected focus item)
- `focusState`: Object | null (persisted cross-device focus loop)
  - `itemId`: string
  - `itemType`: `"task" | "issue" | "personal-task"`
  - `title`: string
  - `projectId`: string (optional for personal tasks)
  - `tenantId`: string (optional)
  - `status`: `"active" | "snoozed" | "blocked"`
  - `startedAt`, `snoozedUntil`, `blockedAt`, `updatedAt`: ISO date strings
  - `lastAction`: `"started" | "resumed" | "snoozed" | "blocked" | "completed" | "cleared"`
- Native iOS mirrors `focusState` into App Group defaults for widgets, Live Activity, and local reminders. That local mirror is not a Firestore document.

### 📂 **`tenants`** (Workspaces)
**Path:** `/tenants/{tenantId}`
**Access:** Tenant members can read; Owners can write.
**Schema:** `Tenant`
- `name`: string
- `description`: string
- `roles`: Map<userId, type> (Cache for O(1) access)

#### ↳ 📂 **`members`**
**Path:** `/tenants/{tenantId}/members/{userId}`
**Schema:** `TenantMembership`
- `uid`: string
- `role`: "Owner" | "Admin" | "Member" | "Guest"
- `joinedAt`: Timestamp
- `groupIds`: string[] (Workspace groups)

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
- Mobile push data includes `title`, `message`, route ids, and APNs category `PROJECTFLOW_NOTIFICATION` so the iOS app can expose action buttons.

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
- `ownerId`: string
- `modules`: string[] (Enabled modules like 'tasks', 'ideas')
- `visibilityGroupIds`: string[]
- `coverImage`: string (Legacy URL)
- `coverImageFileId`: string (Optional, managed file reference)
- `squareIcon`: string (Legacy URL)
- `squareIconFileId`: string (Optional, managed file reference)
- `screenshots`: string[] (Legacy URLs)
- `screenshotFileIds`: string[] (Optional, managed file references)

> **Project Subcollections**
> These collections exist *within* a project document.

*   **`tasks`**
    *   📄 `Task`: `{ title, status, assigneeIds, dueDate, priority, externalKey, codexSessionId, source, ... }`
*   **`issues`**
    *   📄 `Issue`: `{ title, status, severity, reporterId, ... }`
*   **`ideas`**
    *   📄 `Idea`: `{ title, stage, impact, effort, ... }`
*   **`sprints`**
    *   📄 `Sprint`: `{ name, goal, startDate, endDate, status }`
*   **`activities`**
    *   📄 `Activity`: `{ action, target, user, details, type, ... }` (Audit log; Codex activity uses `type: "codex"`)
*   **`comments`** _(Implied)_
    *   📄 `Comment`: `{ content, targetId, userId, ... }`
*   **`codex_sessions`**
    *   📄 `CodexSession`: `{ title, status, phase, externalKey, taskId, initiativeId, repoPath, branch, filesTouched, lastValidationStatus, ... }`
    *   ↳ 📂 `checkpoints/{checkpointId}`: `{ phase, summary, validationStatus, filesTouched, commands, createdAt }`
*   **`codex_followups`**
    *   📄 `CodexFollowUp`: `{ title, status, priority, taskId, sessionId, externalKey, filesTouched, ... }`

#### ↳ 📂 **`invite_links`**
**Path:** `/tenants/{tenantId}/invite_links/{linkId}`
**Description:** Publicly readable invite links for joining the workspace.

---

## **Global Module Collections**
These collections are at the root level but often contain `projectId` references to link them to specific projects.

### 📂 **`social_campaigns`**
**Path:** `/social_campaigns/{campaignId}`
**Schema:** `SocialCampaign`
- `projectId`: string (Link to Project)
- `name`: string
- `platforms`: string[] (Instagram, LinkedIn, etc.)
- `status`: "Planning" | "Active" | ...

### 📂 **`social_posts`**
**Path:** `/social_posts/{postId}`
**Schema:** `SocialPost`
- `projectId`: string (Link to Project)
- `campaignId`: string (Optional link to Campaign)
- `content`: string
- `platform`: "Instagram" | "Twitter" | ...
- `status`: "Draft" | "Scheduled" | "Published"

### 📂 **`social_assets`**
**Path:** `/social_assets/{assetId}`
**Schema:** `SocialAsset`
- `projectId`: string
- `url`: string
- `storagePath`: string
- `type`: "image" | "video"

---

## **Collection Groups (Queries)**
Allow querying across all workspaces regardless of hierarchy.

*   **`projects`**: Find all projects a user is a member of.
*   **`tasks`**: Find all tasks assigned to a user across all projects.
*   **`ideas`**: Find ideas across projects.
