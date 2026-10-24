# Golden fixtures for shared ProjectFlow logic

These fixtures pin the behaviour of the pure TypeScript modules that the web app and the iOS app
(`PFDomain`) both implement. Web runs them with Vitest, iOS runs the same files with XCTest, and CI
fails when either side deviates.

| Fixture folder | TS source | Function under test |
|---|---|---|
| `dayPlan/` | `web/utils/dayPlan.ts` | `buildDayPlan(input)` |
| `dueBuckets/` | `web/utils/dueBuckets.ts` | `groupByDueBucket` + `summarizeDue` (see adapter below) |
| `attention/` | `web/utils/attention.ts` | `buildAttention(input)` |
| `portfolioGroup/` | `web/utils/attention.ts` | `classifyPortfolio(input)` |
| `globalSearch/` | `web/utils/globalSearch.ts` | `parseQuery(query)` |
| `globalSearchScore/` | `web/utils/globalSearch.ts` | `scoreCandidate(terms, title, secondary)` |
| `formsSchema/` | `web/utils/formsLogic.ts` | `{ issues: validateFormSchema(schema) }` |
| `formsVisibility/` | `web/utils/formsLogic.ts` | `visibleFormItems(schema, answers)` |
| `formsSubmission/` | `web/utils/formsLogic.ts` | `validateSubmission(schema, answers)` |
| `formsQuota/` | `web/utils/formsLogic.ts` | `formQuotaFor(entitlement, tenant)` |

Shared date helpers live in `web/utils/zonedDate.ts` (port them first, everything else builds on them).
The exact calling convention of every fixture is `web/utils/fixtureRunners.ts`.

## Files, running and regenerating

* One case per file: `shared/fixtures/<folder>/NN-slug.json` with exactly three keys:
  `{ "name": string, "input": object, "expected": object }`.
* Everything is plain JSON: strings, numbers, booleans, `null`, arrays, objects. No `NaN`, no
  `Infinity`. A key that the TypeScript code leaves `undefined` never appears in `expected`; where a
  field can be absent it is written as an explicit `null` instead (documented per field).
* Run on web: `cd web && npx vitest run utils/__tests__/goldenFixtures.test.ts`.
* Regenerate after an intentional logic change: `cd web && node ../shared/fixtures/generate.mjs`.
  The generator holds the case inputs and writes `expected` by running the TypeScript
  implementation. **Always review the diff by hand**; fixtures are the contract. The generator output
  does not depend on the machine's time zone (verified with `TZ=America/Los_Angeles`, `Asia/Tokyo`,
  `Pacific/Auckland`).
* iOS: decode each file, run the equivalent Swift function on `input`, and assert deep equality with
  `expected` (numbers exactly equal; all fractional numbers in the fixtures are exact binary or
  rounded to three decimals).

## Conventions shared by all modules

### Fixed "now" and time zone

Every module takes `now` (an instant) and `timeZone` (IANA name, e.g. `Europe/Berlin`). Nothing reads
the system clock or the device time zone. The fixtures use
`now = 2026-10-22T10:00:00.000Z` (Thursday 22 Oct 2026, 12:00 in Berlin / CEST, 03:00 in Los Angeles)
unless the case is about time zones. If `timeZone` is missing the web falls back to the browser zone;
iOS must pass `TimeZone.current.identifier` (or the user's `notificationPrefs.timezone`).

### Date values (`DateLike`)

Every date field (`dueDate`, `scheduledDate`, `createdAt`, `completedAt`, `snoozedUntil`, project
`dueDate`, `now`) accepts these shapes, because Firestore data contains all of them:

| JSON shape | Meaning |
|---|---|
| `"2026-10-22"` (date-only, regex `^\d{4}-\d{2}-\d{2}$` after trimming) | A calendar **day**, not an instant. It never shifts with the time zone. As an instant (rarely needed) it is the start of that day in `timeZone`. |
| `"2026-10-22T08:00:00.000Z"`, `"…+05:30"`, `"…+0530"`, `"…+05"` | An exact instant. The offset (or `Z`) is applied; fractional seconds are ignored. |
| `"2026-10-22T07:30:00"` or `"2026-10-22 07:30"` (no offset) | Wall-clock time in `timeZone` (so 07:30 Berlin = 05:30Z in October). |
| `{ "seconds": 1792663200, "nanoseconds": 123000000 }` (also `_seconds`) | Firestore Timestamp: instant = `seconds * 1000` ms. **Nanoseconds are ignored.** |
| `1792663200000` (number) | Epoch milliseconds. |
| `""`, `null`, absent, or unparseable text | No date. (Unparseable text like `"tomorrow-ish"` has no day but still counts as *present* for the "undated" checks below, because the legacy check is `Boolean(value)`.) Other textual formats (e.g. RFC 2822) fall back to the JavaScript date parser on web; they are not specified or covered here, iOS may treat them as "no date". |

Two derived notions are used everywhere:

* **day of a value** (`toDay`): date-only string → itself; any other valid value → the calendar day
  (`YYYY-MM-DD`) its instant falls on in `timeZone`; no date → `null`.
* **today** = day of `now` in `timeZone`. **Day difference** `daysBetween(a, b)` = `b − a` in whole
  calendar days (pure calendar arithmetic, DST-proof). Overdue = day of due date `<` today; due today
  = day equals today.

`startOfDay(day, timeZone)` is the instant at which that day starts in the zone (Berlin on
2026-10-25 starts at `2026-10-24T22:00:00Z`; that day has 25 hours). `clockLabel(instant, timeZone)`
is the 24-hour `HH:mm` wall-clock time.

Instant arithmetic (the "24 hours" and "7 days" windows) is plain milliseconds, **not** calendar
days: `completedWeek` etc. use `now − 7 × 86 400 000 ms`.

`dateSortKey(value)` = the instant of the value (date-only → start of its day in the zone); missing
or invalid → `+∞` (sorts last).

### Open vs. completed, status

* `isCompleted` is the **only** authority for open/closed. `status` is never used to infer it:
  `status: "Done"` with `isCompleted: false` is still open; `isCompleted: true` with
  `status: "Blocked"` is closed. (The server trigger keeps both in sync, C1.)
* `status` only matters as `"Blocked"` in the day plan and attention. Legacy `"Todo"` and a missing
  status read as `"Open"` (`normalizeStatus`).
* `normalizeStatus(task)`: completed → `"Done"`; missing or `"Todo"` → `"Open"`; otherwise the raw
  status string.

### Sorting

All sorts must be **stable with ties in input order** (JavaScript guarantees this; Swift's `sort`
does not, so sort by `(key, originalIndex)`). Where a comparison is called "priority rank":

* day plan: `Urgent 0, High 1, Medium 2, Low 3`; missing or unknown → `2` (ascending = most urgent first).
* due buckets: `Urgent 4, High 3, Medium 2, Low 1`; missing → `Medium`; unknown string → `0`
  (descending = most urgent first).

### i18n messages

The modules never produce user-facing text. They return keys from `web/locales/dashboard-*.ts`
(`dashboard.today.*`, `dashboard.route.*`, `dashboard.band.*`, `dashboard.week.*`,
`dashboard.pulse.*`, `dashboard.accent.*`) plus parameters:

```jsonc
{ "key": "dashboard.today.reason.overdueDays", "params": { "days": 3 }, "text": null }
```

The UI looks up `t(key)` and replaces every `{name}` placeholder with `params[name]`. When `key` is
`null`, show `text` verbatim (a blocker note typed by a user). A *statement* additionally has
`value` (the emphasised part that replaces `{value}`; a count as a string, or a task title) and
`valueKey` (an i18n key whose translation replaces `{value}` when the value is itself a phrase, e.g.
`dashboard.route.statement.clearValue`).

## `dayPlan` — `buildDayPlan(input)`

"Your plan for today" (web Dashboard slide 1, iOS "Heute"): plan stops, headline, day band, week
strip, overnight feed, waiting-on-me list.

### Input

```jsonc
{
  "now": "2026-10-22T10:00:00.000Z",     // DateLike (instant)
  "timeZone": "Europe/Berlin",           // IANA
  "projects": [ { "id": "p-web", "title": "Website Relaunch", "dueDate": "2026-10-24" } ],
  "tasks": [ /* my project tasks */ ],
  "personalTasks": [ /* my personal tasks, optional */ ],
  "otherTasks": [ /* other people's tasks, optional */ ],
  "focus": null                           // or a focus object
}
```

* `projects` — **active projects only**. The web filters with `isProjectActiveForGlobalSignals`
  (status `Active` or `In Testing`, and not `Canceled`). Tasks of projects not listed here are
  ignored everywhere (they do not count, do not block and cannot be focused). `dueDate` (optional)
  counts in the week strip.
* `tasks` — the current user's open **and** completed project tasks (assigned to them, or owned by
  them while unassigned). Task fields (all optional except `id`, `title`):

  | Field | Type | Use |
  |---|---|---|
  | `id`, `title` | string | identity and display |
  | `projectId` | string | must be in `projects`, else the task is dropped |
  | `tenantId` | string | echoed on stops |
  | `status` | string | only `"Blocked"` matters (see above) |
  | `isCompleted` | bool | open/closed |
  | `priority` | `Urgent`/`High`/`Medium`/`Low` | stop ordering, suggestions |
  | `dueDate`, `scheduledDate` | DateLike | buckets, ordering, week strip |
  | `createdAt` | DateLike | suggestions (age), overnight "new" |
  | `completedAt` | DateLike | week badge, overnight "done" |
  | `dependencies` | string[] | ids of tasks that block this one |
  | `blockerNote` | string | follow-up reason |
  | `nextStep` | string | focus reason |
  | `assigneeIds` | string[] | echoed in waiting entries (other people's tasks) |

* `personalTasks` — decision §12.5: personal tasks have **no `projectId`** and live outside projects.
  They count only when overdue, due today or scheduled today; undated ones may appear only as quiet-day
  suggestions; future-dated ones are ignored. They are never "blocked", never block anything and
  never appear in `waitingOnMe`. They produce no `done`/`new` overnight entries and are not part of
  the week badge or completion counts, but they *do* appear in the week strip (due/scheduled dates),
  in `becameOverdue` overnight entries, in `counts`, and in `moreCount`. Their stop ids are
  namespaced `personal:<id>`, so a personal and a project task may share an `id`.
* `otherTasks` — tasks of other people in the same projects. Used only for (a) the "frees up N"
  count, (b) the dependency title in blocked reasons, (c) the "waiting on me" list. Entries whose id
  also appears in `tasks` are ignored; tasks of inactive projects are ignored.
* `focus` — the pinned/focused item: `{ id, type ("task"|"initiative"), title, projectId?, tenantId?,
  isCompleted?, status? ("active"|"snoozed"|"blocked"), snoozedUntil? (DateLike) }` or `null`.

### Derived sets (computed in this order)

Let `open` = my open project tasks (in input order) followed by my open personal tasks (in input
order).

1. `overdue` = open tasks whose due day is before today.
2. `dueToday` = open tasks whose due day is today.
3. `scheduledToday` = open tasks scheduled today **and** not due today **and** not overdue.
4. `blocked` = my open **project** tasks with `status == "Blocked"`.
5. `queue` = `overdue ++ dueToday ++ scheduledToday`, de-duplicated by task key (first occurrence
   wins; key = `id`, or `personal:<id>` for personal tasks). A task that is overdue *and* due today
   cannot exist; one that is overdue and scheduled today is only in `overdue`.
6. `unblocks[id]` = number of times `id` appears in the `dependencies` of an **open** task from `tasks`
   or `otherTasks` (duplicates in one list count each time).
7. `taskById` = all project tasks (`tasks` and `otherTasks`, completed included) by id.

### Stops (ordered, at most 4)

`MAX_STOPS = 4`. A task already in `stops` is never added again.

1. **Focus**: if `focus.projectId` is an active project, the focus is **not snoozed**
   (`status == "snoozed"` and `snoozedUntil > now` ⇒ snoozed), `focus.isCompleted` is falsy, and the
   task `taskById[focus.id]` is missing or not completed → add a `focus` stop
   (`tone: info`, `itemType` = `"initiative"` if `focus.type == "initiative"` else `"task"`).
   Reason: `dashboard.today.reason.focusNext {next}` when that task has a `nextStep`, otherwise
   `dashboard.today.reason.focusResume`.
2. **Overdue**, sorted by `dateSortKey(dueDate ?? scheduledDate)` ascending (oldest first), `tone:
   danger`. `days = max(1, daysBetween(dueDay, today))`; reason
   `dashboard.today.reason.overdueYesterday` when `days <= 1`, else
   `dashboard.today.reason.overdueDays {days}`.
3. **Due today**, sorted by priority rank (day-plan ranks), `tone: warning`, reason
   `dashboard.today.reason.dueToday`.
4. **Scheduled today** in input order, `tone: neutral`, reason `dashboard.today.reason.scheduled`.
5. **Follow-ups** for `blocked` tasks in input order (only while fewer than 4 stops), `tone: neutral`,
   stop id `follow:<key>`. Reason: the `blockerNote` as literal `text` if present; else, if
   `dependencies[0]` resolves via `taskById` to a task that is not completed,
   `dashboard.today.blockedRail.dependency {title}`; else `dashboard.today.blockedRail.fallback`.
   The UI wraps the title in `dashboard.route.followUp {title}`; `title` in the output is the raw title.
6. **Quiet-day suggestions** — only if there are **fewer than 3** stops so far. Candidates: open tasks
   (project and personal) not yet in `stops`, `status != "Blocked"`, and with **no** `dueDate` and
   **no** `scheduledDate` (falsy check). Sort by priority rank ascending, then `createdAt` instant
   ascending (a missing/invalid `createdAt` counts as `0`, i.e. oldest). Add candidates until there
   are 3 stops in total (`MAX_SUGGESTED_STOPS = 3`). Stop id `suggest:<key>`, `proposed: true`,
   `tone: neutral`. Reason: priority `Urgent`/`High` → `dashboard.route.suggest.important`; else
   age ≥ 7 → `dashboard.route.suggest.aged {days}` where `age = max(0, floor((now − createdAt) /
   86 400 000 ms))` (0 when `createdAt` is missing); else `dashboard.route.suggest.pick`.

Stop fields:

| Field | Meaning |
|---|---|
| `id` | unique within the plan: `<taskId>` · `personal:<id>` · `follow:<key>` · `suggest:<key>` |
| `kind` | `focus`, `overdue`, `dueToday`, `scheduled`, `followUp`, `suggestion` |
| `tone` | `info` (focus), `danger` (overdue), `warning` (dueToday), `neutral` (others) |
| `proposed` | true for suggestions |
| `taskId`, `title` | raw ids/titles (`title` for follow-ups is the raw task title) |
| `itemType` | `task`, `initiative`, `personal` |
| `projectId`, `tenantId` | or `null` |
| `projectName` | title from `projects`, `""` for personal tasks / unknown |
| `isPersonal` | show a lock instead of the project name |
| `priority` | task priority or `null` (focus stop: priority of the matching task) |
| `reason` | message (see above) |
| `unblocksCount` | `unblocks[taskId]` for `overdue`/`dueToday` stops; `0` for all others. UI appends " · Frees up N other task(s)" (`dashboard.today.reason.unblocksOne` / `.unblocks {count}`) when > 0 |
| `canFocus` | `projectId` set and not personal and not a follow-up (focus stops: true) |

### Other outputs

| Field | Meaning |
|---|---|
| `today`, `timeZone` | the resolved day and zone |
| `moreCount` | number of `open` tasks that are **not** in `stops` (by task key) — "+ N more" |
| `isSuggested` | `stops` is non-empty and every stop is `proposed` |
| `counts.overdue / dueToday / scheduledToday` | sizes of the sets above |
| `counts.queue` | size of `queue` |
| `counts.blocked` | size of `blocked` |
| `counts.open` | size of `open` |
| `counts.undated` | open tasks with no `dueDate` and no `scheduledDate` (falsy) and `status != "Blocked"` |
| `counts.completedLast7Days` | my completed **project** tasks with `completedAt >= now − 7d` (ms) |
| `counts.completedPrevious7Days` | same with `now − 14d <= completedAt < now − 7d` |
| `topUnlocker` | my open project task with the highest `unblocks` (> 0), first one wins ties: `{ taskId, title, count }` or `null` |

### Statement (`statement`)

First match wins; `stops` is the list above, `K = stops.length`:

1. `K == 0` → `dashboard.route.statement.clear`, `value: null`, `valueKey: dashboard.route.statement.clearValue`.
2. `isSuggested` → `suggestOne` (K == 1) or `suggest`, value `String(K)`.
3. `queue.length == 0 && blocked.length > 0` → `waitingOne` (1 blocked) or `waiting`, value `String(blocked.length)`.
4. `K == 1` → `dashboard.route.statement.one`, value = `stops[0].title`.
5. `overdue.length > 0` → `behind` if `stops[0].tone == "danger"` else `behindLater`, value `String(K)`.
6. otherwise `clean`, value `String(K)`.

All keys are `dashboard.route.statement.<name>`; `params` is always `{}`. Note the value counts *stops*
(max 4); the honest remainder is `moreCount`.

### Day shape and cause line (`dayShape`, `cause`)

`dayShape`: `queue == 0 && blocked > 0` → `waiting`; `queue == 0` → `clear`; `overdue > 0` →
`behind`; `queue >= 6` → `heavy`; else `doable`.

`cause` (first match):

1. `behind` and an oldest overdue task (smallest `dateSortKey(dueDate)`, ties: first) exists →
   `dashboard.today.insight.oldestOverdueOne {title}` when its overdue days ≤ 1, else
   `…oldestOverdue {days, title}`.
2. `waiting` → `…blockedNote {title, note}` for `blocked[0]` when it has a note, else `…blockedPlain {title}`.
3. `heavy`/`doable` and the project with the most `queue` tasks (counting tasks with a `projectId`;
   ties: the project that appears first in the queue) has more than one → `…loadCenter {project, count}`.
4. `heavy`/`doable` and the queue spans more than one project → `…spread {count}` (number of projects).
5. `clear` and `focus.projectId` is an active project → `…focusOpen {title}` (the focus title; snooze
   and completion are *not* checked here).
6. `counts.completedLast7Days > 0` → `…momentum {count}`.
7. otherwise `…fresh`.

### Day band (`band`)

`dueCount = queue.length − overdue.length`; `cap(n) = min(n, 6)`.
`segments` in order: `cap(overdue)` × `{key: "overdue-<i>", type: "overdue", flex: 1.3}`, then
`cap(dueCount)` × `{"due-<i>", "due", 1}`, then `cap(blocked)` × `{"waiting-<i>", "waiting", 0.8}`, then
one `{key: "rest", type: "rest", flex: max(used > 0 ? 2 : 8, 8 − used)}` rounded to three decimals,
where `used` is the sum of the previous flex values. `caption` lists, in order and only when > 0:
`{key: "overdue", tone: "danger", count: overdue}`, `{key: "due", tone: "warning", count: dueCount}`,
`{key: "waiting", tone: "neutral", count: blocked}`; the UI uses `dashboard.band.<key>` with `{count}`
(or `dashboard.band.allFree` when the caption is empty, `dashboard.band.free` after it).

### Week strip and badge (`week`)

`days` = 7 entries Monday → Sunday of the week containing today: `{date, weekday (Mon = 0), count,
isToday, isWeekend (weekday >= 5)}`. `count` = for each open task (project + personal): +1 for its due
day, +1 more for its scheduled day (even when the same day), and +1 per active project for the
project `dueDate` — matched by day. `total` = sum of counts. `badge` = message from `completedLast7Days
= c` and `completedPrevious7Days = p`: `c == 0` → `dashboard.week.none`; `c > p` →
`dashboard.week.more {count: c, diff: c − p}`; `c < p` → `dashboard.week.fewer {count: c, diff: p − c}`;
else `dashboard.week.same {count: c}`.

### Overnight (`overnight`)

Entries (before cutting), in this emission order:

1. for each of **my project tasks** (not personal), in input order: completed with `completedAt >=
   now − 24 h` → `{kind: "done", timeMs: completedAt}` (then skip the "new" check for that task);
   otherwise not completed and `createdAt >= now − 24 h` → `{kind: "new", timeMs: createdAt}`.
2. for each task in `overdue` (project and personal) whose due day is **yesterday**
   (`daysBetween(dueDay, today) == 1`) → `{kind: "overdue", timeMs: startOfDay(today), time: "00:00"}`.

Sort by `timeMs` ascending (ties: emission order), keep the **last 4**. `time` is `clockLabel(timeMs)`
for done/new. `key` = `done:<id>` / `new:<id>` / `overdue:<key>`, `tone` = `success` / `info` /
`warning`. The UI maps kinds to the symbols ✓ / + / ! and, for `overdue`, to
`dashboard.night.becameOverdue {title}`.

### Waiting on me (`waitingOnMe`)

Two kinds, in this order:

1. `dependent` — for each **open task of other people** (`otherTasks`, in input order) whose
   `dependencies` contain the id of one of **my open project tasks**; the *first* such dependency in
   that list is the blocker. Entry: `{kind: "dependent", taskId, title, projectId, projectName,
   assigneeIds (the waiting task's), blockerTaskId, blockerTitle, note: null}`. Sorted by
   `dateSortKey(blocker.dueDate ?? blocker.scheduledDate)` ascending (blocker due first, undated
   last), ties in input order.
2. `blocked` — my own `blocked` tasks in input order: `{kind: "blocked", taskId, title, projectId,
   projectName, assigneeIds: [], blockerTaskId/blockerTitle: the first dependency if it resolves to an
   open task (else null), note: blockerNote or null}`.

The list is complete; UIs show the first few.

## `dueBuckets` — My tasks grouping

Fixture input: `{ now, timeZone, tasks: [{ id, title, dueDate?, priority?, status?, isCompleted? }] }`.
Adapter (see `fixtureRunners.ts`): `groups = groupByDueBucket(tasks, {now, timeZone})`,
`summary = summarizeDue(tasks, {now, timeZone})`; output

```jsonc
{ "groups": [ { "key": "overdue", "tasks": [ { "id": "a", "status": "Open" } ] } ],
  "summary": { "overdue": 2, "today": 1, "week": 1, "open": 6 } }
```

where `status` is `normalizeStatus(task)`.

* Bucket of an **open** task from `diff = daysBetween(today, dueDay)`: no valid due date → `none`;
  `diff < 0` → `overdue`; `0` → `today`; `1…7` → `week` ("next 7 days", i.e. up to and including
  today + 7); `> 7` → `later`.
* Open tasks (`isCompleted` falsy) are sorted by `compareWork`: `dateSortKey(dueDate)` ascending
  (undated last) → then priority rank descending (`Urgent 4 … Low 1`, missing `Medium`,
  unknown `0`) → then `title.localeCompare` (locale-aware, **not** numeric; fixtures only compare ASCII
  titles that differ in their letters) → then input order. Two tasks on the same day order by time of
  day when both carry one; a date-only due date sorts as the start of its day, i.e. before timed ones.
* Groups come in the order `overdue, today, week, later, none, done`; **empty groups are omitted**.
* `done` (completed tasks, `isCompleted` truthy) is sorted by `dateSortKey(dueDate)` **descending**
  (so undated completed tasks come first), ties in input order.
* `summary`: counts over open tasks only; `week` = `1…7` days ahead; `open` = all open tasks.

## `attention` — portfolio "where to look"

Input:

```jsonc
{
  "now": "…", "timeZone": "Europe/Berlin",
  "projects": [ { "id", "title", "status?", "dueDate?", "health?": { "status": "critical|warning|…", "trend": "declining|…" } } ],
  "tasks":    [ { "id", "title?", "projectId", "isCompleted?", "status?", "dueDate?", "createdAt?", "completedAt?" } ],
  "unlocker": { "title": "CMS schema", "count": 3 }   // optional: dayPlan.topUnlocker
}
```

`projects` are **active projects only** (as for `dayPlan`); `tasks` are the user's own project tasks
(tasks of unlisted projects are ignored). Project health is **not** recomputed: pass the status
(`critical`, `warning`, anything else counts as neutral) and trend (`declining` matters) you have (web:
`calculateProjectHealth`, iOS: server snapshot).

Per project (`entries`, input order): `open` = its open tasks, `overdue` = open tasks with a due day
before today, `blocked` = open tasks with status `Blocked`, `completedWeek` = completed tasks with
`completedAt >= now − 7d` (ms), `lastActivity` = max over **all** its tasks of `createdAt` and
`completedAt` instants (missing = 0), `stalledDays` = `floor((now − lastActivity) / 86 400 000)` or
`null` when `lastActivity == 0`, `deadlineDays` = `daysBetween(today, dueDay)` when the project
`dueDate` is a later day, else `null`. `stalled` = `stalledDays >= 7 && open > 0`. `declining` =
`health.trend == "declining"`; `critical`/`warning` = `health.status`.

`score = 3·overdue + 2·blocked`, `+6` if critical else `+3` if warning, `+3` if declining, `+3` if
stalled, `+2` if `deadlineDays <= 7 && open > 3`.

`chips` (in this order, then truncated to the first 3): `overdue {count}` (danger) if overdue > 0;
`blocked {count}` (danger) if blocked > 0; `stalled {days}` (warning); then exactly one of `declining`
(warning), else `critical` (danger), else `warning` (warning); `deadline {days}` (info) if
`deadlineDays <= 14`. Each chip is `{key, tone, labelKey: "dashboard.pulse.chip.<key>", params}`.

Entry fields: `projectId, title, openCount, overdueCount, blockedCount, stalledDays, deadlineDays,
completedWeek, score, chips`.

Result fields:

| Field | Meaning |
|---|---|
| `attention` | project ids with `score >= 3`, sorted by score descending (stable), first 3 |
| `quietCount` | `max(projects.length − attention.length, 0)` |
| `rail` | ids with `openCount > 0` sorted by `openCount` descending (stable), first 4 (Today rail) |
| `workload` | same ordering, first 5 (workload bars) |
| `bestRun` | project with the most `completedWeek` (stable, first wins) if that is > 0: `{projectId, completedWeek}`, else `null` |
| `statement` | `projects` empty → `dashboard.pulse.statement.none` + `valueKey …noneValue`; `attention` non-empty → `driftingOne`/`drifting` with `params {total: projects.length}` and `value = String(attention.length)`; else `steadyOne`/`steady` with `value = String(projects.length)` |
| `insight` | worst = `attention[0]`: if it has chips → `dashboard.pulse.insight.worst {project}` plus `chips` (UI joins the localized chip labels with ", " into `{reasons}`); else `bestRun` → `…bestRun {project, count}`; else `…quietAll` |
| `accent` | the most stalled project (`stalledDays >= 7 && open > 0`, max `stalledDays`, first wins): `dashboard.accent.stalledDeadline {project, deadline, days}` if it has `deadlineDays`, else `dashboard.accent.stalled {project, days}`; else if `unlocker.count > 0` → `dashboard.accent.unlock {title, count}`; else `null` |
| `stats` | `{projects, open: Σ openCount, overdue: Σ overdueCount, doneWeek}` |
| `momentum` | `current` = completed tasks with `completedAt >= now − 7d`, `previous` = `now − 14d <= completedAt < now − 7d`, `caption` = `previous == 0 && current > 0` → `dashboard.pulse.momentum.firstWeek`; `current > previous` → `up {diff}`; `current < previous` → `down {diff}`; else `flat`; `trend` = 14 `{date, value}` buckets, oldest first, ending today: number of completed tasks whose `completedAt` day equals `date` |
| `wins` | up to 3 messages in order: `current > 0` → `dashboard.pulse.wins.completedWeek {count}`; `bestRun` → `…bestProject {project, count}`; `quietCount > 0` → `…quietProjectsOne`/`…quietProjects {count}` |
| `horizon` | next 4 deadlines `{kind: "task"\|"project", id, title, projectId, day}`: open tasks with a due day 1…14 days ahead and projects with a deadline 1…14 days ahead, sorted by `dateSortKey` ascending (stable; tasks are collected before projects, so a task wins a tie) |

### `portfolioGroup` — project list grouping

Input: `{ now, timeZone, projects: [{ id, title, status, dueDate?, health?: {status} }], tasks: [...],
loadedProjectIds?: string[] }`. Output: `[{ projectId, group }]` in project order. Signals per project
exist only if the project is in `loadedProjectIds` (or the list is omitted): `overdue` = open tasks
with a due day before today, `blocked` = open tasks with status `Blocked`; otherwise `signals = null`.
Group by `status`: `Completed`/`Canceled` → `closed`; `On Hold` → `paused`; `Planning`/`Brainstorming`/`Backlog`
→ `planning`; everything else → `attention` when `signals.overdue > 0` or `signals.blocked > 0`
(signals present), or `health.status == "critical"`, or the project's own due day is before today —
otherwise `active`.

## `globalSearch` — query parser (`parseQuery`)

Input `{ "query": string }`; output `{ raw, prefixScope, terms, taskFilters, priority, hasTaskFilters }`
(`prefixScope`/`priority` are `null` when absent).

1. `rest = query` with **leading** whitespace removed (JS `trimStart`).
2. If the first character of `rest` is `>`, `#`, `!` or `?`, remove it and set `prefixScope` to
   `commands`, `projects`, `tasks` or `help`. The prefix is only recognised at the very start.
3. Split `rest` on runs of whitespace (`/\s+/`), dropping empty parts. For each word: `lower =
   normalize(word)` (Unicode NFD, remove combining marks U+0300–U+036F, lower-case). Split `lower` on
   `:` into `[key, value]` (**only the first two parts are used**; `is:open:later` reads as `is:open`).
   * `value` non-empty, `key == "is"`, `value ∈ {open, done, overdue, today, mine}` → append to
     `taskFilters` (input order, duplicates kept).
   * `value` non-empty, `key ∈ {prio, priority}`, `value ∈ {urgent, high, medium, low}` → set `priority`
     (the last one wins).
   * anything else → `terms.append(lower)` (so `is:bogus` stays the term `"is:bogus"`).
4. `hasTaskFilters = !taskFilters.isEmpty || priority != nil`. `raw` is the unmodified input.

## `globalSearchScore` — `scoreCandidate`

Input `{ terms: [string], title, secondary: [string] }` with `terms` already normalised (as produced
by `parseQuery`). Output `{ "score": number }`.

* no terms → `1`.
* `normTitle = normalize(title)`, `normSecondary = secondary (non-empty) .map(normalize)`.
* For each term: `titleScore` — index of the term in `normTitle`: `0` → `4`; `> 0` → `3` when the
  preceding character matches the word-boundary class `[\s\-_/.,:;()[\]]`, else `1.5`; not found and
  `term.count >= 3` and the term is an in-order **subsequence** of `normTitle` → `0.5`; else `0`.
  If `titleScore > 0` add it. Else if any `normSecondary` text *contains* the term add `0.75`. Else the
  whole candidate scores `0` (every term must match).
* If `normTitle == terms.joined(" ")` add `3`.

## Porting checklist (iOS `PFDomain`)

* Implement the date helpers first (`toDay`, `toInstant`, `startOfDay`, `clockLabel`, calendar-day
  arithmetic) with `Calendar` / `TimeZone` — never use `Calendar.current` or `Date()` inside the
  modules; take `now`/`timeZone` as parameters.
* Offset-less ISO date-times are wall-clock time in `timeZone`; date-only strings are calendar days.
  Fixtures `time-zone-*`, `dst-change-berlin` and `date-formats*` exercise exactly this.
* Keep sorts stable; write comparators as `(key…, originalIndex)`.
* Reproduce the JSON field names and `null` conventions exactly; assert with deep equality.
* The legacy quirks documented above (undated check by truthiness, `createdAt` missing = oldest,
  suggestions counted in the headline number, "scheduled" and "due" counted twice in the week strip) are
  intentional parity with the web Dashboard — do not "fix" them on one platform only; change the TS
  module, regenerate, and port.
