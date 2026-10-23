# ProjectFlow iOS auf dem iPhone Duo

Stand 2026-10-23 (Verkaufsstart des Geräts). Gilt für die native App in `ios/`; Konventionen aus
`ios/README.md` (eigene Optik, native Sheets/Navigation) bleiben unverändert.

## 1. Was das iPhone Duo ist (Recherche)

### Belegt (Apple)
Quellen: Tech Talks „Prepare your app for iPhone Duo“ (developer.apple.com/videos/play/tech-talks/111461),
„Design for iPhone Duo“ (…/111466), „Strike a pose with adaptive layouts on iPhone Duo“ (…/111463),
Hub developer.apple.com/iphone-duo, iOS-27.1-SDK-Header (`SwiftUICore.swiftinterface`).

- Erstes faltbares iPhone, vorgestellt 9. 9. 2026, Verkauf ab 23. 10. 2026, iOS 27.1, Xcode 27.1.
- Zwei Displays: **außen** (zugeklappt, Hochformat) und **innen** (aufgeklappt, „Passport“-Form,
  aufgeklappt breiter als hoch). Posen: zu, offen flach, halb gefaltet wie ein Buch, aufgestellt wie
  ein Laptop, stehend.
- **Size Classes**: außen hochkant compact/regular, außen quer compact/compact, **innen regular/regular**.
  Apple: Layout an Size Classes festmachen, nicht an Pose, Ausrichtung, Idiom oder festen Breiten.
- Innen werden die unterstützten Ausrichtungen **nicht** beachtet (`UIDevice.orientation`/
  `supportedInterfaceOrientations` taugen nicht als Layout-Signal). Auf- und Zuklappen ist ein
  Größenwechsel über die Size-Class-Grenze, kein Neustart der Szene.
- Steuerelemente wandern an die Seite („side region“): Tab-Bar, Toolbars, Zurück-Button, Statusleiste und
  Dynamic Island liegen außen rechts vertikal; innen ebenfalls seitlich, nur innen hochkant bleiben
  horizontale Leisten. Sheets innen zentriert mit horizontalen Leisten. Safe Areas sind **asymmetrisch**
  (linke ≠ rechte Insets).
- Innen: „kein gestrecktes iPhone-Layout“ — Split-Views, Zweispalter, Tab-Bar optional als Sidebar
  (`defaultTabBarPlacement(.sidebar)` bei System-`TabView`).
- **Faltbereich**: Reserved Regions `.division` (Scharnier, aktiv nur halb gefaltet, flach Breite 0) und
  `.occlusion` (Innenkamera, aktiv nur bei laufender Kamera). API ab iOS 27.1:
  `GeometryProxy.reservedRegions(kind:options:)` → `[ReservedRegion]` mit `frame`, `margins`, `isActive`
  (im SDK geprüft). Interaktive Elemente aus dem Knick heraushalten; Scroll-Inhalte müssen nicht ausweichen;
  Zweispalter teilen 50/50 am Knick (Beispiel Erinnerungen).
- `ArrangementView` (iOS 27.1, `.split`/`.overlay`) für Haupt-/Nebeninhalt; nicht mit Navigation-Containern
  kombinieren. Hinge-Status-API ist für Effekte gedacht, ausdrücklich nicht fürs Layout.
- Split View mit anderen Apps und mehrere Fenster derselben App gibt es nur innen; jede Hälfte ist dann
  wieder compact.
- Simulator „iPhone Duo“ (`com.apple.CoreSimulator.SimDeviceType.iPhone-Duo`, iOS 27.1) ist installiert.

### Sekundärquellen (nicht von Apple bestätigt)
5,4" außen (1398 × 2034 px), 7,6" innen (1878 × 2670 px), gleiche Seitenverhältnisse (MacRumors,
dev.to/arshtechpro). Punktgrößen nennt Apple nicht — sie werden im Simulator gemessen (Abschnitt 5).

### Unklar
- Ob der Simulator das halbe Falten (aktive `.division`-Region) per Skript auslösen kann.
- Wie sich die eigene (nicht-System-)Dock-Leiste mit der seitlichen Systemregion außen verträgt — wir
  verlassen uns auf die Safe Area; das Systemverhalten gilt nur für System-Bars.

## 2. Leitentscheidung

Ein Signal: **`horizontalSizeClass == .regular`** = „breit“ (innen offen). Außen, im Split View und auf
jedem normalen iPhone bleibt alles exakt wie heute (die App ist Portrait-only; normale iPhones liefern dort
immer compact). Keine Pose-Sonderlayouts, keine festen Breakpoints auf Gerätegrößen; Spaltenbreiten
werden aus der vorhandenen Breite (und, falls vorhanden, dem Knick) berechnet.

Optik bleibt eigen: kein System-`TabView`/`NavigationSplitView`, keine Liquid-Glass-Systemleisten. Die
Mechanik bleibt nativ: jede Spalte mit Navigation ist weiterhin ein `PFNavigator` (= `NavigationStack`),
Sheets weiterhin `PFPresenter`.

## 3. Konzept je Bereich

| Bereich | Breit (innen) | Begründung |
|---|---|---|
| **Dock zugeklappt (außen)** | Wandert als vertikale Leiste **in die Seitenregion** rechts (unter Statusleiste/Dynamic Island, unten ausgerichtet) und bleibt auch auf Detailseiten sichtbar, weil sie dort keinen Inhaltsplatz kostet. Signal: compact width + Safe-Area-Inset trailing ≥ 60 pt (normale iPhones: 0). | Apple: außen wandern Tab-Bar und Steuerung nach rechts, um Höhe zu sparen und mit dem Daumen erreichbar zu sein. Die Seitenregion ist sonst leer. |
| **Dock aufgeklappt** | Wird zur vertikalen **Seitenleiste** am führenden Rand (gleiche Items + Suche, gleiche Glider-Optik). Fokusleiste bleibt unten über dem Inhalt. | Apple verschiebt Steuerung auf dem Duo an die Seite; spart Höhe im breiten, niedrigen Querformat. Nicht `TabView(.sidebar)` — eigene Optik. |
| **Arbeit, Projekte, Eingang, Suche** | **Liste + Detail**: Tab-Wurzel links (≈ 40 %, 320–420 pt), rechts der `PFNavigator` des Tabs mit Platzhalter, Task/Projekt öffnet rechts. Weitere Pushes (Projekt → Aufgabe) stapeln rechts mit nativer Swipe-Back-Geste. | Klassisches Mail-/Erinnerungen-Muster, zeigt zwei Hierarchieebenen gleichzeitig. |
| **Spalten einklappen** | Taste in der Seitenleiste blendet die Listenspalte aus/ein (z. B. für das Board). | Board und Plan brauchen Breite; gleiches Muster wie der Sidebar-Schalter auf dem iPad. |
| **Heute** | Kein Listen-/Detail-Split: Dashboard in **zwei gleich breiten Spalten** mit 40-pt-Rinne (hält den Knick frei) — links Satz, Band, Plan, Wartend; rechts Woche und Über Nacht. Gepushte Seiten laufen über die volle Breite mit lesbarer Maximalbreite. | Heute ist kuratiert, keine Liste; „Heute + Woche nebeneinander“ ist der eigentliche Mehrwert. |
| **Board** | Bahnbreite aus der Breite: so viele Spalten à ≥ 260 pt wie passen (innen bei eingeklappter Liste 3), sonst wie bisher 82 %. | Mehrere Status gleichzeitig sehen; Drag & Drop zwischen sichtbaren Spalten. |
| **Detailseiten ohne Split** | Inhalt mittig auf max. 720 pt. | Kein „gestrecktes iPhone“ (Apple). |
| **Fokusraum** | Bleibt einspaltig, mittig auf lesbarer Breite, Hintergrund vollflächig. | Fokus heißt eine Sache; Breite würde ablenken. |
| **Knick (halb gefaltet)** | Ab iOS 27.1: aktive `.division`-Region legt die Spaltengrenze von Liste/Detail genau auf den Knick (Abstand = `margins`); Heute teilt ohnehin 50/50. | Apple: Zweispalter teilen am Knick, Bedienelemente nicht in die Kurve. |
| **Auf-/Zuklappen** | Navigationszustand liegt im `AppRouter` (Pfade je Tab), nicht in der View: zugeklappt zeigt derselbe Pfad Liste → Detail mit Zurück, aufgeklappt Liste neben Detail. Arbeit-Filter liegen jetzt im `WorkNavigator` statt in `@State`. | Apple: Hierarchie in allen Posen gleich; kein Kontextverlust. |

## 4. Bewusst weggelassen

- **Querformat außen** (Apple empfiehlt es für die Zelt-Pose): App bleibt Portrait-only, eigenes Thema.
- **Mehrere Fenster / Scenes** der App innen: braucht Scene-Architektur (Router pro Fenster).
- **`ArrangementView`, Hinge-API, Laptop-Pose-Layout**: kein Haupt-/Neben-Inhalt mit Medien, Apple rät
  ohnehin von Pose-Layouts ab.
- **Seitenleiste mit Projekten/Favoriten** (echte Sidebar wie Health): eigener Informationsentwurf nötig.
- **Wochen-/Monatsansicht von Arbeit breiter**: bleibt in der Listenspalte im Phone-Layout; mit
  eingeklappter Liste läuft sie über die volle Breite.
- **Sheets**: unverändert (System zentriert sie innen und weicht dem Knick aus).
- **Lokaler View-Zustand** (Scroll-Position, Eingang-Filter, Entwürfe in der Liste) wird beim Wechsel neu
  aufgebaut; Navigationspfade und Arbeit-Filter bleiben.

## 5. Umsetzung (Code)

- `PFDesign/Components/PFAdaptive.swift`: `PFSplitColumns` (Spaltenbreite aus Breite/Knick, einklappbar),
  `pfReadableWidth`, Environment `pfIsWide`.
- `PFDock(axis: .vertical, …)`: Seitenleisten-Variante, plus optionale Spalten-Taste.
- `MainShell`: entscheidet per `horizontalSizeClass`; `AppRouter.isListColumnHidden`.
- `PFBoard`: Bahnbreite aus Breite; `TodayContent`: zwei Spalten; `FocusRoomView`: lesbare Breite.
- Onboarding-Intro: horizontaler Pager wird geclippt, damit die nächste Seite nicht in die Seitenregion ragt.

## 6. Gemessen und geprüft (2026-10-23, Simulator „iPhone Duo“, iOS 27.1)

- Außendisplay 466 × 678 pt (1398 × 2034 px @3x); Innendisplay-Framebuffer 2007 × 2853 px (≈ 669 × 951 pt,
  aufgeklappt quer ≈ 951 × 669 pt) — weicht von den Gerüchtezahlen (1878 × 2670) ab.
- Zugeklappt geprüft: Heute, Arbeit-Liste, Aufgaben-Detail mit Dock in der Seitenregion.
- Aufgeklappt: `simctl` kennt kein Auf-/Zuklappen, Device Hub ist ohne Bedienungshilfen-Freigabe nicht
  skriptbar → muss in Device Hub von Hand aufgeklappt werden. Vorab-Check des breiten Layouts (Seitenleiste,
  Heute zweispaltig) lief auf einem iPad-mini-Ersatz (regular width); Liste + Detail, Board, Fokusraum,
  Zustand beim Auf-/Zuklappen und Knick sind auf dem echten Innendisplay noch ungeprüft.
- Randabstände außen: oben gibt es keine Safe Area (Statusleiste seitlich) → `PFNavigator` garantiert
  14 pt (`PFLayout.minTopMargin`, auf normalen iPhones wirkungslos); Seitenleisten-Items 58 pt breit, damit
  die Leiste in der ~84 pt breiten Seitenregion rundum Luft hat.
- Seitenleiste außen: gleicher Abstand rechts und unten zum Bildschirmrand wie links zum Inhalt
  (`(Seitenregion + 20 − 70) / 2` ≈ 18 pt), damit sie konzentrisch in der Ecke sitzt. Die Fokusleiste wird
  außen zum ersten Eintrag der Seitenleiste (`PFDockFocus`: Fokus-Symbol + „Fokus“ + Puls, Tippen öffnet den
  Fokusraum; Erledigen dort bzw. als VoiceOver-Aktion).
- Unterseiten außen: `PFTopBar` gibt Zurück + Toolbar-Buttons per Preference an den `PFNavigator`, der sie
  als Stapel unten rechts in die Seitenregion legt (Zurück ganz unten, Abstand unten =
  rechts); oben bleibt nur ein evtl. Titel, die reservierte Kopfleistenhöhe entfällt
  (`PFLayout.topBarClearance`). Die Tab-Leiste und die Fokusleiste blenden sich auf Unterseiten aus (wie das Dock
  auf dem iPhone). Die Hauptaktion der Seite („Erledigt“/„Wieder öffnen“) steht per `pfSideAction` direkt über
  Zurück; der schwebende Button samt Verlauf entfällt dann (`pfBottomFloat(isActive:)`). Sheets bekommen außen einen Schließen-Button in ihrer Seitenregion,
  auf der Zeile der letzten Aktion (Footer bzw. letzte Inhaltszeile bei `.fit`-Sheets, sonst unten);
  horizontale Reihen (Datum, Chips) enden an der Seitenregion. Pill-Zeile im Aufgaben-Detail: erst ohne
  Chevrons, dann Umbruch (`ViewThatFits`). Der Platzhalter für den schwebenden Button entfällt dort.
- Beschreibung (alle iPhones): speichert sich selbst (1,2 s nach der letzten Eingabe und beim Verlassen),
  kein Abbrechen/Speichern mehr; die Formatleiste hat stattdessen „Tastatur schließen“. Duo außen: Formatleiste
  versteckt, ein „Aa“-Button in der Seitenspalte (nur bei offener Tastatur) blendet sie über der Tastatur ein.
- Fälligkeits-Sheet: Umschalter oben rechts zwischen Tagesleiste und Monatsansicht (`PFDateStrip(showsMonth:)`,
  wird gemerkt), weniger Leerraum unter „Save“ (`pfSheetBottomInset`).
- Root-Tabs außen: Header-Aktionen (`PFRootActions`: Heute + und Avatar, Arbeit +, Projekte +, Eingang
  Alle gelesen/Leeren) wandern über die Tab-Leiste; nur der sichtbare Tab liefert sie (`pfHidesSideControls`).
- Alle Sheets außen: 20 pt (`PFSpace.page`) zwischen Inhalt/Aktion bzw. X und linkem, rechtem und unterem
  Sheet-Rand. Footer-Sheets: Footer reicht in die untere Safe Area; `.fit`-Sheets ohne Footer: Inhalt reicht
  hinein (Detent um die Safe Area verkleinert), X auf der letzten Zeile; andere: X unten rechts. Option- und
  Aktionssheets haben dafür überall 20 statt 16 pt Seitenrand; Höhenwechsel (Tagesleiste ↔ Monat) animiert, Footer bleibt stehen.
- Nebenbei behoben: „Als erledigt markieren“ im Aufgaben-Detail lag auf allen iPhones hinter der Fokusleiste
  (gepushte Seiten sehen das `safeAreaInset` der Shell nicht) → `pfBottomChromeHeight`.
- Nebenbei behoben: `PFBoard` rechnete Drag-Treffer mit 85 % statt der gezeichneten 82 % Bahnbreite.
