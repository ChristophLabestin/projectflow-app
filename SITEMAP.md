# SITEMAP.md — ProjectFlow Application Routes

This sitemap is the single source of truth for all application pages/routes.
All new pages must be added here. When a page is implemented, update its status.

Legend:
- [ ] Planned / Not implemented
- [~] In progress
- [x] Implemented
- [!] Blocked / Needs decision
- [ ] [X] Confirmed by User
---

## 1) Public Routes (No authentication required)

These routes must remain accessible without being logged in.

- [x] `/login` — Login page (SCSS + i18n pass; hero fixed black in dark mode)
- [x] `/register` — Registration page (shares Login component; hero fixed black in dark mode)
- [x] `/auth/action` — Auth action handler (email verification, password reset, etc.) (SCSS + i18n pass)
- [x] `/legal/:type` — Legal pages (e.g., privacy policy, terms, imprint) (SCSS + i18n pass)
- [x] `/invite/:tenantId` — Tenant/workspace invite landing (SCSS + i18n pass)
- [x] `/invite-project/:projectId` — Project invite landing (SCSS + i18n pass)
- [x] `/join/:inviteLinkId` — Join project via invite link (SCSS + i18n pass)
- [x] `/join-workspace/:inviteLinkId` — Join workspace via invite link (SCSS + i18n pass)
- [x] `/ui` — Component Style Guide (Dev only)

---

## 2) App Routes (Authentication required)

These routes are rendered inside the authenticated app shell/layout.

### 2.1 Global / Workspace-level Pages

- [x] Refactored SCSS | `/` | Main dashboard (Dashboard.tsx + dashboard cards aligned to SCSS; ui Card uses SCSS)
- [x] `/notifications` — Notifications center (SCSS refactor, ConfirmModal)
- [x] `/projects` — Projects list (SCSS refactor complete: cards/spotlight/suggestion/table/toolbars aligned to tokens + common components)
- [x] `/tasks` — Global tasks overview (SCSS refactor, common controls, board + modal alignment)
- [x] `/calendar` — Global calendar view (SCSS refactor, common components, schedule modal + tooltip alignment)
- [x] `/brainstorm` — Brainstorming / ideation hub (SCSS refactor, AI Studio components aligned to common Button/Card/TextArea/Badge)
- [x] `/create` — Create Project Wizard (SCSS refactor, common inputs/buttons/selects, preview + assets panels aligned)
- [ ] `/team` — Team / members management
- [ ] `/media` — Media library
- [ ] `/profile` — User profile

### 2.2 Personal Tasks

- [ ] `/personal-tasks` — Personal tasks list
- [ ] `/personal-tasks/:taskId` — Personal task detail

---

## 3) Project Routes (Authentication required)

All routes below are scoped to a specific project via `:id`.

Base:
- [x] `/project/:id` — Project root (project overview index SCSS + common components aligned)

### 3.1 Project Core

- [x] `/project/:id` (index) — Project overview (SCSS refactor + common components)
- [x] `/project/:id/details` — Project details/settings (SCSS refactor + common components)
- [x] `/project/:id/activity` — Project activity feed (SCSS refactor + common components)

### 3.2 Project Tasks

- [x] `/project/:id/tasks` — Project tasks list/board (SCSS refactor, common controls + badges, tooltip + timeline alignment)
- [x] `/project/:id/tasks/:taskId` — Project task detail (SCSS refactor, dependencies card, common components + i18n)

### 3.3 Flows & Ideas

Note: In the old routing, `ideas` reused the same components as `flows`.

- [x] `/project/:id/flows` — Flow pipelines list (SCSS refactor, common components + i18n)
- [~] `/project/:id/flows/:flowId` — Flow detail view (SCSS refactor in progress: product launch stage + analysis dashboard updated)
- [x] `/project/:id/ideas` — Ideas list (alias/variant of flows) (SCSS refactor, common components + i18n)
- [ ] `/project/:id/ideas/:flowId` — Idea detail view (shared detail component)

### 3.4 Issues

- [x] `/project/:id/issues` – Issues list (SCSS refactor, common components + issue modals aligned)
- [x] `/project/:id/issues/:issueId` - Issue detail (SCSS refactor, common components + i18n)

### 3.5 Milestones & Sprints

- [x] `/project/:id/milestones` - Milestones overview (SCSS refactor, common components + i18n)
- [x] `/project/:id/sprints` — Sprints (module-gated: `sprints`, SCSS refactor, common components + i18n, confirm modals)

---

## 4) Project Modules (Authentication required, module-gated)

Some project areas require module access. Keep module routing grouped and consistent.

### 4.1 Social Module (module: `social`)

#### 4.1.1 Social Module Shell (within project)

- [ ] `/project/:id/social` (index) — Social dashboard
- [ ] `/project/:id/social/campaigns` — Campaign list
- [ ] `/project/:id/social/campaigns/create` — Create campaign
- [ ] `/project/:id/social/campaigns/edit/:campaignId` — Edit campaign
- [ ] `/project/:id/social/campaigns/:campaignId` — Campaign detail view
- [ ] `/project/:id/social/review/:ideaId` — Social campaign review page
- [ ] `/project/:id/social/posts` — Post list
- [ ] `/project/:id/social/calendar` — Social calendar
- [ ] `/project/:id/social/settings` — Social module settings
- [ ] `/project/:id/social/assets` — Social assets library

#### 4.1.2 Social Standalone Routes (still under project)

These are outside the Social module shell in the old routing.

- [ ] `/project/:id/social/create` — Create social post
- [ ] `/project/:id/social/edit/:postId` — Edit social post
- [ ] `/project/:id/social/approvals` — Approvals queue
- [ ] `/project/:id/social/archive` — Social post archive

### 4.2 Marketing Module (module: `marketing`)

- [ ] `/project/:id/marketing` (index) — Marketing dashboard
- [ ] `/project/:id/marketing/ads` — Paid ads list
- [ ] `/project/:id/marketing/ads/create` — Create ad campaign
- [ ] `/project/:id/marketing/ads/:campaignId` — Ad campaign detail
- [ ] `/project/:id/marketing/ads/:campaignId/edit` — Edit ad campaign
- [ ] `/project/:id/marketing/email` — Email marketing list
- [ ] `/project/:id/marketing/email/create` — Create email
- [ ] `/project/:id/marketing/email/builder` — Email builder
- [ ] `/project/:id/marketing/recipients` — Recipients list
- [ ] `/project/:id/marketing/blog` — Blog list
- [ ] `/project/:id/marketing/blog/create` — Create blog post
- [ ] `/project/:id/marketing/blog/:blogId` — Edit blog post
- [ ] `/project/:id/marketing/settings` — Marketing settings

### 4.3 Accounting Module (module: `accounting`)

- [ ] `/project/:id/accounting` — Accounting placeholder / module entry

---

## 5) Error & Fallback Routes

- [ ] `*` — Catch-all: redirects to `/`
- [x] Error boundary page — Rendered when route errors occur (global error handler) (SCSS + i18n pass)

---

## Notes / Migration Considerations

- Tailwind -> SCSS migration: audit complete; shared component refactor in progress; keep the Tailwind CDN until remaining utility classes are replaced.
- `/register` currently points to the same component as `/login` in the old implementation.
- `ideas` and `flows` shared components and detail views. Keep this intentional (alias) or split it if product requirements change.
- Social has both nested (module-shell) routes and standalone routes under the same prefix. If you redesign routing, consider consolidating them under the social shell for consistency.

---

## 6) Shared Components (SCSS migration tracker)

- [x] components/PinnedTasksModal.tsx - Pinned tasks modal (SCSS)
- [ ] components/SettingsModal.tsx - App settings modal (legacy UI)
- [ ] components/MediaLibrary/MediaLibraryModal.tsx - Media library modal
- [ ] components/GroupCreateModal.tsx - Group create modal
- [ ] components/InviteMemberModal.tsx - Invite member modal
- [ ] components/EditTaskModal.tsx - Edit task modal (legacy UI)
- [ ] components/project/ProjectReportModal.tsx - Project report modal
- [ ] components/project/HealthDetailModal.tsx - Project health detail modal
- [ ] components/ProfileSettingsModal.tsx - Profile settings modal
- [ ] components/onboarding/OnboardingWelcomeModal.tsx - Onboarding welcome modal
- [ ] components/modals/PasskeySetupModal.tsx - Passkey setup modal
- [ ] components/modals/TwoFactorChallengeModal.tsx - 2FA challenge modal
- [ ] components/modals/TwoFactorSetupModal.tsx - 2FA setup modal
- [ ] components/flows/InitiativeConversionModal.tsx - Initiative conversion modal
- [ ] components/ui/Modal.tsx - Legacy modal base
- [ ] components/ui/GlobalConfirmationModal.tsx - Legacy global confirmation
- [x] components/common/Modal/Modal.tsx - Common modal base (SCSS)
- [x] components/common/Modal/ConfirmModal.tsx - Common confirm modal (SCSS)
- [x] components/common/Modal/SettingsModal.tsx - Common settings modal (SCSS)
- [x] components/TaskCreateModal.tsx - Task create modal (SCSS)
- [x] components/CreateIssueModal.tsx - Issue create modal (SCSS)
- [x] components/EditIssueModal.tsx - Issue edit modal (SCSS)
- [x] components/sprints/CreateSprintModal.tsx - Sprint create modal (SCSS)
- [x] components/sprints/SprintDetailsModal.tsx - Sprint details modal (SCSS)
- [x] components/Milestones/MilestoneModal.tsx - Milestone create/edit modal (SCSS)
- [x] components/Milestones/MilestoneDetailModal.tsx - Milestone detail modal (SCSS)
- [x] components/project/ProjectEditModal.tsx - Project edit modal (SCSS)
- [x] components/ProjectLabelsModal.tsx - Project labels modal (SCSS)
- [x] components/flows/CreateFlowModal.tsx - Flow create modal (SCSS)
- [x] components/flows/stages/ReviewTimelineModal.tsx - Review timeline modal (SCSS)


