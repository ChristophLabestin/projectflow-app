# Web Feature Audit - 2026-02-11

## Scope
- Surface: Web app routes defined in `/Users/christophlabestin/Documents/GitHub/projectflow-app/web/Router.tsx`
- Priority: correctness-first
- Status legend: `not-started`, `in-progress`, `passed`, `failed`, `fixed`
- Severity legend: `P0` (critical), `P1` (high), `P2` (medium), `P3` (low)

## Audit Workspace Dataset (Required)
- Workspace modules enabled: `tasks`, `issues`, `flows`, `milestones`, `sprints`, `social`, `marketing`, `finance`
- Seed entities: 3 active projects, 1 planning project, mixed private/public, at least 25 tasks, 10 issues, 12 flows, 6 milestones, 2 sprints, 3 social campaigns, 3 ad campaigns, 2 email campaigns
- Roles to validate: owner, editor, viewer

## Route Inventory Checklist
| Route | Area | Status | Severity | Reproduction | Root Cause | Fix Scope | Test Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/login` | Public/Auth | fixed | P1 | Register mode was blocked even when route forced register | Hard-disabled register controls in login form | Re-enabled via `VITE_AUDIT_SIGNUP_ENABLED` toggle | manual |
| `/register` | Public/Auth | fixed | P1 | Register flow inputs/submit disabled | Hard-disabled register branch | Re-enabled with explicit rollback flag | manual |
| `/auth/action` | Public/Auth | not-started | P2 | Pending full auth action regression run | Not audited yet | Audit pass pending | none |
| `/legal/:type` | Public/Auth | not-started | P3 | Pending legal route smoke | Not audited yet | Audit pass pending | none |
| `/invite/:tenantId` | Public/Auth | not-started | P2 | Pending invite accept path test | Not audited yet | Audit pass pending | none |
| `/invite-project/:projectId` | Public/Auth | not-started | P2 | Pending project invite accept path test | Not audited yet | Audit pass pending | none |
| `/join/:inviteLinkId` | Public/Auth | not-started | P2 | Pending join link valid/invalid/expired matrix | Not audited yet | Audit pass pending | none |
| `/join-workspace/:inviteLinkId` | Public/Auth | not-started | P2 | Pending workspace join valid/invalid/expired matrix | Not audited yet | Audit pass pending | none |
| `/ui` | Public/Auth | not-started | P3 | Pending style guide route smoke | Not audited yet | Audit pass pending | none |
| `/` | Workspace | not-started | P2 | Pending dashboard smoke | Not audited yet | Audit pass pending | none |
| `/notifications` | Workspace | not-started | P3 | Pending notifications smoke | Not audited yet | Audit pass pending | none |
| `/projects` | Workspace | fixed | P1 | Overview layout equality ignored placement and reset migration missing | Incomplete comparison + no migration utility | Added `placement` + `layoutVersion` compare and one-time reset migration utility | unit/manual |
| `/tasks` | Workspace | not-started | P2 | Pending tasks screen smoke | Not audited yet | Audit pass pending | none |
| `/calendar` | Workspace | not-started | P3 | Pending calendar smoke | Not audited yet | Audit pass pending | none |
| `/finance` | Workspace | passed | P3 | Existing Playwright smoke redirects unauthenticated users correctly | N/A | No changes required | e2e (existing) |
| `/brainstorm` | Workspace | fixed | P2 | Sidebar idea badge queried `getProjectIdeas('')` | Invalid project-scoped call for global badge | Replaced with `getUserIdeas()` source | manual |
| `/create` | Workspace | not-started | P3 | Pending create wizard smoke | Not audited yet | Audit pass pending | none |
| `/team` | Workspace | not-started | P3 | Pending team page smoke | Not audited yet | Audit pass pending | none |
| `/media` | Workspace | not-started | P3 | Pending media library smoke | Not audited yet | Audit pass pending | none |
| `/profile` | Workspace | not-started | P3 | Pending profile smoke | Not audited yet | Audit pass pending | none |
| `/personal-tasks` | Workspace | not-started | P3 | Pending personal tasks smoke | Not audited yet | Audit pass pending | none |
| `/personal-tasks/:taskId` | Workspace | not-started | P3 | Pending personal task detail smoke | Not audited yet | Audit pass pending | none |
| `/project/:id` | Project Core | fixed | P0 | Reorder was native HTML5 DnD with drag-over mutation and weak intent model | Legacy drag/drop implementation | Rebuilt to `dnd-kit` with pointer/touch/keyboard, drop indicators, drag-handle only, on-end persistence, rollback | manual |
| `/project/:id/tasks` | Project Core | not-started | P2 | Pending tasks route smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/tasks/:taskId` | Project Core | not-started | P2 | Pending task detail smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/details` | Project Core | not-started | P3 | Pending details smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/activity` | Project Core | not-started | P3 | Pending activity smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/flows` | Project Core | not-started | P2 | Pending flows smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/flows/:flowId` | Project Core | not-started | P2 | Pending flow detail smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/ideas` | Project Core | not-started | P2 | Alias route pending smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/ideas/:flowId` | Project Core | not-started | P2 | Alias detail route pending smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/issues` | Project Core | not-started | P2 | Pending issues smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/issues/:issueId` | Project Core | not-started | P2 | Pending issue detail smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/milestones` | Project Core | not-started | P2 | Pending milestones smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/sprints` | Project Core | not-started | P2 | Pending sprints + module gate smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/social` and child routes | Social | fixed | P1 | TikTok/YouTube popup auth flows had no timeout/closed handling | Missing timeout/close guards in popup await flow | Added popup lifecycle handling with timeout and close detection | manual |
| `/project/:id/social/create` | Social | not-started | P2 | Pending create post smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/social/edit/:postId` | Social | not-started | P2 | Pending edit post smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/social/approvals` | Social | not-started | P2 | Pending approvals smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/social/archive` | Social | not-started | P3 | Pending archive smoke | Not audited yet | Audit pass pending | none |
| `/project/:id/marketing` and child routes | Marketing | fixed | P2 | Native confirm/prompt used in category/import flows | Native browser dialogs in feature workflows | Replaced with app-level confirm/in-modal field creation flow | manual |
| `/project/:id/accounting` | Marketing/Accounting | not-started | P3 | Pending module-gated placeholder smoke | Not audited yet | Audit pass pending | none |

## Focused Finding: ProjectOverview Reorder
- Previous behavior: native HTML5 drag-over mutation caused unstable ordering and poor intent handling.
- Applied change: `dnd-kit`-based reorder with:
  - drag handle activation only
  - pointer + touch + keyboard support
  - explicit drop zone highlighting
  - reorder only on drag end
  - optimistic persistence with rollback on failure

## Release Notes (Audit Wave A)
- Re-enabled signup for audit validation behind `VITE_AUDIT_SIGNUP_ENABLED` (`false` to re-disable).
- Added one-time layout reset utility to restore existing project overview layouts to default core layout.
- Rebuilt ProjectOverview reorder and hardened social auth popup flows.
- Replaced targeted native dialogs in marketing/project group/editor flows.

## Release Notes (Audit Wave B/C - Partial)
- Standardized modal field behavior in task/issue/flow/editor surfaces so only title inputs use seamless styling and all other fields use shared input primitives.
- Removed focus outlines and focus border emphasis for input controls across shared form components (`TextInput`, `TextArea`, `Select`, date-time inputs) and global focus reset.
- Completed i18n pass for high-traffic management modals and drawers:
  - Edit task modal
  - Marketing category manager
  - Recipient import modal
  - Editor slash command drawer + image insert modal
- Added `vite` manual chunk strategy by domain (`editor`, `social`, `marketing`, `data-service`, vendor splits) to reduce monolithic bundle concentration.
- Removed the remaining static/dynamic import conflict for `projectGroupService` by converting `MultiAssigneeSelector` to static service imports.
- Added i18n + standardized form controls for marketing email variable management (`VariableManager`) and removed hardcoded confirmation copy.
- Expanded role-management i18n coverage for destructive flows and role editor actions in `RoleManagement`.
- Synced `SITEMAP.md` route implementation status to match `Router.tsx` and reduce documentation drift.
