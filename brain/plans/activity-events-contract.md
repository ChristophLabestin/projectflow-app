# Activity Events Contract (v1)

Workspace-wide event stream. Owner: Activity & Insights. Consumers: `/activity`, project
activity, `/insights`, Flows (automations), Files, Wiki, iOS. Concept:
[activity-insights-concept.md](./activity-insights-concept.md).

## Path & writers
`tenants/{tenantId}/activity/{eventId}` — **server-only** (rules: `write: if false`).
Write exclusively through `emitActivityEvent()` in `functions/src/activity-events.ts`:

```ts
await emitActivityEvent(tenantId, {
    type: 'file.uploaded',
    actor,                                   // ActivityActor, see below (actorFromUid / aiActor / automationActor)
    object: { type: 'file', id: fileId, title: 'Brief.pdf' },
    projectId,                               // permission scope; null = workspace-level
    changes: { name: { from: 'a.pdf', to: 'b.pdf' } },   // optional
    meta: { sizeBytes: 1234 }                // optional, small (< 1 KB), flat
}, `${context.eventId}-file`);               // idempotency key → doc id (retries don't duplicate)
```

## Schema
| Field | Type | Notes |
|---|---|---|
| `v` | `1` | schema version |
| `type` | string | `<domain>.<verb>` lower_snake, e.g. `task.status_changed` |
| `domain` | string | prefix of `type` (`task`, `comment`, `project`, `file`, `doc`, `automation`, …) — used by the type filter |
| `actor` | map | `{ kind: 'user'\|'ai'\|'automation'\|'system', id: string\|null, name, photoURL?, client?, automationId?, automationRunId?, automationDepth? }` |
| `cause` | map | `{ kind, id, automationRunId?, depth }` — origin for chain/loop detection; `id` = flow id for automations, user uid otherwise; `depth` 0 for non-automation, else the flow chain depth (1–3) |
| `actorId` | string\|null | user uid (for `ai`: the connecting user); `null` for automation/system. Flattened for queries |
| `object` | map | `{ type, id, title, parentType?, parentId? }` — `title` is a snapshot at event time |
| `projectId` | string\|null | **required for anything project-scoped**; drives read access |
| `projectTitle` | string? | snapshot |
| `changes` | map? | `{ [field]: { from, to } }` for field changes (JSON-safe values; dates as `YYYY-MM-DD`/ISO) |
| `meta` | map? | type-specific, flat, small. Optional `meta.path` = in-app route the feed opens on click (use it for files/docs/flows) |
| `source` | string | writer id, e.g. `onTaskWritten`, `files.upload` |
| `createdAt` | Timestamp | server time |
| `expireAt` | Timestamp | `createdAt + 365 days` → Firestore TTL deletes it |

Actor display: `kind: 'ai'` renders "Name via Claude"; `automation` renders the flow name.

## Types (v1)
| Type | Emitted by | `changes` / `meta` |
|---|---|---|
| `task.created` | onTaskWritten | `meta.initiativeId?` |
| `task.status_changed` | onTaskWritten | `changes.status` (not for done/reopen) |
| `task.completed` / `task.reopened` | onTaskWritten | — |
| `task.assigned` | onTaskWritten | `meta.assigneeIds` (added), `meta.assigneeNames` |
| `task.unassigned` | onTaskWritten | `meta.assigneeIds` (removed) |
| `task.due_changed` | onTaskWritten | `changes.dueDate` |
| `task.priority_changed` | onTaskWritten | `changes.priority` |
| `task.renamed` | onTaskWritten | `changes.title` |
| `task.deleted` | onTaskWritten | actor `system` (deleter unknown) |
| `subtask.created` / `subtask.completed` | onSubtaskWritten | object = subtask, `parentType: 'task'` |
| `comment.created` | onCommentCreated | object = comment, parent = target; `meta.snippet` (≤ 140 chars) |
| `project.created` | onProjectWritten | object = project |
| `project.status_changed` | onProjectWritten | `changes.status` |
| `project.member_added` / `project.member_removed` | onProjectWritten | `meta.userIds`, `meta.userNames` |
| `file.uploaded`, `file.deleted` | *Files session* | reserved |
| `doc.created` / `doc.updated` / `doc.archived` / `doc.restored` / `doc.deleted` | onWikiDocWritten | object = doc; `meta.path`, `meta.spaceType`; `doc.updated` throttled (1 per page + person / 10 min), `changes.title` on rename |
| `automation.ran`, `automation.failed` | *Flows session* | reserved; `meta.flowId`, `meta.runId` |

## Extending (other sessions)
1. Pick `<domain>.<verb>`; reuse a domain if it fits. Add it to `ACTIVITY_EVENT_TYPES` in
   `functions/src/activity-events.ts` **and** `web/config/activityTypes.ts` (icon, domain, i18n
   key `activity.types.<type>` in `web/locales/en.ts` + `de.ts`). Unknown types render with a
   generic fallback, so old clients keep working.
2. Emit only from server code via `emitActivityEvent` with a deterministic key.
3. Project-scoped objects **must** set `projectId`; otherwise guests never see them and full
   members do — choose consciously.
4. Never put secrets, full comment/document bodies or personal data beyond names in `meta`.
5. Machine writes to task/project docs set `writeVia` on the doc in the same write:
   `{ kind: 'ai', client: 'Claude', at: serverTimestamp() }` or
   `{ kind: 'automation', id: flowId, name: flowName, runId, depth, at: serverTimestamp() }`
   (`runId`/`depth` → `actor.automationRunId`/`automationDepth` and `cause`). Triggers attribute
   the event to that actor when `writeVia.at` changed in the write. **Flows: always set it**, and
   skip running automations for events with `actor.kind === 'automation'` from the same flow
   (loop guard).

## Read access (firestore.rules)
- Owner/Admin/Member: every event of the workspace.
- Guest: only events with `projectId` of a project whose `memberIds` contain them. Guest queries
  **must** constrain `projectId` (`==` or `in` ≤ 30), otherwise the query is denied.
- Workspace-level events (`projectId == null`): full members only.

## Indexes (composite, all `createdAt desc`)
`projectId`, `actorId`, `domain`, `object.id`, and the pairs/triple of
`projectId`+`actorId`+`domain`. Range filters only on `createdAt`.

## Example queries (web, modular SDK)
```ts
const col = collection(db, 'tenants', t, 'activity');
query(col, orderBy('createdAt', 'desc'), limit(30));                                   // workspace feed
query(col, where('projectId', '==', p), orderBy('createdAt', 'desc'), limit(30));      // project feed
query(col, where('object.id', '==', taskId), orderBy('createdAt', 'desc'), limit(20));  // object history (full members)
query(col, where('domain', '==', 'task'), where('createdAt', '>=', since), orderBy('createdAt', 'desc'));
```
Server (Flows): react in a trigger on `tenants/{t}/activity/{id}` (`onDocumentCreated`) and filter
on `type`; never write back into `activity` except via `emitActivityEvent`.
