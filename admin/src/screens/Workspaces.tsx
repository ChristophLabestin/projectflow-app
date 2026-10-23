import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../lib/api';
import { dateTime, num, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { AreaChart } from '../ui/charts';
import { DataTable, type Column } from '../ui/DataTable';
import { Drawer, useUi } from '../ui/Overlay';
import { Badge, Card, Empty, ErrorNote, PageHead, Segmented, Skeleton, Tabs } from '../ui/primitives';
import { dayKeyList } from '../lib/days';
import { GrantsTable, roleTone, UserDrawer } from './Users';

type Ws = { id: string; name: string; ownerId: string | null; ownerEmail: string | null; createdAt: number | null; suspendedAt: number | null; members: number; guests: number; projects: number; lastProjectUpdate: number | null; grants: number; aiEnabled: boolean };
type Policy = { enabled: boolean; allowGuests: boolean; allowDeleteScopes: boolean; allowPersonalTokens: boolean; inAppEnabled: boolean; inAppAi: boolean; monthlyCredits?: number | null };
type WsDetail = {
    id: string; name: string; ownerId: string | null; createdAt: number | null; suspendedAt: number | null; suspendedReason: string | null; suspensionLog: { id: string; suspended: boolean; reason: string; email: string; at: number | null }[]; modules: string[] | null;
    members: { uid: string; email: string; displayName: string; role: string; joinedAt: number | null; lastActiveAt: number | null }[];
    projects: { id: string; title: string; status: string; updatedAt: number | null; createdAt: number | null }[];
    aiPolicy: Policy; credits: { month: string; credits: number; limit: number | null; requests: number; costMicros: number; defaultLimit: number }; grants: any[]; machineWrites: { day: string; writes: number }[];
    apiTokens: { id: string; name: string; createdAt: number | null; lastUsedAt: number | null; expiresAt: number | null; permissions: string[] }[];
    activity: { id: string; type: string; actor: string; object: string; projectTitle: string | null; createdAt: number | null }[];
};

type PolicyFlag = 'enabled' | 'allowGuests' | 'allowDeleteScopes' | 'allowPersonalTokens' | 'inAppAi' | 'inAppEnabled';
const POLICY_LABEL: Record<PolicyFlag, string> = { inAppAi: 'In-App-KI freigeschaltet (Rollout)', inAppEnabled: 'In-App-KI vom Workspace eingeschaltet', enabled: 'KI-/MCP-Zugriff erlaubt', allowGuests: 'Gäste dürfen verbinden', allowDeleteScopes: 'Lösch-Scopes erlaubt', allowPersonalTokens: 'Persönliche Tokens erlaubt' };

const CreditsCard: React.FC<{ id: string; credits: WsDetail['credits']; override: number | null; onSaved: () => void }> = ({ id, credits, override, onSaved }) => {
    const { toast } = useUi();
    const [value, setValue] = useState(override ? String(override) : '');
    const save = async (monthlyCredits: number | null) => {
        try { await adminApi('workspaces.setAiPolicy', { id, policy: { monthlyCredits } }); toast('Credit-Limit gespeichert'); onSaved(); } catch (err: any) { toast(err.message, 'error'); }
    };
    const limit = credits.limit || override || credits.defaultLimit;
    return (
        <Card title={`In-App-KI-Credits ${credits.month}`} subtitle={`${num(credits.credits)} von ${num(limit)} · ${num(credits.requests)} Anfragen · ca. ${(credits.costMicros / 1_000_000).toFixed(2).replace('.', ',')} $`}>
            <div className="ac-row">
                <input className="ac-input" type="number" min={1} placeholder={`Default ${credits.defaultLimit}`} value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 160 }} />
                <button className="ac-btn ac-btn--primary" disabled={!value || Number(value) === override} onClick={() => save(Math.floor(Number(value)))}>Limit setzen</button>
                {override && <button className="ac-btn" onClick={() => { setValue(''); void save(null); }}>Auf Default</button>}
            </div>
        </Card>
    );
};

const SuspendCard: React.FC<{ data: WsDetail; onSaved: () => void }> = ({ data, onSaved }) => {
    const { confirm, toast } = useUi();
    const [reason, setReason] = useState('');
    const suspend = !data.suspendedAt;
    const run = async () => {
        const ok = await confirm({
            title: suspend ? `„${data.name}“ sperren?` : `„${data.name}“ freigeben?`,
            message: suspend
                ? `Alle ${data.members.length} Mitglieder verlieren sofort den Zugriff auf Projekte, Aufgaben und Dateien. API-/MCP-Tokens, Flows, Erinnerungen und Briefings stoppen (spätestens nach 60 s). Daten bleiben erhalten.`
                : 'Der Workspace ist danach sofort wieder nutzbar.',
            danger: suspend,
            confirmLabel: suspend ? 'Sperren' : 'Freigeben',
            requireText: suspend ? data.name : undefined,
        });
        if (!ok) return;
        try { await adminApi('workspaces.setSuspended', { id: data.id, suspended: suspend, reason }); toast(suspend ? 'Workspace gesperrt' : 'Workspace freigegeben'); setReason(''); onSaved(); } catch (err: any) { toast(err.message, 'error'); }
    };
    return (
        <Card title={suspend ? 'Workspace sperren' : 'Gesperrt'} subtitle={data.suspendedAt ? `seit ${dateTime(data.suspendedAt)} · ${data.suspendedReason || ''}` : 'Sperrt alle Daten-, Token- und Automationszugriffe. Begründung ist Pflicht und wird protokolliert.'}>
            <div className="ac-stack">
                <textarea className="ac-textarea" rows={2} placeholder="Begründung (mind. 10 Zeichen, z. B. Missbrauchsmeldung #123)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div><button className={`ac-btn ${suspend ? 'ac-btn--danger' : 'ac-btn--primary'}`} disabled={reason.trim().length < 10} onClick={run}>{suspend ? 'Sperren …' : 'Freigeben …'}</button></div>
                {data.suspensionLog.length > 0 && (
                    <table className="ac-table"><thead><tr><th>Zeit</th><th>Aktion</th><th>Begründung</th><th>Admin</th></tr></thead>
                        <tbody>{data.suspensionLog.map((l) => <tr key={l.id}><td>{dateTime(l.at)}</td><td>{l.suspended ? <Badge tone="red">gesperrt</Badge> : <Badge tone="green">freigegeben</Badge>}</td><td className="is-wrap">{l.reason}</td><td className="ac-muted">{l.email}</td></tr>)}</tbody></table>
                )}
            </div>
        </Card>
    );
};

const WorkspaceDrawer: React.FC<{ id: string; onClose: () => void; onOpenUser: (uid: string) => void }> = ({ id, onClose, onOpenUser }) => {
    const { confirm, toast } = useUi();
    const { data, loading, error, reload } = useAdminQuery<WsDetail>('workspaces.get', { id });
    const [tab, setTab] = useState('members');
    const days = dayKeyList(30);

    const setPolicy = async (key: PolicyFlag, value: boolean) => {
        if (!(await confirm({ title: `${POLICY_LABEL[key]}: ${value ? 'an' : 'aus'}?`, message: 'Ändert die KI-Policy dieses Workspaces (wirkt nach spätestens 60 s auf MCP/API-Zugriffe). Wird protokolliert.', danger: !value && key === 'enabled', confirmLabel: 'Ändern' }))) return;
        try { await adminApi('workspaces.setAiPolicy', { id, policy: { [key]: value } }); toast('Policy geändert'); reload(); } catch (err: any) { toast(err.message, 'error'); }
    };
    const revoke = async (g: any) => {
        if (!(await confirm({ title: `„${g.clientName || 'Token'}“ trennen?`, message: 'Widerruft die Verbindung und löscht ihre Tokens.', danger: true, confirmLabel: 'Trennen' }))) return;
        try { await adminApi('users.revokeGrant', { grantId: g.id }); toast('Verbindung getrennt'); reload(); } catch (err: any) { toast(err.message, 'error'); }
    };

    return (
        <Drawer wide title={data?.name || 'Workspace'} subtitle={<span className="mono">{id}</span>} onClose={onClose}>
            {loading && !data ? <Skeleton rows={10} /> : !data ? <ErrorNote error={error} onRetry={reload} /> : (
                <>
                    <dl className="ac-kv">
                        <dt>Erstellt</dt><dd>{dateTime(data.createdAt)}</dd>
                        <dt>Owner</dt><dd>{data.members.find((m) => m.uid === data.ownerId)?.email || data.ownerId}</dd>
                        <dt>Status</dt><dd>{data.suspendedAt ? <Badge tone="red">gesperrt seit {dateTime(data.suspendedAt)}</Badge> : <Badge tone="green">aktiv</Badge>}</dd>
                        {data.modules && <><dt>Module</dt><dd>{data.modules.join(', ')}</dd></>}
                    </dl>
                    <Tabs value={tab} onChange={setTab} tabs={[
                        { value: 'members', label: `Mitglieder ${data.members.length}` },
                        { value: 'projects', label: `Projekte ${data.projects.length}` },
                        { value: 'ai', label: 'KI & API' },
                        { value: 'activity', label: 'Aktivität' },
                        { value: 'status', label: data.suspendedAt ? 'Sperre ●' : 'Sperre' },
                    ]} />
                    {tab === 'status' && <SuspendCard data={data} onSaved={reload} />}
                    {tab === 'members' && (
                        <table className="ac-table"><thead><tr><th>Mitglied</th><th>Rolle</th><th>Beigetreten</th><th>Zuletzt aktiv</th></tr></thead>
                            <tbody>{data.members.sort((a, b) => ['Owner', 'Admin', 'Member', 'Guest'].indexOf(a.role) - ['Owner', 'Admin', 'Member', 'Guest'].indexOf(b.role)).map((m) => (
                                <tr key={m.uid} className="is-clickable" onClick={() => onOpenUser(m.uid)}><td><span className="ac-strong">{m.displayName || m.email}</span> {m.displayName && <span className="ac-muted">{m.email}</span>}</td><td><Badge tone={roleTone(m.role)}>{m.role}</Badge></td><td>{dateTime(m.joinedAt)}</td><td>{relative(m.lastActiveAt)}</td></tr>
                            ))}</tbody></table>
                    )}
                    {tab === 'projects' && (data.projects.length ? (
                        <table className="ac-table"><thead><tr><th>Projekt</th><th>Status</th><th>Geändert</th><th>Erstellt</th></tr></thead>
                            <tbody>{data.projects.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).map((p) => <tr key={p.id}><td className="ac-strong">{p.title}</td><td><Badge plain>{p.status || '–'}</Badge></td><td>{relative(p.updatedAt)}</td><td>{dateTime(p.createdAt)}</td></tr>)}</tbody></table>
                    ) : <Empty title="Keine Projekte" />)}
                    {tab === 'ai' && (
                        <div className="ac-stack">
                            <Card title="KI-Policy (MCP/API)">
                                <div className="ac-stack">{(Object.keys(POLICY_LABEL) as PolicyFlag[]).map((key) => (
                                    <label key={key} className="ac-check"><input type="checkbox" checked={data.aiPolicy[key] === true} onChange={(e) => setPolicy(key, e.target.checked)} />{POLICY_LABEL[key]}</label>
                                ))}</div>
                            </Card>
                            <CreditsCard id={id} credits={data.credits} override={data.aiPolicy.monthlyCredits ?? null} onSaved={reload} />
                            <Card title="Maschinen-Schreibzugriffe pro Tag" subtitle="Abuse-Bremse 5.000/Tag">
                                <AreaChart days={days} bars series={[{ label: 'Writes', values: days.map((d) => data.machineWrites.find((w) => w.day === d)?.writes || 0) }]} height={140} />
                            </Card>
                            <Card title="Verbindungen" flush><GrantsTable grants={data.grants} onRevoke={revoke} /></Card>
                            <Card title="Workspace-API-Tokens" flush>
                                {data.apiTokens.length ? <table className="ac-table"><thead><tr><th>Name</th><th>Rechte</th><th>Zuletzt</th><th>Läuft ab</th></tr></thead>
                                    <tbody>{data.apiTokens.map((t) => <tr key={t.id}><td className="ac-strong">{t.name}</td><td className="ac-muted" title={t.permissions.join(', ')}>{t.permissions.length}</td><td>{relative(t.lastUsedAt)}</td><td>{dateTime(t.expiresAt)}</td></tr>)}</tbody></table> : <Empty title="Keine API-Tokens" />}
                            </Card>
                        </div>
                    )}
                    {tab === 'activity' && (data.activity.length ? (
                        <table className="ac-table"><thead><tr><th>Zeit</th><th>Wer</th><th>Ereignis</th><th>Objekt</th></tr></thead>
                            <tbody>{data.activity.map((e) => <tr key={e.id}><td>{relative(e.createdAt)}</td><td>{e.actor}</td><td><Badge plain>{e.type}</Badge></td><td>{e.object}{e.projectTitle ? <span className="ac-muted"> · {e.projectTitle}</span> : ''}</td></tr>)}</tbody></table>
                    ) : <Empty title="Keine Aktivität" />)}
                </>
            )}
        </Drawer>
    );
};

export const WorkspacesScreen: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const openId = params.get('id');
    const [user, setUser] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const { data, loading, error, reload } = useAdminQuery<{ workspaces: Ws[] }>('workspaces.list');
    const q = search.trim().toLowerCase();
    const rows = (data?.workspaces || []).filter((w) => (!q || `${w.name} ${w.ownerEmail} ${w.id}`.toLowerCase().includes(q))
        && (filter === 'all' || (filter === 'team' && w.members > 1) || (filter === 'mcp' && w.grants > 0) || (filter === 'empty' && w.projects === 0) || (filter === 'suspended' && Boolean(w.suspendedAt))));
    const setOpen = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('id', id); else n.delete('id'); return n; });

    const columns: Column<Ws>[] = [
        { key: 'name', label: 'Workspace', render: (w) => <span className="ac-row" style={{ flexWrap: 'nowrap' }}><span className="ac-strong">{w.name}</span>{w.suspendedAt && <Badge tone="red">gesperrt</Badge>}</span> },
        { key: 'ownerEmail', label: 'Owner', render: (w) => <span className="ac-muted">{w.ownerEmail || w.ownerId}</span> },
        { key: 'members', label: 'Mitglieder', num: true, render: (w) => <>{num(w.members)}{w.guests ? <span className="ac-muted"> +{w.guests} Gäste</span> : ''}</> },
        { key: 'projects', label: 'Projekte', num: true },
        { key: 'grants', label: 'MCP', num: true },
        { key: 'aiEnabled', label: 'KI', value: (w) => (w.aiEnabled ? 1 : 0), render: (w) => (w.aiEnabled ? <Badge tone="green" plain>an</Badge> : <Badge plain>aus</Badge>) },
        { key: 'lastProjectUpdate', label: 'Zuletzt geändert', render: (w) => relative(w.lastProjectUpdate) },
        { key: 'createdAt', label: 'Erstellt', render: (w) => <span title={dateTime(w.createdAt)}>{relative(w.createdAt)}</span> },
        { key: 'id', label: 'ID', hidden: true, render: (w) => <span className="mono ac-muted">{w.id}</span> },
    ];

    return (
        <div className="ac-page">
            <PageHead title="Workspaces" subtitle="Alle Arbeitsbereiche mit Mitgliedern, Projekten und KI-Verbindungen." actions={<button className="ac-btn" onClick={reload}>Aktualisieren</button>} />
            <ErrorNote error={error} onRetry={reload} />
            <DataTable id="workspaces" rows={data ? rows : null} loading={loading} columns={columns} rowKey={(w) => w.id} onOpen={(w) => setOpen(w.id)} selectedKey={openId} defaultSort={{ key: 'createdAt', dir: 'desc' }}
                toolbar={<>
                    <div className="ac-search"><input className="ac-input" placeholder="Name, Owner, ID …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                    <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Alle' }, { value: 'team', label: 'Teams' }, { value: 'mcp', label: 'Mit MCP' }, { value: 'empty', label: 'Leer' }, { value: 'suspended', label: 'Gesperrt' }]} />
                </>} />
            {openId && <WorkspaceDrawer id={openId} onClose={() => setOpen(null)} onOpenUser={setUser} />}
            {user && <UserDrawer uid={user} onClose={() => setUser(null)} />}
        </div>
    );
};
