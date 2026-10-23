# Landing Page Concept (getprojectflow.com)

Status: 2026-10-23, in Umsetzung (`landing/`). Ersetzt `brain/reference/app/LANDING_PAGE_BRIEF.md` (veraltet: Social/Marketing-Suite).

## Positionierung
- Zielgruppe: Teams im digitalen Sektor (Produkt, Engineering, Design, Growth), Gründer, Freelancer.
- Kernaussage: ProjectFlow ist das ruhige, präzise Werkzeug für die Umsetzung. Alles, was zu tun ist,
  landet an einer Stelle, wird sortiert, fokussiert erledigt, und das Team sieht, wo es steht.
- Ton: sachlich, knapp, selbstbewusst. Keine Superlative, keine erfundenen Zahlen, keine Preise
  (Pläne sind noch nicht öffentlich bepreist). Nur Features, die im Produkt existieren.
- H1 DE „Ruhe im Projekt. Tempo in der Umsetzung.“ / EN „Calm projects. Fast execution.“

## Abschnittsfolge (v3, 2026-10-23 – dicht, aber mit Scroll-Szenen ohne Leerlauf)
Jede Sektion = Kopf (Titel links, Text rechts) + ein dichter Inhaltsblock; Abstand nur über `--section-space`.
1. **Hero**: Headline, Lead, 2 CTAs, App-Fenster (Heute) sichtbar über dem Fold, 2 schwebende Fragmente,
   darunter ein Proof-Streifen (Heute & Fokus · Projekte & Boards · Teams & Rollen · Web/Desktop/iPhone).
2. **Statement**: großer Satz, Wörter leuchten beim Scrollen nacheinander auf (gedimmt ≥ 3:1 Kontrast).
   **So arbeitest du** (`#flow`): Desktop = gepinnte Horizontal-Szene, 4 Panels gleiten seitlich, Fortschrittsleiste, Mini-UI startet je Panel;
   Mobil = gestapelte Panels. Jedes Panel füllt den Viewport – kein leerer Scrollweg.
3. **Funktionen** (`#features`): Bento-Grid (Kacheln steigen gescrubbt aus der Tiefe, Cursor-Spotlight) – Board (groß), Workbench, Notification Center, KI-Assistenz, Initiativen & Sprints.
4. **Teams & Sicherheit** (`#security`, dunkles Band, Hell→Dunkel-Übergang beim Scrollen, Cursor-Lichtkegel): Rollenliste, Passkey-Prompt, 4 Punkte.
5. **Plattformen** (`#platforms`): 3 Karten (Web, Desktop, iPhone) + Integrations-Streifen (MCP-Clients → `/docs/mcp`).
6. **FAQ** (`#faq`), 7. **CTA**, Footer. Unterseiten: Rechtsseiten (Legal-API), `/docs/mcp`, 404.

## Motion-System (Tokens in `landing/src/styles/_motion.scss`, gespiegelt in `src/js/motion.ts`)
| Token | Wert | Einsatz |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Standard (identisch zur App) |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Zustandswechsel in Szenen |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | nur Microfeedback (Checkbox, Badge) |
| `--dur-1/2/3/4` | 150 / 300 / 600 / 900 ms | Hover / UI / Reveal / Hero |
| `--stagger` | 60 ms | Listen, Wörter, Karten |
| `--rise` | 24 px | Einblend-Versatz |
Regeln: nur `transform`/`opacity` (plus `clip-path` für Reveals), nie Layout-Properties. Bewegung erklärt
einen Zustandswechsel. Scroll-Szenen sind `scrub`-gekoppelt (rückwärts lesbar). Parallax max. ±80 px.

## Technik
- Eigenes Verzeichnis `landing/` mit Vite (Vanilla TS + SCSS, kein Framework → ~0 KB Runtime).
- HTML wird zur Build-Zeit aus TS-Templates + Sprachdateien gerendert (Vite-Plugin), also statisches,
  crawlbares HTML pro Sprache: `/` (DE), `/en/`, `/impressum`, `/datenschutz`, `/agb`,
  `/en/imprint`, `/en/privacy`, `/en/terms`, `404.html`. `hreflang` + canonical je Seite.
- Animation: GSAP + ScrollTrigger (pin/scrub robust, ~30 KB gz, nur auf der Startseite, nach
  First Paint geladen). Kein Smooth-Scroll-Hijacking (natives Scrollen bleibt barrierearm).
- Tokens: `_tokens.scss` der App ist Quelle; `landing/src/styles/_tokens.scss` übernimmt Farben,
  Radien, Schatten, Status-/Prioritätsfarben 1:1. Schrift Plus Jakarta Sans selbst gehostet (variable).
- `prefers-reduced-motion`: kein GSAP-Setup, alle Inhalte im Endzustand, Pins aus.
- Hosting: eigene Firebase-Hosting-Site im Projekt `projectflow-labestin` mit eigener
  `landing/firebase.json` (berührt die App-Konfiguration nicht). Deploy erst auf Preview-Channel.

## Legal-Plan
- Einzige Quelle ist das versionierte Rechtsdokumente-System der App (Firestore, `/admin/legal`).
- Aktualisierte Texte liegen als Entwurf in `legal/<type>.<lang>.md` (+ `.summary.`), Import per
  `node functions/scripts/import-legal-docs.mjs`, Veröffentlichung durch den Owner.
- Landing: `LEGAL_SOURCE = 'app-link'` verlinkt auf `app.getprojectflow.com/legal/<type>`; mit `'api'`
  rendert sie eigene Seiten aus `GET /api/legal/<type>?lang=` (Umschalten = eine Zeile + Build).
- Landing selbst: keine Cookies, kein Tracking, keine Drittanbieter-Requests.

## Qualitätsziele
Lighthouse ≥ 90 in allen vier Kategorien (mobil + desktop), WCAG AA, 360 px bis Ultrawide,
Tastatur vollständig, kein CLS durch Animationen.
