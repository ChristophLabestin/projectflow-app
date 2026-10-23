# ProjectFlow Desktop (Electron) — Concept

Status: v2 reviewed (2026-10-22, see §13). Surface: new `desktop/` package (a `package.json` scaffold already
exists, no `src/` yet) + small desktop-aware additions in `web/`.

## 1. Goal

A native-feeling macOS/Windows desktop app for ProjectFlow that **renders the hosted web app**
(the Microsoft Teams / Slack / Linear model) instead of bundling a second copy of the UI, and adds
features only a desktop shell can offer:

- custom title bar that hosts the native window controls (macOS traffic lights; Windows caption buttons),
- real macOS menu bar and a Windows app menu,
- the Quick Access panel ("Schnellzugriff", `PinnedTasksModal`) as a **pop-out window that can stay always on top**,
- native notifications + dock/taskbar badge, tray/menu-bar item, one global shortcut, deep links,
- a dev script that starts the app already signed in (§9).

Non-goals (v1): offline-first data, a bundled/offline copy of the UI, Linux polish (native frame, no title bar),
Mac App Store build, auto-update rollout (prepared, see §10), Quick Capture, tray task actions.

## 2. Architecture (thin shell)

```
desktop/                     Electron package (esbuild → dist/, CommonJS; current stable Electron, pinned exactly)
  src/main.ts                lifecycle, single-instance lock, deep links, menus, tray, global shortcut
  src/windows/mainWindow.ts  main BrowserWindow (title bar style per platform, state persistence)
  src/windows/quickAccess.ts Quick Access pop-out window (always-on-top)
  src/menu.ts                one command table → macOS app menu, Windows popup menu, dock menu
  src/tray.ts                tray / menu-bar item
  src/ipc.ts                 IPC handlers; every handler validates the sender (§3)
  src/security.ts            navigation allowlist, window-open handler, permission handlers
  src/store.ts               tiny JSON settings store in userData (bounds, always-on-top, zoom, close behavior)
  src/preload.ts             contextBridge → window.projectflowDesktop (typed, minimal) — BUNDLED to one file
  assets/                    icons, offline.html
web/
  services/desktop.ts        typed access to window.projectflowDesktop + isDesktop()/platform/capabilities
  components/desktop/        DesktopTitleBar, DesktopBridge (commands, badge, tray sync, notifications)
  screens/QuickAccessWindow  route /desktop/quick-access rendered without AppLayout
```

- **Remote content**: packaged builds load `https://app.getprojectflow.com` and **ignore `PF_DESKTOP_URL`**
  (honoured only when `!app.isPackaged`, otherwise an env var could point the privileged shell at any origin).
  Dev loads `PF_DESKTOP_URL`. Every web deploy updates the desktop app instantly; the shell rarely changes.
- **Bridge versioning (shell and web ship independently!)**: the bridge exposes `apiVersion` and
  `capabilities: string[]` (e.g. `'badge'`, `'popout'`, `'tray'`). The web app must feature-detect every
  call — old installed shells will meet new web code. Never remove/rename a bridge method, only add.
- **Feature detection, not forks**: web code checks `isDesktop()`; in a normal browser nothing changes.
  `<html>` gets `is-desktop` + `desktop-mac` / `desktop-win` / `desktop-linux` classes, set by the preload
  before first paint (not in `index.tsx`, to avoid a layout jump).
- **One session**: all windows share the default persistent session (same IndexedDB/localStorage), so the pop-out
  is signed in automatically and sign-out in one window propagates to the other via Firebase Auth's
  cross-tab IndexedDB sync. Pins/focus sync in realtime through `users/{uid}` (PinnedTasksContext, transactional
  writes) — no IPC needed. Firestore has no persistent cache configured, so no multi-tab cache issue.
  Consequence: **localStorage is shared too** — anything keyed in localStorage (compact-mode keys, theme)
  is visible to both windows (see §6, §8).
- **Lifecycle**: closing the main window **hides** it (Windows and macOS) so notifications, badge and tray keep
  working; real quit only via Quit / tray / `⌘Q` (`before-quit` flag). `activate` (mac) / tray click / second
  launch shows it again. Main window `backgroundThrottling: false`. Optional setting "launch at login"
  (`app.setLoginItemSettings`). Pop-out window has no `parent`.
- **Menu/command routing**: renderer announces `desktop:ready`; main queues commands (menu, deep link, notification
  click) until then — cold-start deep links must not be lost.

## 3. Security baseline

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`; preload is the
  only bridge, exposes functions (never `ipcRenderer`), and exposes the bridge **only if `location.origin` is
  the app origin**. Sandboxed preload can `require` only `electron` + a few builtins, so it must be bundled
  to a single CommonJS file (esbuild), type imports only.
- IPC handlers check `event.senderFrame === event.sender.mainFrame` **and** `new URL(senderFrame.url).origin`
  equals the allowed origin by exact comparison (never `startsWith`; dev origin only when `!app.isPackaged`).
- Navigation: handle `will-navigate`, `will-redirect` and `setWindowOpenHandler`. App origin stays in-app;
  everything else `http(s)`/`mailto:` → `shell.openExternal` (URL parsed, scheme allowlist), other schemes denied.
  Popups (`signInWithPopup` → `https://<app host>/__/auth/handler`) are allowed only for the app origin and the
  exact Firebase handler path; the popup keeps `window.opener`. **Child windows inherit the parent's
  webPreferences** — override with no preload and sandbox on.
- Permissions: set both `setPermissionRequestHandler` and `setPermissionCheckHandler`; allow
  `clipboard-sanitized-write`, `fullscreen`; deny the rest (notifications go through main, so the renderer needs none).
- No remote module, no `webviewTag`. Fuses (via `@electron/fuses`, packaged builds): disable `RunAsNode`,
  `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments`; enable
  `OnlyLoadAppFromAsar`, `EnableEmbeddedAsarIntegrityValidation`; `GrantFileProtocolExtraPrivileges: false`.
- Deep-link/notification paths: must start with a single `/`, reject `//`, schemes, `..`; sent to the renderer
  as `navigate(path)` only.

## 4. Custom title bar

Height 40px (`--desktop-titlebar-height`), full width, rendered by the web app (`DesktopTitleBar`,
`position: fixed`, z-index above modal backdrops so the window stays draggable) as a drag region
(`-webkit-app-region: drag`; interactive children `no-drag`). Double-click-to-maximize/zoom is **native** for
drag regions (mac honours the system preference itself) — no JS. Linux: native frame, no bar.

| | macOS | Windows |
| --- | --- | --- |
| BrowserWindow | `titleBarStyle: 'hidden'`, `trafficLightPosition: {x: 14, y: 13}` | `titleBarStyle: 'hidden'` + `titleBarOverlay {height: 40, color, symbolColor}` |
| Window controls | native traffic lights inside our bar (left inset 78px; 0 in fullscreen via `enter/leave-full-screen`) | native caption buttons (Win11 snap layouts) on the right; inset from CSS `env(titlebar-area-x/width)` (Window Controls Overlay), not a hardcoded width |
| App menu | native menu bar (§5) | menu button (logo) at the left → `Menu.popup()` of the same template |
| Theme | traffic lights native | renderer sends bar colors → `setTitleBarOverlay`; main also sets `nativeTheme.themeSource` (light/dark/system) so menus + prefers-color-scheme match |

- **Zoom**: Electron zoom scales the bar but not the native overlay/traffic lights. On zoom change main calls
  `setTitleBarOverlay({height: round(40*factor)})` and `setWindowButtonPosition` (mac).
- **Windows menu**: `Menu.popup({window, x, y})` takes DIP coordinates of the **un-zoomed** window — multiply the
  renderer's `getBoundingClientRect()` by the zoom factor. Also open on `Alt` keyup and `F10`
  (`before-input-event`; the real menu bar is hidden with `titleBarStyle: 'hidden'`). Keep the application menu
  set so accelerators work; verify that on Windows with the hidden bar early (Phase 1 spike).
- **Layout** (the important part): `AppLayout` root is `h-screen` and 29 files use `h-screen/100vh`. Do not rely
  on `100vh`: introduce `--app-viewport-height` (`100vh`, or `calc(100vh - var(--desktop-titlebar-height))` under
  `.is-desktop`) and use it in the *page shells* only (AppLayout, Login/auth screens, ErrorPage); modal max-heights
  stay. Two modes: **inline** (authenticated shell: content starts below the bar) and **overlay** (public/login
  routes: transparent 40px drag strip over the page, no layout shift). Fixed elements at the top right
  (`LanguageSwitcher` `top-4 right-4`, `GlobalToast`, TopBar profile) must respect
  `env(titlebar-area-width)` on Windows so they never sit under the caption buttons.
- Existing `TopBar` (breadcrumb pill, search pill, tools) stays untouched; the title bar is chrome only.
  Moving global search into the title bar (Teams style) is a later option, not v1.

Bar contents (left → right): [mac inset | win menu button] · back / forward (`webContents.navigationHistory`,
not the deprecated `goBack`) · centered document title · Quick Access pop-out button · [win overlay inset].
Window reports fullscreen/maximize/focus changes so the bar can adjust insets and dim when inactive.

## 5. Menus (one command table)

All items map to a `DesktopCommand` id; main handles it natively (window/zoom/reload) or forwards it to the
renderer (`desktop:command`), where `DesktopBridge` routes it (navigate via router, open modals, search, help).
Menu accelerators swallow keys before the page, so the menu is the single handler in the desktop app
(e.g. `⌘K` opens search through the command, not the page listener).

- **Labels / i18n**: no second string table. The renderer pushes the menu label map (from `en.ts`/`de.ts`) on startup
  and on language change; before that main uses English/`app.getLocale()`.
- **ProjectFlow** (macOS only): About, Settings… `⌘,`, Services, Hide, Hide Others, Quit.
  On Windows the same entries live in File/Help (Settings, Exit, About) — `role: 'appMenu'` is mac-only.
- **File**: New Task `⌘N`, New Project `⇧⌘N`, Close Window `⌘W` (hides), Exit (Windows).
- **Edit**: standard roles (undo/redo/cut/copy/paste/paste-and-match/select-all, spelling).
- **View**: Reload `⌘R`, Back `⌘[`, Forward `⌘]`, Actual Size / Zoom In / Zoom Out (persisted), Toggle Full Screen, Developer Tools (dev only).
- **Go**: Dashboard `⌘1`, Projects `⌘2`, Tasks `⌘3`, Calendar `⌘4`, Notifications `⌘5`, Search `⌘K`.
- **Window**: Minimize, Zoom, Quick Access pop-out `⇧⌘P`, Keep Quick Access on Top (checkbox), Bring All to Front.
- **Help**: Help Center, Keyboard Shortcuts, Website.

Windows uses `CmdOrCtrl`. macOS dock menu: New Task, Quick Access. (Windows jump list cut from v1.)
Electron has **no default context menu**: implement it in main (`context-menu` event): spelling suggestions
(`session.setSpellCheckerLanguages`), cut/copy/paste, "Copy link" (copies the https URL), "Open link in browser".

## 6. Quick Access pop-out (always on top)

**Reuse is realistic but needs three guards.** `PinnedTasksModal` (~1500 lines) already has a compact
floating mode (line ~1044: header, body, own drag/resize state). Add `variant?: 'overlay' | 'window'`; `window`
forces the compact layout filling the viewport (`position: fixed; inset: 0`, no drag/resize handlers, no expand
button, header = OS drag region, buttons `no-drag`) and:
1. **never reads/writes the `pinned_tasks_compact_*` localStorage keys** (shared with the main window — it would
   overwrite its mode/position/size);
2. replaces `navigate(path)` / `toggleModal()` in the row actions with `desktop.openInMain(path)` (pop-out has no
   own navigation) and shows dock-back/close instead of expand/close;
3. is not mounted twice: `RootLayout` currently always renders `<PinnedTasksModal />`; on
   `/desktop/quick-access` it must skip it (and `HelpCenterDrawer`, floating help button, `OfflineBanner`).
   The `⌘⇧F` toggle listener in `PinnedTasksContext` and other global shortcuts stay inactive in the pop-out.

- Route `/desktop/quick-access`: auth-required, outside `AppLayout`, own mini title strip (drag + close/dock).
  Unauthenticated (e.g. signed out in main) → "Sign in in the main window" message, no login screen in the pop-out;
  signing out closes it.
- Window: frameless-ish (macOS `titleBarStyle: 'hidden'` + `setWindowButtonVisibility(false)`; Windows `frame: false`),
  min 300×360, default 360×560, resizable, remembers bounds (validated against connected displays),
  Windows `skipTaskbar: true` (tray + shortcut reopen it).
- **Always on top** (default on, toggle in header + Window menu, persisted) — platform differences:
  - **Windows**: `setAlwaysOnTop(true)`; levels are ignored there (everything is `HWND_TOPMOST`). Floats over
    normal and borderless-fullscreen windows, not over exclusive-fullscreen games.
  - **macOS**: `setAlwaysOnTop(true, 'floating')` is enough over normal windows. Over **full-screen apps / all
    Spaces** it additionally needs `setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true})`, which
    transforms the process type and can **hide the dock icon / flash**; call it once at window creation
    (`skipTransformProcessType` only if the window is already a UIElement) and restore with `app.dock.show()`.
    Evaluate `type: 'panel'` (NSPanel) as the cleaner way to float over full-screen apps without activating
    the main window — **Phase 2 spike, both variants, on a full-screen app**; fall back to "floats over normal
    windows only" if neither is clean.
- Entry points: pop-out button in the Quick Access header (desktop only) and title bar, Window menu, tray, dock menu,
  one **global shortcut** toggling the pop-out (mac `⌥⌘P`; Windows must avoid bare `Ctrl+Alt+…` because it is
  AltGr on German/EU layouts → default `Ctrl+Shift+Alt+P`). Global shortcuts steal keys from other apps:
  register with failure handling (`register()` returns false), user-changeable/disableable in settings,
  `unregisterAll` on quit.
- When it pops out, the in-app modal closes (main window state); "dock back" closes the window and reopens the modal.
- Theme: `ThemeContext` reads localStorage once and has no `storage` listener, so a theme change in the main
  window would not reach the pop-out → add a `storage` listener (also fixes multi-tab in the browser).

## 7. More desktop features

1. **Native notifications + badge** — FCM web push does not work in Electron (`registerWebPushToken` must be
   skipped when `isDesktop()`).
   - **Only the main window's `DesktopBridge` runs notifications, badge and tray sync — the pop-out never
     mounts it** (otherwise every notification fires twice).
   - Subscribe via `subscribeToNotifications`. The **first snapshot is the baseline** (no toasts for existing unread);
     afterwards toast only new unread ids not yet shown (persist the last notified ids in localStorage so reloads
     don't re-toast) and suppress while the main window is focused. Note the subscription is for the **active tenant
     only** — notifications of other tenants are not shown/badged in v1 (document in GOTCHAS).
   - Shown by main via `Notification` (click → show main window + `navigate(path)`). Windows requires
     `app.setAppUserModelId(appId)`, and in dev toasts are labelled "Electron".
   - Users who also have a browser web-push token will get a toast in both places — accepted for v1.
   - Badge: `app.setBadgeCount` (macOS dock). **Windows has no badge count**: renderer draws a 16×16 canvas
     (`9+` cap) → data URL → main `NativeImage.createFromDataURL` → `win.setOverlayIcon`.
2. **Tray / menu-bar item**: macOS template image (`…Template.png`) + `tray.setTitle(focus title)`;
   Windows icon + tooltip. Menu: focus task (read-only label), up to 5 pinned items (click → open in main),
   Quick Access, Open ProjectFlow, Quit. Renderer pushes `{focus, pins}` snapshots from PinnedTasksContext.
   (Complete/Snooze from the tray cut from v1.)
3. **Deep links** `projectflow://<path>` — the same scheme the iOS app already parses (`AppRouter.swift`,
   contract C8); reuse that path grammar. macOS delivers via `open-url`, Windows/Linux via `second-instance`
   argv (+ initial argv); `requestSingleInstanceLock()`; path validated (§3). **Protocol registration**: on macOS
   it only really works in a packaged build (Info.plist) — test deep links with `dist:mac --dir`, not `electron .`;
   on Windows dev registration needs `setAsDefaultProtocolClient(scheme, process.execPath, [path.resolve(argv[1])])`.
   Plain `https://app.getprojectflow.com/...` links from browsers/mail still open the browser (no universal links).
4. **Window state**: bounds, maximized, zoom persisted in `userData/settings.json`; restore only if on a connected
   display. Create window `show: false`, show on `ready-to-show`, `backgroundColor` from the last theme (no white flash).
5. **Context menu**: see §5.
6. **Offline / load failure**: `did-fail-load` on the main frame (ignore `ERR_ABORTED` -3) and `render-process-gone`
   → local `offline.html` (app URL passed as query param; its own `online` listener navigates back to it;
   `will-navigate` from `file://` to the app origin allowed). Offline mode only covers *initial load*; once loaded,
   Firebase handles transient offline as in the browser.
7. **External links** always open in the default browser. Downloads use Electron's default save dialog (`will-download`).

## 8. Web changes

- `web/services/desktop.ts`: `getDesktopBridge()`, `isDesktop()`, `desktopPlatform()`, `hasCapability()`, bridge types.
- `AppLayout`: render `DesktopTitleBar` (inline mode); `--app-viewport-height` replaces `h-screen` in page shells (§4).
  `RootLayout`: mounts `DesktopTitleBar` for public routes (overlay mode) so the login window stays draggable/closable.
- `PinnedTasksModal`: `variant`, guards from §6, desktop-only pop-out button. `RootLayout`: skip global overlays on
  the pop-out route.
- `DesktopBridge` (mounted once in the **main window's** `RootLayout`, not in the pop-out route): command routing
  (`useNavigate`, UI modals), badge, notifications, tray snapshot, theme → overlay colors, menu labels.
- `ThemeContext`: `storage` listener. Login: see Auth below.
- Router: `/desktop/quick-access` (auth-required, outside `AppLayout`, inside `RootLayout`).
- All new copy in `en.ts`/`de.ts`; styles in SCSS with tokens (`web/styles/` partial `_desktop.scss`).
- After implementation update Brain: SITEMAP (route), COMPONENTS, GOTCHAS (single tenant notifications,
  shared localStorage, AltGr shortcuts), `commands-and-environment.md` (desktop commands).

### Auth in Electron

- **Hosted/prod**: `resolveAuthDomain()` in `web/services/firebase.ts` already uses the page host for
  `app.getprojectflow.com` (`SAME_ORIGIN_AUTH_HOSTS`), so the popup handler is same-origin and
  `signInWithPopup` can work in a child window (see §3 for opener/preload). The OAuth redirect URI for that
  host is already registered.
- **Dev/emulator**: no OAuth (emulator + auto-login), `authDomain` irrelevant.
- **Google blocks embedded browsers** (`disallowed_useragent`, Electron is detected). Do not spoof the user agent.
  Plan: email/password and TOTP MFA work in-app; **OAuth buttons (Google/GitHub/Apple/Microsoft) hand off to the
  system browser**: `Login` calls `desktop.signInExternally(provider)` → opens
  `https://app.getprojectflow.com/login?desktop=1&provider=…` in the browser → after sign-in the page calls a new
  callable that returns a short-lived one-time code → `projectflow://auth?code=…` → renderer exchanges the code
  for a custom token → `signInWithCustomToken` (Login already uses this for passkeys; `functions/src/passkeys.ts`
  already mints custom tokens). Needs one new Cloud Function pair. Phase 1b; until then OAuth buttons are hidden
  in the desktop app.
- **Passkeys**: macOS Electron has no usable platform authenticator (Touch ID/iCloud Keychain) → hide the passkey
  button and the **auto passkey prompt on mount** in `Login` when `isDesktop() && mac` (a `NotSupportedError`
  would otherwise surface as a login error). Windows Hello: verify in a spike.

## 9. Dev workflow (signed in)

`scripts/dev-desktop.sh` (npm: `npm --prefix desktop run dev:e2e`, already wired in `desktop/package.json`):
1. Picks a free `PORT` (default 3000 — `dev-e2e.sh` uses `--strictPort` and fails when another worktree's
   dev server holds it). Emulator ports (9631/8631/9632/5631) are fixed defaults: if a `dev-e2e.sh` is
   already running, fail with a clear message or pass different `*_PORT` env.
2. Starts `scripts/dev-e2e.sh` **in the background in its own process group**: the script ends with a foreground Vite
   and its trap only kills the emulator, so `dev-desktop.sh` must kill the whole group on exit or Java/Vite
   processes stay behind. Passes through `E2E_LOGIN`, `E2E_FUNCTIONS`, `PORT`.
3. Waits for `http://localhost:$PORT` (emulators + seed + Vite are sequential, can take a minute), builds the shell,
   launches Electron with `PF_DESKTOP_URL=http://localhost:$PORT` and `--remote-debugging-port` (so Playwright/
   browser tools can attach for visual checks).
4. **Fresh profile per run** (`userData` = temp dir; `DESKTOP_KEEP_PROFILE=1` to reuse): the Auth emulator is wiped
   on every start, but a persisted IndexedDB would still hold the old user, so `auth.currentUser` is set,
   the auto-login in `services/firebase.ts` (`if (auth.currentUser) return`) is skipped, and tokens fail.
5. Auto-login only runs in the Vite page (`import.meta.env.DEV` + `VITE_E2E_AUTO_LOGIN_*`) — fine, because dev
   Electron loads that page; it does not exist for `desktop start` against prod. The pop-out window needs no
   login of its own (shared session; both windows may race `signInWithEmailAndPassword` once — harmless).
`DESKTOP_REUSE=1` skips step 2 (attach to a running `web-e2e`). `npm --prefix desktop run dev` = already running
dev server; `npm --prefix desktop start` = prod URL. Dev origin is `localhost` (Vite also listens on 0.0.0.0);
emulators use `127.0.0.1` — keep it as is, only the page origin goes into the shell allowlist.
Protocol/deep-link and notification toasts cannot be fully verified in dev (§7); use a packaged `--dir` build.

## 10. Packaging & release (prepared, not rolled out)

- `electron-builder`: appId `de.christophlabestin.projectflow.desktop`, productName `ProjectFlow`,
  macOS `dmg` + `zip` (universal), Windows `nsis` (x64/arm64), `protocols: projectflow`; fuses via an
  `afterPack` hook.
- macOS needs Developer ID signing + notarization (hardened runtime); Windows needs a code-signing cert (Azure Trusted Signing).
- Auto-update via `electron-updater` (GitHub Releases or a static Firebase Hosting feed) — later phase; the
  bridge `apiVersion`/capabilities (§2) are what keep old shells working meanwhile.

## 11. Phases

1. Shell: main window (hide-on-close), security, title bar (mac/win) + layout vars, menus, context menu, state
   persistence, offline page, dev script. Spikes: Windows accelerators with hidden menu bar; Windows `titleBarOverlay`
   + WCO insets; OAuth popup behaviour. **1b**: system-browser OAuth handoff (needs Functions).
2. Quick Access pop-out + always-on-top (mac full-screen spike) + one global shortcut.
3. Notifications + badge + tray + deep links + dock menu.
4. Packaging, signing, auto-update (needs owner credentials).

## 12. Risks / open questions

- Passkeys: see §8 (macOS unsupported, Windows to verify).
- Google OAuth in embedded browsers: system-browser handoff (§8) is the plan, not a fallback.
- macOS over-full-screen floating can hide the dock icon (§6) — spike decides the approach.
- Windows menu accelerators with `titleBarStyle: 'hidden'` — verify early; fallback: forward `before-input-event`.
- Title bar vs fixed/`100vh` layouts: 29 files reference viewport units; only page shells change, but needs a
  visual pass of login, onboarding, error pages and drawers.
- Hosted web code evolves faster than installed shells → capability checks (§2) are mandatory.

## 13. Review changes (v2)

- **Fixed**: Windows has no `setBadgeCount` (overlay icon via renderer canvas → main); `setAlwaysOnTop` levels are
  mac-only (`'pop-up-menu'` removed); `setVisibleOnAllWorkspaces` dock-hiding side effect + `type: 'panel'` spike;
  double-click maximize is native (no `systemPreferences` code); `navigationHistory` instead of `goBack`;
  `Menu.popup` zoom coordinate scaling; titleBarOverlay/trafficLight don't follow zoom; sandboxed preload must be
  a single bundled CJS file; child windows inherit preload/webPreferences; exact-origin IPC checks incl. `mainFrame`;
  `PF_DESKTOP_URL` ignored in packaged builds; `role: 'appMenu'` mac-only; Windows menu needs Alt/F10 handling;
  no default context menu in Electron; protocol registration only works packaged on macOS, `open-url` vs
  `second-instance`; Windows toasts need AppUserModelID.
- **Added**: bridge `apiVersion`/capabilities; hide-on-close lifecycle (else no notifications/tray); `desktop:ready`
  command queue; Auth section (Google blocks Electron → system-browser handoff with one-time code + custom token,
  passkeys unsupported on macOS, `authDomain` analysis); layout plan for title bar vs `h-screen` (inline/overlay
  modes, `--app-viewport-height`, WCO env insets); pop-out guards (shared `pinned_tasks_compact_*` localStorage
  keys, double-mounted modal in `RootLayout`, no `navigate` in the pop-out, signed-out state); notification
  de-duplication (bridge only in main window, baseline snapshot, active-tenant limitation); theme `storage`
  listener + `nativeTheme.themeSource`; menu labels from web locales; AltGr-safe global shortcut; dev-script
  pitfalls (process group, free port, stale IndexedDB vs wiped Auth emulator → fresh profile, remote debugging port);
  extra fuses; flash-free window show.
- **Cut / deferred**: Quick Capture + `⌥⌘N`, Complete/Snooze in tray, Windows jump list, title-bar search,
  JS double-click handling, multi-shortcut set (now one, configurable).

## 14. Implementation status (2026-10-22)

Implemented (Phases 1–3 except where noted), verified on macOS with `scripts/dev-desktop.sh`:

- Shell: `desktop/src/` (`main.ts`, `windows/mainWindow.ts`, `windows/quickAccess.ts`, `menu.ts`, `tray.ts`, `ipc.ts`,
  `security.ts`, `store.ts`, `labels.ts`, `contract.ts`, `preload.ts`), esbuild bundle, `assets/offline.html`, tray icons,
  electron-builder config + fuses (`scripts/after-pack.cjs`); unsigned `pack` build checked (fuses, `projectflow` scheme).
- Web: `services/desktop.ts`, `components/desktop/DesktopTitleBar.tsx` + `DesktopBridge.tsx`, `screens/QuickAccessWindow.tsx`,
  `_desktop.scss`, `PinnedTasksModal variant="window"` (compact layout + item switcher, always-on-top/dock/close, pop-out
  button in both modal headers), `ThemeContext` storage listener, Login/Dashboard passkey + OAuth hidden on desktop,
  `registerWebPushToken` skipped, GlobalSearch opens on the `projectflow:open-search` event.
- Verified: signed-in start, title bar with traffic lights, native menu bar, pop-out with live pin sync, "open detail"
  navigates the main window, always-on-top toggle, web build, typecheck, unit tests.

Deviations from v2:
- Native strings (menus, tray, context menu, offline page) live in `desktop/src/labels.ts` (en/de); the web app only
  pushes the user's language (`setLanguage`) instead of a full label map — avoids ~50 duplicate locale keys.
- macOS always-on-top uses `floating` + `setVisibleOnAllWorkspaces(…, {visibleOnFullScreen, skipTransformProcessType})`;
  the `type: 'panel'` spike over full-screen apps is still open.
- The pop-out keeps the compact single-item layout with a header item switcher (no list sidebar).

Open / not verified:
- Windows build on real hardware (title bar overlay colors, Alt/F10 menu, accelerators with hidden menu bar, overlay badge, AUMID toasts).
- Phase 1b system-browser OAuth handoff (one-time code callable + `projectflow://auth`), Windows Hello passkeys.
- Deep links and notification toasts only work fully in a packaged build (macOS); signing/notarization and auto-update (Phase 4).

## 15. Desktop features round 2 (2026-10-23)

Built on owner request ("strong additions" + Quick Capture + small extras). Shell code in `desktop/src/features/`
(`notifications`, `calendar`, `focus`, `dayFlow`, `files`, `preferences`) and `desktop/src/windows/auxWindows.ts`;
web side in `screens/QuickCaptureWindow.tsx`, `screens/DesktopDayWindow.tsx`, `components/settings/DesktopSettingsPanel.tsx`,
`services/desktopActions.ts`, `utils/quickCapture.ts`. Bridge capabilities: `preferences`, `quick-capture`,
`notification-actions`, `day-flow`, `file-drop`, `calendar`, `recents`, `windows` (optional methods, feature-detected).

- **Quick Capture** (`⌃⌘N` / `Ctrl+Shift+Alt+N`, tray, Dock, File menu, Touch Bar): non-activating panel (macOS
  `type: 'panel'`) on the display under the cursor, hides on blur. Parser: `#project` (fuzzy picker), `!`/`!!`/`!!!`
  or `!hoch|!high…`, `heute|morgen|übermorgen`; no project → personal task; optional pin; `⌘↩` opens it in the main
  window; clipboard text offered as a chip (read by main only when the panel opens).
- **Interactive notifications** (macOS): Complete, "Remind me in 1 h" (main re-shows after 1 h) and inline Reply
  (comment on the task); handled in the background by `DesktopBridge` (`notification-action`). Windows: plain toasts.
- **Day start / day close**: first unlock/wake/launch between 5–12 h opens `/desktop/day?mode=start` once a day
  (Dashboard plan logic `utils/dayPlan`, start focus from the list). At the configured time — only when the user is
  active (`powerMonitor` idle < 10 min) — a notification offers `/desktop/day?mode=close` (complete, move to tomorrow,
  end focus). Launch at login (packaged builds only).
- **File drop**: files on the Dock icon (`open-file`, `CFBundleDocumentTypes` public.item, rank None) or the Windows
  shortcut/"Open with" (argv) attach to the current focus task; files dropped on the Quick Access pop-out attach to the
  shown item. Upload via `uploadTenantFile` + one comment with the links (project tasks/initiatives only, ≤5 files, ≤25 MB).
- **Calendar & meetings** (macOS, opt-in): bundled EventKit helper `desktop/native/calendar-events.swift`
  (`dist/native/pf-calendar`, `extraResources` when packaged, `NSCalendars*UsageDescription`). Polls every 2 min;
  N min before a meeting → "pause focus?" (snooze for the meeting length); after it → "capture notes?" (opens Quick
  Capture prefilled). Windows: unsupported (no local calendar API) — hidden in settings.
- **Recents**: projects opened in `AppLayout` → File › Recent, Dock menu, Windows jump list (deep links
  `projectflow://…`, `/desktop/command/new-task|quick-capture`).
- **Multiple windows**: File › New Window (`⌘⌥N`), context menu "Open in New Window", `window.open`/⌘-click on app links;
  `secondary` windows have the title bar but no bridge duties; restored on launch.
- **Focus-mode coupling** (macOS): user-named Shortcuts run on focus start/stop (`shortcuts run`), e.g. to toggle
  Do Not Disturb — macOS has no API to set Focus modes directly. **Touch Bar**: Quick Capture, Quick Access, focus
  title, Pause/Resume, Done. **Media key** Play/Pause toggles the focus (opt-in).
- **Settings → Desktop app** (`SettingsModal` tab, menu `⌘,`): all of the above per device (stored by the shell).

Not possible / open:
- Spotlight / Windows Search indexing of tasks needs CoreSpotlight/Windows Search integration from a signed native
  module — replaced by recents (Dock menu, jump list) and Quick Capture; revisit with signing (Phase 4).
- Uploads do not work against the local emulator (callable cannot sign URLs without a service account), so file drop
  is verified up to the upload call only.
- The calendar helper is built for the host architecture; a universal macOS build needs a `lipo`-merged helper.
- Notification actions need the user to allow notifications for the (dev) bundle once.
