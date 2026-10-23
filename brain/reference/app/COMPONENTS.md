# brain/reference/app/COMPONENTS.md — Reusable UI Components Index (Authoritative)

This file is the **authoritative index** of reusable UI components available in this repository.

Rules:
- Prefer reusable components over one-off UI implementations.
- All reusable components must follow tokens and rules defined in `brain/reference/app/STYLING.md`.
- When a new reusable component is introduced, it **must be added to this index**.

---

## Core UI Primitives

| Component | Purpose | Typical Usage | Notes |
|---|---|---|---|
| `Button` | Primary/secondary/ghost/danger styles | Actions, forms | Supports `sm`, `md`, `lg`, `icon` sizes. Loading state + optional icon support. |
| `IconButton` | Compact icon-only button | Toolbars, inline actions | Must include tooltip/aria-label support |
| `Card` | Standard surface container | Dashboards, lists, panels | Includes `CardHeader`, `CardBody`, `CardFooter`. |
| `Badge` / `Tag` | Status + labeling | Priority, states, categories | Variants: `neutral`, `success`, `warning`, `error`. `components/ui/Badge` variants (`primary`, `secondary`, `success`, `warning`, `error`) map to theme tokens only. |
| `Avatar` | User/brand avatar | Member lists, headers | Fallback initials + optional image |
| `Divider` | Visual separation | Layout sections | Uses surface border token. |
| `Tooltip` | Hover help | Dense UI actions | Avoid for mobile-only reliance |

---

## Inputs & Form Building

| Component | Purpose | Typical Usage | Notes |
|---|---|---|---|
| `TextInput` | Standard text input | Forms, filters | Supports error/help text, left/right adornments (icons/buttons) |
| `TextArea` | Multi-line input | Descriptions, notes | Matches `TextInput` styling. Supports label, error, help text. |
| `Select` | Single select dropdown | Plan selection, enums | Custom UI with Portal rendering. Keyboard accessible. |
| `MultiSelect` | Multi-select control | Labels, members | Searchable recommended |
| `Checkbox` | Boolean multi-choice | Forms, filters, batch selection, opt-in confirmation | Standardized in `/ui`; use when choices are independent or multiple values can be selected. |
| `Switch` | Boolean toggle | Settings and immediately applied on/off preferences | Standardized in `/ui`; use when the setting takes effect immediately. |
| `RadioGroup` | Exclusive selection | Onboarding/config | |
| `DatePicker` | Date selection | Due dates, scheduling | Month/Year navigation, clearable, custom formats |
| `TimePicker` | Time selection | Schedules, appointments | Manual input + selection defaults, clearable |
| `DateTimePicker` | Date & Time selection | Deadlines, events | Unified ISO-like value, clearable |
| `SearchInput` | Search field | Lists and navigation | Debounced optional |
| `PrioritySelect` | Priority picker | Task/ticket priorities | Dropdown or Group (radio) variants, visual priority indicators, dark mode support |
| `FormField` | Layout wrapper | All forms | Standard label/help/error layout |

---

## Navigation & Layout

| Component | Purpose | Typical Usage | Notes |
|---|---|---|---|
| `TopBar` | Global header | Search, user menu, breadcrumbs | Consistent layout and spacing |
| `GlobalSearch` | ⌘K / `/` command palette in the TopBar (`web/components/search/GlobalSearch.tsx`, matching in `web/utils/globalSearch.ts`) | Global navigation and quick actions | No AI. Loads projects/tasks/initiatives once per open (60s cache, prefetched on trigger hover) and matches in memory: multi-word, diacritic-insensitive, fuzzy fallback, highlighted hits. Scope tabs (Tab cycles) and prefixes `>` actions, `#` projects, `!` tasks, `?` help; task filters `is:open|done|overdue|today|mine`, `prio:urgent|high|medium|low`. Empty state: recently opened + recent searches (localStorage per user), actions, pages, tips. ⌘/Ctrl+Enter opens in a new tab. Current project's hits rank higher. Styles in `_global-search.scss`. |
| `SidebarNavigator` | Main navigation (`components/SidebarNavigator.tsx`; the old `Sidebar`/`WorkspaceTeamIndicator` were removed 2026-10-23) | Tenant navigation | Collapsible behavior; project resources can show restricted/advisor-review signals and are filtered by resource role metadata when configured. |
| `DesktopTitleBar` | Window title bar of the desktop app (`web/components/desktop/`) | Mounted by `RootLayout` when `isDesktop()` | Drag region hosting the native window controls (macOS traffic lights in the left inset, Windows `titleBarOverlay` caption buttons on the right, menu button for the app menu). `inline` mode (authenticated shell, content offset via `--app-viewport-height` / `#root` padding) or `overlay` (public routes). Renders nothing in the browser. Styles in `_desktop.scss`. |
| `DesktopBridge` | Glue to the Electron shell (`web/components/desktop/DesktopBridge.tsx`) | Mounted once in the main desktop window | Routes menu/tray/deep-link commands, pushes language, theme colors, tray snapshot (focus + pins), badge count and native notifications (baseline snapshot, active tenant only). Bridge access and capability checks live in `web/services/desktop.ts`. |
| `DesktopSettingsPanel` | Settings → Desktop app (`web/components/settings/DesktopSettingsPanel.tsx`) | `SettingsModal` tab `desktop`, only with the bridge capability `preferences` | Launch at login, global shortcuts (key recorder), day start/close, calendar, macOS Shortcuts for focus mode, media key. Values live in the shell (`getPreferences`/`setPreferences`), not Firestore. Reuses the `notification-settings` card styles. |
| `AiIntegrationsPanel` | Settings → AI & integrations (`web/components/settings/AiIntegrationsPanel.tsx`, recipes in `aiClients.ts`) | Workspace `SettingsModal` tab `ai` (all members; deep link `?openSettings=ai`) | Client tiles with steps/snippet/one-click install (Claude, Claude Code, ChatGPT, Codex, Cursor, VS Code, Gemini CLI, other), connected apps with disconnect, personal access tokens, workspace AI policy (Owner/Admin edit), AI activity log (Owner/Admin). Styles `web/src/styles/components/_ai-settings.scss`; code blocks reuse `.mcp-connect__code`. |
| `OAuthConsent` | OAuth consent screen (`web/screens/OAuthConsent.tsx`) | Route `/oauth/consent` | Workspace picker with policy state, scope checkboxes (delete scopes off by default / blocked by policy), unverified-client warning, returns to the client via `approveOAuthConsent`/`denyOAuthConsent`. |
| `DesktopAppPromo` | Desktop app promo card, inverted (primary gradient, OS-mark watermark, pill CTA) (`web/components/desktop/DesktopAppPromo.tsx`, styles `.desktop-promo` in `_desktop.scss`) | `SidebarNavigator` above the project dock (hidden in the collapsed spine), browsers on macOS/Windows only | Shown once the latest release has the installer for the OS (`services/desktopDownloads.ts`, GitHub API cached 6 h); links to `/download`; × = remind later (30 days, `pf_desktop_promo_until`), "Don't show again" = permanently (`pf_desktop_promo_never`). The user menu has a matching "Get the Mac/Windows app" link. |
| `Breadcrumbs` | Single trail in the top bar pill (back arrow one level up + path + current page) | `TopBar`, items from `utils/breadcrumbs.ts` (`buildBreadcrumbs`, the one route table; unit-tested) | Renders nothing below 2 items; top-level pages have no trail and the desktop context pill hides (`--no-crumbs`). Phones: back arrow + current page only. Pages never render their own breadcrumbs; detail pages pass their entity title via the outlet `setTaskTitle`. |
| `PinnedProjectPill` | Current pinned project shortcut and menu | Top bar project quick access | Uses portal-rendered fixed dropdown with health, project module stats, quick create actions, and project navigation. |
| `PinnedTasksModal` | Quick-access focus workspace | Top bar focus pill, dashboard resume action, pinned task/issue/initiative shortcuts | Uses persisted `focusState` with start, snooze, block, and complete controls. |
| `Notifications` diagnostics card | Notification delivery verification | `/notifications` delivery health panel | Registers web push, sends a self-test notification, and shows recent `notificationDeliveryLogs`. |
| `Tabs` | Section switching | Settings, modal tabs | Keyboard-accessible |
| `DropdownMenu` | Menus | Action menus, user menu | |
| `CommandPalette` (optional) | Quick navigation/actions | Power user flows | |
| `ListToolbar` | Shared search/filter/action row | List and table pages | V1 primitive in `web/components/common/ListToolbar`; first demo in `/ui`. Add sorting when a consuming screen needs it. |
| `FilterMenu` | Compact filter dropdown | Dense lists, tables, work queues | V1 primitive in `web/components/common/FilterMenu`; use instead of ad-hoc chip clusters when filters need a panel. |

---

## Feedback & Overlays

| Component | Purpose | Typical Usage | Notes |
|---|---|---|---|
| `Modal` | Standard modal dialog | Forms, pickers | Focus trap + escape handling; header close button is the material `close` icon with `common.close` label. |
| `Drawer` | Side overlay | Mobile/detail panels | |
| `ConfirmDialog` | Destructive confirmations | Deletes, irreversible actions | |
| `Toast` / `Notifications` | Non-blocking feedback | Success/error/info | |
| `EmptyState` | No data guidance | Empty lists | V1 primitive in `web/components/common/EmptyState`; supports icon, copy, optional actions, and compact mode. |
| `StatusCard` | Status messaging panel | Invite flows, async states | Variants: `info`, `success`, `error`. Optional icon + extra actions. |
| `InitiativeCreateModal` | Lightweight initiative creation modal | Project overview, project tasks, initiative list | Focuses on title, description, status, priority, and dates. |
| `InitiativeFeedbackModal` | Build and configure public initiative feedback intake | Initiative detail | Task-modal-style form editor with title/description first, compact Questions/Share toolbar, fully customizable default and custom fields, inline row editing, schema validation, opt-in preview, and hosted/embed access controls. |
| `CreateProjectModal` | Global wrapper for the full project creation wizard | Sidebar, project switcher, projects list, `/create` deep link | Uses the existing wizard layout without resizing it. The wizard favors low-friction creation: method, compact type selection, then required details with a single project purpose field; optional company-project assignment for normal projects, company-project setup workstreams as a quiet checklist step with sensitive-track confirmation, optional success criteria plus cadence, operating mode in the timeline step, and optional finish assets/links. Company-project founding context is completed after creation from the project overview. |
| `ProjectOverview` company command surface | Action-first Unternehmensprojekt overview | `/project/:id` for company/startup projects | Replaces the old text-heavy founding cockpit with one founder action, launch-readiness meter, a compact workstream summary that opens a modal/drawer task inspector, company context with a dedicated founding-brief modal, source links, and linked-project rollups using the same neutral Project Overview surface language. |
| `Skeleton` | Loading placeholder | List/table loading | V1 primitive in `web/components/common/Skeleton`; includes single blocks and a composed `SkeletonBlock`. |
| `InlineEditCell` | Reusable read/edit state | Task tables, settings rows, metadata fields | V1 primitive in `web/components/common/InlineEditCell`; supports save/cancel labels for i18n. |
| `Stepper` | Flow progress and setup steps | Creation flows, onboarding, setup checklists | V1 primitive in `web/components/common/Stepper`; supports complete/current/upcoming/error states and optional click handling. |

### `StatusCard`

Purpose: Highlight a single status with icon, title, optional message, and optional actions.

Props (high-level):
- `title` (string)
- `message` (string, optional)
- `icon` (ReactNode, optional)
- `tone` (`info` | `success` | `error`)
- `className` (string, optional)
- `children` (ReactNode, optional, for actions)

Example usage:
```tsx
<StatusCard
  title={t('joinProjectLink.successTitle')}
  message={t('joinProjectLink.successMessage')}
  tone="success"
  icon={<span className="material-symbols-outlined">check_circle</span>}
>
  <Button variant="secondary">{t('joinProjectLink.openProject')}</Button>
</StatusCard>
```

---

## Data Display

| Component | Purpose | Typical Usage | Notes |
|---|---|---|---|
| `DataTable` | Tabular display | Members, tasks, projects | Sorting/paging optional |
| `ListRow` | Consistent list item | Tasks, projects | |
| `KeyValue` | Small metadata block | Details pages | |
| `TaskRelationshipsPanel` | Task-to-task relationship editor | Project task detail inspector | Uses `dependencies` for blocked-by links, derives is-blocking links from inverse dependencies, edits `parentTaskId` for task hierarchy, and auto-marks blocked tasks as `Blocked`. |
| `ProjectCodex` | Project-level Codex session and follow-up surface | `/project/:id/codex` | Subscribes to `codex_sessions` and `codex_followups`, uses shared `Button`, tokenized SCSS, and i18n strings. |
| `ProjectTriageModal` | Project-level task cleanup and delegation workflow | Conditional `/project/:id` right-column triage card | Filters overdue/blocked/unassigned/near-term tasks, then supports bulk due-date, status, completion, and team assignment updates from a calmer triage workbench. |

---

## Finance Feature Components

| Component | Purpose | Typical Usage | Notes |
|---|---|---|---|
| `FinanceFunctionsWorkspace` | Dedicated operations control center for Finance V2 | `/finance/functions` | Includes operation catalog, tabs, run tray, and deep-link handling |
| `FinanceOperationWizard` | Guided operation execution flow | Operate tab in Finance Functions Workspace | Scope -> Preview -> Confirm -> Result, supports idempotent execution path |
| `FinanceOperationRunTimeline` | Step-level runtime inspection | Runs tab details panel | Shows lifecycle steps, warnings, artifacts, and timestamps |
| `FinanceOperationTemplatesPanel` | Save/reuse operation payload presets | Templates tab in Finance Functions Workspace | CRUD for tenant-scoped templates |
| `FinanceOpsAssistantPanel` | Explainable AI recommendations for ops actions | Insights tab in Finance Functions Workspace | Presents confidence/rationale and only suggests (no auto-execute) |

---

## Permission & Role UI

| Component | Purpose | Typical Usage | Notes |
|---|---|---|---|
| `PermissionGate` | UI guard wrapper | Hide/disable actions | Must respect `brain/reference/app/PERMISSIONS.md` |
| `RoleList` | Vertical role hierarchy list | Roles management UI | Must render ordered by `position` and enforce hierarchy constraints |

---

## Mandatory Asset Handling Component

### `MediaLibraryModal` (MANDATORY)

**Every file/image upload entry point in the UI must use `MediaLibraryModal`.**  
No feature should implement an isolated file picker/upload flow outside of this component.

#### Responsibilities
`MediaLibraryModal` is the unified asset entry point with the following features:

1) **Browse tenant assets**
- Lists all images/assets available to the tenant **that the current user is authorized to view**.
- Project pickers default to current-project media, but must expose a tenant-wide view that removes the project filter and groups assets by project plus an "Other" bucket for unscoped uploads.
- Supports search, folders/tags (optional), and basic metadata (uploader, created date).
- Must respect permissions and project/external access boundaries.

2) **Upload interface**
- Upload new assets into the tenant library (permission-gated).
- Supports drag-and-drop and standard file picker.
- Supports basic validation (file type/size) and progress UI.

3) **AI Image Generation tab**
- Generates new images via **Gemini 3.0 Flash Nano Banana** integration.
- Generated images are saved back into the tenant media library.
- Must respect AI permissions (`ai.image.generate`) and quota/overage entitlements.

4) **Free stock images (Unsplash) tab**
- Search and select free stock images from **Unsplash**.
- Selected images are imported into the tenant media library (with attribution metadata if required by policy).
- Must comply with the integration’s terms and API requirements.

#### Where it must be used
- Task attachments
- Blog assets
- Project/tenant branding/logo selection
- Any future feature requiring images/files

#### Output contract
- Returns one or multiple selected asset references (IDs/URLs + metadata) that calling components store as references.
- New uploads should persist managed file IDs (for example `fileId` / `*_FileId`) so signed download URLs can be refreshed via backend APIs.

---

## Workspace Settings Integration

### `SettingsModal` (Workspace file storage section)

- Exposes workspace-wide provider selection: `firebase`, `s3`, `googleDrive`.
- S3 setup includes endpoint/region/bucket/prefix/credentials and connection test.
- Google Drive setup uses OAuth connect/disconnect and folder binding state.
- Must show effective provider state (`activeProvider` vs resolved provider) so fallback-to-Firebase is explicit to admins.

---

## Work Lists (`web/components/work/`)

- `TaskRow`: one task with inline menus for status, priority, due date (quick picks + date input) and assignees (multi-select). It shows the project, subtasks and blocker note as meta. Rare or destructive actions stay in the task detail. Parse dates via `utils/taskDates.ts`.
- `TaskGroupList`: collapsible, count-labelled groups with per-list persisted collapse state (`storageKey`).
- `InlineMenu`: accessible popover menu (arrow keys, Enter, Escape, outside click) with optional multi-select (`selectedValues`), footer slot, per-option `shortcut` keys (shown as key hints) and `dividerBefore` separators. Use it for inline edits instead of new ad-hoc popovers.
- `workList.ts`:
  - `groupTasks` (group by due, status or assignee; completed work last; the due grouping is `utils/dueBuckets.ts`);
  - `summarizeDue` (header summary line);
  - `normalizeStatus` (`Todo` → `Open`).
- `useWorkMembers`: members of the active workspace for assignee menus.
- `TaskRow` accepts an optional `trailing` action slot (e.g. detach from initiative).
- `TaskRow` also takes `initiativeTitle` (shown as meta) and `variant="card"` for grid tiles (title clamped to 2 lines, controls pinned to the bottom). Grid tiles have no hover checkboxes: they only show while the list is selecting ("Select" chip or a Cmd/Shift-click).
- Selection (only `screens/ProjectTasks.tsx` uses it so far):
  - `useWorkSelection`: selected ids, explicit selection mode, Shift-range (in rendered row order via `listRef`, so collapsed groups are skipped), `setMany`, `clear`; keyboard `Esc` clears (only when focus is in `.work-page` or nowhere), `x` toggles the focused row.
  - `TaskRow` `selectable` renders a themed `role="checkbox"` (`.work-select-box`) in front of the done circle. It is hidden at rest and shows on row hover/focus, when selected or while the list is selecting; on touch (`hover: none`) only while selecting. `selectOnClick` (selection mode) makes a row click select instead of open; Cmd/Ctrl/Shift-click on a row always selects.
  - `TaskGroupList` `selection` prop adds a per-group select-all checkbox (mixed state) and the `is-selecting` list class.
  - `WorkBulkBar`: floating bar sticky to the bottom of the work page (no layout shift) with status, priority, due date, assignee (replaces assignees), optional initiative, delete and close; same `InlineMenu`s as a row. Icons only on mobile.
  - Toolbar "Select" chip toggles selection mode (the entry point on touch devices).
- `WorkMenuChip`: toolbar chip that opens an `InlineMenu` (icon, optional muted prefix, value, caret). Use it instead of a form `Select` in work toolbars: group-by on Project Tasks; project and priority filters on My Tasks (`active` = filter chip, muted while unset, highlighted while narrowing).
- `workMenuOptions.tsx`: shared option builders (`statusMenuOptions`, `priorityMenuOptions`, `dueMenuOptions`, `assigneeMenuOptions`), `DueDatePicker` footer, `WorkAvatar`, `UNASSIGNED_VALUE`; reuse them for any new work-list menu.
- Used by:
  - `screens/Tasks.tsx` (My Tasks);
  - `screens/ProjectTasks.tsx` (list and grid view: grid = `TaskGroupList layout="grid"` + `TaskRow variant="card"`, same groups, inline menus and selection; the legacy `TaskCard`/pill editor is gone);
  - the Project Overview list view (`components/project/overview/views/WorkViewList.tsx`, task-only work items);
  - the initiative detail work list.
- `InlineMenu` also powers the dashboard plan's reschedule action and the sidebar dock "+" create menu (New task `T` / New initiative `I` inside a project / New project `P`).
- `InlineMenu` is portaled with `z-index: 10000`, so it works inside modals (task modal overlay is 9999). Optional `header` slot (an element with `data-autofocus` gets focus on open — e.g. a search field) and `emptyLabel`. Escape closes only the menu, not a surrounding modal. Used for priority / status / labels in `TaskCreateModal` (labels: multi-select + search/create header + "Manage labels" footer).
- `MultiAssigneeSelector` portals its dropdown to `<body>` (fixed, positioned from the trigger, flips above when there's no room) so modals with `overflow: hidden` don't clip it.

## Planning (`web/components/planning/`)

- `timeScale.ts`:
  - `buildTimeScale` builds a linear day scale that always includes today;
  - `useBarDrag` drags bars with the pointer to move or resize them in whole days and commits ISO dates.
- `TimeScaleHeader` / `TimeScaleBackdrop`: month row plus days (with weekend and today marks) or ISO weeks; weekend stripes and the today line.
- `stagger.ts`: stacks overlapping milestone labels into rows.
- `ProjectContextDrawer` (`components/project/overview/sections`): right slide-over for project brief, team and resources (Esc/backdrop closes).
- `RoadmapView`: Project Overview "Roadmap" work view (view switcher, next to Timeline).
  - A range scale fitted to the card width (`buildRangeScale` + `useElementWidth`, no empty scroll) with month columns.
  - A header band with staggered milestone and project-target markers whose guide lines run through the chart.
  - Items grouped into In progress / Planned / Done (Done collapsed); tone is derived from health, lateness and phase.
  - Solid bars with the title, a progress strip and the target date; open targets are hatched with a "Set target" quick menu.
  - Bars and milestones are draggable; roadmap items (initiatives) and milestones can be created inline.
  - Backdrop and guide layers are clipped at the sticky label column (`clip-path` synced on scroll) because sticky cells otherwise let stripes paint through.
- Overview work views:
  - `WorkViewTimeline`: lanes per person, draggable and resizable bars, and a per-lane tray for tasks without a date;
  - `WorkViewPeople` ("Team"): one column per workspace member plus Unassigned, load signals (overdue, today, this week, overloaded when more than 5 tasks are due within 7 days) and drag-and-drop reassignment.

## Projects (`web/components/projects/`)

- `ProjectPortfolioList`: grouped project rows (Needs attention → On track → In planning → Paused → Completed & canceled, the last one collapsed). Each row shows attention signals (overdue/blocked/due today), done/total progress, the next milestone or due date, and member count. It replaces the spotlight hero and card grid on `/projects`; company and client container sections stay above it.

## Workspaces (`web/components/workspace/`)

- `WorkspaceMenuSection`: sidebar switcher section with the workspace list, pending invitations (accept) and "New workspace".
- `InviteToWorkspaceModal`: invite by email or link, with role (Member/Guest, plus Admin for the Owner) and optional/required projects. Use it for every invite entry point (Team, Project Overview, Project Team manager).
- `context/WorkspaceContext.tsx` (`useWorkspace`): active workspace, list, pending invitations, `switchWorkspace`, `createWorkspace`. Gates the app until the workspace is resolved.

## Shared logic (`web/utils/`, golden fixtures)

Pure, React/Firebase-free modules that the web app and the iOS app (`PFDomain`) both implement. Behaviour is pinned by `shared/fixtures/<module>/*.json` (`{name, input, expected}`); `shared/fixtures/README.md` documents every input/output field. Vitest runs all fixtures (`utils/__tests__/goldenFixtures.test.ts`); regenerate with `node shared/fixtures/generate.mjs` after an intentional change and review the diff.

- `zonedDate.ts`: explicit `now` + IANA `timeZone` instead of the system clock. Date-only strings are calendar days; ISO date-times, Timestamps (`{seconds}`) and epoch ms are instants; `toDay`, `startOfDay`, `daysBetween`, `clockLabel`. `taskDates.ts` (browser-zone helpers used all over the UI) delegates to it.
- `dayPlan.ts` (`buildDayPlan`): Dashboard slide 1 / iOS "Heute" — plan stops (focus → overdue → due today → scheduled → follow-ups → quiet-day suggestions, max 4), "frees up N", headline statement key/value, day shape and cause line, day band segments, week strip and badge, overnight feed, `waitingOnMe`, `moreCount`, `topUnlocker`. Includes personal tasks (lock glyph instead of the project name; only overdue / due today / scheduled today count, undated ones are suggestions only). Returns i18n keys + params, never text.
- `dueBuckets.ts`: My Tasks grouping (overdue, today, next 7 days, later, no date, completed), `compareWork`, `summarizeDue`, `normalizeStatus`.
- `attention.ts` (`buildAttention`, `portfolioGroup`, `classifyPortfolio`): portfolio "where to look" ranking (score, chips, rail, workload, statement, insight, accent, momentum, wins, horizon) and the project-list grouping.
- `fixtureRunners.ts`: the single place that maps a fixture `input` to the function call (used by Vitest and the generator).
- `pinnedState.ts`: pure transitions for pins and focus (`users/{uid}`), applied in a Firestore transaction by `PinnedTasksContext`.
- `notificationPrefs.ts`: defaults and (de)serialisation of `users/{uid}.notificationPrefs`.
- `services/domain/workspaceTasksService.ts` (`getWorkspaceTasks`): loads all tasks of the given projects once and splits them into `mine` / `others` (the Dashboard needs the others for dependency counts and "Waiting on you").

## Brand accents (`web/components/brand/`, 2026-10-23)
Ports of the iOS brand motion (`PFBrandScene.swift`) and `desktop/assets/splash.html`; tokens in STYLING 1.4.1; showcased on `/ui` ("Brand accents").
- `BrandGlyph`: the ProjectFlow glyph as inline SVG in `currentColor` (login brand mark).
- `BrandMark` (`size` sm/md/lg): glyph on a floating disc, conic brand aurora, breathing ring, four orbiting status dots (z-index flips behind/in front of the disc; rAF only while visible).
- `FlowField` (`originX/Y`, `spacing`, `period`, `tone` auto/onDark): canvas dot grid with ripples coloured by direction; fills its positioned parent; ResizeObserver repaints, pauses off-screen / hidden tab, static frame under reduced motion. Used in the login hero and `BrandScene`.
- `StatusDots` (`size` xs/sm/md, `motion` static/wave, optional `label`) and `LoadingTrack` (gliding brand-gradient segment).
- `BrandScene` (`variant` screen/inline, `label`): loading scene (field + mark + staggered name + track, `role="status"`). Used by the root auth loading and `WorkspaceConnecting` (screen) and `RoutePending` (inline).
- `playCompletionBurst(element)`: one-shot burst of the four dots from an element's centre, fixed on `<body>` so it survives rows moving groups; used by `TaskRow`'s complete check. Skipped under reduced motion.

## Notification Center (`web/components/notifications/`, 2026-10-23)

- `NotificationDropdown` (`components/NotificationDropdown.tsx`): sidebar bell with unread badge (active workspace + other workspaces) and a popover **portaled to `<body>`** (fixed, beside the sidebar flush with the bottom of `.snav-card`, or flipped below/above the trigger; Escape/outside click close). One-line header: All/Unread filter tabs (replace the visible title; dialog aria-label keeps it) plus icon buttons (mark all read, notification settings → `SettingsModal` tab `notifications`, lazy), "Unread in other workspaces" (switches workspace → `/notifications`), grouped list, "View all" footer.
- `NotificationList`: shared rows for popover (`compact`) and `/notifications` — groups Today / Yesterday / Earlier, soft tone-coloured icon per type (`data-tone` → `--status-*-rgb`, grey once read), localized title/message (legacy docs without params: quoted task title is recovered), project context line, hover actions overlaying the time + unread dot, keyboard (Enter/Space).
- `NotificationCenterParts`: `NotificationFilterTabs` (All/Unread, unread count as red pill), `NotificationOtherWorkspaces`, `NotificationState` (loading / error / empty / empty-unread).
- `hooks/useNotifications.ts`: live inbox for the active workspace (re-subscribes on sign-in/out and workspace switch, exposes `error`), unread counts of the other workspaces (one `userId + read == false` listener each), `setRead`, `markAllRead`, `remove`, `removeAll`.
- `utils/notificationPresentation.ts`: icon/tone per type, `getNotificationPath` (task > initiative > project > relative `deepLink`), `getNotificationText` (renders `notifications.type.<type>.title|message` from the doc's `params`, falls back to the stored English text), `groupNotifications`.
- `screens/Notifications.tsx` uses the same parts plus the collapsed delivery diagnostics.

## Help Center (`web/components/help/`, rebuilt 2026-10-23)

Concept: `brain/plans/help-center-rework.md`.
- `HelpCenterDrawer` (mounted in `Router.tsx`, state in `context/HelpCenterContext`; `activePageId` = article id, `null` = home): floating one-column sheet (`--help-center-width`, inset 12 px, full screen < 720 px). Views: **Home** ("For this page" via `helpRouting.ts` + articles by category) → **Article** (`HelpArticleView`) or **Search** (`searchHelp` + Ask CORA). Back arrow returns home, Esc/scrim close. Opened by `?`, the top-bar help button, ⌘K results, the desktop menu, and `HelpCenterFloatingButton` (`.help-fab`) on public routes.
- Content: `web/locales/help/articles/<id>-en|de.ts` (one `HelpArticle` each, typed by `helpTypes.ts`), ordered in `articles-en|de.ts`; loaded per language by `useHelpContent()` (chunks `help-content-en|de`). Blocks: text, steps, list, callout (tip/note/warning), terms, shortcuts; inline `**bold**`, `` `code` ``, `[label](/route)` (`HelpInline`).
- `__tests__/helpCenter.test.ts` enforces EN/DE structural parity, unique ids, valid routes, no retired concepts (Flows/Issues/Social), and that every routed article/section exists.
- Styling: `help-center.scss` only (borderless, surface contrast, brand tokens for callouts) — no Tailwind in help components.

## Reminders and settings controls

- `components/reminders/ReminderControls.tsx`: `ReminderNotifyToggle` ("Also remind assignees", `notifyAssignees`) and `ReminderSentBadge` (`sentAt`). Used by the task workbench (`ProjectTaskDetail`) and the project reminders popover (`ProjectRemindersPanel`); new reminders also set `createdBy` and `recipientIds: [uid]` (contract C2).
- `components/settings/SettingsSwitch.tsx`: accessible `role="switch"` for settings rows.
- `components/settings/NotificationSettingsPanel.tsx`: personal settings tab "Notifications" (`users/{uid}.notificationPrefs`: push/email per category, morning briefing, day close, time zone auto-detected and saved on first open; every change saves immediately).
- `components/ui/AppleLogo.tsx`: Apple glyph (`currentColor`) for Sign in with Apple (`screens/Login.tsx`) and "Connected accounts" in the security settings.
- Dashboard plan rows (`screens/Dashboard.tsx`) show personal tasks with a lock glyph (`dashboard.route.personal`), a "+ N more open tasks" link (`moreCount`) and a "Waiting on you" rail section.

## Legal documents (`web/components/legal/`, 2026-10-23)
- `LegalConsentGate` — wraps signed-in surfaces (Router: `AuthenticatedLayout` + desktop utility routes). Loads `legal_documents/*` + `legal_acceptances/{uid}`; renders nothing while loading, a blocking `Modal` (`hideHeader`, no close) *instead of* the app when consent is missing, the locked "declined" page (reuses `AccountDataSection` for export/delete + sign out), or a non-blocking bottom notice for `notifyOnly` changes. Fails open after 5 s / on errors. Logic in `web/utils/legalConsent.ts` (mirrors `functions/src/legal-logic.ts`).
- `LegalDocumentViewer` — modal with one version's Markdown and a toggle to the diff against an older version.
- `MarkdownContent` / `MarkdownDiff` — sanitized (DOMPurify) renderer for the legal Markdown subset (`renderMarkdown`) and paragraph-level LCS diff (`diffMarkdown`); unchanged paragraphs are hidden, headings before changes stay as context.

## Admin platform (`web/screens/admin/`, 2026-10-23)
- `AdminLayout.tsx`: `/admin/*` shell with side nav; gates on the `platformAdmin` claim (404 otherwise) and renders child routes via `<Outlet />`. New admin sections: add a `SECTIONS` entry + nested route in `web/Router.tsx`.
- `CrashReports.tsx` / `CrashIssueDetail.tsx` (+ `crashFormat.ts`, `admin.scss`): crash issue list and detail on `services/crashReportsService.ts`.
- Web crash capture lives in `services/errorReporting.ts` (`reportError`, global handlers, `isCrashReportingEnabled`/`setCrashReportingEnabled`); the ErrorBoundary reports render crashes through it.

## Notes for future components
- When adding a reusable component, update this file and ensure it uses tokens from `brain/reference/app/STYLING.md`.
- Avoid “one-off” styles in feature pages; promote patterns into reusable components whenever repeated.

## First-run experience (2026-09-26)

- `QuickProjectCreate` (`web/components/QuickProjectCreate.tsx`): one-step project creation (name, 4 quick templates, optional starter tasks due over the first week and assigned to the creator). Default content of `CreateProjectModal`; "More options" opens the full `CreateProjectWizard` with name/template prefilled (`initialName`, `initialTemplateId`).
- `WelcomeDialog` (`web/components/onboarding/`): first-login onboarding, shared contract with iOS: name -> about you (role, use cases) -> your team (team size, industry; owners also workspace name + invites when team size is not solo) -> how you found us (source, previous tool) -> done. Survey questions are optional (each screen has Skip) and written once as `survey` in `users/{uid}/private/onboarding` (ids in `web/utils/onboardingSurvey.ts`, which also maps use cases to a suggested project template used by `CreateProjectWizard` and the done step). Mounted in `AppLayout`; skipped on `/invite/*`.
- `OnboardingInsights` (`web/screens/OnboardingInsights.tsx`): platform-admin statistics page for the survey.
- `GettingStartedCard` (`web/components/onboarding/`): dashboard checklist (confirm email, first project, three tasks, invite, passkey/2FA) derived from live data; hides when done or dismissed.
- `useOnboarding` (`web/hooks/`): shared first-run state from `users/{uid}/private/onboarding`. Only accounts whose first workspace was created after the rework have this doc — older accounts never see welcome, checklist or the sidebar "More" grouping.
- `userPrivateData` (`web/services/domain/`): owner-only user data (`private/usage`, `private/workspace`, `private/onboarding`); `emailVerification` helpers for sending/rechecking the confirmation mail.

- `DashboardSkeleton` (`web/components/dashboard/DashboardSkeleton.tsx`, 2026-10-23): loading state of the Dashboard in its real Today layout (same containers, measured heights), shown until projects *and* tasks are loaded; styles at the end of `src/styles/components/_dashboard.scss`.
