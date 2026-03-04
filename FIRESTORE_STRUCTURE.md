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
- `aiUsage`: Object (Token limits and usage)
- `geminiConfig`: Object (API key, token limit)
- `privacySettings`: Object
- `fcmTokens`: string[] (Push notification device tokens)
- `fcmUpdatedAt`: Timestamp

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

#### ↳ 📂 **`transactions`**
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

#### ↳ 📂 **`recurringTransactions`**
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

#### ↳ 📂 **`projects`**
**Path:** `/tenants/{tenantId}/projects/{projectId}`
**Schema:** `Project`
- `title`: string
- `description`: string
- `status`: "Active" | "Completed" | ...
- `ownerId`: string
- `modules`: string[] (Enabled modules like 'tasks', 'ideas')
- `visibilityGroupIds`: string[]

> **Project Subcollections**
> These collections exist *within* a project document.

*   **`tasks`**
    *   📄 `Task`: `{ title, status, assigneeIds, dueDate, priority, ... }`
*   **`issues`**
    *   📄 `Issue`: `{ title, status, severity, reporterId, ... }`
*   **`ideas`**
    *   📄 `Idea`: `{ title, stage, impact, effort, ... }`
*   **`sprints`**
    *   📄 `Sprint`: `{ name, goal, startDate, endDate, status }`
*   **`activity`**
    *   📄 `Activity`: `{ action, target, user, details, ... }` (Audit log)
*   **`comments`** _(Implied)_
    *   📄 `Comment`: `{ content, targetId, userId, ... }`

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
