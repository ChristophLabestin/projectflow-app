# Web UI Sweep — 2026-10-23

Scope: every authenticated view of `web/` against the seeded emulator (`demo@projectflow.test`),
light + dark, EN + DE, 1024 px and ~390 px for the main screens.

Method: a small DOM audit snippet (wrapping button labels, clipped text, horizontal overflow,
raw i18n keys, collapsed text boxes) per view, plus `get_page_text` and few half-scale screenshots.
Static checks: EN/DE key parity of all locale pairs (clean), Tailwind palette classes in TSX.

Severity: **S** small (cosmetic), **M** medium (visibly broken/unusable in a state),
**L** large (redesign topic, proposal only).

## Findings

| # | View | Problem | Sev | Status |
|---|------|---------|-----|--------|
| 1 | Team | Card grid used viewport breakpoints; with the detail panel open, cards collapsed to ~40 px (names gone), segment tabs wrapped | M | fixed (auto-fill grid, nowrap tabs) |
| 2 | Team | Detail panel was `hidden` below 1024 px, so clicking a member did nothing on tablet/phone | M | fixed (overlay panel below `lg`) |
| 3 | Team | Header showed "0 AI agents" when the workspace has none | S | fixed (`team.v2.statsNoAgents`) |
| 4 | Settings → Account | "Export my data" button squeezed to 112 px, label wrapped inside the fixed 40 px height | M | fixed (`.btn` nowrap + no flex-shrink globally; rows wrap) |
| 5 | Settings → Account | Danger zone / blocker boxes used `rose-*`/`amber-*` palette classes | S | fixed (error/warning tokens) |
| 6 | Settings → Account | GitHub icon used `devicon-*` font that is not loaded → empty circle | S | fixed (inline SVG, currentColor) |
| 7 | Settings nav | Long tab labels ("Pre-Alpha-Konfiguration") wrapped centered | S | fixed (`text-left`, icon `shrink-0`) |
| 8 | Project → Details (`/project/:id/details`) | Page crashed ("Rendered more hooks than during the previous render"): `useMemo` after early returns | M | fixed (plain value) |
| 9 | Topbar (phones) | Search/tools pills overflowed to the left and covered the breadcrumbs | M | fixed (`.topbar-right` no-shrink below 768 px) |
| 10 | Calendar week (phones) | Seven 45 px columns: titles cut to 2–3 letters, dates clipped | M | fixed (week stacks as agenda ≤720 px; month rows shorter) |
| 11 | Project overview (phones) | Initiatives header summary ran off the card ("1 gefährdet" clipped), "Neue Initiative" wrapped | S | fixed (summary on own line, nowrap actions) |
| 12 | Finance cockpit | KPI cards stacked full-width at 1024 px (viewport media query ignores sidebar); header buttons stacked | S | fixed (auto-fit grid, header wraps) |
| 13 | Profile | Hardcoded `zinc/blue/green/black/white` classes; name at 5xl wrapped and pushed the edit button to the edge | S | fixed (tokens, smaller heading, wrapping row) |
| 14 | Shared `Modal` | Close button was a "✕" text glyph with English `aria-label` | S | fixed (material `close` icon, `common.close`) |
| 15 | Workspace settings → Roles | "N permissions" + "SYSTEM" English-only; role list squeezed to 232 px inside the modal (viewport `lg`) | S | fixed (i18n keys, split at `xl`) |
| 16 | i18n (DE) | English-only copy in Profile settings modal, comments (incl. raw relative times), role management, 2FA setup/challenge, media library + image editor, editor menus, whole marketing/blog module (list, editor, settings, connection wizard, AI modal) | M | fixed (342 keys EN+DE, palette colors → tokens) |
| 17 | `ui/Badge`, personal tasks list/detail, accounting placeholder, profile dropdown | Tailwind palette colors (`indigo/emerald/rose/amber/slate`) instead of tokens | S | fixed |
| 18 | Effort / Invoices | Icons passed via `Button icon` render at 24 px (taller than the label); other buttons use 18 px | S | open (global `.btn__icon` size change needs a pass over all icon buttons) |
| 19 | Calendar week (desktop 1024 px) | Event chips in narrow columns cut titles without ellipsis | S | open |
| 20 | Team | "By department" groups by base role when no custom roles exist (ADMIN/MEMBER/OWNER), which reads odd | S | open (product decision: label or fallback) |

## Not reachable with the demo account / seed

- `/admin`, `/admin/crashes`, `/admin/legal`, `/insights/onboarding` → 404 for non-platform admins (expected gate).
- `/brainstorm` redirects (CORA Studio flag off). Onboarding `WelcomeDialog` needs a fresh onboarding state; checked statically only.

## Views checked (47)

Dashboard, My Tasks, Calendar (week/month/unscheduled), Projects list, Team (+ detail panel, invites), Finance cockpit,
Media library, Profile, Notifications page + Notification Center popover, Personal tasks (+ detail), Create project route,
Project overview (list, board, people, timeline, roadmap, calendar, relationships), project tasks + task detail,
initiatives + initiative detail, sprints, milestones, activity, details, effort, invoices, project settings modal
(9 tabs), personal settings (account, preferences, notifications, security, pre-alpha), workspace settings
(workspace, members, roles, email & storage, AI & integrations, API & MCP, danger zone), global search, quick access
(pinned), help center, 404, legal page, download page, OAuth consent. Light + dark, EN + DE; 390 px for the main screens.

## Proposals (not built)

- **Help center content is English-only** (7 pages, ~2,100 lines of hardcoded copy and palette colors in
  `web/components/help/pages/*`). Needs a content translation pass into locale keys (or MDX per language). L.
- ✅ **Done 2026-10-23 (web-app):** `Sidebar.tsx` was still lazy-imported by `AppLayout` as a flag switch (`config/sidebarV2.ts`, default on) to the legacy sidebar; `AppLayout` now loads `SidebarNavigator` directly and `Sidebar.tsx`, `WorkspaceTeamIndicator.tsx`, `ProjectSwitcher.tsx` and the flag are deleted. Original note — **Dead code:** `web/components/Sidebar.tsx` and `web/components/WorkspaceTeamIndicator.tsx` are no longer imported
  (replaced by `SidebarNavigator`) but carry ~55 hardcoded palette classes; delete them. S.
- **Button icon size:** give `.btn__icon .material-symbols-outlined` a size per button size (sm 16 / md 18 / lg 20) and
  drop the per-call `text-[18px]` overrides. S/M, touches many call sites.
- **Calendar on phones:** the stacked week works, but a real day/agenda view with a date strip would fit the iOS app's
  pattern better. M.
