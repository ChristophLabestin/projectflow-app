# Handoff

Last updated: 2026-10-23

## Orchestrator-Stand 2026-10-23

Ab jetzt steuert eine Orchestrator-Session das Projekt und verteilt Arbeit an Sub-Sessions.
Alle Worktree-Branches sind in main (zuletzt `claude/happy-feistel-97d47f` = iPhone Duo, iOS-Build grün);
alle ProjectFlow-Sessions archiviert. Rohe Handoffs je Session: [handoffs/2026-10-23-sessions.md](./handoffs/2026-10-23-sessions.md).

Offene Punkte (konsolidiert):
- **Rechtstexte/Zustimmung (2026-10-23, live):** versionierte Rechtsdokumente + Zustimmungs-Gate (Web/Desktop), Admin `/admin/legal`, Mail-Jobs, iOS-Vertrag `plans/legal-consent-contract.md` (iOS-Gate offen), Anleitung `operations/legal-documents.md`. Offen: rechtliche Prüfung Zustimmungs-Wortlaut, SMTP-Tageslimit, Mail-Footer „Project Flow Inc., San Francisco“ in `getSystemEmailTemplate`.
- **Flows / Automationen (2026-10-23, live):** Regel-Baukasten Wenn → Falls → Dann auf dem Ereignisstrom (`functions/src/automations.ts`, `automation-logic.ts`), `/flows` + `/project/:id/flows`, 11 Vorlagen, Vorschau/Testlauf, Protokoll + Retry, Auto-Pause, Schleifenschutz (Tiefe 3). Konzept `plans/flows-concept.md`; Tests `npm run test:automations` (Emulator-Ports 9831/8831/5831). Offen: Webhooks rein/raus, Canvas, Verzweigungen, MCP-Tools `list_flows`/`run_flow`, Admin-Schalter für `automationPolicy.allowMemberFlows` (aktuell nur per Firestore), Tarif-Kontingente.
- **User-Aktionen:** GitHub-Secrets für Hosting-Auto-Deploy (`FIREBASE_SERVICE_ACCOUNT_PROJECTFLOW_LABESTIN`/`firebaseServiceAccount`, `VITE_FIREBASE_*` vom neuen Projekt) — bis dahin Hosting lokal deployen; Owner-E-Mail für `node functions/scripts/grant-platform-admin.mjs`; ASC App-Review-Kontakt + Demo-Konto; Paid-Apps-Agreement; `.p8`-Keys aus `~/Downloads` sicher ablegen, alten APNs-Key Q763AAXUZL widerrufen; Signing-Secrets in `~/ProjectFlowSigning` sichern; Passkey-Login real in Prod testen; Gemini-Key aus `1095e0bb` rotieren falls gültig.
- **iOS:** TestFlight: Build 4 hochgeladen (2026-10-23); nächster Upload braucht `CURRENT_PROJECT_VERSION` 5; Push in TestFlight prüfen (aps-environment); Google/GitHub-Login, Uploads, TOTP, Sprints real testen; iPhone Duo aufgeklappt/halbgefaltet manuell prüfen; ungenutzte Strings (`auth.name`, `welcome.mode.*`, `login.*fullName`).
- **Desktop:** System-Browser-OAuth-Handoff; Windows-Test + Code-Signing; Mitteilungen ignorieren Push-Kanal-Einstellungen; `--verify-tag`-Fix erst beim nächsten Tag getestet; DMG unsigniert.
- **Security/Backend:** CSP von Report-Only scharf schalten; RTDB-Presence ohne Membership-Check; npm audit (`nodemailer` Major, `@grpc/grpc-js`); Functions-Cold-Start (index.ts lädt alles); `nudgeLog`-Lesekosten beobachten; kein Staging-Projekt; Tailwind parallel zu SCSS.
- **Tooling:** Token-Guard-Screenshot-Verkleinerung in neuer Session prüfen; Nachmessung ~2026-11-06 (`analyze.py --since 14`); AGENTS.md-Satz „No root test runner“ veraltet.
- **Billing (2026-10-23, Test-Modus):** Free/Team mit Entitlements (`tenants/{t}/entitlements/plan`), Regeln + Functions-Durchsetzung, 14-Tage-Test für neue Workspaces, Grace für die 5 Bestandsworkspaces (backfilled), Billing-Tab in den Workspace-Einstellungen. Live: Regeln, `onTenantCreatedBilling`, `onProjectCountBilling`, `billingSweep`, `personalAiKey`, Einladungs- und KI-Callables, `aiAssist`. **Offen:** Owner setzt `STRIPE_SECRET_KEY` (sk_test) → `node functions/scripts/stripe-setup.mjs` → `STRIPE_WEBHOOK_SECRET` → `createBillingCheckout`, `createBillingPortal`, `stripeWebhook`, `onMemberWrittenBilling` deployen → Test-Checkout E2E. Automations/Insights-Functions übernehmen das KI-Gate erst beim nächsten Deploy. Owner-Entscheidungen: Stichtag `admin_config/billing.cutoverAt`, USt./OSS, Live-Keys, AGB/Datenschutz, Gründungspreis, Organization/SSO. Plan: [plans/billing-implementation.md](./plans/billing-implementation.md).
- **Tracking:** ProjectFlow-Tasks für Duo, Passkey u. a. fehlen noch. Billing-Initiative ebenfalls nicht angelegt (`PROJECTFLOW_API_TOKEN` fehlt).

## Where Things Stand

**2026-10-23 update — iOS app built.** `ios/` holds the complete new app (see `ios/README.md`, concept `brain/plans/ios-app-concept.md`, contracts `brain/plans/ios-implementation-contracts.md`). Verified in the simulator against `scripts/dev-e2e.sh`: login, Today, Work (list/week, drag to plan), task detail, native push/swipe-back, native sheets, custom nav bar. Production already runs the iOS backend (triggers, reminders, nudges, Live Activity push, passkey native origin, AASA applinks) and the web follow-ups. Next: owner decisions/actions listed in current-focus, then device testing and TestFlight.

**2026-10-22 update — iOS reset.** The previous native app under `swift/` was removed completely (1,454 tracked files incl. committed build output) together with its Brain docs. No iOS project exists in the repo now; `scripts/check-retention-provisioning.sh` skips iOS source-entitlement checks until a new project exists. `web/public/.well-known/apple-app-site-association` and the APNs payload in `functions/src/notifications.ts` were kept on purpose (reusable by the new app). The new app is conceived from scratch in [plans/ios-app-concept.md](./plans/ios-app-concept.md); nothing is implemented yet.

**2026-09-26 update.** ProjectFlow now targets the Firebase project `projectflow-labestin`. Tenancy is multi-workspace:
- random tenant ids;
- `members` docs as the only access source;
- Owner/Admin/Member/Guest roles;
- email or link invitations accepted by the `acceptWorkspaceInvite` function.

My Tasks and Project Tasks use the shared grouped work list in `web/components/work/`. All of this is verified in local emulators (`scripts/seed-emulator.mjs`, `npm run dev:emulator`) and deployed to production on 2026-09-26 (commit `282abaa3`). Uncommitted user WIP in `AppLayout`, `TopBar`, `ProjectOverviewPage`, `ProjectHero`, `ProjectTaskDetail` and `Team` was left intact; `Team.tsx` was additionally migrated to the invitation model and i18n.

The repository has been migrated into `/brain`, the active Web/Swift removal path for Flows/Ideas and Issues remains in place, and project task detail now has a Full Workbench redesign.

## What Changed Recently

- 2026-10-23: **Wiki & Docs live** (`/wiki`, `/project/:id/wiki`; concept `plans/wiki-concept.md`). Tiptap editor (slash, @-mentions with live chips, tables, checklists, callouts, toggles, task-list embeds, TOC, file blocks via the Files manager), autosave + `bodyRev` conflict guard + presence (no real-time co-editing, reasons in the concept), versions, templates, trash, task links/backlinks, global search, AI capabilities `wikiSummarize/wikiImprove/wikiExtractTasks`, events `doc.*` via `onWikiDocWritten`. Open: AI not tested live (no OpenAI key locally); drag & drop only unit-tested; real-time co-editing; iOS reader; MCP tools (`search_docs`, `get_doc`, `create_doc`, `update_doc`, `link_doc_to_task`) for the AI session.
- 2026-10-23: Notification Center fixed (portaled bell popover; it was clipped by the sidebar) and extended (filters, groups, per-row actions, other-workspace unread, localized copy via `params`; triggers for status/due changes, overdue, project membership). Notifications are now server-created and recipient-only in the rules. Details: COMPONENTS.md "Notification Center", FIRESTORE_STRUCTURE.md `notifications`, GOTCHAS 2026-10-23.
- Added project/task reminders for operational follow-ups. `ProjectReminder` now lives on `Project.reminders` and `Task.reminders`; task `reminderAt` is kept as the earliest open task reminder for legacy compatibility. Project Overview V2 shows a merged reminder strip with project reminders, task reminders, and legacy `reminderAt` values, with create/complete/delete actions and optional Task/Initiative links. Task detail now supports multiple reminders instead of a single reminder date. Build and theme lint pass; authenticated write/visual QA remains pending. ProjectFlow tracking could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- Created app-type Brain core files.
- Moved former root product, route, styling, permission, Firestore, mobile, privacy, and agent docs into `brain/reference/app/`.
- Moved old planning docs into `brain/plans/`.
- Moved provisioning and Codex API docs into `brain/operations/`.
- Moved audit docs into `brain/audits/`.
- Moved `web/docs/COMPANY_PROJECTS_PLAN.md` into `brain/web/`.
- Updated root `README.md`, `AGENTS.md`, and `GEMINI.md` to point contributors into `brain/`.
- Updated `swift/README.md` to reference migrated Brain paths.
- Verified local Markdown links resolve.
- ProjectFlow tracking was attempted but failed because `PROJECTFLOW_API_TOKEN` is missing.
- Updated PM-core config so only `ideas`/`flows` and `issues` are deprecated.
- Removed PM-core redirects from Milestones, Social, and Marketing project routes.
- Added Accounting to project sidebar navigation when the module is enabled.
- Updated PM-core tests and docs.
- Removed remaining Web imports of deleted Flow/Issue components, modals, locale chunks, and domain services.
- Removed global Flow/Issue create shortcuts, search result sections, Project Settings module toggles, Project List Flow/Issue counters, and Health scoring factors for Flow/Issue data.
- Filtered legacy pinned issue items out of the focus/pinned context and removed visible Swift pinned copy that still mentioned issues.
- Verified the Swift project no longer references deleted Flow/Issue view/store files.
- Redesigned `web/screens/ProjectTaskDetail.tsx` into a Task Full Workbench with an open header, single command rail, Work/Discussion/History tabs, next-step/blocker/reminder/quick-log task fields, flatter screenshot-aligned main work area, subtasks table, comments/history tabs, labels/dependencies/milestone/context/details/activity inspector sections, and focus/pin/edit/delete actions.
- Added optional `Task` metadata fields: `nextStep`, `blockerNote`, `reminderAt`, and `lastWorkbenchNote`.
- Rebuilt `web/src/styles/components/_project-task-detail.scss` around the screenshot-like open layout with less card nesting.
- Updated task-detail i18n keys and Brain route/styling/Firestore references.
- Fixed the Project Overview V2 hero More actions menu clipping by allowing `.po-hero` overflow while keeping the cover image clipped to the hero's top radius.
- Added `TaskRelationshipsPanel` to task detail with blocked-by, is-blocking, parent task, and child task links. `dependencies` remains the blocked-by source of truth, inverse blocking links are derived from other tasks, `parentTaskId` stores task hierarchy, and blocked-by/is-blocking adds automatically set the blocked task to `Blocked`.
- Removed visible element borders and border-like shadows within both Project Overview V2 and legacy overview roots, including page-launched portal modals.
- Removed the duplicate Project Overview Kanban view and made Board the single status-column view. Old `kanban` preferences fall back to `board`; Board now uses compact dark rounded lanes, pill headers, count badges, centered empty states, and standard status colors across Project Overview V2, legacy overview workspace, sprints board, and the shared Project Tasks board.
- Fixed Board dark-mode surfaces rendering white, then tuned the palette back to the app's card surfaces: lane/header surfaces use `--color-surface-card`, entries use `--color-surface-hover`, and hover states use `--color-surface-hover-light`.
- Fixed task detail subtask delete confirmation responsiveness by using explicit button types in the shared confirm modal and adding subtask-delete loading/error handling plus popover cleanup.
- Fixed task detail "not found" cases caused by missing/stale tenant context by resolving the project first and reusing the project's canonical tenant for task, subtask, member, activity, milestone, and initiative lookups.
- Fixed global topbar search missing project-name results in project context by passing the current project's canonical tenant into `AISearchBar`, using it for local and CORA search calls, attaching `tenantId` to search results, and preserving that tenant on project/task/initiative navigation.
- Added a GitHub migration/sync path: `scripts/import-github-issues-to-projectflow.mjs` imports GitHub Issues as ProjectFlow tasks with GitHub Projects v2 field snapshots; `onProjectTaskGitHubSync` creates GitHub Issues for new non-imported ProjectFlow tasks and patches linked GitHub Issues on task title/description/status changes. ProjectFlow task `5m5051ZLHm8lVrVmaDsv` and Codex session `R9kc2300qrYUSH67UQ5y` track this work.
- Redesigned the sidebar `ProjectSwitcher`: tokenized SCSS replaces inline utility styling, the trigger shows richer project/workspace context, the dropdown now has workspace entry, quick access for current/pinned projects, grouped company/workstream and other project sections, search across title/status/company context, Escape/outside-click close handling, and corrected owner/member role detection.
- Analyzed ProjectFlow as a project-management product and identified missing PM-manager capabilities to turn it from a strong task/workbench app into a reliable planning/control system: portfolio roadmap, capacity planning, acceptance criteria, risk/decision/change control, stakeholder reports, baseline/scope variance, recurring review rituals, release/QA gates, reusable templates, escalation/reminders, analytics, and dependency/critical-path views. Created ProjectFlow initiative `HbtRa4Yhd3RUwerFarOc` and 12 linked execution tasks for the findings.

- Rebuilt the personal Dashboard as a two-step editorial home ("Tagesband + Route" design): adaptive statement headline, segmented day band, route-to-end-of-day with reasons/payoffs and focus action, overnight activity log, project signal rows, accent insight; second scroll step keeps the portfolio pulse (attention chips, honest completions momentum, horizon, wins). New i18n keys under `dashboard.route/band/week/night/projectsRail/accent.*`; obsolete `dashboard.today.statement/stat/plan/delta/upcoming` keys removed. `web && npm run build` and `npm run lint:theme` pass; authenticated visual QA still pending (login redirect in preview).
- Expanded `/ui` with standards still missing from the UI library: checkbox examples, toggle examples, max-width container categories, and ProjectFlow-specific Level of Depth guidance. The six follow-up candidates are now first-version shared primitives with live `/ui` demos: `ListToolbar`, `EmptyState`, `Skeleton`/`SkeletonBlock`, `InlineEditCell`, `FilterMenu`, and `Stepper`. `cd web && npm run build` and `cd web && npm run lint:theme` pass; authenticated visual QA and ProjectFlow tracking remain pending.

## Next Best Move

Check the UI in an authenticated browser session on a real project: create project-level reminders, task-linked reminders, and initiative-linked reminders from Project Overview; complete/delete them; then open `/project/:id/tasks/:taskId` and verify multiple task reminders sync back to the Overview strip. Also repeat the pending task-detail workbench QA and topbar project-name search QA.

## Watchouts

- Do not treat `brain/plans/` as automatically implemented state.
- Do not invent a ProjectFlow task id for this migration; create the real record once credentials are available.
- ProjectFlow tracking for the PM-core fix also failed because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the Task Full Workbench redesign also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the Project Overview menu clipping bugfix also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the task relationships expansion also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the Project Overview border removal also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the Project Overview board-view redesign also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for removing the duplicate Kanban view and consolidating Board also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the subtask delete confirmation bugfix also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the task detail tenant-context loading fix also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the global search project-name lookup fix also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the sidebar Project Switcher redesign also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the UI Style Guide standardization expansion also could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- ProjectFlow tracking for the project/task reminders feature could not be created because `PROJECTFLOW_API_TOKEN` is missing.
- Playwright unauthenticated route QA redirects task detail URLs to `/login`; build/theme validation passed, but real task visual QA still needs an authenticated session.
- In-app Browser unauthenticated QA for Project Overview board visuals redirects to `/login`; `cd web && npm run build` passed, but real board visual QA needs an authenticated project session.
- In-app Browser QA for the Project Switcher reached the login screen at `http://127.0.0.1:5173/`; build and theme validation passed, but the dropdown interaction still needs an authenticated sidebar session.
- `web/.vite/deps/_metadata.json` is a dev-server cache change; avoid mixing it into a source commit unless intentionally tracking cache state.
- Some legacy type fields, i18n keys, docs, Firestore collection constants, and GitHub API "issues" terminology still exist where they are compatibility data, historical documentation, or GitHub-native vocabulary rather than active ProjectFlow issue-module UI.
- GitHub Issues should now map to ProjectFlow tasks, not the deprecated ProjectFlow Issues module. Use `brain/operations/github-projectflow-sync.md` for the import/sync commands and token requirements.
