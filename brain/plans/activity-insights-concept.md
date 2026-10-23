# Activity & Insights — Concept

Status: in progress (2026-10-23, session `activity-insights`). Contract for other surfaces:
[activity-events-contract.md](./activity-events-contract.md).

## Goal
One workspace-wide event stream as the foundation for a workspace activity feed (`/activity`),
a unified project activity view, a workspace insights dashboard (`/insights`) and — in other
sessions — Flows (automations), Files and Wiki.

## Building blocks
1. **Event stream** `tenants/{t}/activity/{eventId}` — written only by Cloud Functions
   (`functions/src/activity-events.ts`, `emitActivityEvent`). The existing triggers
   (`onTaskWritten`, `onSubtaskWritten`, `onCommentCreated`, `onProjectWritten`) emit typed
   events next to the legacy free-text `projects/{p}/activities` entries (which stay for the
   task-detail history and iOS until those move over). Retention 365 days via TTL on `expireAt`.
2. **Actor attribution** — user by default (`updatedBy` contract C1). Machine writers stamp
   `writeVia` on the written doc (`{ kind: 'ai', client }` from the API/MCP, `{ kind: 'automation',
   id, name }` from Flows); the trigger turns it into `actor.kind`/`actor.client`.
3. **Read rules** — full members read every event; guests only events whose `projectId` is a
   project they are a member of (queries must filter `projectId`). Workspace-level events
   (`projectId: null`) are full-member only.
4. **Activity feed** (`web/components/activity/ActivityFeed.tsx`) — one component for
   `/activity` (workspace) and `/project/:id/activity` (project, replaces the old list).
   Filters: person, project (workspace mode), domain (type group), period (7/30/90 days/all).
   Grouped by day, cursor pagination (30 per page, IntersectionObserver), live updates for the
   first page via `onSnapshot`, row click jumps to the object (task, project, comment target).
5. **Insights** (`/insights`, full members only) — metrics precomputed daily by the scheduled
   function `computeWorkspaceInsights` (03:30 Europe/Berlin) into
   `tenants/{t}/insights_daily/{YYYY-MM-DD}` plus `.../latest`. One doc read per page load.
   An on-demand callable `refreshWorkspaceInsights` (rate-limited to once per 10 min per
   workspace) covers the first day and "refresh now".
   - Per project weekly series (12 ISO weeks): created, completed, scope (cumulative tasks),
     done (cumulative), cycle-time sum/count, plus current open / overdue / blocked /
     due-in-window counts, on-time rate (completed with due date, completed ≤ due), activity
     events in the last 7 days.
   - Per person: open, overdue, due in the next 7 days (workload).
   - The client aggregates over the selected projects and period (4 / 8 / 12 weeks), so filters
     cost nothing.
   - Health = on-time rate, blockers, overdue share, recent activity → `good | watch | risk`.
6. **AI weekly report** — callable `generateWeeklyInsightsReport` (OpenAI via the existing
   `ai-service.ts` client helpers): input = the latest insights doc + up to 200 events of the
   last 7 days (titles/types only). Output markdown (progress, risks, next steps), stored in
   `tenants/{t}/insights_reports/{isoWeek}-{lang}`; copy button and "save as wiki page"
   (`createWikiPageFromMarkdown`, workspace wiki, shown while `WORKSPACE_AREAS.wiki` is on).
7. **Sidebar** — "Arbeitsbereich" gains Activity, Insights, Documents, Wiki, Flows.
   Documents/Wiki/Flows are gated by `WORKSPACE_AREAS` in `web/config/features.ts`; the owning
   sessions flip their flag once their route exists. Guests see Activity (scoped to their
   projects) but not Insights/Documents/Wiki/Flows unless the owning session decides otherwise.

## Charts
Recharts (already in the bundle). Calm: one series colour from brand tokens, muted grid, no
legends where a title suffices. Charts: throughput bars, cycle-time line, burn-up (scope vs
done) for the selected project(s), workload bars per person. KPI tiles above.

## Out of scope / later
- Backfill of legacy `projects/{p}/activities` into the stream (needs orchestrator approval).
- iOS feed (iOS session, from the contract).
- Initiatives/milestones/sprints events (add types when needed).
