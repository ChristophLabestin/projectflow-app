# Landing: Sektionen nach der Story (Vorschlag v2, 2026-10-24)

Befund (Owner): Die fünf Story-Akte tragen, danach wirkt die Seite „lackluster“ – sechs statische Blöcke, die nur
einblenden. Ziel: Die Story-Sprache (dieselben Karten, echte UI, scroll-gekoppelt) läuft bis zum Ende weiter, jede
Sektion hat genau einen „Moment“. Ruhig, hochwertig, keine Effekte um der Effekte willen; `prefers-reduced-motion`
bekommt statische Endzustände (wie die Story).

## Sektionen

1. **Für wen** (heute: Rollen-Grid) → **„Ein Board, viele Rollen“**: gepinnte Bühne, links Rollen-Tabs (Produkt,
   Entwicklung, Design, Marketing, Freelance), rechts dasselbe Board aus der Story; beim Scrollen sortieren sich die
   Karten pro Rolle um (Filter, Labels, Ansicht), Text wechselt mit. Wiederverwendung von Karten/Geometrie aus
   `storyScene`.
2. **Apps** → **„Eine Aufgabe, drei Geräte“**: eine Aufgabe wandert beim Scrollen vom Desktop-Fenster (Shortcut-Overlay
   ⌃⌘N) aufs iPhone (Heute-Liste) und landet als Live-Aktivität/Widget auf dem Sperrbildschirm. iPhone in echten
   Proportionen.
3. **KI & MCP** → **„Gesagt, getan“**: links ein Chat (Claude/ChatGPT/Codex), der beim Scrollen den Prompt tippt,
   rechts das Board, auf dem die Aufgabe live erscheint, Priorität setzt, im Verlauf „via MCP“ protokolliert.
   Rechte-Badge („nur Lesen / Schreiben“) als Vertrauensmoment.
4. **Funktionen** → **Bento-Grid mit lebendigen Kacheln**: jede Kachel zeigt ihre Mini-UI und spielt sie beim
   Erscheinen einmal ab (Unteraufgaben haken sich ab, Sprint-Balken füllt sich, Passkey-Ring schließt sich,
   Verlauf schreibt sich). Hover: leichtes Tilt + Spotlight.
5. **Preise** (neu gebaut) → Zahlen zählen beim Erscheinen hoch, Team-Spalte hebt sich kurz an.
6. **FAQ** → zweispaltig: links Überschrift + „Frage nicht dabei? hello@…“, rechts Akkordeon mit weicher Höhe.
7. **Abschluss-CTA** → **„Alles an einem Ort“**: die Karten der Story fliegen ein letztes Mal zusammen und werden zum
   Logo; darunter „Kostenlos starten“. Schließt den Bogen zum Hero („Rauschen“ → Ordnung).

Querschnitt: Sektionsüberschriften mit derselben Wort-Einblendung wie der Hero; eine dünne Fortschrittslinie im
Header über die ganze Seite; einheitliche Abstände (eine Rhythmus-Skala).

## Technik

- GSAP + ScrollTrigger wie die Story; jede Szene als eigene Funktion in `src/js/home.ts` (oder `src/js/scenes/*`).
- Gepinnte Szenen nur ≥ 900 px; mobil kurze, nicht gepinnte Varianten (eine Animation pro Sektion beim Erscheinen).
- Performance-Budget: keine zusätzlichen Libraries, Bilder nur als SVG/HTML-UI, Lighthouse bleibt bei 100.

## Überarbeitung nach kritischem Review (2026-10-24, umgesetzt)

Verdikt: „ja, mit Änderungen“. Zu viele gepinnte Szenen hintereinander (Scroll-Müdigkeit), Wiederholung der Story
(Board, Geräte), fehlender Vertrauensblock, Preise dürfen nicht animieren. Umgesetzt wird:

- Reihenfolge: Story → Für wen → KI & MCP → Apps → Funktionen → Vertrauen (neu) → Preise → FAQ → Abschluss.
- Genau **eine** weitere gepinnte Szene: KI & MCP (≥ 900 px, scrubbed: Prompt tippt → Tool-Aufruf → Karte landet →
  „via MCP“-Protokoll → Rechte-Badge). Alles andere frei scrollend oder einmal beim Erscheinen.
- Für wen: Rollen-Tabs (echte Tabs, Pfeiltasten), rechts vorgerenderte Mini-Boards je Rolle, Crossfade; Klick + sanftes
  Auto-Weiterschalten beim Durchscrollen (nicht bei reduced motion).
- Apps: kompakt, Story zeigt das iPhone schon; bestehende Szene bleibt, nur dezente Parallaxe.
- Funktionen: Bento mit Mini-UIs, die einmal abspielen; Endzustand ist statisches HTML/CSS.
- Vertrauen: ruhiger Streifen mit echten Fakten (Daten in der EU, Passkeys & Rollen, Export, Made in Germany) –
  keine erfundenen Testimonials.
- Preise: unverändert ruhig, keine hochzählenden Zahlen. FAQ: natives `<details>`, zweispaltig.
- Abschluss: Karten fliegen frei (ohne Pin) zum Logo zusammen; mobil einfaches Einblenden.
- Gestrichen: Fortschrittslinie, Wort-Einblendung überall, Drei-Geräte-Reise, Preis-Count-up.
