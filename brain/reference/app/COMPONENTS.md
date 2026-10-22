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
| `Badge` / `Tag` | Status + labeling | Priority, states, categories | Variants: `neutral`, `success`, `warning`, `error`. |
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
| `Sidebar` | Main navigation | Tenant navigation | Collapsible behavior; project resources can show restricted/advisor-review signals and are filtered by resource role metadata when configured. |
| `ProjectSwitcher` | Sidebar workspace/project switcher | Sidebar project context trigger | Lazy-loads projects, supports current/pinned quick access, company/workstream grouping, search by title/status/company context, pin/unpin, dashboard switch, and create-project entry. |
| `Breadcrumbs` | Single trail in the top bar pill (back arrow + path + current page) | Every page via `TopBar`; pages must not render their own in-page breadcrumbs | Mobile shows back arrow + current page only |
| `PinnedProjectPill` | Current pinned project shortcut and menu | Top bar project quick access | Uses portal-rendered fixed dropdown with health, project module stats, quick create actions, and project navigation. |
| `PinnedTasksModal` | Quick-access focus workspace | Top bar focus pill, dashboard resume action, pinned task/issue/initiative shortcuts | Uses persisted `focusState` with start, snooze, block, and complete controls. |
| `Notifications` diagnostics card | Notification delivery verification | `/notifications` delivery health panel | Registers web push, sends a self-test notification, and shows recent `notificationDeliveryLogs`. |
| `Tabs` | Section switching | Settings, modal tabs | Keyboard-accessible |
| `DropdownMenu` | Menus | Action menus, user menu | |
| `CommandPalette` (optional) | Quick navigation/actions | Power user flows | |
| `ListToolbar` | Shared search/filter/action row | List and table pages | V1 primitive in `web/components/common/ListToolbar`; first demo in `/ui`. Add sorting when a consuming screen needs it. |
| `FilterMenu` | Compact filter dropdown | Dense lists, tables, work queues | V1 primitive in `web/components/common/FilterMenu`; use instead of ad-hoc chip clusters when filters need a panel. |

---

## Native iOS Ambient Components

| Component | Purpose | Typical Usage | Notes |
|---|---|---|---|
| `FocusAmbientController` | Keeps the current focus visible outside the app | iOS focus sync, local reminders, widget reloads, Live Activity updates | Uses App Group `group.de.christophlabestin.projectflow`; notification copy remains native-only for now. |
| `FocusNotificationActionHandler` | Handles actionable push/local notification buttons | Start focus, snooze, block, complete from notification actions | Writes the same user `focusState` and task/issue/personal-task status fields as the in-app focus loop. |
| `ProjectFlowAmbientExtension` | WidgetKit + ActivityKit ambient surfaces | Home Screen focus widget, Today widget, Focus Keeper Live Activity/Dynamic Island | Reads `ProjectFlowAmbientFocusSnapshot` from the shared App Group store. |
| `ShareViewController` | Native Share Sheet capture | Captures shared text/URLs into the ProjectFlow app without opening the full UI | Queues captures locally; `ShareCaptureImportService` imports them into `personalTasks` on app activation. |

---

## Feedback & Overlays

| Component | Purpose | Typical Usage | Notes |
|---|---|---|---|
| `Modal` | Standard modal dialog | Forms, pickers | Focus trap + escape handling |
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
| `DataTable` | Tabular display | Members, tasks, campaigns | Sorting/paging optional |
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
- Flow attachments
- Social post media selection
- Marketing emails/blog assets
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
  - `groupTasks` (group by due, status or assignee; completed work last);
  - `summarizeDue` (header summary line);
  - `normalizeStatus` (`Todo` → `Open`).
- `useWorkMembers`: members of the active workspace for assignee menus.
- `TaskRow` accepts an optional `trailing` action slot (e.g. detach from initiative).
- `TaskRow` also takes `initiativeTitle` (shown as meta) and `variant="card"` for grid tiles (title clamped to 2 lines, controls pinned to the bottom).
- Selection (only `screens/ProjectTasks.tsx` uses it so far):
  - `useWorkSelection`: selected ids, explicit selection mode, Shift-range (in rendered row order via `listRef`, so collapsed groups are skipped), `setMany`, `clear`; keyboard `Esc` clears (only when focus is in `.work-page` or nowhere), `x` toggles the focused row.
  - `TaskRow` `selectable` renders a themed `role="checkbox"` (`.work-select-box`) in front of the done circle. It is hidden at rest and shows on row hover/focus, when selected or while the list is selecting; on touch (`hover: none`) only while selecting. `selectOnClick` (selection mode) makes a row click select instead of open; Cmd/Ctrl/Shift-click on a row always selects.
  - `TaskGroupList` `selection` prop adds a per-group select-all checkbox (mixed state) and the `is-selecting` list class.
  - `WorkBulkBar`: floating bar sticky to the bottom of the work page (no layout shift) with status, priority, due date, assignee (replaces assignees), optional initiative, delete and close; same `InlineMenu`s as a row. Icons only on mobile.
  - Toolbar "Select" chip toggles selection mode (the entry point on touch devices).
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

## Notes for future components
- When adding a reusable component, update this file and ensure it uses tokens from `brain/reference/app/STYLING.md`.
- Avoid “one-off” styles in feature pages; promote patterns into reusable components whenever repeated.

## First-run experience (2026-09-26)

- `QuickProjectCreate` (`web/components/QuickProjectCreate.tsx`): one-step project creation (name, 4 quick templates, optional starter tasks due over the first week and assigned to the creator). Default content of `CreateProjectModal`; "More options" opens the full `CreateProjectWizard` with name/template prefilled (`initialName`, `initialTemplateId`).
- `WelcomeDialog` (`web/components/onboarding/`): shown once after the first sign-in (workspace name, solo/team, optional email invites), then opens the project dialog. Mounted in `AppLayout`; skipped on `/invite/*`.
- `GettingStartedCard` (`web/components/onboarding/`): dashboard checklist (confirm email, first project, three tasks, invite, passkey/2FA) derived from live data; hides when done or dismissed.
- `useOnboarding` (`web/hooks/`): shared first-run state from `users/{uid}/private/onboarding`. Only accounts whose first workspace was created after the rework have this doc — older accounts never see welcome, checklist or the sidebar "More" grouping.
- `userPrivateData` (`web/services/domain/`): owner-only user data (`private/usage`, `private/workspace`, `private/onboarding`); `emailVerification` helpers for sending/rechecking the confirmation mail.
