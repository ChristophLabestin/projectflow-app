import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Copy } from 'lucide-react';
import { adminApi } from '../lib/api';
import { useAdminQuery } from '../lib/useAsync';
import { dateTime, num, relative } from '../lib/format';
import { AreaChart, BarList } from '../ui/charts';
import { useUi } from '../ui/Overlay';
import { Badge, Card, ErrorNote, Skeleton } from '../ui/primitives';
import { PlatformIcon, STATUS_LABEL, STATUS_TONE, type CrashIssue } from './Crashes';

type Frame = { function?: string; file?: string; line?: number; column?: number; image?: string; offset?: number; address?: string; inApp?: boolean };
type CrashEvent = { id: string; receivedAt: number; release: string; build: string | null; environment: string; installId: string; device: Record<string, string>; mechanism: string; handled: boolean; type: string; message: string; route: string | null; frames: Frame[]; symbolicatedFrames: Frame[] | null };
type Detail = { issue: CrashIssue; events: CrashEvent[]; days: string[]; series: number[]; byRelease: Record<string, number>; byDevice: Record<string, number>; installs: number };

const frameLine = (f: Frame) => {
    if (f.file) return `${f.function || '<anonymous>'}  ${f.file.split('/').pop()}${f.line ? `:${f.line}` : ''}${f.column ? `:${f.column}` : ''}`;
    return f.function ? `${f.function}  (${f.image ?? ''})` : `${f.image ?? '?'} + ${f.offset ?? f.address ?? '?'}`;
};

export const CrashDetail: React.FC = () => {
    const { id = '' } = useParams();
    const { confirm, toast } = useUi();
    const { data, loading, error, reload, setData } = useAdminQuery<Detail>('crashes.get', { id });
    const [eventIndex, setEventIndex] = useState(0);
    const [busy, setBusy] = useState(false);

    const setStatus = async (status: CrashIssue['status']) => {
        if (status === 'ignored' && !(await confirm({ title: 'Issue ignorieren?', message: 'Neue Events werden weiter gezählt, das Issue bleibt aber aus der Liste „Offen“ heraus.', confirmLabel: 'Ignorieren' }))) return;
        setBusy(true);
        try {
            await adminApi('crashes.setStatus', { id, status });
            setData((d) => (d ? { ...d, issue: { ...d.issue, status, resolvedRelease: status === 'resolved' ? d.issue.lastRelease : null } } : d));
            toast(`Status: ${STATUS_LABEL[status]}`);
        } catch (err: any) {
            toast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    if (loading && !data) return <div className="ac-page"><Skeleton rows={10} /></div>;
    if (!data) return <div className="ac-page"><ErrorNote error={error} onRetry={reload} /></div>;
    const { issue, events } = data;
    const event = events[eventIndex];
    const frames = event ? (event.symbolicatedFrames ?? event.frames) : [];
    const stack = frames.map((f) => ({ text: frameLine(f), app: f.inApp !== false }));
    const copy = () => navigator.clipboard.writeText(`${event?.type}: ${event?.message}\n${stack.map((s) => `  at ${s.text}`).join('\n')}`).then(() => toast('Stacktrace kopiert'));

    return (
        <div className="ac-page">
            <Link to="/crashes" className="ac-btn ac-btn--ghost ac-btn--sm" style={{ marginBottom: 10 }}><ArrowLeft size={14} />Alle Crashes</Link>
            <div className="ac-page__head">
                <div style={{ minWidth: 0 }}>
                    <div className="ac-row" style={{ marginBottom: 4 }}><PlatformIcon platform={issue.platform} /><Badge tone={STATUS_TONE[issue.status]}>{STATUS_LABEL[issue.status]}</Badge><span className="ac-muted mono">{issue.id}</span></div>
                    <h1 style={{ wordBreak: 'break-word' }}>{issue.type}</h1>
                    <p style={{ wordBreak: 'break-word' }}>{issue.message}</p>
                </div>
                <div className="ac-page__actions">
                    {issue.status !== 'resolved' && <button className="ac-btn ac-btn--primary" disabled={busy} onClick={() => setStatus('resolved')}>Erledigt</button>}
                    {issue.status !== 'ignored' && <button className="ac-btn" disabled={busy} onClick={() => setStatus('ignored')}>Ignorieren</button>}
                    {issue.status !== 'open' && <button className="ac-btn" disabled={busy} onClick={() => setStatus('open')}>Wieder öffnen</button>}
                </div>
            </div>

            <div className="ac-grid ac-grid--main-side">
                <div className="ac-stack">
                    <Card title="Events (30 Tage)" subtitle={`${num(issue.count)} insgesamt · ${num(data.installs)} Installationen in den letzten 100 Events`}>
                        <AreaChart days={data.days} series={[{ label: 'Events', values: data.series, color: issue.platform === 'ios' ? 'var(--ac-chart-2)' : undefined }]} height={150} bars />
                    </Card>
                    <Card title="Stacktrace" subtitle={event ? `${event.symbolicatedFrames ? 'symbolisiert' : 'roh'} · Event ${eventIndex + 1}/${events.length} · ${dateTime(event.receivedAt)}` : 'Kein Event gespeichert'} actions={event && <>
                        <button className="ac-btn ac-btn--sm" disabled={eventIndex >= events.length - 1} onClick={() => setEventIndex((i) => i + 1)}>Älter</button>
                        <button className="ac-btn ac-btn--sm" disabled={eventIndex === 0} onClick={() => setEventIndex((i) => i - 1)}>Neuer</button>
                        <button className="ac-btn ac-btn--sm" onClick={copy}><Copy size={13} />Kopieren</button>
                    </>}>
                        {event ? (
                            <>
                                <pre className="ac-code">{stack.length ? stack.map((s, i) => <div key={i} className={s.app ? 'is-app' : 'is-lib'}>{String(i).padStart(2, ' ')}  {s.text}</div>) : 'Keine Frames'}</pre>
                                {!event.symbolicatedFrames && <p className="ac-muted" style={{ margin: '8px 0 0' }}>Symbolisieren auf dem Mac: <code>node functions/scripts/crash-symbolicate.mjs --issue {issue.id}</code> (iOS per dSYM/atos, Web per Source-Maps).</p>}
                            </>
                        ) : <p className="ac-muted">Für dieses Issue sind keine Events mehr gespeichert (90 Tage Aufbewahrung).</p>}
                    </Card>
                    <Card title="Letzte Events" flush>
                        <table className="ac-table">
                            <thead><tr><th>Zeit</th><th>Release</th><th>Gerät</th><th>Route</th><th>Installation</th></tr></thead>
                            <tbody>
                                {events.slice(0, 30).map((e, i) => (
                                    <tr key={e.id} className={`is-clickable ${i === eventIndex ? 'is-focused' : ''}`} onClick={() => setEventIndex(i)}>
                                        <td>{relative(e.receivedAt)}</td>
                                        <td className="mono">{e.release}{e.build ? ` (${e.build})` : ''}</td>
                                        <td>{[e.device.os, e.device.osVersion, e.device.browser || e.device.model].filter(Boolean).join(' ')}</td>
                                        <td className="mono ac-muted">{e.route || '–'}</td>
                                        <td className="mono ac-muted">{e.installId.slice(0, 12)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
                <div className="ac-stack">
                    <Card title="Details">
                        <dl className="ac-kv">
                            <dt>Stelle</dt><dd className="mono">{issue.culprit || '–'}</dd>
                            <dt>Mechanismus</dt><dd>{issue.mechanism}{event ? ` · ${event.handled ? 'abgefangen' : 'unbehandelt'}` : ''}</dd>
                            <dt>Erstmals</dt><dd>{dateTime(issue.firstSeen)}</dd>
                            <dt>Zuletzt</dt><dd>{dateTime(issue.lastSeen)}</dd>
                            <dt>Letztes Release</dt><dd className="mono">{issue.lastRelease}</dd>
                            <dt>Erledigt in</dt><dd className="mono">{issue.resolvedRelease || '–'}</dd>
                            <dt>Umgebungen</dt><dd>{issue.environments.join(', ') || '–'}</dd>
                        </dl>
                    </Card>
                    <Card title="Releases"><BarList items={Object.entries(data.byRelease).map(([label, value]) => ({ label: <span className="mono">{label}</span>, value, key: label })).sort((a, b) => b.value - a.value)} /></Card>
                    <Card title="Geräte"><BarList items={Object.entries(data.byDevice).map(([label, value]) => ({ label, value, key: label })).sort((a, b) => b.value - a.value)} /></Card>
                </div>
            </div>
        </div>
    );
};
