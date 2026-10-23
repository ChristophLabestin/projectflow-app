# Decision Log

Last updated: 2026-06-04

## Decision Entries

- 2026-10-23: iOS — native SwiftUI mechanics for sheets and page navigation, custom visuals.
  - Rationale: owner wants sheets and navigation pages to feel natural ("sollten schon von SwiftUI sein") while the navigation bar and all chrome stay custom ("custom navbar, nicht native").
  - Decision: `PFNavigator` wraps `NavigationStack` (system bar hidden, own headers); `PFPresenter` presents native `.sheet`s with detents; the bottom navigation bar (`PFDock`), headers, focus bar and controls are custom (own frosted surface instead of system Liquid Glass).

- 2026-10-22: iOS app uses its own UI components instead of native SwiftUI controls.
  - Rationale: owner wants innovative, intuitive, immersive custom UI elements.
  - Decision: custom dock, focus bar, navigator, sheets, swipe rows, peek, segments, chips, date strip, switches, toasts on top of SwiftUI primitives and `glassEffect`; native only for text input, scroll containers and system integrations. Implementation contracts in [plans/ios-implementation-contracts.md](./plans/ios-implementation-contracts.md).
  - Consequences: accessibility (VoiceOver, Dynamic Type, Reduce Motion) must be built into every component; the component catalog checks it.

- 2026-10-22: Owner decisions for the new iOS app (concept §12).
  - Rationale: the seven open questions of [plans/ios-app-concept.md](./plans/ios-app-concept.md) v2 blocked Phase 0.
  - Decision:
    1. Minimum iOS 26.2 (Liquid Glass, hideable focus bar); older iPhones use the mobile web app.
    2. Add Sign in with Apple on iOS **and** web; keep Google/GitHub. Handle Apple relay e-mails vs. e-mail invites (`invitations.ts` requires an exact verified match) via invite links, "link Apple" in account settings and a clear `invite-email-mismatch` message.
    3. Reminder recipients: creator by default (`createdBy`, `recipientIds`), optional "also remind assignees"; legacy reminders without creator go to task assignees / project owner, past ones are not sent.
    4. Passkey sign-in keeps replacing TOTP (a user-verified passkey is MFA); set passkey options `userVerification` to `'required'`.
    5. Web dashboard counts personal tasks (shared `dayPlan` module; lock glyph; only overdue/due today/scheduled today).
    6. Web adopts AA-safe status text tokens `--color-status-*-text` (values in concept §4.1); `text-subtle` never carries information.
    7. Presence: iOS v1 only displays others' presence; manual status later, no automatic online heartbeat from the phone.
  - Alternatives considered: iOS 26.0 with a custom focus bar; dropping Google/GitHub on iOS instead of adding Apple; TOTP after passkey; iOS-only personal tasks in Heute.
  - Consequences: Phase 0 now includes the web follow-ups (Apple login, status tokens, personal tasks in the dashboard) besides the backend prerequisites.

- 2026-10-22: Rebuild the native iOS app from scratch.
  - Rationale: the owner wants an intuitive, innovative, immersive iOS app that matches the web design language; the old companion app followed a parity approach.
  - Decision: delete `swift/` and its docs; the new app lives under `ios/` (planned), iPhone-first, iOS 26+, SwiftUI; the phone is the "pacemaker" for today/focus/capture/inbox, the web stays the workbench for planning and admin. Concept: [plans/ios-app-concept.md](./plans/ios-app-concept.md).
  - Alternatives considered: refactor the old app; parity port of all web routes.
  - Consequences: no iOS build in CI or Brain commands until Phase 0 creates the new project; backend prerequisites (notification fan-out, APNs payload, passkeys, universal links) are tracked in the concept.

- 2026-06-04: Adopt `/brain` as the repository living knowledge base.
  - Rationale: root Markdown and `docs/` had become scattered, making agent re-entry slower and less reliable.
  - Decision: scaffold an app-type Brain, move former root docs into `brain/reference/app/`, move old `docs/` content into themed Brain folders, and keep only conventional root Markdown entry points.
  - Alternatives considered: keep the old docs folder and add an index; create a new Brain without moving historical docs.
  - Consequences: future project context starts in `brain/README.md`; legacy docs remain available but are no longer the top-level navigation system.

- 2026-09-26: Multi-workspace tenancy with invitations.
  - Rationale: tenant id == owner uid made ownership untransferable, let anyone who knew a uid self-join a tenant, and gave users no way to belong to several workspaces.
  - Decision: random tenant ids with `ownerId`; access only via `tenants/{t}/members/{uid}` with roles Owner/Admin/Member/Guest; invitations (email or link) accepted server-side by `acceptWorkspaceInvite`; guests scoped to projects via `memberIds`; the UI shows only the active workspace and switches via the sidebar switcher (full reload).
  - Alternatives considered: keep uid-tenants and add extra workspaces beside them (two identity models); client-side acceptance guarded by rules (complex cross-document rules, weaker guarantees).
  - Consequences: no data migration needed (fresh Firebase project `projectflow-labestin`); old invite routes (`/invite/:tenantId`, `/join…`, `/invite-project…`) removed; cross-workspace "shared projects" lists are replaced by workspace switching.

- 2026-09-26: Recalibrated project health scoring.
  - Rationale: roughly 30 independent penalties summed linearly from a baseline of 70, so one underlying problem (for example two overdue tasks) tripped several related factors and ordinary active projects hit 0/critical.
  - Decision:
    - baselines are Active 82, Planning 72, On hold 60, Completed 85;
    - negative factors are grouped into delivery (cap 35), flow (cap 25) and hygiene (cap 10), and positives are capped at 12;
    - inside each group penalties saturate as `cap × (1 − e^(−raw/cap))`;
    - factor impacts are rescaled so the UI explanation sums to the score;
    - the guardrail for a single urgent overdue task moved from 42 to 58, and for urgent-due-soon from 58 to 68;
    - a past-due project with open work stays capped at 34 (critical).
  - Consequences: the seed "Website Relaunch" project moved from 0 to 39 (warning) and "Mobile App v2" sits at 52. Tests are in `web/utils/__tests__/projectHealth.test.ts`. Initiative health is unchanged.

- 2026-09-26 — Project overview: one navigation, one work surface.
  - Decision: the sidebar is the only project navigation. The overview lost its Work/Roadmap/Sprints/Milestones/Activity tabs; Roadmap is now a work view in the view switcher, the others live only on their sidebar pages. The header is borderless (card only with a cover), shows one progress + health summary, a "Project info" button and a "…" menu (pin, full width, report, invite, settings, lifecycle); attention sits in a chip row below the title. Quick add is the first item of the command row. Initiatives start collapsed with a summary. Brief/team/resources moved into a right-hand drawer (`ProjectContextDrawer`).
  - Why: two navigations for the same targets plus eight differently styled bands made the page feel unsettled.

- 2026-09-26 — Signup hardening and first-run rework.
  - Security: email invitations require a verified address (checked in `acceptWorkspaceInvite` via the user record), signup sends a confirmation mail; `users` can be fetched by uid but not listed; AI usage and last workspace moved to `users/{uid}/private/*`.
  - First run: welcome dialog → one-step project create (starter tasks optional) → dashboard "Getting started" checklist; empty states with actions; PM-core default modules reduced to tasks/initiatives/milestones/activity; Codex hidden for projects created from non-software templates; Finance/Media behind "More" for new accounts; overview view state and sidebar width stored per user instead of per device; team badge removed, invite action in the team menu.
  - Why: the audit showed new users landed on an empty dashboard with no guidance, a 6-step project wizard and an 11-item project sidebar.
- 2026-10-22: Social removed, Marketing reduced to blog; data retained but closed by rules.
  - Decision: remove the Social module, Marketing dashboard/ads/email/recipients, their Cloud Functions and permission nodes, plus Flows/Ideas/Issues remnants and ~40 dead files.
  - Data: Firestore data is kept (no migration); `isRetiredProjectCollection()` denies client access, including platform tokens in `social_integrations`.
  - Consequence: removed functions stay live until deployed with `--force`; newsletter subscribers remain in `marketing_recipients` (Admin SDK only).

## Follow-Ups

- Create ProjectFlow tracking record once `PROJECTFLOW_API_TOKEN` is available.
