import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { adminApi } from '../lib/api';
import { diffLines, withContext } from '../lib/diff';
import { dateTime, num, pct, relative } from '../lib/format';
import { useAdminQuery } from '../lib/useAsync';
import { Meter } from '../ui/charts';
import { useUi } from '../ui/Overlay';
import { Badge, Card, ErrorNote, PageHead, Segmented, Skeleton, Tabs } from '../ui/primitives';

type LegalType = 'privacy' | 'terms' | 'imprint';
type L10n = { de: string; en: string };
const TYPE_LABEL: Record<LegalType, string> = { privacy: 'Datenschutzerklärung', terms: 'Nutzungsbedingungen', imprint: 'Impressum' };
const CHANGE_LABEL: Record<string, string> = { requiresAcceptance: 'Zustimmung erforderlich', notifyOnly: 'Nur informieren' };

type Overview = {
    totalUsers: number;
    documents: { type: LegalType; versions: { version: number; changeType: string; effectiveAt: string; publishedAt: string; accepted: number | null; mail: { status: string; counts: { sent: number; skipped: number; failed: number } } | null }[] }[];
    meta: { type: LegalType; currentVersion: number | null; draft: { updatedAt: number | null; baseVersion: number | null; changeType: string } | null }[];
};
type Version = { version: number; title: L10n; content: L10n; summary: L10n; changeType: string; notifyByEmail: boolean; effectiveAt: number | null; publishedAt: number | null; machineGraceDays: number | null };
type Editor = { type: LegalType; currentVersion: number | null; current: Version | null; draft: (Version & { baseVersion: number | null; updatedAt: number | null }) | null };

export const LegalOverview: React.FC = () => {
    const navigate = useNavigate();
    const { data, loading, error, reload } = useAdminQuery<Overview>('legal.overview');
    return (
        <div className="ac-page">
            <PageHead title="Rechtsdokumente" subtitle="Versionierte Dokumente, Zustimmungsquote und Benachrichtigungen. Vertrag: brain/plans/legal-consent-contract.md" actions={<button className="ac-btn" onClick={reload}>Aktualisieren</button>} />
            <ErrorNote error={error} onRetry={reload} />
            {loading && !data ? <Skeleton /> : data && (
                <div className="ac-grid ac-grid--3">
                    {data.documents.map((doc) => {
                        const meta = data.meta.find((m) => m.type === doc.type);
                        const latest = doc.versions[0];
                        const rate = latest?.accepted != null && data.totalUsers ? latest.accepted / data.totalUsers : null;
                        return (
                            <Card key={doc.type} title={<span className="ac-row"><FileText size={15} />{TYPE_LABEL[doc.type]}</span>} actions={<button className="ac-btn ac-btn--sm ac-btn--primary" onClick={() => navigate(`/legal/${doc.type}`)}>{meta?.draft ? 'Entwurf öffnen' : 'Bearbeiten'}</button>}>
                                <div className="ac-stack">
                                    <div className="ac-row">
                                        <span className="ac-stat__value">{latest ? `v${latest.version}` : '–'}</span>
                                        {latest && <Badge tone={latest.changeType === 'requiresAcceptance' ? 'violet' : 'neutral'}>{CHANGE_LABEL[latest.changeType]}</Badge>}
                                        {meta?.draft && <Badge tone="amber">Entwurf · {relative(meta.draft.updatedAt)}</Badge>}
                                    </div>
                                    {latest?.accepted != null && (
                                        <div>
                                            <div className="ac-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}><span className="ac-muted">Zustimmung v{latest.version}</span><b>{pct(rate)} · {num(latest.accepted)}/{num(data.totalUsers)}</b></div>
                                            <Meter value={rate ?? 0} />
                                        </div>
                                    )}
                                    <table className="ac-table">
                                        <thead><tr><th>Version</th><th>Gültig ab</th><th className="is-num">Zustimmung</th><th>Mail</th></tr></thead>
                                        <tbody>
                                            {doc.versions.slice(0, 6).map((v) => (
                                                <tr key={v.version}>
                                                    <td className="mono">v{v.version}</td>
                                                    <td>{dateTime(Date.parse(v.effectiveAt))}</td>
                                                    <td className="is-num">{v.accepted == null ? '–' : num(v.accepted)}</td>
                                                    <td>{v.mail ? <span title={`gesendet ${v.mail.counts?.sent ?? 0}, übersprungen ${v.mail.counts?.skipped ?? 0}, Fehler ${v.mail.counts?.failed ?? 0}`}><Badge tone={v.mail.status === 'done' ? 'green' : 'amber'}>{v.mail.status} · {num(v.mail.counts?.sent ?? 0)}</Badge></span> : <span className="ac-muted">–</span>}</td>
                                                </tr>
                                            ))}
                                            {!doc.versions.length && <tr><td colSpan={4} className="ac-muted">Noch keine Version veröffentlicht</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

type Form = { title: L10n; content: L10n; summary: L10n; changeType: string; effectiveAt: string; notifyByEmail: boolean; machineGraceDays: number; baseVersion: number | null };
const empty = (): L10n => ({ de: '', en: '' });
const toLocalInput = (ms: number | null) => (ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');

const DiffView: React.FC<{ before: string; after: string }> = ({ before, after }) => {
    const lines = useMemo(() => withContext(diffLines(before, after), 2), [before, after]);
    const changed = lines.filter((l) => l.kind === 'add' || l.kind === 'del').length;
    if (!changed) return <p className="ac-muted">Keine Änderungen gegenüber der aktuellen Version.</p>;
    return (
        <pre className="ac-code ac-diff">
            {lines.map((l, i) => l.kind === 'gap'
                ? <div key={i} className="gap">··· {l.count} unveränderte Zeilen</div>
                : <div key={i} className={l.kind}>{l.kind === 'add' ? '+ ' : l.kind === 'del' ? '- ' : '  '}{l.text}</div>)}
        </pre>
    );
};

export const LegalEditor: React.FC = () => {
    const { type = 'terms' } = useParams() as { type: LegalType };
    const navigate = useNavigate();
    const { confirm, toast } = useUi();
    const { data, loading, error, reload } = useAdminQuery<Editor>('legal.get', { type });
    const [form, setForm] = useState<Form | null>(null);
    const [dirty, setDirty] = useState(false);
    const [lang, setLang] = useState<'de' | 'en'>('de');
    const [view, setView] = useState<'edit' | 'diff' | 'preview'>('edit');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!data) return;
        const d = data.draft;
        setForm(d ? {
            title: d.title, content: d.content, summary: d.summary, changeType: d.changeType, effectiveAt: toLocalInput(d.effectiveAt),
            notifyByEmail: d.notifyByEmail, machineGraceDays: d.machineGraceDays ?? 14, baseVersion: d.baseVersion,
        } : null);
        setDirty(false);
    }, [data]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const startDraft = () => {
        const c = data?.current;
        setForm({ title: c ? { ...c.title } : empty(), content: c ? { ...c.content } : empty(), summary: empty(), changeType: type === 'imprint' ? 'notifyOnly' : 'requiresAcceptance', effectiveAt: '', notifyByEmail: false, machineGraceDays: 14, baseVersion: data?.currentVersion ?? null });
        setDirty(true);
    };
    const patch = (p: Partial<Form>) => { setForm((f) => (f ? { ...f, ...p } : f)); setDirty(true); };
    const patchL = (field: 'title' | 'content' | 'summary', value: string) => { setForm((f) => (f ? { ...f, [field]: { ...f[field], [lang]: value } } : f)); setDirty(true); };

    const missing = form ? (['de', 'en'] as const).flatMap((l) => [!form.title[l].trim() && `Titel (${l.toUpperCase()})`, !form.content[l].trim() && `Inhalt (${l.toUpperCase()})`].filter(Boolean) as string[]) : [];

    const save = async () => {
        if (!form) return false;
        setBusy(true);
        try {
            await adminApi('legal.saveDraft', {
                type, title: form.title, content: form.content, summary: form.summary,
                changeType: type === 'imprint' ? 'notifyOnly' : form.changeType,
                effectiveAt: form.effectiveAt ? new Date(form.effectiveAt).toISOString() : null,
                notifyByEmail: form.notifyByEmail, machineGraceDays: form.machineGraceDays,
            });
            setDirty(false);
            toast('Entwurf gespeichert');
            return true;
        } catch (err: any) {
            toast(err.message, 'error');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const discard = async () => {
        if (!(await confirm({ title: 'Entwurf verwerfen?', message: 'Der gespeicherte Entwurf wird gelöscht. Die veröffentlichten Versionen bleiben unverändert.', confirmLabel: 'Verwerfen', danger: true }))) return;
        setBusy(true);
        try {
            await adminApi('legal.deleteDraft', { type });
            toast('Entwurf verworfen');
            reload();
        } catch (err: any) {
            toast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const publish = async () => {
        if (!form) return;
        const next = (data?.currentVersion ?? 0) + 1;
        const requires = type !== 'imprint' && form.changeType === 'requiresAcceptance';
        const ok = await confirm({
            title: `${TYPE_LABEL[type]} v${next} veröffentlichen?`,
            message: requires
                ? 'Alle Nutzer müssen ab Gültigkeit erneut zustimmen (blockierend), und alle erhalten eine E-Mail. Das lässt sich nicht zurücknehmen.'
                : `Nicht blockierender Hinweis in den Apps${form.notifyByEmail ? ' und eine E-Mail an alle Nutzer' : ''}. Das lässt sich nicht zurücknehmen.`,
            confirmLabel: `v${next} veröffentlichen`,
            danger: requires,
            requireText: requires ? `v${next}` : undefined,
        });
        if (!ok) return;
        if (dirty && !(await save())) return;
        setBusy(true);
        try {
            const result = await adminApi<{ version: number }>('legal.publish', { type, baseVersion: form.baseVersion });
            toast(`v${result.version} veröffentlicht`);
            reload();
        } catch (err: any) {
            toast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    if (loading && !data) return <div className="ac-page"><Skeleton rows={12} /></div>;
    if (!data) return <div className="ac-page"><ErrorNote error={error} onRetry={reload} /></div>;
    const next = (data.currentVersion ?? 0) + 1;

    return (
        <div className="ac-page">
            <button className="ac-btn ac-btn--ghost ac-btn--sm" style={{ marginBottom: 10 }} onClick={() => navigate('/legal')}><ArrowLeft size={14} />Rechtsdokumente</button>
            <PageHead
                title={TYPE_LABEL[type]}
                subtitle={<>Aktuell {data.currentVersion ? `v${data.currentVersion}` : 'keine Version'}{form ? ` · Entwurf für v${next}${data.draft?.updatedAt ? `, gespeichert ${relative(data.draft.updatedAt)}` : ''}` : ''}{dirty ? ' · ungespeichert' : ''}</>}
                actions={form ? <>
                    {data.draft && <button className="ac-btn ac-btn--danger" disabled={busy} onClick={discard}>Verwerfen</button>}
                    <button className="ac-btn" disabled={busy || missing.length > 0 || !dirty} onClick={() => void save()}>Speichern</button>
                    <button className="ac-btn ac-btn--primary" disabled={busy || missing.length > 0} onClick={publish}>v{next} veröffentlichen</button>
                </> : <button className="ac-btn ac-btn--primary" onClick={startDraft}>Neuen Entwurf beginnen</button>}
            />
            {!form ? (
                <Card title={data.current ? `v${data.current.version} · ${data.current.title.de}` : 'Kein Inhalt'} subtitle={data.current ? `Gültig ab ${dateTime(data.current.effectiveAt)}` : undefined}>
                    {data.current ? <pre className="ac-code" style={{ whiteSpace: 'pre-wrap', maxHeight: 640 }}>{data.current.content.de}</pre> : <p className="ac-muted">Beginne einen Entwurf für die erste Version.</p>}
                </Card>
            ) : (
                <div className="ac-grid ac-grid--main-side">
                    <Card title={<Segmented value={lang} onChange={setLang} options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]} />} actions={<Segmented value={view} onChange={setView} options={[{ value: 'edit', label: 'Bearbeiten' }, { value: 'diff', label: `Diff zu v${data.currentVersion ?? 0}` }, { value: 'preview', label: 'Vorschau' }]} />}>
                        <div className="ac-stack">
                            <label className="ac-field"><span>Titel ({lang.toUpperCase()})</span><input className="ac-input" value={form.title[lang]} onChange={(e) => patchL('title', e.target.value)} /></label>
                            {view === 'edit' && <label className="ac-field"><span>Inhalt ({lang.toUpperCase()}) · Markdown</span><textarea className="ac-textarea ac-textarea--code" rows={28} value={form.content[lang]} onChange={(e) => patchL('content', e.target.value)} /></label>}
                            {view === 'diff' && <DiffView before={data.current?.content[lang] ?? ''} after={form.content[lang]} />}
                            {view === 'preview' && <pre className="ac-code" style={{ whiteSpace: 'pre-wrap', maxHeight: 640 }}>{form.content[lang]}</pre>}
                            <label className="ac-field"><span>Was ändert sich? ({lang.toUpperCase()})</span><textarea className="ac-textarea" rows={3} value={form.summary[lang]} onChange={(e) => patchL('summary', e.target.value)} placeholder="Kurz, für Hinweis und E-Mail" /></label>
                        </div>
                    </Card>
                    <div className="ac-stack">
                        <Card title="Veröffentlichung">
                            <div className="ac-stack">
                                {type === 'imprint' ? <p className="ac-muted">Das Impressum ist immer „nur informieren“ und wird nie per E-Mail verschickt.</p> : (
                                    <div className="ac-field">
                                        <span>Art der Änderung</span>
                                        <Segmented value={form.changeType} onChange={(v) => patch({ changeType: v })} options={[{ value: 'requiresAcceptance', label: 'Zustimmung erforderlich' }, { value: 'notifyOnly', label: 'Nur informieren' }]} />
                                        <small>{form.changeType === 'requiresAcceptance' ? 'Blockierend bis zur Zustimmung, E-Mail an alle Nutzer.' : 'Einmaliger Hinweis in der App, E-Mail optional.'}</small>
                                    </div>
                                )}
                                <label className="ac-field"><span>Gültig ab</span><input className="ac-input" type="datetime-local" value={form.effectiveAt} onChange={(e) => patch({ effectiveAt: e.target.value })} /><small>Leer = sofort. E-Mails gehen raus, sobald die Version gilt.</small></label>
                                {type !== 'imprint' && form.changeType === 'notifyOnly' && <label className="ac-check"><input type="checkbox" checked={form.notifyByEmail} onChange={(e) => patch({ notifyByEmail: e.target.checked })} />E-Mail an alle Nutzer</label>}
                                {type !== 'imprint' && <label className="ac-field"><span>Kulanz für Maschinen-Tokens (Tage)</span><input className="ac-input" type="number" min={0} max={365} value={form.machineGraceDays} onChange={(e) => patch({ machineGraceDays: Number(e.target.value) })} /><small>MCP/OAuth/API-Tokens ohne Zustimmung laufen so lange weiter, danach HTTP 403.</small></label>}
                                {missing.length > 0 && <div className="ac-alert">Fehlt: {missing.join(', ')}</div>}
                            </div>
                        </Card>
                        <Card title="Basis">
                            <dl className="ac-kv">
                                <dt>Basisversion</dt><dd>{form.baseVersion ? `v${form.baseVersion}` : '–'}</dd>
                                <dt>Neue Version</dt><dd>v{next}</dd>
                                <dt>Zeilen DE / EN</dt><dd>{num(form.content.de.split('\n').length)} / {num(form.content.en.split('\n').length)}</dd>
                            </dl>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export const LegalTabs = Tabs;
