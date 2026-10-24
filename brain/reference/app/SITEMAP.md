# brain/reference/app/SITEMAP.md — ProjectFlow Application Routes

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
- [x] `/legal/:type` — Legal pages `privacy` | `terms` | `imprint` (`impressum` redirects) rendered from the versioned legal documents system (`legal_documents/*`); `?v=<n>` archive version, `&diff=1` diff to the previous version. Public JSON: `/api/legal[/<type>]` (function `legalDocument`). See `brain/operations/legal-documents.md`.
- [x] `/download` — Public desktop app download page (`DownloadPage`): detects macOS/Windows, offers the matching installer from the latest GitHub Release (direct file link, no GitHub page), install steps, features, requirements, FAQ.
- [x] `/invite/:tenantId/:inviteId` — Accept a workspace invitation (email or link; `screens/AcceptInvite.tsx`). Replaced `/invite/:tenantId`, `/invite-project/:projectId`, `/join/:inviteLinkId` and `/join-workspace/:inviteLinkId` on 2026-09-26.
- [x] `/feedback/initiative/:token` — Public initiative feedback form with required-field validation that creates linked initiative tasks from customer submissions
- [x] `/ui` — Component Style Guide (Dev only). Includes tokens, typography, buttons, cards, inputs, date/time, media library, badges, checkboxes/toggles, max-width container categories, Level of Depth guidance, and next standardization candidates.
- [x] `/desktop/quick-access` — Desktop app only (Electron shell, `desktop/`): content of the Quick Access pop-out window (`QuickAccessWindow` → `PinnedTasksModal variant="window"`). Rendered inside `RootLayout` without `AppLayout` and without global overlays; in a normal browser it redirects to `/`.
- [x] `/desktop/capture` — Desktop only: Quick Capture panel (`QuickCaptureWindow`), opened by the global shortcut.
- [x] `/desktop/day?mode=start|close` — Desktop only: day start / day close window (`DesktopDayWindow`, plan logic from `utils/dayPlan`).
- [x] `/desktop/tray` — Desktop only: menu bar panel (`DesktopTrayPanel`): focus timer + controls, inline capture, Today / Pinned / Inbox, next meeting, quick actions.
- [x] `/desktop/palette` — Desktop only: command palette window (`DesktopCommandPalette`): search projects/my tasks, open, complete, start focus, create via Quick Capture.
- [x] `/desktop/auth?challenge=…` — Browser page of the desktop OAuth handoff (`DesktopAuthHandoff`): after web sign-in it creates a one-time code and opens `projectflow://auth`.
- [x] `/oauth/consent?request=…` — OAuth consent for AI/MCP clients (`OAuthConsent`): signed-in user picks one workspace and the scopes, then returns to the client with a code (server: `functions/src/oauth-server.ts`). Hosting rewrites `/oauth/authorize|token|register|revoke` and `/.well-known/oauth-*` go to the functions `oauth` / `mcp`, not to the SPA.
- [x] `?openSettings=billing` (+ `&checkout=success|cancel` from Stripe) — opens the workspace settings on Billing (`BillingPanel`; Stripe Checkout/Portal return here).
- [x] `?openSettings=account|security|notifications|preferences` — any signed-in route: opens the personal settings modal on that tab (`SettingsUrlOpener`; used by the desktop app to link accounts in the browser).

---

## 2) App Routes (Authentication required)

These routes are rendered inside the authenticated app shell/layout.

### 2.1 Global / Workspace-level Pages

- [x] Refactored SCSS | `/` | Main dashboard command center (quiet date/greeting with persisted current focus, resume/focus action, then scroll-driven stages for today plan and workspace health/momentum)
- [x] `/notifications` — Notifications center (SCSS refactor, ConfirmModal, web push diagnostics and registration)
- [x] `/activity` — Workspace activity feed (`WorkspaceActivity`, `components/activity/ActivityFeed`): filters person/project/type/period in the URL (`?person=&project=&type=&period=`), grouped by day, endless scroll, live first page; guests see their projects only
- [x] `/insights` — Workspace insights (`WorkspaceInsights`, full members; guests redirect to `/activity`): KPIs, throughput, cycle time, burn-up, workload, project health, AI weekly report
- Workspace suspended (`tenants/{id}.suspendedAt`): `WorkspaceProvider` replaces the app with a suspension notice (switch workspace / support / sign out). Platform banner `PlatformAnnouncement` sits below the TopBar.
- [x] `/admin/*`, `/insights/onboarding` — moved to the **admin console** (`admin/`, see below); `AdminConsoleRedirect` sends old links to `VITE_ADMIN_CONSOLE_URL` (default `https://admin.getprojectflow.com`, `/insights/onboarding` → `/onboarding`).
- [x] `/wiki`, `/wiki/:docId` — Workspace wiki (lazy `screens/wiki/WikiScreen`; full members, guests see a notice): page tree with drag & drop, favorites, search, templates, trash (`?view=trash`), Tiptap page editor with autosave, versions, AI, task links, backlinks. Concept `brain/plans/wiki-concept.md`. Sidebar entry via `WORKSPACE_AREAS.wiki`.
- [x] `/flows`, `/flows/new` (`?template=&projectId=&back=`), `/flows/:flowId` — Flows (automations; lazy `screens/flows/FlowsScreen` + `FlowEditor`; full members, guests see a notice): list with toggle/status/usage, template gallery, step editor Wenn → Falls → Dann, preview + dry run, run log with retry. Concept `brain/plans/flows-concept.md`. Sidebar entry via `WORKSPACE_AREAS.flows`.
- Consent gate: every signed-in route (incl. `/desktop/quick-access|capture|day|tray`) is wrapped in `LegalConsentGate`; contract `brain/plans/legal-consent-contract.md`.
- [x] `/projects` — Projects list (SCSS refactor complete: cards/spotlight/suggestion/table/toolbars aligned to tokens + common components; company/startup projects are grouped separately with linked workstreams, and bottom lifecycle lists separate backlog/planning, paused, completed, and canceled projects)
- [x] `/tasks` — Global tasks overview (SCSS refactor, common controls, board + modal alignment)
- [x] `/calendar` — Global calendar view (SCSS refactor, common components, schedule modal + tooltip alignment) Phones (< 768 px, week view): date strip + agenda of the selected day (`.calendar-agenda`).
- [ ] `/finance*` — **removed 2026-10-23** (Finance V2 cockpit, bookings, receivables, payables, bank, tax, reports, functions, exports, sync, settings). Old links land on 404. Backend removed too: the 47 `finance-v2` Cloud Functions were deleted in production (139 → 92 functions); the `finance_*` tenant collections stay in Firestore but are closed to clients (no read/write rule, covered by the rules test).
- [x] `/brainstorm` — removed 2026-10-23 together with CORA / AI Studio; redirects to `/` (`Router.tsx`). The in-app AI (✦, ⌘J) replaced it.
- [x] `/create` — Legacy create-project deep link that opens the global Create Project modal with one project purpose field, optional success criteria/cadence, and returns to `/projects`
- [x] `/team` — Team / members management
- [x] `/files` — Documents: all files the user may see (list/grid, filters, trash, quota); `?file=<id>` opens a preview, `?type=image` presets the type filter (brain/plans/files-concept.md)
- [x] `/media` — redirects to `/files?type=image` (media library merged into the file manager)
- [x] `/project/:id/files` — project files tab (project, task and comment files)
- [x] `/project/:id/flows` — project flows (same `FlowsScreen`, filtered to the project plus workspace flows)
- [x] `/profile` — User profile

### 2.2 Personal Tasks

- [x] `/personal-tasks` — Personal tasks list
- [x] `/personal-tasks/:taskId` — Personal task detail

---

## 3) Project Routes (Authentication required)

All routes below are scoped to a specific project via `:id`.

Base:
- [x] `/project/:id` — Project root (project overview index SCSS + common components aligned)

### 3.1 Project Core

- [x] `/project/:id` (index) — Project overview (command-first layout with compact/showcase masthead modes, command strip, attention queue, conditional right-column project triage for overdue/blocked/unassigned task cleanup and team delegation, demoted reference modules, compact delivery guardrails card without repeating the masthead purpose, explicit pause/resume/cancel lifecycle; company/startup projects add an action-first company command surface with founder action, launch readiness, a workstream modal/drawer task inspector, company context, a dedicated founding-brief modal, source references, and linked-project rollups)
- [x] `/project/:id/details` — Project details/settings (SCSS refactor + common components)
- [x] `/project/:id/activity` — Project activity: `ActivityFeed` for the project (stream) + collapsible legacy log ("Earlier activity")
- [x] `/project/:id/wiki`, `/project/:id/wiki/:docId` — Project wiki (same `WikiScreen`, space `project`; project members incl. guests). Project nav item `wiki`.
- [x] `/project/:id/codex` — removed 2026-09-26; redirects to the project overview (sessions still appear in activity)

### 3.2 Project Tasks

- [x] `/project/:id/tasks` — Project tasks list/board (SCSS refactor, common controls + badges, tooltip + timeline alignment)
- [x] `/project/:id/tasks/:taskId` — Project task detail (Full Workbench workspace with compact command header, editable command rail, Work/Discussion/History tabs, next-step/blocker/reminder/quick-log fields, subtasks, comments, task relationships for blocked-by/is-blocking/parent/sub-task links with blocked status automation, labels, milestone, focus actions, and sticky inspector)

### 3.2.1 Project Initiatives

- [x] `/project/:id/initiatives` — Initiative list with direct create CTA, status filters, and search
- [x] `/project/:id/initiatives/:initiativeId` — Initiative detail page with cardless document-style hero, summary, child tasks, milestones, comments, and activity

### 3.3 Milestones & Sprints

- [x] `/project/:id/milestones` - Milestones overview (SCSS refactor, common components + i18n)
- [x] `/project/:id/sprints` — Sprints (module-gated: `sprints`, SCSS refactor, common components + i18n, confirm modals)

---

## 4) Project Modules (Authentication required, module-gated)

Some project areas require module access. Keep module routing grouped and consistent.

### 4.1 Marketing Module (module: `marketing`, blog only)

Social module and Marketing dashboard/ads/email/recipients were removed 2026-10-22; `social` is in `PM_CORE_DEPRECATED_MODULES`.

- [x] `/project/:id/marketing` (index) — redirects to `blog`
- [x] `/project/:id/marketing/blog` — Blog list
- [x] `/project/:id/marketing/blog/create` — Create blog post
- [x] `/project/:id/marketing/blog/:blogId` — Edit blog post
- [x] `/project/:id/marketing/settings` — Blog API connection wizard

### 4.2 Accounting Module (module: `accounting`)

- [x] `/project/:id/accounting` — Accounting placeholder / module entry

---

## 5) Error & Fallback Routes

- [x] `*` — Catch-all: redirects to `/`
- [x] Error boundary page — Rendered when route errors occur (global error handler) (SCSS + i18n pass)

---

## Landing (getprojectflow.com, separate app in `landing/`)
Static pages rendered at build time from `landing/src/templates/pages.ts` (Firebase site `getprojectflow`, cleanUrls):
- `/` (DE) · `/en` (EN) — home: pinned story stage (6 acts), Für wen (#teams), Apps (#apps), KI & MCP (#mcp), Funktionen (#more), Preise (#pricing, planned prices – see brain/plans/pricing-strategy.md), FAQ, CTA
- Legal: no texts in the landing. `LEGAL_SOURCE` in `landing/src/templates/pages.ts`: `app-link` links to `app.getprojectflow.com/legal/<type>`; `api` (current since 2026-10-23) builds `/impressum` · `/en/imprint`, `/datenschutz` · `/en/privacy`, `/agb` · `/en/terms` as shells that load `GET /api/legal/<type>?lang=` (`landing/src/js/legal.ts`). Source texts: `legal/<type>.<lang>.md` (imported as drafts by `functions/scripts/import-legal-docs.mjs`)
- `/docs/mcp` · `/en/docs/mcp` — public MCP guide (`landing/src/content/docs-mcp.ts`, template `docs.ts`); server URL constant `MCP_URL` in `landing/src/templates/pages.ts`. Linked from nav, footer and the AI section. Keep in sync with `brain/operations/mcp-install-guide.md` and `web/components/settings/aiClients.ts`.
- `404.html` — bilingual not-found
- `/sitemap.xml`, `/robots.txt`, `/og-de.png`, `/og-en.png`
- `/kaufen` · `/en/buy` — own purchase page (Stripe Payment Element, inline Firebase Auth; `noindex`). Flow and contract: `brain/plans/landing-purchase.md`.

CTAs point to the app (Personal/Team pricing CTAs to `/kaufen`): `/register`, `/login`, `/download`. Concept: `brain/plans/landing-page-concept.md`.

## Notes / Migration Considerations

- Tailwind -> SCSS migration: audit complete; shared component refactor in progress; keep the Tailwind CDN until remaining utility classes are replaced.
- `/register` currently points to the same component as `/login` in the old implementation.

---

## 6) Shared Components (SCSS migration tracker)

- [x] web/components/PinnedTasksModal.tsx - Pinned tasks modal (SCSS)
- [ ] web/components/SettingsModal.tsx - App settings modal (legacy UI)
- [x] web/components/MediaLibrary/MediaLibraryModal.tsx - Media library modal (SCSS)
- [ ] web/components/GroupCreateModal.tsx - Group create modal
- [ ] web/components/InviteMemberModal.tsx - Invite member modal
- [ ] web/components/EditTaskModal.tsx - Edit task modal (legacy UI)
- [ ] web/components/project/ProjectReportModal.tsx - Project report modal
- [ ] web/components/project/HealthDetailModal.tsx - Project health detail modal
- [ ] web/components/ProfileSettingsModal.tsx - Profile settings modal
- [ ] web/components/onboarding/OnboardingWelcomeModal.tsx - Onboarding welcome modal
- [ ] web/components/modals/PasskeySetupModal.tsx - Passkey setup modal
- [ ] web/components/modals/TwoFactorChallengeModal.tsx - 2FA challenge modal
- [ ] web/components/modals/TwoFactorSetupModal.tsx - 2FA setup modal
- [x] web/components/InitiativeCreateModal.tsx - Initiative create modal
- [x] web/screens/ProjectInitiatives.tsx - Initiative list page
- [x] web/screens/ProjectInitiativeDetail.tsx - Initiative detail page (includes explicit focus action)
- [ ] web/components/ui/Modal.tsx - Legacy modal base
- [ ] web/components/ui/GlobalConfirmationModal.tsx - Legacy global confirmation
- [x] web/components/common/Modal/Modal.tsx - Common modal base (SCSS)
- [x] web/components/common/Modal/ConfirmModal.tsx - Common confirm modal (SCSS)
- [x] web/components/common/Modal/SettingsModal.tsx - Common settings modal (SCSS)
- [x] web/components/TaskCreateModal.tsx - Task create modal (SCSS)
- [x] web/components/CreateIssueModal.tsx - Issue create modal (SCSS)
- [x] web/components/EditIssueModal.tsx - Issue edit modal (SCSS)
- [x] web/components/sprints/CreateSprintModal.tsx - Sprint create modal (SCSS)
- [x] web/components/sprints/SprintDetailsModal.tsx - Sprint details modal (SCSS)
- [x] web/components/Milestones/MilestoneModal.tsx - Milestone create/edit modal (SCSS)
- [x] web/components/Milestones/MilestoneDetailModal.tsx - Milestone detail modal (SCSS)
- [x] web/components/project/ProjectEditModal.tsx - Project edit modal (SCSS)
- [x] web/components/ProjectLabelsModal.tsx - Project labels modal (SCSS)
- [x] web/components/CreateProjectModal.tsx - Project create wizard modal wrapper (SCSS, preserves existing wizard scale)

---

- [x] `/workspace` — redirects to `/` (2026-09-27). Workspace settings are a modal: `SettingsModal scope="workspace"` (tabs Workspace, Members, Roles, Email & storage, API & MCP, Danger zone; sections in `components/settings/WorkspaceSettingsPanel.tsx`). Entry: sidebar workspace menu → "Workspace settings". Personal settings (profile menu) only show Account, Preferences, Security, Pre-Alpha.

## Admin Console (`admin/`, own app — not part of `web/`)

Separate Vite/React app, hosting site `projectflow-admin` (later `admin.getprojectflow.com`). Platform admin only;
auth chain and modules: `brain/plans/admin-console-concept.md`. All data via the callable `adminApi`. Routes (`admin/src/App.tsx`):

- `/` — overview: users (total, DAU/WAU/MAU, signups), workspaces, projects/tasks, crashes, AI cost estimate, MCP connections, terms acceptance, client versions; 7/30/90 days
- `/users` (`?uid=` opens the drawer) — all Auth accounts; drawer: account, workspaces, devices/passkeys, AI usage + connections, consent, activity; actions: data export, revoke sessions, lock/unlock (confirm + audit)
- `/workspaces` (`?id=`) — all tenants with plan/status/MRR (billing contract §6); drawer: members, projects, Abo (Stripe link; "intern" via `setBillingExempt`), Flows, Sperre, AI policy (editable), machine writes, MCP grants, API tokens, activity
- `/ai` — AI & MCP: usage/cost per user and workspace, all grants (disconnect), OAuth clients, API/MCP request log
- `/system` — announcement banner, Cloud Scheduler jobs, functions, hosting releases, AI pricing for the estimate, AI limits
- `/crashes`, `/crashes/:id` — crash issues (trend, platform/release/status filter, stack, events, releases/devices, triage)
- `/legal`, `/legal/:type` — legal documents (overview with acceptance rate + mail status; draft editor DE/EN, diff to current version, publish)
- `/onboarding` — onboarding survey aggregates
- `/blog`, `/blog/:id` (`new`) — platform blog `blog_posts` + categories
- `/newsletter` — leads: newsletter subscribers/pending/legacy, waitlist, contact form (audited read, delete)
- `/audit` — admin audit log
- Shell: ⌘K palette (pages, actions, user search), `g <key>` navigation, j/k + Enter in tables, ⇧D theme.

