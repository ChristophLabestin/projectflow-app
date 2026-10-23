/**
 * Public MCP guide (getprojectflow.com/docs/mcp). Source: brain/operations/mcp-install-guide.md and the
 * in-app twin web/components/settings/aiClients.ts + aiSettings.* locale keys – keep all three in sync.
 * `{url}` is replaced with MCP_URL at render time.
 */
export interface DocsClient {
    id: string;
    name: string;
    steps: string[];
    snippets: { label: string; code: string }[];
    install?: 'cursor' | 'vscode';
}

const de = {
    meta: {
        title: 'ProjectFlow mit KI-Clients verbinden (MCP) · Doku',
        description: 'So verbindest du Claude, ChatGPT, Codex, Cursor, VS Code, Gemini CLI und andere MCP-Clients mit ProjectFlow – mit OAuth, Berechtigungen und Audit.',
    },
    breadcrumb: 'Doku',
    title: 'ProjectFlow mit KI‑Clients verbinden',
    lead: 'ProjectFlow bietet einen MCP-Server (Model Context Protocol). Damit arbeiten Claude, ChatGPT, Codex, Cursor und andere KI-Clients direkt mit deinen Projekten und Aufgaben – mit deiner Rolle, in genau einem Workspace und jederzeit widerrufbar.',
    serverLabel: 'Server-URL',
    facts: ['Streamable HTTP', 'OAuth 2.1 – kein Schlüssel zum Kopieren', 'Ein Workspace pro Verbindung'],
    copy: 'Kopieren',
    copied: 'Kopiert',
    toc: 'Auf dieser Seite',
    sections: {
        capabilities: 'Was die Integration kann',
        permissions: 'Berechtigungen',
        security: 'Sicherheit & Kontrolle',
        setup: 'Einrichtung nach Client',
        tokens: 'Persönliche Tokens für CI',
        limits: 'Limits',
        faq: 'FAQ & Fehlerbehebung',
    },
    capabilitiesIntro: 'Der Server stellt Werkzeuge (Tools) bereit, die der KI-Client in deinem Namen aufruft. Jedes Tool ist als lesend oder verändernd gekennzeichnet; Lösch-Tools erscheinen nur, wenn der Workspace Löschen erlaubt.',
    toolGroups: [
        { title: 'Orientierung', text: 'Wer bin ich, wo bin ich, was steht heute an.', tools: ['whoami', 'search', 'my_today'] },
        { title: 'Projekte', text: 'Projekte, Meilensteine, Kommentare und Aktivität lesen und pflegen.', tools: ['list_projects', 'get_project', 'list_milestones', 'create_milestone', 'update_milestone', 'list_comments', 'add_comment', 'list_activity'] },
        { title: 'Aufgaben', text: 'Aufgaben und Unteraufgaben anlegen und ändern; upsert_task ist idempotent.', tools: ['list_tasks', 'get_task', 'create_task', 'update_task', 'upsert_task', 'complete_task', 'add_subtask', 'update_subtask', 'delete_task'] },
        { title: 'Initiativen', text: 'Größere Vorhaben mit ihren Aufgaben lesen und pflegen.', tools: ['list_initiatives', 'get_initiative', 'create_initiative', 'update_initiative'] },
        { title: 'Coding-Sessions', text: 'Arbeit von Coding-Agents nachverfolgen und Folgeaufgaben anlegen.', tools: ['codex_start_session', 'codex_checkpoint', 'codex_finish_session', 'list_codex_sessions', 'create_followups'] },
    ],
    permissionsIntro: 'Bei der Anmeldung wählst du den Workspace und die Berechtigungen. Fordert ein Client nichts Bestimmtes an, erhält er: Projekte und Initiativen lesen, Aufgaben lesen und schreiben.',
    scopeHead: ['Bereich', 'Lesen', 'Schreiben', 'Löschen'],
    scopeRows: ['Projekte', 'Aufgaben', 'Initiativen'],
    scopeNote: 'Die Rolle schlägt immer die Berechtigung: Ein Client kann nie mehr als du selbst. Löschen ist nur möglich, wenn Workspace-Admins es erlauben.',
    security: [
        'Der Client handelt in deinem Namen und mit deiner Rolle. Gäste nur in ihren Projekten – und nur, wenn der Workspace Gäste erlaubt.',
        'Workspace-Admins steuern unter Workspace-Einstellungen → KI & Integrationen → KI-Richtlinie des Workspace: KI-Clients an/aus, persönliche Tokens, Löschen und Gäste.',
        'Jede Verbindung lässt sich unter „Verbundene Apps“ trennen – das wirkt sofort. Wird ein Mitglied entfernt, enden alle seine Verbindungen.',
        'Änderungen durch KI-Clients und Tokens erscheinen unter „KI-Aktivität“ und werden 180 Tage gespeichert.',
        'Inhalte aus Aufgaben und Kommentaren sind für die KI Daten, keine Anweisungen. Prüfe, was ein Agent ändert.',
    ],
    setupIntro: 'Du brauchst nur die Server-URL. Beim ersten Verbinden öffnet sich die ProjectFlow-Anmeldung; dort wählst du Workspace und Berechtigungen. Dasselbe findest du in der App unter Workspace-Einstellungen → KI & Integrationen.',
    installCursor: 'Zu Cursor hinzufügen',
    installVscode: 'Zu VS Code hinzufügen',
    clients: [
        { id: 'claude', name: 'Claude (claude.ai & Desktop)', steps: ['Öffne Einstellungen → Konnektoren → Benutzerdefinierten Konnektor hinzufügen.', 'Name: ProjectFlow · URL: die Server-URL oben.', 'Klicke auf Verbinden, melde dich bei ProjectFlow an und wähle den Workspace.', 'In Team- und Enterprise-Plänen fügt zuerst ein:e Owner den Konnektor hinzu.'], snippets: [] },
        { id: 'claude-code', name: 'Claude Code', steps: ['Führe den Befehl im Terminal aus.', 'Starte Claude Code, tippe /mcp, wähle projectflow → Authenticate und melde dich an.'], snippets: [{ label: 'Terminal', code: 'claude mcp add --transport http --scope user projectflow {url}' }] },
        { id: 'chatgpt', name: 'ChatGPT', steps: ['Öffne Einstellungen → Apps & Konnektoren → Erweitert und aktiviere den Entwicklermodus.', 'Lege einen Konnektor mit der Server-URL und Authentifizierung OAuth an.', 'Melde dich bei ProjectFlow an und wähle den Workspace.'], snippets: [] },
        { id: 'codex', name: 'Codex CLI', steps: ['Führe die Befehle aus. Codex öffnet den Browser zur Anmeldung.'], snippets: [{ label: 'Terminal', code: 'codex mcp add projectflow --url {url}\ncodex mcp login projectflow' }] },
        { id: 'cursor', name: 'Cursor', install: 'cursor', steps: ['Klicke auf „Zu Cursor hinzufügen“ oder trage den Schnipsel in ~/.cursor/mcp.json ein.', 'Cursor fragt beim ersten Einsatz nach der ProjectFlow-Anmeldung.'], snippets: [{ label: '~/.cursor/mcp.json', code: '{\n  "mcpServers": {\n    "projectflow": { "url": "{url}" }\n  }\n}' }] },
        { id: 'vscode', name: 'VS Code (Copilot)', install: 'vscode', steps: ['Klicke auf „Zu VS Code hinzufügen“ oder trage den Schnipsel in .vscode/mcp.json ein (Copilot-Agent-Modus).', 'VS Code fragt beim ersten Einsatz nach der ProjectFlow-Anmeldung.'], snippets: [{ label: '.vscode/mcp.json', code: '{\n  "servers": {\n    "projectflow": { "type": "http", "url": "{url}" }\n  }\n}' }] },
        { id: 'gemini', name: 'Gemini CLI', steps: ['Führe den Befehl aus.', 'Authentifiziere dich danach in der Gemini CLI mit /mcp auth projectflow.'], snippets: [{ label: 'Terminal', code: 'gemini mcp add --transport http projectflow {url}' }] },
        { id: 'other', name: 'Andere MCP-Clients', steps: ['Trage die Server-URL ein (Transport: Streamable HTTP). Clients mit MCP-OAuth finden Anmeldung und Berechtigungen selbst.', 'Clients ohne Remote-OAuth verbindest du über mcp-remote.'], snippets: [{ label: 'Ohne Remote-OAuth', code: 'npx -y mcp-remote {url}' }] },
    ] as DocsClient[],
    tokensIntro: 'Headless-Agents, Skripte und CI können sich nicht im Browser anmelden. Dafür gibt es persönliche Zugriffstokens. Sie handeln in deinem Namen – behandle sie wie ein Passwort.',
    tokensSteps: [
        'Öffne Workspace-Einstellungen → KI & Integrationen → Persönliche Zugriffstokens. (Workspace-Admins müssen persönliche Tokens erlauben.)',
        'Vergib einen Namen (z. B. „GitHub Actions“), wähle den Zugriff und die Laufzeit und erstelle das Token.',
        'Kopiere das Token sofort – es wird nur einmal angezeigt – und lege es als Secret in deinem CI ab.',
        'Sende es bei jeder Anfrage als HTTP-Header. Widerrufen kannst du es jederzeit unter „Verbundene Apps“.',
    ],
    tokenSnippets: [
        { label: 'HTTP-Header', code: 'Authorization: Bearer pfp_…' },
        { label: 'Claude Code (Header aus Umgebungsvariable)', code: 'claude mcp add --transport http projectflow {url} \\\n  --header "Authorization: Bearer $PROJECTFLOW_TOKEN"' },
    ],
    limits: [
        { value: '120', label: 'Anfragen pro Minute und Verbindung' },
        { value: '30', label: 'Schreibvorgänge pro Minute und Verbindung' },
        { value: '5.000', label: 'KI-Schreibvorgänge pro Workspace und Tag' },
    ],
    faq: [
        { q: 'Mein Client verbindet sich, sieht aber keine Projekte.', a: 'Eine Verbindung gilt für genau den Workspace, den du bei der Anmeldung gewählt hast. Für einen anderen Workspace trennst du die App unter „Verbundene Apps“ und verbindest sie neu.' },
        { q: 'Die Verbindung wird abgelehnt.', a: 'Prüfe, ob in deinem Workspace „KI-Clients erlauben“ eingeschaltet ist. Gäste können sich nur verbinden, wenn der Workspace Gäste erlaubt. Danach in der App neu anmelden.' },
        { q: 'Mein Agent kann nichts löschen.', a: 'Lösch-Tools erscheinen nur, wenn Workspace-Admins „Löschen erlauben“ aktiviert haben und deine Rolle Löschen zulässt.' },
        { q: 'Mein Client unterstützt kein OAuth für Remote-Server.', a: 'Verbinde ihn über npx -y mcp-remote mit der Server-URL oder nutze ein persönliches Zugriffstoken als Authorization-Header.' },
        { q: 'Anfragen schlagen nach vielen Aufrufen fehl.', a: 'Wahrscheinlich ist ein Limit erreicht (siehe oben). Warte kurz und bündle Änderungen; upsert_task ist idempotent und lässt sich gefahrlos wiederholen.' },
        { q: 'Ein Token funktioniert nicht mehr.', a: 'Tokens enden mit ihrer Laufzeit, beim Widerruf oder wenn du den Workspace verlässt. Lege ein neues Token an bzw. verbinde den Client neu.' },
        { q: 'Wie sehe ich, was ein Agent geändert hat?', a: 'Unter Workspace-Einstellungen → KI & Integrationen → KI-Aktivität stehen alle Änderungen durch KI-Clients und Tokens der letzten 180 Tage.' },
    ],
    help: 'Fragen oder ein Client fehlt? Schreib uns an',
    openSettings: 'KI & Integrationen in der App öffnen',
};

export type DocsMcpCopy = typeof de;

const en: DocsMcpCopy = {
    meta: {
        title: 'Connect ProjectFlow to AI clients (MCP) · Docs',
        description: 'Connect Claude, ChatGPT, Codex, Cursor, VS Code, Gemini CLI and other MCP clients to ProjectFlow – with OAuth, permissions and an audit log.',
    },
    breadcrumb: 'Docs',
    title: 'Connect ProjectFlow to AI clients',
    lead: 'ProjectFlow runs an MCP server (Model Context Protocol). Claude, ChatGPT, Codex, Cursor and other AI clients can work directly with your projects and tasks – with your role, in exactly one workspace, revocable at any time.',
    serverLabel: 'Server URL',
    facts: ['Streamable HTTP', 'OAuth 2.1 – no key to copy', 'One workspace per connection'],
    copy: 'Copy',
    copied: 'Copied',
    toc: 'On this page',
    sections: {
        capabilities: 'What the integration can do',
        permissions: 'Permissions',
        security: 'Security & control',
        setup: 'Setup by client',
        tokens: 'Personal tokens for CI',
        limits: 'Limits',
        faq: 'FAQ & troubleshooting',
    },
    capabilitiesIntro: 'The server exposes tools that the AI client calls on your behalf. Every tool is marked as read-only or changing; delete tools only appear when the workspace allows deleting.',
    toolGroups: [
        { title: 'Orientation', text: 'Who am I, where am I, what is on today.', tools: ['whoami', 'search', 'my_today'] },
        { title: 'Projects', text: 'Read and maintain projects, milestones, comments and activity.', tools: ['list_projects', 'get_project', 'list_milestones', 'create_milestone', 'update_milestone', 'list_comments', 'add_comment', 'list_activity'] },
        { title: 'Tasks', text: 'Create and change tasks and subtasks; upsert_task is idempotent.', tools: ['list_tasks', 'get_task', 'create_task', 'update_task', 'upsert_task', 'complete_task', 'add_subtask', 'update_subtask', 'delete_task'] },
        { title: 'Initiatives', text: 'Read and maintain bigger undertakings with their tasks.', tools: ['list_initiatives', 'get_initiative', 'create_initiative', 'update_initiative'] },
        { title: 'Coding sessions', text: 'Track the work of coding agents and create follow-up tasks.', tools: ['codex_start_session', 'codex_checkpoint', 'codex_finish_session', 'list_codex_sessions', 'create_followups'] },
    ],
    permissionsIntro: 'When you sign in you choose the workspace and the permissions. If a client asks for nothing specific it gets: read projects and initiatives, read and write tasks.',
    scopeHead: ['Area', 'Read', 'Write', 'Delete'],
    scopeRows: ['Projects', 'Tasks', 'Initiatives'],
    scopeNote: 'Your role always beats the permission: a client can never do more than you can. Deleting is only possible when workspace admins allow it.',
    security: [
        'The client acts on your behalf with your role. Guests only in their projects – and only if the workspace allows guests.',
        'Workspace admins control AI clients, personal tokens, deleting and guests under Workspace settings → AI & integrations → Workspace AI policy.',
        'Disconnect any app under “Connected apps” – it takes effect immediately. Removing a member ends all of their connections.',
        'Changes made by AI clients and tokens appear under “AI activity” and are kept for 180 days.',
        'Content from tasks and comments is data for the AI, not instructions. Review what an agent changes.',
    ],
    setupIntro: 'All you need is the server URL. On first connect the ProjectFlow sign-in opens, where you choose workspace and permissions. The same guide is in the app under Workspace settings → AI & integrations.',
    installCursor: 'Add to Cursor',
    installVscode: 'Add to VS Code',
    clients: [
        { id: 'claude', name: 'Claude (claude.ai & desktop)', steps: ['Open Settings → Connectors → Add custom connector.', 'Name: ProjectFlow · URL: the server URL above.', 'Click Connect, sign in to ProjectFlow and choose the workspace.', 'On Team and Enterprise plans an owner adds the connector first.'], snippets: [] },
        { id: 'claude-code', name: 'Claude Code', steps: ['Run the command in your terminal.', 'Start Claude Code, type /mcp, choose projectflow → Authenticate and sign in.'], snippets: [{ label: 'Terminal', code: 'claude mcp add --transport http --scope user projectflow {url}' }] },
        { id: 'chatgpt', name: 'ChatGPT', steps: ['Open Settings → Apps & Connectors → Advanced and turn on Developer mode.', 'Create a connector with the server URL and authentication OAuth.', 'Sign in to ProjectFlow and choose the workspace.'], snippets: [] },
        { id: 'codex', name: 'Codex CLI', steps: ['Run the commands. Codex opens the browser to sign in.'], snippets: [{ label: 'Terminal', code: 'codex mcp add projectflow --url {url}\ncodex mcp login projectflow' }] },
        { id: 'cursor', name: 'Cursor', install: 'cursor', steps: ['Click “Add to Cursor” or put the snippet into ~/.cursor/mcp.json.', 'Cursor asks you to sign in to ProjectFlow on first use.'], snippets: [{ label: '~/.cursor/mcp.json', code: '{\n  "mcpServers": {\n    "projectflow": { "url": "{url}" }\n  }\n}' }] },
        { id: 'vscode', name: 'VS Code (Copilot)', install: 'vscode', steps: ['Click “Add to VS Code” or put the snippet into .vscode/mcp.json (Copilot agent mode).', 'VS Code asks you to sign in to ProjectFlow on first use.'], snippets: [{ label: '.vscode/mcp.json', code: '{\n  "servers": {\n    "projectflow": { "type": "http", "url": "{url}" }\n  }\n}' }] },
        { id: 'gemini', name: 'Gemini CLI', steps: ['Run the command.', 'Then authenticate inside Gemini CLI with /mcp auth projectflow.'], snippets: [{ label: 'Terminal', code: 'gemini mcp add --transport http projectflow {url}' }] },
        { id: 'other', name: 'Other MCP clients', steps: ['Enter the server URL (transport: Streamable HTTP). Clients with MCP OAuth discover sign-in and permissions by themselves.', 'Connect clients without remote OAuth through mcp-remote.'], snippets: [{ label: 'Without remote OAuth', code: 'npx -y mcp-remote {url}' }] },
    ],
    tokensIntro: 'Headless agents, scripts and CI cannot sign in through a browser. Personal access tokens cover that. They act on your behalf – treat them like a password.',
    tokensSteps: [
        'Open Workspace settings → AI & integrations → Personal access tokens. (Workspace admins must allow personal tokens.)',
        'Give it a name (e.g. “GitHub Actions”), choose the access and the lifetime and create the token.',
        'Copy the token right away – it is shown only once – and store it as a secret in your CI.',
        'Send it with every request as an HTTP header. Revoke it at any time under “Connected apps”.',
    ],
    tokenSnippets: [
        { label: 'HTTP header', code: 'Authorization: Bearer pfp_…' },
        { label: 'Claude Code (header from an environment variable)', code: 'claude mcp add --transport http projectflow {url} \\\n  --header "Authorization: Bearer $PROJECTFLOW_TOKEN"' },
    ],
    limits: [
        { value: '120', label: 'requests per minute and connection' },
        { value: '30', label: 'writes per minute and connection' },
        { value: '5,000', label: 'AI writes per workspace and day' },
    ],
    faq: [
        { q: 'My client connects but sees no projects.', a: 'A connection applies to exactly the workspace you chose when signing in. For another workspace, disconnect the app under “Connected apps” and connect it again.' },
        { q: 'The connection is refused.', a: 'Check that “Allow AI clients” is on for your workspace. Guests can only connect when the workspace allows guests. Then sign in again.' },
        { q: 'My agent cannot delete anything.', a: 'Delete tools only appear when workspace admins turned on “Allow deleting” and your role allows deleting.' },
        { q: 'My client does not support OAuth for remote servers.', a: 'Connect it through npx -y mcp-remote with the server URL, or use a personal access token as the Authorization header.' },
        { q: 'Requests fail after many calls.', a: 'You probably hit a limit (see above). Wait a moment and batch changes; upsert_task is idempotent and safe to retry.' },
        { q: 'A token stopped working.', a: 'Tokens end with their lifetime, when revoked, or when you leave the workspace. Create a new token or reconnect the client.' },
        { q: 'How do I see what an agent changed?', a: 'Workspace settings → AI & integrations → AI activity lists every change made by AI clients and tokens in the last 180 days.' },
    ],
    help: 'Questions or a client missing? Write to',
    openSettings: 'Open AI & integrations in the app',
};

export const docsMcp = { de, en };
