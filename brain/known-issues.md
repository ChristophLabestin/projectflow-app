# Known Issues

Last updated: 2026-06-04

## Issue List

- Billing E2E not yet possible: no Stripe test key in Secret Manager (found 2026-10-23).
  - Impact: `createBillingCheckout`, `createBillingPortal`, `stripeWebhook`, `onMemberWrittenBilling` are not deployed; the billing tab shows "Billing is not set up yet" on checkout.
  - Status: waiting for the owner (`firebase functions:secrets:set STRIPE_SECRET_KEY`, then steps in [plans/billing-implementation.md](./plans/billing-implementation.md)). ProjectFlow initiative for billing not created: `PROJECTFLOW_API_TOKEN` missing.
- Task/project reminders are stored but never delivered (found 2026-10-22).
  - Impact: `reminders[]` / `reminderAt` set in the task workbench or project overview never trigger a push or email; `functions/src/scheduler.ts` has no reminder job.
  - Status: open; planned as a Phase 0 backend prerequisite in [plans/ios-app-concept.md](./plans/ios-app-concept.md) §9.4 (recipients decided 2026-10-22: creator by default, assignees optional — concept §12.3).
- Status pill text fails WCAG AA in light mode (found 2026-10-22).
  - Impact: status colours at full strength on their 12 % tint reach only 2.0–3.6:1 (e.g. Review `#F59E0B` 2.0:1); `--color-text-subtle` `#8F8F8F` is 2.9:1 on the canvas.
  - Decision 2026-10-22: adopt darker text tones per status (table in [plans/ios-app-concept.md](./plans/ios-app-concept.md) §4.1), shared by web and iOS.
- Web focus/pins do not sync live across devices (found 2026-10-22).
  - Impact: `PinnedTasksContext.tsx` reads the user profile once and writes `pinnedItems` as a whole debounced array, so a focus changed on another device is not reflected and concurrent edits can overwrite pins.
  - Status: open; listed in the iOS concept §9.4.

- ProjectFlow tracking unavailable in the current shell.
  - Impact: the 2026-10-22 iOS reset + concept session, the Brain migration, Flow/Issue removal cleanup, Task Full Workbench redesign, Project Overview menu clipping bugfix, task relationships expansion, Project Overview border removal, Project Overview board-view redesign, subtask delete confirmation bugfix, Project Overview Board/Kanban consolidation, Board dark-mode surface fix, task detail tenant-context loading fix, global search project-name lookup fix, sidebar Project Switcher redesign, UI Style Guide standardization expansion, UI primitive v1 standardization, and project/task reminders could not create the required ProjectFlow initiative/task automatically.
  - Evidence: `python3 plugins/projectflow-codex/scripts/projectflow_session.py start ... --entity initiative` and `python3 plugins/projectflow-codex/scripts/projectflow_session.py start --title "Improve sidebar project switcher" --entity task` returned `Missing PROJECTFLOW_API_TOKEN.`
  - Status: unresolved environment/configuration issue.
  - Workaround: set `PROJECTFLOW_API_TOKEN` and rerun the ProjectFlow Codex session command from [commands-and-environment.md](./commands-and-environment.md).

## Workarounds

- When the ProjectFlow API cannot be reached, record the attempted tracking action in this file and [handoff.md](./handoff.md); do not invent task ids.
