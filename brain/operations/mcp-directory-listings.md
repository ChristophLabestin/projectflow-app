# MCP directory listings (P7) — drafts to submit

Date: 2026-10-23 · Submitted by the user (needs their accounts). Submission flows change often: **check each portal's current form before submitting**; the steps below are the expected flow, not verified click paths.

## Shared listing data
| Field | Value |
|---|---|
| Name | ProjectFlow |
| Server URL | `https://app.getprojectflow.com/mcp` (switch to `https://mcp.getprojectflow.com/mcp` once live, see `domains-setup.md`) |
| Transport / auth | Streamable HTTP · OAuth 2.1 (PKCE S256, Dynamic Client Registration + Client ID Metadata Documents) · per-user, one workspace per connection |
| Category | Productivity / Project management |
| Website | `https://getprojectflow.com` |
| Docs | `https://getprojectflow.com/docs/mcp` (live after domain switch; until then the landing preview or `https://app.getprojectflow.com/?openSettings=ai`) |
| Privacy policy | `https://app.getprojectflow.com/legal/privacy` |
| Terms | `https://app.getprojectflow.com/legal/terms` |
| Imprint | `https://app.getprojectflow.com/legal/imprint` |
| Support | `hello@getprojectflow.com` |
| Logo | `landing/public/icon-512.png` (512×512 PNG, square) · vector `web/assets/logo.svg` · small `landing/public/favicon.svg` |
| Screenshots | to capture: consent screen (`/oauth/consent`), Settings → AI & integrations, a Claude chat using `my_today` |

### Short description (≤ 80 chars)
- EN: Plan and run projects in ProjectFlow: tasks, initiatives, your day — from any AI.
- DE: Projekte in ProjectFlow planen und steuern: Aufgaben, Initiativen, dein Tag – mit jeder KI.

### Long description
- **EN:** Connect your ProjectFlow workspace to your AI assistant. Ask what's due today, search projects and tasks, create and update tasks and subtasks, add comments, manage initiatives and milestones, and track coding sessions with follow-up tasks. You sign in with ProjectFlow, choose one workspace and exactly which permissions the assistant gets — read-only is possible, deleting is off by default. The assistant always acts as you, within your role; workspace admins control AI access, see every connection and an activity log, and can disconnect apps at any time.
- **DE:** Verbinde deinen ProjectFlow-Workspace mit deinem KI-Assistenten. Frag, was heute ansteht, durchsuche Projekte und Aufgaben, lege Aufgaben und Unteraufgaben an und aktualisiere sie, kommentiere, verwalte Initiativen und Meilensteine und tracke Coding-Sessions samt Folgeaufgaben. Du meldest dich mit ProjectFlow an, wählst einen Workspace und genau die Berechtigungen, die der Assistent bekommt – auch nur lesend; Löschen ist standardmäßig aus. Der Assistent handelt immer in deinem Namen und im Rahmen deiner Rolle; Workspace-Admins steuern den KI-Zugriff, sehen alle Verbindungen und ein Aktivitätsprotokoll und können Apps jederzeit trennen.

### Example prompts (reviewers ask for them)
1. "What's on my plate today?" → `my_today`
2. "Find the tasks about the login bug and summarize their status." → `search`, `get_task`
3. "Create a task 'Prepare release notes' in project Website, due Friday, high priority." → `create_task`
4. "Mark the release-notes task as done and add a comment that it shipped." → `complete_task`, `add_comment`

### Test account for reviewers
Create a dedicated reviewer account (not the owner's): sign up at `https://app.getprojectflow.com/register` with a mailbox you control (e.g. `review@getprojectflow.com`), create a workspace "Reviewer Demo" with 2 projects and ~10 tasks (some due today/overdue), keep AI policy defaults. Hand reviewers email + password through the portal's private field only. Revoke/rotate after review.

## Per directory
### Claude — Connectors directory (claude.ai / Claude Desktop)
Today anyone can already add ProjectFlow as a *custom connector* (no listing needed). Listing = Anthropic's connector directory:
1. Open Anthropic's connector directory submission (linked from the Claude help center article on remote MCP connectors / "Submit your connector").
2. Fill shared data above; auth type OAuth (DCR/CIMD supported); callback is `https://claude.ai/api/mcp/auth_callback` (already accepted — any https redirect is allowed via DCR).
3. Provide test account, example prompts, privacy policy, tool list (from `brain/operations/projectflow-mcp-server.md`) and note that tools carry read-only/destructive annotations.
4. Expect a review with security questions (data handling, retention: audit 180 days, token storage hashed).

### ChatGPT — Apps / connectors
1. OpenAI developer platform → Apps (Apps SDK / MCP) → create app with the server URL, OAuth.
2. Test in ChatGPT developer mode first (Settings → Apps & Connectors → Advanced → Developer mode); the server advertises `offline_access`, refresh tokens are issued.
3. Submit for review with shared data, privacy policy, test account and example prompts; business verification of the publisher may be required.

### Cursor — MCP directory
1. Cursor's MCP directory / "Add to Cursor" listing: submit via the form linked from Cursor's MCP docs (or their directory repo, if that is the current flow).
2. Use the one-click link (same as in the app): `cursor://anysphere.cursor-deeplink/mcp/install?name=ProjectFlow&config=<base64 of {"url":"https://app.getprojectflow.com/mcp"}>`.
3. Shared descriptions + logo.

### VS Code (GitHub Copilot) — MCP gallery via the official MCP Registry
1. The VS Code MCP gallery draws from the GitHub MCP registry, which builds on the official MCP Registry (`registry.modelcontextprotocol.io`). Publish a `server.json` with the registry's `mcp-publisher` CLI.
2. Namespace: domain-verified `com.getprojectflow/projectflow` (DNS TXT or HTTP proof on getprojectflow.com — needs the domain from `domains-setup.md` A).
3. `server.json` essentials: name, description (short EN), version `1.0.0`, `remotes: [{ "type": "streamable-http", "url": "https://app.getprojectflow.com/mcp" }]`, website/repository links.
4. One-click link for docs: `https://vscode.dev/redirect/mcp/install?name=projectflow&config=<urlencoded {"type":"http","url":"https://app.getprojectflow.com/mcp"}>`.
Registering in the official MCP Registry also makes ProjectFlow discoverable for other registry-based clients.

## Before submitting (checklist)
- [ ] Real client test passed (`brain/operations/mcp-real-client-test.md`)
- [ ] getprojectflow.com live incl. `/docs/mcp`; then switch `MCP_DOCS_URL` default
- [ ] Reviewer account + demo data
- [ ] 3 screenshots
