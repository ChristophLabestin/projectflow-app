#!/usr/bin/env node
// Regenerates the golden fixtures in shared/fixtures/<module>/*.json.
//
// Every case below defines an `input`; `expected` is produced by running the
// TypeScript implementation (web/utils/*.ts) through the shared adapters in
// web/utils/fixtureRunners.ts. Review the diff by hand after regenerating —
// the fixtures are the contract the iOS PFDomain port is tested against.
//
//   cd web && npm install            # esbuild comes with the web dependencies
//   node ../shared/fixtures/generate.mjs
//
// Time zones are always explicit in the inputs, so the output does not depend
// on the machine's TZ (verify with `TZ=America/Los_Angeles node …`).

import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { build } = createRequire(resolve(here, '../../web/package.json'))('esbuild');
const webUtils = resolve(here, '../../web/utils');

const bundlePath = join(tmpdir(), `pf-fixture-runners-${process.pid}.mjs`);
await build({
    entryPoints: [join(webUtils, 'fixtureRunners.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: bundlePath,
    logLevel: 'error'
});
const { runFixture } = await import(pathToFileURL(bundlePath).href);
rmSync(bundlePath, { force: true });

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** Thursday 22 Oct 2026, 12:00 in Berlin (CEST, UTC+2), 03:00 in Los Angeles. */
const NOW = '2026-10-22T10:00:00.000Z';
const BERLIN = 'Europe/Berlin';
const LA = 'America/Los_Angeles';

const seconds = (iso, nanoseconds = 0) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds });
const hoursAgo = (hours) => new Date(Date.parse(NOW) - hours * 3600 * 1000).toISOString();

const WEB = { id: 'p-web', title: 'Website Relaunch' };
const APP = { id: 'p-app', title: 'Mobile App' };
const OPS = { id: 'p-ops', title: 'Operations' };

const task = (id, title, extra = {}) => ({ id, title, projectId: 'p-web', ...extra });
const personal = (id, title, extra = {}) => ({ id, title, ...extra });

const dayPlan = (base = {}) => ({
    now: NOW,
    timeZone: BERLIN,
    projects: [WEB, APP, OPS],
    tasks: [],
    personalTasks: [],
    otherTasks: [],
    focus: null,
    ...base
});

const cases = { dayPlan: [], dueBuckets: [], attention: [], portfolioGroup: [], globalSearch: [], globalSearchScore: [] };
const add = (module, slug, name, input) => cases[module].push({ slug, name, input });

// ---------------------------------------------------------------------------
// dayPlan
// ---------------------------------------------------------------------------

add('dayPlan', 'empty-clear-day', 'No tasks at all: empty plan, "the day is yours" statement', dayPlan());

add('dayPlan', 'busy-day-more-than-four-overdue', 'Six overdue tasks: plan is capped at four stops, oldest due date first, with "frees up N" and a moreCount', dayPlan({
    tasks: [
        task('t1', 'Set up 301 redirects', { dueDate: '2026-10-19', priority: 'High' }),
        task('t2', 'Conflict resolution', { dueDate: '2026-10-21', priority: 'Medium' }),
        task('t3', 'Finalize hero copy', { dueDate: '2026-10-20', dependencies: ['t1'] }),
        task('t4', 'Fix checkout bug', { dueDate: '2026-10-10', priority: 'Urgent' }),
        task('t5', 'Review analytics', { dueDate: '2026-10-15' }),
        task('t6', 'Renew certificates', { projectId: 'p-ops', dueDate: '2026-10-01' }),
        task('t7', 'Onboarding screens', { dueDate: '2026-10-22', priority: 'Medium' }),
        task('t8', 'Prepare standup', { dueDate: '2026-10-22', priority: 'Low' }),
        task('t9', 'Write release notes', { projectId: 'p-app', scheduledDate: '2026-10-22' }),
        task('t10', 'Backlog idea', { createdAt: '2026-10-01T09:00:00.000Z' }),
        task('t11', 'Already done', { isCompleted: true, status: 'Done', completedAt: '2026-10-20T08:00:00.000Z', dueDate: '2026-10-20' })
    ],
    otherTasks: [
        task('o1', 'Hero copy', { assigneeIds: ['u-lena'], dependencies: ['t1'], status: 'In Progress' })
    ]
}));

add('dayPlan', 'due-today-sorted-by-priority', 'Due-today stops are ordered by priority (Urgent first), ties keep input order', dayPlan({
    tasks: [
        task('a', 'Low priority task', { dueDate: '2026-10-22', priority: 'Low' }),
        task('b', 'No priority set', { dueDate: '2026-10-22' }),
        task('c', 'Urgent task', { dueDate: '2026-10-22', priority: 'Urgent' }),
        task('d', 'Second medium', { dueDate: '2026-10-22', priority: 'Medium' }),
        task('e', 'High task', { dueDate: '2026-10-22', priority: 'High' })
    ]
}));

add('dayPlan', 'queue-deduplication', 'A task that is overdue and also scheduled today appears once; scheduled-today tasks with a future due date still count', dayPlan({
    tasks: [
        task('a', 'Overdue and scheduled', { dueDate: '2026-10-20', scheduledDate: '2026-10-22' }),
        task('b', 'Due and scheduled today', { dueDate: '2026-10-22', scheduledDate: '2026-10-22' }),
        task('c', 'Scheduled, due next week', { dueDate: '2026-10-29', scheduledDate: '2026-10-22' }),
        task('d', 'Scheduled only', { scheduledDate: '2026-10-22' })
    ]
}));

add('dayPlan', 'focus-leads-with-next-step', 'An active focus item leads the plan with its next step; the same task is not repeated', dayPlan({
    tasks: [
        task('t1', 'Set up 301 redirects', { dueDate: '2026-10-19', nextStep: 'Map the old URLs' }),
        task('t2', 'Conflict resolution', { dueDate: '2026-10-21' })
    ],
    focus: { id: 't1', type: 'task', title: 'Set up 301 redirects', projectId: 'p-web', tenantId: 'tenant-1', status: 'active' }
}));

add('dayPlan', 'focus-without-next-step', 'Focus without a next step reads "you were working on this last"', dayPlan({
    tasks: [task('t1', 'Draft pricing page', { priority: 'Low' })],
    focus: { id: 't1', type: 'task', title: 'Draft pricing page', projectId: 'p-web', status: 'active' }
}));

add('dayPlan', 'focus-initiative', 'A focused initiative is a stop of item type initiative', dayPlan({
    tasks: [task('t1', 'Overdue task', { dueDate: '2026-10-21' })],
    focus: { id: 'i1', type: 'initiative', title: 'Launch campaign', projectId: 'p-web', status: 'active' }
}));

add('dayPlan', 'focus-snoozed-is-ignored', 'A focus snoozed into the future is not part of the plan', dayPlan({
    tasks: [task('t1', 'Overdue task', { dueDate: '2026-10-21' })],
    focus: { id: 't9', type: 'task', title: 'Snoozed focus', projectId: 'p-web', status: 'snoozed', snoozedUntil: '2026-10-22T12:00:00.000Z' }
}));

add('dayPlan', 'focus-snooze-expired-leads', 'A focus whose snooze has expired leads the plan again', dayPlan({
    tasks: [task('t1', 'Overdue task', { dueDate: '2026-10-21' })],
    focus: { id: 't9', type: 'task', title: 'Snooze over', projectId: 'p-web', status: 'snoozed', snoozedUntil: '2026-10-22T09:00:00.000Z' }
}));

add('dayPlan', 'focus-completed-task-hidden', 'A focus whose task is already completed is not shown', dayPlan({
    tasks: [
        task('t1', 'Done already', { isCompleted: true, completedAt: '2026-10-22T08:00:00.000Z' }),
        task('t2', 'Still to do', { dueDate: '2026-10-22' })
    ],
    focus: { id: 't1', type: 'task', title: 'Done already', projectId: 'p-web', status: 'active' }
}));

add('dayPlan', 'focus-inactive-project-ignored', 'Focus in a project that is not active is ignored; tasks of inactive projects do not count', dayPlan({
    tasks: [
        task('t1', 'In archived project', { projectId: 'p-archived', dueDate: '2026-10-20' }),
        task('t2', 'Active project task', { dueDate: '2026-10-22' })
    ],
    focus: { id: 't1', type: 'task', title: 'In archived project', projectId: 'p-archived', status: 'active' }
}));

add('dayPlan', 'quiet-day-suggestions', 'Nothing dated: up to three backlog suggestions ranked by priority then age (missing createdAt counts as oldest); dated and completed tasks are not suggested; personal undated tasks may be', dayPlan({
    tasks: [
        task('s1', 'Medium, old', { createdAt: '2026-10-01T09:00:00.000Z', priority: 'Medium' }),
        task('s2', 'Urgent, new', { createdAt: '2026-10-21T09:00:00.000Z', priority: 'Urgent' }),
        task('s3', 'Low, yesterday', { createdAt: '2026-10-21T08:00:00.000Z', priority: 'Low' }),
        task('s4', 'Medium without createdAt'),
        task('s5', 'Future due date', { dueDate: '2026-11-15', priority: 'Urgent' }),
        task('s6', 'Completed backlog item', { isCompleted: true, completedAt: '2026-10-20T09:00:00.000Z' })
    ],
    personalTasks: [
        personal('pt1', 'Call the dentist', { createdAt: seconds('2026-10-10T08:00:00.000Z'), priority: 'High' }),
        personal('pt2', 'Personal, due next month', { dueDate: '2026-11-30', priority: 'High' })
    ]
}));

add('dayPlan', 'quiet-day-aged-suggestion', 'A medium-priority backlog task that has been open for a week or more is suggested with its age', dayPlan({
    tasks: [
        task('s1', 'Open for three weeks', { createdAt: '2026-10-01T09:00:00.000Z' }),
        task('s2', 'Open for exactly seven days', { createdAt: '2026-10-15T10:00:00.000Z' }),
        task('s3', 'Open for six days', { createdAt: '2026-10-16T10:00:00.000Z', priority: 'Low' })
    ]
}));

add('dayPlan', 'quiet-day-two-dated-stops-still-suggest', 'Fewer than three real stops: suggestions fill up to three in total', dayPlan({
    tasks: [
        task('d1', 'Due today', { dueDate: '2026-10-22' }),
        task('s1', 'Important idea', { priority: 'High', createdAt: '2026-10-20T09:00:00.000Z' }),
        task('s2', 'Another idea', { createdAt: '2026-10-19T09:00:00.000Z' }),
        task('s3', 'One idea too many', { createdAt: '2026-10-18T09:00:00.000Z' })
    ]
}));

add('dayPlan', 'waiting-day-follow-ups', 'Only blocked work: follow-up stops with blocker note, dependency title or fallback reason', dayPlan({
    tasks: [
        task('b1', 'Launch checklist', { status: 'Blocked', blockerNote: 'Waiting for legal sign-off' }),
        task('b2', 'Publish blog post', { status: 'Blocked', dependencies: ['x1'] }),
        task('b3', 'Update pricing', { status: 'Blocked' }),
        task('b4', 'Migrate DNS', { status: 'Blocked', dependencies: ['x2'] }),
        task('b5', 'Fifth blocked task', { status: 'Blocked', blockerNote: 'Not shown, plan is capped' })
    ],
    otherTasks: [
        task('x1', 'Design review', { assigneeIds: ['u-lena'] }),
        task('x2', 'Completed dependency', { isCompleted: true, assigneeIds: ['u-max'] })
    ]
}));

add('dayPlan', 'waiting-on-me', 'Others depend on my open tasks; waiting list is sorted by the blocker\'s due date, followed by my own blocked tasks', dayPlan({
    tasks: [
        task('m1', 'CMS schema', { dueDate: '2026-10-22' }),
        task('m2', 'API contract', { dueDate: '2026-10-18', projectId: 'p-app' }),
        task('m3', 'Completed task', { isCompleted: true, completedAt: '2026-10-21T10:00:00.000Z' }),
        task('m4', 'No due date task'),
        task('b1', 'Blocked on legal', { status: 'Blocked', blockerNote: 'Waiting for legal', dueDate: '2026-10-30' })
    ],
    otherTasks: [
        task('o1', 'Hero copy', { assigneeIds: ['u-lena'], dependencies: ['m1'] }),
        task('o2', 'Mobile login', { projectId: 'p-app', assigneeIds: ['u-max', 'u-ana'], dependencies: ['zz', 'm2', 'm1'] }),
        task('o3', 'Finished dependent', { isCompleted: true, dependencies: ['m1'] }),
        task('o4', 'Depends on a completed task', { dependencies: ['m3'] }),
        task('o5', 'Depends on undated task', { assigneeIds: ['u-lena'], dependencies: ['m4'] }),
        task('o6', 'Unrelated', { dependencies: ['someone-elses-task'] })
    ]
}));

add('dayPlan', 'unblocks-count-across-people', 'Unblocks counts include dependents of other people; top unlocker is the first task with the highest count', dayPlan({
    tasks: [
        task('a', 'Unlocks one', { dueDate: '2026-10-22' }),
        task('b', 'Unlocks three', { dueDate: '2026-10-22', priority: 'High' }),
        task('c', 'Also unlocks three', { dueDate: '2026-10-22', priority: 'High' }),
        task('d', 'Depends on b', { dependencies: ['b'] })
    ],
    otherTasks: [
        task('o1', 'Other 1', { dependencies: ['a', 'b'] }),
        task('o2', 'Other 2', { dependencies: ['b', 'c'] }),
        task('o3', 'Other 3', { dependencies: ['c', 'c'] }),
        task('o4', 'Completed dependent', { isCompleted: true, dependencies: ['b', 'c'] })
    ]
}));

add('dayPlan', 'personal-tasks-in-plan', 'Personal tasks count when overdue, due today or scheduled today; future and undated ones stay out of the plan', dayPlan({
    tasks: [task('t1', 'Project task due today', { dueDate: '2026-10-22' })],
    personalTasks: [
        personal('p1', 'Renew passport', { dueDate: '2026-10-20', priority: 'High' }),
        personal('p2', 'Book flights', { dueDate: '2026-10-22', priority: 'High' }),
        personal('p3', 'Plan birthday', { scheduledDate: '2026-10-22' }),
        personal('p4', 'Next week', { dueDate: '2026-10-29' }),
        personal('p5', 'Someday', {}),
        personal('p6', 'Completed personal', { isCompleted: true, dueDate: '2026-10-20' })
    ]
}));

add('dayPlan', 'personal-tasks-only', 'A day with only a personal task still has a plan; personal ids are namespaced', dayPlan({
    personalTasks: [personal('p1', 'Pick up parcel', { dueDate: '2026-10-22' })]
}));

add('dayPlan', 'personal-and-project-id-collision', 'A personal task and a project task may share an id', dayPlan({
    tasks: [task('same', 'Project task', { dueDate: '2026-10-22' })],
    personalTasks: [personal('same', 'Personal task', { dueDate: '2026-10-22' })]
}));

add('dayPlan', 'heavy-day-load-center', 'Six or more tasks due today and none overdue: heavy day, most-loaded project in the cause line, band segments capped at six', dayPlan({
    tasks: [
        task('a1', 'Web 1', { dueDate: '2026-10-22' }),
        task('a2', 'Web 2', { dueDate: '2026-10-22' }),
        task('a3', 'Web 3', { dueDate: '2026-10-22' }),
        task('a4', 'Web 4', { dueDate: '2026-10-22' }),
        task('a5', 'Web 5', { dueDate: '2026-10-22' }),
        task('b1', 'App 1', { projectId: 'p-app', dueDate: '2026-10-22' }),
        task('b2', 'App 2', { projectId: 'p-app', dueDate: '2026-10-22' }),
        task('b3', 'App 3', { projectId: 'p-app', dueDate: '2026-10-22' })
    ]
}));

add('dayPlan', 'doable-day-spread-across-projects', 'A doable day spread over several projects with no single leader', dayPlan({
    tasks: [
        task('a', 'Web task', { dueDate: '2026-10-22' }),
        task('b', 'App task', { projectId: 'p-app', dueDate: '2026-10-22' }),
        task('c', 'Ops task', { projectId: 'p-ops', dueDate: '2026-10-22' })
    ]
}));

add('dayPlan', 'band-caps-segments-at-six', 'Ten overdue tasks and eight blocked tasks: band segments are capped at six per kind, captions keep the real counts', dayPlan({
    tasks: [
        ...Array.from({ length: 10 }, (_, index) => task(`o${index + 1}`, `Overdue ${index + 1}`, { dueDate: `2026-10-${String(index + 5).padStart(2, '0')}` })),
        ...Array.from({ length: 8 }, (_, index) => task(`b${index + 1}`, `Blocked ${index + 1}`, { status: 'Blocked' }))
    ]
}));

add('dayPlan', 'single-stop-statement', 'Exactly one stop uses the "one single move" statement with its title', dayPlan({
    tasks: [task('t1', 'The only thing today', { dueDate: '2026-10-22' })]
}));

add('dayPlan', 'completed-isCompleted-wins-over-status', 'isCompleted is the only authority for open/closed: Done+open stays open, Blocked+completed is closed', dayPlan({
    tasks: [
        task('a', 'Status Done but not completed', { status: 'Done', isCompleted: false, dueDate: '2026-10-22' }),
        task('b', 'Completed but status Blocked', { status: 'Blocked', isCompleted: true, dueDate: '2026-10-20', completedAt: '2026-10-21T09:00:00.000Z' }),
        task('c', 'Completed, status In Progress', { status: 'In Progress', isCompleted: true, dueDate: '2026-10-19', completedAt: '2026-10-22T08:30:00.000Z' }),
        task('d', 'Blocked and open', { status: 'Blocked', isCompleted: false })
    ]
}));

add('dayPlan', 'legacy-todo-status', 'Legacy status Todo (and missing status) behaves like Open, never like Blocked', dayPlan({
    tasks: [
        task('a', 'Legacy todo, overdue', { status: 'Todo', dueDate: '2026-10-21' }),
        task('b', 'Legacy todo, backlog', { status: 'Todo', createdAt: '2026-10-01T09:00:00.000Z' }),
        task('c', 'No status', { dueDate: '2026-10-22' })
    ]
}));

add('dayPlan', 'date-formats-mixed', 'Due and scheduled dates as date-only, ISO with Z, ISO with offset, offset-less ISO, Timestamp-like and epoch milliseconds', dayPlan({
    tasks: [
        task('a', 'Date-only today', { dueDate: '2026-10-22' }),
        task('b', 'ISO Z, today in Berlin', { dueDate: '2026-10-22T08:00:00.000Z' }),
        task('c', 'Offset-less ISO is Berlin wall-clock time', { dueDate: '2026-10-22T07:30:00' }),
        task('d', 'ISO with +05:30 offset, yesterday', { dueDate: '2026-10-21T23:30:00+05:30' }),
        task('e', 'Timestamp-like seconds, yesterday', { dueDate: seconds('2026-10-21T15:00:00.000Z', 123000000) }),
        task('f', 'Epoch milliseconds, overdue by two days', { dueDate: Date.parse('2026-10-20T12:00:00.000Z') }),
        task('g', 'Scheduled as Timestamp-like', { scheduledDate: seconds('2026-10-22T09:00:00.000Z') }),
        task('h', 'Empty strings and nulls', { dueDate: '', scheduledDate: null }),
        task('i', 'Unparseable date', { dueDate: 'tomorrow-ish' })
    ]
}));

const midnightTasks = [
    task('a', 'Date-only 22 Oct', { dueDate: '2026-10-22' }),
    task('b', 'Date-only 23 Oct', { dueDate: '2026-10-23' }),
    task('c', 'ISO 21:30Z on the 22nd', { dueDate: '2026-10-22T21:30:00.000Z' }),
    task('d', 'ISO 22:00Z on the 22nd', { dueDate: '2026-10-22T22:00:00.000Z' }),
    task('e', 'Scheduled for the 23rd', { scheduledDate: '2026-10-23' }),
    task('f', 'Completed 20:00Z', { isCompleted: true, completedAt: '2026-10-22T20:00:00.000Z' })
];
add('dayPlan', 'time-zone-midnight-berlin', 'Same instant, Berlin: 22:30Z is already 00:30 on the 23rd, so "today" is the 23rd and the 22nd is overdue', dayPlan({
    now: '2026-10-22T22:30:00.000Z',
    timeZone: BERLIN,
    tasks: midnightTasks
}));
add('dayPlan', 'time-zone-midnight-los-angeles', 'Same instant, Los Angeles: 22:30Z is 15:30 on the 22nd, so "today" is the 22nd', dayPlan({
    now: '2026-10-22T22:30:00.000Z',
    timeZone: LA,
    tasks: midnightTasks
}));

add('dayPlan', 'time-zone-new-zealand-ahead-of-utc', 'Pacific/Auckland is a day ahead of UTC: 20:00Z on the 22nd is already the 23rd', dayPlan({
    now: '2026-10-22T20:00:00.000Z',
    timeZone: 'Pacific/Auckland',
    tasks: [
        task('a', 'Due 22nd', { dueDate: '2026-10-22' }),
        task('b', 'Due 23rd', { dueDate: '2026-10-23' }),
        task('c', 'ISO 11:30Z on the 22nd is 00:30 on the 23rd', { dueDate: '2026-10-22T11:30:00.000Z' })
    ]
}));

add('dayPlan', 'dst-change-berlin', 'The night clocks go back (Sun 25 Oct 2026): ambiguous 02:30 local times, today is Monday the 26th', dayPlan({
    now: '2026-10-25T23:30:00.000Z',
    timeZone: BERLIN,
    tasks: [
        task('a', 'Done at 02:30 CEST', { isCompleted: true, completedAt: '2026-10-25T00:30:00.000Z' }),
        task('b', 'Done at 02:30 CET', { isCompleted: true, completedAt: '2026-10-25T01:30:00.000Z' }),
        task('c', 'Due on the DST day', { dueDate: '2026-10-25' }),
        task('d', 'Due today (Monday)', { dueDate: '2026-10-26' }),
        task('e', 'Created 24 h and 1 min before now', { createdAt: '2026-10-24T23:29:00.000Z' }),
        task('f', 'Created just inside 24 h', { createdAt: '2026-10-24T23:31:00.000Z' })
    ]
}));

add('dayPlan', 'overnight-week-and-completions', 'Overnight feed (done, new, became overdue; last four by time), week strip with project deadline, completion badge vs previous week', dayPlan({
    tasks: [
        task('d1', 'Done at 07:15 local', { isCompleted: true, completedAt: '2026-10-22T05:15:00.000Z' }),
        task('d2', 'Done yesterday evening', { isCompleted: true, completedAt: hoursAgo(15) }),
        task('d3', 'Done as Timestamp', { isCompleted: true, completedAt: seconds(hoursAgo(5)) }),
        task('n1', 'New this morning', { createdAt: hoursAgo(2) }),
        task('n2', 'New yesterday', { createdAt: hoursAgo(20) }),
        task('o1', 'Slipped yesterday', { dueDate: '2026-10-21' }),
        task('o2', 'Overdue for a week', { dueDate: '2026-10-15' }),
        task('w1', 'Due Monday', { dueDate: '2026-10-19', isCompleted: true, completedAt: '2026-10-19T12:00:00.000Z' }),
        task('w2', 'Due Friday', { dueDate: '2026-10-23' }),
        task('w3', 'Due Saturday and scheduled Friday', { dueDate: '2026-10-24', scheduledDate: '2026-10-23' }),
        task('w4', 'Due next Monday', { dueDate: '2026-10-26' }),
        task('p1', 'Completed 9 days ago', { isCompleted: true, completedAt: '2026-10-13T10:00:00.000Z' }),
        task('p2', 'Completed 10 days ago', { isCompleted: true, completedAt: '2026-10-12T10:00:00.000Z' }),
        task('p3', 'Completed 3 days ago', { isCompleted: true, completedAt: '2026-10-19T10:00:00.000Z' })
    ],
    personalTasks: [
        personal('pp1', 'Personal slipped yesterday', { dueDate: '2026-10-21' }),
        personal('pp2', 'Personal done overnight (ignored)', { isCompleted: true, completedAt: hoursAgo(3) }),
        personal('pp3', 'Personal new (ignored)', { createdAt: hoursAgo(1) })
    ],
    projects: [WEB, { ...APP, dueDate: '2026-10-24' }, OPS]
}));

add('dayPlan', 'completion-badge-more-fewer-same', 'Completion badge when this week has fewer completions than last week', dayPlan({
    tasks: [
        task('a', 'This week', { isCompleted: true, completedAt: '2026-10-21T09:00:00.000Z' }),
        task('b', 'Last week 1', { isCompleted: true, completedAt: '2026-10-12T09:00:00.000Z' }),
        task('c', 'Last week 2', { isCompleted: true, completedAt: '2026-10-13T09:00:00.000Z' }),
        task('d', 'Last week 3', { isCompleted: true, completedAt: '2026-10-14T09:00:00.000Z' })
    ]
}));

// ---------------------------------------------------------------------------
// dueBuckets
// ---------------------------------------------------------------------------

const due = (tasks, base = {}) => ({ now: NOW, timeZone: BERLIN, tasks, ...base });
const dt = (id, title, extra = {}) => ({ id, title, ...extra });

add('dueBuckets', 'all-buckets', 'Overdue, today, next 7 days, later, no date and completed in one list', due([
    dt('a', 'Overdue long ago', { dueDate: '2026-09-01' }),
    dt('b', 'Overdue yesterday', { dueDate: '2026-10-21' }),
    dt('c', 'Today', { dueDate: '2026-10-22' }),
    dt('d', 'Tomorrow', { dueDate: '2026-10-23' }),
    dt('e', 'In a month', { dueDate: '2026-11-22' }),
    dt('f', 'No date'),
    dt('g', 'Completed', { dueDate: '2026-10-10', isCompleted: true, status: 'Done' })
]));

add('dueBuckets', 'week-boundary', 'Seven days ahead is still "next 7 days", eight days ahead is "later"', due([
    dt('d6', 'In six days', { dueDate: '2026-10-28' }),
    dt('d7', 'In seven days', { dueDate: '2026-10-29' }),
    dt('d8', 'In eight days', { dueDate: '2026-10-30' })
]));

add('dueBuckets', 'sort-within-group', 'Within a group: earliest due first, then higher priority, then title; missing priority counts as Medium', due([
    dt('a', 'Banana', { dueDate: '2026-10-25', priority: 'Medium' }),
    dt('b', 'Apple', { dueDate: '2026-10-25', priority: 'Medium' }),
    dt('c', 'Zebra urgent', { dueDate: '2026-10-25', priority: 'Urgent' }),
    dt('d', 'Cherry low', { dueDate: '2026-10-25', priority: 'Low' }),
    dt('e', 'Earlier', { dueDate: '2026-10-24', priority: 'Low' }),
    dt('f', 'No priority', { dueDate: '2026-10-25' }),
    dt('g', 'High', { dueDate: '2026-10-25', priority: 'High' }),
    dt('h', 'Unknown priority', { dueDate: '2026-10-25', priority: 'Whenever' })
]));

add('dueBuckets', 'time-of-day-orders-within-a-day', 'Two tasks on the same day: date-only sorts before a time of day, times sort by instant', due([
    dt('late', 'Late', { dueDate: '2026-10-22T16:00:00.000Z' }),
    dt('early', 'Early', { dueDate: '2026-10-22T07:00:00.000Z' }),
    dt('dateonly', 'Date only', { dueDate: '2026-10-22' })
]));

add('dueBuckets', 'completed-group-order', 'Completed tasks form a trailing group sorted by due date descending, undated first', due([
    dt('a', 'Done old', { dueDate: '2026-09-01', isCompleted: true }),
    dt('b', 'Done recent', { dueDate: '2026-10-20', isCompleted: true }),
    dt('c', 'Done undated', { isCompleted: true }),
    dt('d', 'Open', { dueDate: '2026-10-22' })
]));

add('dueBuckets', 'legacy-todo-and-completion-disagree', 'Legacy Todo reads as Open; isCompleted wins over status in both directions', due([
    dt('a', 'Legacy todo', { status: 'Todo', dueDate: '2026-10-22' }),
    dt('b', 'No status', { dueDate: '2026-10-22' }),
    dt('c', 'Status Done but open', { status: 'Done', isCompleted: false, dueDate: '2026-10-22' }),
    dt('d', 'Status Blocked but completed', { status: 'Blocked', isCompleted: true, dueDate: '2026-10-22' }),
    dt('e', 'In progress', { status: 'In Progress', dueDate: '2026-10-23' })
]));

add('dueBuckets', 'date-formats', 'Due dates as date-only, ISO, offset-less ISO, Timestamp-like, epoch ms, empty and invalid', due([
    dt('a', 'Date-only', { dueDate: '2026-10-22' }),
    dt('b', 'ISO Z yesterday Berlin', { dueDate: '2026-10-21T21:30:00.000Z' }),
    dt('c', 'Offset-less ISO today', { dueDate: '2026-10-22T23:30:00' }),
    dt('d', 'Timestamp-like tomorrow', { dueDate: seconds('2026-10-23T09:00:00.000Z', 999000000) }),
    dt('e', 'Epoch ms later', { dueDate: Date.parse('2026-12-24T12:00:00.000Z') }),
    dt('f', 'Empty string', { dueDate: '' }),
    dt('g', 'Invalid', { dueDate: 'soon' }),
    dt('h', 'Null', { dueDate: null })
]));

const midnightDue = [
    dt('a', 'Date-only 22nd', { dueDate: '2026-10-22' }),
    dt('b', 'Date-only 23rd', { dueDate: '2026-10-23' }),
    dt('c', 'ISO 21:30Z (22nd evening / 23rd 23:30)', { dueDate: '2026-10-22T21:30:00.000Z' }),
    dt('d', 'ISO 22:00Z', { dueDate: '2026-10-22T22:00:00.000Z' })
];
add('dueBuckets', 'time-zone-midnight-berlin', 'Berlin at 00:30 on the 23rd: yesterday\'s date-only task is overdue', due(midnightDue, { now: '2026-10-22T22:30:00.000Z' }));
add('dueBuckets', 'time-zone-midnight-los-angeles', 'Los Angeles at 15:30 on the 22nd: the same data, a day earlier', due(midnightDue, { now: '2026-10-22T22:30:00.000Z', timeZone: LA }));
add('dueBuckets', 'empty', 'No tasks: no groups, zero summary', due([]));

// ---------------------------------------------------------------------------
// attention
// ---------------------------------------------------------------------------

const att = (base = {}) => ({ now: NOW, timeZone: BERLIN, projects: [], tasks: [], unlocker: null, ...base });
const ap = (id, title, extra = {}) => ({ id, title, ...extra });
const at = (id, projectId, extra = {}) => ({ id, title: `Task ${id}`, projectId, ...extra });

add('attention', 'mixed-portfolio-ranking', 'Four projects with different signals: score ranking, chips (max three), rail, workload and statement', att({
    projects: [
        ap('calm', 'Calm project', { health: { status: 'healthy', trend: 'stable' } }),
        ap('late', 'Late project', { health: { status: 'warning', trend: 'declining' } }),
        ap('blocked', 'Blocked project', { health: { status: 'normal', trend: 'stable' } }),
        ap('deadline', 'Deadline project', { dueDate: '2026-10-26', health: { status: 'critical', trend: 'stable' } })
    ],
    tasks: [
        at('c1', 'calm', { createdAt: '2026-10-20T09:00:00.000Z' }),
        at('c2', 'calm', { createdAt: '2026-10-21T09:00:00.000Z' }),
        at('l1', 'late', { dueDate: '2026-10-15', createdAt: '2026-09-01T09:00:00.000Z' }),
        at('l2', 'late', { dueDate: '2026-10-19', createdAt: '2026-09-01T09:00:00.000Z' }),
        at('l3', 'late', { dueDate: '2026-10-22', createdAt: '2026-09-02T09:00:00.000Z' }),
        at('b1', 'blocked', { status: 'Blocked', createdAt: '2026-10-20T09:00:00.000Z' }),
        at('b2', 'blocked', { status: 'Blocked', createdAt: '2026-10-20T09:00:00.000Z' }),
        at('d1', 'deadline', { createdAt: '2026-10-21T09:00:00.000Z' }),
        at('d2', 'deadline', { createdAt: '2026-10-21T09:00:00.000Z' }),
        at('d3', 'deadline', { createdAt: '2026-10-21T09:00:00.000Z' }),
        at('d4', 'deadline', { createdAt: '2026-10-21T09:00:00.000Z' }),
        at('x1', 'archived-project', { dueDate: '2026-10-01' })
    ]
}));

add('attention', 'steady-portfolio', 'Everything is fine: "steady" statement, quiet-all insight, no attention list', att({
    projects: [ap('a', 'Project A'), ap('b', 'Project B')],
    tasks: [at('a1', 'a', { createdAt: '2026-10-21T09:00:00.000Z' }), at('b1', 'b', { createdAt: '2026-10-20T09:00:00.000Z', dueDate: '2026-11-30' })]
}));

add('attention', 'single-project-steady', 'A single healthy project uses the singular steady statement', att({
    projects: [ap('a', 'Only project')],
    tasks: [at('a1', 'a', { createdAt: '2026-10-21T09:00:00.000Z' })]
}));

add('attention', 'single-project-drifting', 'A single drifting project uses the singular statement and the worst-project insight', att({
    projects: [ap('a', 'Only project')],
    tasks: [at('a1', 'a', { dueDate: '2026-10-01', createdAt: '2026-10-01T09:00:00.000Z' })]
}));

add('attention', 'no-active-projects', 'No active projects: "none" statement with a localized value key', att());

add('attention', 'stalled-with-deadline-accent', 'A project untouched for 12 days with a deadline: stalled chip, deadline chip and the stalled-deadline accent line', att({
    projects: [ap('a', 'Quiet launch', { dueDate: '2026-10-30' }), ap('b', 'Busy project')],
    tasks: [
        at('a1', 'a', { createdAt: '2026-10-05T09:00:00.000Z' }),
        at('b1', 'b', { createdAt: '2026-10-21T09:00:00.000Z' })
    ],
    unlocker: { title: 'CMS schema', count: 3 }
}));

add('attention', 'unlocker-accent-when-nothing-stalled', 'Without a stalled project the accent line falls back to the top unlocker', att({
    projects: [ap('a', 'Project A')],
    tasks: [at('a1', 'a', { createdAt: '2026-10-21T09:00:00.000Z' })],
    unlocker: { title: 'CMS schema', count: 2 }
}));

add('attention', 'best-run-wins-horizon-momentum', 'Completions, best run, wins, momentum trend over 14 days and the next four deadlines', att({
    projects: [
        ap('a', 'Shipping project', { dueDate: '2026-11-03' }),
        ap('b', 'Other project'),
        ap('c', 'Third project', { dueDate: '2026-12-31' })
    ],
    tasks: [
        at('a1', 'a', { isCompleted: true, completedAt: '2026-10-21T09:00:00.000Z' }),
        at('a2', 'a', { isCompleted: true, completedAt: '2026-10-22T08:00:00.000Z' }),
        at('a3', 'a', { isCompleted: true, completedAt: '2026-10-19T09:00:00.000Z' }),
        at('b1', 'b', { isCompleted: true, completedAt: seconds('2026-10-20T09:00:00.000Z') }),
        at('b2', 'b', { isCompleted: true, completedAt: '2026-10-14T09:00:00.000Z' }),
        at('b3', 'b', { isCompleted: true, completedAt: '2026-10-10T09:00:00.000Z' }),
        at('b4', 'b', { dueDate: '2026-10-23', createdAt: '2026-10-21T09:00:00.000Z' }),
        at('b5', 'b', { dueDate: '2026-10-30', createdAt: '2026-10-21T09:00:00.000Z' }),
        at('b6', 'b', { dueDate: '2026-11-05', createdAt: '2026-10-21T09:00:00.000Z' }),
        at('b7', 'b', { dueDate: '2026-11-06', createdAt: '2026-10-21T09:00:00.000Z' }),
        at('b8', 'b', { dueDate: '2026-11-07', createdAt: '2026-10-21T09:00:00.000Z' }),
        at('c1', 'c', { createdAt: '2026-10-21T09:00:00.000Z' })
    ]
}));

add('attention', 'momentum-first-week', 'Completions this week but none the week before', att({
    projects: [ap('a', 'Project A')],
    tasks: [at('a1', 'a', { isCompleted: true, completedAt: '2026-10-21T09:00:00.000Z' }), at('a2', 'a', { createdAt: '2026-10-21T09:00:00.000Z' })]
}));

add('attention', 'score-ties-and-cap-at-three', 'Five projects with the same score: only three are listed, ties keep input order', att({
    projects: ['a', 'b', 'c', 'd', 'e'].map((id) => ap(id, `Project ${id.toUpperCase()}`)),
    tasks: ['a', 'b', 'c', 'd', 'e'].map((id) => at(`${id}1`, id, { dueDate: '2026-10-20', createdAt: '2026-10-21T09:00:00.000Z' }))
}));

const deadlineProjects = [
    ap('a', 'Due on the 29th', { dueDate: '2026-10-29' }),
    ap('b', 'Due tomorrow', { dueDate: '2026-10-23' }),
    ap('c', 'Due today', { dueDate: '2026-10-22' }),
    ap('d', 'Due ISO Z', { dueDate: '2026-10-29T22:30:00.000Z' })
];
const deadlineTasks = deadlineProjects.map((project) => at(`${project.id}1`, project.id, { createdAt: '2026-10-22T08:00:00.000Z' }));
add('attention', 'deadline-days-time-zone-berlin', 'Deadline days are calendar days in the user\'s zone (Berlin, 00:30 on the 23rd)', att({
    now: '2026-10-22T22:30:00.000Z',
    timeZone: BERLIN,
    projects: deadlineProjects,
    tasks: deadlineTasks
}));
add('attention', 'deadline-days-time-zone-los-angeles', 'The same data in Los Angeles (15:30 on the 22nd)', att({
    now: '2026-10-22T22:30:00.000Z',
    timeZone: LA,
    projects: deadlineProjects,
    tasks: deadlineTasks
}));

add('attention', 'deadline-bonus-needs-more-than-three-open', 'Deadline within 7 days adds score only with more than three open tasks', att({
    projects: [ap('a', 'Three open', { dueDate: '2026-10-26' }), ap('b', 'Four open', { dueDate: '2026-10-26' })],
    tasks: [
        ...['1', '2', '3'].map((n) => at(`a${n}`, 'a', { createdAt: '2026-10-21T09:00:00.000Z' })),
        ...['1', '2', '3', '4'].map((n) => at(`b${n}`, 'b', { createdAt: '2026-10-21T09:00:00.000Z' }))
    ]
}));

// ---------------------------------------------------------------------------
// portfolioGroup
// ---------------------------------------------------------------------------

add('portfolioGroup', 'all-groups', 'Status decides closed/paused/planning; active projects move to "attention" on overdue, blocked, critical health or an overdue deadline', {
    now: NOW,
    timeZone: BERLIN,
    projects: [
        ap('closed', 'Completed project', { status: 'Completed' }),
        ap('canceled', 'Canceled project', { status: 'Canceled' }),
        ap('paused', 'On hold project', { status: 'On Hold' }),
        ap('planning', 'Planning project', { status: 'Planning' }),
        ap('brainstorm', 'Brainstorming project', { status: 'Brainstorming' }),
        ap('backlog', 'Backlog project', { status: 'Backlog' }),
        ap('overdue', 'Has overdue task', { status: 'Active' }),
        ap('blocked', 'Has blocked task', { status: 'In Testing' }),
        ap('critical', 'Critical health', { status: 'Review', health: { status: 'critical' } }),
        ap('late', 'Deadline passed', { status: 'Active', dueDate: '2026-10-21' }),
        ap('today', 'Deadline today', { status: 'Active', dueDate: '2026-10-22' }),
        ap('fine', 'Fine', { status: 'Active', health: { status: 'warning' } }),
        ap('notloaded', 'Tasks not loaded, overdue elsewhere', { status: 'Active' })
    ],
    tasks: [
        at('t1', 'overdue', { dueDate: '2026-10-20' }),
        at('t2', 'blocked', { status: 'Blocked' }),
        at('t3', 'fine', { dueDate: '2026-10-22' }),
        at('t4', 'fine', { dueDate: '2026-10-20', isCompleted: true }),
        at('t5', 'notloaded', { dueDate: '2026-10-01' }),
        at('t6', 'closed', { dueDate: '2026-10-01' })
    ],
    loadedProjectIds: ['closed', 'canceled', 'paused', 'planning', 'brainstorm', 'backlog', 'overdue', 'blocked', 'critical', 'late', 'today', 'fine']
});

// ---------------------------------------------------------------------------
// globalSearch (query parser) and scoring
// ---------------------------------------------------------------------------

[
    ['empty-query', 'Empty query', ''],
    ['whitespace-only', 'Only whitespace', '   '],
    ['plain-terms', 'Plain terms are normalized and split on whitespace', '  Fix   Checkout  '],
    ['diacritics-and-case', 'Diacritics and case are stripped', 'ÜBERSICHT Café'],
    ['prefix-commands', 'Prefix > selects commands', '>new task'],
    ['prefix-projects', 'Prefix # selects projects', '#website'],
    ['prefix-tasks', 'Prefix ! selects tasks', '!fix bug'],
    ['prefix-help', 'Prefix ? selects help', '?shortcuts'],
    ['prefix-only', 'A prefix alone leaves no terms', '>'],
    ['leading-space-before-prefix', 'Leading whitespace is trimmed before the prefix is read', '   #web'],
    ['prefix-only-at-start', 'A prefix elsewhere is just text', 'fix #web'],
    ['is-filters', 'is: filters collect task filters in order', 'is:overdue is:mine report'],
    ['is-filter-uppercase', 'Filters are case-insensitive', 'IS:Today'],
    ['is-filter-unknown', 'An unknown is: value stays a search term', 'is:bogus thing'],
    ['priority-filter', 'prio: and priority: set the priority, the last one wins', 'prio:high priority:urgent launch'],
    ['priority-filter-unknown', 'An unknown priority stays a term', 'prio:asap'],
    ['filter-with-extra-colon', 'Only the first two colon-separated parts are read', 'is:open:later'],
    ['prefix-and-filters', 'Prefix and filters combine', '!is:open prio:low cleanup'],
    ['plain-colon-word', 'A colon word that is no filter stays a term', 'time:10 meeting'],
    ['all-filters', 'All task filters and priorities are recognised', 'is:open is:done is:overdue is:today is:mine prio:low']
].forEach(([slug, name, query]) => add('globalSearch', slug, name, { query }));

[
    ['start-of-title', 'Term at the start of the title scores 4', ['fix'], 'Fix the checkout', []],
    ['start-of-word', 'Term at a word boundary scores 3', ['checkout'], 'Fix the checkout', []],
    ['inside-word', 'Term inside a word scores 1.5', ['heck'], 'Fix the checkout', []],
    ['fuzzy-subsequence', 'Fuzzy subsequence of at least three characters scores 0.5', ['fxt'], 'Fix the checkout', []],
    ['fuzzy-too-short', 'Fuzzy match needs three characters', ['ft'], 'Fix the checkout', []],
    ['secondary-text', 'A term found only in secondary text scores 0.75', ['relaunch'], 'Fix the checkout', ['Website Relaunch']],
    ['all-terms-must-match', 'Every term has to match, otherwise the score is 0', ['fix', 'unrelated'], 'Fix the checkout', ['Website']],
    ['exact-title-bonus', 'An exact title match adds 3', ['fix', 'the', 'checkout'], 'Fix the checkout', []],
    ['no-terms', 'No terms always scores 1', [], 'Anything', []],
    ['diacritics-in-title', 'Titles are normalized before matching', ['uber'], 'Übersicht', []],
    ['multiple-terms-sum', 'Term scores add up', ['fix', 'check'], 'Fix the checkout', []]
].forEach(([slug, name, terms, title, secondary]) => add('globalSearchScore', slug, name, { terms, title, secondary }));

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------

const root = here;
Object.entries(cases).forEach(([module, list]) => {
    const dir = join(root, module);
    mkdirSync(dir, { recursive: true });
    readdirSync(dir).filter((file) => file.endsWith('.json')).forEach((file) => rmSync(join(dir, file)));
    list.forEach(({ slug, name, input }, index) => {
        const expected = JSON.parse(JSON.stringify(runFixture(module, JSON.parse(JSON.stringify(input)))));
        const fileName = `${String(index + 1).padStart(2, '0')}-${slug}.json`;
        writeFileSync(join(dir, fileName), `${JSON.stringify({ name, input: JSON.parse(JSON.stringify(input)), expected }, null, 2)}\n`);
    });
    console.log(`${module}: ${list.length} fixtures`);
});
