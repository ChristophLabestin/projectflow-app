# COMPONENTS.md — Reusable UI Components Index (Authoritative)

This file is the **authoritative index** of reusable UI components available in this repository.

Rules:
- Prefer reusable components over one-off UI implementations.
- All reusable components must follow tokens and rules defined in `STYLING.md`.
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
| `Checkbox` | Boolean multi-choice | Forms, filters | |
| `Switch` | Boolean toggle | Settings | |
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
| `Sidebar` | Main navigation | Tenant navigation | Collapsible behavior; project resources can show restricted/advisor-review signals and are filtered by resource role metadata when configured. |
| `Breadcrumbs` | Context path | Project/module navigation | Optional on smaller screens |
| `PinnedProjectPill` | Current pinned project shortcut and menu | Top bar project quick access | Uses portal-rendered fixed dropdown with health, project module stats, quick create actions, and project navigation. |
| `PinnedTasksModal` | Quick-access focus workspace | Top bar focus pill, dashboard resume action, pinned task/issue/initiative shortcuts | Uses persisted `focusState` with start, snooze, block, and complete controls. |
| `Notifications` diagnostics card | Notification delivery verification | `/notifications` delivery health panel | Registers web push, sends a self-test notification, and shows recent `notificationDeliveryLogs`. |
| `Tabs` | Section switching | Settings, modal tabs | Keyboard-accessible |
| `DropdownMenu` | Menus | Action menus, user menu | |
| `CommandPalette` (optional) | Quick navigation/actions | Power user flows | |

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
| `EmptyState` | No data guidance | Empty lists | |
| `StatusCard` | Status messaging panel | Invite flows, async states | Variants: `info`, `success`, `error`. Optional icon + extra actions. |
| `InitiativeCreateModal` | Lightweight initiative creation modal | Project overview, project tasks, initiative list | Focuses on title, description, status, priority, and dates. |
| `InitiativeFeedbackModal` | Build and configure public initiative feedback intake | Initiative detail | Task-modal-style form editor with title/description first, compact Questions/Share toolbar, fully customizable default and custom fields, inline row editing, schema validation, opt-in preview, and hosted/embed access controls. |
| `CreateProjectModal` | Global wrapper for the full project creation wizard | Sidebar, project switcher, projects list, `/create` deep link | Uses the existing wizard layout without resizing it. The wizard favors low-friction creation: method, compact type selection, then required details with a single project purpose field; optional company-project assignment for normal projects, company-project setup workstreams as a quiet checklist step with sensitive-track confirmation, optional success criteria plus cadence, operating mode in the timeline step, and optional finish assets/links. Company-project founding context is completed after creation from the overview hint card/settings flow. |
| `ProjectOverview` company command surface | Action-first Unternehmensprojekt overview | `/project/:id` for company/startup projects | Replaces the old text-heavy founding cockpit with one founder action, launch-readiness meter, compact workstream rows, company context, source links, and linked-project rollups using the same neutral Project Overview surface language. |
| `Skeleton` | Loading placeholder | List/table loading | |

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
| `PermissionGate` | UI guard wrapper | Hide/disable actions | Must respect `PERMISSIONS.md` |
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

## Notes for future components
- When adding a reusable component, update this file and ensure it uses tokens from `STYLING.md`.
- Avoid “one-off” styles in feature pages; promote patterns into reusable components whenever repeated.
