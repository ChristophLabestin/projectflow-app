# brain/reference/app/APP_CONCEPT.md — ProjectFlow Product Concept & Architecture

This document defines the product concept, core functionality, and high-level architecture of the ProjectFlow project management application.  
It is the product-level source of truth for scope, entities, relationships, subscription tiers, and entitlements.

---

## 1) Product Positioning

**Primary audience:** B2B software companies, founders, startup operators, and teams working in the digital sector (product, engineering, marketing, design, growth), plus freelancers/solo operators.

**Primary value proposition:** A workspace that combines execution (projects/tasks/initiatives) with optional operational modules (Marketing blog, Sprints, Accounting).

The system is multi-tenant: each tenant represents a **workspace** (company/team environment) that can contain multiple projects.

---

## 2) Core Concepts & Definitions

### 2.1 Tenant (Workspace)
A **Tenant** is the top-level workspace entity that owns:
- Members and roles
- Workspace-level settings
- Projects
- Subscription plan and licensing configuration

**Tenant creation rule:**
- If a user registers **without being invited**, they automatically create a **new tenant**.
- The tenant creator becomes **Owner / Super Admin** (highest privileges).

### 2.2 User
A **User** is a global identity at the database root level. A user can belong to multiple tenants (subject to subscription rules).

User data includes:
- Profile data (name, etc.)
- Personal app settings that affect UI/UX (e.g., light/dark mode, language preferences)

### 2.3 Workspace Member vs External Project Collaborator
ProjectFlow distinguishes between two collaboration scopes:

**Workspace Member**
- Belongs to a tenant (workspace) and can see tenant-level navigation (within granted permissions).
- Occupies a licensed seat when required by the subscription plan.

**External Project Collaborator (External)**
- Does **not** become a tenant member.
- Has access **only** to the specific project they are invited to.
- Must not see other tenant projects or tenant-level areas outside the project scope.

### 2.4 Project
A **Project** exists under a tenant and represents a unit of work (product, client project, internal initiative, or company/startup founding effort).
Projects contain their own operational data such as:
- Tasks, subtasks
- Initiatives
- Milestones, sprints (optional module)
- Marketing blog artifacts (optional module)
- Project membership (including externals)
- Project lifecycle state: active delivery, planning/backlog, paused recovery, completed archive, and canceled work are distinct so the workspace can separate active planning from stopped or finished projects. Canceled projects stay visible in their archive section but are excluded from health scoring, spotlight selection, and global task scheduling/priority surfaces.
- Project delivery setup: one project purpose, success criteria, scope boundary, decision owner, operating cadence, date confidence, and primary risks. The purpose is entered once and reused internally so ProjectFlow and Codex can judge whether work is moving toward the intended outcome without asking users for a duplicate objective.
- Project category/template metadata so company/startup projects can be grouped separately from normal projects and normal projects can be linked back to a company project as independent workstreams.
- Startup/company profile and readiness metadata for founding projects: current stage, jurisdiction template/source metadata, target customer, funding route, selected founding tracks, legal/finance/compliance/launch readiness, restricted advisor/legal/finance resource handling, and seeded work metadata.
- Codex session records and follow-ups that keep coding work truthful across repositories.

### 2.5 Modules (Project-Configurable)
Each project can be configured with **modules** that can be enabled/disabled at project creation (and changeable later if allowed by permission rules).

Example modules:
- Tasks (core)
- Initiatives (core)
- Codex (core automation surface; not stored as a disableable project module)
- Marketing (optional, blog only)
- Sprints (optional)
- Accounting (optional)

**Module behavior:**
- If a module is disabled, it must be hidden from navigation and UI, and its creation actions must be blocked.
- Module configuration must be stored on the project and enforced in UI + backend rules.

---

## 3) Subscription Plans, Licensing, and AI Entitlements

> **Implementation status (2026-10-23):** Free and Team are live in code (Stripe **test mode**), see
> `brain/plans/billing-implementation.md`. New workspaces get a 14-day Team trial without card, then Free
> (projects over 3 become read-only, nothing is deleted). Existing workspaces are Team in `grace` until
> `admin_config/billing.cutoverAt`. Free AI = user's own **OpenAI** key (not Gemini). Seats = full members (guests free),
> synced to the Stripe quantity. License mode A/B (§3.2), owner quota pools (§3.3), overage (§3.4) and Organization/SSO are not built.

ProjectFlow is intentionally designed with **three subscription tiers**. Plan entitlements must be enforced consistently in:
- UI navigation and feature exposure
- Action-level guards (buttons, forms, API calls)
- Firestore security rules and backend validation (authoritative enforcement)

### 3.1 Plan Overview

#### Starter (Solo) — public name „Free“, 0 €
Target: individuals, freelancers, self-employed users.

Rules:
- Intended for **single-person usage only**.
- **Max 3 projects** per tenant (owner decision 2026-10-23, was 1).
- **No workspace invitations** (cannot invite members).
- **Cannot join other workspaces** (cannot become a member of another tenant).
- **AI features are not included**.
  - Optional: user may use AI only if they provide their own **Gemini API key** (BYO key model).

Everything else is not restricted unless explicitly specified elsewhere.

#### Professional (Team) — public name „Team“, 10 €/seat/month billed yearly, 12 € monthly
Target: teams and growing companies.

Rules:
- **Unlimited projects**.
- Workspace can have **up to 50 workspace members** (owner decision 2026-10-23, was 20).
- **Seat-based licensing**:
  - Each workspace member must have at least a **Professional** license (one license per user).
- **Unlimited external project collaborators** per project (no tenant membership required for externals).

AI entitlements – **not included in the seat price** (owner decision 2026-10-23): AI features are unlocked per user by the
**AI add-on, 10 €/user/month** – bookable on Team (Professional) and Organization only; Starter/Free uses AI only with the
user's own OpenAI key. Each user with the add-on gets monthly:
- **1,000,000 AI tokens / month / user**
- **50 images / month / user**

AI features included in Professional are based on:
- Text/assistant features: **Gemini 3.0 Flash**
- Image generation and image rework: **Gemini 3.0 Flash Nano Banana**

#### Organization (Enterprise) — from 18 €/seat/month billed yearly, from 10 seats (proposal)
Target: larger organizations requiring centralized identity/security and customized governance.

Organization includes everything in **Professional**, plus:
- **Single Sign-On (SSO)** configuration (tenant-managed identity integration)
- **Custom AI limits and policies**
  - custom included quotas (tokens/images)
  - custom allocation rules
  - custom overage rules (if required)
- Typical enterprise-grade capabilities (examples):
  - advanced security and governance controls
  - enhanced auditing/logging
  - extended compliance needs
  - priority support / SLAs (business-side capability; implementation may follow later)

Implementation must treat Organization as a first-class tier and allow extending entitlements without refactoring the data model.

### 3.2 License Management Modes (Professional & Organization)

Plans that support teams must support two operational modes (tenant-level setting):

**A) Self-managed licenses (simple)**
- Users invited into the workspace must hold an eligible plan on their own.
- Seat checks are performed at invite acceptance / membership activation.

**B) Owner-managed licenses (optional, advanced)**
- The tenant Owner can **purchase and assign seats** (licenses) to workspace members.
- Owner can manage:
  - seat assignments
  - workspace member activation/deactivation
  - aggregated AI quota distribution (see below)

Both modes may coexist if needed, but the system must support at least one mode without blocking adoption.

### 3.3 AI Quota Accounting and Distribution (Professional baseline)

#### Default behavior (per-user quotas)
Each licensed user receives monthly included quotas:
- `1,000,000` tokens/month
- `50` images/month

Quotas reset monthly.

#### Owner-managed distribution (optional)
If Owner-managed licenses are enabled, the included quotas can be treated as an **aggregate tenant pool**:

- Total included tokens/month = `1,000,000 × numberOfLicensedUsers`
- Total included images/month = `50 × numberOfLicensedUsers`

In this mode, the Owner must be able to:
- set per-user token/image limits
- redistribute quotas among managed users (e.g., give one user more, another less)
- keep totals within the aggregated included amount (unless overage is enabled)

### 3.4 Overage (Exceeding Included AI Limits)

Included limits are “included quota.” The system must support **hard limits** and **optional overage**:

- By default, hard limits should be enforceable (requests blocked once quota is exhausted).
- The Owner should be able to **disable hard limits** (tenant-level, and optionally per user), allowing usage to exceed included quota.

Overage requirements:
- Track all overage usage separately:
  - excess tokens
  - excess image generations/reworks
- Overage must be billable later (billing implementation can be separate, but usage tracking is mandatory).

---

## 4) Firestore Data Model (High-Level)

### 4.1 Top-Level Collections

#### `users` (root collection)
Purpose: global user identity and personal settings.

User document stores:
- profile data (name, etc.)
- personal app settings (theme, language, UI preferences)
- pinned items and `focusState` so one current focus can follow the user across web, native, and notification surfaces
- personal task capture imports (`personalTaskImports`) from native capture surfaces
- optional references for memberships and invitations

#### `tenants` (root collection)
Purpose: workspace container and membership/project ownership.

A tenant stores:
- workspace metadata
- subscription plan and licensing settings
- membership references
- projects (as subcollection)

Plan-related tenant fields (conceptual):
- `planTier` (Starter / Professional / Organization)
- `licenseMode` (self-managed / owner-managed)
- `seatLimit` (e.g., 20 for Professional workspace members; Organization may override)
- `seatsPurchased` / `seatsAssigned` (if owner-managed)
- AI policy fields:
  - `aiProviderModelText` (Gemini 3.0 Flash)
  - `aiProviderModelImage` (Gemini 3.0 Flash Nano Banana)
  - `aiIncludedTokensPerSeat` (default 1,000,000; customizable on Organization)
  - `aiIncludedImagesPerSeat` (default 50; customizable on Organization)
  - `aiHardLimitEnabled` (default true)
  - `aiOverageEnabled` (default false)
  - `aiAllocationRules` (only if owner-managed distribution is enabled)
- SSO fields (Organization):
  - `ssoEnabled`
  - `ssoProviderConfig` (exact structure to be defined later)

---

## 5) Tenant Membership & Permission System (To Be Implemented)

A permission system is required and must work across:
- Tenant scope (workspace-level administration)
- Project scope (project roles and module access)
- Feature scope (fine-grained permissions for actions)

### 5.1 Permission Model (Recommended Baseline)

#### Tenant Roles (workspace-level)
- **Owner (Super Admin):** full control over tenant, billing, roles, and all projects
- **Admin:** manage users/projects (except transferring ownership / billing)
- **Member:** standard usage permissions within assigned projects

#### Project Roles (project-level)
- **Project Owner:** full control in a project
- **Project Admin:** manage project settings and members
- **Contributor:** create/edit work items depending on module rules
- **Viewer:** read-only access

### 5.2 Required Deliverable
Create a separate document: `brain/reference/app/PERMISSIONS.md` that defines:
- roles
- permission matrix (actions → allowed roles)
- how permissions are stored (membership docs, claims if needed)
- how enforcement works (UI guards + Firestore rules)

---

## 6) Project Modules (Functional Definition)

### 6.1 Tasks (Core)
Standard project tasks with:
- priority, assignees, due dates
- subtasks/checklists
- comments/activity
- optional statuses/columns

### 6.2.1 Codex Automation (Core)
Codex sessions represent implementation work performed by Codex outside the web app. Sessions can start, checkpoint, finish, and create follow-up tasks through the ProjectFlow API.

Core capabilities:
- project-scoped session feed
- linked task or initiative status sync
- checkpoint history with files touched and validation status
- Codex follow-up inbox backed by normal project tasks
- API-token based repo/plugin integration

### 6.3 Marketing Module (Optional, blog only)
Purpose: manage blog posts for the public website and the blog API connection (settings wizard). Social, paid ads, email campaigns and recipients were removed 2026-10-22; their data stays in Firestore but is closed to clients by `isRetiredProjectCollection()`. Flows, Ideas and Issues are also removed (legacy lineage fields `convertedIdeaId`/`originIdeaId`/`linkedIssueId` remain for existing data).

---

## 8) Recommended Firestore Subcollection Layout (Conceptual)

Within `tenants/{tenantId}`:
- `members/{userId}` — workspace membership + tenant role + seat/license assignment (if applicable)
- `projects/{projectId}` — project metadata + module configuration
- `invites/{inviteId}` — invite links (workspace-level)
- `billing/{...}` (optional) — plan, invoices, usage summaries (future)

Within `tenants/{tenantId}/projects/{projectId}`:
- `members/{memberId}` — project membership (workspace users and externals)
  - must distinguish workspace members vs externals
- `tasks/{taskId}`
- `milestones/{milestoneId}`
- `sprints/{sprintId}` (only if Sprints module enabled)
- `marketing/...` (only if Marketing module enabled)

Within `users/{userId}`:
- `notifications/{notificationId}` (optional)
- `tenantRefs/{tenantId}` (optional denormalized reference for fast lookup)

---

## 9) Onboarding & Collaboration Rules

### 9.1 Registration
- If user signs up **without invite**: create tenant + assign Owner role.
- If user signs up **with invite**: attach them to referenced tenant/project with the role defined by the invite, subject to subscription restrictions.

Starter restrictions must be enforced:
- Starter users cannot join other tenants.
- Starter tenants cannot invite workspace members.

### 9.2 Project Invitations
Professional and Organization support inviting:
- workspace members (seat required)
- external project collaborators (no tenant membership; project-scoped only; unlimited)

External collaborators must be strictly isolated from tenant-level visibility.

---

## 10) Internationalization Requirement
The application must support multiple languages via dictionary files (e.g., `en.ts`, `de.ts`).  
User-facing text must not be hardcoded; it must come from the language dictionaries.

---

## 11) Open Decisions / TODOs

- Define `brain/reference/app/PERMISSIONS.md` (roles, actions, module gates, enforcement).
- Specify Organization SSO configuration structure and supported providers.
- Define Organization custom AI limits and governance policies (exact fields + UI).

## Media Library & Asset Management (Core Capability)

ProjectFlow provides a **tenant-wide media library** used as the single source of truth for images and files across the application.

### Unified asset entry point: Media Library Modal
All asset selection and uploads must be handled through a single reusable component: **MediaLibraryModal**.

No feature is allowed to implement its own standalone upload picker. Any place where a user attaches/selects an image or file must open the MediaLibraryModal.

### MediaLibraryModal capabilities
1) **Browse tenant assets**
- Shows all tenant assets the current user is authorized to view.
- Supports searching and basic asset metadata.

2) **Upload assets**
- Provides drag-and-drop and file picker upload.
- Uploaded assets are stored in the tenant media library.

3) **AI Image Generation**
- Provides an image generation tab powered by **Gemini 3.0 Flash Nano Banana**.
- Generated images are saved into the tenant media library.
- Requires AI permissions and respects included quota + overage rules.

## Initiative V2

- Initiatives are now first-class project resources stored under `tenants/{tenantId}/projects/{projectId}/initiatives/{initiativeId}`.
- An initiative is a mini-project inside a project: it owns outcome context, success metrics, health, dates, and aggregate progress.
- Regular tasks remain the execution unit and can belong to an initiative through `task.initiativeId`.
- Legacy records may carry `originIdeaId` from the removed Flow conversion; no new ones are created.
- Milestones should link to initiative ids directly, with temporary fallback support for legacy idea-linked records during migration.

4) **Free stock images (Unsplash)**
- Provides a tab to search and select stock images from **Unsplash**.
- Selected images are imported into the tenant media library (including attribution metadata where required).

### Access control and external collaborators
- Assets belong to the tenant, but visibility must always be **permission- and context-aware**.
- External project collaborators must only be able to access tenant assets they are authorized to view in the project context (no unintended tenant-wide exposure).

### Usage across modules
The media library is used by:
- Task attachments
- Marketing module (blog assets)
- Project and tenant branding (logos, cover images)
- Any future feature requiring files or images

### Conceptual Firestore placement (recommended)
Store tenant assets at tenant scope:
- `tenants/{tenantId}/media/{assetId}`

Assets may include metadata for access and filtering such as:
- uploader, timestamps, tags/folders (optional)
- source: `upload | ai | unsplash`
- optional visibility controls to prevent external overexposure
