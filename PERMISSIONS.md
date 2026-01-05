# PERMISSIONS.md — Role & Permission System (Discord-style)

This document defines the authoritative permission model for ProjectFlow.

Goals:
- Deep, configurable, Discord-like permissions (feature/action level)
- Multiple roles per user (role stacking)
- Combined permissions (union), with explicit deny overriding allow
- Scope-based overwrites (tenant → project → module → resource)
- Tenant roles reused inside projects (including externals)
- System roles with invariants: Owner, Member, Guest
- Project-scoped fixed role created per project: Project Owner: {project name}
- Enforceable role hierarchy represented as a vertical ordered list
- Transfer mechanisms for Tenant Owner and Project Owner, with strict safety constraints
- A complete, explicit permission catalog used across UI + backend enforcement

This system must be enforced in:
- UI (visibility + action availability)
- Backend validation (authoritative)
- Firestore rules (membership isolation + feasible checks)

Related documents:
- `APP_CONCEPT.md`
- `STYLING.md`
- `COMPONENTS.md` (notably: `MediaLibraryModal` requirements)

---

## 1) Key Concepts

### 1.1 Roles and Permissions
- A role contains permission sets:
  - `allow: string[]`
  - `deny: string[]`
- A user can have multiple roles; permissions are combined across them.
- Deny overrides allow.

### 1.2 Scopes
Permissions are evaluated by context:
1) Tenant (workspace)
2) Project
3) Module within project
4) Resource (task/flow/issue/etc.)

### 1.3 Entitlements vs Permissions
Subscription constraints (Starter/Professional/Organization) are enforced separately.
Permissions cannot override entitlements.

---

## 2) Role Types

### 2.1 Tenant System Roles (always exist)

#### A) Owner (system, immutable role; ownership transferable)
- Exactly one user per tenant is the Tenant Owner (holder of the Owner role).
- Tenant Owner has all permissions across tenant and all projects.
- Owner role cannot be deleted/renamed/edited and cannot be assigned to multiple users.
- Owner is always the highest role in the hierarchy.

Ownership transfer policy:
- Tenant ownership can be transferred from the current Owner to another eligible user.
- If the current Owner is not accessible, recovery requires opening a support ticket (manual process).

#### B) Member (system baseline, configurable)
- Equivalent to Discord’s @everyone baseline.
- Always applies to every tenant member and project member.
- Configurable permissions.
- Non-deletable.

Editable by any user who:
- has `tenant.roles.edit`, and
- passes hierarchy checks (see section 3).

Storage rule (decision):
- Member is NOT stored in user role arrays; it is applied implicitly during evaluation.

#### C) Guest (system marker, immutable)
- Marker role for external project collaborators.
- Not configurable and not removable while the user is external.
- Automatically removed / stops applying when the user becomes a tenant member.

Storage rule (decision):
- Guest is stored explicitly for externals.

---

### 2.2 Project System Role (created per project)

#### Project Owner: {project name} (project-scoped, system, immutable; transferable)
- Created automatically on project creation.
- Assigned automatically to the project creator.
- Grants all permissions inside that project (project/modules/resources).
- Must not grant tenant-level permissions.
- Not deletable and not editable.

Transfer rule (decision):
- Transfer is allowed, but only by:
  - the Tenant Owner, or
  - the current Project Owner of that project.

---

### 2.3 Custom Roles (tenant-managed)
- All other roles are custom tenant roles.
- Usable at both tenant scope and project scope (including externals).
- Tenant-defined roles can be assigned to external project collaborators (in project membership)
  to grant project permissions without making them tenant members.

---

## 3) Role Hierarchy (Discord-like)

### 3.1 UI Requirement
Roles must be displayed in a vertical ordered list that communicates hierarchy.

### 3.2 Ordering Field
Each role has:
- `position: number` (higher = higher authority)

System invariants:
- Owner is always maximum position.
- Member is always minimum position (e.g., 0).
- Guest is low and fixed.
- Project Owner is high within the project context, but always below tenant Owner.

### 3.3 Authority Boundary Rules
Let:
- `actorHighestPosition` be the highest position among roles held by the acting user (Owner treated as infinite).

A user may manage a role only if:
- they have the relevant management permission, AND
- target role position is strictly lower than `actorHighestPosition`, AND
- the role is not protected against that operation.

Protected operations:
- Owner: cannot be edited/deleted/reordered; assignment only via ownership transfer workflow.
- Guest: cannot be edited/deleted; cannot be removed from externals.
- Member: cannot be deleted; can be edited if boundary + `tenant.roles.edit` passes.
- Project Owner: cannot be edited/deleted; assignment only via Project Owner transfer workflow.

---

## 4) Permission Representation

### 4.1 Permission Nodes
Stable string identifiers such as:
- `tenant.members.invite`
- `project.tasks.create`
- `project.social.posts.publish`

### 4.2 Allow/Deny Sets
Configurable roles and overrides store:
- `permissions.allow: string[]`
- `permissions.deny: string[]`

Rules:
- deny overrides allow
- unknown nodes ignored

### 4.3 Project Owner Permission Mode
Project Owner grants “allow all project permissions” for its project context.
Implementation can use:
- explicit allow list, or
- `permissionsMode = ALL_PROJECT_PERMISSIONS`.

---

## 5) Permission Evaluation Algorithm

0) If user is Tenant Owner → allow  
1) membership gating (tenant/project)  
2) assemble roles:
   - apply Member implicitly
   - include explicit roleIds from membership record
   - include Guest for externals
   - include Project Owner if assigned
3) combine allow/deny (deny wins)  
4) apply overrides (project → module → resource)  
5) enforce entitlements (plan, seats, modules, AI quota)

---

## 6) External Collaborators (Guest Rules)

- External project members must always include Guest.
- On promotion to tenant member, Guest is removed.

---

## 7) Ownership Transfer Workflows

### 7.1 Tenant Ownership Transfer
- Only the current Tenant Owner can initiate the transfer.
- If the Owner is not accessible → support ticket (manual recovery).
- Target must be an active tenant member and satisfy entitlement requirements.
- Exactly one Owner at all times.
- Must produce an audit log entry.

### 7.2 Project Owner Transfer
- Only Tenant Owner or current Project Owner can transfer.
- Target must be an active project member.
- Recommended: exactly one Project Owner per project.
- Must produce an audit log entry.

---

## 8) Permission Catalog (Complete)

This catalog is the single source of truth for permission nodes.  
New nodes must be added here with consistent naming.

### 8.1 Tenant — General
- `tenant.view` — View tenant/workspace shell and basic metadata
- `tenant.settings.view` — View tenant settings
- `tenant.settings.edit` — Edit tenant settings (name, branding, defaults)

### 8.2 Tenant — Members & Invites
- `tenant.members.view` — View workspace members list
- `tenant.members.invite` — Invite workspace members
- `tenant.members.remove` — Remove/disable workspace members
- `tenant.members.manageRoles` — Assign/remove roles for workspace members (hierarchy-bound)
- `tenant.invites.view` — View workspace invite links / pending invites
- `tenant.invites.create` — Create workspace invite links
- `tenant.invites.revoke` — Revoke workspace invite links

### 8.3 Tenant — Roles & Hierarchy
- `tenant.roles.view` — View roles list
- `tenant.roles.create` — Create custom roles
- `tenant.roles.edit` — Edit roles (name, permissions; hierarchy-bound; Member is editable here)
- `tenant.roles.delete` — Delete custom roles (hierarchy-bound)
- `tenant.roles.manageHierarchy` — Reorder roles / change role positions (hierarchy-bound)

### 8.4 Tenant — Billing, Seats, Subscription
- `tenant.billing.view` — View billing information (invoices, payment method summary)
- `tenant.billing.manage` — Manage billing (payment method, invoicing details)
- `tenant.seats.view` — View seat/license status (owner-managed mode)
- `tenant.seats.manage` — Purchase/assign/revoke seats (owner-managed mode)
- `tenant.plan.view` — View subscription plan and entitlements
- `tenant.plan.manage` — Change plan tier or plan settings (may be Owner-only by policy)

### 8.5 Tenant — SSO (Organization tier)
- `tenant.sso.view` — View SSO configuration status
- `tenant.sso.configure` — Configure SSO provider settings
- `tenant.sso.enforce` — Enforce SSO for tenant access (require SSO login)

### 8.6 Tenant — AI Governance
- `tenant.ai.viewUsage` — View tenant AI usage summaries (tokens/images)
- `tenant.ai.managePolicies` — Manage tenant AI policies (hard limit, overage, defaults)
- `tenant.ai.manageAllocations` — Manage per-user AI allocations (owner-managed distribution mode)
- `tenant.ai.manageProviderKeys` — Manage AI provider settings (BYO keys policy, tenant keys if supported)

### 8.7 Tenant — Integrations & Audit
- `tenant.integrations.view` — View tenant-level integrations
- `tenant.integrations.manage` — Configure tenant-level integrations
- `tenant.audit.view` — View audit logs

---

## 8.8 Tenant — Media Library (Tenant-wide)

These permissions govern the tenant-wide media library itself (management, governance, global access),
including access via the **MediaLibraryModal** when opened from tenant-level contexts (e.g., branding).

- `tenant.media.view` — View/browse tenant media library
- `tenant.media.upload` — Upload new assets into tenant library
- `tenant.media.edit` — Edit asset metadata (name, tags, folders, attribution fields)
- `tenant.media.delete` — Delete assets from tenant library

- `tenant.media.importUnsplash` — Search/select/import assets from Unsplash into tenant library
- `tenant.media.generateAI` — Use the AI image generation tab in MediaLibraryModal (UI capability gate)
- `tenant.media.reworkAI` — Use the AI image rework/edit tab in MediaLibraryModal (UI capability gate)

Optional (only if you implement visibility controls beyond permissions):
- `tenant.media.manageVisibility` — Change asset visibility/sharing rules (e.g., external-safe flags)

Important:
- AI generation/rework also requires the corresponding AI feature permissions and entitlements:
  - `ai.image.generate` / `ai.image.rework`
  - quota + overage policy

---

## 8.9 Project — General
- `project.view` — View the project and access its dashboard/overview
- `project.settings.view` — View project settings
- `project.settings.edit` — Edit project settings (name, description, defaults)
- `project.delete` — Delete project (dangerous)

### 8.10 Project — Members (includes externals)
- `project.members.view` — View project members list
- `project.members.inviteWorkspaceUser` — Invite workspace users to the project
- `project.members.inviteExternal` — Invite external collaborators to the project
- `project.members.remove` — Remove project members (including externals)
- `project.members.manageRoles` — Assign/remove roles for project members (hierarchy-bound; Guest invariant applies)

### 8.11 Project — Modules
- `project.modules.view` — View enabled/available modules for the project
- `project.modules.enableDisable` — Enable/disable project modules (subject to plan)

---

## 8.12 Project — Tasks
- `project.tasks.view` — View tasks and task lists/boards
- `project.tasks.create` — Create tasks
- `project.tasks.edit` — Edit tasks (subject to ownership policy if enforced)
- `project.tasks.editAny` — Edit any task regardless of ownership/assignment (optional, high power)
- `project.tasks.delete` — Delete tasks (subject to ownership policy if enforced)
- `project.tasks.deleteAny` — Delete any task regardless of ownership/assignment (optional, high power)
- `project.tasks.assign` — Assign/unassign tasks
- `project.tasks.changeStatus` — Change task status/column/state
- `project.tasks.manageSubtasks` — Create/edit/delete subtasks
- `project.tasks.manageChecklists` — Manage checklists within tasks
- `project.tasks.comment` — Comment on tasks
- `project.tasks.attachFiles` — Attach files/media to tasks (via MediaLibraryModal)
- `project.tasks.manageCustomFields` — Create/edit custom fields for tasks

---

## 8.13 Project — Flows (Signature Feature)

### Core Flow Actions
- `project.flows.view` — View flows list and flow details
- `project.flows.create` — Create flows
- `project.flows.edit` — Edit flow content (subject to ownership policy if enforced)
- `project.flows.delete` — Delete flows
- `project.flows.comment` — Comment on flows
- `project.flows.attachFiles` — Attach files/media to flows (via MediaLibraryModal)

### Pipeline Progression
- `project.flows.advanceStep` — Move flow to the next pipeline step
- `project.flows.revertStep` — Move flow to a previous step
- `project.flows.setStep` — Set flow to any step (jump; high power)

### Review & Approval
- `project.flows.requestReview` — Mark/request review for a flow
- `project.flows.approve` — Approve a flow review
- `project.flows.reject` — Reject a flow review

### Handoff / Conversion
- `project.flows.handoffToTasks` — Convert/handoff flow results into initiatives/tasks
- `project.flows.handoffToSocial` — Handoff flow to Social module (campaign/post pipeline)
- `project.flows.handoffToMarketing` — Handoff flow to Marketing module (email/blog/ads)

---

## 8.14 Project — Issues (Module: Issues)
- `project.issues.view` — View issues
- `project.issues.create` — Create issues
- `project.issues.edit` — Edit issues
- `project.issues.delete` — Delete issues
- `project.issues.assign` — Assign/unassign issues
- `project.issues.changeStatus` — Change issue status/state
- `project.issues.comment` — Comment on issues
- `project.issues.linkGithub` — Link issue to GitHub
- `project.issues.unlinkGithub` — Unlink issue from GitHub

---

## 8.15 Project — Social (Module: Social)

### Accounts / Integrations
- `project.social.accounts.view` — View connected social accounts
- `project.social.accounts.connect` — Connect a social account
- `project.social.accounts.disconnect` — Disconnect a social account

### Campaigns
- `project.social.campaigns.view` — View campaigns
- `project.social.campaigns.create` — Create campaigns
- `project.social.campaigns.edit` — Edit campaigns
- `project.social.campaigns.delete` — Delete campaigns

### Posts
- `project.social.posts.view` — View posts
- `project.social.posts.create` — Create posts
- `project.social.posts.edit` — Edit posts
- `project.social.posts.delete` — Delete posts
- `project.social.posts.schedule` — Schedule posts
- `project.social.posts.publish` — Publish posts (high-risk)
- `project.social.posts.approve` — Approve posts (approval workflow)
- `project.social.posts.archive` — Archive posts

### Social Assets
- `project.social.assets.manage` — Manage social assets (selection, grouping, metadata); uses MediaLibraryModal

---

## 8.16 Project — Marketing (Module: Marketing)

### Paid Ads
- `project.marketing.ads.view` — View paid ad campaigns
- `project.marketing.ads.create` — Create ad campaigns
- `project.marketing.ads.edit` — Edit ad campaigns
- `project.marketing.ads.delete` — Delete ad campaigns

### Email Marketing
- `project.marketing.email.view` — View email campaigns
- `project.marketing.email.create` — Create email campaigns
- `project.marketing.email.edit` — Edit email campaigns
- `project.marketing.email.send` — Send email campaigns (high-risk)
- `project.marketing.email.manageRecipients` — Manage recipient lists

### Blog / Content
- `project.marketing.blog.view` — View blog posts
- `project.marketing.blog.create` — Create blog posts
- `project.marketing.blog.edit` — Edit blog posts
- `project.marketing.blog.delete` — Delete blog posts

### Settings
- `project.marketing.settings.view` — View marketing settings
- `project.marketing.settings.edit` — Edit marketing settings

---

## 8.17 Project — Sprints (Module: Sprints)
- `project.sprints.view` — View sprints
- `project.sprints.create` — Create sprints
- `project.sprints.edit` — Edit sprints
- `project.sprints.delete` — Delete sprints
- `project.sprints.manageBacklog` — Manage sprint backlog (add/remove/reorder)
- `project.sprints.manageAssignments` — Manage sprint assignments (who works on what)

---

## 8.18 Project — Milestones
- `project.milestones.view` — View milestones
- `project.milestones.create` — Create milestones
- `project.milestones.edit` — Edit milestones
- `project.milestones.delete` — Delete milestones

---

## 8.19 Project — Media / Assets (Project-context usage)

These permissions govern using the tenant media library **from within a project context**.
This is what you typically check when opening the **MediaLibraryModal** from tasks/flows/social/marketing inside a project.
Keeping these separate from `tenant.media.*` allows externals to work in a project without granting tenant membership.

- `project.media.view` — Browse/select assets within the project context (via MediaLibraryModal)
- `project.media.upload` — Upload assets via MediaLibraryModal from within this project context
- `project.media.edit` — Edit asset metadata within project context (may be restricted to own uploads by policy)
- `project.media.delete` — Delete assets within project context (may be restricted by policy)

- `project.media.importUnsplash` — Use Unsplash tab in MediaLibraryModal within project context
- `project.media.generateAI` — Use AI generation tab in MediaLibraryModal within project context
- `project.media.reworkAI` — Use AI rework tab in MediaLibraryModal within project context

Important:
- AI generation/rework also requires the corresponding AI feature permissions and entitlements:
  - `ai.image.generate` / `ai.image.rework`
  - quota + overage policy
- Actual asset visibility for externals must still respect isolation rules (no unintended tenant-wide exposure).

---

## 8.20 Project / Tenant — Calendar (optional)
If you implement first-class calendar entities (not only derived views):

- `project.calendar.view` — View project calendar
- `project.calendar.manage` — Create/edit/remove calendar items
- `tenant.calendar.view` — View tenant/global calendar
- `tenant.calendar.manage` — Create/edit/remove tenant/global calendar items

If you only provide derived calendar views (from tasks/milestones/posts), you can omit `*.manage`.

---

## 8.21 Notifications (optional)
If notifications are governed by permissions (beyond user self-settings):

- `tenant.notifications.view` — View tenant/global notification center
- `tenant.notifications.manage` — Manage tenant notification rules
- `project.notifications.view` — View project notifications
- `project.notifications.manage` — Manage project notification settings

---

## 8.22 User / Profile (optional permission gating)
User profile changes are typically self-service. If you want admin control:

- `tenant.users.viewProfiles` — View extended user profile info (beyond member list)
- `tenant.users.manageProfiles` — Edit user profile attributes (admin action)
- `user.settings.editSelf` — Edit own settings (usually always allowed)

---

## 8.23 AI Permissions (Feature-level)

These permissions control whether a user may call AI features.
Quotas/limits are enforced separately via entitlements.

- `ai.text.use` — Use Gemini 3.0 Flash text features (summaries, generation, assistants)
- `ai.image.generate` — Generate images (Gemini 3.0 Flash Nano Banana)
- `ai.image.rework` — Rework/edit images (Gemini 3.0 Flash Nano Banana)
- `ai.usage.viewSelf` — View own AI usage
- `ai.usage.viewTenant` — View tenant AI usage (typically Owner/admin)
- `ai.limits.manageSelf` — Manage own AI limits/caps (if allowed)
- `ai.limits.manageOthers` — Manage other users’ AI limits/caps (owner-managed quotas)
- `ai.overage.allowSelf` — Allow self to exceed included AI quotas (billable)
- `ai.overage.allowOthers` — Allow others to exceed included AI quotas (billable)

---

## 9) Storage Model (Firestore) — Explicit Role Storage Rules

Decision: Store system roles explicitly except Member.

### 9.1 Tenant Roles
`tenants/{tenantId}/roles/{roleId}`
- `name`
- `position`
- `isSystem`
- `systemKey` (`OWNER` | `MEMBER` | `GUEST` | null)
- `permissions.allow`
- `permissions.deny`

### 9.2 Project Roles (Project Owner only)
`tenants/{tenantId}/projects/{projectId}/roles/{roleId}`
- `name` (Project Owner: {project name})
- `isSystem: true`
- `systemKey: PROJECT_OWNER`
- `permissionsMode: ALL_PROJECT_PERMISSIONS`

### 9.3 Tenant Membership
`tenants/{tenantId}/members/{userId}`
- `userId`
- `status`
- `roleIds: string[]`
  - includes custom roles
  - does NOT include Member (Member is implicit)

### 9.4 Project Membership
`tenants/{tenantId}/projects/{projectId}/members/{memberId}`
- `type` (`workspaceUser` | `external`)
- `userId` (optional for external until they register)
- `roleIds: string[]`
  - includes custom tenant roles + project roles
  - MUST include Guest if external
  - does NOT include Member (Member is implicit)

---

## 10) UI Requirements Summary

- Roles list is vertical and ordered by `position`.
- Role management UI must enforce hierarchy boundaries:
  - cannot edit/assign roles at or above your highest role
- Member is editable by anyone with `tenant.roles.edit` (and boundary passes).
- Guest is mandatory for externals and cannot be removed until they join the workspace.
- Tenant Owner transfer must be a dedicated, explicit action with confirmation and audit logging.
- If Owner is inaccessible → support ticket process.
- MediaLibraryModal usage must be permission-gated using the media permission nodes above:
  - in tenant contexts: `tenant.media.*`
  - in project contexts: `project.media.*`
  - plus AI feature permissions (`ai.image.*`) and entitlements

