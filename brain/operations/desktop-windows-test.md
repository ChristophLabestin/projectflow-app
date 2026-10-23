# Desktop — Windows test checklist

Automated: `.github/workflows/desktop-smoke.yml` (Windows + macOS runner) packages the shell unsigned,
starts it and checks over CDP that the main window loads `app.getprojectflow.com`. Everything below needs a
real Windows 11 machine or VM (ARM VM on the Mac works for arm64: UTM/Parallels + `ProjectFlow-Setup.exe`).

Install & update
- [ ] `ProjectFlow-Setup.exe` from `/download` installs per user; SmartScreen text matches the signing state.
- [ ] Start menu entry + AUMID: toasts show "ProjectFlow" (not "electron.app…").
- [ ] Update: install the previous version, start → "update available" → restart installs the new one.

Window & menus
- [ ] Title bar overlay colors follow light/dark theme; minimize/maximize/close work; snap layouts on hover.
- [ ] Alt / F10 opens the app menu; menu accelerators work with the hidden menu bar.
- [ ] `Ctrl+Shift+Alt+N` Quick Capture, Quick Access shortcut; no conflict with AltGr on a German layout.

Tray & notifications
- [ ] Tray icon (light/dark taskbar), left click opens the panel above the taskbar, clamped to the work area.
- [ ] Taskbar overlay badge with the unread count.
- [ ] Toast for a new notification while the app is in the background; click opens the item.
- [ ] Notification toggles in Settings → Notifications (push off for a category) suppress the toast.

Deep links & sign-in
- [ ] `projectflow://project/<id>` from the browser opens the app on the project (second instance).
- [ ] "Sign in with the browser": default browser opens `/desktop/auth`, Google sign-in, "Open ProjectFlow?" →
      the app signs in (the code is only accepted from the running app that started it).
- [ ] Jump list: recent projects, New Task, Quick Capture.
- [ ] "Open with ProjectFlow" / file on the shortcut attaches to the focus task.

Record results (date, build, Windows version, arch) in `brain/plans/desktop-electron-concept.md` §14.
