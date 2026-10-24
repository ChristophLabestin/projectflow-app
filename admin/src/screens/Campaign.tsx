import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Send, Trash2 } from 'lucide-react';
import { adminApi } from '../lib/api';
import { dateTime, num } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { useUi } from '../ui/Overlay';
import { Badge, Card, ErrorNote, PageHead, Segmented, Skeleton, Stat } from '../ui/primitives';
import { CAMPAIGN_LABEL, CAMPAIGN_TONE, type Audience, type Campaign, type Variant } from './newsletterTypes';

type Lang = 'de' | 'en';
type Form = { title: string; defaultLang: Lang; variants: Record<Lang, Variant>; audience: Audience };
const emptyVariant = (): Variant => ({ subject: '', preheader: '', markdown: '' });
const blank = (): Form => ({ title: '', defaultLang: 'de', variants: { de: emptyVariant(), en: emptyVariant() }, audience: { list: 'newsletter', lang: null, appUsersOnly: false, source: null } });
const toForm = (c: Campaign): Form => ({ title: c.title, defaultLang: c.defaultLang, variants: { de: c.variants.de || emptyVariant(), en: c.variants.en || emptyVariant() }, audience: c.audience });
const toInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** Payload for save/preview: only variants that have content. */
const payload = (f: Form) => ({
    title: f.title, defaultLang: f.defaultLang, audience: f.audience,
    variants: Object.fromEntries((['de', 'en'] as Lang[]).filter((l) => f.variants[l].subject || f.variants[l].markdown).map((l) => [l, f.variants[l]])),
});

const HELP = 'Markdown: # Überschrift, **fett**, *kursiv*, [Link](https://…), - Liste, 1. Liste, ---, Button-Zeile [[Text]](https://…), Platzhalter {{name|Fallback}}. Kein HTML.';

export const CampaignEditor: React.FC = () => {
    const { id = 'new' } = useParams();
    const isNew = id === 'new';
    const navigate = useNavigate();
    const { confirm, toast } = useUi();
    const loaded = useAdminQuery<{ campaign: Campaign; problems: { subscriberId: string; status: string; error: string | null }[] }>(isNew ? null : 'newsletter.campaigns.get', { id });
    const campaign = loaded.data?.campaign;
    const [form, setForm] = useState<Form>(blank());
    const [lang, setLang] = useState<Lang>('de');
    const [dirty, setDirty] = useState(false);
    const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [count, setCount] = useState<{ total: number; byLang: { de: number; en: number } } | null>(null);
    const [testEmails, setTestEmails] = useState('');
    const [at, setAt] = useState('');
    const [busy, setBusy] = useState(false);
    const [sampleName, setSampleName] = useState('Anna');

    useEffect(() => { if (campaign) { setForm(toForm(campaign)); setLang(campaign.defaultLang); setDirty(false); } }, [campaign]);
    const editable = isNew || campaign?.status === 'draft';
    const patch = (p: Partial<Form>) => { setForm((f) => ({ ...f, ...p })); setDirty(true); };
    const patchVariant = (p: Partial<Variant>) => { setForm((f) => ({ ...f, variants: { ...f.variants, [lang]: { ...f.variants[lang], ...p } } })); setDirty(true); };
    const patchAudience = (p: Partial<Audience>) => { setForm((f) => ({ ...f, audience: { ...f.audience, ...p } })); setDirty(true); };

    // Live preview (debounced) through the server renderer — the same HTML the mail gets.
    const previewKey = useMemo(() => JSON.stringify({ v: form.variants[lang], t: form.title, lang, sampleName }), [form, lang, sampleName]);
    useEffect(() => {
        const v = form.variants[lang];
        if (!v.subject && !v.markdown) { setPreview(null); return; }
        const timer = setTimeout(() => {
            adminApi<{ subject: string; html: string }>('newsletter.campaigns.preview', { campaign: { ...payload(form), variants: { [lang]: v }, defaultLang: lang }, lang, ...(sampleName.trim() ? { sampleName: sampleName.trim() } : {}) })
                .then((r) => { setPreview(r); setPreviewError(null); })
                .catch((err) => setPreviewError(err.message));
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewKey]);

    const audienceKey = JSON.stringify(form.audience);
    useEffect(() => {
        adminApi<{ total: number; byLang: { de: number; en: number } }>('newsletter.audience.count', { audience: form.audience }).then(setCount).catch(() => setCount(null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audienceKey]);

    const save = async (): Promise<string | null> => {
        setBusy(true);
        try {
            const r = await adminApi<{ id: string }>('newsletter.campaigns.save', { ...(isNew ? {} : { id }), ...payload(form) });
            setDirty(false);
            toast('Entwurf gespeichert');
            if (isNew) navigate(`/newsletter/campaigns/${r.id}`, { replace: true });
            else loaded.reload();
            return r.id;
        } catch (err: any) { toast(err.message, 'error'); return null; } finally { setBusy(false); }
    };
    const ensureSaved = async () => (dirty || isNew ? save() : id);

    const sendTest = async () => {
        const emails = testEmails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean).slice(0, 5);
        const cid = await ensureSaved();
        if (!cid) return;
        try {
            const r = await adminApi<{ results: { email: string; lang: string; transport: string }[] }>('newsletter.campaigns.test', { id: cid, emails, lang });
            toast(`Test an ${r.results.map((x) => `${x.email} (${x.lang}, ${x.transport})`).join(', ')}`);
            loaded.reload();
        } catch (err: any) { toast(err.message, 'error'); }
    };
    const schedule = async (later: boolean) => {
        const cid = await ensureSaved();
        if (!cid) return;
        const when = later ? new Date(at).getTime() : null;
        const ok = await confirm({
            title: later ? `Kampagne für ${new Date(when!).toLocaleString('de-DE')} planen?` : 'Kampagne jetzt senden?',
            message: <>Geht an <b>{num(count?.total ?? 0)} bestätigte Empfänger</b> ({num(count?.byLang.de ?? 0)} DE, {num(count?.byLang.en ?? 0)} EN) der Liste {form.audience.list === 'newsletter' ? 'Newsletter' : 'Warteliste'}. Versand in Tranchen innerhalb des Tageslimits; abgemeldete und gesperrte Adressen werden übersprungen.{campaign?.lastTest ? '' : ' Es gab noch keinen Testversand.'}</>,
            confirmLabel: later ? 'Planen' : 'Jetzt senden', danger: !later, requireText: later ? undefined : 'senden',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const r = await adminApi<{ status: string; recipients: number }>('newsletter.campaigns.schedule', { id: cid, ...(when ? { at: when } : {}) });
            toast(r.status === 'scheduled' ? `Geplant für ${num(r.recipients)} Empfänger` : `Versand gestartet (${num(r.recipients)} Empfänger)`);
            loaded.reload();
        } catch (err: any) { toast(err.message, 'error'); } finally { setBusy(false); }
    };
    const simple = async (action: string, ok: string, dialog: { title: string; message: string; danger?: boolean; label: string }, after?: () => void) => {
        if (!(await confirm({ title: dialog.title, message: dialog.message, danger: dialog.danger, confirmLabel: dialog.label }))) return;
        try { await adminApi(action, { id }); toast(ok); after ? after() : loaded.reload(); } catch (err: any) { toast(err.message, 'error'); }
    };

    if (!isNew && !campaign) return <div className="ac-page">{loaded.error ? <ErrorNote error={loaded.error} onRetry={loaded.reload} /> : <Skeleton rows={12} />}</div>;
    const v = form.variants[lang];
    const st = campaign?.stats || {};

    return (
        <div className="ac-page">
            <button className="ac-btn ac-btn--ghost ac-btn--sm" style={{ marginBottom: 10 }} onClick={() => navigate('/newsletter?tab=campaigns')}><ArrowLeft size={14} />Kampagnen</button>
            <PageHead title={form.title || (isNew ? 'Neue Kampagne' : 'Kampagne')}
                subtitle={<>{campaign ? <Badge tone={CAMPAIGN_TONE[campaign.status]}>{CAMPAIGN_LABEL[campaign.status]}</Badge> : <Badge>Entwurf</Badge>}{campaign?.scheduledAt && campaign.status === 'scheduled' ? ` · geplant ${dateTime(campaign.scheduledAt)}` : ''}{campaign?.lastTest ? ` · Test ${dateTime(campaign.lastTest.at)}` : ''}{dirty ? ' · ungespeichert' : ''}</>}
                actions={<>
                    {editable && !isNew && <button className="ac-btn ac-btn--danger" onClick={() => simple('newsletter.campaigns.delete', 'Gelöscht', { title: 'Entwurf löschen?', message: 'Der Entwurf wird entfernt.', danger: true, label: 'Löschen' }, () => navigate('/newsletter?tab=campaigns'))}><Trash2 size={14} /></button>}
                    {campaign?.status === 'canceled' && <button className="ac-btn ac-btn--danger" onClick={() => simple('newsletter.campaigns.delete', 'Gelöscht', { title: 'Kampagne löschen?', message: 'Entfernt die abgebrochene Kampagne samt Versandprotokoll.', danger: true, label: 'Löschen' }, () => navigate('/newsletter?tab=campaigns'))}><Trash2 size={14} />Löschen</button>}
                    {campaign?.status === 'scheduled' && <button className="ac-btn" onClick={() => simple('newsletter.campaigns.unschedule', 'Zurück auf Entwurf', { title: 'Planung aufheben?', message: 'Die Kampagne wird wieder zum Entwurf.', label: 'Aufheben' })}>Planung aufheben</button>}
                    {(campaign?.status === 'scheduled' || campaign?.status === 'sending') && <button className="ac-btn ac-btn--danger" onClick={() => simple('newsletter.campaigns.cancel', 'Abgebrochen', { title: 'Versand abbrechen?', message: 'Bereits versendete Mails bleiben versendet, der Rest wird nicht mehr zugestellt.', danger: true, label: 'Abbrechen' })}>Versand abbrechen</button>}
                    {editable && <button className="ac-btn ac-btn--primary" disabled={busy || !form.title.trim()} onClick={() => void save()}>Speichern</button>}
                </>} />

            {campaign && campaign.status !== 'draft' && (
                <div className="ac-grid ac-grid--stats" style={{ marginBottom: 12 }}>
                    <Stat label="Empfänger" value={num(st.recipients ?? 0)} meta={`${num(st.skipped ?? 0)} übersprungen · ${num(st.suppressed ?? 0)} gesperrt`} />
                    <Stat label="Gesendet" value={num(st.sent ?? 0)} meta={`${num(st.failed ?? 0)} Fehler`} />
                    <Stat label="Zugestellt" value={num(st.ses?.delivery ?? 0)} meta={`${num(st.ses?.bounce ?? 0)} Bounces · ${num(st.ses?.complaint ?? 0)} Beschwerden`} />
                    <Stat label="Abmeldungen" value={num(st.unsubscribed ?? 0)} meta={campaign.finishedAt ? `fertig ${dateTime(campaign.finishedAt)}` : campaign.startedAt ? `gestartet ${dateTime(campaign.startedAt)}` : undefined} />
                </div>
            )}

            <div className="ac-grid ac-grid--2">
                <div className="ac-stack">
                    <Card title="Inhalt" actions={<Segmented value={lang} onChange={setLang} options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]} />}>
                        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }} className="ac-stack">
                            <label className="ac-field"><span>Interner Titel</span><input className="ac-input" value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="z. B. Release-Notes Oktober" /></label>
                            <label className="ac-field"><span>Betreff ({lang.toUpperCase()})</span><input className="ac-input" value={v.subject} onChange={(e) => patchVariant({ subject: e.target.value })} /></label>
                            <label className="ac-field"><span>Vorschautext ({lang.toUpperCase()})</span><input className="ac-input" value={v.preheader} onChange={(e) => patchVariant({ preheader: e.target.value })} placeholder="Erscheint im Posteingang hinter dem Betreff" /></label>
                            <label className="ac-field"><span>Text ({lang.toUpperCase()}) · Markdown</span><textarea className="ac-textarea ac-textarea--code" rows={18} value={v.markdown} onChange={(e) => patchVariant({ markdown: e.target.value })} /><small>{HELP}</small></label>
                            <div className="ac-field"><span>Standardsprache (für Empfänger ohne passende Variante)</span><Segmented value={form.defaultLang} onChange={(d) => patch({ defaultLang: d })} options={[{ value: 'de', label: 'DE' }, { value: 'en', label: 'EN' }]} /></div>
                        </fieldset>
                    </Card>
                    <Card title="Zielgruppe" subtitle={count ? `${num(count.total)} bestätigte Empfänger · ${num(count.byLang.de)} DE · ${num(count.byLang.en)} EN` : 'Zähle …'}>
                        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }} className="ac-stack">
                            <Segmented value={form.audience.list} onChange={(list) => patchAudience({ list })} options={[{ value: 'newsletter', label: 'Newsletter' }, { value: 'waitlist', label: 'Warteliste' }]} />
                            <div className="ac-row">
                                <select className="ac-select" value={form.audience.lang || ''} onChange={(e) => patchAudience({ lang: (e.target.value || null) as Audience['lang'] })}><option value="">Alle Sprachen</option><option value="de">nur Deutsch</option><option value="en">nur Englisch</option></select>
                                <select className="ac-select" value={form.audience.source || ''} onChange={(e) => patchAudience({ source: e.target.value || null })}><option value="">Alle Quellen</option><option value="landing">Landing</option><option value="app">App</option><option value="onboarding">Onboarding</option><option value="admin">Admin</option><option value="legacy">Altbestand</option></select>
                                <label className="ac-check"><input type="checkbox" checked={form.audience.appUsersOnly} onChange={(e) => patchAudience({ appUsersOnly: e.target.checked })} />nur App-Nutzer</label>
                            </div>
                        </fieldset>
                    </Card>
                    {editable && (
                        <Card title="Testen & senden">
                            <div className="ac-stack">
                                <div className="ac-row">
                                    <input className="ac-input" style={{ flex: 1 }} placeholder="Test an (bis 5 Adressen, Komma-getrennt)" value={testEmails} onChange={(e) => setTestEmails(e.target.value)} />
                                    <button className="ac-btn" disabled={busy || !testEmails.trim() || !form.title.trim()} onClick={sendTest}><Send size={14} />Test ({lang.toUpperCase()})</button>
                                </div>
                                <div className="ac-row">
                                    <button className="ac-btn ac-btn--primary" disabled={busy || !form.title.trim() || !count?.total} onClick={() => schedule(false)}><Send size={14} />Jetzt senden …</button>
                                    <input className="ac-input" type="datetime-local" min={toInput(Date.now())} value={at} onChange={(e) => setAt(e.target.value)} />
                                    <button className="ac-btn" disabled={busy || !at || new Date(at).getTime() < Date.now() + 60_000 || !count?.total} onClick={() => schedule(true)}><CalendarClock size={14} />Planen …</button>
                                </div>
                            </div>
                        </Card>
                    )}
                    {loaded.data?.problems?.length ? (
                        <Card title="Probleme beim Versand" flush>
                            <table className="ac-table"><thead><tr><th>Empfänger</th><th>Status</th><th>Fehler</th></tr></thead>
                                <tbody>{loaded.data.problems.map((p) => <tr key={p.subscriberId}><td className="mono">{p.subscriberId.slice(0, 12)}</td><td><Badge tone="red" plain>{p.status}</Badge></td><td className="ac-muted is-wrap">{p.error || '–'}</td></tr>)}</tbody></table>
                        </Card>
                    ) : null}
                </div>
                <Card title="Vorschau" subtitle={preview ? `Betreff: ${preview.subject}` : 'Betreff und Text eingeben'} actions={<input className="ac-input" style={{ width: 150 }} placeholder="Beispielname (leer = Fallback)" title="Ersetzt {{name}} in der Vorschau" value={sampleName} onChange={(e) => setSampleName(e.target.value)} />}>
                    {previewError && <div className="ac-alert ac-alert--error" style={{ marginBottom: 8 }}>{previewError}</div>}
                    {preview ? <iframe title="Newsletter-Vorschau" sandbox="" srcDoc={preview.html} className="ac-mail-preview" /> : <div className="ac-empty">Noch nichts zu zeigen</div>}
                </Card>
            </div>
        </div>
    );
};
