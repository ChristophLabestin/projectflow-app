# Landing Page Concept (getprojectflow.com)

Status: 2026-10-23, in Umsetzung (`landing/`). Ersetzt `brain/reference/app/LANDING_PAGE_BRIEF.md` (veraltet: Social/Marketing-Suite).

## Positionierung
- Zielgruppe: Teams im digitalen Sektor (Produkt, Engineering, Design, Growth), Gründer, Freelancer.
- Kernaussage: ProjectFlow ist das ruhige, präzise Werkzeug für die Umsetzung. Alles, was zu tun ist,
  landet an einer Stelle, wird sortiert, fokussiert erledigt, und das Team sieht, wo es steht.
- Ton: sachlich, knapp, selbstbewusst. Keine Superlative, keine erfundenen Zahlen, keine Preise
  (Pläne sind noch nicht öffentlich bepreist). Nur Features, die im Produkt existieren.
- H1 DE „Ruhe im Projekt. Tempo in der Umsetzung.“ / EN „Calm projects. Fast execution.“

## Abschnittsfolge
1. **Nav** (sticky, frosted ab Scroll > 8 px): Logo, Produkt, Plattformen, Sicherheit, DE/EN, Login, „Kostenlos starten“.
2. **Hero**: Headline Wort für Wort, Subline, 2 CTAs (magnetisch). Darunter das App-Fenster
   (Sidebar + Heute-Ansicht) in Perspektive (rotateX 22° → 0° beim Scrollen), drei schwebende
   Fragmente auf eigenen Tiefen (Benachrichtigung, Fokus-Timer, abgehakte Aufgabe). Cursor kippt
   das Fenster um max. 3°.
3. **Scroll-Story „Der Weg einer Aufgabe“** (pinned, 4 Schritte): Erfassen (Inbox / Quick Capture)
   → Planen (Heute) → Fokus (Timer läuft) → Erledigt (Checkbox, Projekt-Fortschritt steigt).
   Links Schritttext mit Fortschrittsleiste, rechts die Bühne, auf der eine Karte wandert.
4. **Board füllt sich** (scrubbed): Spalten Backlog/Offen/In Arbeit/Review/Erledigt, Karten fallen
   gestaffelt ein, Fortschrittszähler zählt hoch. Text: Projekte, Boards, Initiativen, Sprints.
5. **Task-Workbench**: Detail-Fragment mit Unteraufgaben (abhaken), Beziehungen (blockiert von /
   verwandt), Aktivität. Hover hebt Beziehungslinien hervor.
6. **Notification Center**: Meldungen treffen gestaffelt ein, Gruppen Heute/Gestern, Ungelesen-Zähler.
7. **KI-Assistenz**: Zusammenfassung/Unteraufgaben-Vorschlag tippt sich, klar als Assistenz markiert.
8. **Teams & Sicherheit**: Workspaces mit Rollen (Owner/Admin/Member/Gast), externe Projekt-Mitwirkende,
   Passkey-Login, Zwei-Faktor (TOTP), Google/GitHub. Passkey-Prompt als Fragment.
9. **Plattformen**: Web, Desktop (macOS/Windows: Quick Access, Menüleiste/Tray, Badges),
   iPhone (Widgets, Live Activity, Teilen) inkl. iPhone Duo. Geräte-Trio mit Parallax.
10. **Schluss-CTA** + **Footer** (Produkt, Plattformen, Rechtliches, Sprache, ©).
Unterseiten: Impressum, Datenschutz, AGB (DE/EN), 404.

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
