# Domains setup — getprojectflow.com, www, mcp

Date: 2026-10-23 · Firebase project `projectflow-labestin` · Done by the user (DNS provider + Firebase Console).

| Domain | Firebase Hosting site | Config | Serves |
|---|---|---|---|
| `getprojectflow.com` | `getprojectflow` | `landing/firebase.json` | Landing page incl. `/docs/mcp` |
| `www.getprojectflow.com` | `getprojectflow` | — | Redirect → `https://getprojectflow.com` |
| `mcp.getprojectflow.com` | `projectflow-labestin` (app site) | root `firebase.json` (rewrites `/mcp`, `/.well-known/oauth-*`) | MCP endpoint `https://mcp.getprojectflow.com/mcp` |
| `app.getprojectflow.com` | `projectflow-labestin` | root `firebase.json` | App, OAuth issuer, consent (already live — do not touch) |

## Current state (checked 2026-10-23)
`getprojectflow.com` and `www` already resolve to Firebase Hosting (`199.36.158.100`) but answer `404` — the domain is attached to a site without that content (or a stale one). So for A) the A records are already right: mainly re-attach the domain in the Console (step 6 first). `mcp.getprojectflow.com` has no DNS record yet.

## A) getprojectflow.com + www → landing site
1. Firebase Console → **Hosting** → site **getprojectflow** → **Add custom domain** → `getprojectflow.com` → leave "Redirect" off → Continue.
2. At the DNS provider create what the wizard shows. Expected: a **TXT** record on `@` (ownership, `hosting-site=getprojectflow`) and **A** record(s) on `@` (typically `199.36.158.100`). Remove old A/AAAA/ALIAS records on `@` that point elsewhere (old site/parking), otherwise the certificate fails.
3. Same site → **Add custom domain** → `www.getprojectflow.com` → tick **"Redirect www.getprojectflow.com to an existing website"** → target `getprojectflow.com`. DNS: what the wizard shows (typically **A** `www` → `199.36.158.100`, or the given **CNAME**).
4. Wait for "Connected" (minutes to a few hours; certificate is automatic).
5. Check:
   ```bash
   curl -sI https://getprojectflow.com/docs/mcp | head -n 1
   ```
   ```bash
   curl -sI https://www.getprojectflow.com | rg -i '^(HTTP|location)'
   ```
   Expect `HTTP/2 200` and a `301` with `location: https://getprojectflow.com/`.
6. If `getprojectflow.com` was attached to the app site `projectflow-labestin` before, remove it there first (a domain can only belong to one site).

## B) mcp.getprojectflow.com → app site
1. Firebase Console → **Hosting** → site **projectflow-labestin** → **Add custom domain** → `mcp.getprojectflow.com` → no redirect.
2. DNS as shown by the wizard: typically **TXT** on `mcp` (`hosting-site=projectflow-labestin`) and **A** `mcp` → `199.36.158.100`.
3. Wait for "Connected".
4. Check (expect `401` with `resource_metadata="https://mcp.getprojectflow.com/.well-known/oauth-protected-resource/mcp"`, and a metadata document whose `resource` is `https://mcp.getprojectflow.com/mcp`):
   ```bash
   curl -s -D - -o /dev/null -X POST https://mcp.getprojectflow.com/mcp -H 'Content-Type: application/json' -d '{}' | rg -i '^(HTTP|www-authenticate)'
   ```
   ```bash
   curl -s https://mcp.getprojectflow.com/.well-known/oauth-protected-resource/mcp
   ```
No code change is needed for the endpoint itself: resource and metadata follow the called host (`MCP_RESOURCES` in `functions/src/oauth-core.ts`). The OAuth issuer stays `https://app.getprojectflow.com`. `https://mcp.getprojectflow.com/` (root) shows the app — harmless.

## C) After the domains are live (agent tasks)
| When | Change | Where |
|---|---|---|
| A live | Docs link in OAuth/MCP metadata → `https://getprojectflow.com/docs/mcp` | default of `MCP_DOCS_URL` in `functions/src/oauth-config.ts` (or functions env `MCP_DOCS_URL`), deploy `functions:mcpServer,functions:mcp,functions:oauth` |
| B live | Advertised MCP URL → `https://mcp.getprojectflow.com/mcp` | `MCP_URL` in `landing/src/templates/pages.ts` (landing deploy), `getMcpUrl()` in `web/components/settings/McpConnectPanel.tsx` (drives `aiClients.ts` snippets; hosting deploy), `brain/operations/mcp-install-guide.md`, `plugins/projectflow-codex/README.md` |
| B live | Keep `https://app.getprojectflow.com/mcp` working forever (existing connections are bound to it) | nothing to do — stays in `MCP_RESOURCES` |
