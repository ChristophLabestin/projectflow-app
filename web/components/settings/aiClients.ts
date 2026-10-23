/**
 * Setup recipes per AI client for Settings → AI & integrations (single source; the public docs page
 * mirrors these). OAuth is the default everywhere: only the MCP URL is needed, no secret.
 */
export type AiClientId = 'claude' | 'claude-code' | 'chatgpt' | 'codex' | 'cursor' | 'vscode' | 'gemini' | 'other';

export type AiClientRecipe = {
    id: AiClientId;
    name: string;
    icon: string;
    /** Copy-ready snippet (shell command or config); omitted when the client is set up in its UI. */
    code?: (url: string) => string;
    /** One-click install link (opens the client). */
    installUrl?: (url: string) => string;
};

const base64 = (value: string) => window.btoa(String.fromCharCode(...new TextEncoder().encode(value)));

export const AI_CLIENTS: AiClientRecipe[] = [
    { id: 'claude', name: 'Claude', icon: 'forum' },
    {
        id: 'claude-code',
        name: 'Claude Code',
        icon: 'terminal',
        code: (url) => `claude mcp add --transport http --scope user projectflow ${url}\n# then in Claude Code: /mcp → projectflow → Authenticate`
    },
    { id: 'chatgpt', name: 'ChatGPT', icon: 'chat' },
    {
        id: 'codex',
        name: 'Codex',
        icon: 'code',
        code: (url) => `codex mcp add projectflow --url ${url}\ncodex mcp login projectflow`
    },
    {
        id: 'cursor',
        name: 'Cursor',
        icon: 'ads_click',
        installUrl: (url) => `cursor://anysphere.cursor-deeplink/mcp/install?name=ProjectFlow&config=${encodeURIComponent(base64(JSON.stringify({ url })))}`,
        code: (url) => JSON.stringify({ mcpServers: { projectflow: { url } } }, null, 2)
    },
    {
        id: 'vscode',
        name: 'VS Code',
        icon: 'integration_instructions',
        installUrl: (url) => `https://vscode.dev/redirect/mcp/install?name=projectflow&config=${encodeURIComponent(JSON.stringify({ type: 'http', url }))}`,
        code: (url) => JSON.stringify({ servers: { projectflow: { type: 'http', url } } }, null, 2)
    },
    {
        id: 'gemini',
        name: 'Gemini CLI',
        icon: 'auto_awesome',
        code: (url) => `gemini mcp add --transport http projectflow ${url}\n# then in Gemini CLI: /mcp auth projectflow`
    },
    {
        id: 'other',
        name: 'Other MCP client',
        icon: 'hub',
        code: (url) => `# Streamable HTTP + OAuth 2.1 (discovery via ${url})\n# Header alternative: Authorization: Bearer pfp_…\n# Clients without remote OAuth:\nnpx -y mcp-remote ${url}`
    }
];
