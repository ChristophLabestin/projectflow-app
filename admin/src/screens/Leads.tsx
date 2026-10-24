import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { adminApi } from '../lib/api';
import { dateTime, num, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { DataTable, type Column } from '../ui/DataTable';
import { Drawer, useUi } from '../ui/Overlay';
import { Badge, ErrorNote, PageHead, Tabs } from '../ui/primitives';

type Kind = 'subscribers' | 'pending' | 'legacy' | 'waitlist' | 'contact';
type Row = { id: string; at: number | null; email?: string; name?: string; status?: string; source?: string; message?: string; confirmed?: boolean; email_confirmed?: boolean; [k: string]: unknown };
const TABS: { value: Kind; label: string; hint: string }[] = [
    { value: 'subscribers', label: 'Newsletter', hint: 'Bestätigte Abonnenten (Double-Opt-in)' },
    { value: 'pending', label: 'Unbestätigt', hint: 'Anmeldungen ohne Bestätigungsklick' },
    { value: 'waitlist', label: 'Warteliste', hint: 'Einträge der Warteliste' },
    { value: 'contact', label: 'Kontaktformular', hint: 'Nachrichten über das Kontaktformular' },
    { value: 'legacy', label: 'Alt (newsletter)', hint: 'Alte Sammlung ohne Bestätigung' },
];

/** Imports legacy newsletter/waitlist entries into the new platform newsletter (dry run first). */
const MigrateButton: React.FC = () => {
    const { confirm, toast } = useUi();
    const run = async () => {
        try {
            const dry = await adminApi<{ result: Record<string, { found: number; imported: number; skipped: number }> }>('newsletter.migrateLegacy', { dryRun: true });
            const lines = Object.entries(dry.result).map(([k, v]) => `${k}: ${v.found} gefunden, ${v.imported} würden übernommen, ${v.skipped} übersprungen`);
            if (!(await confirm({ title: 'Altbestand in den Newsletter übernehmen?', message: <>Probelauf:<br />{lines.map((l) => <span key={l}>{l}<br /></span>)}Danach läuft dieselbe Übernahme ohne Probelauf.</>, confirmLabel: 'Übernehmen' }))) return;
            const real = await adminApi<{ result: Record<string, { imported: number }> }>('newsletter.migrateLegacy', { dryRun: false });
            toast(`Übernommen: ${Object.values(real.result).reduce((a, v) => a + v.imported, 0)}`);
        } catch (err: any) { toast(err.message, 'error'); }
    };
    return <button className="ac-btn" onClick={run}>In Newsletter übernehmen …</button>;
};

export const Leads: React.FC = () => {
    const [kind, setKind] = useState<Kind>('subscribers');
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState<Row | null>(null);
    const { confirm, toast } = useUi();
    const { data, loading, error, reload, setData } = useAdminQuery<{ rows: Row[]; counts: Record<Kind, number> }>('leads.list', { kind });
    const q = search.trim().toLowerCase();
    const rows = (data?.rows || []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));

    const remove = async (row: Row) => {
        if (!(await confirm({ title: 'Eintrag löschen?', message: <>Löscht <b>{row.email || row.id}</b> endgültig (z. B. Löschanfrage nach DSGVO). Wird im Audit-Log protokolliert.</>, danger: true, confirmLabel: 'Löschen' }))) return;
        try {
            await adminApi('leads.delete', { kind, id: row.id });
            setData((d) => (d ? { ...d, rows: d.rows.filter((r) => r.id !== row.id) } : d));
            setOpen(null);
            toast('Gelöscht');
        } catch (err: any) { toast(err.message, 'error'); }
    };

    const columns: Column<Row>[] = [
        { key: 'email', label: 'E-Mail', value: (r) => (r.email as string) || r.id, render: (r) => <span className="ac-strong">{(r.email as string) || r.id}</span> },
        { key: 'name', label: 'Name', value: (r) => (r.name as string) || '' },
        ...(kind === 'contact' ? [{ key: 'message', label: 'Nachricht', value: (r: Row) => String(r.message || ''), render: (r: Row) => <span className="ac-muted">{String(r.message || '').slice(0, 120)}</span> }] : []),
        { key: 'status', label: 'Status', value: (r) => String(r.status ?? (r.confirmed ?? r.email_confirmed ?? '')), render: (r) => (r.status ? <Badge tone={r.status === 'active' ? 'green' : 'neutral'}>{String(r.status)}</Badge> : r.confirmed || r.email_confirmed ? <Badge tone="green">bestätigt</Badge> : <span className="ac-muted">–</span>) },
        { key: 'source', label: 'Quelle', value: (r) => String(r.source || '') },
        { key: 'at', label: 'Datum', render: (r) => <span title={dateTime(r.at)}>{relative(r.at)}</span> },
    ];

    return (
        <div className="ac-page">
            <PageHead title="Leads & Kontakt" subtitle="Altbestand (vor dem neuen Newsletter) und Kontaktformular. Personenbezogene Daten, jeder Abruf landet im Audit-Log." actions={<MigrateButton />} />
            <Tabs value={kind} onChange={(v) => { setKind(v as Kind); setOpen(null); }} tabs={TABS.map((t) => ({ value: t.value, label: <>{t.label} <span className="ac-muted">{data?.counts ? num(data.counts[t.value]) : ''}</span></> }))} />
            <ErrorNote error={error} onRetry={reload} />
            <DataTable id={`leads-${kind}`} exportName={`projectflow-${kind}`} rows={data ? rows : null} loading={loading} columns={columns} rowKey={(r) => r.id} onOpen={setOpen} selectedKey={open?.id} defaultSort={{ key: 'at', dir: 'desc' }}
                emptyTitle="Keine Einträge" emptyHint={TABS.find((t) => t.value === kind)?.hint}
                toolbar={<div className="ac-search"><input className="ac-input" placeholder="Suchen …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>} />
            {open && (
                <Drawer title={(open.email as string) || open.id} subtitle={dateTime(open.at)} onClose={() => setOpen(null)} footer={<button className="ac-btn ac-btn--danger" onClick={() => remove(open)}><Trash2 size={14} />Löschen</button>}>
                    <dl className="ac-kv">
                        {Object.entries(open).filter(([k]) => k !== 'at').map(([k, v]) => (
                            <React.Fragment key={k}><dt>{k}</dt><dd className={typeof v === 'string' && v.length > 80 ? '' : 'mono'} style={{ whiteSpace: 'pre-wrap' }}>{typeof v === 'number' && v > 1_500_000_000_000 ? dateTime(v) : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></React.Fragment>
                        ))}
                    </dl>
                </Drawer>
            )}
        </div>
    );
};
