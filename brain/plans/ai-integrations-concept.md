# KI & Integrationen — Konzept (Multi-Tenant MCP für alle Nutzer)

Stand: 2026-10-23 · Status: freigegeben (alle 7 Empfehlungen), Umsetzung läuft — Fortschritt in §9 · Bestand: `brain/operations/projectflow-mcp-server.md`

## 1. Bestand (Ist-Analyse)

- **MCP-Server** `functions/src/mcp-server.ts`: Function `mcp` (Gen1, europe-west3), Hosting-Rewrite `app.getprojectflow.com/mcp`.
  Streamable HTTP, stateless, JSON-Antworten. 27 Tools rufen die REST-Routen in-process auf (`callApi`) — gleiche Validierung und Activity-Logs wie `/api/projectflow`.
  `tools/list` wird nach Token-Rechten gefiltert. Read-Tools haben `readOnlyHint`, destruktive Tools keine Annotation.
- **Auth**: nur Workspace-API-Tokens `pfat_…` (Owner-only via `createWorkspaceApiToken`, `workspace-admin.ts`), SHA-256 gehasht in
  `tenants/{t}/api_tokens`, Lookup per Collection-Group-Query (`authUtils.findApiToken`). Kein OAuth → claude.ai/ChatGPT/Claude Desktop-Connectors gehen nicht.
- **Tenant-Auflösung**: aus dem Token-Dokument (Pfad). Gut: Mismatch mit `?tenantId` → 403. Firebase-ID-Tokens gehen nur für PM-Routen und Nicht-Gäste.
- **Identität**: Token ist **nicht an einen Nutzer gebunden** — Aktionen laufen als `createdBy` (der Owner). Rolle/Mitgliedschaft des Erstellers wird nie neu geprüft.
- **Scopes**: `projects|initiatives|tasks:read|write|delete`, plus `blog:*`, `newsletter:write`, `recipients:read`; optional `projectScope` (ein Projekt). Presets in `SettingsModal.tsx` (codex-full, read-only, write-no-delete).
- **Logging/Limits**: Activity-Einträge pro Schreibaktion („via API token <Name>“), `lastUsedAt`-Write bei *jedem* Request. **Kein Rate-Limit**, kein Audit der Lesezugriffe.
- **Web**: Settings → API Keys + `McpConnectPanel` (Snippets Claude Code/Codex/Other mit Bearer-Header).
- **Plugins**: `plugins/projectflow-codex` (Python-Skript gegen REST, Token in `PROJECTFLOW_API_TOKEN`); `plugins/projectflow-team` (lokaler stdio-MCP, 9 Agent-Personas mit je eigenem `pfat_`-Token + eigener uid, Seed schreibt direkt per Admin-SDK). Beides Owner-Werkzeuge, hart auf einen Tenant/ein Projekt konfiguriert (`tokens.json`).

### Sicherheitsbefunde

| # | Schwere | Befund |
|---|---|---|
| S1 | **Kritisch** | Jeder Nutzer ist Owner seines eigenen Workspaces und kann per Callable ein Token mit `blog:write`/`blog:categories:write` erzeugen (`ALLOWED_API_PERMISSIONS`, nicht nur UI). `createBlogPost`/`manageCategories` prüfen keinen Tenant → globaler Marketing-Blog `blog_posts` beschreib-/löschbar. Sofort an Orchestrator gemeldet. |
| S2 | Hoch | Tokens sind nicht nutzergebunden: Owner verlässt Workspace / wird herabgestuft → Token arbeitet weiter, Aktionen werden ihm zugeschrieben. |
| S3 | Mittel | `findApiToken` scannt bei Indexfehler **alle Tenants** — von unauthentisierten Requests auslösbar (Kosten/DoS). Gleiches Muster in `newsletterUnsubscribe` (Projekt-Suche über alle Tenants). |
| S4 | Mittel | Kein Rate-Limit/Quota auf `mcp`/`api`; `lastUsedAt` = 1 Firestore-Write pro Call. |
| S5 | Niedrig | Destruktive Tools ohne `destructiveHint`; `projects:delete` steckt im Preset „Codex Full Access“. |
| S6 | Niedrig | Hosting-Rewrite: 60-s-Limit, kein Streaming; fein für JSON-Mode, aber nicht für SSE/Elicitation. |

## 2. Muster der großen Anbieter (Recherche)

- **Spec**: aktuelle Revision **2026-07-28** ist *stateless*: ein POST-Endpunkt, kein `initialize`/`Mcp-Session-Id`/GET-Stream mehr, Pflicht-Header `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, Origin-Prüfung.
  Elicitation läuft als Multi-Round-Trip (`resultType: "input_required"`). Viele Clients sprechen noch 2025-11-25 (`initialize`) → beide Varianten bedienen.
- **Auth-Spec**: OAuth 2.1; Server MUSS Protected Resource Metadata (RFC 9728) liefern; AS-Metadata (RFC 8414); Client-Registrierung bevorzugt
  **Client-ID-Metadata-Dokumente** (CIMD, SHOULD), **DCR ist deprecated** (nur Rückwärtskompatibilität, aber claude.ai/ChatGPT/Cursor/Gemini nutzen es noch);
  `resource`-Parameter (RFC 8707) + Audience-Prüfung Pflicht, kein Token-Passthrough; Step-up per 403 `insufficient_scope`; `tools/list` darf je Scope variieren.
- **Linear** `mcp.linear.app/mcp` (+ `/mcp/readonly`), OAuth+DCR oder API-Key als Bearer, eine Session = ein Workspace.
  **Notion** `mcp.notion.com/mcp`, OAuth; Business+ zusätzlich Workspace-Token; Gäste können nicht verbinden.
  **Atlassian** `mcp.atlassian.com/v2/mcp`, OAuth 2.1 + optional API-Token. **Asana** `mcp.asana.com/v2/mcp`, OAuth; Admins erlauben/sperren einzelne Clients.
  **GitHub** Toolsets per Pfad/Header, Read-only per `/readonly` oder `X-MCP-Readonly`. **Sentry** Scope per URL (`/mcp/{org}/{project}`).
  **Stripe** Consent wählt Konten + Rechte, Liste „OAuth sessions“ mit Widerruf (Admins auch für andere), MCP teamweit abschaltbar,
  riskante Writes brauchen Browser-Freigabe, Tool-Logs im Dashboard, wenige generische Tools.
- **Muster**: OAuth (CIMD/DCR) als Standard + Bearer-Token für Headless; Read-only als Scope *und* URL; ein Workspace pro Verbindung;
  Admin-Schalter + Client-Sperre; Sessions-Liste mit Widerruf; menschliche Bestätigung für gefährliche Writes. Rate-Limits nennt kaum jemand öffentlich.
- **Bibliotheken**: TS-SDK **v2** (`@modelcontextprotocol/server` + `/express`) implementiert 2026-07-28 und bringt Resource-Server-Helfer
  (`requireBearerAuth` mit `expectedResource` ab 2.3.0, `mcpAuthMetadataRouter`). Die AS-Seite (`mcpAuthRouter`) ist v1-Ära.
  `node-oidc-provider` ist zertifiziert, aber CIMD ist dort experimentell. `workers-oauth-provider` (Cloudflare) gibt es nur für Workers.

## 3. Zielbild & Nutzerfluss

1. **Einstellungen → „KI & Integrationen“** (pro Workspace, alle Rollen sichtbar). Kacheln je Client: Claude (claude.ai/Desktop), Claude Code, ChatGPT, Codex, Cursor, VS Code, Gemini CLI, „Anderer MCP-Client“.
2. Kachel öffnet Anleitung mit **einem** Kopier-Schnipsel bzw. One-Click-Button (Deeplink). Standard ist **OAuth ohne Secret** — nur die URL `https://mcp.getprojectflow.com/mcp`.
3. Der Client startet OAuth → Browser → `app.getprojectflow.com/oauth/consent` (Firebase-Login wie gewohnt, inkl. Passkey).
   Consent-Screen: Client-Name/Logo/Redirect-Host, **Workspace-Auswahl** (nur Workspaces, deren Policy KI erlaubt), Scope-Liste in Klartext mit „Lesen / Schreiben / Löschen“, Hinweis „handelt in deinem Namen mit deiner Rolle“.
4. Danach erscheint der Client unter **„Verbundene Apps“** (eigene + für Admins alle des Workspaces): Client, Nutzer, Scopes, verbunden am, zuletzt genutzt, **Widerrufen**.
5. **Persönliche Zugriffstokens** (`pfp_…`) für Headless/CI im selben Bereich („Erweitert“), gleiche Scopes, Ablauf Pflicht (max. 1 Jahr).
6. **Workspace-Policy** (Owner/Admin): KI-Zugriff an/aus, erlaubte Scopes (z. B. kein Löschen), PATs erlaubt ja/nein, Gäste dürfen verbinden ja/nein.

## 4. Architektur

- **Endpunkt**: `mcp.getprojectflow.com/mcp` als eigene Domain direkt auf den Cloud-Run-Dienst der Function (Gen2), ohne Hosting-Umweg (kein 60-s-Limit, Streaming möglich).
  `app.getprojectflow.com/mcp` bleibt als Alias (Hosting-Rewrite) für Bestandsnutzer.
- **Laufzeit**: Firebase Functions **Gen2** `onRequest` (= Cloud Run, Concurrency 80, `minInstances: 1`, europe-west3) — gleicher Deploy-Weg, kein separates Cloud-Run-Projekt.
  Transport **stateless Streamable HTTP** nach 2026-07-28 (SDK v2, neuer `McpServer` je Request) mit Fallback für `initialize`-Clients (2025-11-25); GET/DELETE → 405.
  Jede Anfrage trägt das Bearer-Token → horizontal skalierbar ohne Session-Store; zustandsbehaftete Abläufe (Codex-Session) über explizite Handles (`externalKey`), die bei jedem Call autorisiert werden.
- **OAuth-2.1-Autorisierungsserver** (selbst gebaut, Identität = Firebase Auth):
  - `/.well-known/oauth-protected-resource` (RFC 9728) auf der MCP-Domain; 401 mit `WWW-Authenticate: Bearer resource_metadata="…"`.
  - `/.well-known/oauth-authorization-server` (RFC 8414), `/oauth/authorize`, `/oauth/token`, `/oauth/register` (DCR), `/oauth/revoke`.
  - **CIMD** (URL als `client_id`, SSRF-sicherer Fetch mit Cache) + **DCR** für heutige Clients; PKCE S256 Pflicht; `iss` in der Antwort (RFC 9207);
    `resource` (RFC 8707) → Audience = MCP-URL, nichts anderes wird akzeptiert; `offline_access` für Refresh-Tokens (ChatGPT braucht es).
  - Redirect-URIs: exakter Abgleich; Loopback (beliebiger Port) für CLIs; unbekannte Hosts → Warnhinweis im Consent.
  - Umsetzung: **schlanker Eigenbau** (5 Endpunkte, Firestore-Storage) auf Basis der SDK-v2-Resource-Server-Helfer statt `node-oidc-provider`
    (schwer, CIMD experimentell) oder externem IdP (Kosten, zweite Nutzerbasis). Konformität per offiziellem MCP-Inspector/Conformance-Tests absichern.
- **Token-Speicher**: opake Tokens, nur SHA-256-Hash gespeichert, **Hash = Doc-ID** in Top-Level-Collections (direkter `get`, kein Collection-Group-Scan, kein Tenant-Fallback-Scan):
  - `oauth_clients/{clientId}` (Name, Logo, Redirects, Herkunft CIMD/DCR, `verified`)
  - `oauth_codes/{hash}` (60 s, einmalig, PKCE-Challenge)
  - `ai_grants/{grantId}`: `{ uid, tenantId, clientId, scopes, createdAt, lastUsedAt, revokedAt }`
  - `ai_tokens/{hash}`: `{ kind: access|refresh|pat|service, grantId, uid, tenantId, scopes, expiresAt }` — Access 1 h, Refresh 30 Tage rotierend (Wiederverwendung → ganzer Grant widerrufen), Firestore-TTL räumt ab.
  - Admin-SDK-only (Rules `false`); Listen/Widerruf über Callables.
- **Autorisierung pro Request** (eine Funktion `resolveAiPrincipal` für MCP **und** REST):
  effektive Rechte = Token-Scopes ∩ Workspace-Policy ∩ Rolle aus `tenants/{t}/members/{uid}` (live, 60 s In-Memory-Cache).
  Gast → nur Projekte mit `memberIds ∋ uid`; Mitglied entfernt → sofort tot. Actor = echter Nutzer, Activity „via Claude Code“.
- **Ein Workspace pro Verbindung** (wie Notion/Linear): kein Tenant-Parameter in Tools, kein Cross-Tenant in einer Session.
- **Limits**: In-Instanz-Token-Bucket je Token (z. B. 120 Req/min, Schreiben 30/min) + Tagesquote je Tenant (Zähler-Doc, gebündelt). 429 mit `Retry-After`. `lastUsedAt` nur alle 5 min schreiben.
- **Audit**: `tenants/{t}/ai_audit/{id}` für jeden Schreib-/Lösch-Call (Tool, Ziel-IDs, Client, uid, Ergebnis), Reads aggregiert pro Tag; TTL 180 Tage; für Owner/Admin in der UI filterbar.

## 5. Scopes & Tool-Katalog

Scopes behalten die bestehenden Namen (keine Migration nötig) und ergänzen: `comments:write`, `codex:write`, `search:read`, `offline_access`.
Rollen-Obergrenze: Owner/Admin alles; Member ohne `projects:delete`; Guest nur `*:read`, `tasks:write`, `comments:write` in eigenen Projekten. Die Rolle schlägt immer den Scope.

| Tool | Scope | Annotation | Min. Rolle |
|---|---|---|---|
| whoami (Nutzer, Workspace, Rolle, effektive Scopes) | — | readOnly | Guest |
| list_projects, get_project, list_milestones | projects:read | readOnly | Guest (eigene) |
| create_project / update_project / create_milestone / update_milestone | projects:write | — / idempotent | Member |
| delete_project | projects:delete | destructive | Admin |
| list_tasks, get_task, **search** (Projekte+Tasks+Initiativen, neu) | tasks:read / search:read | readOnly | Guest |
| create_task, update_task, complete_task, upsert_task, add/update_subtask | tasks:write | upsert/complete idempotent | Guest (eigene Projekte) |
| delete_task | tasks:delete | destructive | Member |
| list_comments / add_comment | tasks:read / comments:write | readOnly / — | Guest |
| list_activity | projects:read | readOnly | Member |
| **my_today** (Heute/Fokus, Fälligkeiten, zugewiesen — neu) | tasks:read | readOnly | Guest |
| list/get/create/update_initiative | initiatives:read/write | — | Member |
| codex_start_session, codex_checkpoint, codex_finish_session, create_followups, list_codex_sessions | codex:write / tasks:read | idempotent (externalKey) | Member |

- Alle Tools bekommen `title`, vollständige Annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint: false`) und `outputSchema`/`structuredContent` für kompakte Antworten (Token-Sparen: Summaries statt Volldokumente, `limit` mit Default 25).
- Tool-Liste wird pro Principal gefiltert (wie heute).

## 6. Client-Anleitungen (Install-Seite + In-App)

| Client | Weg | OAuth nativ |
|---|---|---|
| Claude (claude.ai/Desktop) | Einstellungen → Connectors → „Custom connector“ → URL; Team/Enterprise: Owner fügt zuerst hinzu. Callback `https://claude.ai/api/mcp/auth_callback` (+ `claude.com`) | ja (DCR/CIMD) |
| Claude Code | `claude mcp add --transport http projectflow https://mcp.getprojectflow.com/mcp`, dann `/mcp` → Login | ja |
| ChatGPT | Developer Mode → Connector hinzufügen (URL); `offline_access` anbieten | ja (DCR) |
| Codex CLI | `codex mcp add projectflow --url https://mcp.getprojectflow.com/mcp` + `codex mcp login projectflow` | ja (CIMD/DCR) |
| Cursor | One-Click `cursor://anysphere.cursor-deeplink/mcp/install?name=ProjectFlow&config=<base64 {"url":…}>` | ja |
| VS Code (Copilot) | One-Click `https://vscode.dev/redirect/mcp/install?name=projectflow&config=<json>`; oder `.vscode/mcp.json` `type: "http"` | ja |
| Gemini CLI / Antigravity | `gemini mcp add --transport http projectflow <url>` bzw. `settings.json` `httpUrl` | ja (DCR) |
| Andere / CI | URL + `Authorization: Bearer pfp_…`; ohne Remote-OAuth: `npx -y mcp-remote <url>` | — |

Zusätzlich `…/mcp/readonly` als Read-only-Endpunkt (wie Linear/GitHub) für vorsichtige Nutzer.

Öffentliche Doku-Seite `getprojectflow.com/docs/mcp` (Landing-Session) + derselbe Inhalt in der App, Schnipsel aus einer gemeinsamen Quelle (`web/config/mcpClients.ts`).

## 7. Migration ohne Bruch

1. `pfat_`-Tokens laufen unverändert weiter (Bearer auf `/mcp` und `/api`), werden in der UI als **„Workspace-Dienstkonto (Legacy)“** geführt.
2. Neue Workspace-Dienstkonten bekommen eine eigene Service-uid mit `members`-Doc (Rolle wählbar, nie Owner) — so wie `projectflow-team` es heute schon für Agenten macht. Bestehende Tokens: einmalige Migration legt pro Token eine Service-Identität an; bis dahin Actor = Ersteller, aber **Mitgliedschaft des Erstellers wird ab sofort geprüft** (behebt S2).
3. `blog:*`, `newsletter:*`, `recipients:*` aus Workspace-Tokens entfernen → eigener Plattform-Admin-Mechanismus (S1).
4. `projectflow-codex`-Plugin: akzeptiert weiter `PROJECTFLOW_API_TOKEN` (jetzt PAT empfohlen); README → OAuth-MCP als Standard.
5. `projectflow-team`: bleibt internes Owner-Werkzeug, Tokens → Service-Konten; kein Produktbestandteil.
6. `McpConnectPanel` wird durch die neue Seite ersetzt; Bearer-Snippets bleiben unter „Erweitert“.

## 8. Sicherheit

- **Least Privilege**: Default-Scopes beim Consent = Lesen + Tasks/Kommentare schreiben; Löschen opt-in, pro Workspace abschaltbar. Read-only-Modus per Client wählbar.
- **Prompt-Injection**: Tool-Ergebnisse markieren Nutzerinhalte als Daten (`<untrusted>`-Hülle in Text, Hinweis in `instructions`); keine Tools mit Außenwirkung (E-Mail, Einladungen, Freigaben, Rollenänderung) im Katalog; destruktive Tools brauchen `confirm: true` und liefern vorher eine Vorschau; Massenoperationen gedeckelt (max. 50 Elemente/Call).
- **Token-Hygiene**: kein Token-Passthrough an Drittdienste; Audience-Prüfung; Refresh-Rotation mit Reuse-Erkennung; Secret-Scanning-Präfixe (`pfp_`, `pfo_`) bei GitHub registrieren.
- **Abuse**: Rate-Limits (§4), DCR-Registrierungen pro IP begrenzt und unbenutzte Clients nach 30 Tagen gelöscht; Consent zeigt Redirect-Host; Admin kann Client workspaceweit sperren.
- **Transparenz**: Nutzer sieht alle eigenen Verbindungen; Admin alle im Workspace; E-Mail bei neuer Verbindung (optional, Notification-Prefs).

## 9. Umsetzungspakete

| Paket | Inhalt | Aufwand |
|---|---|---|
| ✅ P0 Sofort-Fixes | S1 (blog-Rechte, Web-Session `7809af7b`), S3 (Tenant-Scans raus), S2 (Ersteller-Mitgliedschaft prüfen), Annotations S5 — `7a5ef35d`, main | S |
| ✅ P1 Principal & Policy | `ai-access.ts` (Scopes ∩ Rolle ∩ Policy, Gast-Projektfilter) in `authRequest` + `/mcp`, Policy `ai_config/policy` + Callables, Rate-Limit (In-Instanz), Audit `ai_audit` (TTL 180 T), `lastUsedAt` gedrosselt. Tages-Quote je Tenant → P3 | M |
| ✅ P2 OAuth-AS | Metadata (RFC 8414/9728), CIMD+DCR, authorize/token/revoke, PKCE S256, Refresh-Rotation + Reuse-Erkennung, Consent-Seite `/oauth/consent`, PATs `pfp_`, Verbindungen listen/widerrufen — `brain/operations/projectflow-oauth.md` | L |
| P3 MCP v2 | SDK v1→v2 (Spec 2026-07-28 + Fallback), Gen2-Function, Domain `mcp.getprojectflow.com`, neue Tools (search, my_today), outputSchema, Legacy-Alias | M |
| P4 Web-UI | Consent-Screen, „KI & Integrationen“ (Client-Kacheln, Snippets, Deeplinks), Verbundene Apps, PATs, Policy, Audit-Ansicht, i18n de/en | L |
| P5 Doku | Öffentliche Install-Seite (Landing), Brain-Docs, Plugin-READMEs | S |
| P6 iOS (optional) | Liste verbundener Apps + Widerruf in den Einstellungen | S |
| P7 Listings (optional) | Claude-Connector-Verzeichnis, ChatGPT-Apps, Cursor-/VS-Code-MCP-Verzeichnisse | S |

Reihenfolge: P0 → P1 → P2+P3 parallel → P4 → P5/P6/P7.

## 10. Offene Entscheidungen (mit Empfehlung)

1. **Domain**: `mcp.getprojectflow.com` (Empfehlung) vs. nur `app.getprojectflow.com/mcp`.
2. **OAuth-AS**: schlanker Eigenbau auf Firebase Auth + SDK-v2-Helfern (Empfehlung) vs. `node-oidc-provider` vs. externer IdP (Auth0/WorkOS/Stytch, Kosten + zweite Nutzerbasis).
3. **Wer darf verbinden**: alle Rollen inkl. Gäste, begrenzt auf ihre Rechte (Empfehlung: Gäste per Policy standardmäßig **aus**).
4. **Default der Workspace-Policy**: KI-Zugriff standardmäßig **an**, Löschen-Scopes **aus** (Empfehlung).
5. **PATs**: ja, mit Pflicht-Ablauf (Empfehlung) — oder nur OAuth + Dienstkonten.
6. **Plan-Gating**: KI-Integrationen in allen Plänen (Empfehlung, Wachstumshebel) vs. nur bezahlte Pläne; Limits je Plan.
7. **Legacy `pfat_`**: Abschaltdatum festlegen (Empfehlung: 6 Monate nach P4, mit In-App-Hinweis).
