import React, { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import { compact, dateTime, num, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { DataTable, type Column } from '../ui/DataTable';
import { useUi } from '../ui/Overlay';
import { Badge, Card, ErrorNote, PageHead, Skeleton } from '../ui/primitives';

type Job = { name: string; schedule: string; timeZone: string; state: string; lastAttemptTime: number | null; statusCode: number; statusMessage: string | null; nextRun: number | null };
type Fn = { name: string; region: string; state: string; environment: string; runtime: string | null; updateTime: number | null; trigger: string };
type Status = {
    available: boolean; scheduler: Job[]; functions: Fn[];
    hosting: { site: string; releases: { time: number; type: string; user: string | null; message: string | null; files: number }[] }[];
    pricing: { usdPerMTokens: number; usdPerImage: number };
    limits: { dailyText: number; dailyImage: number; monthlyTokens: number; monthlyImages: number };
    signals: { insightsComputedAt: number | null; openLegalMailJobs: { id: string; status: string; counts: { sent: number; skipped: number; failed: number } | null; sendAfter: number | null }[] };
};

const SITE_LABEL: Record<string, string> = { 'projectflow-labestin': 'Web-App (app.getprojectflow.com)', 'projectflow-admin': 'Admin-Konsole', getprojectflow: 'Landing (getprojectflow.com)' };

const PricingCard: React.FC<{ pricing: Status['pricing']; onSaved: () => void }> = ({ pricing, onSaved }) => {
    const { toast } = useUi();
    const [form, setForm] = useState(pricing);
    useEffect(() => setForm(pricing), [pricing]);
    const save = async () => {
        try { await adminApi('system.setPricing', form); toast('Preise gespeichert'); onSaved(); } catch (err: any) { toast(err.message, 'error'); }
    };
    return (
        <Card title="Kostenschätzung KI" subtitle="Nur für die Anzeige in der Konsole. Maßgeblich ist die OpenAI-Rechnung.">
            <div className="ac-stack">
                <label className="ac-field"><span>USD pro 1 Mio. Tokens (gemischt Input/Output)</span><input className="ac-input" type="number" step="0.01" min="0" value={form.usdPerMTokens} onChange={(e) => setForm({ ...form, usdPerMTokens: Number(e.target.value) })} /></label>
                <label className="ac-field"><span>USD pro Bild</span><input className="ac-input" type="number" step="0.001" min="0" value={form.usdPerImage} onChange={(e) => setForm({ ...form, usdPerImage: Number(e.target.value) })} /></label>
                <div><button className="ac-btn ac-btn--primary" disabled={form.usdPerMTokens === pricing.usdPerMTokens && form.usdPerImage === pricing.usdPerImage} onClick={save}>Speichern</button></div>
            </div>
        </Card>
    );
};

export const SystemScreen: React.FC = () => {
    const { data, loading, error, reload } = useAdminQuery<Status>('system.status');
    if (loading && !data) return <div className="ac-page"><Skeleton rows={12} /></div>;
    if (!data) return <div className="ac-page"><ErrorNote error={error} onRetry={reload} /></div>;
    const failing = data.scheduler.filter((j) => j.statusCode !== 0);
    const fnColumns: Column<Fn>[] = [
        { key: 'name', label: 'Function', render: (f) => <span className="mono ac-strong">{f.name}</span> },
        { key: 'trigger', label: 'Trigger', render: (f) => <span className="ac-muted">{f.trigger.replace('google.cloud.', '').replace('providers/', '')}</span> },
        { key: 'environment', label: 'Gen', render: (f) => <Badge plain>{f.environment === 'GEN_2' ? '2nd' : '1st'}</Badge> },
        { key: 'state', label: 'Status', render: (f) => <Badge tone={f.state === 'ACTIVE' ? 'green' : 'red'}>{f.state}</Badge> },
        { key: 'runtime', label: 'Runtime' },
        { key: 'updateTime', label: 'Deployt', render: (f) => <span title={dateTime(f.updateTime)}>{relative(f.updateTime)}</span> },
        { key: 'region', label: 'Region', hidden: true },
    ];
    return (
        <div className="ac-page">
            <PageHead title="System" subtitle="Geplante Jobs, Deploys und Konsolen-Einstellungen." actions={<button className="ac-btn" onClick={reload}>Aktualisieren</button>} />
            {!data.available && <div className="ac-alert ac-alert--info" style={{ marginBottom: 12 }}>Im Emulator sind Cloud-Scheduler-, Functions- und Hosting-Daten nicht verfügbar.</div>}
            <div className="ac-stack">
                <div className="ac-grid ac-grid--stats">
                    <div className="ac-card ac-stat"><span className="ac-stat__label">Geplante Jobs</span><span className="ac-stat__value">{num(data.scheduler.length)}</span><span className="ac-stat__meta">{failing.length ? <Badge tone="red">{failing.length} mit Fehler</Badge> : <Badge tone="green">alle ok</Badge>}</span></div>
                    <div className="ac-card ac-stat"><span className="ac-stat__label">Functions</span><span className="ac-stat__value">{num(data.functions.length)}</span><span className="ac-stat__meta">{num(data.functions.filter((f) => f.state !== 'ACTIVE').length)} nicht aktiv</span></div>
                    <div className="ac-card ac-stat"><span className="ac-stat__label">Insights zuletzt berechnet</span><span className="ac-stat__value" style={{ fontSize: 18 }}>{relative(data.signals.insightsComputedAt)}</span></div>
                    <div className="ac-card ac-stat"><span className="ac-stat__label">Offene Rechtstext-Mails</span><span className="ac-stat__value">{num(data.signals.openLegalMailJobs.length)}</span><span className="ac-stat__meta">{data.signals.openLegalMailJobs.map((j) => `${j.id}: ${j.counts?.sent ?? 0} gesendet`).join(' · ')}</span></div>
                </div>
                <Card title="Cloud Scheduler" flush>
                    <table className="ac-table"><thead><tr><th>Job</th><th>Zeitplan</th><th>Status</th><th>Letzter Lauf</th><th>Nächster Lauf</th></tr></thead>
                        <tbody>{data.scheduler.map((j) => (
                            <tr key={j.name}><td className="mono ac-strong">{j.name.replace(/^firebase-schedule-/, '').replace(/-europe-west3$/, '')}</td><td className="mono">{j.schedule} <span className="ac-muted">{j.timeZone}</span></td>
                                <td>{j.state !== 'ENABLED' ? <Badge tone="amber">{j.state}</Badge> : j.statusCode ? <Badge tone="red" title={j.statusMessage || ''}>Fehler {j.statusCode}</Badge> : <Badge tone="green">ok</Badge>}</td>
                                <td>{relative(j.lastAttemptTime)}</td><td>{relative(j.nextRun)}</td></tr>
                        ))}{!data.scheduler.length && <tr><td colSpan={5} className="ac-muted">Keine Daten</td></tr>}</tbody></table>
                </Card>
                <div className="ac-grid ac-grid--3">
                    {data.hosting.map((h) => (
                        <Card key={h.site} title={SITE_LABEL[h.site] || h.site} subtitle={h.releases[0] ? `Live seit ${relative(h.releases[0].time)}` : 'Keine Daten'}>
                            {h.releases.map((r) => <div key={r.time} className="ac-row" style={{ justifyContent: 'space-between', padding: '3px 0' }}><span>{dateTime(r.time)}</span><span className="ac-muted">{r.type === 'ROLLBACK' ? 'Rollback' : `${compact(r.files)} Dateien`} · {r.user?.split('@')[0] || 'CI'}</span></div>)}
                        </Card>
                    ))}
                </div>
                <div className="ac-grid ac-grid--2">
                    <PricingCard pricing={data.pricing} onSaved={reload} />
                    <Card title="KI-Limits (Env, global)" subtitle="Gesetzt über Functions-Umgebung (ai-service.ts)">
                        <dl className="ac-kv">
                            <dt>Text-Anfragen / Tag</dt><dd>{num(data.limits.dailyText)}</dd>
                            <dt>Bilder / Tag</dt><dd>{num(data.limits.dailyImage)}</dd>
                            <dt>Tokens / Monat</dt><dd>{compact(data.limits.monthlyTokens)}</dd>
                            <dt>Bilder / Monat</dt><dd>{num(data.limits.monthlyImages)}</dd>
                        </dl>
                    </Card>
                </div>
                <DataTable id="functions" rows={data.functions} columns={fnColumns} rowKey={(f) => `${f.region}/${f.name}`} defaultSort={{ key: 'updateTime', dir: 'desc' }} emptyTitle="Keine Daten" />
            </div>
        </div>
    );
};
