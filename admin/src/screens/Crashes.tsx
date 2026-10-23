import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Apple, Globe } from 'lucide-react';
import { useAdminQuery } from '../lib/useAsync';
import { compact, num, relative } from '../lib/format';
import { AreaChart, Legend, Sparkline } from '../ui/charts';
import { DataTable, type Column } from '../ui/DataTable';
import { Badge, Card, ErrorNote, PageHead, Segmented, Stat, type Tone } from '../ui/primitives';

export type CrashIssue = {
    id: string; platform: 'web' | 'ios'; type: string; message: string; culprit: string; mechanism: string;
    status: 'open' | 'resolved' | 'ignored'; count: number; firstSeen: number | null; lastSeen: number | null;
    lastRelease: string; releases: string[]; environments: string[]; resolvedRelease: string | null; note: string;
    trend?: number[]; installs?: number;
};
type ListResult = { days: string[]; totals: { web: number[]; ios: number[] }; affectedInstalls: number; issues: CrashIssue[] };

export const STATUS_TONE: Record<string, Tone> = { open: 'red', resolved: 'green', ignored: 'neutral' };
export const STATUS_LABEL: Record<string, string> = { open: 'Offen', resolved: 'Erledigt', ignored: 'Ignoriert' };
export const PlatformIcon: React.FC<{ platform: string }> = ({ platform }) => platform === 'ios' ? <Apple size={14} aria-label="iOS" /> : <Globe size={14} aria-label="Web" />;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const Crashes: React.FC = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const status = params.get('status') || 'open';
    const platform = params.get('platform') || 'all';
    const release = params.get('release') || '';
    const days = Number(params.get('days') || 14);
    const [search, setSearch] = useState('');
    const set = (key: string, value: string) => setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: true });

    const { data, loading, error, reload } = useAdminQuery<ListResult>('crashes.list', { days });

    const releases = useMemo(() => Array.from(new Set((data?.issues || []).flatMap((i) => i.releases))).sort().reverse(), [data]);
    const q = search.trim().toLowerCase();
    const rows = (data?.issues || []).filter((i) =>
        (status === 'all' || i.status === status) && (platform === 'all' || i.platform === platform) && (!release || i.releases.includes(release))
        && (!q || `${i.type} ${i.message} ${i.culprit}`.toLowerCase().includes(q)));

    const web = data?.totals.web || [];
    const ios = data?.totals.ios || [];
    const half = Math.floor(web.length / 2);
    const total = sum(web) + sum(ios);
    const recent = sum(web.slice(half)) + sum(ios.slice(half));
    const before = sum(web.slice(0, half)) + sum(ios.slice(0, half));
    const open = (data?.issues || []).filter((i) => i.status === 'open');
    const newIssues = (data?.issues || []).filter((i) => i.firstSeen && i.firstSeen > Date.now() - days * 86_400_000).length;

    const columns: Column<CrashIssue>[] = [
        { key: 'platform', label: '', width: 28, render: (i) => <PlatformIcon platform={i.platform} /> },
        { key: 'type', label: 'Fehler', value: (i) => `${i.type}: ${i.message}`, render: (i) => (
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, padding: '5px 0', maxWidth: 560 }}>
                <span className="ac-strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.type} <span className="ac-muted" style={{ fontWeight: 400 }}>{i.message}</span></span>
                <span className="ac-muted mono" style={{ fontSize: 11 }}>{i.culprit || i.mechanism}</span>
            </div>
        ) },
        { key: 'status', label: 'Status', render: (i) => <Badge tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Badge> },
        { key: 'trend', label: `Trend ${days} T.`, value: (i) => sum(i.trend || []), render: (i) => <div style={{ width: 110 }}><Sparkline values={i.trend || []} height={22} color={i.platform === 'ios' ? 'var(--ac-chart-2)' : 'var(--ac-chart-1)'} /></div> },
        { key: 'count', label: 'Events', num: true, render: (i) => compact(i.count) },
        { key: 'installs', label: 'Installationen', num: true, render: (i) => num(i.installs ?? 0) },
        { key: 'lastRelease', label: 'Release', render: (i) => <span className="mono">{i.lastRelease}</span> },
        { key: 'lastSeen', label: 'Zuletzt', render: (i) => relative(i.lastSeen) },
        { key: 'firstSeen', label: 'Erstmals', render: (i) => relative(i.firstSeen), hidden: true },
    ];

    return (
        <div className="ac-page">
            <PageHead title="Crashes" subtitle="Eigene Crash-Reports von Web und iOS (opt-in, anonym). Gruppiert nach Fingerprint." actions={<>
                <Segmented value={String(days)} onChange={(v) => set('days', v === '14' ? '' : v)} options={[{ value: '7', label: '7 T.' }, { value: '14', label: '14 T.' }, { value: '30', label: '30 T.' }, { value: '90', label: '90 T.' }]} />
                <button className="ac-btn" onClick={reload}>Aktualisieren</button>
            </>} />
            <ErrorNote error={error} onRetry={reload} />
            <div className="ac-grid ac-grid--stats" style={{ marginBottom: 12 }}>
                <Stat label="Events im Zeitraum" value={num(total)} change={before ? (recent - before) / before : null} invert meta="2. vs. 1. Hälfte" />
                <Stat label="Offene Issues" value={num(open.length)} meta={`${num(newIssues)} neu im Zeitraum`} />
                <Stat label="Betroffene Installationen" value={num(data?.affectedInstalls ?? null)} />
                <Stat label="Web / iOS" value={`${num(sum(web))} / ${num(sum(ios))}`} />
            </div>
            <Card title="Events pro Tag" actions={<Legend series={[{ label: 'Web', values: [] }, { label: 'iOS', values: [] }]} />} className="ac-mb">
                <AreaChart days={data?.days || []} bars series={[{ label: 'Web', values: web }, { label: 'iOS', values: ios }]} height={170} />
            </Card>
            <div style={{ height: 12 }} />
            <DataTable
                id="crashes"
                rows={data ? rows : null}
                loading={loading}
                columns={columns}
                rowKey={(i) => i.id}
                onOpen={(i) => navigate(`/crashes/${i.id}`)}
                defaultSort={{ key: 'lastSeen', dir: 'desc' }}
                emptyTitle="Keine Crashes für diesen Filter"
                toolbar={<>
                    <div className="ac-search"><input className="ac-input" placeholder="Typ, Meldung, Stelle …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                    <Segmented value={status} onChange={(v) => set('status', v === 'open' ? '' : v)} options={[{ value: 'open', label: 'Offen' }, { value: 'resolved', label: 'Erledigt' }, { value: 'ignored', label: 'Ignoriert' }, { value: 'all', label: 'Alle' }]} />
                    <Segmented value={platform} onChange={(v) => set('platform', v === 'all' ? '' : v)} options={[{ value: 'all', label: 'Alle' }, { value: 'web', label: 'Web' }, { value: 'ios', label: 'iOS' }]} />
                    <select className="ac-select" value={release} onChange={(e) => set('release', e.target.value)}>
                        <option value="">Alle Releases</option>
                        {releases.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                </>}
            />
        </div>
    );
};
