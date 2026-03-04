# Swift App Feature Backlog

This list tracks Swift app features that are still missing or need enhancement compared to the web experience.

## Workflow Instructions
- Complete one task at a time.
- Run `xcodebuild -project swift/projectflow.xcodeproj -scheme projectflow -sdk iphonesimulator -derivedDataPath .xcodebuild build` before committing.
- After finishing a task, create a commit with only the changes for that task (short, imperative message).

## Projects List
- [x] Add search + filters (status, priority, owner) and quick sort toggles (health, due date, activity).
- [x] Add inline actions for quick edits (status, priority, due date) without opening the editor.
- [x] Show team presence/avatars on each project card (requires project members fetch).
- [x] Add project-level quick links/resources (drive/figma/etc) once stored on the project.
- [x] Improve empty states per group (Active/Planning/Completed) with guided actions.

## Project Health
- [x] Localize health factors and recommendations (use labelKey/descriptionKey values).
- [ ] Add health trend history and delta comparison (needs snapshot persistence).
- [ ] Add a lightweight health detail preview popover for quick glance (no full sheet).

## Deadlines & Workload
- [ ] Include upcoming milestones and sprint due dates in the project deadline summary.
- [ ] Add overdue/soon thresholds per workspace settings (configurable days).
- [ ] Surface blocked tasks and high-priority issues as separate chips.

## Activity & Updates
- [ ] Add richer activity types (task, issue, status, report, comment, file, member, commit) with distinct icons.
- [ ] Add tap-through to the relevant item (task/issue) from activity rows.
- [ ] Add activity filtering by type and time range.

## Project Overview
- [ ] Wire full layout customization using `ProjectOverviewLayoutStore` (drag/reorder/toggle cards).
- [ ] Replace placeholder widgets (Resources, AI Insights, Team) with live data + actions.
- [ ] Add project controls parity (status/priority/start/due edits) with permission checks.
- [ ] Add upload/cover image actions for project header.

## Collaboration
- [ ] Implement project member list and roles (invite, remove, role change).
- [ ] Add presence indicators (online/busy/idle) once presence hooks are connected.

## Quality
- [ ] Add localization keys for new strings and ensure English/DE parity.
- [ ] Add accessibility pass for cards and chips (VoiceOver labels, tap targets).
- [ ] Add UI tests for Projects list grouping and health sheet.
