import React, { useState } from 'react';

import { useLanguage } from '../../context/LanguageContext';
import { firebaseConfig } from '../../services/firebase';

type Client = 'claude' | 'codex' | 'other';

const TOKEN_ENV = 'PROJECTFLOW_API_TOKEN';

/** Where MCP clients reach this deployment (hosting rewrite, or the functions emulator locally). */
export const getMcpUrl = () => {
    if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
        return `http://127.0.0.1:${import.meta.env.VITE_EMULATOR_FUNCTIONS_PORT || 5001}/${firebaseConfig.projectId}/europe-west3/mcp`;
    }
    const { hostname, origin } = window.location;
    return hostname === 'localhost' || hostname === '127.0.0.1' ? 'https://app.getprojectflow.com/mcp' : `${origin}/mcp`;
};

type McpConnectPanelProps = {
    /** The freshly created token; without it the snippets show a placeholder. */
    token?: string | null;
};

/**
 * Copy-ready setup for connecting Claude Code, Codex or any MCP client to the
 * ProjectFlow MCP server with a workspace API token.
 */
export const McpConnectPanel: React.FC<McpConnectPanelProps> = ({ token }) => {
    const { t } = useLanguage();
    const [client, setClient] = useState<Client>('claude');
    const [copied, setCopied] = useState(false);
    const url = getMcpUrl();
    const secret = token || t('settings.mcp.tokenPlaceholder');

    const snippets: Record<Client, { hint: string; code: string }> = {
        claude: {
            hint: t('settings.mcp.claude.hint'),
            code: `claude mcp add --transport http --scope user projectflow ${url} \\\n  --header "Authorization: Bearer ${secret}"`
        },
        codex: {
            hint: t('settings.mcp.codex.hint').replace('{env}', TOKEN_ENV),
            code: `# ~/.codex/config.toml\n[mcp_servers.projectflow]\nurl = "${url}"\nbearer_token_env_var = "${TOKEN_ENV}"\n\n# Shell (e.g. ~/.zshrc)\nexport ${TOKEN_ENV}="${secret}"`
        },
        other: {
            hint: t('settings.mcp.other.hint'),
            code: JSON.stringify({ mcpServers: { projectflow: { type: 'http', url, headers: { Authorization: `Bearer ${secret}` } } } }, null, 2)
        }
    };
    const active = snippets[client];

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(active.code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <section className="mcp-connect" aria-label={t('settings.mcp.title')}>
            <header className="mcp-connect__head">
                <div>
                    <h3 className="mcp-connect__title">{t('settings.mcp.title')}</h3>
                    <p className="mcp-connect__subtitle">{t('settings.mcp.subtitle')}</p>
                </div>
                <code className="mcp-connect__url">{url}</code>
            </header>

            <div className="mcp-connect__tabs" role="tablist">
                {(['claude', 'codex', 'other'] as const).map((option) => (
                    <button
                        key={option}
                        type="button"
                        role="tab"
                        aria-selected={client === option}
                        className={`mcp-connect__tab ${client === option ? 'is-active' : ''}`.trim()}
                        onClick={() => { setClient(option); setCopied(false); }}
                    >
                        {t(`settings.mcp.${option}.label`)}
                    </button>
                ))}
            </div>

            <p className="mcp-connect__hint">{active.hint}</p>
            <div className="mcp-connect__code">
                <pre>{active.code}</pre>
                <button type="button" className="mcp-connect__copy" onClick={() => void copy()}>
                    <span className="material-symbols-outlined" aria-hidden="true">{copied ? 'check' : 'content_copy'}</span>
                    {copied ? t('settings.mcp.copied') : t('settings.mcp.copy')}
                </button>
            </div>
            {!token && <p className="mcp-connect__note">{t('settings.mcp.needToken')}</p>}
        </section>
    );
};
