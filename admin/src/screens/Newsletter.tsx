import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Send, Trash2, UserMinus } from 'lucide-react';
import { adminApi } from '../lib/api';
import { downloadCsv } from '../lib/csv';
import { dateTime, num, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { Meter } from '../ui/charts';
import { DataTable, type Column } from '../ui/DataTable';
import { Drawer, useUi } from '../ui/Overlay';
import { Badge, Card, ErrorNote, PageHead, Segmented, Skeleton, Stat, Tabs } from '../ui/primitives';
import { CAMPAIGN_LABEL, CAMPAIGN_TONE, LIST_LABEL, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, type Campaign, type ListName, type Subscriber } from './newsletterTypes';

type Overview = { counts: Record<ListName, Record<string, number>>; appUsers: number; total: number; daily: { cap: number; day: string | null; sent: number }; recentCampaigns: Campaign[] };

const OverviewTab: React.FC<{ onCampaign: (id: string) => void }> = ({ onCampaign }) => {
    const { data, error, reload } = useAdminQuery<Overview>('newsletter.overview');
    if (!data) return error ? <ErrorNote error={error} onRetry={reload} /> : <Skeleton rows={8} />;
    const today = new Date().toISOString().slice(0, 10);
    const sentToday = data.daily.day === today ? data.daily.sent : 0;
    return (
        <div className="ac-stack">
            <div className="ac-grid ac-grid--stats">
                <Stat label="Newsletter bestätigt" value={num(data.counts.newsletter?.confirmed ?? 0)} meta={`${num(data.counts.newsletter?.pending ?? 0)} unbestätigt · ${num(data.appUsers)} App-Nutzer`} />
                <Stat label="Warteliste bestätigt" value={num(data.counts.waitlist?.confirmed ?? 0)} meta={`${num(data.counts.waitlist?.pending ?? 0)} unbestätigt`} />
                <Stat label="Abgemeldet / Bounce" value={`${num((data.counts.newsletter?.unsubscribed ?? 0) + (data.counts.waitlist?.unsubscribed ?? 0))} / ${num((data.counts.newsletter?.bounced ?? 0) + (data.counts.waitlist?.bounced ?? 0))}`} />
                <div className="ac-card ac-stat"><span className="ac-stat__label">Tageslimit Versand</span><span className="ac-stat__value">{num(sentToday)} / {num(data.daily.cap)}</span><div style={{ marginTop: 8 }}><Meter value={sentToday / Math.max(1, data.daily.cap)} /></div></div>
            </div>
            <div className="ac-grid ac-grid--2">
                {(['newsletter', 'waitlist'] as ListName[]).map((list) => (
                    <Card key={list} title={LIST_LABEL[list]}>
                        <table className="ac-table"><tbody>{(['confirmed', 'pending', 'unsubscribed', 'bounced'] as const).map((s) => <tr key={s}><td><Badge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Badge></td><td className="is-num">{num(data.counts[list]?.[s] ?? 0)}</td></tr>)}</tbody></table>
                    </Card>
                ))}
            </div>
            <Card title="Letzte Kampagnen" flush>
                {data.recentCampaigns.length ? (
                    <table className="ac-table"><thead><tr><th>Kampagne</th><th>Status</th><th className="is-num">Empfänger</th><th>Geändert</th></tr></thead>
                        <tbody>{data.recentCampaigns.map((c) => <tr key={c.id} className="is-clickable" onClick={() => onCampaign(c.id)}><td className="ac-strong">{c.title}</td><td><Badge tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_LABEL[c.status]}</Badge></td><td className="is-num">{num(c.stats?.recipients ?? 0)}</td><td>{relative(c.updatedAt)}</td></tr>)}</tbody></table>
                ) : <div className="ac-empty">Noch keine Kampagne</div>}
            </Card>
        </div>
    );
};

type ConsentEntry = { id: string; list: string; action: string; at: number | null; ip: string | null; userAgent: string | null; by: string | null; consentVersion: string | null; consentText: string | null; via?: string | null; source?: string | null; campaignId?: string | null; reason?: string | null };

const SubscriberDrawer: React.FC<{ id: string; onClose: () => void; onChanged: () => void }> = ({ id, onClose, onChanged }) => {
    const { confirm, toast } = useUi();
    const { data, error, reload } = useAdminQuery<{ subscriber: Subscriber; consentLog: ConsentEntry[] }>('newsletter.subscribers.get', { id });
    const s = data?.subscriber;
    const run = async (action: string, params: Record<string, unknown>, ok: string, dialog: { title: string; message: React.ReactNode; danger?: boolean; label: string; requireText?: string }) => {
        if (!(await confirm({ title: dialog.title, message: dialog.message, danger: dialog.danger, confirmLabel: dialog.label, requireText: dialog.requireText }))) return false;
        try { await adminApi(action, params); toast(ok); onChanged(); return true; } catch (err: any) { toast(err.message, 'error'); return false; }
    };
    return (
        <Drawer wide title={s?.email || 'Abonnent'} subtitle={s ? `${s.name || 'ohne Namen'} · ${s.lang.toUpperCase()} · ${SOURCE_LABEL[s.source] || s.source}${s.uid ? ' · App-Nutzer' : ''}` : undefined} onClose={onClose}
            footer={s && <>
                <button className="ac-btn ac-btn--danger" onClick={async () => {
                    let suppress = true;
                    const ok = await run('newsletter.subscribers.delete', { id, suppress }, 'Gelöscht', { title: `${s.email} endgültig löschen?`, message: <>Löscht Abonnent und Einwilligungsprotokoll (DSGVO Art. 17). <label className="ac-check" style={{ marginTop: 10 }}><input type="checkbox" defaultChecked onChange={(e) => { suppress = e.target.checked; }} />Adresse zusätzlich sperren (keine Mails mehr)</label></>, danger: true, label: 'Löschen', requireText: s.email });
                    if (ok) onClose();
                }}><Trash2 size={14} />Löschen (DSGVO)</button>
            </>}>
            {!data ? (error ? <ErrorNote error={error} onRetry={reload} /> : <Skeleton rows={8} />) : (
                <>
                    {(['newsletter', 'waitlist'] as ListName[]).map((list) => {
                        const m = s!.lists[list];
                        return (
                            <Card key={list} title={LIST_LABEL[list]} actions={m ? <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge> : <Badge>nicht eingetragen</Badge>}>
                                {m ? (
                                    <div className="ac-stack">
                                        <dl className="ac-kv">
                                            <dt>Quelle</dt><dd>{SOURCE_LABEL[m.source] || m.source}</dd>
                                            <dt>Angefragt</dt><dd>{dateTime(m.requestedAt)}</dd>
                                            <dt>Bestätigt</dt><dd>{dateTime(m.confirmedAt)}</dd>
                                            {m.unsubscribedAt && <><dt>Abgemeldet</dt><dd>{dateTime(m.unsubscribedAt)}</dd></>}
                                            {m.bouncedAt && <><dt>Bounce</dt><dd>{dateTime(m.bouncedAt)}</dd></>}
                                            <dt>Einwilligungstext</dt><dd className="mono">{m.consentVersion || '–'}</dd>
                                        </dl>
                                        <div className="ac-row">
                                            {(m.status === 'pending' || m.status === 'unsubscribed') && <button className="ac-btn ac-btn--sm" onClick={() => run('newsletter.subscribers.resendOptin', { id, list }, 'Bestätigungsmail gesendet', { title: 'Bestätigungsmail erneut senden?', message: 'Die Person muss den Link in der Mail klicken (Double-Opt-in). Ohne Klick bleibt sie unbestätigt.', label: 'Senden' }).then(() => reload())}><Send size={13} />Opt-in erneut senden</button>}
                                            {m.status !== 'unsubscribed' && <button className="ac-btn ac-btn--sm" onClick={() => run('newsletter.subscribers.unsubscribe', { id, list, note: 'Admin-Konsole' }, 'Abgemeldet', { title: `Von „${LIST_LABEL[list]}“ abmelden?`, message: 'Die Person bekommt keine Mails dieser Liste mehr. Wird im Einwilligungsprotokoll vermerkt.', label: 'Abmelden' }).then(() => reload())}><UserMinus size={13} />Abmelden</button>}
                                        </div>
                                    </div>
                                ) : <p className="ac-muted" style={{ margin: 0 }}>Nicht eingetragen.</p>}
                            </Card>
                        );
                    })}
                    <Card title="Einwilligungsnachweis" subtitle="Unveränderliches Protokoll je Liste: Zeitpunkt, IP, Gerät und der angezeigte Einwilligungstext." flush>
                        <table className="ac-table"><thead><tr><th>Zeit</th><th>Liste</th><th>Aktion</th><th>Herkunft</th><th>Text-Version</th></tr></thead>
                            <tbody>{data.consentLog.map((e) => (
                                <tr key={e.id} title={e.consentText || ''}><td>{dateTime(e.at)}</td><td>{LIST_LABEL[e.list as ListName] || e.list}</td><td><Badge plain>{e.action}</Badge></td>
                                    <td className="ac-muted is-wrap">{[e.ip, e.via || e.source, e.by, e.reason].filter(Boolean).join(' · ') || '–'}</td><td className="mono ac-muted">{e.consentVersion || '–'}</td></tr>
                            ))}</tbody></table>
                    </Card>
                </>
            )}
        </Drawer>
    );
};

const SubscribersTab: React.FC = () => {
    const { confirm, toast } = useUi();
    const [params, setParams] = useSearchParams();
    const [list, setList] = useState<string>('newsletter');
    const [status, setStatus] = useState<string>('');
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const openId = params.get('subscriber');
    const setOpen = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('subscriber', id); else n.delete('subscriber'); return n; });
    const { data, loading, error, reload } = useAdminQuery<{ items: Subscriber[]; total: number }>('newsletter.subscribers.list', { list: list || undefined, status: status || undefined, query: query || undefined, limit: 5000 });

    const add = async () => {
        let email = '';
        let addList: ListName = 'newsletter';
        let lang: 'de' | 'en' = 'de';
        const ok = await confirm({ title: 'Abonnent hinzufügen', message: <div className="ac-stack">
            <input className="ac-input" type="email" placeholder="adresse@example.com" autoFocus onChange={(e) => { email = e.target.value; }} />
            <div className="ac-row"><select className="ac-select" defaultValue="newsletter" onChange={(e) => { addList = e.target.value as ListName; }}><option value="newsletter">Newsletter</option><option value="waitlist">Warteliste</option></select>
                <select className="ac-select" defaultValue="de" onChange={(e) => { lang = e.target.value as 'de' | 'en'; }}><option value="de">Deutsch</option><option value="en">English</option></select></div>
            <span className="ac-muted">Es geht nur eine Bestätigungsmail raus (Double-Opt-in). Erst nach dem Klick ist die Person eingetragen.</span>
        </div>, confirmLabel: 'Bestätigungsmail senden' });
        if (!ok) return;
        try { const r = await adminApi<{ status: string; mailSent: boolean }>('newsletter.subscribers.add', { email: email.trim(), list: addList, lang }); toast(r.status === 'confirmed' ? 'War bereits bestätigt' : r.mailSent ? 'Bestätigungsmail gesendet' : 'Eingetragen, Mail nicht gesendet', r.mailSent || r.status === 'confirmed' ? 'success' : 'error'); reload(); } catch (err: any) { toast(err.message, 'error'); }
    };
    const exportCsv = async () => {
        if (!list) return toast('Für den Export eine Liste wählen', 'error');
        try {
            const r = await adminApi<{ rows: { email: string; name: string; lang: string; source: string; status: string; confirmedAt: number | null; appUser: boolean }[] }>('newsletter.subscribers.export', { list, status: status || 'confirmed' });
            downloadCsv(`projectflow-${list}-${status || 'confirmed'}`, ['E-Mail', 'Name', 'Sprache', 'Quelle', 'Status', 'Bestätigt', 'App-Nutzer'], r.rows.map((x) => [x.email, x.name, x.lang, x.source, x.status, x.confirmedAt ? new Date(x.confirmedAt).toISOString() : '', x.appUser ? 'ja' : 'nein']));
            toast(`${r.rows.length} Zeilen exportiert (protokolliert)`);
        } catch (err: any) { toast(err.message, 'error'); }
    };

    const membership = (s: Subscriber) => (list ? s.lists[list as ListName] : s.lists.newsletter || s.lists.waitlist);
    const columns: Column<Subscriber>[] = [
        { key: 'email', label: 'E-Mail', render: (s) => <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, padding: '4px 0' }}><span className="ac-strong">{s.email}</span>{s.name && <span className="ac-muted">{s.name}</span>}</div> },
        { key: 'newsletter', label: 'Newsletter', value: (s) => s.lists.newsletter?.status || '', render: (s) => (s.lists.newsletter ? <Badge tone={STATUS_TONE[s.lists.newsletter.status]}>{STATUS_LABEL[s.lists.newsletter.status]}</Badge> : <span className="ac-muted">–</span>) },
        { key: 'waitlist', label: 'Warteliste', value: (s) => s.lists.waitlist?.status || '', render: (s) => (s.lists.waitlist ? <Badge tone={STATUS_TONE[s.lists.waitlist.status]}>{STATUS_LABEL[s.lists.waitlist.status]}</Badge> : <span className="ac-muted">–</span>) },
        { key: 'lang', label: 'Sprache', render: (s) => s.lang.toUpperCase() },
        { key: 'source', label: 'Quelle', render: (s) => SOURCE_LABEL[s.source] || s.source },
        { key: 'uid', label: 'App-Nutzer', value: (s) => (s.uid ? 1 : 0), render: (s) => (s.uid ? <Badge tone="blue" plain>ja</Badge> : <span className="ac-muted">–</span>) },
        { key: 'confirmedAt', label: 'Bestätigt', value: (s) => membership(s)?.confirmedAt ?? null, render: (s) => relative(membership(s)?.confirmedAt ?? null) },
        { key: 'createdAt', label: 'Eingetragen', render: (s) => <span title={dateTime(s.createdAt)}>{relative(s.createdAt)}</span> },
    ];

    return (
        <>
            <ErrorNote error={error} onRetry={reload} />
            <DataTable id="nl-subscribers" exportName="projectflow-subscribers-view" rows={data?.items ?? null} loading={loading} columns={columns} rowKey={(s) => s.id} onOpen={(s) => setOpen(s.id)} selectedKey={openId} defaultSort={{ key: 'createdAt', dir: 'desc' }}
                emptyTitle="Keine Abonnenten für diesen Filter"
                toolbar={<>
                    <form className="ac-search" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}><input className="ac-input" placeholder="E-Mail oder Name, Enter" value={search} onChange={(e) => setSearch(e.target.value)} /></form>
                    <Segmented value={list} onChange={setList} options={[{ value: 'newsletter', label: 'Newsletter' }, { value: 'waitlist', label: 'Warteliste' }, { value: '', label: 'Alle' }]} />
                    <Segmented value={status} onChange={setStatus} options={[{ value: '', label: 'Alle' }, { value: 'confirmed', label: 'Bestätigt' }, { value: 'pending', label: 'Unbestätigt' }, { value: 'unsubscribed', label: 'Abgemeldet' }, { value: 'bounced', label: 'Bounce' }]} />
                    <button className="ac-btn ac-btn--sm" onClick={exportCsv} title="Export der Liste (Standard: bestätigt), protokolliert"><Download size={14} />Liste exportieren</button>
                    <button className="ac-btn ac-btn--sm ac-btn--primary" onClick={add}><Plus size={14} />Hinzufügen</button>
                </>} />
            {openId && <SubscriberDrawer id={openId} onClose={() => setOpen(null)} onChanged={reload} />}
        </>
    );
};

const CampaignsTab: React.FC<{ onOpen: (id: string) => void }> = ({ onOpen }) => {
    const { data, loading, error, reload } = useAdminQuery<{ items: Campaign[] }>('newsletter.campaigns.list', { limit: 200 });
    const columns: Column<Campaign>[] = [
        { key: 'title', label: 'Kampagne', render: (c) => <span className="ac-strong">{c.title}</span> },
        { key: 'status', label: 'Status', render: (c) => <Badge tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_LABEL[c.status]}</Badge> },
        { key: 'audience', label: 'Zielgruppe', value: (c) => c.audience?.list, render: (c) => <span className="ac-muted">{LIST_LABEL[c.audience?.list] || '–'}{c.audience?.lang ? ` · ${c.audience.lang.toUpperCase()}` : ''}{c.audience?.appUsersOnly ? ' · nur App-Nutzer' : ''}</span> },
        { key: 'recipients', label: 'Empfänger', num: true, value: (c) => c.stats?.recipients ?? 0, render: (c) => num(c.stats?.recipients ?? 0) },
        { key: 'sent', label: 'Gesendet', num: true, value: (c) => c.stats?.sent ?? 0, render: (c) => num(c.stats?.sent ?? 0) },
        { key: 'delivery', label: 'Zugestellt', num: true, value: (c) => c.stats?.ses?.delivery ?? 0, render: (c) => num(c.stats?.ses?.delivery ?? 0) },
        { key: 'scheduledAt', label: 'Geplant/gesendet', value: (c) => c.finishedAt || c.startedAt || c.scheduledAt, render: (c) => dateTime(c.finishedAt || c.startedAt || c.scheduledAt) },
        { key: 'updatedAt', label: 'Geändert', render: (c) => relative(c.updatedAt) },
    ];
    return (
        <>
            <ErrorNote error={error} onRetry={reload} />
            <DataTable id="nl-campaigns" rows={data?.items ?? null} loading={loading} columns={columns} rowKey={(c) => c.id} onOpen={(c) => onOpen(c.id)} defaultSort={{ key: 'updatedAt', dir: 'desc' }} emptyTitle="Noch keine Kampagne"
                toolbar={<button className="ac-btn ac-btn--sm ac-btn--primary" onClick={() => onOpen('new')}><Plus size={14} />Neue Kampagne</button>} />
        </>
    );
};

export const NewsletterScreen: React.FC = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') || 'overview';
    const openCampaign = (id: string) => navigate(`/newsletter/campaigns/${id}`);
    return (
        <div className="ac-page">
            <PageHead title="Newsletter" subtitle="Plattform-Newsletter und Warteliste mit Double-Opt-in. Kein Öffnungs- oder Klicktracking." />
            <Tabs value={tab} onChange={(v) => setParams({ tab: v })} tabs={[{ value: 'overview', label: 'Übersicht' }, { value: 'subscribers', label: 'Abonnenten' }, { value: 'campaigns', label: 'Kampagnen' }]} />
            {tab === 'overview' && <OverviewTab onCampaign={openCampaign} />}
            {tab === 'subscribers' && <SubscribersTab />}
            {tab === 'campaigns' && <CampaignsTab onOpen={openCampaign} />}
        </div>
    );
};
