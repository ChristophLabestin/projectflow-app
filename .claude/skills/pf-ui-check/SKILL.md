---
name: pf-ui-check
description: Günstiger Pfad für die UI-Prüfung in ProjectFlow (Web-Preview und iOS-Simulator) – Text statt Screenshots, ein Bild am Ende.
---

# ProjectFlow UI-Prüfung (token-sparsam)

UI-Prüfungen waren der größte Bildposten: 803 Bilder in 45 Tagen (25 % des Tool-Outputs).
Die Prüfung bleibt Pflicht — nur der Weg ist billiger.

## Web

1. Ziel aus dem Code ableiten, bevor der Browser aufgeht: Route in `web/Router.tsx`
   (`rg -n 'path="/…' web/Router.tsx`), Buttons/Labels über die Locale-Keys in
   `web/locales/en.ts` bzw. `de.ts`, Klassen aus der `.tsx`.
2. `preview_start {name: "web"}` (Firebase-Emulator-Daten: `web-emulator`). Logs nur mit
   `preview_logs {level: "error"}`.
3. Navigation, Klicks und Eingaben in **einem** `browser_batch`; `find`/`read_page {filter: "interactive"}`
   für Refs statt Screenshot-Koordinaten.
4. Zustand mit `get_page_text`, `find` oder `javascript_tool` (berechnete Styles) prüfen.
   Console/Network nur mit `pattern`/`onlyErrors`/`limit`.
5. Genau ein Screenshot als Nachweis, `scale: 0.5`. Weitere nur bei Layout-/Farbfragen, die Text nicht beantwortet.

## iOS (`ios/`)

1. Jede Session bekommt einen eigenen Klon: `UDID=$(scripts/sim-session.sh create <session>)`.
   Der Klon ist ein APFS-Klon von "ProjectFlow Golden" und belegt anfangs ~0 MB. Höchstens 3 Klone
   laufen gleichzeitig, `create` wartet sonst. Für Install, Launch und Simulator-Tools immer diese
   UDID verwenden (`device: <UDID>`). Am Ende ausnahmslos `scripts/sim-session.sh delete <session>`.
2. Build: `(cd ios && xcodegen generate -q)` und `xcodebuild -project ios/ProjectFlow.xcodeproj -scheme ProjectFlow -destination 'generic/platform=iOS Simulator' -derivedDataPath .xcodebuild -quiet build 2>&1 | grep -E 'error:' | head -n 20`.
3. `launch` mit `.xcodebuild/Build/Products/Debug-iphonesimulator/ProjectFlow.app`
   (Bundle `de.christophlabestin.projectflow`); Deep Links per `open_url` statt Durchklicken.
4. Tap-Ziele aus dem SwiftUI-Layout ableiten; mehrere Taps/Eingaben am Stück, dann **ein**
   Screenshot pro geprüftem Zustand — nicht nach jedem Tap.
5. Nie `xcrun simctl io … screenshot` + Read (Bild-Reads sind gesperrt).
