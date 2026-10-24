# Admin-Konsole — Konzept (2026-10-23)

Eigenständige Plattform-Admin-Konsole für ProjectFlow. Ersetzt `/admin*`, `/insights/onboarding` und
den Plattform-Blog-Zugang in der Web-App. Gleiche Firebase-Datenbank und Auth (`projectflow-labestin`),
Zugang ausschließlich für den Plattform-Admin.

## Architektur

- `admin/`: Vite + React 19 + TS + SCSS, eigenes Bundle, Dev-Port 3141, eigene Hosting-Site
  `projectflow-admin` (`admin/firebase.json`, Muster wie `landing/`), später `admin.getprojectflow.com`.
- Design-Basis wird geteilt, nicht kopiert: Sass-`loadPaths` auf `web/styles` (`_tokens.scss`), Vite-Aliase
  `@pf/brand` → `web/components/brand`, `@pf/motion` → `web/components/motion` (`resolve.dedupe` für React).
- Header: strikte CSP (erzwungen, nicht Report-Only), `X-Robots-Tag: noindex, nofollow`, `robots.txt` Disallow,
  `X-Frame-Options: DENY`, kein Google-Fonts-CDN (Plus Jakarta Sans self-hosted, Icons `lucide-react`).
- Backend: **ein** Gateway-Callable `adminApi` (`functions/src/admin-console/`). Er erwartet
  `{ action, params, sessionId }`, führt Gate → Handler → Audit aus. Die Handler sind reine Module je Bereich
  (`crashes`, `legal`, `onboarding`, `blog`, `overview`, `users`, `ai`, `system`, `audit`).
  Ein Eintrittspunkt bedeutet: eine Prüfkette, ein Audit, ein Deploy-Ziel.

## Auth-Kette (jede Stufe serverseitig)

1. Firebase-Login in der Konsole: Google oder E-Mail/Passwort. Passkeys der App sind an den RP
   `app.getprojectflow.com` gebunden und gelten auf einer anderen Subdomain nicht, deshalb gibt es in der Konsole keinen Passkey-Login.
2. Zweiter Faktor ist Pflicht: Das ID-Token muss `firebase.sign_in_second_factor` (TOTP) tragen. Ohne
   eingerichteten Faktor zeigt die Konsole nur die TOTP-Einrichtung, aber keine Daten.
3. Claim `platformAdmin === true`.
4. Serverseitige Allowlist `platform_admins/{uid}` (`email`, `active`), E-Mail muss zum Token passen. Gepflegt
   per `functions/scripts/grant-platform-admin.mjs`. Rules: kein Client-Zugriff.
5. Token-Widerruf: `verifyIdToken(raw, checkRevoked=true)` bei jedem Aufruf.
6. Admin-Session `admin_sessions/{uid}`: `session.start` braucht einen frischen Login (`auth_time` ≤ 10 min),
   Leerlauf-Ablauf nach 30 min serverseitig, absolut nach 12 h. Der Client meldet sich nach 15 min Inaktivität ab.
7. Audit `admin_audit/{id}`: `{ at, uid, email, action, target, summary, ok, error, ip, userAgent, sessionId }`.
   Protokolliert werden alle Mutationen, Session-Start und -Ende, abgelehnte Aufrufe und sensible Reads
   (Nutzerdetail, Export).
- Rules: `platform_admins`, `admin_sessions`, `admin_audit`, `admin_config` sind dicht. `crashIssues` und
  `legal_documents/*/drafts` sind für Clients nicht mehr lesbar, nur noch über `adminApi`.
- Emulator: Die Auth-Emulation kennt kein TOTP. Nur bei `FUNCTIONS_EMULATOR=true` zählt deshalb der
  Custom-Token-Claim `adminMfaTest` als zweiter Faktor (für E2E-Tests).

## Module (Priorität und Begründung)

| P | Modul | Inhalt | Warum |
|---|-------|--------|-------|
| 1 | Shell | Login, Gate, Navigation, ⌘K-Palette, Tastatur (g+x), Dark Mode, Audit-Log | Sicherheit und Bedienbarkeit tragen alles andere |
| 2 | Crashes | Gruppen, 14-Tage-Trend, Plattform-/Release-/Statusfilter, Stack, Events, betroffene Installationen | heute schon im Einsatz, höchster Betriebsnutzen |
| 2 | Rechtsdokumente | Übersicht, Entwurf, Diff zur aktuellen Version, Veröffentlichen, Zustimmungsquote | Umzug aus der App, Pflicht |
| 2 | Onboarding | bestehende Statistik schöner | Umzug |
| 2 | Blog | Plattform-Blog `blog_posts`/`blog_categories`, Newsletter-Liste + CSV | Umzug aus dem Token-API-Weg |
| 3 | Übersicht | KPIs (Nutzer, DAU/WAU/MAU, Signups, Workspaces, Projekte, Aufgaben, Crashes, KI), Sparklines, Zeitraum | Gesamtbild |
| 3 | Nutzer & Workspaces | Suche, Detail-Drawer (Auth, Mitgliedschaften, Geräte, Zustimmungen, KI), Support-Aktionen | Support |
| 4 | KI & MCP | Nutzung und Kosten je Workspace, Verbindungen, OAuth-Clients | Kostenkontrolle |
| 4 | System | Ankündigungsbanner, Feature-Flags, Scheduled Functions, Versionen | Betrieb |

Support-Aktionen (Bestätigungsdialog + Audit): Sessions widerrufen (`revokeRefreshTokens`), KI-Verbindung
trennen, Workspace sperren/freigeben, Datenexport anstoßen. Kein Impersonieren ohne Rückfrage beim Orchestrator.

**Nicht umgezogen:** Das Projekt-Modul „Marketing“ (`/project/:id/marketing`). Es ist ein Kunden-Feature
(externe Blogs per Integration) und kein Plattform-Admin-Werkzeug. Es bleibt in der App.

## UI

Desktop-first, dicht (Linear/Vercel/Stripe): Sidebar mit Gruppen, Topbar mit Breadcrumb, Suche (⌘K),
Session-Countdown, Theme-Schalter. Tabellen-Primitive `DataTable` (Sortieren, Filtern, Spaltenauswahl,
CSV-Export, j/k-Navigation, Enter öffnet den Drawer). Detail-Drawer rechts, `Sparkline`/`AreaChart`/`BarList`
als eigene SVG-Komponenten (keine Chart-Bibliothek, CSP-freundlich). Tokens aus `web/styles/_tokens.scss`,
Akzent = Brand-Mark und Status-Dots.

## Reihenfolge

1. Gerüst, Auth-Kette, `adminApi` + Gate-Unit-Tests, Rules + Rules-Tests, Audit, Hosting-Site.
2. Umzug von Crashes, Legal, Onboarding und Blog. Entfernen aus `web/`, `/admin*` und `/insights/onboarding` leiten auf die Konsole um.
3. Übersicht, Nutzer & Workspaces.
4. KI & MCP, System, Feinschliff.

## Stand 2026-10-23

Pakete 1–4 live inkl. Workspace-Sperre (`tenants/{id}.suspendedAt`, PERMISSIONS.md), Ankündigungsbanner (`platform_config/announcement`, Web/Desktop `components/platform/PlatformAnnouncement.tsx`) und Steuerung der In-App-KI über deren eigene Felder (`ai_config/policy.inAppAi|inAppEnabled|monthlyCredits`, `ai_credits`; kein eigenes Flag-Dokument). Review-Konto (`reviewAccount`/`isReviewAccount`) zählt nirgends. iOS-Vertrag für Sperre und Banner: Notiz `admin-console-ios-contract.md` im Orchestrator-Notizordner. Ziel-Domain `admin.getprojectflow.com` (Checkliste `brain/operations/domains-setup.md` D).

## Betrieb

- Dev: `npm --prefix admin run dev` (Port 3141; `.env.local` mit `VITE_FIREBASE_*` wie `web/`).
- Deploy: `npm --prefix admin run build && (cd admin && firebase deploy --only hosting --project projectflow-labestin)`.
- Domain: In der Firebase-Konsole unter Hosting → Site `projectflow-admin` → „Benutzerdefinierte Domain“
  `admin.getprojectflow.com` hinzufügen und die DNS-Einträge (TXT/A) beim Registrar setzen. Danach die Domain unter Auth →
  Settings → „Autorisierte Domains“ eintragen und beim Google-OAuth-Client die Redirect-URI
  `https://admin.getprojectflow.com/__/auth/handler` ergänzen.

## Admin-MCP (2026-10-24)

Eigener MCP-Server nur für den Plattform-Admin, getrennt vom Nutzer-MCP (`/mcp` auf app.getprojectflow.com).
- **Endpoint/Resource:** `https://admin.getprojectflow.com/mcp` (Fallback `https://projectflow-admin.web.app/mcp`), Hosting-Rewrites
  der Site `projectflow-admin` → Functions `adminMcp` (MCP) und `adminOAuth` (`/.well-known/oauth-authorization-server`, `/oauth/authorize|token|register|revoke`).
  Issuer = Konsolen-Host. Code: `functions/src/admin-console/mcp/`.
- **Getrennte Datenhaltung:** `admin_mcp_clients`, `admin_mcp_requests`, `admin_mcp_codes`, `admin_mcp_grants`, `admin_mcp_tokens`,
  `admin_mcp_pending` (Rules: dicht). Token-Präfixe `pfa_` (Access, 15 min) / `pfar_` (Refresh, rotierend, Grant max. 7 Tage).
  Nutzer-MCP-Tokens (`pfo_`/`pfp_`, `ai_tokens`) werden hier nie gefunden und umgekehrt; Audience wird zusätzlich geprüft.
- **Clients:** DCR nur mit Redirect-URIs aus der Allowlist (Loopback beliebiger Port = Claude Code, `https://claude.ai|claude.com/api/mcp/auth_callback`).
  Neue Clients sind `pending`, bis der Admin sie in der Konsole freigibt (auch direkt auf der Consent-Seite). Kein CIMD.
- **Consent** `/oauth/consent?request=…` in der Konsole: volle Konsolen-Kette (Claim, Allowlist, TOTP, Session) **plus** frische
  Re-Authentifizierung mit TOTP (`auth_time` ≤ 5 min) direkt vor der Freigabe. Scopes `admin:read`, optional `admin:write`.
- **Bei jedem MCP-Request:** Kill-Switch `admin_config/mcp.enabled` (Default aus), Token gültig + Audience, Grant aktiv und < 7 Tage,
  Client freigegeben, Nutzer hat Claim, Allowlist aktiv mit passender E-Mail, keine Token-Widerrufe nach Grant-Erstellung,
  Rate-Limit 60/min. Jeder Werkzeugaufruf → `admin_audit` (`mcp:<tool>`).
- **Werkzeuge:** lesend über dieselben `adminApi`-Handler (Übersicht, Nutzer, Workspaces inkl. Billing/Flows, Crashes, KI, System, Audit).
  Schreibend (`destructiveHint`): Sperre, Banner, In-App-KI-Rollout/Policy, Exempt, Speicher-Override, Crash-Status. Erster Aufruf legt
  `admin_mcp_pending` an und liefert keine Wirkung; der 6-stellige Code steht nur in der Konsole (Admin-MCP → Ausstehend). Zweiter Aufruf
  mit `confirmationCode` führt aus. Nichts löscht Daten endgültig. E-Mail an den Admin bei neuer Verbindung und jeder ausgeführten Schreibaktion.
