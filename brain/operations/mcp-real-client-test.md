# Real client test — ProjectFlow MCP in claude.ai (5 steps)

Date: 2026-10-23 · Takes ~5 minutes · Works the same in Claude Desktop.

1. **Add connector** — claude.ai → Settings → Connectors → *Add custom connector* → Name `ProjectFlow`, URL `https://app.getprojectflow.com/mcp` → *Add*. (Team/Enterprise: an owner adds it under organization settings first.)
2. **Sign in** — click *Connect*. A ProjectFlow tab opens (`app.getprojectflow.com/oauth/consent`); sign in as usual if asked (accept legal documents if prompted).
3. **Choose workspace & permissions** — pick the workspace, keep the default permissions (delete stays off), click *Allow access*. The tab returns to Claude and the connector shows as connected.
4. **Test prompts** — in a new chat with the connector enabled:
   - „Was steht heute an?“ → Claude calls `my_today` (overdue / today / next 7 days).
   - „Suche nach Aufgaben zu <Stichwort>.“ → `search`.
   - Optional write: „Lege im Projekt <Name> die Aufgabe ‚MCP-Test‘ an.“ → `create_task` (Claude asks for confirmation).
5. **Check in ProjectFlow** — Workspace settings → *AI & integrations* → *Connected apps* shows **Claude** with "Last used today"; after the optional write the task exists and *AI activity* lists `POST …/tasks`. Optionally *Disconnect* and ask Claude again → it must lose access.

## If something fails, send me
- The step number and the exact error text (or a screenshot of Claude and/or the ProjectFlow tab, incl. the URL bar).
- The approximate time (with time zone) — I look up `firebase functions:log --only oauth,mcpServer` around it.
- Which account/workspace you used (email is enough; never send passwords or tokens).
