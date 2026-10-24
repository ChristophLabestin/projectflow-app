# ProjectFlow iOS

Native iPhone app (iOS 26.2+, SwiftUI, Swift 6). Concept: `brain/plans/ios-app-concept.md`;
data/behaviour contracts with backend and web: `brain/plans/ios-implementation-contracts.md`.

## Build and run

```bash
cd ios && xcodegen generate            # after adding/removing files (the project is generated, not synchronized)
xcodebuild -project ios/ProjectFlow.xcodeproj -scheme ProjectFlow \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath .xcodebuild build
```

- Simulators per session: `scripts/sim-session.sh create <name>` clones the shut-down device
  "ProjectFlow Golden" (iPhone 18 Pro, iOS 27.0, app preinstalled) to `PF-<name>`. The clone is
  APFS copy-on-write, ~0 MB at first and a few hundred MB once booted. At most 3 run at once.
  For the iPhone Duo use `create <name> duo` (golden "ProjectFlow Golden Duo", iOS 27.1).
  Remove it with `delete <name>`, and `prune` drops all shut-down clones. After larger app changes,
  refresh the golden devices with `scripts/sim-session.sh golden` and `golden duo`.
- Scheme `ProjectFlow` runs the **Emulator** configuration: Firebase project `demo-projectflow` on
  `127.0.0.1` (auth 9631, firestore 8631, functions 5631). Start the emulators + seed with
  `PORT=3030 bash scripts/dev-e2e.sh`. Login: `demo@projectflow.test` / `projectflow-demo`
  (launch argument `-pfAutoLogin`). QA: `-pfLoginEmail <e> -pfLoginPassword <p>` signs in with another emulator account, `-pfAiApps` (DEBUG) opens Account → Connected AI apps, `-pfFirstRun` (DEBUG) replays the first-install flow (welcome → language → crash reports → privacy → terms, `Features/FirstRun`) before sign-in, `-pfSignedOut` starts on the
  sign-in screen, `-pfHoldLaunch` keeps the cold-start scene on screen, `-pfShowOnboarding` (DEBUG) forces the first-sign-in welcome onboarding (name + optional photo → about → team → how → notifications) for the signed-in user.
- `Debug`/`Release` use `App/Resources/Firebase/GoogleService-Info.plist` (project `projectflow-labestin`).

### Crash reports

Own system, opt-in only (`FirstRunState.crashReportsEnabled`): `App/Sources/System/CrashReporter.swift` records fatal
signals and uncaught Objective-C exceptions to `Application Support/CrashReports` and posts them on the next launch to
`crashIngest` (production `https://app.getprojectflow.com/api/crash`, emulator via `PF_EMULATOR_*` ports); MetricKit
diagnostics are added on devices. Reports hold image + offset only; symbolicate on the Mac with
`node functions/scripts/crash-symbolicate.mjs` (finds the archived dSYM by UUID; `--binary-dir .xcodebuild/Build/Products/Emulator-iphonesimulator`
for local builds). Simulator test: launch with `-PFCrashTest` (exception) or `-PFCrashTestSignal` (trap), relaunch, then
open `/admin/crashes`. Release = `MARKETING_VERSION`, build = `CURRENT_PROJECT_VERSION`; keep the archives.

## Layout

| Path | Content |
|---|---|
| `Packages/ProjectFlowKit/Sources/PFModel` | Entities mirroring `web/types.ts`, tolerant `FlexDate`, `Fields` reader |
| `.../PFDomain` | Pure logic ported from `web/utils` (day plan, due buckets, attention, search grammar, capture parser); XCTests run `shared/fixtures` |
| `.../PFDesign` | Tokens (`PFColor`, `pfText`, `PFSpace`, `PFRadius`, `PFMotion`, `PFHaptics`) and the custom component library |
| `.../PFData` | Firebase bootstrap, `AuthService`, `SessionStore`, `WorkspaceStore`, `ProjectStore`, `TaskDetailStore`, `WorkActions`/`FocusActions`/`ProfileActions`/`PlanningActions` (labels, milestones, sprints, initiatives, personal-task move, scheduling) |
| `.../PFSnapshot` | App-Group snapshot for widgets / Live Activity / share extension |
| `App/Sources/Core` | `AppModel`, `AppRouter`/`AppRoute`, `L10n`, `Formatting`, shared `WorkItem` + `WorkItemRow` + `WorkItemActions` (swipe/peek grammar) |
| `App/Sources/Shell` | Root switch, main shell (navigators, dock, focus bar, focus room) |
| `App/Sources/Features/<Feature>` | One folder per feature, incl. its `<Feature>Strings.swift` |
| `App/Sources/System` | App delegate, push, notification actions, Live Activity bridge, snapshot publishing |
| `Widgets`, `Share`, `NotificationService`, `Shared` | Extensions and code shared with the app |

## Rules

- State surfaces like the web (STYLING §1.10/§1.11, `PFSurfaces.swift`), never a border, ring or outline:
  **sunken** (`pfSunken`, `PFSunkenFill`: `PFColor.sunken` + inner shadow) for focused fields (`pfFieldSurface`, rest =
  `PFColor.field`) and the current navigation/list item (dock tab, sidebar workspace, calendar day); **selected**
  (inverted primary, glyphs flip to `onPrimary`, icon tiles `onPrimary` 14 %) for choices — option cards, chips,
  segments, templates, theme; **menus/option sheets** (`pfMenuOption`): chosen option sunken + semibold + 3×14 primary
  bar + check; floating panels `pfGlassPanel` (milky, borderless). Exempt: checkboxes/toggles, colour swatches, tab
  underlines, error/drop states, status/priority markers. Onboarding name uses the capture title field.

- **Native mechanics, custom look.** Sheets (`PFPresenter.present`, backed by SwiftUI `.sheet` + detents) and
  page navigation (`PFNavigator`, backed by `NavigationStack`, system bar hidden) are native SwiftUI so
  dragging, swipe-back and transitions feel like iOS. Everything visible (navigation bar/dock, headers,
  buttons, controls, sheet content) is ProjectFlow's own design.
- **Sheet actions go in `.pfSheetFooter(token) { … }`.** The sheet pins them below its scrolling content and
  above the keyboard; `.fit` sheets grow by the keyboard height. Put every value that changes the footer
  (enabled state, titles, step) into the token, since the footer is only re-read when the token changes.
- **No native controls.** Build UI from `PFDesign` components (`PFButton`, `PFIconButton`, `PFPill`,
  `PFRingCheck`, `PFPrioritySignal`, `PFDayBand`, `PFAvatar(Stack)`, `PFHealthRing`, `PFProgressBar`,
  `PFSegmented`, `PFChip(Row)`, `PFSwitch`, `PFTextField`, `PFDateStrip`, `PFSwipeRow`, `PFCardList`,
  `PFEmptyState`, `PFSkeleton`, `PFToast`, `PFPresenter` sheets + `pfPeek`, `PFNavigator`, `PFTopBar`,
  `PFDock`, `PFFocusBar`). Back buttons are always `PFIconButton("chevron.left", …)` (glass); pills
  (choice/capture chips, small inline actions) and `PFButton(kind: .ghost)` use `.pfPillSurface(selected:)` so they share one look. No `List`, `Form`, `NavigationStack`, `TabView`, `Toggle`, `Picker`,
  `DatePicker`, `Menu`, `.alert`, `.contextMenu`, system navigation bars/`.navigationTitle`; present sheets
  and push pages only through `PFPresenter` / `PFNavigator`. Allowed natives: text input
  (styled plain), `ScrollView`/`LazyVStack`, gestures, shapes, `Canvas`, system integrations.
- **Colours only via `PFColor`** (tokens from `web/styles/_tokens.scss`), text via `.pfText(_:)`.
- **Copy only via `L10n.t`** with keys in the feature's `<Feature>Strings.swift` (DE + EN). Reuse web
  keys/wording where the web has the same text.
- **Same gesture, same meaning**: use `WorkItemRow` / `WorkItemActions` for every task list.
- **Writes** go through `WorkActions` etc. (contract C1: `updatedBy`/`updatedAt`, full paths; side
  effects are server triggers).
- **Tap to edit.** Text shown in a card is edited by tapping the text itself (description, label names, …), never via
  a separate pencil button; offer the same as an accessibility action ("Bearbeiten"). Pencil/"Bearbeiten" buttons are
  only for opening an editor of a whole object (sprint, profile), not for a single field.
- **No inline AI on the phone.** ✦ appears only (1) once per screen in the chrome (top bar / root actions, Duo: side
  rail) for "Frag ProjectFlow", (2) above the keyboard while a field is being edited (format bar / keyboard toolbar,
  hidden while typing, back after 800 ms), and (3) as "✦ KI" in the edit menu of a selection. Never as buttons inside
  cards or next to fields.
- **Accessibility**: every icon-only control has a label; components expose traits/actions; respect
  Dynamic Type (`pfText`) and Reduce Motion (`PFMotion.respecting`).

## Platform signals (admin console)

`Features/Platform`: workspace suspension (`tenants/{id}.suspendedAt` → `SuspendedWorkspaceView`, live via `SessionStore`) and the
announcement banner (`platform_config/announcement` → `AnnouncementStore`, shown in `MainShell` above every tab; dismissed per
version in `pf.announcement.dismissed`). Contract: admin-console iOS note, `brain/reference/app/FIRESTORE_STRUCTURE.md`.

## Plans and personal workspace (billing contract)

`brain/plans/billing-entitlements-contract.md` §5/§7. `PFData/PlanEntitlements.swift` (`PlanEntitlements`, `PlanStore`,
`PlanErrorCode`), bound per workspace in `AppModel` (`model.entitlements`, `model.errorMessage(_:)`). UI in `Features/Billing`
(plan card in Account, "Nur lesen" notice on locked projects); AI controls are greyed out without server AI; invites and
new projects are pre-checked. Onboarding asks "Allein oder im Team?" (team → new team workspace + invite step); the
workspace sidebar lists "Persönlich" above the team workspaces. No purchase UI (App Store 3.1.1).

## In-app AI (✦ KI)

Contract: side-session note `ios-in-app-ai-contract.md` (web `web/components/ai/`). `PFData/AiAssist.swift` streams `aiAssist`
(SSE; write and assist), applies/undoes action cards and reads `getWorkspaceAiPolicy` (`AppModel.showsInAppAi`, no guests).
UI in `Features/AI`: "Frag ProjectFlow" sheet (✦ on Today, task and project top bars; `projectflow://ask?q=` and the
`AskProjectFlowIntent` Siri shortcut), field assist (✦ in the description format bar and the comment keyboard toolbar,
hidden while typing, back after 800 ms) and "✦ KI" rewrites in the edit menu of a selection (replace + undo). Plan refusals
show a hint, not an error. QA without a key: `-pfAiFake`.

## Duo side region

Rail, root actions and side controls are centred on the status column (`PFLayout.sideStatusCenter`, 48 pt from the trailing
edge, under the camera); pages reach up to the rail (`PFLayout.sideContentInset`, applied inside `PFNavigator`) instead of the
whole 84 pt system side region.

## Project detail chrome

No tab bar, no title pill, no ··· menu. iPhone: back left, ✦ + section picker ("Überblick ⌄") right, opening our own glass popover under it (not a sheet or system menu). Duo outer
display: no top bar (`PFTopBar(collapsesOnSide:)`), the sections are circle buttons in the side rail (current inverted,
back lowest). Project settings, copy link and open in web sit at the end of the overview. Horizontal scrollers next to the
Duo rail fade out (`pfSideFade`).

## Workspace sidebar and areas

`Features/Workspace/WorkspaceSidebar.swift` + `Shell/SidebarDrawer.swift`: a left drawer like the ChatGPT app — screen-edge pan
from the left on any root screen (disabled once something is pushed), tapping the date above Today's headline, or the VoiceOver
action "Workspace-Menü öffnen". It holds the areas (`WorkspaceArea.all`), all workspaces (switch, "Neuer Workspace"),
workspace settings and the account (avatar row at the bottom). Today has no top bar of its own any more: on iPhone ✦/+ sit on
the date line, on the Duo in the rail. `Shell/SidebarHint.swift`: one-time coach mark (dimmed, handle + arrow at the left edge,
the sidebar peeks in), later only the peek after 14 days without opening it; QA: `-pfSidebarHint`. iPhone: the content slides
right and dims; iPhone Duo (side inset): the sidebar slides over the dimmed content, because shifted scroll views re-wrap there.


`Features/Workspace`: Activity feed (`tenants/{t}/activity`, workspace and per project; contract
`brain/plans/activity-events-contract.md`), Insights (`insights_daily/latest`, `refreshWorkspaceInsights`, weekly report via
`generateWeeklyInsightsReport`). Routes `.activity`/`.insights`, web links `/activity`, `/insights`, `/project/:id/activity`.
Files (`brain/plans/files-concept.md`): `PFData/FilesData.swift` (`FilesStore` parent/workspace listeners, signed URLs,
upload with `parent`, trash/restore, quota), `Features/Files` (attachments card in task detail and the project "Dateien" tab,
Quick Look preview, camera/photos/Files pickers, overview at `/files`); the share extension attaches shared photos/files to the
task it creates (callables over REST). Wiki (`brain/plans/wiki-concept.md`): `PFData/WikiData.swift` (tree store, chunked body, `bodyRev`-checked save with the
web's derived fields, create, task links), `Features/Wiki` (tree + search, native renderer for the Tiptap JSON, checklists
toggle in place, tap-to-edit as Markdown-light text with locked `⟦n⟧` placeholders for blocks iOS can't edit, @-mentions of
people, task "Docs" card, project tab "Wiki"). Flows (`brain/plans/flows-concept.md`): `PFData/FlowsData.swift` + `Features/Workspace/FlowsScreen.swift`: list with trigger →
actions, status and on/off switch (`setAutomationEnabled`), detail with "Jetzt ausführen" (`runAutomation`, asks for a task
when the actions need one), run log with retry (`retryAutomationRun`). Creating/editing stays web-only (hint on screen). Copy for these areas comes from the web locales (`ActivityWebStrings`, generated). Files, Wiki and Flows join the same row.

## Startup template seed data

`App/Resources/StartupSeeds.json` holds the content of the `startup_company_formation` template (tracks,
jurisdictions, initiatives, tasks, milestones, de/en copy resolved). It is generated from the web config
(`web/config/projectTemplates.ts`) and locales (`web/locales/{en,de}.ts`) — do not edit by hand. After changing
those web sources run `node scripts/export-startup-seeds.mjs` from the repo root, then `cd ios && xcodegen generate`.
Seeding itself: `App/Sources/Features/Projects/StartupSeeding.swift`.
