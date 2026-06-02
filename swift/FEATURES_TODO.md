# Swift App Feature Backlog

Phases 0–6 of the iOS web parity plan are implemented. Remaining polish items:

## Project Health
- [x] Add health trend history UI using persisted snapshots
- [x] Lightweight health detail preview popover

## Deadlines & Workload
- [x] Include milestone/sprint due dates in project deadline summary chips
- [x] Configurable overdue/soon thresholds per workspace

## Activity & Updates
- [x] Richer activity type icons and tap-through filters
- [x] Activity time-range filtering

## Project Overview
- [x] ~~Drag/reorder overview cards on device~~ — not needed (excluded)
- [ ] Project cover image upload from iOS

## Quality
- [x] Lightweight EN/DE strings via `L10n.swift` (partial parity with web/locales)
- [x] VoiceOver accessibility pass (tab bar, health widget, activity, signal chips)
- [ ] XCTest target + UI tests for lifecycle grouping and focus loop
- [ ] Full `Localizable.xcstrings` parity with web/locales en+de

## Completed (parity plan)
- [x] AppSession, extended models, repositories, permissions loader
- [x] Tab bar: Home / Projects / Focus / Work / Inbox
- [x] Initiatives, personal tasks, multi-type focus/pins
- [x] Company projects, lifecycle groups, module-gated project nav
- [x] Comments, Codex read-only, milestones/sprints/activity views
- [x] Calendar, team, settings theme, web deep links for excluded modules
