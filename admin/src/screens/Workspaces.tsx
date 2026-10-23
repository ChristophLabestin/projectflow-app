import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../lib/api';
import { dateTime, eur, num, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { AreaChart, Meter } from '../ui/charts';
import { DataTable, type Column } from '../ui/DataTable';
import { Drawer, useUi } from '../ui/Overlay';
import { Badge, Card, Empty, ErrorNote, PageHead, Segmented, Skeleton, Tabs } from '../ui/primitives';
import { dayKeyList } from '../lib/days';
import { GrantsTable, roleTone, UserDrawer } from './Users';

type Billing = { plan: string; status: string; seats: number; aiAddonSeats: number; billingInterval: string | null; trialEndsAt: number | null; graceEndsAt: number | null; currentPeriodEnd: number | null; cancelAtPeriodEnd: boolean; paid: boolean; mrr: number; missing: boolean; exempt: boolean; workspaceType: 'personal' | 'team'; storageQuotaBytes: number | null; flowsQuota: string | null };
export const STATUS_TONE_BILLING: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'neutral' | 'violet'> = { active: 'green', trialing: 'blue', grace: 'violet', past_due: 'red', canceled: 'neutral', free: 'neutral', exempt: 'amber' };
export const statusLabel = (status: string) => (status === 'exempt' ? 'Intern' : status);
type Ws = { billing: Billing | null; workspaceType: 'personal' | 'team'; orphaned: boolean; id: string; name: string; ownerId: string | null; ownerEmail: string | null; createdAt: number | null; suspendedAt: number | null; members: number; guests: number; projects: number; lastProjectUpdate: number | null; grants: number; aiEnabled: boolean };
type Policy = { enabled: boolean; allowGuests: boolean; allowDeleteScopes: boolean; allowPersonalTokens: boolean; inAppEnabled: boolean; inAppAi: boolean; monthlyCredits?: number | null };
type WsDetail = {
    id: string; name: string; ownerId: string | null; createdAt: number | null; suspendedAt: number | null; suspendedReason: string | null; suspensionLog: { id: string; suspended: boolean; reason: string; email: string; at: number | null }[]; modules: string[] | null;
    members: { uid: string; email: string; displayName: string; role: string; joinedAt: number | null; lastActiveAt: number | null }[];
    projects: { id: string; title: string; status: string; updatedAt: number | null; createdAt: number | null }[];
    flows: {
        allowMemberFlows: boolean; month: string; usage: { runs: number; aiSteps: number; skipped: number };
        limits: { runsPerMonth: number; aiStepsPerMonth: number; activeFlowsPerWorkspace: number };
        flows: { id: string; name: string; scope: string; projectId: string | null; enabled: boolean; trigger: string; pausedReason: string | null; lastRunAt: number | null; lastStatus: string | null; lastError: string | null; consecutiveFailures: number }[];
        failedRuns: { id: string; name: string; error: string | null; startedAt: number | null }[];
    };
    billing: Billing & { memberLimit: number | null; projectLimit: number | null; projectCount: number | null; lockedProjects: number; aiMemberIds: number; stripeSubscriptionId: string | null; customerId: string | null };
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

const FlowsTab: React.FC<{ data: WsDetail; onSaved: () => void }> = ({ data, onSaved }) => {
    const { confirm, toast } = useUi();
    const f = data.flows;
    const active = f.flows.filter((x) => x.enabled).length;
    const paused = f.flows.filter((x) => x.pausedReason);
    const setMember = async (allow: boolean) => {
        if (!(await confirm({ title: `Mitglieder-Flows ${allow ? 'erlauben' : 'sperren'}?`, message: 'Setzt automationPolicy.allowMemberFlows dieses Workspace. Owner/Admins behalten ihre Flows.', confirmLabel: 'Ändern', danger: !allow }))) return;
        try { await adminApi('workspaces.setFlowPolicy', { id: data.id, allowMemberFlows: allow }); toast('Flow-Policy geändert'); onSaved(); } catch (err: any) { toast(err.message, 'error'); }
    };
    return (
        <div className="ac-stack">
            <div className="ac-grid ac-grid--3">
                <Card title="Aktive Flows"><b>{num(active)} / {num(f.limits.activeFlowsPerWorkspace)}</b> <span className="ac-muted">({num(f.flows.length)} gesamt)</span></Card>
                <Card title={`Läufe ${f.month}`}><b>{num(f.usage.runs)} / {num(f.limits.runsPerMonth)}</b><div style={{ marginTop: 6 }}><Meter value={f.usage.runs / Math.max(1, f.limits.runsPerMonth)} /></div></Card>
                <Card title="KI-Schritte"><b>{num(f.usage.aiSteps)} / {num(f.limits.aiStepsPerMonth)}</b> <span className="ac-muted">· {num(f.usage.skipped)} übersprungen</span></Card>
            </div>
            <label className="ac-check"><input type="checkbox" checked={f.allowMemberFlows} onChange={(e) => setMember(e.target.checked)} />Mitglieder dürfen Flows anlegen (automationPolicy.allowMemberFlows)</label>
            {paused.length > 0 && <div className="ac-alert ac-alert--error">{paused.length} pausiert: {paused.map((p) => `${p.name} (${p.pausedReason === 'errors' ? 'Fehler' : 'Owner ohne Zugriff'})`).join(', ')}</div>}
            {f.flows.length ? (
                <table className="ac-table"><thead><tr><th>Flow</th><th>Trigger</th><th>Status</th><th>Letzter Lauf</th><th className="is-num">Fehler in Folge</th></tr></thead>
                    <tbody>{f.flows.map((x) => (
                        <tr key={x.id}><td className="ac-strong">{x.name}<span className="ac-muted"> · {x.scope === 'project' ? 'Projekt' : 'Workspace'}</span></td><td className="mono ac-muted">{x.trigger}</td>
                            <td>{x.pausedReason ? <Badge tone="red">pausiert</Badge> : x.enabled ? <Badge tone="green">aktiv</Badge> : <Badge>aus</Badge>}</td>
                            <td title={x.lastError || ''}>{relative(x.lastRunAt)}{x.lastStatus ? <span className="ac-muted"> · {x.lastStatus}</span> : ''}</td><td className="is-num">{x.consecutiveFailures || '–'}</td></tr>
                    ))}</tbody></table>
            ) : <Empty title="Keine Flows" />}
            {f.failedRuns.length > 0 && (
                <Card title="Letzte fehlgeschlagene Läufe" flush>
                    <table className="ac-table"><thead><tr><th>Zeit</th><th>Flow</th><th>Fehler</th></tr></thead>
                        <tbody>{f.failedRuns.map((r) => <tr key={r.id}><td>{relative(r.startedAt)}</td><td>{r.name}</td><td className="is-wrap ac-muted">{r.error || '–'}</td></tr>)}</tbody></table>
                </Card>
            )}
        </div>
    );
};

const ExemptCard: React.FC<{ id: string; name: string; exempt: boolean; onSaved: () => void }> = ({ id, name, exempt, onSaved }) => {
    const { confirm, toast } = useUi();
    const [reason, setReason] = useState('');
    const run = async () => {
        const ok = await confirm({
            title: exempt ? `„${name}“ wieder normal abrechnen?` : `„${name}“ als intern markieren?`,
            message: exempt
                ? 'Der Workspace fällt auf das Stripe-Abo zurück bzw. auf Free, wenn es keins gibt. Limits und Sperren werden neu berechnet.'
                : 'Intern = Team-Plan inklusive KI für alle Mitglieder, ohne Zahlung (status exempt, zählt nicht zum MRR).',
            danger: exempt,
            confirmLabel: exempt ? 'Intern entfernen' : 'Als intern markieren',
        });
        if (!ok) return;
        try { await adminApi('billing.setExempt', { id, exempt: !exempt, reason }); toast(exempt ? 'Intern entfernt' : 'Als intern markiert'); setReason(''); onSaved(); } catch (err: any) { toast(err.message, 'error'); }
    };
    return (
        <Card title="Intern / kostenlos" subtitle="Nur über die Billing-Logik (setBillingExempt), mit Begründung und Audit.">
            <div className="ac-row">
                <input className="ac-input" style={{ flex: 1 }} placeholder="Begründung (mind. 10 Zeichen)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <button className={`ac-btn ${exempt ? 'ac-btn--danger' : 'ac-btn--primary'}`} disabled={reason.trim().length < 10} onClick={run}>{exempt ? 'Intern entfernen …' : 'Als intern markieren …'}</button>
            </div>
        </Card>
    );
};

const gb = (bytes: number | null | undefined) => (bytes == null ? '–' : `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 1).replace('.', ',')} GB`);

const StorageCard: React.FC<{ id: string }> = ({ id }) => {
    const { confirm, toast } = useUi();
    const { data, reload } = useAdminQuery<{ usedBytes: number; fileCount: number; quotaBytes: number; maxFileBytes: number; planQuotaBytes: number | null; overrideBytes: number | null }>('billing.storage', { id });
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const save = async (clear: boolean) => {
        const bytes = clear ? null : Math.round(Number(value) * 1024 ** 3);
        if (!(await confirm({ title: clear ? 'Speicher-Override entfernen?' : `Speicher auf ${value} GB setzen?`, message: 'Überschreibt das Kontingent des Plans (storageQuotaOverrideBytes), bis der Override entfernt wird. Wird protokolliert.', confirmLabel: clear ? 'Entfernen' : 'Setzen' }))) return;
        try { await adminApi('billing.setStorageOverride', { id, bytes, reason }); toast('Speicher-Kontingent geändert'); setReason(''); reload(); } catch (err: any) { toast(err.message, 'error'); }
    };
    if (!data) return null;
    return (
        <Card title="Dateispeicher" subtitle={`${gb(data.usedBytes)} von ${gb(data.quotaBytes)} · ${num(data.fileCount)} Dateien · max. ${Math.round(data.maxFileBytes / 1024 ** 2)} MB pro Datei`}>
            <div className="ac-stack">
                <Meter value={data.usedBytes / Math.max(1, data.quotaBytes)} color={data.usedBytes / Math.max(1, data.quotaBytes) > 0.9 ? 'var(--color-error)' : undefined} />
                <span className="ac-muted">Plan: {gb(data.planQuotaBytes)}{data.overrideBytes ? ` · Override aktiv: ${gb(data.overrideBytes)}` : ''}</span>
                <div className="ac-row">
                    <input className="ac-input" type="number" min={1} style={{ width: 110 }} placeholder="GB" value={value} onChange={(e) => setValue(e.target.value)} />
                    <input className="ac-input" style={{ flex: 1 }} placeholder="Begründung (mind. 10 Zeichen)" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <button className="ac-btn ac-btn--primary" disabled={!(Number(value) >= 1) || reason.trim().length < 10} onClick={() => save(false)}>Override setzen</button>
                    {data.overrideBytes && <button className="ac-btn" disabled={reason.trim().length < 10} onClick={() => save(true)}>Entfernen</button>}
                </div>
            </div>
        </Card>
    );
};

const BillingTab: React.FC<{ b: WsDetail['billing']; id: string; name: string; onSaved: () => void }> = ({ b, id, name, onSaved }) => (
    <div className="ac-stack">
        <div className="ac-row">
            <Badge tone="violet" plain>{b.plan}</Badge>
            <Badge tone={STATUS_TONE_BILLING[b.status] || 'neutral'}>{statusLabel(b.status)}{b.missing ? ' (kein Dokument)' : ''}</Badge>
            {b.cancelAtPeriodEnd && <Badge tone="amber">kündigt zum Periodenende</Badge>}
            <span className="ac-muted">MRR netto <b>{eur(b.mrr)}</b></span>
        </div>
        <dl className="ac-kv">
            <dt>Workspace-Typ</dt><dd>{b.workspaceType === 'personal' ? 'Persönlich' : 'Team'}</dd>
            <dt>Speicher / Flows</dt><dd>{b.storageQuotaBytes ? `${Math.round(b.storageQuotaBytes / 1024 ** 3)} GB` : '–'} · Flows-Kontingent {b.flowsQuota || '–'}</dd>
            <dt>Plätze / KI-Pakete</dt><dd>{num(b.seats)} / {num(b.aiAddonSeats)} <span className="ac-muted">({num(b.aiMemberIds)} zugewiesen)</span></dd>
            <dt>Abrechnung</dt><dd>{b.billingInterval === 'year' ? 'jährlich' : b.billingInterval === 'month' ? 'monatlich' : '–'}</dd>
            <dt>Periode bis</dt><dd>{dateTime(b.currentPeriodEnd)}</dd>
            <dt>Test endet</dt><dd>{dateTime(b.trialEndsAt)}</dd>
            <dt>Grace endet</dt><dd>{dateTime(b.graceEndsAt)}</dd>
            <dt>Limits</dt><dd>Mitglieder {b.memberLimit ?? '∞'} · Projekte {b.projectCount ?? '–'}/{b.projectLimit ?? '∞'}{b.lockedProjects ? ` · ${b.lockedProjects} gesperrt` : ''}</dd>
            <dt>Stripe</dt><dd>{b.customerId ? <a href={`https://dashboard.stripe.com/customers/${encodeURIComponent(b.customerId)}`} target="_blank" rel="noopener noreferrer" className="mono">{b.customerId}</a> : '–'}{b.stripeSubscriptionId ? <span className="mono ac-muted"> · {b.stripeSubscriptionId}</span> : ''}</dd>
        </dl>
        <p className="ac-muted">Plan und Abo ändern sich über Stripe bzw. die Billing-Functions; hier nur „intern“.</p>
        <StorageCard id={id} />
        <ExemptCard id={id} name={name} exempt={b.exempt} onSaved={onSaved} />
    </div>
);

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
                        { value: 'billing', label: 'Abo' },
                        { value: 'flows', label: `Flows ${data.flows.flows.filter((x) => x.enabled).length}${data.flows.flows.some((x) => x.pausedReason) ? ' ●' : ''}` },
                        { value: 'activity', label: 'Aktivität' },
                        { value: 'status', label: data.suspendedAt ? 'Sperre ●' : 'Sperre' },
                    ]} />
                    {tab === 'status' && <SuspendCard data={data} onSaved={reload} />}
                    {tab === 'flows' && <FlowsTab data={data} onSaved={reload} />}
                    {tab === 'billing' && <BillingTab b={data.billing} id={data.id} name={data.name} onSaved={reload} />}
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
    const [type, setType] = useState('all');
    const [plan, setPlan] = useState('');
    const { data, loading, error, reload } = useAdminQuery<{ workspaces: Ws[] }>('workspaces.list');
    const plans = Array.from(new Set((data?.workspaces || []).map((w) => w.billing?.plan).filter(Boolean) as string[])).sort();
    const q = search.trim().toLowerCase();
    const rows = (data?.workspaces || []).filter((w) => (type === 'all' || w.workspaceType === type) && (!plan || w.billing?.plan === plan) && (!q || `${w.name} ${w.ownerEmail} ${w.id}`.toLowerCase().includes(q))
        && (filter === 'all' || (filter === 'team' && w.members > 1) || (filter === 'mcp' && w.grants > 0) || (filter === 'empty' && w.projects === 0) || (filter === 'suspended' && Boolean(w.suspendedAt)) || (filter === 'paying' && (w.billing?.mrr ?? 0) > 0) || (filter === 'trial' && w.billing?.status === 'trialing') || (filter === 'exempt' && w.billing?.status === 'exempt') || (filter === 'orphaned' && w.orphaned)));
    const setOpen = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('id', id); else n.delete('id'); return n; });

    const columns: Column<Ws>[] = [
        { key: 'name', label: 'Workspace', render: (w) => <span className="ac-row" style={{ flexWrap: 'nowrap' }}><span className="ac-strong">{w.name}</span>{w.suspendedAt && <Badge tone="red">gesperrt</Badge>}{w.orphaned && <Badge tone="amber" title="Owner hat kein Auth-Konto mehr">verwaist</Badge>}</span> },
        { key: 'workspaceType', label: 'Typ', value: (w) => w.workspaceType, render: (w) => <Badge plain tone={w.workspaceType === 'personal' ? 'blue' : 'neutral'}>{w.workspaceType === 'personal' ? 'Persönlich' : 'Team'}</Badge> },
        { key: 'ownerEmail', label: 'Owner', render: (w) => <span className="ac-muted">{w.ownerEmail || w.ownerId}</span> },
        { key: 'plan', label: 'Plan', value: (w) => w.billing?.plan || '', render: (w) => (w.billing ? <span className="ac-row" style={{ flexWrap: 'nowrap' }}><span>{w.billing.plan}</span><Badge tone={STATUS_TONE_BILLING[w.billing.status] || 'neutral'} plain>{statusLabel(w.billing.status)}</Badge></span> : '–') },
        { key: 'mrr', label: 'MRR', num: true, value: (w) => w.billing?.mrr ?? 0, render: (w) => (w.billing?.mrr ? eur(w.billing.mrr) : <span className="ac-muted">–</span>) },
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
                    <Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'Alle Typen' }, { value: 'team', label: 'Team' }, { value: 'personal', label: 'Persönlich' }]} />
                    <select className="ac-select" value={plan} onChange={(e) => setPlan(e.target.value)}><option value="">Alle Pläne</option>{plans.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                    <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Alle' }, { value: 'team', label: 'Mehrere Mitglieder' }, { value: 'mcp', label: 'Mit MCP' }, { value: 'empty', label: 'Leer' }, { value: 'paying', label: 'Zahlend' }, { value: 'trial', label: 'Test' }, { value: 'exempt', label: 'Intern' }, { value: 'orphaned', label: 'Verwaist' }, { value: 'suspended', label: 'Gesperrt' }]} />
                </>} />
            {openId && <WorkspaceDrawer id={openId} onClose={() => setOpen(null)} onOpenUser={setUser} />}
            {user && <UserDrawer uid={user} onClose={() => setUser(null)} />}
        </div>
    );
};
