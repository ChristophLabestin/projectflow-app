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
  (launch argument `-pfAutoLogin`). QA: `-pfLoginEmail <e> -pfLoginPassword <p>` signs in with another emulator account, `-pfSignedOut` starts on the
  sign-in screen, `-pfHoldLaunch` keeps the cold-start scene on screen, `-pfShowOnboarding` (DEBUG) forces the first-sign-in welcome onboarding (name + optional photo → about → team → how → notifications) for the signed-in user.
- `Debug`/`Release` use `App/Resources/Firebase/GoogleService-Info.plist` (project `projectflow-labestin`).

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
  (choice/capture chips, small inline actions) use `.pfPillSurface(selected:)` so both share one look. No `List`, `Form`, `NavigationStack`, `TabView`, `Toggle`, `Picker`,
  `DatePicker`, `Menu`, `.alert`, `.contextMenu`, system navigation bars/`.navigationTitle`; present sheets
  and push pages only through `PFPresenter` / `PFNavigator`. Allowed natives: text input
  (styled plain), `ScrollView`/`LazyVStack`, gestures, shapes, `Canvas`, system integrations.
- **Colours only via `PFColor`** (tokens from `web/styles/_tokens.scss`), text via `.pfText(_:)`.
- **Copy only via `L10n.t`** with keys in the feature's `<Feature>Strings.swift` (DE + EN). Reuse web
  keys/wording where the web has the same text.
- **Same gesture, same meaning**: use `WorkItemRow` / `WorkItemActions` for every task list.
- **Writes** go through `WorkActions` etc. (contract C1: `updatedBy`/`updatedAt`, full paths; side
  effects are server triggers).
- **Accessibility**: every icon-only control has a label; components expose traits/actions; respect
  Dynamic Type (`pfText`) and Reduce Motion (`PFMotion.respecting`).

## Startup template seed data

`App/Resources/StartupSeeds.json` holds the content of the `startup_company_formation` template (tracks,
jurisdictions, initiatives, tasks, milestones, de/en copy resolved). It is generated from the web config
(`web/config/projectTemplates.ts`) and locales (`web/locales/{en,de}.ts`) — do not edit by hand. After changing
those web sources run `node scripts/export-startup-seeds.mjs` from the repo root, then `cd ios && xcodegen generate`.
Seeding itself: `App/Sources/Features/Projects/StartupSeeding.swift`.
