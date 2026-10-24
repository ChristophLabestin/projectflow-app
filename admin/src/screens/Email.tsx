import React, { useState } from 'react';
import { MailCheck, Plus, Send } from 'lucide-react';
import { adminApi } from '../lib/api';
import { dateTime, num, pct, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { AreaChart, Legend } from '../ui/charts';
import { DataTable, type Column } from '../ui/DataTable';
import { useUi } from '../ui/Overlay';
import { Badge, Card, ErrorNote, PageHead, Segmented, Stat, type Tone } from '../ui/primitives';

/** E-Mail (Amazon SES): delivery stats, suppression list, test mail. Backend: functions/src/admin-console/modules/email.ts. */
type Suppression = { id: string; email: string; active: boolean; reason: 'bounce' | 'complaint' | 'manual'; detail: string; source: 'ses' | 'admin'; mailType: string | null; events: number; softBounces: number; by: string | null; createdAt: number | null; updatedAt: number | null };
type Stats = { days: { day: string; counts: Record<string, number> }[]; totals: Record<string, number>; bounceRate: number; complaintRate: number };

const REASON: Record<string, { label: string; tone: Tone }> = { bounce: { label: 'Bounce', tone: 'red' }, complaint: { label: 'Beschwerde', tone: 'amber' }, manual: { label: 'Manuell', tone: 'neutral' } };
const SIMULATOR = ['success@simulator.amazonses.com', 'bounce@simulator.amazonses.com', 'complaint@simulator.amazonses.com'];

/** Own warning at 2 % / 0.05 %, SES review at 5 % / 0.1 %. */
const rateTone = (rate: number, warn: number, review: number): { tone: 'green' | 'amber' | 'red'; text: string } =>
    rate >= review ? { tone: 'red', text: 'SES-Review-Schwelle' } : rate >= warn ? { tone: 'amber', text: 'über eigener Warnschwelle' } : { tone: 'green', text: 'im grünen Bereich' };

const notDeployed = (error: Error | null) => Boolean(error && /Unknown action|not-found/i.test(`${error.message} ${(error as any).code || ''}`));

const TestMailCard: React.FC = () => {
    const { toast } = useUi();
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [last, setLast] = useState<string | null>(null);
    const send = async () => {
        setBusy(true);
        try {
            const r = await adminApi<{ transport: string; messageId?: string }>('email.test', { email: email.trim() });
            setLast(`${r.transport}${r.messageId ? ` · ${r.messageId}` : ''}`);
            toast(r.transport === 'suppressed' ? 'Adresse ist unterdrückt — nicht gesendet' : `Test-Mail über ${r.transport} gesendet`, r.transport === 'suppressed' ? 'error' : 'success');
        } catch (err: any) { toast(err.message, 'error'); } finally { setBusy(false); }
    };
    return (
        <Card title={<span className="ac-row"><Send size={15} />Test-Mail</span>} subtitle="Geht über denselben Weg wie System-Mails (SES, sonst SMTP).">
            <div className="ac-stack">
                <div className="ac-row">
                    <input className="ac-input" style={{ flex: 1 }} type="email" placeholder="empfaenger@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <button className="ac-btn ac-btn--primary" disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())} onClick={send}>Senden</button>
                </div>
                <div className="ac-row">{SIMULATOR.map((s) => <button key={s} className="ac-btn ac-btn--sm" onClick={() => setEmail(s)}>{s.split('@')[0]}@simulator</button>)}</div>
                {last && <span className="ac-muted">Zuletzt: <span className="mono">{last}</span></span>}
            </div>
        </Card>
    );
};

export const EmailScreen: React.FC = () => {
    const { confirm, toast } = useUi();
    const [days, setDays] = useState('14');
    const [filter, setFilter] = useState('active');
    const [search, setSearch] = useState('');
    const [adding, setAdding] = useState('');
    const stats = useAdminQuery<Stats>('email.stats', { days: Number(days) });
    const list = useAdminQuery<{ items: Suppression[] }>('email.suppressions.list', { limit: 1000 });

    if (notDeployed(stats.error) || notDeployed(list.error)) {
        return (
            <div className="ac-page">
                <PageHead title="E-Mail" subtitle="Zustellung über Amazon SES." />
                <div className="ac-alert ac-alert--info">Das E-Mail-Backend (SES) ist noch nicht deployt. Die Seite wird aktiv, sobald die SES-Secrets gesetzt sind und das Backend live ist (Runbook brain/operations/email-ses.md).</div>
            </div>
        );
    }

    const s = stats.data;
    const bounce = s ? rateTone(s.bounceRate, 0.02, 0.05) : null;
    const complaint = s ? rateTone(s.complaintRate, 0.0005, 0.001) : null;
    const series = (key: string) => (s?.days || []).map((d) => d.counts?.[key] || 0);
    const q = search.trim().toLowerCase();
    const rows = (list.data?.items || []).filter((r) => (filter === 'all' || r.active) && (!q || `${r.email} ${r.detail} ${r.mailType || ''}`.toLowerCase().includes(q)));

    const remove = async (row: Suppression) => {
        let note = '';
        const ok = await confirm({ title: `${row.email} wieder zulassen?`, message: <>Entfernt die Adresse aus der Unterdrückungsliste (auch bei SES). Nur tun, wenn die Adresse nachweislich wieder erreichbar ist bzw. die Person zugestimmt hat.<input className="ac-input" style={{ marginTop: 10, width: '100%' }} placeholder="Notiz (optional)" onChange={(e) => { note = e.target.value; }} /></>, confirmLabel: 'Entfernen', danger: row.reason === 'complaint' });
        if (!ok) return;
        try {
            const r = await adminApi<{ ses: string }>('email.suppressions.remove', { email: row.email, note });
            toast(`Entfernt${r.ses === 'failed' ? ' (SES-Liste konnte nicht aktualisiert werden)' : ''}`, r.ses === 'failed' ? 'error' : 'success');
            list.reload();
        } catch (err: any) { toast(err.message, 'error'); }
    };
    const add = async () => {
        try {
            const r = await adminApi<{ ses: string }>('email.suppressions.add', { email: adding.trim(), note: 'manuell in der Konsole' });
            toast(`Unterdrückt${r.ses === 'failed' ? ' (SES-Liste nicht aktualisiert)' : ''}`);
            setAdding('');
            list.reload();
        } catch (err: any) { toast(err.message, 'error'); }
    };

    const columns: Column<Suppression>[] = [
        { key: 'email', label: 'Adresse', render: (r) => <span className="ac-strong">{r.email}</span> },
        { key: 'reason', label: 'Grund', render: (r) => <Badge tone={REASON[r.reason]?.tone || 'neutral'}>{REASON[r.reason]?.label || r.reason}</Badge> },
        { key: 'active', label: 'Status', value: (r) => (r.active ? 1 : 0), render: (r) => (r.active ? <Badge tone="red" plain>gesperrt</Badge> : <span className="ac-muted">aufgehoben</span>) },
        { key: 'detail', label: 'Detail', render: (r) => <span className="ac-muted" title={r.detail}>{r.detail || '–'}</span> },
        { key: 'mailType', label: 'Mail-Typ', render: (r) => <span className="mono ac-muted">{r.mailType || '–'}</span> },
        { key: 'events', label: 'Ereignisse', num: true, render: (r) => <>{num(r.events)}{r.softBounces ? <span className="ac-muted"> · {r.softBounces} soft</span> : ''}</> },
        { key: 'source', label: 'Quelle', render: (r) => (r.source === 'ses' ? 'SES' : `Admin${r.by ? ` (${r.by})` : ''}`) },
        { key: 'updatedAt', label: 'Zuletzt', render: (r) => <span title={dateTime(r.updatedAt)}>{relative(r.updatedAt)}</span> },
        { key: 'actions', label: '', value: () => '', render: (r) => (r.active ? <button className="ac-btn ac-btn--sm" onClick={(e) => { e.stopPropagation(); void remove(r); }}>Zulassen</button> : null) },
    ];

    return (
        <div className="ac-page">
            <PageHead title="E-Mail" subtitle="Zustellung über Amazon SES: Bounces, Beschwerden, Unterdrückungsliste." actions={<Segmented value={days} onChange={setDays} options={[{ value: '7', label: '7 T.' }, { value: '14', label: '14 T.' }, { value: '30', label: '30 T.' }, { value: '90', label: '90 T.' }]} />} />
            <ErrorNote error={stats.error} onRetry={stats.reload} />
            <div className="ac-stack">
                <div className="ac-grid ac-grid--stats">
                    <Stat icon={<MailCheck size={13} />} label="Gesendet" value={num(s?.totals?.send ?? null)} meta={`${num(s?.totals?.delivery ?? null)} zugestellt`} series={series('send')} />
                    <Stat label="Bounce-Rate" value={pct(s?.bounceRate ?? null, 2)} meta={bounce && <Badge tone={bounce.tone} plain>{bounce.text}</Badge>} series={series('bounce')} color="var(--color-error)" />
                    <Stat label="Beschwerde-Rate" value={pct(s?.complaintRate ?? null, 3)} meta={complaint && <Badge tone={complaint.tone} plain>{complaint.text}</Badge>} series={series('complaint')} color="var(--ac-chart-4)" />
                    <Stat label="Abgelehnt / verzögert" value={`${num(s?.totals?.reject ?? 0)} / ${num(s?.totals?.deliverydelay ?? 0)}`} meta={`${num(s?.totals?.renderingfailure ?? 0)} Render-Fehler`} />
                </div>
                <Card title="Ereignisse pro Tag" actions={<Legend series={[{ label: 'Zugestellt', values: [] }, { label: 'Bounce', values: [], color: 'var(--color-error)' }, { label: 'Beschwerde', values: [], color: 'var(--ac-chart-4)' }]} />}>
                    <AreaChart days={(s?.days || []).map((d) => d.day)} bars series={[{ label: 'Zugestellt', values: series('delivery') }, { label: 'Bounce', values: series('bounce'), color: 'var(--color-error)' }, { label: 'Beschwerde', values: series('complaint'), color: 'var(--ac-chart-4)' }]} />
                </Card>
                <div className="ac-grid ac-grid--main-side">
                    <div>
                        <ErrorNote error={list.error} onRetry={list.reload} />
                        <DataTable id="email-suppressions" rows={list.data ? rows : null} loading={list.loading} columns={columns} rowKey={(r) => r.id} defaultSort={{ key: 'updatedAt', dir: 'desc' }} emptyTitle="Keine unterdrückten Adressen"
                            toolbar={<>
                                <div className="ac-search"><input className="ac-input" placeholder="Adresse, Detail …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                                <Segmented value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Aktiv' }, { value: 'all', label: 'Alle' }]} />
                            </>} />
                    </div>
                    <div className="ac-stack">
                        <TestMailCard />
                        <Card title={<span className="ac-row"><Plus size={15} />Adresse unterdrücken</span>} subtitle="System-Mails an diese Adresse werden nicht mehr versendet.">
                            <div className="ac-row">
                                <input className="ac-input" style={{ flex: 1 }} type="email" placeholder="adresse@example.com" value={adding} onChange={(e) => setAdding(e.target.value)} />
                                <button className="ac-btn" disabled={!/^\S+@\S+\.\S+$/.test(adding.trim())} onClick={add}>Hinzufügen</button>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
