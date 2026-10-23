# brain/reference/app/STYLING.md — ProjectFlow Design System (SCSS Tokens)

This document defines the **design tokens** that must be used throughout the application to ensure a consistent, professional, monochrome UI.

**Source of truth:** `web/styles/_tokens.scss`  
All UI components and pages must reference these tokens instead of hardcoding values.

---

## 1) Colors

### 1.1 Core Palette (Monochrome)

| Token | Value | Description |
|------|-------|-------------|
| `--color-primary` | `#171717` | Primary brand color used for primary actions and key UI elements |
| `--color-primary-dark` | `#000000` | Darker primary shade for hover/active states |
| `--color-primary-light` | `#404040` | Lighter primary shade for subtle emphasis |
| `--color-primary-fade` | `#f5f5f5` | Soft faded background used for subtle panels or highlight areas |
| `--color-primary-hover` | `#000000` | Hover color for primary surfaces (maps to primary dark by default) |
| `--color-primary-text` | `#ffffff` | Text color on primary surfaces (flips in dark mode) |
| `--color-absolute-black` | `#000000` | Theme-invariant black for fixed-contrast surfaces |
| `--color-absolute-white` | `#ffffff` | Theme-invariant white for fixed-contrast surfaces |

### 1.2 Surfaces

> 2026-09-26 light-mode contrast pass:
> - `--color-surface-bg` is `#f2f2f3` and `--color-surface-hover` is `#ededee`, so white cards separate clearly from the page;
> - `--shadow-sm/md/lg` include a 5% 1px shadow ring (borderless edge definition);
> - `--color-text-muted` is `#666666` (5.7:1 on white);
> - keep `web/styles/_tokens.scss` and `web/src/styles/_tokens.scss` identical for light values (both are emitted; the former wins today).

| Token | Value | Description |
|------|-------|-------------|
| `--color-surface-bg` | `#fafafa` | Main application background |
| `--color-surface-card` | `#ffffff` | Card, modal, and elevated surface background |
| `--color-surface-paper` | `#ffffff` | Paper surface for nested panels and inset areas |
| `--color-surface-hover` | `#f5f5f5` | Hover surface background for rows, list items, and interactive containers |
| `--color-surface-border` | `#e5e7eb` | Default border color for separators, outlines, and dividers |
| `--color-surface-border-hover` | `#d1d5db` | Hover border color for interactive containers |

### 1.3 Text

| Token | Value | Description |
|------|-------|-------------|
| `--color-text-main` | `#171717` | Primary text color for headlines and body text |
| `--color-text-muted` | `#737373` | Secondary text for supporting information and metadata |
| `--color-text-subtle` | `#a3a3a3` | Placeholders, disabled hints and decorative low-emphasis UI only. Never use it for information the user needs to read (counts, dates, captions, empty-state copy) — use `--color-text-muted` (iOS contract C10). |
| `--color-text-ondark` | `#ffffff` | Text color on dark backgrounds (e.g., primary buttons) |

### 1.4 Status Colors

**Task status text (AA, contract C10).** The task-status accents `--status-<status>-rgb` are fill colours
only (pills keep the 12 % tint, dots, bars). Any *text or glyph* that carries a task status must use the
text tokens, which reach AA on card and surface backgrounds and switch automatically in dark mode:

| Status | `--color-status-<status>-text` light | dark |
|---|---|---|
| backlog | `#475569` | `#94a3b8` |
| open | `#1d4ed8` | `#60a5fa` |
| in-progress | `#0369a1` | `#0ea5e9` |
| review | `#b45309` | `#f59e0b` |
| on-hold | `#4b5563` | `#9ca3af` |
| blocked | `#b91c1c` | `#f87171` |
| done | `#047857` | `#10b981` |
| planning | `#6d28d9` | `#a78bfa` |

Pattern: a component sets `--x-status-rgb` for the fill and `--x-status-text` for the text (see
`.work-pill--status`, `[data-status]` → `--st-text` in `_project-overview-v2.scss`, `--board-status-text` in the
board lanes). The iOS app uses the same values as asset-catalog colours.

Use status colors for feedback states only (alerts, badges, validation states). Do not use them as general accents.

| Token | Value | Description |
|------|-------|-------------|
| `--color-success` | `#10b981` | Success state |
| `--color-warning` | `#f59e0b` | Warning state |
| `--color-error` | `#ef4444` | Error state |

### 1.4.1 Brand Palette (Accent Set, 2026-10-23)

The four status hues double as ProjectFlow's brand accents (iOS `PFBrandPalette`, desktop `splash.html`). They alias the status tokens, so status meaning never shifts.

| Token | Alias of | Use |
|------|----------|-----|
| `--brand-blue` / `-rgb` / `-text` | `--status-open-*` | open |
| `--brand-violet` / `-rgb` / `-text` | `--status-planning-*` | planning |
| `--brand-amber` / `-rgb` / `-text` | `--status-review-*` | review / warning |
| `--brand-green` / `-rgb` / `-text` | `--status-done-*` | done / success |
| `--brand-gradient`, `--brand-gradient-linear` | the four hues | aurora, loading track |
| `--brand-field-dot` | theme-aware neutral | FlowField resting dots |

Rules: accents, not fills. Allowed spots: loading scenes (`BrandScene`), the brand mark, success moments (completion burst), the login hero field, `/ui`. Use `-text` for coloured text (AA on surfaces); `rgba(var(--brand-*-rgb), a)` for tints. No hardcoded `#3b82f6/#8b5cf6/#f59e0b/#10b981` or their rgb triplets in SCSS. Motion is transform/opacity only, pauses off-screen / in hidden tabs and stops under `prefers-reduced-motion` (components in `web/components/brand/`).

### 1.5 Blue Palette (Pre-Beta / Limited Use)

These colors are reserved for specific pre-beta settings. Do not introduce them broadly without a clear reason.

| Token | Value |
|------|-------|
| `--color-blue-100` | `#dbeafe` |
| `--color-blue-500` | `#3b82f6` |
| `--color-blue-600` | `#2563eb` |
| `--color-blue-900` | `#1e3a8a` |

### 1.6 AI Studio Mode Accents

| Token | Value | Description |
|------|-------|-------------|
| `--color-mode-architect` | `#4285f4` | Accent color for AI Studio Architect mode |
| `--color-mode-brainstormer` | `#ea4335` | Accent color for AI Studio Brainstormer mode |
| `--color-mode-riskscout` | `#34a853` | Accent color for AI Studio RiskScout mode |

### 1.7 Legacy Alias Tokens (Migration)

These aliases exist for legacy styles during the Tailwind → SCSS migration. Prefer the canonical tokens above for new UI work.

| Token | Alias Of |
|------|----------|
| `--color-text` | `--color-text-main` |
| `--color-text-secondary` | `--color-text-muted` |
| `--color-text-paragraph` | `--color-text-muted` |
| `--color-background` | `--color-surface-bg` |
| `--color-bg-base` | `--color-surface-bg` |
| `--color-border` | `--color-surface-border` |
| `--color-accent` | `--color-primary` |
| `--color-primary-active` | `--color-primary-dark` |
| `--color-primary-rgb` | RGB values of `--color-primary` |
| `--color-surface-active` | `--color-surface-hover` |
| `--color-surface-bg-offset` | `--color-surface-hover` |
| `--color-surface-highlight` | `--color-surface-hover` |
| `--color-surface-input` | `--color-surface-bg` |
| `--color-surface-order` | `--color-surface-border` |
| `--color-surface-pressed` | `--color-surface-hover` |
| `--color-surface-sunken` | `--color-surface-bg` |

---

## 1.8 Derived RGB Tokens (Alpha Overlays)

Use these RGB triplets with `rgba(var(--token), alpha)` when a translucent surface is needed.

| Token | Value | Description |
|------|-------|-------------|
| `--color-surface-bg-rgb` | RGB of `--color-surface-bg` | Alpha overlays on app background |
| `--color-surface-card-rgb` | RGB of `--color-surface-card` | Alpha overlays on cards |
| `--color-surface-hover-rgb` | RGB of `--color-surface-hover` | Alpha overlays on hover surfaces |
| `--color-surface-paper-rgb` | RGB of `--color-surface-paper` | Alpha overlays on paper surfaces |
| `--color-success-rgb` | RGB of `--color-success` | Alpha overlays for success states |
| `--color-warning-rgb` | RGB of `--color-warning` | Alpha overlays for warning states |
| `--color-error-rgb` | RGB of `--color-error` | Alpha overlays for error states |

---

## 2) Border Radius

Border radius tokens define the rounding used across components. Use them consistently (cards, buttons, inputs, modals).

| Token | Value | Intended Use |
|------|-------|--------------|
| `--radius-sm` | `6px` | Small rounding for compact UI elements |
| `--radius-md` | `10px` | Default rounding for inputs and small containers |
| `--radius-lg` | `16px` | Cards and larger containers |
| `--radius-xl` | `24px` | Large feature panels and prominent surfaces |
| `--radius-2xl` | `32px` | Hero cards and oversized panels |
| `--radius-3xl` | `40px` | Extra-large containers and modals |
| `--radius-full` | `999px` | Pills, circular buttons, avatars |

**Semantic radii (use these first):**

| Token | Resolves to | Use for |
| --- | --- | --- |
| `--radius-control` | `--radius-md` (10px) | Every interactive control: buttons (all sizes), inputs, textareas, selects, pickers, icon buttons, segmented toggles |
| `--radius-card` | `--radius-lg` (16px) | Cards, sections, panels; nested rows/tiles inside a card use `--radius-control` |
| `--radius-surface` | `--radius-xl` (24px) | Large shells (sidebar card, modals) |
| `--radius-full` | 999px | Chips, badges, avatars, pills, round icon buttons |

Do not hardcode px radii or mix `--radius-sm/lg/xl` on controls. Legacy `rounded-*` utilities map onto
this scale (`rounded-md/lg/xl` → control, `rounded-2xl` → card, `rounded-3xl` → surface).

---

## 3) Shadows

Shadows define elevation and depth. Use them sparingly to keep the monochrome design clean.

| Token | Value |
|------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` |
| `--shadow-md` | `0 4px 6px -1px rgba(0, 0, 0, 0.1), ...` |
| `--shadow-lg` | `0 10px 15px -3px rgba(0, 0, 0, 0.08), ...` |
| `--shadow-soft` | `0 20px 40px rgba(0, 0, 0, 0.04)` |
| `--shadow-inner` | `inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)` |

**Guideline:**
- Use `--shadow-sm` for subtle elevation (small cards, compact menus).
- Use `--shadow-md` for standard elevated surfaces (cards, dropdowns).
- Use `--shadow-lg` or `--shadow-soft` only for prominent overlays (modals, drawers).
- Use `--shadow-inner` for inset effects (pressed states, recessed panels).

---

## 4) Transitions

Legacy tokens `--transition-fast` (150 ms) / `--transition-normal` (300 ms) stay valid for colour
hovers. New and touched code uses the motion tokens below.

### 4.1 Motion system (2026-10-23)

Purpose over decoration: motion shows origin and destination, confirms actions, makes state changes
traceable and shortens perceived loading. No bouncing, no wobble. Reference: Linear, Things, Raycast.

| Token | Value | Use |
|------|-------|-----|
| `--motion-duration-instant` | 90 ms | press (`:active`) |
| `--motion-duration-fast` | 140 ms | hover, focus, toggles, colour |
| `--motion-duration-base` | 200 ms | menus, popovers, tabs, list items |
| `--motion-duration-slow` | 280 ms | modals, drawers, route content, toasts |
| `--motion-duration-exit` | 150 ms | every exit (shorter than its enter) |
| `--motion-ease-out` | `cubic-bezier(0.16,1,0.3,1)` | entering, settling |
| `--motion-ease-in` | `cubic-bezier(0.4,0,1,1)` | leaving |
| `--motion-ease-in-out` / `-standard` | | state morphs |
| `--motion-ease-spring` | `cubic-bezier(0.34,1.3,0.64,1)` | drag-drop settle, checkmarks only |
| `--motion-stagger` | 24 ms | list entrance step (max 12 items) |
| `--motion-rise` / `--motion-scale-from` / `--motion-press-scale` / `--motion-lift` | 6px / .97 / .97 / -1px | offsets |

Files: tokens in `web/styles/_tokens.scss`; keyframes + utilities + reduced-motion contract in
`web/styles/_motion.scss`; mixins (`enter`, `exit`, `press`, `lift`, `hover-colors`, `motion-ok`) in
`web/styles/_motion-mixins.scss` (`@use '…/styles/motion-mixins' as motion;`, emits no CSS);
JS mirror `MOTION` + primitives in `web/components/motion/`. Demo: `/ui` → Motion.

- Keyframes: `pf-fade-in/out`, `pf-rise-in`, `pf-sink-out`, `pf-pop-in/out`, `pf-drop-in` (menus, set
  `transform-origin` at the trigger edge), `pf-slide-in-right/left/up`, `pf-drawer-in-*`, `pf-modal-in/out`,
  `pf-shimmer`, `pf-confirm-flash`, `pf-tick`, `pf-nudge` (validation only, one 3px cycle).
- Utilities: `.motion-fade-in|rise-in|pop-in|drop-in|slide-in-right`, `.motion-exit(-pop)`,
  `.motion-stagger` (children), `.motion-collapse[data-open]` (height via grid rows), `.motion-press`,
  `.motion-confirm` (optimistic success flash), `.motion-tick`, `.motion-nudge`, `.motion-indicator`.
- Primitives: `usePresence(open)` (keep mounted for the exit), `useFlipList(ref)` (items with
  `data-flip-key` glide on reorder, rise in, slide out on removal; scroll-compensated, max 80 per commit),
  `useMotionOnChange(ref, key, preset)` (one-off entrance without remount: route content, tab panels),
  `useSlidingIndicator(ref, activeKey)` (tabs/segments), `<AnimatedNumber value>` (tween on change only,
  SR gets the final value).
- Legacy Tailwind vocabulary `animate-in fade-in zoom-in-95 slide-in-from-*`, `animate-scale-up`,
  `animate-fade-in-left` was never generated (only `@tailwind base` runs); `_motion.scss` now defines it.
- Rules: animate `transform`/`opacity` (`clip-path` for reveals) only; no `transition: all` in new code;
  enter = keyframes when the element mounts already open (a transition cannot run on the first frame),
  exit = transition or `usePresence`. Reduced motion: offsets collapse to 0 and every animation/transition
  becomes 1 ms globally (spinners `.animate-spin` keep turning) — end states always render.
- Brand: `playCompletionBurst` on task completion only; no brand colour as motion fill.

### Focus Loop Controls

- The top-bar focus pill and pinned-task focus controls use semantic status color, not a new palette: primary for active, muted surface for snoozed, error for blocked, success for completion.
- Focus controls should stay compact and action-oriented: start/resume, snooze, block, complete. Avoid explanatory cards around them.
- Detail-page focus actions should live as standalone buttons at the top of the right/sidebar column, outside cards. Keep the hero for identity, status, and primary edit/complete actions; icon-only focus controls are reserved for pinning or compact toolbars.
- Task, initiative, and issue detail heroes should use an open document-header pattern rather than a boxed card: no glow background, no giant rounded wrapper, title and context on the page surface, actions aligned as compact controls, and key facts in a thin metadata rail below the title.
- Follow-up `MFV0szRMsrCI4Uqc2bEq`: flatten the task/initiative/issue detail body sections next. The hero now reads cleaner, but the main metadata controls and sidebar still repeat facts and rely on oversized cards.
- Keep the current focus visible in the first dashboard viewport and top bar without relying on hover text.

### Codex Session Surface

- `web/src/styles/components/_project-codex.scss` uses existing surface, radius, status, and shadow tokens only.
- Codex statuses map to semantic colors: primary for running, warning for partial, error for blocked, success for completed.
- Touched-file chips use monospace text inside tokenized hover surfaces and must wrap long paths instead of overflowing.

---

## 5) Layout Metrics

These tokens define key layout constants used across the app shell.

| Token | Value | Description |
|------|-------|-------------|
| `--app-sidebar-width` | `0px (Mobile) / 280px (Desktop)` | Width of the main navigation sidebar |
| `--help-center-width` | `680px` | Help center sheet width (floating, inset 12px; full screen below 720px) |

**Guideline:**
- Mobile layout: sidebar is collapsed/hidden (`0px`).
- Desktop layout: sidebar uses `280px` width.
- The app top bar is an overlay, not a layout band: keep context, search, and tool clusters in separate floating pill surfaces, and let page content paint/scroll underneath it.
- The global search belongs in the top-right cluster as a compact magnifying-glass trigger with the keyboard shortcut visible; the full input and results should open in a centered Spotlight-style modal.
- Search shell behavior must use explicit SCSS classes instead of relying on ad hoc responsive utility classes.
- Pinned-project menus render through `document.body` as fixed overlays, align from the trigger's right edge, and clamp to the viewport on resize. Keep their visible content dense enough for a normal desktop viewport and let the inner menu scroll when project modules add more rows.

### 5.1) Page Container Widths

The `/ui` style guide standardizes page width categories inspired by the Mossandl Mobility design system, adapted to ProjectFlow's current surfaces:

- Dense operations: `max-width: 1680px` for large boards, finance tables, timelines, and high-density work surfaces.
- Standard app pages: `max-width: 1480px` for project overviews, dashboards, lists, and balanced app pages.
- Forms and settings: `max-width: 1120px` for creation flows, settings, and structured input workflows.
- Readable copy: `max-width: 720px` for documentation, legal copy, help articles, and long-form text.

Use named categories instead of one-off widths where possible.

### 5.2) Level Of Depth

The `/ui` style guide now defines a ProjectFlow depth ladder:

- Level 0 Canvas: `--color-surface-bg`; open page background, no wrapper card by default.
- Level 1 Surface shell: `--color-surface-card`; default cards, panels, modal shells, and page sections that need a surface.
- Level 2 Child controls: `--color-surface-hover`; inputs, selectable rows, grouped controls, and child surfaces inside a Level 1 shell.
- Level 3 Tonal focus: a subtle mix of hover/card surfaces for rare nested focus rows.
- Overlay layer: `--shadow-lg` or stronger only for dropdowns, popovers, and transient floating UI.

Depth is relative to the direct parent surface. Prefer tonal contrast for nested UI and reserve stronger shadows for true overlays.

### 5.3) UI Library Standardization Primitives

The `/ui` style guide now shows first-version standards for six common operational patterns:

- `ListToolbar`: shared title/search/filter/action row for list and table pages.
- `FilterMenu`: compact floating filter panel with active-count badge and reset action.
- `EmptyState`: empty-list guidance with standard icon/copy/action structure.
- `Skeleton` / `SkeletonBlock`: loading placeholders that preserve list/card rhythm.
- `InlineEditCell`: compact read/edit field for metadata, settings rows, and dense task surfaces.
- `Stepper`: progress and setup steps with complete/current/upcoming/error states.

Treat these as v1 defaults before creating one-off versions in feature screens; refine each primitive as screens adopt it.

---

## 5.9) Breadcrumbs (2026-10-23)

- Hierarchy, not history. Only pages with a parent get a trail: project pages (`Projects › Project › Section › Item`, client projects under their company project), personal task detail, finance sections (`Finance › Section`), admin crash issue.
- Top-level destinations (Dashboard, My Tasks, Calendar, Team, Projects, Notifications, Media, Profile, Personal tasks list, Finance cockpit, admin areas) show no trail — the sidebar marks the location and the page has its own heading. No lone home icon.
- The back arrow goes one level up; every crumb except the current page is a link. Labels are localized (project sections reuse the sidebar `nav.*` labels).
- New routes: add them to `web/utils/breadcrumbs.ts` and its test, never in a page.

## 6) Interaction Guidelines (UX Patterns)

- **No Native Browser Dialogs:** never use `window.alert()`, `confirm()`, or `prompt()`.
  - These are blocking, non-styled, and break the immersive experience.
  - **Use Custom Modals:** Always use the `Modal` or `ConfirmDialog` components for critical feedback, confirmations, or input requests.
  - For non-critical feedback (success/info), use `Toast` notifications (once implemented).

---

## 6.1) Dashboard Command Center Pattern

- The dashboard first screen starts quiet but actionable: long localized date, centered greeting, the top right-now work items, and compact signal counts.
- Scroll-driven dashboard stages should increase density in relevance order: today's operating plan, then wider workspace health/momentum.
- Prioritize due today, scheduled today, overdue, blocked, urgent issue, project-risk, and review-queue signals before general metrics.
- Keep each stage to one job and avoid nested cards. The today step should read as an ordered route with a small context rail, not a generic chart board.

## 6.2) Builder / Configuration Modal Pattern

- Complex builders should start from the app's standard modal language: title/description first, a compact toolbar for mode and creation controls, inline expansion for selected-item controls, and footer actions. Only expand into workspace-like layouts when the workflow genuinely needs persistent side-by-side context.
- Keep validation visible near the editable structure and expose direct review actions for field-specific issues.
- Keep previews scoped to the real customer-facing surface, but make them opt-in when the editor is already dense; do not keep counters or status strips visible by default.
- Prefer dense rows for ordered editable items; reserve larger panels for the currently selected item editor.
- Put publishing, links, tokens, and embed data behind a Share/Access mode instead of mixing them into the primary editing canvas.
- Project creation should open with compact project-type selection and then stay name-first and optional after the required basics; do not ask users to choose between manual creation and CORA in the wizard. Type, module, startup workstream, member, and visibility choices should share the same selection-card contract with equal-height rows, readable wrapped descriptions, and copy lengths that stay roughly balanced inside a grid. Team assignment and visibility rules are separate decisions and should live in separate steps; never auto-select a workspace group when the user chooses group visibility. Use one user-facing project purpose field; do not ask for a separate goal/objective later in the wizard. For company projects, setup workstreams belong in their own quiet checklist step before module selection; avoid oversized cards, heavy panels, and prominent seed-count chips there. Startup/company founding context is prompted from the project overview after creation, not collected in the create wizard. Timeline fields use flat grids and rows; cover images, GitHub, and resource links belong in overview/settings surfaces after creation.

## 6.3) Project Lifecycle Recovery Pattern

- Project pause/resume and project canceling must be explicit actions in the project overview controls, not normal status select options.
- The project overview controls should read as a compact project-state command card: lifecycle action in the header, status/priority as editable controls, timeline as its own section, and release state as secondary detail.
- Resume flows should use the common `Modal`, show only open tasks whose due dates fell inside the paused window, and use `DatePicker` controls for inline due-date correction before the project is restored.
- Use warning tone only for the paused state indicator and danger tone only for canceled-state indicators; recovery rows should stay on normal surface tokens so the modal remains scannable.

## 6.3.1) Project Triage Pattern

- Project triage belongs with the project overview task execution surface, not in the masthead/hero and not as a detached task-list replacement.
- Show the right-column triage card only when the cleanup rule is triggered: overdue tasks, blocked tasks, unassigned tasks, high-priority tasks without dates, or clusters of three or more due-soon/no-date tasks. Do not show it for ordinary open work.
- Use queue filters for overdue, blocked, due-soon, unassigned, no-date, high-priority, and all-open tasks; keep the list dense enough for bulk cleanup.
- Bulk actions should focus on reversible task metadata changes: due dates, status, completion, and team-member assignment. Keep delegation compact with a suggested member/select flow; do not reintroduce workload charts unless the user asks for a richer staffing view.
- Keep triage in the common `Modal` with tokenized surfaces, no nested cards, no native dialogs, and no hardcoded user-facing text.

## 6.4) Project Contract Pattern

- The Project Contract belongs on the project overview as a supporting context card, not as the first full-width focus area.
- Keep live status, workload, and execution cards ahead of the contract in the first viewport. The contract should live in the side rail and stay compact enough that it never pushes the work queue out of focus.
- Treat the contract as delivery guardrails: one-line scope, first success criterion, watch item, rhythm, and owner. The project purpose already lives in the masthead and must not be repeated inside the contract card unless a future design provides a distinct purpose/source split.
- Keep the card un-nested: use one `Card` surface with compact internal rows instead of cards inside cards.

## 6.5) Project Overview Layout Pattern

- Project overview cards use a fixed, non-editable layout. Do not add user-facing drag handles, card toggles, layout toolbars, or layout customization modals to this screen.
- Keep the page command-first: compact header, project command strip, attention queue, execution cards, project state/context, then reference modules.
- Keep the project masthead compact by default, but use the same floating identity-box language for both `Compact` and `Showcase`. Compact mode should be the short version with a shallow cover/backdrop band behind the title box; Showcase may enlarge that cover area when media should carry more visual weight. Both modes must keep identity, status, and primary actions visible without scrolling and return to command metrics immediately after the masthead; never show a big empty image placeholder when no cover is set.
- Combine command metrics and attention work into one `Project focus` surface. Do not render the command strip and attention queue as two separate top-level cards.
- Startup/company overview additions should use the same neutral card, row, and metadata patterns as the rest of Project Overview. Company projects should use one unified command surface with a compact header, one founder action, launch readiness, a quiet context rail, a compact workstream summary that opens a modal/drawer for task inspection, and linked delivery projects; avoid inline lists of every workstream, yellow warning panels, separate cockpit cards, long explanatory paragraphs, and loud pill clusters for routine setup guidance. The founding brief belongs in its own focused modal from the overview, not in project settings.
- Keep the command strip to one full-width section with compact cells for health, work, timeline, and lifecycle. It must not become a second full controls card.
- Do not render the old header metrics footer or snapshot card alongside the command strip; those signals belong to one top-level summary surface.
- Hide the attention queue for canceled projects or projects with no attention items; do not render a success/empty next-action card in the command area.
- Keep primary work cards in the main grid and compact project state/support cards in the side column so the overview remains predictable across sessions.
- Move reference-heavy modules such as updates, resources, GitHub, and metadata below the operational work/status area.

## 6.6) Task Detail Full Workbench Pattern

- Project task detail uses a workspace pattern, not a card-heavy document page: compact command header, editable command rail, Work/Discussion/History tabs, main workbench, and sticky inspector.
- Keep Full Workbench controls additive and reversible: next step, blocker note, reminder date, quick log, focus start/snooze/block, and completion should update existing task state without introducing a new backend workflow.
- Task relationships belong in the inspector as flat rail sections, not nested cards. Keep blocked-by, is-blocking, parent, and child-task links as compact rows with inline search pickers.
- Relationship actions should make status effects visible immediately: adding a blocked-by or is-blocking link marks the blocked task as `Blocked`; clearing the final blocker may restore `In Progress` when there is no manual blocker note.
- Use flat rails, rows, and lightly outlined sections. Avoid nested cards, oversized hero wrappers, decorative gradients, and duplicated metadata between header, rail, and inspector.
- On mobile, stack the command rail and move the inspector below the workbench; all icon-only actions need accessible labels and stable hit areas.

### Work list pattern (My Tasks + Project Tasks, 2026-09-26)

- Styles live in `web/src/styles/components/_work-list.scss`; components are in `web/components/work/`.
- Page order:
  1. a title plus one summary line ("2 overdue · 1 due today · 4 this week") instead of stat cards;
  2. the quick-add bar (`N` focuses it);
  3. one compact toolbar (search, group-by or project/priority, "Completed" chip, view toggle);
  4. grouped rows.
- Groups: Overdue → Today → Next 7 days → Later → No date → Completed (collapsed by default). Project Tasks may group by status or assignee instead.
- Rows expose only frequent edits (status pill, priority bars, due chip, assignee avatars) as inline menus. No delete/convert/pin/category buttons on rows.
- The bulk bar renders only when rows are selected.
- Project Overview defaults to the list view grouped by due date (`OverviewGroupBy` `'due'`). The list renders the same `TaskRow`s. Board, timeline, calendar and relationships remain opt-in views.
- Board focus also keeps the Team, Timeline and Calendar views (the list switches to the board); team columns and the timeline fill the viewport height like board lanes.
- Board focus (Project Overview, "Focus board" button):
  - collapses the sidebar via AppLayout `contentWide`, switches to the board and hides the hero, tabs, initiatives and references;
  - the board fills the viewport and lanes scroll individually;
  - Esc, the exit button or leaving the page restores the previous sidebar width and view;
  - in light mode, board lanes are grey and cards white with `--shadow-sm`.
- Planning surfaces (`_planning.scss`):
  - timeline and roadmap share the `.tl` grid (sticky label column, sticky time header, backdrop layer for weekends, today, milestones and the project target);
  - bars use status/health RGB tokens with an inset accent instead of borders;
  - milestone labels are staggered rather than overlapping.
- Task detail: the main-column sections (focus banner, description, subtasks, discussion) are `--color-surface-card` cards with `--shadow-sm`, matching the inspector.
- `/projects` is a portfolio list (`portfolio-row` in `_work-list.scss`), not spotlight cards. Health is shown as attention signals, not as a raw score.
- Notifications: the inbox comes first; delivery/push diagnostics sit in a collapsed `<details>` below it.

### Workstream list pages (Tasks + Initiatives)

- Project task lists, global `/tasks`, and initiative lists share the `workstream-page` shell in `web/src/styles/components/_workstream-pages.scss`.
- Shared structure: eyebrow hero, four-cell metrics rail, sticky command deck (search + segment filters + view/sort), then body content.
- Tasks use flat bordered list rows with a left priority stripe inside `workstream-page__list`; board view keeps elevated cards.
- Initiatives use `workstream-initiative-card` catalog cards with top accent, health pill, progress ring, and richer stat footer; list mode compresses to horizontal rows while keeping the same card language.

---

## 6.7) Landing Page Tokens & Motion (`landing/`)
- `landing/src/styles/_tokens.scss` mirrors app colours/radii/shadows (app stays the source) plus landing-only tokens (type scale, device colours, role badges). `.theme-dark` scopes the app's dark values to a single section.
- Motion tokens (mirrored in `landing/src/js/motion.ts` for GSAP): `--ease-out` cubic-bezier(0.16,1,0.3,1) (GSAP `expo.out`), `--ease-in-out` (`power3.inOut`), `--ease-spring` (`back.out(1.6)`, micro feedback only), `--dur-1..4` 150/300/600/900 ms, `--stagger` 60 ms, `--rise` 24 px.
- Only `transform`/`opacity` (and `clip-path` for reveals) are animated. Hidden start states are gated by `html.motion.is-ready`; without JS or with `prefers-reduced-motion` every section renders its end state.

## 7) Implementation Rules (Mandatory)

- Do not hardcode colors, radii, shadows, transitions, or layout constants when a token exists.
- New UI components must reference tokens from `web/styles/_tokens.scss`.
- If a new token is introduced, it must be documented here and added to `_tokens.scss`.
- **Borderless Design (Strict):** Never use borders or outlines on any element. Separate layers with **background contrast** (lighter/darker surfaces) and **shadows** only.
- **Container-driven grids:** card grids inside the app shell (sidebar + optional side panels) use
  `repeat(auto-fill|auto-fit, minmax(min(100%, <card>px), 1fr))` instead of viewport breakpoints
  (`lg:grid-cols-3`, `@media (max-width: 1024px)`), because the viewport width does not include the sidebar or an open
  detail panel (UI sweep 2026-10-23: Team, Finance cockpit).
- **Buttons never wrap:** `.btn` is `white-space: nowrap; flex-shrink: 0; max-width: 100%` (fixed heights). Rows that
  hold a description plus a button use `flex-wrap` so the button drops below the text on narrow widths.
- **Tailwind color utilities:** use the token aliases (`text-main/muted/subtle`, `bg-surface-card/hover`,
  `text-primary`, `bg-success/15`, `text-warning`, `text-error`, `border-error/30` …) from `web/tailwind.config.cjs`;
  never palette classes like `text-rose-600` or `bg-zinc-100 dark:bg-zinc-800`.

---

## 8) Quick Usage Notes (SCSS)

- Tokens should be defined in `web/styles/_tokens.scss`.
- Components should consume tokens via CSS variables (recommended) or SCSS variables mapped to them.
- Keep styles reusable and consistent across the UI.
- Migration utilities live in `web/styles/_utilities.scss`; use them sparingly and prefer component SCSS + tokens for new work.
- Button icons (`Button icon={…}`) are sized by the button: sm 16 px, md 18 px, lg 20 px (`common/Button/button.scss`). Don't pass `text-[…]` sizes on the icon, and scope page rules for big decorative icons with `>` so they don't reach buttons.
