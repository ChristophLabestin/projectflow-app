import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, Download, KeyRound, LogOut, ShieldCheck, Unplug } from 'lucide-react';
import { adminApi } from '../lib/api';
import { compact, dateTime, num, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { DataTable, type Column } from '../ui/DataTable';
import { Drawer, useUi } from '../ui/Overlay';
import { Badge, Card, Empty, ErrorNote, PageHead, Segmented, Skeleton, Tabs } from '../ui/primitives';

export type DirUser = { uid: string; email: string; displayName: string; photoURL: string; createdAt: number; lastSignInAt: number | null; lastActiveAt: number | null; providers: string[]; mfa: string[]; disabled: boolean; emailVerified: boolean; platformAdmin: boolean; workspaces: number; owner: number };
type Grant = { id: string; tenantId: string; kind: string; clientName: string; scopes: string[]; tokenPrefix: string | null; createdAt: number | null; lastUsedAt: number | null; revokedAt: number | null; expiresAt: number | null };
type Detail = {
    auth: DirUser & { customClaims: Record<string, unknown>; tokensValidAfter: number | null; mfaFactors: { factorId: string; displayName: string; enrolledAt: number | null }[] };
    profile: { displayName: string; language: string | null; lastTenantId: string | null; timezone: string | null; webPush: any; fcmTokens: number };
    memberships: { tenantId: string; tenantName: string; role: string; joinedAt: number | null; isOwner: boolean }[];
    devices: { id: string; platform: string; appVersion: string | null; locale: string | null; timezone: string | null; updatedAt: number | null; push: boolean }[];
    passkeys: { id: string; createdAt: number | null; lastUsedAt: number | null }[];
    consent: Record<string, { version: number; acceptedAt: number; platform: string; appVersion: string; decision?: string }>;
    grants: Grant[];
    ai: { monthTokens: number; monthImages: number; todayText: number; todayImages: number; totalTokens: number };
    activity: { id: string; tenantId: string; type: string; object: string; projectTitle: string | null; createdAt: number | null }[] | null;
};

const PROVIDER: Record<string, string> = { password: 'Passwort', 'google.com': 'Google', 'github.com': 'GitHub', 'apple.com': 'Apple' };
export const roleTone = (role: string) => (role === 'Owner' ? 'violet' : role === 'Admin' ? 'blue' : role === 'Guest' ? 'amber' : 'neutral');

export const GrantsTable: React.FC<{ grants: Grant[]; onRevoke: (g: Grant) => void; showTenant?: boolean }> = ({ grants, onRevoke, showTenant }) => (
    grants.length ? (
        <table className="ac-table">
            <thead><tr><th>Client</th><th>Art</th>{showTenant && <th>Workspace</th>}<th>Scopes</th><th>Zuletzt</th><th /></tr></thead>
            <tbody>
                {grants.map((g) => (
                    <tr key={g.id}>
                        <td className="ac-strong">{g.clientName || (g.kind === 'personal-token' ? `PAT ${g.tokenPrefix || ''}` : '?')}</td>
                        <td>{g.revokedAt ? <Badge tone="neutral">getrennt</Badge> : <Badge tone={g.kind === 'oauth' ? 'blue' : 'violet'}>{g.kind === 'oauth' ? 'OAuth' : 'PAT'}</Badge>}</td>
                        {showTenant && <td className="mono ac-muted">{g.tenantId}</td>}
                        <td className="ac-muted" title={g.scopes.join(' ')}>{g.scopes.length} Scopes</td>
                        <td>{relative(g.lastUsedAt)}</td>
                        <td style={{ textAlign: 'right' }}>{!g.revokedAt && <button className="ac-btn ac-btn--sm ac-btn--danger" onClick={() => onRevoke(g)}><Unplug size={13} />Trennen</button>}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    ) : <Empty title="Keine KI-/MCP-Verbindungen" />
);

const download = (filename: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const UserDrawer: React.FC<{ uid: string; onClose: () => void; onChanged?: () => void }> = ({ uid, onClose, onChanged }) => {
    const navigate = useNavigate();
    const { confirm, toast } = useUi();
    const { data, loading, error, reload } = useAdminQuery<Detail>('users.get', { uid });
    const [tab, setTab] = useState('account');
    const [busy, setBusy] = useState(false);

    const act = async (action: string, params: Record<string, unknown>, ok: string, opts: { title: string; message: React.ReactNode; danger?: boolean; requireText?: string; label: string }) => {
        if (!(await confirm({ title: opts.title, message: opts.message, danger: opts.danger, requireText: opts.requireText, confirmLabel: opts.label }))) return null;
        setBusy(true);
        try {
            const result = await adminApi(action, params);
            toast(ok);
            reload();
            onChanged?.();
            return result;
        } catch (err: any) {
            toast(err.message, 'error');
            return null;
        } finally {
            setBusy(false);
        }
    };

    const a = data?.auth;
    const exportData = async () => {
        const result = await act('users.export', { uid }, 'Export erstellt', { title: 'Datenexport erstellen?', message: 'Erstellt denselben JSON-Export wie „Meine Daten exportieren“ (Profil, Mitgliedschaften, Aufgaben, Zustimmungen …) und lädt ihn herunter. Nur für Auskunftsersuchen oder Support verwenden.', label: 'Export erstellen' }) as { filename: string; json: string } | null;
        if (result) download(result.filename, result.json);
    };

    return (
        <Drawer wide title={a ? (a.displayName || a.email) : 'Nutzer'} subtitle={a ? <><span className="mono">{a.uid}</span> · {a.email}</> : uid} onClose={onClose}
            footer={a && <>
                <button className="ac-btn" disabled={busy} onClick={exportData}><Download size={14} />Datenexport</button>
                <button className="ac-btn" disabled={busy} onClick={() => act('users.revokeSessions', { uid }, 'Alle Sitzungen widerrufen', { title: 'Alle Sitzungen widerrufen?', message: <>Meldet <b>{a.email}</b> auf allen Geräten ab (Web, Desktop, iOS). Die Person kann sich sofort wieder anmelden.</>, label: 'Widerrufen' })}><LogOut size={14} />Sitzungen widerrufen</button>
                <button className={`ac-btn ${a.disabled ? '' : 'ac-btn--danger'}`} disabled={busy} onClick={() => act('users.setDisabled', { uid, disabled: !a.disabled }, a.disabled ? 'Konto entsperrt' : 'Konto gesperrt', a.disabled
                    ? { title: 'Konto entsperren?', message: 'Die Person kann sich wieder anmelden.', label: 'Entsperren' }
                    : { title: 'Konto sperren?', message: <>Sperrt <b>{a.email}</b> sofort und meldet alle Geräte ab. Daten bleiben erhalten.</>, danger: true, requireText: a.email, label: 'Sperren' })}><Ban size={14} />{a.disabled ? 'Entsperren' : 'Sperren'}</button>
            </>}>
            {loading && !data ? <Skeleton rows={10} /> : !data ? <ErrorNote error={error} onRetry={reload} /> : (
                <>
                    <div className="ac-row">
                        {a!.disabled && <Badge tone="red">gesperrt</Badge>}
                        {a!.platformAdmin && <Badge tone="violet">Plattform-Admin</Badge>}
                        {a!.mfa.length ? <Badge tone="green">2FA</Badge> : <Badge>ohne 2FA</Badge>}
                        {a!.emailVerified ? <Badge tone="green">E-Mail bestätigt</Badge> : <Badge tone="amber">E-Mail unbestätigt</Badge>}
                        {a!.providers.map((p) => <Badge key={p} plain>{PROVIDER[p] || p}</Badge>)}
                    </div>
                    <Tabs value={tab} onChange={setTab} tabs={[
                        { value: 'account', label: 'Konto' },
                        { value: 'workspaces', label: `Workspaces ${data.memberships.length}` },
                        { value: 'devices', label: `Geräte ${data.devices.length + data.passkeys.length}` },
                        { value: 'ai', label: `KI ${data.grants.filter((g) => !g.revokedAt).length}` },
                        { value: 'consent', label: 'Zustimmungen' },
                        { value: 'activity', label: 'Aktivität' },
                    ]} />
                    {tab === 'account' && (
                        <dl className="ac-kv">
                            <dt>Registriert</dt><dd>{dateTime(a!.createdAt)}</dd>
                            <dt>Letzte Anmeldung</dt><dd>{dateTime(a!.lastSignInAt)}</dd>
                            <dt>Zuletzt aktiv</dt><dd>{relative(a!.lastActiveAt)}</dd>
                            <dt>Tokens gültig ab</dt><dd>{dateTime(a!.tokensValidAfter)}</dd>
                            <dt>2FA-Faktoren</dt><dd>{a!.mfaFactors.length ? a!.mfaFactors.map((f) => `${f.factorId}${f.displayName ? ` (${f.displayName})` : ''} seit ${dateTime(f.enrolledAt)}`).join(', ') : '–'}</dd>
                            <dt>Sprache / Zeitzone</dt><dd>{data.profile.language || '–'} / {data.profile.timezone || '–'}</dd>
                            <dt>Push</dt><dd>{data.profile.fcmTokens} FCM-Token{data.profile.webPush?.enabled ? ' · Web-Push an' : ''}</dd>
                            <dt>Claims</dt><dd className="mono">{JSON.stringify(a!.customClaims)}</dd>
                        </dl>
                    )}
                    {tab === 'workspaces' && (data.memberships.length ? (
                        <table className="ac-table">
                            <thead><tr><th>Workspace</th><th>Rolle</th><th>Beigetreten</th></tr></thead>
                            <tbody>{data.memberships.map((m) => (
                                <tr key={m.tenantId} className="is-clickable" onClick={() => navigate(`/workspaces?id=${m.tenantId}`)}>
                                    <td className="ac-strong">{m.tenantName}{data.profile.lastTenantId === m.tenantId && <span className="ac-muted"> · zuletzt aktiv</span>}</td>
                                    <td><Badge tone={roleTone(m.role)}>{m.role}</Badge></td><td>{dateTime(m.joinedAt)}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    ) : <Empty title="Keine Mitgliedschaften" />)}
                    {tab === 'devices' && (
                        <div className="ac-stack">
                            <p className="ac-section-title">iOS-Geräte</p>
                            {data.devices.length ? (
                                <table className="ac-table"><thead><tr><th>Plattform</th><th>Version</th><th>Locale</th><th>Push</th><th>Zuletzt</th></tr></thead>
                                    <tbody>{data.devices.map((d) => <tr key={d.id}><td>{d.platform}</td><td className="mono">{d.appVersion || '–'}</td><td>{d.locale || '–'}</td><td>{d.push ? 'ja' : 'nein'}</td><td>{relative(d.updatedAt)}</td></tr>)}</tbody></table>
                            ) : <p className="ac-muted">Keine registrierten Geräte.</p>}
                            <p className="ac-section-title"><KeyRound size={12} /> Passkeys</p>
                            {data.passkeys.length ? data.passkeys.map((p) => <div key={p.id} className="ac-row"><span className="mono">{p.id}…</span><span className="ac-muted">erstellt {dateTime(p.createdAt)} · genutzt {relative(p.lastUsedAt)}</span></div>) : <p className="ac-muted">Keine Passkeys.</p>}
                        </div>
                    )}
                    {tab === 'ai' && (
                        <div className="ac-stack">
                            <div className="ac-grid ac-grid--3">
                                <Card title="Tokens (Monat)"><b>{compact(data.ai.monthTokens)}</b></Card>
                                <Card title="Heute"><b>{num(data.ai.todayText)} Text · {num(data.ai.todayImages)} Bild</b></Card>
                                <Card title="Gesamt"><b>{compact(data.ai.totalTokens)} Tokens</b></Card>
                            </div>
                            <GrantsTable grants={data.grants} showTenant onRevoke={(g) => act('users.revokeGrant', { grantId: g.id }, 'Verbindung getrennt', { title: `„${g.clientName || 'Token'}“ trennen?`, message: 'Widerruft die Verbindung und löscht alle Access- und Refresh-Tokens. Der Client muss sich neu verbinden.', danger: true, label: 'Trennen' })} />
                        </div>
                    )}
                    {tab === 'consent' && (Object.keys(data.consent).length ? (
                        <table className="ac-table"><thead><tr><th>Dokument</th><th>Version</th><th>Entscheidung</th><th>Plattform</th><th>Zeit</th></tr></thead>
                            <tbody>{Object.entries(data.consent).map(([type, c]) => <tr key={type}><td>{type}</td><td className="mono">v{c.version}</td><td>{c.decision || 'accepted'}</td><td>{c.platform} <span className="mono ac-muted">{c.appVersion}</span></td><td>{dateTime(c.acceptedAt)}</td></tr>)}</tbody></table>
                    ) : <Empty title="Noch keine Zustimmung erfasst" />)}
                    {tab === 'activity' && (data.activity?.length ? (
                        <table className="ac-table"><thead><tr><th>Zeit</th><th>Ereignis</th><th>Objekt</th><th>Projekt</th></tr></thead>
                            <tbody>{data.activity.map((e) => <tr key={e.id}><td>{relative(e.createdAt)}</td><td><Badge plain>{e.type}</Badge></td><td>{e.object}</td><td className="ac-muted">{e.projectTitle || '–'}</td></tr>)}</tbody></table>
                    ) : <Empty title={data.activity ? 'Keine Aktivität' : 'Aktivität nicht verfügbar (Index wird aufgebaut)'} />)}
                </>
            )}
        </Drawer>
    );
};

export const UsersScreen: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const openUid = params.get('uid');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const { data, loading, error, reload } = useAdminQuery<{ users: DirUser[] }>('users.list');
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const rows = (data?.users || []).filter((u) => (!q || `${u.email} ${u.displayName} ${u.uid}`.toLowerCase().includes(q))
        && (filter === 'all' || (filter === 'active' && u.lastActiveAt && now - u.lastActiveAt < 7 * 86_400_000) || (filter === 'nomfa' && !u.mfa.length) || (filter === 'disabled' && u.disabled) || (filter === 'new' && now - u.createdAt < 7 * 86_400_000)));
    const setOpen = (uid: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (uid) n.set('uid', uid); else n.delete('uid'); return n; });

    const columns: Column<DirUser>[] = [
        { key: 'email', label: 'Nutzer', render: (u) => <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, padding: '4px 0' }}><span className="ac-strong">{u.displayName || u.email}</span>{u.displayName && <span className="ac-muted">{u.email}</span>}</div> },
        { key: 'status', label: 'Status', value: (u) => (u.disabled ? 'gesperrt' : u.platformAdmin ? 'admin' : 'aktiv'), render: (u) => <span className="ac-row" style={{ flexWrap: 'nowrap' }}>{u.disabled ? <Badge tone="red">gesperrt</Badge> : <Badge tone="green" plain>aktiv</Badge>}{u.platformAdmin && <Badge tone="violet" plain>Admin</Badge>}</span> },
        { key: 'mfa', label: '2FA', value: (u) => u.mfa.length, render: (u) => (u.mfa.length ? <ShieldCheck size={14} color="var(--color-success)" aria-label="2FA" /> : <span className="ac-muted">–</span>) },
        { key: 'providers', label: 'Login', value: (u) => u.providers.join(','), render: (u) => <span className="ac-muted">{u.providers.map((p) => PROVIDER[p] || p).join(', ')}</span> },
        { key: 'workspaces', label: 'Workspaces', num: true },
        { key: 'createdAt', label: 'Registriert', render: (u) => <span title={dateTime(u.createdAt)}>{relative(u.createdAt)}</span> },
        { key: 'lastActiveAt', label: 'Zuletzt aktiv', render: (u) => <span title={dateTime(u.lastActiveAt)}>{relative(u.lastActiveAt)}</span> },
        { key: 'uid', label: 'UID', hidden: true, render: (u) => <span className="mono ac-muted">{u.uid}</span> },
    ];

    return (
        <div className="ac-page">
            <PageHead title="Nutzer" subtitle="Alle Konten aus Firebase Auth mit Mitgliedschaften. Detailansicht und Support-Aktionen werden protokolliert." actions={<button className="ac-btn" onClick={reload}>Aktualisieren</button>} />
            <ErrorNote error={error} onRetry={reload} />
            <DataTable id="users" rows={data ? rows : null} loading={loading} columns={columns} rowKey={(u) => u.uid} onOpen={(u) => setOpen(u.uid)} selectedKey={openUid} defaultSort={{ key: 'createdAt', dir: 'desc' }}
                toolbar={<>
                    <div className="ac-search"><input className="ac-input" placeholder="E-Mail, Name, UID …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                    <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Alle' }, { value: 'active', label: 'Aktiv 7 T.' }, { value: 'new', label: 'Neu 7 T.' }, { value: 'nomfa', label: 'Ohne 2FA' }, { value: 'disabled', label: 'Gesperrt' }]} />
                </>} />
            {openUid && <UserDrawer uid={openUid} onClose={() => setOpen(null)} onChanged={reload} />}
        </div>
    );
};
