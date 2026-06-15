# Collaboration, Team & Presence — Rebuild Plan

Last updated: 2026-06-13

Status: **Phase 1 + 2 done; Phase 3 (permissions) — workspace scope done, project scope
remaining.** Pre-release DB wipe is assumed, so this plan deliberately drops backwards
compatibility where it simplifies the target design.

### Implementation log — 2026-06-13 — Permissions, workspace scope (Proposals A + C)

The Discord-style node model is now anchored in the DB for the **workspace/tenant** scope:

- Discovery: there were **three** role systems — legacy `customRoles[]`/`Permission`
  (rolesService, orphaned `WorkspaceRolesTab`), the node model (`permissionService`/
  `PermissionContext` via a legacy bridge), and a `FirestoreRole` role-docs API in
  `dataService.ts` already used by `components/settings/RoleManagement.tsx` (the polished
  node-based UI, already wired into `SettingsModal`). Convergence = make the role-docs +
  node model authoritative.
- `web/context/PermissionContext.tsx`: rewritten to be authoritative — subscribes to
  `subscribeTenantRoles` (DB role docs) + members, builds the current user's effective
  roles from `member.roleIds` + implicit Member (+ Owner/Guest system roles, code-defined).
  Legacy single-role bridge removed.
- `web/services/domain/workspaceMembersService.ts`: members now carry `roleIds: string[]`
  (authoritative stacking); added `setMemberRoleIds`. `role` kept as primary/display only.
- `web/services/internal/workspaceDataCore.ts`: new members seed `roleIds: []`.
- `web/screens/Team.tsx`: role list now comes from DB role docs; member detail replaced the
  single-role `<select>` with Discord-style multi-role toggle chips (`setMemberRoleIds`).
- `web/types.ts`: `Member`/`TenantMembership` gained `roleIds`.
- `firestore.rules`: `tenants/{tid}/roles/{roleId}` read=member, write=owner; `roles` added
  to the catch-all denied list; self-membership updates can no longer change `role`/`roleIds`
  (escalation guard).
- System roles (Owner/Member/Guest) are code-defined (`SYSTEM_ROLE_DEFAULTS`); only custom
  roles are DB docs — so no seeding step, and `RoleManagement` stays as-is.
- Verified: `web` build passes; touched files tsc-clean (only pre-existing errors remain);
  local app boots with no console errors.
- **Deploy step:** `firebase deploy --only firestore:rules`.

**Remaining (project scope):** the legacy project-permission system (`rolesService.ts`
`Permission`/`CustomRole`, `project.roles{}` map, `useProjectPermissions`, `RolesTab`,
`ProjectTeamManager`, `useWorkspaceRoles`) is untouched and still functional. Project-scope
convergence onto the node model (project membership `roleIds`, Project Owner role docs,
project role UI) is the next chunk. `getWorkspaceRoles` (reads the now-unused
`tenant.customRoles`) and the orphaned `WorkspaceRolesTab` should be removed during that pass.

### Implementation log

- **2026-06-13 — Presence moved to Realtime Database (Proposal B) + rules hardening
  (part of C).** Done:
  - `web/services/firebase.ts`: optional RTDB init guarded by `VITE_FIREBASE_DATABASE_URL`
    (presence degrades gracefully when unset). Exports `rtdb`.
  - `web/services/domain/presenceService.ts` (new): single RTDB node per user at
    `/status/{tenantId}/{uid}` with `onDisconnect` → offline; `connectPresence` (owner
    writer) + `subscribeTenantPresence`. Project context is a `currentProjectId` field,
    not a separate collection.
  - `web/hooks/usePresence.ts`: rewritten on RTDB, same hook API. `useWorkspacePresence`
    is the single owner (idle/visibility/manual status); `usePresence` only annotates
    `currentProjectId`; `useProjectPresence`/`useWorkspaceTeamPresence` read via RTDB.
    Fixes the old idle/busy-write bug and the `isBusy` type drift.
  - `web/components/TeamCard.tsx`, `web/screens/ProjectOverview.tsx`: migrated to the hooks
    (removed direct `subscribeProjectPresence`, dropped `heartbeatInterval` option).
  - Removed Firestore presence functions from `web/services/dataService.ts`.
  - `database.rules.json` (new) + `firebase.json` database entry: `/status` readable by any
    authed user, writable self-only. `web/.env.example`: documented `VITE_FIREBASE_DATABASE_URL`.
  - `firestore.rules`: removed the Firestore `presence` rule (now denied by default);
    invite links are `get`-able by id but `list` is owner-only (no enumeration).
  - Verified: `web` vite build passes; new files are tsc-clean; local app boots with no
    console errors (presence inert without the DB URL).
  - **Manual steps still required to make presence live:** (1) enable Realtime Database in
    the Firebase console, (2) set `VITE_FIREBASE_DATABASE_URL`, (3) deploy
    `firebase deploy --only database`.
  - **Known tradeoff:** RTDB `/status` read is `auth != null` (cross-tenant presence is
    technically readable). Upgrade path: mirror tenant membership into RTDB and gate reads
    on it. Tracked as a follow-up.

Scope: how collaborative features, the team/permission foundation, and the online-state
(presence) feature are structured today, the concrete defects found, and a target design
for each. Companion to [reference/app/PERMISSIONS.md](../reference/app/PERMISSIONS.md) and
[reference/app/FIRESTORE_STRUCTURE.md](../reference/app/FIRESTORE_STRUCTURE.md).

---

## 1. Current State (verified in code)

Everything collaborative lives under `tenants/{tenantId}`. Three layers:

1. **Team / membership** — workspace members, project members, a fully built Discord-style
   role/permission model.
2. **Collaboration** — comments, @mentions, assignments, notifications, activity feed;
   all live via `onSnapshot`.
3. **Presence / online-state** — heartbeat-based, written to Firestore, no RTDB/`onDisconnect`.

### 1.1 Team & Permissions

Key files:
- UI: `web/screens/Team.tsx`, `web/components/InviteMemberModal.tsx`,
  `web/screens/JoinWorkspaceViaLink.tsx`, `web/screens/JoinProjectViaLink.tsx`
- Model: `web/types/permissions.ts`, `web/services/permissionService.ts`,
  `web/context/PermissionContext.tsx`, `web/hooks/useWorkspacePermissions.ts`,
  `web/services/rolesService.ts`, `web/utils/permissions.ts` (legacy matrices)
- Membership/invites: `web/services/domain/workspaceMembersService.ts`,
  `web/services/domain/inviteLinksService.ts`, `functions/src/invitations.ts`

### 1.2 Collaboration

- Comments: `web/components/CommentSection.tsx`, `subscribeComments` →
  `tenants/{tid}/projects/{pid}/comments`. Supports tasks/issues/ideas/initiatives,
  @mentions (user/group/role), GitHub comment sync.
- Notifications: `web/services/notificationService.ts` +
  `functions/src/notifications.ts` (FCM + email + delivery logs).
- Activity feed: `web/services/domain/activityService.ts` →
  `tenants/{tid}/projects/{pid}/activities`.

### 1.3 Presence

- Hooks: `web/hooks/usePresence.ts` (`usePresence`, `useProjectPresence`,
  `useWorkspacePresence`, `useWorkspaceTeamPresence`).
- Writes: `web/services/dataService.ts` (`updatePresence`, `updateWorkspacePresence`,
  `subscribeProjectPresence`, `subscribeWorkspacePresence`).
- Model: `tenants/{tid}/presence/{uid}` and `tenants/{tid}/projects/{pid}/presence/{uid}`.
- Heartbeat 30s, idle after 10min, read-side offline timeout 2min. No RTDB.

---

## 2. Defects & Gaps Found

### 2.1 Permission model is not anchored in the database

The Discord-style model is fully coded but not persisted or enforced as designed:

| Aspect | Design (PERMISSIONS.md) | Actual |
| --- | --- | --- |
| Roles per user | `roleIds: string[]` (stacking) | single `role: string` on `members/{uid}` |
| Custom role storage | `tenants/{tid}/roles/{roleId}` docs | array `tenants/{tid}.customRoles[]` |
| Node evaluation (deny>allow) | authoritative | client-only; mostly via legacy capability matrices |
| Project roles | nodes + Project Owner | still legacy `'Owner' \| 'Editor' \| 'Viewer'` |

- `rolesService` CRUD exists but is wired to no UI (no role management screen).
- Email invites (`functions/src/invitations.ts`) write records that never appear in,
  or are revocable from, the UI.

### 2.2 Firestore rules enforce nothing granular

`firestore.rules`:
- `match /projects/{projectId}/{document=**} { allow read, write: if canAccessProjectById }`
  → any project member can read/write **all** project subcollections (incl. `roles`,
  `members`, `comments`). A "Viewer" can mutate anything via the SDK. The entire
  permission system is cosmetic/client-side only.
- `invite_links` / `inviteLinks`: `allow read: if true` → publicly **list-able**;
  invite links are enumerable.
- `presence/{presenceId}`: `allow write: if canAccessTenant` with **no** check that
  `presenceId == request.auth.uid` → any member can overwrite another member's presence.

### 2.3 Presence bugs

- **Project presence loses idle/busy.** `usePresence.ts:62`:
  ```js
  await updatePresence(projectId, targetState === 'offline' ? 'offline' : 'online', tenantId);
  ```
  `targetState` is computed correctly to `idle`/`busy` and stored in `currentStateRef`,
  but the Firestore write collapses everything to `'online'`. All project-level
  idle/busy logic is dead code. (The workspace variant at line 285 writes correctly.)
- **No `onDisconnect`.** Offline detection relies on `beforeunload`/`pagehide` + a 2-min
  read timeout. `beforeunload` is unreliable (mobile, crash, network loss) → users appear
  "online" for up to 2 minutes after leaving.
- **Cost/scale.** Every client writes a doc every 30s; every other client listens via
  `onSnapshot`. N concurrent users → N writes/30s + ~N×N reads. Firestore is the most
  expensive option for presence.
- **Type drift.** `useProjectPresence` returns `isBusy`, but the `PresenceData` interface
  does not declare it.
- **Duplication.** Project and workspace presence are two near-identical hook
  implementations.

### 2.4 Collaboration gaps (minor)

- Reactions exist only as locale keys, not implemented.
- @mentions are stored as plaintext `@Name` in comment content, not structured
  references → fragile on rename.
- No live-editing / typing / shared-cursor (acceptable for a PM tool).

---

## 3. Target Design

### 3.1 Permissions — anchor the model in the DB (Proposal A)

Adopt the PERMISSIONS.md storage model for real:

- `tenants/{tid}/members/{uid}`: replace `role: string` with `roleIds: string[]`
  (Member implicit, not stored). Keep `tenants/{tid}.roles` cache map only as an
  O(1) read optimization, derived from role docs.
- `tenants/{tid}/roles/{roleId}`: real documents with
  `{ name, position, isSystem, systemKey, permissions: { allow[], deny[] } }`.
  Drop the `customRoles[]` array on the tenant doc.
- `tenants/{tid}/projects/{pid}/members/{memberId}`: `roleIds: string[]`
  (`type: workspaceUser | external`, Guest mandatory for externals).
- `tenants/{tid}/projects/{pid}/roles/{roleId}`: only the per-project Project Owner role
  (`permissionsMode: ALL_PROJECT_PERMISSIONS`).
- Use the existing `evaluatePermission` as the single source of truth; delete the legacy
  capability matrices in `web/utils/permissions.ts` and the legacy mapping branches in
  `permissionService.ts` / `useWorkspacePermissions.ts`.
- Build the missing role-management UI on top of the existing `rolesService` CRUD
  (vertical ordered list, hierarchy-bound editing per PERMISSIONS.md §10).
- Make email invites a first-class, listable, revocable record alongside link invites.

### 3.2 Rules — enforce coarse authorization server-side (Proposal C)

- Replace the project `{document=**}` catch-all with per-subcollection matches; gate
  writes to sensitive subcollections (`roles`, `members`, project settings) behind
  owner/role checks; keep collaborative data (comments, activities, tasks) member-writable.
- `invite_links`/`inviteLinks`: forbid `list`; allow `get` by id only (or validate/join
  via a callable function). Never `allow read: if true` on the collection.
- `presence`: `allow write: if request.auth.uid == presenceId` (self-write only).
- Full node-level enforcement is impractical in pure rules; the pragmatic split is
  **rules = isolation + coarse role gates**, **client = full UX-level node evaluation**,
  with high-risk mutations routed through Cloud Functions (as finance already is).

### 3.3 Presence — move to Realtime Database (Proposal B)

Canonical Firebase presence pattern:

- RTDB `/status/{uid}`: `{ state, lastChanged, projectId? }`, written with
  `onDisconnect().set({ state: 'offline', ... })` so disconnects are instant and reliable
  even on crash/network loss.
- Single unified presence service: workspace-level presence with the current project as a
  field, instead of two parallel collections + two hooks. Project "who's here" is derived
  by filtering on `projectId`.
- Mirror only a coarse `lastActive`/`online` flag into Firestore if any non-realtime
  surface (e.g. server functions, reporting) needs it.
- Keep idle/busy semantics, but write the **actual** state (fixes 2.3 bug 1 regardless of
  the RTDB move).
- Add `presence` (RTDB) security rules: self-write, tenant-scoped read.

Immediate low-risk fix usable even without the RTDB move: change `usePresence.ts:62` to
write `targetState` instead of collapsing to `'online'`, declare `isBusy` on
`PresenceData`, and add the `presenceId == auth.uid` rule guard.

---

## 4. Suggested Sequencing

1. Quick correctness fixes: presence idle/busy write, `isBusy` type, presence self-write
   rule, invite-link `list` lockdown. (Low risk, no model change.)
2. Presence → RTDB + unified service (Proposal B).
3. Permission model in DB + rules hardening + role-management UI (Proposals A + C);
   largest change, best done as one mini-project since the DB wipe removes migration cost.

## 5. Open Questions

- Should externals (Guests) ever appear in workspace presence, or project-only?
- Is per-node server enforcement required for any module (e.g. finance already uses
  Functions), or is coarse-rule + client-eval acceptable at launch?
- Keep separate workspace vs project presence semantics, or fully unify per §3.3?
