# Landing Page Concept v4 – „Vom Rauschen in den Flow“

Status: 2026-10-23, Neustart (v1–v3 verworfen). Seite: `landing/` (getprojectflow.com). Technik, Legal-API,
MCP-Doku und Hosting bleiben; Startseite, Inhalte und Motion werden neu gebaut.

## Kernidee
Die Seite erklärt das Produkt nicht in Abschnitten, sie **führt es vor**: Die Arbeit des Besuchers ordnet sich
beim Scrollen selbst. Dieselben ~14 Aufgaben-Karten (glaubwürdige Titel) durchlaufen auf einer einzigen Bühne die
Zustände, die ProjectFlow wirklich hat: verstreut → Inbox → Board → Fokus → erledigt → im Team → auf allen Geräten.
Jede Bewegung ist ein Produktzustand, keine Deko. Der Besucher sieht Ordnung entstehen.

Positionierung: das ruhige, präzise Werkzeug für Teams, die liefern. Ton: knapp, sachlich, selbstbewusst; keine Zahlen
oder Features, die es nicht gibt.

## Die Story-Bühne (ein gepinnter Viewport, 7 Akte, Scroll = Zeitachse)
Volle Viewporthöhe, immer voll mit Inhalt – jeder Scrollpixel verändert sichtbar etwas (Lehre aus v1: kein leerer Scrollweg).
Aktkopf (Nummer, Titel, ein Satz) mit Crossfade; Akt-Navigation (7 Punkte, klickbar = Sprung).
„Story überspringen“-Link für Tastatur/Eilige.

| Akt | Bild | Botschaft |
|---|---|---|
| 0 Rauschen (Hero) | Karten, Notizen, Mails, Chat-Fetzen schweben verstreut, leicht rotiert, auf Punktraster; weichen dem Cursor aus. Headline + CTAs darüber. | „Alles, was zu tun ist. Endlich an einem Ort.“ |
| 1 Erfassen | Scroll zieht alle Fragmente wie Magnete in eine saubere Inbox-Liste; Rotation → 0. | Quick Capture, Teilen-Menü, Web – alles landet in der Inbox. |
| 2 Ordnen | Die Liste fächert sich in ein Board mit 4 Spalten (Offen, In Arbeit, Review, Erledigt); Status-Farben blenden ein. | Projekte, Boards, Initiativen. |
| 3 Fokus | Kamera zoomt auf eine Karte; Umgebung dimmt, Bühne wird dunkel (Fokusmodus); Karte wird zum Fokus-Panel mit laufender Uhr. | Eine Sache. Volle Aufmerksamkeit. |
| 4 Erledigt & gemeinsam | Häkchen, Karte fliegt in „Erledigt“; Avatare erscheinen auf Karten, Benachrichtigungen treffen ein. | Abhaken – das Team ist im Bild. |
| 5 Überall | Board im Browserrahmen mit Geräte-Umschalter (Web · Desktop · iPhone); Karten sind anklickbar; CTA. | Eine Datenbasis, drei Apps. |

Technik: Karten sind absolut positionierte DOM-Elemente; je Akt berechnet JS Zielpositionen aus der Bühnengröße
(Chaos aus festem Seed). Ein GSAP-Master-Timeline (ScrollTrigger pin + scrub) interpoliert nur transform/opacity.
Layouts bei Resize neu (`invalidateOnRefresh`). Mobil: gleiche Story, vereinfachte Layouts (Liste 1-spaltig,
Board 2 Spalten, weniger Karten, Akt 6 = Browser + iPhone).

## Überarbeitung nach kritischem Review (2026-10-23)
- **6 statt 7 Akte**: „Erledigt“ und „Gemeinsam“ zusammengelegt. Scroll-Budget: Hero 1 vh (= Akt 0, Bühne beginnt oben),
  Akte 1–5 je 0,8–1 vh → Pin gesamt ≈ 4,6 vh Desktop, ≈ 3,4 vh mobil. Pro Akt genau eine Zustandsänderung + kurzer Haltepunkt.
- **Kein Snap, kein Smooth-Scroll**, `scrub: 0.5`; Akt-Navigation springt per scrollTo. `ignoreMobileResize`, Bühne in `svh`.
- **Erste 5 Sekunden**: H1 + Kategorie-Zeile („Projektmanagement für Teams …“) + 2 CTAs + „Web · Desktop · iPhone“ im ersten Viewport;
  Header-CTA bleibt immer sichtbar; CTA erneut im letzten Akt und am Schluss.
- **Heldenkarte** „Angebot an Nordlicht senden“ trägt die Geschichte durch alle Akte; mobil nur 8 Karten.
- **Semantik zuerst**: Akt-Texte als echte Überschriften in fester DOM-Reihenfolge, Karten `aria-hidden`; Akt-Nav als `<nav>` mit `aria-current`.
  Ohne JS/bei reduced motion: Akte als Liste + Board als statische Illustration (CSS-Grid, kein JS nötig).
- **Kein Blur**: Fokus-Dimmung über Overlay-Opacity. Karten bewegen sich nur per transform; Größenwechsel als Skalierung kleiner Elemente.
- **Letzter Akt = die Seite wird zur App**: Board im Browserrahmen, Karten anklickbar (abhaken), CTA daneben.
- **MCP als eigene Szene** statt Logo-Band: ein Agent ruft `upsert_task` auf, die Karte erscheint im Board.

## Nach der Story (Stand 2026-10-23, erweitert)
Reihenfolge: Für wen (Agenturen, Produktteams, Gründer:innen) → Apps (Desktop-Kürzel, iPhone) → KI & MCP-Szene →
Funktionen → Preise (geplant, Monat/Jahr-Umschalter; Quelle `brain/plans/pricing-strategy.md`) → FAQ → CTA.

### Ursprüngliche Planung
1. **Mehr als Aufgaben** – Bento mit echten UI-Fragmenten: Task-Workbench, KI-Assistenz (OpenAI), Initiativen & Sprints,
   Passkeys & 2FA, Daten in der EU. Kacheln reagieren auf Cursor (Licht).
2. **Deine KI arbeitet mit** – MCP-Band: Claude, ChatGPT, Codex, Cursor, VS Code, Gemini CLI; Link `/docs/mcp`.
3. **FAQ** (6 Fragen) · 4. **Schluss-CTA** · Footer.

## Visuelle Sprache
- App-Tokens (monochrom, Plus Jakarta Sans), Punktraster als „Leinwand“; Akzentfarben nur als Status/Prioritäten.
- Licht → Dunkel → Licht als Dramaturgie (Fokus = dunkel). Große, ruhige Typo; Aktnummern in Mono.
- Kein Stockfoto, keine generierten Bilder; alles ist echtes, gerendertes UI.

## Motion-Regeln
- Easing/Dauern aus den Motion-Tokens (expo.out, 150/300/600/900 ms). Story: `scrub: 0.8`.
- Nur transform/opacity (+ blur max. 4px auf wenigen Elementen im Fokus-Akt).
- `prefers-reduced-motion` oder kein JS: Story wird zu 7 statischen Akt-Blöcken untereinander.
- Ziel 60 fps auf Mittelklasse-Laptop; ≤ 16 bewegte Karten.

## Qualität
Lighthouse ≥ 90 (Ziel 100) mobil/desktop, WCAG AA (gedimmte Zustände ≥ 3:1 bei großer Schrift), Tastatur
(Skip-Story, Akt-Navigation per Tab), 360 px bis Ultrawide, DE/EN mit hreflang.

## Legal & Doku
Rechtstexte über die Legal-API der App (`LEGAL_SOURCE = 'api'`); MCP-Doku `/docs/mcp` bleibt.
