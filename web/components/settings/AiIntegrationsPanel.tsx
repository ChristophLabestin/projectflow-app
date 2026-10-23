import { forgetInAppAi } from '../../hooks/useInAppAi';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useLanguage } from '../../context/LanguageContext';
import { useConfirm, useToast } from '../../context/UIContext';
import {
    type AiAuditEntry,
    type AiConnection,
    type AiPolicy,
    createPersonalAccessToken,
    getWorkspaceAiPolicy,
    listAiConnections,
    listWorkspaceAiAudit,
    revokeAiConnection,
    updateWorkspaceAiPolicy
} from '../../services/aiIntegrations';
import { AI_CLIENTS, type AiClientId } from './aiClients';
import { getMcpUrl } from './McpConnectPanel';
import { SettingsSwitch } from './SettingsSwitch';
import '../common/Button/button.scss';

type AiIntegrationsPanelProps = {
    tenantId: string;
    role?: string;
};

type TokenPreset = 'read' | 'write' | 'delete';

const TOKEN_PRESETS: Record<TokenPreset, string[]> = {
    read: ['projects:read', 'tasks:read', 'initiatives:read'],
    write: ['projects:read', 'projects:write', 'tasks:read', 'tasks:write', 'initiatives:read', 'initiatives:write'],
    delete: ['projects:read', 'projects:write', 'tasks:read', 'tasks:write', 'tasks:delete', 'initiatives:read', 'initiatives:write', 'initiatives:delete']
};

/** In-app assistant switches come first; they do not depend on the external-clients master switch. */
const POLICY_KEYS: (keyof AiPolicy)[] = ['inAppAi', 'inAppEnabled', 'enabled', 'allowPersonalTokens', 'allowDeleteScopes', 'allowGuests'];
const isInAppKey = (key: keyof AiPolicy) => key === 'inAppAi' || key === 'inAppEnabled';

/**
 * Settings → AI & integrations: connect any MCP client (OAuth by default), see and revoke connections,
 * personal access tokens for headless use, the workspace AI policy and the AI activity log.
 */
export const AiIntegrationsPanel: React.FC<AiIntegrationsPanelProps> = ({ tenantId, role }) => {
    const { t, language } = useLanguage();
    const { showError, showSuccess } = useToast();
    const confirm = useConfirm();
    const isAdmin = role === 'Owner' || role === 'Admin';
    const url = getMcpUrl();

    const [clientId, setClientId] = useState<AiClientId>('claude');
    const [copied, setCopied] = useState<string | null>(null);
    const [connections, setConnections] = useState<AiConnection[]>([]);
    const [showAll, setShowAll] = useState(false);
    const [policy, setPolicy] = useState<AiPolicy | null>(null);
    const [audit, setAudit] = useState<AiAuditEntry[]>([]);
    const [tokenName, setTokenName] = useState('');
    const [tokenPreset, setTokenPreset] = useState<TokenPreset>('read');
    const [tokenDays, setTokenDays] = useState(90);
    const [newToken, setNewToken] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const client = AI_CLIENTS.find((entry) => entry.id === clientId) || AI_CLIENTS[0];
    const formatDate = useCallback((iso: string | null) => (iso ? new Date(iso).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'), [language]);

    const loadConnections = useCallback(async () => {
        try {
            setConnections((await listAiConnections(tenantId, showAll && isAdmin)).connections);
        } catch (error) {
            console.error('AI connections failed', error);
        }
    }, [tenantId, showAll, isAdmin]);

    useEffect(() => {
        void loadConnections();
    }, [loadConnections]);

    useEffect(() => {
        getWorkspaceAiPolicy(tenantId).then((result) => setPolicy(result.policy)).catch((error) => console.error('AI policy failed', error));
        if (isAdmin) listWorkspaceAiAudit(tenantId, 20).then(setAudit).catch((error) => console.error('AI audit failed', error));
    }, [tenantId, isAdmin]);

    const copy = async (key: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(key);
            window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
        } catch {
            setCopied(null);
        }
    };

    const revoke = async (connection: AiConnection) => {
        const ok = await confirm({
            title: t('aiSettings.connections.revokeTitle'),
            message: t('aiSettings.connections.revokeMessage').replace('{name}', connection.clientName),
            confirmText: t('aiSettings.connections.revoke'),
            variant: 'danger'
        });
        if (!ok) return;
        try {
            await revokeAiConnection(connection.id);
            showSuccess(t('aiSettings.connections.revoked'));
            await loadConnections();
        } catch (error: any) {
            showError(error?.message || t('aiSettings.error'));
        }
    };

    const createToken = async () => {
        if (!tokenName.trim()) return;
        setBusy(true);
        try {
            const scopes = TOKEN_PRESETS[tokenPreset];
            const result = await createPersonalAccessToken(tenantId, tokenName.trim(), scopes, tokenDays);
            setNewToken(result.token);
            setTokenName('');
            await loadConnections();
        } catch (error: any) {
            showError(error?.message || t('aiSettings.error'));
        } finally {
            setBusy(false);
        }
    };

    const changePolicy = async (key: keyof AiPolicy, value: boolean) => {
        if (!policy) return;
        const previous = policy;
        setPolicy({ ...policy, [key]: value });
        try {
            setPolicy(await updateWorkspaceAiPolicy(tenantId, { [key]: value }));
            if (isInAppKey(key)) forgetInAppAi(tenantId);
        } catch (error: any) {
            setPolicy(previous);
            showError(error?.message || t('aiSettings.error'));
        }
    };

    const scopeSummary = (scopes: string[]) => {
        if (scopes.some((scope) => scope.endsWith(':delete'))) return t('aiSettings.scopes.delete');
        if (scopes.some((scope) => scope.endsWith(':write'))) return t('aiSettings.scopes.write');
        return t('aiSettings.scopes.read');
    };

    const deleteAllowed = Boolean(policy?.allowDeleteScopes);
    const presets = useMemo(() => (['read', 'write', ...(deleteAllowed ? ['delete'] : [])] as TokenPreset[]), [deleteAllowed]);

    return (
        <div className="ai-settings">
            {policy && !policy.enabled && <p className="ai-settings__banner">{t('aiSettings.disabledBanner')}</p>}

            {/* Connect a client */}
            <section className="ai-settings__card">
                <header className="ai-settings__head">
                    <div>
                        <h3>{t('aiSettings.connect.title')}</h3>
                        <p>{t('aiSettings.connect.subtitle')}</p>
                    </div>
                    <button type="button" className="ai-settings__url" onClick={() => void copy('url', url)} title={t('settings.mcp.copy')}>
                        <code>{url}</code>
                        <span className="material-symbols-outlined" aria-hidden="true">{copied === 'url' ? 'check' : 'content_copy'}</span>
                    </button>
                </header>

                <div className="ai-settings__clients" role="tablist">
                    {AI_CLIENTS.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            role="tab"
                            aria-selected={entry.id === clientId}
                            className={`ai-settings__client ${entry.id === clientId ? 'is-active' : ''}`.trim()}
                            onClick={() => setClientId(entry.id)}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">{entry.icon}</span>
                            {entry.id === 'other' ? t('aiSettings.clients.other') : entry.name}
                        </button>
                    ))}
                </div>

                <ol className="ai-settings__steps">
                    {t(`aiSettings.clients.${client.id}.steps`).split('\n').map((step) => (
                        <li key={step}>{step.replace('{url}', url)}</li>
                    ))}
                </ol>

                {client.installUrl && (
                    <a className="btn btn--md btn--primary ai-settings__install" href={client.installUrl(url)}>
                        <span className="material-symbols-outlined" aria-hidden="true">download</span>
                        {t('aiSettings.connect.install').replace('{client}', client.name)}
                    </a>
                )}

                {client.code && (
                    <div className="mcp-connect__code">
                        <pre>{client.code(url)}</pre>
                        <button type="button" className="mcp-connect__copy" onClick={() => void copy('code', client.code!(url))}>
                            <span className="material-symbols-outlined" aria-hidden="true">{copied === 'code' ? 'check' : 'content_copy'}</span>
                            {copied === 'code' ? t('settings.mcp.copied') : t('settings.mcp.copy')}
                        </button>
                    </div>
                )}
                <p className="ai-settings__note">{t('aiSettings.connect.note')}</p>
            </section>

            {/* Connections */}
            <section className="ai-settings__card">
                <header className="ai-settings__head">
                    <div>
                        <h3>{t('aiSettings.connections.title')}</h3>
                        <p>{t('aiSettings.connections.subtitle')}</p>
                    </div>
                    {isAdmin && (
                        <label className="ai-settings__inline-switch">
                            <span>{t('aiSettings.connections.showAll')}</span>
                            <SettingsSwitch checked={showAll} onChange={setShowAll} label={t('aiSettings.connections.showAll')} />
                        </label>
                    )}
                </header>
                {connections.length === 0 ? (
                    <p className="ai-settings__empty">{t('aiSettings.connections.empty')}</p>
                ) : (
                    <ul className="ai-settings__list">
                        {connections.map((connection) => (
                            <li key={connection.id}>
                                <span className="material-symbols-outlined ai-settings__list-icon" aria-hidden="true">
                                    {connection.kind === 'oauth' ? 'smart_toy' : 'key'}
                                </span>
                                <div className="ai-settings__list-main">
                                    <strong>{connection.clientName}</strong>
                                    <span>
                                        {t(connection.kind === 'oauth' ? 'aiSettings.connections.oauth' : 'aiSettings.connections.token')}
                                        {connection.tokenPrefix ? ` · ${connection.tokenPrefix}…` : ''} · {scopeSummary(connection.scopes)}
                                        {!connection.isMine ? ` · ${t('aiSettings.connections.otherUser')}` : ''}
                                    </span>
                                    <span>
                                        {t('aiSettings.connections.lastUsed').replace('{date}', formatDate(connection.lastUsedAt))}
                                        {connection.expiresAt ? ` · ${t('aiSettings.connections.expires').replace('{date}', formatDate(connection.expiresAt))}` : ''}
                                    </span>
                                </div>
                                <button type="button" className="btn btn--sm btn--ghost" onClick={() => void revoke(connection)}>
                                    {t('aiSettings.connections.revoke')}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Personal access tokens */}
            <section className="ai-settings__card">
                <header className="ai-settings__head">
                    <div>
                        <h3>{t('aiSettings.tokens.title')}</h3>
                        <p>{t('aiSettings.tokens.subtitle')}</p>
                    </div>
                </header>
                {policy && !policy.allowPersonalTokens ? (
                    <p className="ai-settings__empty">{t('aiSettings.tokens.disabled')}</p>
                ) : newToken ? (
                    <div className="ai-settings__token">
                        <p className="ai-settings__warning">{t('aiSettings.tokens.copyNow')}</p>
                        <div className="mcp-connect__code">
                            <pre>{newToken}</pre>
                            <button type="button" className="mcp-connect__copy" onClick={() => void copy('token', newToken)}>
                                <span className="material-symbols-outlined" aria-hidden="true">{copied === 'token' ? 'check' : 'content_copy'}</span>
                                {copied === 'token' ? t('settings.mcp.copied') : t('settings.mcp.copy')}
                            </button>
                        </div>
                        <div className="mcp-connect__code">
                            <pre>{`claude mcp add --transport http projectflow ${url} \\\n  --header "Authorization: Bearer ${newToken}"`}</pre>
                        </div>
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setNewToken(null)}>{t('aiSettings.tokens.done')}</button>
                    </div>
                ) : (
                    <div className="ai-settings__form">
                        <input
                            className="ai-settings__input"
                            value={tokenName}
                            maxLength={80}
                            placeholder={t('aiSettings.tokens.namePlaceholder')}
                            onChange={(event) => setTokenName(event.target.value)}
                            aria-label={t('aiSettings.tokens.name')}
                        />
                        <select className="ai-settings__input" value={tokenPreset} onChange={(event) => setTokenPreset(event.target.value as TokenPreset)} aria-label={t('aiSettings.tokens.access')}>
                            {presets.map((preset) => <option key={preset} value={preset}>{t(`aiSettings.scopes.${preset}`)}</option>)}
                        </select>
                        <select className="ai-settings__input" value={tokenDays} onChange={(event) => setTokenDays(Number(event.target.value))} aria-label={t('aiSettings.tokens.expiry')}>
                            {[30, 90, 365].map((days) => <option key={days} value={days}>{t('aiSettings.tokens.days').replace('{days}', String(days))}</option>)}
                        </select>
                        <button type="button" className="btn btn--md btn--primary" disabled={busy || !tokenName.trim()} onClick={() => void createToken()}>
                            {t('aiSettings.tokens.create')}
                        </button>
                    </div>
                )}
            </section>

            {/* Workspace policy */}
            {policy && (
                <section className="ai-settings__card">
                    <header className="ai-settings__head">
                        <div>
                            <h3>{t('aiSettings.policy.title')}</h3>
                            <p>{t(isAdmin ? 'aiSettings.policy.subtitle' : 'aiSettings.policy.readOnly')}</p>
                        </div>
                    </header>
                    <ul className="ai-settings__policy">
                        {POLICY_KEYS.map((key) => (
                            <li key={key}>
                                <div>
                                    <strong>{t(`aiSettings.policy.${key}`)}</strong>
                                    <span>{t(`aiSettings.policy.${key}.hint`)}</span>
                                </div>
                                <SettingsSwitch
                                    checked={policy[key]}
                                    disabled={!isAdmin || (key !== 'enabled' && !isInAppKey(key) && !policy.enabled)}
                                    onChange={(value) => void changePolicy(key, value)}
                                    label={t(`aiSettings.policy.${key}`)}
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Audit */}
            {isAdmin && (
                <section className="ai-settings__card">
                    <header className="ai-settings__head">
                        <div>
                            <h3>{t('aiSettings.audit.title')}</h3>
                            <p>{t('aiSettings.audit.subtitle')}</p>
                        </div>
                    </header>
                    {audit.length === 0 ? (
                        <p className="ai-settings__empty">{t('aiSettings.audit.empty')}</p>
                    ) : (
                        <ul className="ai-settings__audit">
                            {audit.map((entry) => (
                                <li key={entry.id}>
                                    <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                                    <strong>{entry.clientName || entry.credentialLabel || entry.kind}</strong>
                                    <code>{entry.method} {entry.path.replace(/^\/projectflow/, '')}</code>
                                    <span className={entry.status >= 400 ? 'is-error' : undefined}>{entry.status}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
};
