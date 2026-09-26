# ProjectFlow MCP Server

Date: 2026-09-26

## What it is

A remote [Model Context Protocol](https://modelcontextprotocol.io) server so Claude Code, Codex and other MCP clients can read and update ProjectFlow. Implemented in `functions/src/mcp-server.ts` (Cloud Function `mcp`, europe-west3) with the official `@modelcontextprotocol/sdk` (Streamable HTTP, stateless, JSON responses).

- Production URL: `https://app.getprojectflow.com/mcp` (Hosting rewrite → function `mcp`; also `https://projectflow-labestin.web.app/mcp`).
- Emulator URL: `http://127.0.0.1:5001/demo-projectflow/europe-west3/mcp`.
- Auth: workspace API token (Settings → API Keys), sent as `Authorization: Bearer <token>`. Missing/invalid/expired tokens get HTTP 401 with `WWW-Authenticate: Bearer`. OAuth is not implemented, so claude.ai "custom connectors" (OAuth-only) cannot connect; Claude Code, Codex and header-capable clients can.

## Design

- Every tool calls the public REST API route in-process (`handleProjectflowApiRoute`) with the caller's token, so permissions, project-scoped tokens, workspace isolation, validation and activity logging are identical to `/api/projectflow`.
- `tools/list` only contains tools the token's permissions allow (`projects:*`, `tasks:*`, `initiatives:*`).
- API errors come back as tool results with `isError: true` and the API message.
- Token lookup (`findApiToken` in `authUtils.ts`) uses a collection-group query on `api_tokens.tokenHash` (field override in `firestore.indexes.json`) and falls back to scanning tenants if the index is missing.

## Tools

whoami · list_projects · get_project · list_milestones · create_milestone · update_milestone · list_comments · add_comment · list_activity · list_tasks (filters: status, includeDone, assigneeId, initiativeId, search, limit) · get_task (with subtasks) · create_task · update_task · complete_task · upsert_task (idempotent by externalKey) · add_subtask · update_subtask · delete_task · list_initiatives · get_initiative · create_initiative · update_initiative · codex_start_session · codex_checkpoint · codex_finish_session · create_followups · list_codex_sessions.

## Connecting

The app shows copy-ready snippets with the real token right after creating one (Settings → API Keys, `McpConnectPanel`).

- Claude Code: `claude mcp add --transport http --scope user projectflow https://app.getprojectflow.com/mcp --header "Authorization: Bearer <token>"`
- Codex (`~/.codex/config.toml`): `[mcp_servers.projectflow]` with `url = "https://app.getprojectflow.com/mcp"` and `bearer_token_env_var = "PROJECTFLOW_API_TOKEN"`; export the token in that variable.

## Testing

`MCP_URL=… PROJECTFLOW_API_TOKEN=… node functions/scripts/mcp-e2e.cjs` (official MCP client; creates, updates and deletes its own tasks in the first project). 26/26 checks passed against the emulator on 2026-09-26; a read-only token (`projects:read`, `tasks:read`) only lists the 9 read tools.

- 2026-09-26: the project "Codex" view was removed from the app. Coding sessions are still stored (`codex_sessions`) and appear in the task and the project activity log (filter "Codex").
