# PM Focus UI Redesign

Date: 2026-09-26
Status: in implementation (see handoff for what shipped)

Goal from the user: easy to handle, focus on what matters right now, find what to do fast, adjust things fast.

## Evaluation (seeded emulator walkthrough, desktop 1440 + mobile 375)

Reviewed: Dashboard, My Tasks, Calendar, Projects list, Project overview, Project tasks, Task detail, Initiatives, Sprints, Milestones, Team, invite flows.

What works: Dashboard "today" plan (ordered, actionable), task detail workbench (status/priority/assignee/dates in one rail, next step visible), sprint board, milestone timeline.

Problems, ordered by impact on "what do I do next":

1. **Task lists don't answer "what's next".** My Tasks and Project Tasks are flat lists sorted by one field. Overdue, today and later work sit side by side; nothing is grouped.
2. **Slow adjustments.** My Tasks can't change status/date/assignee inline. Project Tasks can, but each row carries 4 icon buttons (convert, delete, pin, open) plus an "Add category" chip. The noise hides the real metadata, and the assignee is not shown at all.
3. **Prime space spent on metrics.** Four stat cards ("Urgent 2 · List") sit above every list. On mobile the first task appears only after a full screen of header, quick add, stats and filters.
4. **Bad defaults.** Quick add defaults to the alphabetically first project, which can be a completed one.
5. **Interruptions.** Every page auto-started its own step tour on first visit, and on first login the passkey upsell stacked on top of the welcome dialog.
6. **Date bugs.** Date-only strings were parsed as UTC:
   - tasks due today were flagged overdue after 02:00;
   - the calendar showed "02:00" times and dropped every task whose status was not Open/In Progress (Todo, Review, Blocked…);
   - the projects hero printed "OVERDUE" next to future due dates.
7. **Smaller mishaps.**
   - Initiative cards show a placeholder that references removed Flows.
   - Project overview initiative rows collapse on mobile.
   - Team page had hard-coded German strings.
   - Guests saw Finance/Media.

## Design

**One shared work list** (`components/work/`) used by My Tasks and Project Tasks:

- **Groups** by due bucket: Overdue → Today → Next 7 days → Later → No date.
  - Counts are shown in each group header.
  - Groups are collapsible and remembered per list.
  - Project Tasks can also group by Status or Assignee.
- **Row**: complete checkbox · title · project chip (cross-project lists only) · subtasks n/m · status pill · priority mark · due chip · assignee avatar.
  - Status, priority, due and assignee are **inline menus**.
  - Due menu offers quick picks: Today, Tomorrow, Next week, Clear, plus a date input.
  - Destructive and rare actions (delete, convert) live in the task detail, not on the row.
- **Header**: title plus one summary line ("2 overdue · 2 today · 4 this week"), replacing the stat cards.
- **Quick add**: always on top.
  - Enter adds the task.
  - The project defaults to the last used *active* project.
  - `N` focuses the quick-add field from anywhere on the page.
- **Filters** in one compact row: search, project, priority, show completed.
- **Bulk actions** only appear once rows are selected (Project Tasks).

**Global**:
- Page tours no longer auto-start; only the one-time dashboard welcome is offered.
- The passkey upsell waits until no onboarding dialog is open.

## Critical review of the design (and resulting adjustments)

- *Rewriting both 600–1500 line screens is risky.* Keep each screen's data loading and mutation handlers and replace only the list rendering, header and filters. Keep the existing grid/board views as secondary views.
- *Grouping by due date hides the status flow in project work.* Add a group-by switch (Due / Status / Assignee) for Project Tasks. My Tasks stays due-first, because that is the "what now" question.
- *Inline menus must not become another popover zoo.*
  - Use one small `InlineMenu` primitive: keyboard-accessible, closes on outside click or Escape, positioned under its trigger.
  - Reuse the existing `updateTask` service for all edits, with optimistic updates and rollback.
- *Removing delete from rows could frustrate power users.* Delete stays in the task detail and in the Project Tasks bulk bar. Nothing is lost, it just stops competing with the frequent actions.
- *Project overview and task detail are under active parallel work by the user.* Only small fixes land there: the mobile initiative rows and the placeholder text. No redesign.
- *Status vocabulary.* `Todo` is a legacy alias of `Open`. The shared list normalises it so the inline status menu offers one option.
