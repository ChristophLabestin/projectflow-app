import React from 'react';
import { Copy, Power } from 'lucide-react';
import { adminApi } from '../lib/api';
import { dateTime, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { useUi } from '../ui/Overlay';
import { Badge, Card, Empty, ErrorNote, PageHead, Skeleton } from '../ui/primitives';

type Status = {
    enabled: boolean;
    clients: { id: string; name: string; status: string; redirectUris: string[]; createdAt: number | null; approvedAt: number | null }[];
    grants: { id: string; clientName: string; scopes: string[]; createdAt: number | null; expiresAt: number | null; revokedAt: number | null; lastUsedAt: number | null }[];
    pending: { id: string; action: string; summary: string; code: string; clientName: string; expiresAt: number | null; createdAt: number | null }[];
    audit: { id: string; at: number | null; action: string; target: string | null; summary: string | null; ok: boolean; error: string | null }[];
};

const mcpUrl = () => `${window.location.origin}/mcp`;

/** Admin MCP management: kill switch, connection URL, pending confirmations, clients, connections, MCP audit. */
export const McpAccess: React.FC = () => {
    const { confirm, toast } = useUi();
    const { data, loading, error, reload } = useAdminQuery<Status>('mcp.status');
    const act = async (action: string, params: unknown, ok: string, dialog?: { title: string; message: string; danger?: boolean; label: string }) => {
        if (dialog && !(await confirm({ title: dialog.title, message: dialog.message, danger: dialog.danger, confirmLabel: dialog.label }))) return;
        try { await adminApi(action, params); toast(ok); reload(); } catch (err: any) { toast(err.message, 'error'); }
    };
    if (loading && !data) return <div className="ac-page"><Skeleton rows={10} /></div>;
    if (!data) return <div className="ac-page"><ErrorNote error={error} onRetry={reload} /></div>;
    const now = Date.now();
    const activeGrants = data.grants.filter((g) => !g.revokedAt && (g.expiresAt ?? 0) > now);

    return (
        <div className="ac-page">
            <PageHead title="Admin-MCP" subtitle="KI-Zugriff auf diese Konsole — nur für dich: Claim + Allowlist + TOTP bei der Freigabe, Prüfung bei jedem Aufruf." actions={<button className="ac-btn" onClick={reload}>Aktualisieren</button>} />
            <div className="ac-stack">
                <Card title={<span className="ac-row"><Power size={15} />Status</span>} actions={data.enabled ? <Badge tone="green">eingeschaltet</Badge> : <Badge tone="red">aus</Badge>}>
                    <div className="ac-stack">
                        <div className="ac-row">
                            <code className="mono" style={{ padding: '6px 10px', border: '1px solid var(--color-surface-border)', borderRadius: 6 }}>{mcpUrl()}</code>
                            <button className="ac-btn ac-btn--sm" onClick={() => navigator.clipboard.writeText(mcpUrl()).then(() => toast('URL kopiert'))}><Copy size={13} />Kopieren</button>
                            <span style={{ flex: 1 }} />
                            {data.enabled
                                ? <button className="ac-btn ac-btn--danger" onClick={() => act('mcp.setEnabled', { enabled: false }, 'Admin-MCP ausgeschaltet', { title: 'Admin-MCP ausschalten?', message: 'Alle Verbindungen werden sofort abgewiesen (Kill-Switch). Freigaben bleiben bestehen und greifen nach dem Einschalten wieder.', danger: true, label: 'Ausschalten' })}>Ausschalten</button>
                                : <button className="ac-btn ac-btn--primary" onClick={() => act('mcp.setEnabled', { enabled: true }, 'Admin-MCP eingeschaltet', { title: 'Admin-MCP einschalten?', message: 'Danach können freigegebene Clients mit gültiger Verbindung zugreifen. Neue Verbindungen brauchen weiterhin deine Freigabe mit TOTP.', label: 'Einschalten' })}>Einschalten</button>}
                        </div>
                        <p className="ac-muted" style={{ margin: 0 }}>Claude Code: <code>claude mcp add --transport http projectflow-admin {mcpUrl()}</code>, dann in Claude <code>/mcp</code> → Authenticate. claude.ai: Einstellungen → Connectors → Custom Connector → URL einfügen.</p>
                    </div>
                </Card>

                <Card title="Ausstehende Bestätigungen" subtitle="Schreibaktionen des KI-Clients warten auf diesen Code (10 min gültig, 3 Versuche).">
                    {data.pending.length ? (
                        <table className="ac-table"><thead><tr><th>Code</th><th>Aktion</th><th>Client</th><th>Läuft ab</th><th /></tr></thead>
                            <tbody>{data.pending.map((p) => (
                                <tr key={p.id}><td><b className="mono" style={{ fontSize: 18, letterSpacing: 2 }}>{p.code}</b></td><td className="is-wrap">{p.summary}</td><td className="ac-muted">{p.clientName}</td><td>{relative(p.expiresAt)}</td>
                                    <td style={{ textAlign: 'right' }}><button className="ac-btn ac-btn--sm" onClick={() => act('mcp.cancelPending', { id: p.id }, 'Verworfen')}>Verwerfen</button></td></tr>
                            ))}</tbody></table>
                    ) : <Empty title="Nichts ausstehend" />}
                </Card>

                <div className="ac-grid ac-grid--2">
                    <Card title={`Verbindungen (${activeGrants.length} aktiv)`} flush>
                        {data.grants.length ? (
                            <table className="ac-table"><thead><tr><th>Client</th><th>Scopes</th><th>Zuletzt</th><th>Bis</th><th /></tr></thead>
                                <tbody>{data.grants.map((g) => {
                                    const live = !g.revokedAt && (g.expiresAt ?? 0) > now;
                                    return (
                                        <tr key={g.id}><td className="ac-strong">{g.clientName}</td><td>{g.scopes.map((s) => <Badge key={s} plain tone={s === 'admin:write' ? 'amber' : 'blue'}>{s}</Badge>)}</td><td>{relative(g.lastUsedAt)}</td>
                                            <td>{live ? dateTime(g.expiresAt) : <Badge>{g.revokedAt ? 'widerrufen' : 'abgelaufen'}</Badge>}</td>
                                            <td style={{ textAlign: 'right' }}>{live && <button className="ac-btn ac-btn--sm ac-btn--danger" onClick={() => act('mcp.revokeGrant', { grantId: g.id }, 'Verbindung widerrufen', { title: 'Verbindung widerrufen?', message: 'Alle Tokens dieser Verbindung werden sofort gelöscht.', danger: true, label: 'Widerrufen' })}>Widerrufen</button>}</td></tr>
                                    );
                                })}</tbody></table>
                        ) : <Empty title="Noch keine Verbindung" />}
                    </Card>
                    <Card title="Clients" flush>
                        {data.clients.length ? (
                            <table className="ac-table"><thead><tr><th>Client</th><th>Status</th><th>Redirect</th><th /></tr></thead>
                                <tbody>{data.clients.map((c) => (
                                    <tr key={c.id}><td className="ac-strong">{c.name}</td><td><Badge tone={c.status === 'approved' ? 'green' : c.status === 'revoked' ? 'neutral' : 'amber'}>{c.status}</Badge></td>
                                        <td className="mono ac-muted" title={c.redirectUris.join('\n')}>{c.redirectUris[0]}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {c.status !== 'approved' && c.status !== 'revoked' && <button className="ac-btn ac-btn--sm" onClick={() => act('mcp.setClientStatus', { clientId: c.id, status: 'approved' }, 'Client freigegeben')}>Freigeben</button>}
                                            {c.status !== 'revoked' && <button className="ac-btn ac-btn--sm ac-btn--danger" onClick={() => act('mcp.setClientStatus', { clientId: c.id, status: 'revoked' }, 'Client widerrufen', { title: `„${c.name}“ widerrufen?`, message: 'Der Client kann sich nicht mehr verbinden; alle seine Verbindungen werden getrennt.', danger: true, label: 'Widerrufen' })}>Widerrufen</button>}
                                        </td></tr>
                                ))}</tbody></table>
                        ) : <Empty title="Noch kein Client registriert" />}
                    </Card>
                </div>

                <Card title="Admin-MCP-Protokoll" flush>
                    {data.audit.length ? (
                        <table className="ac-table"><thead><tr><th>Zeit</th><th>Aufruf</th><th>Details</th></tr></thead>
                            <tbody>{data.audit.map((a) => <tr key={a.id}><td>{relative(a.at)}</td><td>{a.ok ? <Badge plain tone="blue">{a.action}</Badge> : <Badge tone="red">{a.action}</Badge>}</td><td className="ac-muted">{a.error || a.summary || a.target || '–'}</td></tr>)}</tbody></table>
                    ) : <Empty title="Noch keine Aufrufe" />}
                </Card>
            </div>
        </div>
    );
};
