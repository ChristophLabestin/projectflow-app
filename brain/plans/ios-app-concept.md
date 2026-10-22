# ProjectFlow iOS — Konzept (Neuaufbau)

Stand: 2026-10-22 · Status: **Konzept v2** (nach kritischem Review, siehe §13) · Nichts davon ist implementiert.
Ersetzt: alles aus dem gelöschten `swift/`-Projekt.
Visuelle Skizzen der Kern-Screens: [ios-app-concept-mockups.html](./ios-app-concept-mockups.html) (im Browser öffnen).

Dieses Dokument beschreibt eine komplett neue native iOS-App für ProjectFlow. Es baut bewusst nicht auf
der alten App auf. Grundlage sind ausschließlich die aktuelle Web-App (Code-Stand dieses Branches), ihre
Design Language (`web/styles/_tokens.scss`) und die Produktregeln in `brain/reference/app/APP_CONCEPT.md`
und `PERMISSIONS.md`. Wo Doku und Code abweichen, gilt der Code.

---

## 1. Ausgangslage

**Produktkern heute:** Workspaces → Projekte → Initiativen → Aufgaben (Teilaufgaben, Abhängigkeiten,
Parent/Child), Meilensteine, optional Sprints; persönliche Aufgaben pro Nutzer und Workspace; Kommentare
mit Erwähnungen; Activity-Feed; Benachrichtigungen (In-App-Dokument → FCM-Push + E-Mail); Fokus + Pins;
Health-Score (serverseitig täglich als `healthSnapshots`); Codex-Sessions (nur Daten). Flows/Ideen und
Issues sind entfernt. Finance V2, Media, Social, Marketing sind Nischen-/Admin-Flächen.

**Der tägliche Loop** (aus `web/screens/Dashboard.tsx`): Tageslage lesen („Heute ist in 4 Zügen
erledigt — der erste brennt.") → Überfälliges/Fälliges triagieren → Fokus setzen und abarbeiten →
umplanen → schnell erfassen → auf Zuweisungen/Erwähnungen reagieren → gelegentlich Projekt-Health prüfen.

**Design Language:** monochrom, ruhig, editorial-operativ. Grauer Canvas, weiße Karten ohne sichtbaren
Rand (nur 1-px-Ring im Schatten), sehr schwere enge Display-Typo (Plus Jakarta Sans), winzige, weit
gesperrte Eyebrows in Großbuchstaben, Farbe nur für Bedeutung, schwebendes mattiertes Glas-Chrome,
Dark Mode in kühlem Blau-Schiefer, dezentes Punktraster als Seitenhintergrund.

**Was am Handy heute fehlt:** Die Web-App ist responsiv, aber am iPhone gequetscht (sieben View-Icons in
einer Toolbar, abgeschnittene Buttons), ohne Gesten, Push-Aktionen, Lock Screen oder Offline-Erfassen.
Dort liegt der Wert einer nativen App — nicht in Feature-Parität.

---

## 2. Produktthese

> **Das Web ist die Werkbank. Das iPhone ist der Taktgeber.**

Die Web-App ist zum Planen, Strukturieren und Administrieren da. Die iOS-App ist für die Momente
*zwischen* der Arbeit: morgens die Lage erfassen, unterwegs etwas festhalten, auf eine Erwähnung
reagieren, eine Sache konzentriert durchziehen, abends den Tag schließen.

Drei Fragen, an denen jede Fläche gemessen wird:

1. **Wer braucht mich?** — Eingang mit Aktionen direkt aus dem Push
2. **Was ist jetzt dran?** — Heute & Fokus
3. **Wie halte ich das fest?** — Erfassen in unter drei Sekunden, von überall

Taktgeber heißt auch: **Die App kommt zum Nutzer.** Morgen-Briefing, Fälligkeits- und
Erinnerungs-Pushes, Erwähnungen mit Antwort-Aktion — serverseitig, damit sie auch bei geschlossener
App ankommen (§9.4).

### Design-Prinzipien

1. **Eine Sache nach der anderen.** Jeder Screen hat einen Hauptgedanken.
2. **Sprache statt Dashboard.** Ein Satz erklärt die Lage, wie im Web.
3. **Farbe ist Bedeutung.** Monochrom wie das Web; Farbe nur für Status, Priorität, Dringlichkeit.
4. **Wenige neue Muster, konsequent.** Höchstens zwei Dinge, die ein Nutzer neu lernen muss
   (Wischgrammatik, Fokus-Leiste). Alles andere ist Standard-iOS.
5. **System statt Insel.** Lock Screen, Dynamic Island, Widgets, Siri/Spotlight, Share Sheet,
   Kontrollzentrum gehören zur App.
6. **Gleiches Produkt, natives Gefühl.** Gleiche Begriffe, Logik, Texte und Tokens wie das Web —
   aber iOS-Navigation, iOS-Gesten, iOS-Materialien.
7. **Ein Client, gleiche Wirkung.** Eine Aktion auf dem iPhone hat exakt dieselben Folgen wie im Web
   (Activity, Fortschritt, Benachrichtigungen). Dafür wandern Nebeneffekte auf den Server (§9.4).

---

## 3. Informationsarchitektur

### 3.1 Tabs (iOS 26 Tab Bar, Liquid Glass)

| Tab | Rolle | Web-Entsprechung |
|---|---|---|
| **Heute** | *Kuratiert*: die Lage in einem Satz, max. 4 Stopps, „Wartet auf dich", Woche, Über Nacht | `/` Dashboard |
| **Arbeit** | *Vollständig*: alle meine Aufgaben + persönliche; Liste ⇄ Woche | `/tasks`, `/calendar`, `/personal-tasks` |
| **Projekte** | „Wo hinschauen" + Portfolio + Projektdetail | `/projects`, `/project/:id/*` |
| **Eingang** | Benachrichtigungen als Triage mit Aktionen, Badge | `/notifications` |
| **Suche** (Search-Rolle, rechts abgesetzt) | Globale Suche + Befehle | ⌘K-Palette |

Heute und Arbeit überschneiden sich bewusst, sagen es aber: Heute zeigt unter dem Plan
„+ 11 weitere in Arbeit →". Heute ist zum Lesen und Loslegen, Arbeit zum Sortieren.

### 3.2 Fokus-Leiste (Bottom Accessory)

Die Leiste über der Tab Bar (`tabViewBottomAccessory`) erscheint **nur, wenn ein Fokus läuft** —
wie der Mini-Player in Musik. Sie zeigt einen pulsierenden Punkt (das 1,8-s-Pulsieren der
Web-Focus-Pill), den Titel, „seit 14:20" und einen ✓-Button. Tippen zoomt in den **Fokusraum** (§5.2).

- Läuft kein Fokus, gibt es keine Leiste. Die Leiste hat nur eine Bedeutung.
- Ein-/Ausblenden braucht `tabViewBottomAccessory(isEnabled:)`, das es erst ab **iOS 26.2** gibt
  (in 26.0/26.1 bleibt die Leiste immer stehen). Daher Mindestversion **iOS 26.2** (§9.1).

### 3.3 Erfassen — ein fester Ort, viele Eingänge

- In der App: **runder Glas-Button `＋` oben rechts** in Heute, Arbeit und Projekte (im Projekt
  vorbelegt mit diesem Projekt). Kein FAB, kein Plus-Tab.
- Außerhalb: Control im Kontrollzentrum / Lock Screen / Action Button, Siri/Kurzbefehl, Share Sheet,
  Widget-Button.
- Alle öffnen denselben Capture-Composer (§5.3).

### 3.4 Sekundäre Orte

- **Account-Sheet** (Avatar oben links in Heute): Profil, Präsenz-Status, Workspace-Wechsel,
  Erscheinungsbild, Benachrichtigungen, Sicherheit (Passkeys, 2FA), Daten-Export, Konto löschen,
  Rechtliches, „Workspace-Einstellungen im Web öffnen".
- **Workspace-Wechsel** zusätzlich als Menü am Workspace-Namen in Heute („Demo Studio ⌄").
- Projekt-, Aufgaben- und Initiativdetail: Push-Navigation.

### 3.5 Umfangs-Matrix

| Bereich | v1 | später | nur Web |
|---|---|---|---|
| Heute / Tagesplan / Wartet auf dich | ● | | |
| Meine Aufgaben, persönliche Aufgaben | ● | | |
| Woche (Einplanen per Drag & Drop) | ● | Monat, Smart verteilen¹ | |
| Aufgabe: Status, Priorität, Daten, Zuweisung, Nächster Schritt, Blocker, Teilaufgaben | ● | | |
| Aufgabe: Beschreibung (Tiptap-HTML) | ◐ lesen + Grundformate | voll | Sonderblöcke |
| Aufgabe: Beziehungen | ◐ anzeigen + „blockiert durch" setzen | | |
| Kommentare + Erwähnungen | ● | | |
| Fokus, Pins | ● + Live Activity | | |
| Eingang + Push-Aktionen | ● | | |
| Suche + Befehle | ● | | |
| Projekte: Portfolio, Health, Detail, Liste, Board | ● | Timeline/Roadmap (iPad) | |
| Initiativen, Meilensteine | ◐ lesen + Status | anlegen/bearbeiten | |
| Sprints | | ◐ aktueller Sprint als Board | Planung |
| Projekt anlegen | ◐ Titel + Vorlage | | Briefing, Einstellungen |
| Team | ◐ Mitglieder + Präsenz ansehen | | Einladen, Rollen, Gruppen |
| Workspace: Eigentum übertragen / löschen | ● (nötig für Konto löschen, §7) | | |
| Workspace-/Projekteinstellungen, API/MCP, SMTP | | | ● |
| Finance V2, Media, Social, Marketing, Effort/Invoices | | Finanz-Puls lesend | ● |

● voll · ◐ teilweise · ¹ Der Web-Scheduler braucht die Aufgaben des ganzen Teams (`teamTasks`), die
iOS in v1 nicht lädt.

---

## 4. Design Language für iOS

Die Brücke: **Das Web hat schon schwebendes Glas-Chrome über ruhigem Inhalt. iOS 26 Liquid Glass ist
genau das, nativ.** Also System-Glas für Chrome und ProjectFlow-Tokens für Inhalt.

### 4.1 Farbe (aus `_tokens.scss`, als Asset-Catalog-Farben Light/Dark)

| Rolle | Light | Dark |
|---|---|---|
| `canvas` (Level 0) | `#F2F2F3` | `#0B0D11` |
| `card` (Level 1) | `#FFFFFF` | `#151920` |
| `raised` (Level 2) | `#EDEDEE` | `#1E242E` |
| `hairline` | `#E5E7EB` | `#2E3440` |
| `textMain` | `#171717` | `#E5E7EB` |
| `textMuted` | `#666666` | `#9CA3AF` |
| `textSubtle` (nur Deko, nie Information) | `#8F8F8F` | `#6B7280` |
| `primary` (invertiert) | `#171717` | `#E5E5E5` |
| `onPrimary` | `#FFFFFF` | `#171717` |

- **Kein Markenfarbton.** App-`tint` = `primary`, nicht Systemblau.
- Semantik: success `#10B981`, warning `#F59E0B`, error `#EF4444`.
- **Status-Pills**: Füllung = Statusfarbe mit 12 % Alpha (wie Web). **Text in AA-sicheren Tönen**
  (die Web-Vollfarben erreichen auf der 12-%-Füllung nur 2,0–3,6 : 1):

  | Status | Füllbasis | Text Light | Text Dark |
  |---|---|---|---|
  | Backlog | `#94A3B8` | `#475569` (6,9) | `#94A3B8` |
  | Offen | `#3B82F6` | `#1D4ED8` (5,8) | `#60A5FA` |
  | In Arbeit | `#0EA5E9` | `#0369A1` (5,2) | `#0EA5E9` |
  | Review | `#F59E0B` | `#B45309` (4,6) | `#F59E0B` |
  | On Hold | `#9CA3AF` | `#4B5563` (6,9) | `#9CA3AF` |
  | Blockiert | `#EF4444` | `#B91C1C` (5,5) | `#F87171` |
  | Erledigt | `#10B981` | `#047857` (4,9) | `#10B981` |

  Gleiche Anpassung als Vorschlag fürs Web (`known-issues`), damit beide Plattformen gleich aussehen.
- Priorität: Dringend `#7C3AED`/`#A78BFA`, Hoch `#EF4444`/`#F87171`, Mittel `#3B82F6`/`#60A5FA`,
  Niedrig `#94A3B8`.
- SwiftLint-Regel verbietet Farbliterale außerhalb von `PFDesign` — Gegenstück zu `npm run lint:theme`.

### 4.2 Typografie

Zwei Schriften mit klarer Aufgabe:

- **Plus Jakarta Sans** (gebündelt, SIL OFL) für alles, was „ProjectFlow" sagt: Headline, Titel,
  Abschnittstitel, Zeilentitel, Eyebrows, Pills, Buttons.
- **SF Pro** (System) für Lesetext: Beschreibungen, Kommentare, Metadaten, Formularwerte. Beste
  Lesbarkeit, Dynamic Type, „Fettere Schrift" und Silbentrennung ohne Aufwand. Die Identität des Webs
  steckt in Palette und schwerer Headline, nicht im Fließtext.
- Gewicht: Das Web *fordert* 800/850, *rendert* aber 700 (es lädt nur bis 700). iOS nutzt **700 für
  Titel** (sieht aus wie das Web, das Nutzer kennen) und **800 nur für die Heute-Headline und den
  Fokus-Titel**. Vor Phase 1 Seite-an-Seite mit dem Web prüfen.
- Alle Stile skalieren mit Dynamic Type (`relativeTo:`); Ziffern tabellarisch (`.monospacedDigit()`).

| Stil | Schrift | Größe / Gewicht / Tracking | Verwendung |
|---|---|---|---|
| `display` | Jakarta | 30 / 800 / −0.02em, Zeilenhöhe 1.18, max. 3 Zeilen | Heute-Headline, Fokus-Titel |
| `title` | Jakarta | 26 / 700 / −0.02em | Aufgaben-, Projekttitel |
| `section` | Jakarta | 17 / 700 | Abschnittstitel |
| `rowTitle` | Jakarta | 16 / 600 | Listenzeilen |
| `eyebrow` | Jakarta | 11 / 800 / +0.14em, GROSS | „DEIN PLAN FÜR HEUTE" |
| `pill` | Jakarta | 11 / 700 / +0.04em, GROSS | Status-/Prioritäts-Pills |
| `body` | SF Pro | 17 / regular | Beschreibung, Kommentare |
| `meta` | SF Pro | 13 / medium, `textMuted` | Zeilen-Metadaten |

Ab Accessibility-Größen nutzt die Headline eine kürzere Satzvariante (gleiche Schlüssel, `.short`).

### 4.3 Form, Fläche, Tiefe

- Radien (`.continuous`): Kontrolle 10, Karte 16, Sheet 24, Pill/Avatar voll.
- Ebenen trennen sich über Tonwert (canvas → card → raised). Light Mode: Schatten `sm` **inklusive
  1-px-Ring mit 5 % Schwarz** (wie Web `--shadow-sm`, sonst wirken Karten flacher als im Web). Dark Mode:
  keine Schatten, nur Tonwerte.
- Keine verschachtelten Karten (Web-Regel); in Karten Zeilen mit 5-%-Trennlinien.
- **Punktraster** (20 pt, 1-pt-Punkte, 6 % / 4 %) nur in Heute und im Fokusraum.
- **Glas nur für Chrome** (Tab Bar, Fokus-Leiste, Toolbars, schwebende Buttons, Sheets). Inhaltskarten
  sind nie Glas.

### 4.4 Signatur-Elemente aus dem Web

1. **Tagesband**: segmentiert (13 pt, Radius 3, max. 6 Segmente): Rot überfällig, Amber heute fällig,
   Umriss wartet, blass „Rest des Tages frei". Wie im Web aus *offenen* Elementen berechnet; ein
   erledigtes Segment schrumpft animiert heraus.
2. **Ring-Check**: 22 pt, Ringfarbe nach Dringlichkeit, gestrichelt bei Vorschlägen, füllt sich grün.
3. **Prioritäts-Signal**: drei Balken (5/8/12 pt); Dringend = violettes Quadrat mit „!". Als Custom
   SF Symbol (skaliert mit Dynamic Type).
4. **Status-Pill** (12 % Füllung, AA-Text, GROSS).
5. **Editoriale Headline**: Texte aus `dashboard.route.statement.*` (DE/EN), Hervorhebung in `primary`.
6. **Avatar-Stapel**: 24 pt, −6 pt Überlappung, 2-pt-Ring in Kartenfarbe.

### 4.5 Ikonografie

SF Symbols, Regular, Outline (Web: Material Symbols Outlined, wght 400). Gefüllt nur für aktive
Zustände. Mapping der ~40 Web-Icons in `PFDesign/Icons.swift`.

### 4.6 Bewegung und Haptik

- UI-Übergänge mit der Web-Kurve `cubic-bezier(0.16, 1, 0.3, 1)`, 150 ms / 300 ms.
- Gesten mit Springs (`.snappy`, `.smooth`).
- Fokus-Leiste → Fokusraum mit Zoom-Übergang. Zeile → Detail: Standard-Push; Zoom nur, wo keine
  Wisch-Aktionen auf der Quelle liegen (Projektkarten, Initiativkarten) — Zoom und Swipe-Actions
  stören sich auf Listenzeilen.
- Die Heute-Headline schrumpft beim Scrollen in den Navigationstitel.
- Erledigen: Ring füllt sich, Zeile gleitet heraus, Tagesband-Segment schrumpft, Headline-Zahl zählt
  herunter. Haptik `.success`. Keine Partikel.
- Haptik sonst: `.selection` bei Status/Priorität, `.warning` bei „Blockiert", `.impact(.light)`
  beim Andocken im Drag & Drop.
- Reduce Motion: Überblendungen statt Bewegung, kein Pulsieren.

### 4.7 App-Icon

ProjectFlow-Glyph (`web/assets/logo.svg`): schwarz auf weiß; mit Icon Composer geschichtet für
Dark, Tinted und Clear.

---

## 5. Kern-Screens

### 5.1 Heute

```
┌────────────────────────────────────┐
│ (C)  Demo Studio ⌄             (＋) │  Avatar = Account · Workspace-Menü · Erfassen
│ · · · · · · · · · · · · · · · · ·  │  Punktraster
│ DONNERSTAG, 22. OKTOBER            │  eyebrow
│ Heute ist in 4 Zügen               │  display
│ erledigt — der erste brennt.       │
│ Die älteste überfällige Aufgabe    │  body muted
│ wartet seit 3 Tagen.               │
│ ▇▇▇▇ ▇▇▇▇ ▇▇▇ ▇▇▇ ░░░░░░░░░░       │  Tagesband
│ 2 überfällig · 2 heute             │
│                                    │
│ DEIN PLAN FÜR HEUTE                │
│ ┌────────────────────────────────┐ │
│ │ ◯ Set up 301 redirects     ◎  │ │  ◎ = Fokus starten
│ │   Seit 3 Tagen überfällig ·    │ │
│ │   löst 2 · Website Relaunch    │ │
│ │ ◯ Conflict resolution …        │ │
│ │ ◯ Finalize hero copy           │ │
│ │ ◯ Onboarding screens           │ │
│ │ + 11 weitere in Arbeit  →      │ │
│ └────────────────────────────────┘ │
│ WARTET AUF DICH                    │
│ Lena · „Hero copy" hängt an deiner │
│ Aufgabe „CMS schema"      [Öffnen] │
│ DIESE WOCHE                        │
│ M  D  M  D  F  S  S                │
│ 19 20 21 ㉒ 23 24 25               │
│ ÜBER NACHT                         │
│ ! „Conflict resolution" überfällig │
│ ✓ Lena hat „Hero copy" erledigt    │
├────────────────────────────────────┤
│ ● Set up 301 redirects · seit 14:20 ✓│  Fokus-Leiste (nur wenn Fokus läuft)
│  Heute   Arbeit  Projekte Eingang 🔍│
└────────────────────────────────────┘
```

- **Plan für heute**: dieselbe Logik wie Web (Fokus + nächster Schritt → überfällig mit „löst N" →
  heute fällig nach Priorität → heute eingeplant → Nachfassen bei Blockiertem; an ruhigen Tagen
  Vorschläge, gestrichelt). Erweiterung für beide Plattformen: **persönliche Aufgaben zählen mit**
  (heute ignoriert das Dashboard sie). Umgesetzt im gemeinsamen Modul `dayPlan` (§9.3), damit Web und
  iOS gleich rechnen.
- **Ehrliche Zahl**: Der Satz deckelt bei 4 Stopps. Gibt es mehr Überfälliges, steht darunter
  „+ 11 weitere in Arbeit" — nie „in 4 Zügen erledigt" ohne Hinweis auf den Rest.
- **Wartet auf dich** (neu, beide Plattformen sinnvoll): Aufgaben anderer, die an *meiner* offenen
  Aufgabe hängen (`dependencies`, `unblocksCount`), plus von mir blockierte Aufgaben mit Blocker-Notiz.
  Ein Tipp öffnet, Wischen = „Kümmere mich heute" (in den Plan). Das kann keine generische To-do-App.
- **Tagesabschluss** (opt-in): Abends (Uhrzeit einstellbar) kommt ein Push „3 von 4 Zügen erledigt —
  Tag abschließen?". Er öffnet Heute im Abschluss-Modus mit drei Aktionen pro offenem Stopp:
  *Morgen einplanen* (setzt `scheduledDate`), *Fälligkeit verschieben* (nur mit Bearbeitungsrecht,
  verschiebt `dueDate`), *Aus Plan nehmen* (löscht nur `scheduledDate`). Rückgängig per Toast.
- Kein Pull-to-Refresh (Daten sind live), keine versteckten Gesten auf dem Screen.

### 5.2 Fokusraum

```
┌────────────────────────────────────┐
│ ⌄                       Website R. │  ⌄ = zurück in die Fokus-Leiste
│ ● FOKUS · SEIT 14:20               │  pulsierender Punkt
│                                    │
│ Set up 301                         │  display, groß
│ redirects for                      │
│ old URLs                           │
│                                    │
│ NÄCHSTER SCHRITT                   │
│ Mapping-Tabelle aus Sitemap        │  inline editierbar
│ exportieren                        │
│ TEILAUFGABEN            2 / 5      │
│ ✓ Alte URLs sammeln                │
│ ◯ Mapping-Tabelle                  │
│                                    │
│ [Blockiert]  [Pause]  [✓ Erledigt] │  Erledigt = primary
└────────────────────────────────────┘
```

- **Immersion durch Reduktion**: Tab Bar und Fokus-Leiste weichen, alles außer dem einen Element ist
  weg. Der Raum folgt dem Theme; optional „Dunkler Fokus" in den Einstellungen (dunkles Punktraster
  auch im Light Mode) — Standard aus.
- **Zeit**: „seit 14:20" statt Stoppuhr. Das Web bewahrt `startedAt` über Pausen hinweg; eine
  laufende Uhr würde falsche Arbeitszeit vortäuschen.
- **Blockiert**: Blocker-Notiz (Tippen oder Tastatur-Diktat), setzt Status *Blockiert*,
  `blockerNote`, `focusState.status = blocked`; roter 3-pt-Rand wie das Web-Fokusbanner.
- **Pause**: Snooze (60 min wie Web) mit lokaler Erinnerung (gerätebezogen, daher lokal korrekt).
- **Erledigt**: Haptik, dann „Weiter mit: Conflict resolution?" — ein Tipp startet den nächsten Stopp.
- **Live Activity / Dynamic Island**: Titel, „seit 14:20", nächster Schritt, Buttons *Erledigt*,
  *Pause*. Endet nach spätestens 8 h (Systemgrenze); beim nächsten App-Start wird sie neu gestartet.
- **Web ⇄ iPhone**: Fokus liegt in `users/{uid}.focusState`. Damit ein im Web gestarteter Fokus auf
  dem iPhone erscheint (und umgekehrt), braucht das Web einen Realtime-Listener auf das User-Dokument
  und das Backend einen Live-Activity-Push (FCM HTTP v1 unterstützt `live_activity_token` für
  Push-to-Start/Update) — §9.4.

### 5.3 Erfassen (Capture-Composer)

Ziel: **Lock Screen → gespeichert in unter 3 Sekunden.**

```
┌────────────────────────────────────┐
│ Redirects testen                   │  Titel, Tastatur offen
│                                    │
│ Ziel: ▣ Persönlich ⌄               │
├────────────────────────────────────┤
│ [📅 Datum] [▣ Projekt] [▮▮▮ Prio] [◉ Wer] │  Chip-Leiste über der Tastatur
│  q w e r t z u i o p …             │
└────────────────────────────────────┘
```

- **Chips sind die Haupteingabe**: Datum (Heute · Morgen · Wochenende · Nächste Woche · Datum…),
  Projekt, Priorität (4 Stufen), Zuständig. Ein Tipp, eine Auswahl.
- **Tokens als Abkürzung für Power-User**: `#projekt`, `@person` und erkannte Datumsangaben
  („morgen", „Freitag", „next monday") werden im Text hervorgehoben und als Chip übernommen; ein Tipp
  auf die Hervorhebung macht es rückgängig. Kein `!`-Token (kollidiert mit der Suche, wo `!` Aufgaben
  meint). Datumserkennung DE/EN wird mit einem Testkorpus abgesichert.
- **Ziel**: im Projektkontext dieses Projekt, sonst **Persönlich** (privat). Persönliche Aufgaben
  erscheinen in Heute und Arbeit und sind fokussierbar (`FocusItemType` kennt `personal-task`).
- **Diktat** über die System-Tastatur. Kein eigenes Spracherkennungs-UI in v1.
- **Offline**: Schreiben lokal (Firestore-Persistenz), Zeile zeigt „wartet auf Netz".
- Optional nach dem Speichern: „Als Fokus starten".

### 5.4 Arbeit

- Segment **Liste | Woche**.
- **Liste**: Gruppen wie Web (Überfällig · Heute · Nächste 7 Tage · Später · Ohne Datum · Erledigt
  eingeklappt). Gruppenkopf mit 8-pt-Punkt, Label, Zähler-Pill. Zeile: Ring-Check, Titel, Projekt ·
  Fälligkeit, rechts Prioritäts-Signal + Avatar; persönliche Aufgaben mit Schloss statt Projekt.
- **Filter-Chips**: Projekt · Priorität · Persönlich · Erledigte.
- **Woche**: Tage untereinander (heute zuerst), je Tag die Aufgaben nach `scheduledDate` (sonst
  `dueDate`); oben die einklappbare Ablage **Ungeplant**. Long-Press + Ziehen plant ein.
- Optional (Phase 2, opt-in): **Kalender-Abgleich** über EventKit — „Heute 3 h frei zwischen
  Terminen" im Wochen-Kopf. Nur lesend, nur lokal.

### 5.5 Projekte

```
┌────────────────────────────────────┐
│ Projekte                       (＋)│
│ WO HINSCHAUEN                      │
│ ┌────────────┐ ┌────────────┐      │  Karussell nach Attention-Score
│ │ Mobile App │ │ Website R. │      │
│ │ ◔ 48  ↘    │ │ ◑ 61  ↘    │      │  Health-Ring, Score, Trend
│ │ 16 Tg still│ │ 1 blockiert│      │  Grund
│ └────────────┘ └────────────┘      │
│ AKTIV                              │
│ ▣ Website Relaunch  ━━━━─── 18 %  ›│
│ ▣ Mobile App v2     ━━───── 20 %  ›│
│ PLANUNG · PAUSIERT · ABGESCHLOSSEN │
└────────────────────────────────────┘
```

- Health und Trend kommen aus den **serverseitigen `healthSnapshots`** (täglich), nicht aus einem
  Port der 1.900 Zeilen `healthService.ts`. Nur die Attention-Reihenfolge rechnet der Client.
- Container-Projekte (Firma/Kunde) zeigen Kind-Projekte eingerückt.
- **Projektdetail**: Hero (Icon oder Cover mit Scrim wie Web), Titel, Pills, Health-Ring,
  Zusammenfassungszeile („4 offen · 1 überfällig · 1 bald fällig"), Initiativen-Streifen, darunter
  Segment **Liste | Board | Meilensteine | Aktivität** (+ Sprint, später). Gruppierung wählbar.
- **Board**: horizontal paginierte Status-Spalten (85 % Breite), Spaltenkopf wie Web (Punkt,
  GROSS-Titel, getönte Zähler-Pill), Karten per Long-Press verschieben.
- `•••`: Anpinnen, Link teilen, „Einstellungen im Web öffnen".

### 5.6 Aufgabendetail

Reihenfolge nach Häufigkeit:

1. Eyebrow `WEBSITE RELAUNCH · CMS`, Titel, Pills Status · Priorität · Fällig — jede Pill ist ein Menü.
2. **Workbench-Karte**: *Nächster Schritt* (inline) oder bei Blockade *Blocker* mit rotem Rand;
   *Fokus starten* / *Blocker lösen*.
3. **Teilaufgaben** mit Fortschritt, neue Zeile direkt tippen.
4. **Beschreibung** (Tiptap-HTML gerendert; Bearbeiten mit Grundformaten: fett, kursiv, Liste, Link,
   Überschrift; unbekannte Blöcke bleiben unangetastet erhalten).
5. **Diskussion** mit `@`-Vervollständigung.
6. **Details**: Zuständig + Gruppen · Start/Fällig/Eingeplant · Erinnerungen · Labels · Meilenstein ·
   Beziehungen · letzte Aktivität.
7. Schwebender Glas-Button: **✓ Als erledigt markieren**.

Long-Press auf Aufgabenzeilen zeigt eine Vorschau mit Workbench-Daten.

### 5.7 Eingang (Triage)

Der Eingang ist der zweitwichtigste Ort nach Heute — hier wird man gebraucht.

- Oben, wenn es etwas gibt: **„Seit gestern Abend"** — ein Satz im Headline-Stil („3 neue Zuweisungen,
  Lena hat dich zweimal erwähnt"), darunter die Elemente.
- Jede Zeile zeigt die betroffene Aufgabe als Mini-Zeile (Status, Fälligkeit) und die passende
  **Hauptaktion als Button**: Zuweisung → *In Plan für heute*; Erwähnung → *Antworten* (inline);
  Kommentar → *Antworten*; Einladung → *Annehmen*.
- Wischen rechts = erledigt/gelesen, links = später erinnern. Filter: Alles · Erwähnungen · Zuweisungen.
- **Mehrere Workspaces**: Einträge aus anderen Workspaces erscheinen mit Workspace-Chip; Öffnen
  wechselt den Workspace mit Hinweis-Banner („Gewechselt zu Kunde X"). Badge = Summe aller Workspaces.
- Dieselben Aktionen im Push (§8.2) — die meisten Reaktionen brauchen die App gar nicht.

### 5.8 Suche

- Search-Tab; gleiche Grammatik wie die Web-Palette: `#` Projekte, `!` Aufgaben, `>` Befehle,
  `?` Hilfe; `is:open|done|overdue|today|mine`, `prio:urgent|high|medium|low`.
- Leerzustand: Zuletzt geöffnet, letzte Suchen, Befehle.
- **Index-Umfang**: meine Aufgaben und alle Projekte sofort (lokal); Aufgaben anderer in meinen
  Projekten werden beim ersten Suchen pro Projekt einmalig geladen und gecacht (wie Web, one-shot).
- System-Spotlight: Aufgaben und Projekte als `IndexedEntity` (nur Titel + Projekt). **Index wird bei
  Abmelden und Workspace-Wechsel gelöscht.**

---

## 6. Interaktions-Grammatik

| Geste | Wirkung (überall gleich) |
|---|---|
| Tippen auf Ring-Check | **Erledigt** |
| Wischen nach rechts | **Erledigt** (voll durchziehen), Rückgängig-Toast 5 s |
| Wischen nach links | Zeigt zwei Buttons: **Heute** (setzt `scheduledDate`) · **Später…** (Sheet) |
| Tippen auf Zeile | Detail |
| Long-Press | Vorschau + Menü: Fokus starten, Anpinnen, Status, Priorität, Zuweisen, Teilen |
| Long-Press + Ziehen | Einplanen (Woche) / Status (Board) |

- Keine Unterscheidung kurzer/langer Linkswisch (schwer auffindbar, fehleranfällig).
- „Heute" auf einer überfälligen Aufgabe zeigt zusätzlich „Fälligkeit auch verschieben?" im Toast —
  sonst bliebe sie sichtbar überfällig.
- Beim ersten Öffnen einer Liste zeigt eine Zeile einmal kurz an, was Wischen tut (TipKit).
- **Rückgängig statt Bestätigen**; Bestätigung nur fürs Löschen (Sheet, kein Systemalert-Text).
- Rechte entscheiden über Sichtbarkeit (Auswertung wie `permissionService.ts`, Deny schlägt Allow).
  Gäste sehen nur Projekte, in denen sie Mitglied sind; Aktionen ohne Recht erscheinen nicht.

---

## 7. Konto, Login, Onboarding, Zustände

- **Login**: E-Mail/Passwort, **Passkey** (Autofill), Google, GitHub, **Sign in with Apple** (Pflicht
  nach Richtlinie 4.8, sobald Google/GitHub angeboten werden; auch im Web ergänzen), TOTP-2FA.
  Passkeys sind an `app.getprojectflow.com` gebunden; der iOS-Origin muss in die Allowlist
  (`functions/src/passkeys.ts`). Passkey-Login umgeht heute TOTP (wie im Web) — bewusst so lassen
  oder ändern: offene Frage.
- **Registrierung** in der App möglich (legt einen Workspace an, wie Web).
- **Konto löschen** in der App (`deleteMyAccount`, inkl. Apple-Token-Widerruf). Weil die Funktion
  Eigentümer von Workspaces mit weiteren Mitgliedern blockiert, zeigt die App diese Workspaces und
  bietet direkt *Eigentum übertragen* (`transferWorkspaceOwnership`) oder *Workspace löschen*
  (`deleteWorkspace`) an.
- **Einladungen**: Universal Links für `/invite/*` und `/join/*`; ist man abgemeldet, wird der Link
  nach dem Login fortgesetzt (gilt für alle Deep Links).
- **Erster Start**: Workspace aus den Mitgliedschaften wählen (nicht aus Cache, siehe GOTCHAS
  „Native tenant bootstrap"). Drei Karten: Heute · Fokus · Eingang. Push-Erlaubnis erst, wenn sie Sinn
  ergibt (erste Zuweisung oder erste Pause im Fokus).
- **Neue Nutzer ohne Aufgaben**: Heute zeigt „Noch nichts geplant" mit zwei Aktionen: erste Aufgabe
  erfassen, Projekt aus Vorlage anlegen.
- **Zustände**: Leer (48-pt-Icon-Kachel, Titel, ein Satz, eine Aktion — Web-Stil), Laden (Skeleton mit
  Shimmer, aus bei Reduce Motion), Offline (dezente Leiste „Offline — Änderungen werden synchronisiert"),
  Fehler (Toast mit „Erneut"), Rechte verloren (Projekt verschwindet mit Hinweis statt Absturz),
  Aufgabe gelöscht (Detail schließt mit Toast).
- Datenschutz: Privacy Manifest, Required-Reason-APIs, Nutrition Labels inkl. Crash-SDK. Keine Links
  auf Abrechnung/Pläne (Richtlinie 3.1).

---

## 8. Systemintegration

### 8.1 Widgets

| Widget | Größen | Inhalt / Aktion |
|---|---|---|
| **Heute** | S, M, L | Tagesband + nächste Stopps, Ring-Check erledigt direkt |
| **Fokus** | S, M | Fokus, „seit 14:20", *Erledigt* / *Pause* |
| **Lock Screen** | rechteckig, rund, inline | „2 überfällig · 2 heute" / Fokus-Titel / Tagesband |

Widgets lesen einen kompakten Snapshot aus der App Group. Schreibende Aktionen laufen als App Intents
**im App-Prozess** (`LiveActivityIntent` bzw. Intent im App-Target), nicht im Widget-Prozess — dort ist
kein Firebase. `Needs verification:` Spike in Phase 0, ob alle Widget-Buttons so im App-Prozess
ausgeführt werden; Fallback ist ein schlanker REST-Client mit geteiltem ID-Token.

### 8.2 Benachrichtigungen

- Kategorien mit Aktionen: Zuweisung → *Erledigt*, *Heute*; Erwähnung/Kommentar → *Antworten*
  (Texteingabe); Fälligkeit → *Erledigt*, *Morgen*; Erinnerung → *Erledigt*, *1 h später*.
- Gruppierung pro Projekt (`thread-id`), Rich Notifications mit Aufgabenkontext (`mutable-content` +
  Notification Service Extension, nur Formatierung).
- Deep Links = Web-Routen (`/project/{p}/tasks/{t}`) als Universal Links (AASA `applinks` ergänzen).
- **Server-Nudges** (neu, Kern des „Taktgebers"): Morgen-Briefing (Uhrzeit einstellbar, öffnet Heute),
  „heute fällig", Aufgaben-Erinnerungen (`reminders[]`), Tagesabschluss. Alle serverseitig geplant —
  ein Reminder, der im Web gesetzt wurde, muss auch bei geschlossener App ankommen.
- Lokal bleibt nur, was das Gerät selbst auslöst (Fokus-Pause).
- Einstellungen pro Kategorie in der App (das Backend hat noch keine Nutzerpräferenzen — §9.4).

### 8.3 Live Activity

Fokus als Live Activity mit Buttons. Start/Update/Ende auch per Push (FCM `live_activity_token`), damit
ein Fokus aus dem Web auf dem iPhone erscheint. Max. 8 h Laufzeit beachten.

### 8.4 App Intents, Siri, Spotlight, Controls

- Intents: *Aufgabe erfassen*, *Fokus starten / erledigen / pausieren*, *Was steht heute an?*
  (liefert Headline + Stopps), *Projekt öffnen*. App Entities: Aufgabe, Projekt.
- **Controls** (Kontrollzentrum, Lock Screen, Action Button): *Erfassen*, *Fokus ⏯*.
- iOS-26-Snippets für Erfassen/Erledigen direkt aus Siri/Spotlight — `Needs verification:` API-Stand
  (SnippetIntent) in Phase 0 prüfen.

### 8.5 Share Extension

Text, URLs, Bilder → kompakter Capture-Composer, Ziel wählbar (Projekt oder Persönlich). Schreibt über
einen **schlanken Firestore-REST-Client** mit dem ID-Token aus der geteilten Keychain-Gruppe (kein
Firebase-SDK in der Extension, Speichergrenzen). Ist kein gültiges Token da: „Bitte ProjectFlow einmal
öffnen". Kein Import-Zwischenspeicher.

### 8.6 iPad (nach 1.0)

`NavigationSplitView` mit Sidebar — die Web-Shell übersetzt sich fast 1:1; Inspector-Spalte im
Aufgabendetail wie die 340-px-Leiste im Web; Tastaturkürzel wie Web (⌘K, t, i, p).

---

## 9. Technische Architektur

### 9.1 Plattform

- **iOS 26.2+**, iPhone zuerst; Build mit dem aktuellen Xcode-SDK (iOS 27). Begründung: Liquid Glass
  und `tabViewBottomAccessory(isEnabled:)` tragen das Design. Kosten: Stand Juni 2026 laufen ~79 %
  aller aktiven iPhones auf iOS 26 — für Teams, in denen *alle* die App brauchen, ist das eine bewusste
  Entscheidung (offene Frage §12).
- SwiftUI, Swift 6 (strict concurrency), Observation.
- Firebase iOS SDK im App-Target: Auth, Firestore (Offline-Persistenz), Functions (`europe-west3`),
  Messaging (Token → `users/{uid}.fcmTokens`, wie Web), Realtime Database nur für Präsenz.
- Crash/Feedback: Labestin Sentinel (SentinelKit) — `Needs verification:` per `manager-setup`.
- Bundle-ID `de.christophlabestin.projectflow` (Team `48BM67TY9G`) — steht schon in der AASA
  (`webcredentials`); App Group `group.de.christophlabestin.projectflow`.

### 9.2 Projektstruktur (`ios/` statt `swift/` — klarer Schnitt)

```
ios/
  ProjectFlow.xcodeproj
  App/          App-Target: Features, Navigation, Composition Root, App Intents (App-Prozess)
  Widgets/      Widgets, Live Activity, Controls (lesen nur den App-Group-Snapshot)
  Share/        Share Extension (REST-Client, kein Firebase-SDK)
  NotificationService/  Rich-Push-Formatierung
  Packages/ProjectFlowKit/
    PFDesign    Tokens, Typo, Komponenten (Pill, RingCheck, PrioritySignal, DayBand, Card …), Icons
    PFModel     Codable-Entitäten = Spiegel von web/types.ts, tolerante Datums-Decoder
    PFDomain    reine Logik: Due-Buckets, Tagesplan, Headline, Wartet-auf-dich, Attention-Ranking,
                Such-Grammatik, Capture-Parser, Rechte-Auswertung
    PFData      Repositories, Listener, Writes (immer per vollem Pfad)
    PFSnapshot  App-Group-Snapshot für Widgets/Live Activity
```

Abhängigkeiten: Features → PFData → PFDomain → PFModel; PFDesign ist blattfrei; PFDomain ohne Firebase.

### 9.3 Parität der Logik

1. Inline-Logik im Web wird in reine Module extrahiert: `web/utils/dayPlan.ts` (aus
   `Dashboard.tsx`, inkl. Headline-Auswahl und `unblocksCount`), `dueBuckets.ts`, `attention.ts`.
2. **Gemeinsame Golden-Fixtures** (`shared/fixtures/*.json`: Eingabe + erwartete Ausgabe), generiert
   aus anonymisierten echten Workspace-Exporten plus Randfällen: Zeitzonen (ein `YYYY-MM-DD` ist in JS
   UTC-Mitternacht), gemischte Datumsformate (ISO, Datum ohne Zeit, Timestamp, `{seconds}`), Legacy-
   Status `Todo` → Offen, `isCompleted` vs. `status`. Vitest und XCTest laufen gegen dieselben Dateien;
   CI bricht bei Abweichung.
3. Rechte: `permissionService.ts` (Rollen, Custom Roles, Deny > Allow) wird portiert und ebenfalls
   über Fixtures abgesichert. Es ist reine UI-Logik — die Rules erzwingen nur grob.
4. Health wird **nicht** portiert (Server-Snapshots).
5. i18n: String Catalogs; Schlüssel und Texte der gemeinsamen Begriffe (`dashboard.route.*`, Status,
   Prioritäten, Gruppen) werden aus `web/locales/*` generiert.

### 9.4 Backend-Voraussetzungen (Phase 0, Pflicht)

| Thema | Heute | Nötig |
|---|---|---|
| **Nebeneffekte von Writes** | Web-Client schreibt Activity, synchronisiert Projektfortschritt, erzeugt Benachrichtigungs-Dokumente (`tasksService.ts`, `notificationService.ts`) | Firestore-Trigger (`onTaskWritten`, `onCommentCreated`) für Activity, `progress`, Benachrichtigungs-Fan-out und Konsistenz `isCompleted` ⇄ `status`. Web entfernt die Client-Duplikate. Gilt dann auch für MCP/Codex-Writes. |
| **Erinnerungen / Nudges** | `reminders[]` gespeichert, nie versendet | Geplante Funktion: Reminder, „heute fällig", Morgen-Briefing, Tagesabschluss per FCM. Empfänger klären (§12). |
| **Benachrichtigungs-Präferenzen** | keine (TODO im Code) | `users/{uid}.notificationPrefs` pro Kategorie und Kanal |
| **APNs-Payload** | `category` | `thread-id`, `mutable-content` |
| **Fokus-Sync** | Web lädt Profil einmalig; Pins als ganzes Array, entprellt | Web-Listener auf `users/{uid}`; Pins per `arrayUnion/arrayRemove`; Live-Activity-Push bei `focusState`-Änderung |
| **Queries „meine Aufgaben"** | Web: eine Abfrage pro Projekt; Legacy-Felder `assigneeId`, `ownerId` | Collection-Group-Abfrage **mit `tenantId ==`** (sonst lehnen die Rules ab, `canAccessScopedDoc`) + `assigneeIds array-contains` → Composite-Index ergänzen; Backfill `assigneeIds` aus Legacy-Feldern; Gäste: Listener pro Projekt. Bei großen Workspaces später materialisiertes `userTasks/{uid}`. |
| **Passkeys** | RP-ID über Web-Origin-Allowlist | iOS-Origin zulassen |
| **Universal Links** | nur `webcredentials` | `applinks` für `/project/*`, `/invite/*`, `/join/*` |
| **Sign in with Apple** | fehlt | Firebase-Provider, Web-Login, Token-Widerruf bei Löschung |

### 9.5 Daten, Offline, Kosten

- Realtime-Listener: meine Aufgaben (Abfrage oben), persönliche Aufgaben, Benachrichtigungen, User-
  Dokument, geöffnetes Projekt. Heute/Arbeit sind live; das Web lädt sie einmalig.
- **Lese-Budget**: Start = Anzahl offener eigener Aufgaben + Benachrichtigungen der letzten 30 Tage;
  danach nur Änderungen. Erledigte Aufgaben werden nicht live gehalten (nur on demand).
- Writes immer per vollem Pfad `tenants/{t}/projects/{p}/tasks/{id}` (die Web-Fallback-Suche über die
  ganze Tenant-Collection-Group wird nicht nachgebaut).
- Optimistische UI; Konflikte: Firestore-Merge pro Feld. Beschreibung (HTML, ein Feld): Wurde sie
  seit dem Öffnen woanders geändert (`updatedAt`), fragt die App vor dem Überschreiben.
- Widgets/Live Activity lesen nur den App-Group-Snapshot, aktualisiert von App und Push.

### 9.6 Qualität

- XCTest gegen Golden-Fixtures; Snapshot-Tests der PFDesign-Komponenten (Light/Dark, Dynamic Type
  XS–AX3); Kontrast-Test aller Text/Hintergrund-Paare ≥ 4,5 : 1.
- UI-Tests im Simulator gegen den Firebase-Emulator mit dem Demo-Seed aus `scripts/dev-e2e.sh`.
- VoiceOver-Labels für alle Icon-Aktionen; Dynamic Type bis AX5 ohne abgeschnittene Kerninhalte.
- Budgets: Kaltstart < 1 s bis Heute (Cache), Capture-Sheet < 150 ms.

---

## 10. Phasen

| Phase | Inhalt | Ergebnis |
|---|---|---|
| **0 · Fundament** | Backend §9.4 komplett · Logik-Extraktion + Golden-Fixtures · `ios/`-Projekt · PFDesign + Komponenten-Katalog · Spikes: Widget-Intents im App-Prozess, Share-REST-Client, Datumserkennung DE/EN, Typo 700 vs. 800 | Web läuft auf den neuen Triggern; Fixtures grün in Web + iOS |
| **1 · Taktgeber** (TestFlight) | Login (alle Methoden inkl. Apple) · Workspace-Bootstrap · Heute (Plan, Wartet auf dich, Über Nacht) · Eingang + Push-Aktionen + Server-Nudges · Aufgabendetail · Erfassen · Fokusraum + Fokus-Leiste + Live Activity · Arbeit (Liste) · Suche · Account inkl. Konto löschen | Der tägliche Loop komplett am iPhone |
| **2 · Breite** (App Store 1.0) | Projekte + Detail + Board · Initiativen/Meilensteine lesend · Woche + Drag & Drop · Widgets · Controls · Siri/Spotlight · Share Extension · Tagesabschluss · Kalender-Abgleich (opt-in) | 1.0 |
| **3 · Tiefe** | iPad · Sprint-Board · Smart verteilen · Projekt-Wizard · Finanz-Puls · on-device Zerlegung längerer Diktate (Foundation Models, ~4k-Token-Kontext) | 1.x |

## 11. Erfolgskriterien

- Erfassen vom Lock Screen bis gespeichert: Median < 3 s.
- ≥ 30 % der Zuweisungen/Erwähnungen werden direkt aus Push oder Eingang beantwortet.
- ≥ 40 % der erledigten Aufgaben aktiver Nutzer werden mobil erledigt.
- Morgen-Briefing: Öffnungsrate ≥ 25 %, Abmelderate < 10 %.
- Crash-freie Sitzungen ≥ 99,5 %; 0 Abweichungen in den Golden-Fixtures.

## 12. Offene Entscheidungen (Owner)

1. **Mindestversion iOS 26.2** (Design tragend, ~1/5 der iPhones ausgeschlossen) — ok?
2. **Sign in with Apple** auch im Web einführen? (Alternative: auf iOS nur E-Mail + Passkey + Apple,
   ohne Google/GitHub.)
3. **Empfänger von Aufgaben-Erinnerungen**: Ersteller, Zuständige oder beide?
4. **Passkey-Login ohne TOTP** — so lassen (wie Web) oder MFA nachschalten?
5. **Persönliche Aufgaben im Web-Dashboard** mitzählen (gemeinsames `dayPlan`) — ok?
6. **AA-Statusfarben** auch im Web übernehmen?
7. **Präsenz** mobil nur anzeigen oder auch setzen?

---

## 13. Kritischer Review — was sich gegenüber v1 geändert hat

Ein unabhängiger Review-Agent hat v1 gegen den Code und die iOS-Plattform geprüft. Übernommen:

- **Nebeneffekte**: v1 ging davon aus, Writes seien „nur Firestore-Updates". Tatsächlich schreibt der
  Web-Client Activity, Fortschritt und Benachrichtigungen selbst (`tasksService.ts:294-335`). → Trigger
  als Pflicht in Phase 0 (§9.4).
- **Erinnerungen** lokal auf dem iPhone hätten Web-Reminder bei geschlossener App verpasst (und iOS
  begrenzt auf 64 lokale Benachrichtigungen). → serverseitig; lokal nur Fokus-Pause.
- **Task-Abfragen** nur über `assigneeIds` wären an den Rules (`firestore.rules:329-331`), fehlendem
  Index und Legacy-Feldern gescheitert. → Abfrage mit `tenantId`, Index, Backfill, Gäste pro Projekt.
- **Fokus-Sync**: Web lädt das Profil nur einmal, Pins werden als ganzes Array überschrieben, `startedAt`
  übersteht Pausen. → Web-Listener, Array-Operationen, „seit 14:20" statt Stoppuhr.
- **Widgets/Extensions**: Widerspruch „kein Firebase im Widget" vs. „Widget erledigt Aufgaben" aufgelöst
  (Intents im App-Prozess, REST-Client in der Share Extension); erfundenes `personalTaskImports` entfernt.
- **Datumssemantik** `scheduledDate` vs. `dueDate` für Wischen und Tagesabschluss definiert; „Loslassen"
  (hätte fremde Fristen gelöscht) ersetzt durch „Aus Plan nehmen".
- **Fakten korrigiert**: Aufgabenstatus ohne „Planung", Legacy `Todo`; Tagesband kennt keinen
  Erledigt-Zustand (Partikel-Animation gestrichen); Headline deckelt bei 4 (ehrlicher Zusatz);
  persönliche Aufgaben fehlen im Web-Dashboard (bewusste Erweiterung für beide Plattformen).
- **Health** nicht portieren, sondern Server-Snapshots lesen.
- **Erfassen**: Chips statt Token-Grammatik als Haupteingabe; `!`-Kollision mit der Suche entfernt.
- **Bottom Accessory** nur für Fokus (Doppelbedeutung entfernt); iOS 26.2 nötig.
- **Kontrast**: Status-Text in AA-sicheren Tönen; `textSubtle` nie für Information; SF Pro für
  Lesetext; 700 statt 800 für Titel; Headline-Zeilenhöhe 1.18.
- **App Store**: Sign in with Apple inkl. Token-Widerruf, Konto-Löschen trotz Workspace-Eigentum,
  Privacy Manifest, keine Abrechnungslinks.
- **Weniger neue Muster**: Pull-down-Suche, langer/kurzer Linkswisch, eigenes Mikrofon, Fokus-Filter,
  Smart verteilen in v1, Foundation-Model-Zerlegung in v1 gestrichen bzw. verschoben; Tagesabschluss
  opt-in per Push statt fest um 17 Uhr.
- **Neu aufgenommen**: Server-Nudges + Morgen-Briefing, „Wartet auf dich", Eingang als Triage mit
  „Seit gestern Abend", Kalender-Abgleich (opt-in), Mehr-Workspace-Verhalten, Einladungs-Links,
  vollständige Zustände (leer, laden, offline, Fehler, Rechte verloren).

Bewusst **nicht** übernommen: Der Review schlug vor, Erfasstes in einen separaten Triage-Eingang
statt in persönliche Aufgaben zu legen. Das hätte einen dritten „Eingang"-Begriff neben Benachrichtigungen
und Arbeit erzeugt; persönliche Aufgaben erfüllen den Zweck bereits und sind fokussierbar.
