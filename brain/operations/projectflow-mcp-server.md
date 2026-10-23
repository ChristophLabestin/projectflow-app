# ProjectFlow MCP Server

Date: 2026-09-26

## What it is

A remote [Model Context Protocol](https://modelcontextprotocol.io) server so Claude Code, Codex and other MCP clients can read and update ProjectFlow. Implemented in `functions/src/mcp-server.ts` (Cloud Function `mcp`, europe-west3) with the official `@modelcontextprotocol/sdk` (Streamable HTTP, stateless, JSON responses).

- Production URL: `https://app.getprojectflow.com/mcp` (Hosting rewrite → function `mcp`; also `https://projectflow-labestin.web.app/mcp`).
- Emulator URL: `http://127.0.0.1:5001/demo-projectflow/europe-west3/mcp`.
- Auth (since 2026-10-23): **OAuth 2.1** (preferred, any MCP client incl. claude.ai/ChatGPT connectors), personal access tokens `pfp_…`, or legacy workspace API tokens `pfat_…` — all as `Authorization: Bearer`. A 401 carries `WWW-Authenticate: Bearer resource_metadata="https://app.getprojectflow.com/.well-known/oauth-protected-resource/mcp"`; details in `brain/operations/projectflow-oauth.md`.

## Design

- Every tool calls the public REST API route in-process (`handleProjectflowApiRoute`) with the caller's token, so permissions, project-scoped tokens, workspace isolation, validation and activity logging are identical to `/api/projectflow`.
- `tools/list` only contains tools the token's permissions allow (`projects:*`, `tasks:*`, `initiatives:*`).
- API errors come back as tool results with `isError: true` and the API message.
- Token lookup (`findApiToken` in `authUtils.ts`) uses a collection-group query on `api_tokens.tokenHash` (field override in `firestore.indexes.json`), no tenant scan. `checkApiTokenUsable` rejects expired tokens and tokens whose creator is no longer a non-guest workspace member.
- Access = token scopes ∩ role ceiling of the token creator ∩ workspace AI policy (`ai-access.ts`); `tools/list` and `whoami` (now with `role`) show the effective set. Writes are audited in `tenants/{t}/ai_audit`; 120 req/min per token (429). Test: `cd functions && npm run test:ai-access`.
- Every tool carries all four annotations (`ANNOTATIONS.read|create|update|destroy`: readOnly/destructive/idempotent/openWorld=false).
- Successor design (OAuth, per-user grants, policy): `brain/plans/ai-integrations-concept.md`.

## Tools

whoami · list_projects · get_project · list_milestones · create_milestone · update_milestone · list_comments · add_comment · list_activity · list_tasks (filters: status, includeDone, assigneeId, initiativeId, search, limit) · get_task (with subtasks) · create_task · update_task · complete_task · upsert_task (idempotent by externalKey) · add_subtask · update_subtask · delete_task · list_initiatives · get_initiative · create_initiative · update_initiative · codex_start_session · codex_checkpoint · codex_finish_session · create_followups · list_codex_sessions.

## Connecting

The app shows copy-ready snippets with the real token right after creating one (Settings → API Keys, `McpConnectPanel`).

- Claude Code: `claude mcp add --transport http --scope user projectflow https://app.getprojectflow.com/mcp --header "Authorization: Bearer <token>"`
- Codex (`~/.codex/config.toml`): `[mcp_servers.projectflow]` with `url = "https://app.getprojectflow.com/mcp"` and `bearer_token_env_var = "PROJECTFLOW_API_TOKEN"`; export the token in that variable.

## Testing

`MCP_URL=… PROJECTFLOW_API_TOKEN=… node functions/scripts/mcp-e2e.cjs` (official MCP client; creates, updates and deletes its own tasks in the first project). 26/26 checks passed against the emulator on 2026-09-26; a read-only token (`projects:read`, `tasks:read`) only lists the 9 read tools.

- 2026-09-26: the project "Codex" view was removed from the app. Coding sessions are still stored (`codex_sessions`) and appear in the task and the project activity log (filter "Codex").
