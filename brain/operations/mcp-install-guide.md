# ProjectFlow MCP — public install guide (source for getprojectflow.com/docs/mcp)

Date: 2026-10-23 · In-app twin: `web/components/settings/aiClients.ts` + locale keys `aiSettings.clients.*`; public page `landing/src/content/docs-mcp.ts` (keep all three in sync; switch `MCP_URL` in `landing/src/templates/pages.ts` when mcp.getprojectflow.com is live).

**Server URL:** `https://app.getprojectflow.com/mcp` (later also `https://mcp.getprojectflow.com/mcp`). Streamable HTTP, OAuth 2.1 — you sign in with ProjectFlow, pick one workspace and the permissions. No key to copy.

| Client | Setup |
|---|---|
| Claude (claude.ai / Desktop) | Settings → Connectors → Add custom connector → Name `ProjectFlow`, URL above → Connect. Team/Enterprise: an owner adds it first. |
| Claude Code | `claude mcp add --transport http --scope user projectflow https://app.getprojectflow.com/mcp`, then `/mcp` → projectflow → Authenticate. |
| ChatGPT | Settings → Apps & Connectors → Advanced → Developer mode on → Create connector, URL above, auth OAuth. |
| Codex CLI | `codex mcp add projectflow --url https://app.getprojectflow.com/mcp` and `codex mcp login projectflow`. |
| Cursor | One-click: `cursor://anysphere.cursor-deeplink/mcp/install?name=ProjectFlow&config=<base64 of {"url":"https://app.getprojectflow.com/mcp"}>` or `~/.cursor/mcp.json` → `{"mcpServers":{"projectflow":{"url":"…/mcp"}}}`. |
| VS Code (Copilot) | One-click: `https://vscode.dev/redirect/mcp/install?name=projectflow&config=<urlencoded {"type":"http","url":"…/mcp"}>` or `.vscode/mcp.json` → `{"servers":{"projectflow":{"type":"http","url":"…/mcp"}}}`. |
| Gemini CLI | `gemini mcp add --transport http projectflow https://app.getprojectflow.com/mcp`, then `/mcp auth projectflow`. |
| Other / CI | Any MCP client with OAuth discovers everything from the URL. Headless: personal access token (Workspace settings → AI & integrations) as `Authorization: Bearer pfp_…`. Without remote OAuth: `npx -y mcp-remote https://app.getprojectflow.com/mcp`. |

## What the AI can do
Tools: `whoami`, `search`, `my_today`, projects/milestones/comments/activity, tasks + subtasks (`upsert_task` idempotent), initiatives, coding-session tracking (`codex_start_session`, `codex_checkpoint`, `codex_finish_session`, `create_followups`). Every tool is annotated read-only / destructive; delete tools only appear when the workspace allows deleting.

## Security & control
- The client acts as you with your role (Guests only in their projects, only if the workspace allows guests).
- Workspace admins: AI on/off, personal tokens, deleting, guests (Workspace settings → AI & integrations → Workspace AI policy); AI activity log for 180 days.
- Disconnect any app anytime (Connected apps) — takes effect immediately. Removing a member stops all of their connections.
- Content from tasks and comments is data for the AI, not instructions; review what an agent changes.
- Limits: 120 requests/min and 30 writes/min per connection, 5000 AI writes per workspace and day.
