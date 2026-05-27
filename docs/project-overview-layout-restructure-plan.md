# Project Overview Layout Restructure Plan

Date: 2026-05-27
Surface: `web/screens/ProjectOverview.tsx`, `web/src/styles/components/_project-overview.scss`

## Goal

Make the project overview feel like an operational command surface instead of a loose collection of modules.

The first viewport should answer four questions quickly:

1. What is the state of this project?
2. What needs attention now?
3. What is the next meaningful action?
4. Where do I go for deeper project context?

## Implementation Pass - 2026-05-27

Implemented the first structural pass:

- Reduced the project header cover footprint.
- Added a command strip for health, work, timeline, lifecycle, and lifecycle actions.
- Removed the duplicated header metrics and snapshot layer after the first pass proved too repetitive.
- Added an attention queue for blocked, overdue, urgent, due-soon, and at-risk work.
- Suppressed the attention queue for canceled projects.
- Reordered the fixed card hierarchy so project state, planning, and contract context sit ahead of reference modules.
- Moved updates/resources into a lower reference section.

## Current Problems

- The cover/header consumes too much vertical space before the page shows useful project signals.
- The lifecycle controls are structurally important but currently sit too low once the layout collapses to one column.
- Snapshot, workload, priority, and activity read as separate equal-weight widgets even though they are one status-summary concept.
- Empty or low-signal modules such as empty activity, missing GitHub, empty issues, and metadata receive too much space.
- The Project Brief/Contract is useful context, but it should not compete with live work in the first viewport.
- The side rail collapses at realistic app-shell widths, causing secondary controls to become a long tail below the main content.

## Target Information Architecture

### 1. Compact Project Header

Purpose: identity and navigation, not a large profile hero.

Keep:
- Project title
- Status badge
- Priority badge
- Due date or timeline summary
- New Task, Invite, Mindmap, Settings actions

Change:
- Reduce cover height substantially.
- Keep cover media optional and quiet.
- Move the most important operational signals out of the cover area and into the command strip.

Acceptance:
- On a normal desktop app-shell viewport, the header and command strip both fit above the fold.
- The title, lifecycle state, priority, and next action are visible without scrolling.

### 2. Project Command Strip

Purpose: the real overview anchor.

Place directly below the compact header. Use one horizontal or responsive grid strip with:

- Health: score/status and primary risk reason.
- Workload: open tasks, urgent/overdue count.
- Timeline: next due date, overdue state, or no due date.
- Lifecycle: Active, Paused, Canceled, Completed with pause/resume/cancel affordance nearby.

Primary action rules:
- Active project: "New Task" or "Start Focus" if an urgent task exists.
- Paused project: "Resume project".
- Canceled project: show canceled state only, no active-work CTA.
- Completed project: show archive/context action, not active delivery pressure.

Acceptance:
- This strip replaces the scattered feeling of the current snapshot and controls entry points.
- It should not use nested cards. Use compact cells inside one full-width section.

### 3. Attention Queue

Purpose: show only what needs attention now.

This should be the first main body section after the command strip.

Content priority:
- Overdue urgent tasks
- Blocked tasks
- Due-soon tasks
- Critical/high issues
- At-risk initiatives

If empty:
- Collapse to a small "No immediate attention needed" row.
- Do not render a large empty card.

Acceptance:
- The user can identify the most important work in less than 5 seconds.
- The queue should never be mixed with generic reference content.

### 4. Execution Board

Purpose: active work overview.

Layout:
- Main column: Tasks and Initiatives.
- Supporting column or second row: Flows and Issues.

Rules:
- Tasks get priority over flows/issues because they are the most direct execution surface.
- Initiatives should appear near tasks because they explain why the work exists.
- Flows and Issues should collapse when empty or show one compact prompt row.

Acceptance:
- The body reads as "what we are doing" before "what we know".
- Empty modules do not visually compete with active work.

### 5. Planning And Contract

Purpose: project context after live execution.

Combine or sequence:
- Timeline
- Milestones
- Project Brief/Contract
- Success criteria
- Scope/watch item

Recommendation:
- Keep Project Contract as a compact supporting context card, not the first full-width focus area.
- If the brief is incomplete, show one setup row with a clear edit action.

Acceptance:
- The project purpose is visible without pushing live work below the fold.
- Users can understand objective/scope without reading a long form.

### 6. Reference And Activity

Purpose: supporting information only.

Move lower:
- Resources
- Team
- GitHub
- Latest activity
- Metadata

Rules:
- Empty reference modules render as compact rows.
- Metadata should remain last unless debugging/project administration is the main task.
- GitHub should not take a full panel if no repository is linked.

Acceptance:
- The lower page is useful for reference but does not dilute the operational overview.

## Proposed Desktop Layout

```text
Compact Header
Project Command Strip

Main Content
---------------------------------------------------------
Attention Queue                 Project State / Context
Tasks                           Planning Summary
Initiatives                     Project Contract
Flows + Issues                  Milestones

Reference
---------------------------------------------------------
Resources | Team | Activity | GitHub | Metadata
```

## Proposed Medium Layout

The current `1200px` breakpoint collapses the rail too early inside the app shell. Replace the single hard collapse with a medium layout:

```text
Compact Header
Project Command Strip
Attention Queue
Tasks
Initiatives
Project State
Planning + Contract
Flows + Issues
Reference
```

Key rule: Project State should stay near the top even when the side rail collapses.

## Proposed Mobile Layout

Mobile should be command-first:

```text
Header
Command Strip
Attention Queue
Tasks
Initiatives
Project State
Planning
Reference
```

Avoid:
- Full-width empty cards.
- Large cover art.
- Multiple rows of competing icon buttons above the task queue.

## Implementation Phases

### Phase 1: Structural Reorder

Scope:
- Reorder the fixed overview card list.
- Move controls/project-state near the top.
- Introduce an attention queue section.
- Demote empty/reference modules.

Files:
- `web/screens/ProjectOverview.tsx`
- `web/src/styles/components/_project-overview.scss`

Validation:
- Desktop visual smoke at app-shell width.
- Medium width around 900-1100px.
- Mobile width around 390px.
- `npm run build`
- `npm run lint:theme`

### Phase 2: Compact Header And Command Strip

Scope:
- Reduce header height.
- Extract key status metrics into a new command strip.
- Merge health/workload/timeline/lifecycle into one first-viewport command surface.

Rules:
- Do not create nested cards.
- Keep strings in locale files.
- Use existing `Button`, `Badge`, `Card`, `DatePicker`, and `Select` components.

### Phase 3: Empty-State Compression

Scope:
- Convert empty Updates, GitHub, Issues, Resources, and Activity panels into compact rows.
- Show large cards only when there is real content or a primary user action.

### Phase 4: Polish And Responsive QA

Scope:
- Tune spacing, card density, and breakpoint behavior.
- Confirm text does not overflow in action buttons and chips.
- Validate paused, canceled, completed, and active lifecycle states.

## Open Decisions

- Should the command strip include editable controls directly, or should lifecycle edits remain in the Project State card?
- Should "Attention Queue" include only tasks/issues, or also at-risk initiatives and missed milestones?
- Should the cover image remain visible by default, or collapse to a small thumbnail treatment for operational projects?

## Non-Goals

- Do not redesign project subpages in this pass.
- Do not change project lifecycle semantics.
- Do not reintroduce configurable drag-and-drop overview layout until the base hierarchy is stable.
- Do not make Project Contract the top hero element.

## Success Criteria

- The page reads as a project overview in the first viewport, not as a sequence of unrelated cards.
- Project state and next action are visible without scrolling.
- Live work appears before reference material.
- Empty modules do not dominate the page.
- Paused and canceled states remain explicit workflows, but their controls do not overwhelm active execution context.
