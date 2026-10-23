import React, { useState } from 'react';
import { adminApi } from '../lib/api';
import { compact, dateTime, num, pct, relative, usd } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { AreaChart, Legend, Meter, Sparkline } from '../ui/charts';
import { DataTable, type Column } from '../ui/DataTable';
import { useUi } from '../ui/Overlay';
import { Badge, Card, ErrorNote, PageHead, Segmented, Skeleton, Stat, Tabs } from '../ui/primitives';
import { UserDrawer } from './Users';

type UsageRow = { uid: string; email: string; tenantId: string | null; tenantName: string | null; text: number; image: number; monthTokens: number; monthImages: number; series: number[]; peakDay: number; costUsd: number; tokenShare: number };
type Usage = { days: string[]; text: number[]; images: number[]; users: UsageRow[]; workspaces: { tenantId: string; name: string; users: number; monthTokens: number; monthImages: number; costUsd: number; text: number }[]; limits: { dailyText: number; dailyImage: number; monthlyTokens: number; monthlyImages: number }; pricing: { usdPerMTokens: number; usdPerImage: number }; month: { tokens: number; images: number; costUsd: number } };
type Grant = { id: string; uid: string; email: string; tenantId: string; tenantName: string; kind: string; clientName: string; scopes: string[]; tokenPrefix: string | null; createdAt: number | null; lastUsedAt: number | null; revokedAt: number | null; expiresAt: number | null };
type Client = { id: string; name: string; clientId: string; source: string; verified: boolean; redirectUris: string[]; clientUri: string | null; createdAt: number | null; activeGrants: number };
type AuditEntry = { id: string; tenantId: string; kind: string; actorId: string; credentialLabel: string; clientName: string; permission: string; method: string; path: string; status: number | null; createdAt: number | null };

const UsageTab: React.FC<{ onUser: (uid: string) => void }> = ({ onUser }) => {
    const [days, setDays] = useState('30');
    const { data, loading, error, reload } = useAdminQuery<Usage>('ai.overview', { days: Number(days) });
    if (loading && !data) return <Skeleton rows={10} />;
    if (!data) return <ErrorNote error={error} onRetry={reload} />;
    const columns: Column<UsageRow>[] = [
        { key: 'email', label: 'Nutzer', render: (r) => <span className="ac-strong">{r.email}</span> },
        { key: 'tenantName', label: 'Workspace (zuletzt)', render: (r) => <span className="ac-muted">{r.tenantName || '–'}</span> },
        { key: 'series', label: 'Anfragen', value: (r) => r.text, render: (r) => <div className="ac-row" style={{ flexWrap: 'nowrap' }}><div style={{ width: 90 }}><Sparkline values={r.series} height={20} color="var(--ac-chart-2)" /></div>{num(r.text)}</div> },
        { key: 'image', label: 'Bilder', num: true },
        { key: 'monthTokens', label: 'Tokens (Monat)', num: true, render: (r) => compact(r.monthTokens) },
        { key: 'tokenShare', label: 'vom Limit', render: (r) => <div style={{ width: 90 }} title={pct(r.tokenShare)}><Meter value={r.tokenShare} color={r.tokenShare > 0.8 ? 'var(--color-error)' : undefined} /></div> },
        { key: 'peakDay', label: 'Spitze/Tag', num: true, render: (r) => <span title={`Limit ${data.limits.dailyText}/Tag`}>{num(r.peakDay)}</span> },
        { key: 'costUsd', label: 'Kosten (Monat)', num: true, render: (r) => usd(r.costUsd) },
    ];
    return (
        <div className="ac-stack">
            <div className="ac-row"><Segmented value={days} onChange={setDays} options={[{ value: '7', label: '7 T.' }, { value: '30', label: '30 T.' }, { value: '90', label: '90 T.' }]} /></div>
            <div className="ac-grid ac-grid--stats">
                <Stat label="Kosten (Monat, geschätzt)" value={usd(data.month.costUsd)} meta={`${usd(data.pricing.usdPerMTokens)}/1M Tokens · ${usd(data.pricing.usdPerImage)}/Bild`} />
                <Stat label="Tokens (Monat)" value={compact(data.month.tokens)} meta={`${num(data.month.images)} Bilder`} />
                <Stat label="Anfragen im Zeitraum" value={num(data.text.reduce((a, b) => a + b, 0))} series={data.text} color="var(--ac-chart-2)" />
                <Stat label="Aktive KI-Nutzer" value={num(data.users.length)} meta={`Limits: ${data.limits.dailyText}/Tag, ${compact(data.limits.monthlyTokens)} Tokens/Monat`} />
            </div>
            <Card title="Anfragen pro Tag" actions={<Legend series={[{ label: 'Text', values: [], color: 'var(--ac-chart-2)' }, { label: 'Bilder', values: [], color: 'var(--ac-chart-4)' }]} />}>
                <AreaChart days={data.days} bars series={[{ label: 'Text', values: data.text, color: 'var(--ac-chart-2)' }, { label: 'Bilder', values: data.images, color: 'var(--ac-chart-4)' }]} />
            </Card>
            <DataTable id="ai-users" rows={data.users} columns={columns} rowKey={(r) => r.uid} onOpen={(r) => onUser(r.uid)} defaultSort={{ key: 'monthTokens', dir: 'desc' }} emptyTitle="Keine KI-Nutzung im Zeitraum" />
            <Card title="Pro Workspace" subtitle="Zuordnung über den zuletzt aktiven Workspace der Person" flush>
                <table className="ac-table"><thead><tr><th>Workspace</th><th className="is-num">Nutzer</th><th className="is-num">Anfragen</th><th className="is-num">Tokens (Monat)</th><th className="is-num">Kosten</th></tr></thead>
                    <tbody>{data.workspaces.sort((a, b) => b.monthTokens - a.monthTokens).map((w) => <tr key={w.tenantId}><td className="ac-strong">{w.name}</td><td className="is-num">{num(w.users)}</td><td className="is-num">{num(w.text)}</td><td className="is-num">{compact(w.monthTokens)}</td><td className="is-num">{usd(w.costUsd)}</td></tr>)}</tbody></table>
            </Card>
        </div>
    );
};

const GrantsTab: React.FC<{ onUser: (uid: string) => void }> = ({ onUser }) => {
    const { confirm, toast } = useUi();
    const [state, setState] = useState('active');
    const [search, setSearch] = useState('');
    const { data, loading, error, reload } = useAdminQuery<{ grants: Grant[] }>('ai.grants');
    const q = search.trim().toLowerCase();
    const rows = (data?.grants || []).filter((g) => (state === 'all' || (state === 'active' ? !g.revokedAt : Boolean(g.revokedAt))) && (!q || `${g.clientName} ${g.email} ${g.tenantName}`.toLowerCase().includes(q)));
    const revoke = async (g: Grant) => {
        if (!(await confirm({ title: `„${g.clientName || 'Token'}“ von ${g.email} trennen?`, message: 'Widerruft die Verbindung und löscht alle Tokens. Wird protokolliert.', danger: true, confirmLabel: 'Trennen' }))) return;
        try { await adminApi('users.revokeGrant', { grantId: g.id }); toast('Verbindung getrennt'); reload(); } catch (err: any) { toast(err.message, 'error'); }
    };
    const columns: Column<Grant>[] = [
        { key: 'clientName', label: 'Client', render: (g) => <span className="ac-strong">{g.clientName || (g.kind === 'personal-token' ? `PAT ${g.tokenPrefix || ''}` : '?')}</span> },
        { key: 'kind', label: 'Art', render: (g) => (g.revokedAt ? <Badge>getrennt</Badge> : <Badge tone={g.kind === 'oauth' ? 'blue' : 'violet'}>{g.kind === 'oauth' ? 'OAuth' : 'PAT'}</Badge>) },
        { key: 'email', label: 'Nutzer', render: (g) => <button className="ac-btn ac-btn--ghost ac-btn--sm" onClick={(e) => { e.stopPropagation(); onUser(g.uid); }}>{g.email}</button> },
        { key: 'tenantName', label: 'Workspace' },
        { key: 'scopes', label: 'Scopes', value: (g) => g.scopes.join(' '), render: (g) => <span className="ac-muted" title={g.scopes.join('\n')}>{g.scopes.length}</span> },
        { key: 'lastUsedAt', label: 'Zuletzt', render: (g) => relative(g.lastUsedAt) },
        { key: 'createdAt', label: 'Erstellt', render: (g) => dateTime(g.createdAt) },
        { key: 'actions', label: '', value: () => '', render: (g) => (!g.revokedAt ? <button className="ac-btn ac-btn--sm ac-btn--danger" onClick={(e) => { e.stopPropagation(); void revoke(g); }}>Trennen</button> : null) },
    ];
    return (
        <>
            <ErrorNote error={error} onRetry={reload} />
            <DataTable id="ai-grants" rows={data ? rows : null} loading={loading} columns={columns} rowKey={(g) => g.id} defaultSort={{ key: 'lastUsedAt', dir: 'desc' }}
                toolbar={<><div className="ac-search"><input className="ac-input" placeholder="Client, Nutzer, Workspace …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                    <Segmented value={state} onChange={setState} options={[{ value: 'active', label: 'Aktiv' }, { value: 'revoked', label: 'Getrennt' }, { value: 'all', label: 'Alle' }]} /></>} />
        </>
    );
};

const ClientsTab: React.FC = () => {
    const { data, loading, error, reload } = useAdminQuery<{ clients: Client[] }>('ai.clients');
    const columns: Column<Client>[] = [
        { key: 'name', label: 'Client', render: (c) => <span className="ac-strong">{c.name}</span> },
        { key: 'source', label: 'Registrierung', render: (c) => <Badge tone={c.source === 'cimd' ? 'blue' : 'violet'} plain>{c.source === 'cimd' ? 'Metadata-Dokument' : 'Dynamisch (DCR)'}</Badge> },
        { key: 'verified', label: 'Verifiziert', value: (c) => (c.verified ? 1 : 0), render: (c) => (c.verified ? <Badge tone="green">ja</Badge> : <span className="ac-muted">nein</span>) },
        { key: 'activeGrants', label: 'Aktive Verbindungen', num: true },
        { key: 'redirectUris', label: 'Redirect-URIs', value: (c) => c.redirectUris.join(' '), render: (c) => <span className="mono ac-muted" title={c.redirectUris.join('\n')}>{c.redirectUris[0] || '–'}{c.redirectUris.length > 1 ? ` +${c.redirectUris.length - 1}` : ''}</span> },
        { key: 'createdAt', label: 'Erstellt', render: (c) => dateTime(c.createdAt) },
        { key: 'clientId', label: 'Client-ID', hidden: true, render: (c) => <span className="mono">{c.clientId}</span> },
    ];
    return <><ErrorNote error={error} onRetry={reload} /><DataTable id="ai-clients" rows={data?.clients ?? null} loading={loading} columns={columns} rowKey={(c) => c.id} defaultSort={{ key: 'activeGrants', dir: 'desc' }} emptyTitle="Keine OAuth-Clients registriert" /></>;
};

const AuditTab: React.FC = () => {
    const [search, setSearch] = useState('');
    const { data, loading, error, reload } = useAdminQuery<{ entries: AuditEntry[] }>('ai.audit', { limit: 500 });
    const q = search.trim().toLowerCase();
    const rows = (data?.entries || []).filter((e) => !q || `${e.clientName} ${e.path} ${e.permission} ${e.credentialLabel} ${e.tenantId}`.toLowerCase().includes(q));
    const columns: Column<AuditEntry>[] = [
        { key: 'createdAt', label: 'Zeit', render: (e) => <span title={dateTime(e.createdAt)}>{relative(e.createdAt)}</span> },
        { key: 'clientName', label: 'Client', render: (e) => <span className="ac-strong">{e.clientName || e.credentialLabel || e.kind}</span> },
        { key: 'method', label: 'Anfrage', value: (e) => `${e.method} ${e.path}`, render: (e) => <span className="mono">{e.method} {e.path}</span> },
        { key: 'permission', label: 'Recht', render: (e) => <span className="mono ac-muted">{e.permission}</span> },
        { key: 'status', label: 'Status', num: true, render: (e) => <Badge tone={(e.status ?? 0) >= 400 ? 'red' : 'green'} plain>{e.status ?? '–'}</Badge> },
        { key: 'tenantId', label: 'Workspace', render: (e) => <span className="mono ac-muted">{e.tenantId}</span> },
        { key: 'actorId', label: 'Akteur', hidden: true },
    ];
    return <><ErrorNote error={error} onRetry={reload} /><DataTable id="ai-audit" rows={data ? rows : null} loading={loading} columns={columns} rowKey={(e) => `${e.tenantId}/${e.id}`} defaultSort={{ key: 'createdAt', dir: 'desc' }} emptyTitle="Keine API-/MCP-Zugriffe protokolliert" toolbar={<div className="ac-search"><input className="ac-input" placeholder="Client, Pfad, Recht …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>} /></>;
};

export const AiScreen: React.FC = () => {
    const [tab, setTab] = useState('usage');
    const [user, setUser] = useState<string | null>(null);
    return (
        <div className="ac-page">
            <PageHead title="KI & MCP" subtitle="In-App-KI (Kontingente in ai_usage_quotas), MCP/OAuth-Verbindungen, registrierte Clients und das API-Zugriffsprotokoll." />
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'usage', label: 'Nutzung & Kosten' }, { value: 'grants', label: 'Verbindungen' }, { value: 'clients', label: 'OAuth-Clients' }, { value: 'audit', label: 'API-Protokoll' }]} />
            {tab === 'usage' && <UsageTab onUser={setUser} />}
            {tab === 'grants' && <GrantsTab onUser={setUser} />}
            {tab === 'clients' && <ClientsTab />}
            {tab === 'audit' && <AuditTab />}
            {user && <UserDrawer uid={user} onClose={() => setUser(null)} />}
        </div>
    );
};
