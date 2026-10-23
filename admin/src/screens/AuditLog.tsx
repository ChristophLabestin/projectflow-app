import React, { useState } from 'react';
import { useAdminQuery } from '../lib/useAsync';
import { dateTime, relative } from '../lib/format';
import { DataTable, type Column } from '../ui/DataTable';
import { Drawer } from '../ui/Overlay';
import { Badge, ErrorNote, PageHead } from '../ui/primitives';

export type AuditEntry = { id: string; at: number | null; uid: string | null; email: string | null; action: string; target: string | null; summary: string | null; ok: boolean; error: string | null; ip: string | null; userAgent: string | null };

const toneOf = (entry: AuditEntry) => (!entry.ok ? 'red' : entry.action.startsWith('session.') ? 'neutral' : entry.action.includes('delete') || entry.action.includes('revoke') || entry.action.includes('suspend') ? 'amber' : 'blue');

export const AuditLog: React.FC = () => {
    const [search, setSearch] = useState('');
    const [onlyErrors, setOnlyErrors] = useState(false);
    const [open, setOpen] = useState<AuditEntry | null>(null);
    const { data, loading, error, reload } = useAdminQuery<{ entries: AuditEntry[] }>('audit.list', { limit: 500 });

    const q = search.trim().toLowerCase();
    const rows = (data?.entries || []).filter((e) => (!onlyErrors || !e.ok) && (!q || `${e.action} ${e.target} ${e.summary} ${e.email} ${e.ip}`.toLowerCase().includes(q)));

    const columns: Column<AuditEntry>[] = [
        { key: 'at', label: 'Zeit', value: (e) => e.at, render: (e) => <span title={dateTime(e.at)}>{relative(e.at)}</span>, width: 120 },
        { key: 'action', label: 'Aktion', render: (e) => <Badge tone={toneOf(e)}>{e.action}</Badge> },
        { key: 'target', label: 'Ziel', render: (e) => <span className="mono">{e.target || '–'}</span> },
        { key: 'summary', label: 'Details', render: (e) => <span className="ac-muted">{e.error || e.summary || '–'}</span> },
        { key: 'email', label: 'Admin' },
        { key: 'ip', label: 'IP', render: (e) => <span className="mono ac-muted">{e.ip || '–'}</span> },
        { key: 'userAgent', label: 'User-Agent', hidden: true },
    ];

    return (
        <div className="ac-page">
            <PageHead title="Audit-Log" subtitle="Jede Admin-Aktion mit Zeit, Ziel und Herkunft. Einträge sind unveränderlich und werden 2 Jahre aufbewahrt." actions={<button className="ac-btn" onClick={reload}>Aktualisieren</button>} />
            <ErrorNote error={error} onRetry={reload} />
            <DataTable
                id="audit"
                rows={data ? rows : null}
                loading={loading}
                columns={columns}
                rowKey={(e) => e.id}
                onOpen={setOpen}
                selectedKey={open?.id}
                defaultSort={{ key: 'at', dir: 'desc' }}
                toolbar={<>
                    <div className="ac-search"><input className="ac-input" placeholder="Aktion, Ziel, IP …" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                    <label className="ac-check"><input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />Nur Fehler/Ablehnungen</label>
                </>}
            />
            {open && (
                <Drawer title={open.action} subtitle={dateTime(open.at)} onClose={() => setOpen(null)}>
                    <dl className="ac-kv">
                        <dt>Status</dt><dd>{open.ok ? <Badge tone="green">ok</Badge> : <Badge tone="red">{open.error || 'Fehler'}</Badge>}</dd>
                        <dt>Admin</dt><dd>{open.email} <span className="mono ac-muted">{open.uid}</span></dd>
                        <dt>Ziel</dt><dd className="mono">{open.target || '–'}</dd>
                        <dt>Details</dt><dd>{open.summary || '–'}</dd>
                        <dt>IP</dt><dd className="mono">{open.ip || '–'}</dd>
                        <dt>User-Agent</dt><dd className="ac-muted">{open.userAgent || '–'}</dd>
                        <dt>ID</dt><dd className="mono ac-muted">{open.id}</dd>
                    </dl>
                </Drawer>
            )}
        </div>
    );
};
