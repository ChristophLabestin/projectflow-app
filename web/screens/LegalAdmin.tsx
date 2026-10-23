import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { MarkdownContent, MarkdownDiff } from '../components/legal/MarkdownContent';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';
import { hasPlatformAdminClaim } from '../services/onboardingInsightsService';
import {
    deleteLegalDraft,
    fetchLegalAdminOverview,
    fetchLegalDraft,
    listLegalVersions,
    publishLegalDraft,
    saveLegalDraft,
    type LegalAdminOverview,
    type LegalVersion,
} from '../services/legalService';
import { LEGAL_TYPES, type LegalChangeType, type LegalType, type Localized } from '../utils/legalConsent';
import { NotFound } from './NotFound';
import './legal-admin.scss';

type DraftForm = {
    title: Localized;
    content: Localized;
    summary: Localized;
    changeType: LegalChangeType;
    effectiveAt: string; // datetime-local value, '' = immediately
    notifyByEmail: boolean;
    machineGraceDays: number;
    baseVersion: number | null;
};

const emptyLocalized = (): Localized => ({ de: '', en: '' });

const toLocalInput = (ms: number | null) => {
    if (!ms) return '';
    const date = new Date(ms);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultChangeType = (type: LegalType): LegalChangeType => (type === 'terms' ? 'requiresAcceptance' : 'notifyOnly');

/** Platform-admin only: drafts, preview/diff, publishing and history of legal documents (/admin/legal). */
export const LegalAdmin: React.FC = () => {
    const { t, language } = useLanguage();
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const uiLang = language === 'de' ? 'de' : 'en';

    const [allowed, setAllowed] = useState<boolean | null>(null);
    const [type, setType] = useState<LegalType>('terms');
    const [versions, setVersions] = useState<LegalVersion[]>([]);
    const [draft, setDraft] = useState<DraftForm | null>(null);
    const [dirty, setDirty] = useState(false);
    const [overview, setOverview] = useState<LegalAdminOverview | null>(null);
    const [editLang, setEditLang] = useState<'de' | 'en'>('de');
    const [mode, setMode] = useState<'edit' | 'preview' | 'diff'>('edit');
    const [busy, setBusy] = useState<'save' | 'publish' | 'discard' | null>(null);
    const [confirm, setConfirm] = useState<'publish' | 'discard' | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        hasPlatformAdminClaim().then((value) => { if (!cancelled) setAllowed(value); }).catch(() => { if (!cancelled) setAllowed(false); });
        return () => { cancelled = true; };
    }, [user?.uid]);

    const load = useCallback(async (nextType: LegalType) => {
        setLoading(true);
        try {
            const [nextVersions, nextDraft, nextOverview] = await Promise.all([
                listLegalVersions(nextType),
                fetchLegalDraft(nextType),
                fetchLegalAdminOverview().catch((error) => { console.error(error); return null; }),
            ]);
            setVersions(nextVersions);
            setOverview(nextOverview);
            setDirty(false);
            setDraft(nextDraft ? {
                title: nextDraft.title,
                content: nextDraft.content,
                summary: nextDraft.summary,
                changeType: nextDraft.changeType,
                effectiveAt: toLocalInput(nextDraft.effectiveAtMs),
                notifyByEmail: nextDraft.notifyByEmail,
                machineGraceDays: nextDraft.machineGraceDays,
                baseVersion: nextDraft.baseVersion,
            } : null);
        } catch (error) {
            console.error('Loading legal admin data failed', error);
            showError(t('legalAdmin.error.load'));
        } finally {
            setLoading(false);
        }
    }, [showError, t]);

    useEffect(() => {
        if (allowed) void load(type);
    }, [allowed, type, load]);

    const current = versions[0] ?? null;
    const overviewDoc = overview?.documents.find((doc) => doc.type === type);

    const startDraft = () => {
        setDraft({
            title: current ? { ...current.title } : emptyLocalized(),
            content: current ? { ...current.content } : emptyLocalized(),
            summary: emptyLocalized(),
            changeType: defaultChangeType(type),
            effectiveAt: '',
            notifyByEmail: false,
            machineGraceDays: 14,
            baseVersion: current?.version ?? null,
        });
        setDirty(true);
        setMode('edit');
    };

    const update = (patch: Partial<DraftForm>) => {
        setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
        setDirty(true);
    };
    const updateLocalized = (field: 'title' | 'content' | 'summary', value: string) => {
        setDraft((prev) => (prev ? { ...prev, [field]: { ...prev[field], [editLang]: value } } : prev));
        setDirty(true);
    };

    const save = async () => {
        if (!draft) return false;
        setBusy('save');
        try {
            await saveLegalDraft({
                type,
                title: draft.title,
                content: draft.content,
                summary: draft.summary,
                changeType: type === 'imprint' ? 'notifyOnly' : draft.changeType,
                effectiveAt: draft.effectiveAt ? new Date(draft.effectiveAt).toISOString() : null,
                notifyByEmail: draft.notifyByEmail,
                machineGraceDays: draft.machineGraceDays,
            });
            setDirty(false);
            showSuccess(t('legalAdmin.saved'));
            return true;
        } catch (error: any) {
            console.error('Saving legal draft failed', error);
            showError(error?.message || t('legalAdmin.error.save'));
            return false;
        } finally {
            setBusy(null);
        }
    };

    const publish = async () => {
        if (!draft) return;
        if (dirty && !(await save())) return;
        setBusy('publish');
        try {
            const result = await publishLegalDraft(type, draft.baseVersion);
            showSuccess(t('legalAdmin.published').replace('{version}', String(result.version)));
            setConfirm(null);
            await load(type);
        } catch (error: any) {
            console.error('Publishing legal draft failed', error);
            showError(error?.message || t('legalAdmin.error.publish'));
        } finally {
            setBusy(null);
        }
    };

    const discard = async () => {
        setBusy('discard');
        try {
            await deleteLegalDraft(type);
            setConfirm(null);
            await load(type);
        } catch (error) {
            console.error('Deleting legal draft failed', error);
            showError(t('legalAdmin.error.save'));
        } finally {
            setBusy(null);
        }
    };

    const missingFields = useMemo(() => {
        if (!draft) return [];
        const missing: string[] = [];
        for (const lang of ['de', 'en'] as const) {
            if (!draft.title[lang].trim()) missing.push(`${t('legalAdmin.field.title')} (${lang.toUpperCase()})`);
            if (!draft.content[lang].trim()) missing.push(`${t('legalAdmin.field.content')} (${lang.toUpperCase()})`);
        }
        return missing;
    }, [draft, t]);

    if (allowed === null) return null;
    if (!allowed) return <NotFound />;

    const effectiveChangeType: LegalChangeType = type === 'imprint' ? 'notifyOnly' : draft?.changeType ?? 'notifyOnly';
    const sendsMail = type !== 'imprint' && (effectiveChangeType === 'requiresAcceptance' || Boolean(draft?.notifyByEmail));
    const nextVersion = (current?.version ?? 0) + 1;
    const formatDate = (iso: string | number) => new Date(iso).toLocaleString(uiLang === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const percent = (count: number | null) => (count == null || !overview?.totalUsers ? '–' : `${Math.round((count / overview.totalUsers) * 100)} % (${count}/${overview.totalUsers})`);

    return (
        <div className="legal-admin">
            <header className="legal-admin__head">
                <div>
                    <h1 className="legal-admin__title">{t('legalAdmin.title')}</h1>
                    <p className="legal-admin__subtitle">{t('legalAdmin.subtitle')}</p>
                </div>
                <div className="legal-admin__tabs" role="tablist">
                    {LEGAL_TYPES.map((key) => (
                        <Button key={key} size="sm" variant={key === type ? 'primary' : 'ghost'} role="tab" aria-selected={key === type} onClick={() => setType(key)} disabled={busy !== null}>
                            {t(`legal.nav.${key}`)}
                        </Button>
                    ))}
                </div>
            </header>

            <section className="legal-admin__card">
                <div className="legal-admin__row">
                    <div>
                        <h2 className="legal-admin__section-title">{t(`legal.nav.${type}`)}</h2>
                        <p className="legal-admin__muted">
                            {current
                                ? `${t('legalConsent.versionLabel').replace('{version}', String(current.version))} · ${t('legalConsent.effectiveFrom').replace('{date}', formatDate(current.effectiveAtMs))}`
                                : t('legalAdmin.noVersion')}
                        </p>
                    </div>
                    {!draft && !loading && <Button onClick={startDraft}>{t('legalAdmin.newDraft')}</Button>}
                </div>
            </section>

            {draft && (
                <section className="legal-admin__card" data-testid="legal-admin-draft">
                    <div className="legal-admin__row">
                        <h2 className="legal-admin__section-title">
                            {t('legalAdmin.draftTitle').replace('{version}', String(nextVersion))}
                            {dirty && <span className="legal-admin__dirty"> · {t('legalAdmin.unsaved')}</span>}
                        </h2>
                        <div className="legal-admin__tabs">
                            {(['de', 'en'] as const).map((lang) => (
                                <Button key={lang} size="sm" variant={lang === editLang ? 'secondary' : 'ghost'} onClick={() => setEditLang(lang)}>{lang.toUpperCase()}</Button>
                            ))}
                            <span className="legal-admin__sep" />
                            {(['edit', 'preview', 'diff'] as const).map((key) => (
                                <Button key={key} size="sm" variant={key === mode ? 'secondary' : 'ghost'} onClick={() => setMode(key)} disabled={key === 'diff' && !current}>
                                    {t(`legalAdmin.mode.${key}`)}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Input label={`${t('legalAdmin.field.title')} (${editLang.toUpperCase()})`} value={draft.title[editLang]} onChange={(event) => updateLocalized('title', event.target.value)} />

                    {mode === 'edit' && (
                        <label className="legal-admin__field">
                            <span>{`${t('legalAdmin.field.content')} (${editLang.toUpperCase()}) · Markdown`}</span>
                            <textarea
                                className="legal-admin__editor"
                                value={draft.content[editLang]}
                                onChange={(event) => updateLocalized('content', event.target.value)}
                                spellCheck
                            />
                        </label>
                    )}
                    {mode === 'preview' && <div className="legal-admin__preview"><MarkdownContent markdown={draft.content[editLang]} /></div>}
                    {mode === 'diff' && current && (
                        <div className="legal-admin__preview">
                            <MarkdownDiff
                                before={current.content[editLang]}
                                after={draft.content[editLang]}
                                labels={{ added: t('legalConsent.diff.added'), removed: t('legalConsent.diff.removed'), unchanged: t('legalConsent.diff.unchanged') }}
                            />
                        </div>
                    )}

                    <label className="legal-admin__field">
                        <span>{`${t('legalAdmin.field.summary')} (${editLang.toUpperCase()})`}</span>
                        <textarea
                            className="legal-admin__summary"
                            value={draft.summary[editLang]}
                            placeholder={t('legalAdmin.field.summaryHint')}
                            onChange={(event) => updateLocalized('summary', event.target.value)}
                        />
                    </label>

                    <div className="legal-admin__options">
                        <fieldset className="legal-admin__fieldset" disabled={type === 'imprint'}>
                            <legend>{t('legalAdmin.field.changeType')}</legend>
                            {(['requiresAcceptance', 'notifyOnly'] as const).map((value) => (
                                <label key={value} className="legal-admin__radio">
                                    <input type="radio" name="changeType" checked={effectiveChangeType === value} onChange={() => update({ changeType: value })} />
                                    <span>
                                        <strong>{t(`legalAdmin.changeType.${value}`)}</strong>
                                        <small>{t(`legalAdmin.changeType.${value}Hint`)}</small>
                                    </span>
                                </label>
                            ))}
                            {type === 'imprint' && <small className="legal-admin__muted">{t('legalAdmin.imprintHint')}</small>}
                        </fieldset>
                        <div className="legal-admin__fieldset">
                            <Input
                                type="datetime-local"
                                label={t('legalAdmin.field.effectiveAt')}
                                value={draft.effectiveAt}
                                onChange={(event) => update({ effectiveAt: event.target.value })}
                            />
                            <small className="legal-admin__muted">{t('legalAdmin.field.effectiveAtHint')}</small>
                            {type !== 'imprint' && effectiveChangeType === 'notifyOnly' && (
                                <Checkbox label={t('legalAdmin.field.notifyByEmail')} checked={draft.notifyByEmail} onChange={(event) => update({ notifyByEmail: event.target.checked })} />
                            )}
                            {effectiveChangeType === 'requiresAcceptance' && <small className="legal-admin__muted">{t('legalAdmin.mailAlways')}</small>}
                            {effectiveChangeType === 'requiresAcceptance' && (
                                <>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={365}
                                        label={t('legalAdmin.field.machineGraceDays')}
                                        value={String(draft.machineGraceDays)}
                                        onChange={(event) => update({ machineGraceDays: Math.max(0, Math.min(365, Math.round(Number(event.target.value) || 0))) })}
                                    />
                                    <small className="legal-admin__muted">{t('legalAdmin.field.machineGraceDaysHint')}</small>
                                </>
                            )}
                        </div>
                    </div>

                    {missingFields.length > 0 && <p className="legal-admin__warning">{t('legalAdmin.missing')}: {missingFields.join(', ')}</p>}

                    <div className="legal-admin__actions">
                        <Button variant="ghost" onClick={() => setConfirm('discard')} disabled={busy !== null}>{t('legalAdmin.discard')}</Button>
                        <Button variant="secondary" onClick={() => void save()} loading={busy === 'save'} disabled={busy !== null || missingFields.length > 0}>{t('legalAdmin.save')}</Button>
                        <Button onClick={() => setConfirm('publish')} disabled={busy !== null || missingFields.length > 0} data-testid="legal-admin-publish">{t('legalAdmin.publish')}</Button>
                    </div>
                </section>
            )}

            <section className="legal-admin__card">
                <h2 className="legal-admin__section-title">{t('legalAdmin.history')}</h2>
                {versions.length === 0 ? (
                    <p className="legal-admin__muted">{t('legalAdmin.noVersion')}</p>
                ) : (
                    <div className="legal-admin__table-wrap">
                        <table className="legal-admin__table">
                            <thead>
                                <tr>
                                    <th>{t('legalAdmin.col.version')}</th>
                                    <th>{t('legalAdmin.col.type')}</th>
                                    <th>{t('legalAdmin.col.published')}</th>
                                    <th>{t('legalAdmin.col.effective')}</th>
                                    {type !== 'imprint' && <th>{t('legalAdmin.col.acceptance')}</th>}
                                    <th>{t('legalAdmin.col.mail')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {versions.map((version) => {
                                    const stats = overviewDoc?.versions.find((entry) => entry.version === version.version);
                                    return (
                                        <tr key={version.version}>
                                            <td>v{version.version}</td>
                                            <td>{t(`legalAdmin.changeType.${version.changeType}`)}</td>
                                            <td>{formatDate(version.publishedAtMs)}</td>
                                            <td>{formatDate(version.effectiveAtMs)}</td>
                                            {type !== 'imprint' && <td>{percent(stats?.accepted ?? null)}</td>}
                                            <td>
                                                {stats?.mail
                                                    ? `${t(`legalAdmin.mailStatus.${stats.mail.status}`)} · ${t('legalAdmin.mailCounts').replace('{sent}', String(stats.mail.counts.sent)).replace('{failed}', String(stats.mail.counts.failed))}`
                                                    : '–'}
                                            </td>
                                            <td><Link to={`/legal/${type}?v=${version.version}`} target="_blank" rel="noopener">{t('legalAdmin.view')}</Link></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {confirm === 'publish' && draft && (
                <Modal
                    isOpen
                    onClose={() => busy === null && setConfirm(null)}
                    title={t('legalAdmin.confirmPublish.title').replace('{version}', String(nextVersion))}
                    footer={(
                        <div className="legal-admin__actions">
                            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy !== null}>{t('common.cancel')}</Button>
                            <Button onClick={() => void publish()} loading={busy === 'publish'} data-testid="legal-admin-confirm-publish">{t('legalAdmin.publish')}</Button>
                        </div>
                    )}
                >
                    <ul className="legal-admin__confirm-list">
                        <li>{t(`legal.nav.${type}`)} · v{nextVersion} · {t(`legalAdmin.changeType.${effectiveChangeType}`)}</li>
                        <li>{draft.effectiveAt ? t('legalConsent.effectiveFrom').replace('{date}', formatDate(new Date(draft.effectiveAt).getTime())) : t('legalAdmin.confirmPublish.immediately')}</li>
                        <li>{effectiveChangeType === 'requiresAcceptance' ? t('legalAdmin.confirmPublish.gate') : t('legalAdmin.confirmPublish.notice')}</li>
                        <li>{sendsMail ? t('legalAdmin.confirmPublish.mail') : t('legalAdmin.confirmPublish.noMail')}</li>
                        {!draft.summary.de.trim() || !draft.summary.en.trim() ? <li className="legal-admin__warning">{t('legalAdmin.confirmPublish.noSummary')}</li> : null}
                    </ul>
                    <p className="legal-admin__muted">{t('legalAdmin.confirmPublish.immutable')}</p>
                </Modal>
            )}

            {confirm === 'discard' && (
                <Modal
                    isOpen
                    onClose={() => busy === null && setConfirm(null)}
                    title={t('legalAdmin.confirmDiscard.title')}
                    footer={(
                        <div className="legal-admin__actions">
                            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy !== null}>{t('common.cancel')}</Button>
                            <Button variant="danger" onClick={() => void discard()} loading={busy === 'discard'}>{t('legalAdmin.discard')}</Button>
                        </div>
                    )}
                >
                    <p className="legal-admin__muted">{t('legalAdmin.confirmDiscard.text')}</p>
                </Modal>
            )}
        </div>
    );
};
