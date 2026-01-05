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
| `Sidebar` | Main navigation | Tenant navigation | Collapsible behavior |
| `Breadcrumbs` | Context path | Project/module navigation | Optional on smaller screens |
| `Tabs` | Section switching | Settings, modal tabs | Keyboard-accessible |
| `DropdownMenu` | Menus | Action menus, user menu | |
| `CommandPalette` (optional) | Quick navigation/actions | Power user flows | |

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

---

## Notes for future components
- When adding a reusable component, update this file and ensure it uses tokens from `STYLING.md`.
- Avoid “one-off” styles in feature pages; promote patterns into reusable components whenever repeated.

