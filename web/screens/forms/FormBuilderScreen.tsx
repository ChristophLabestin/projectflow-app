// /forms/:formId/edit — builder (brain/plans/forms-concept.md §2): title first, modes Questions · Design ·
// Settings · Share, preview on demand, autosave through saveFormDraft, publish via publishForm.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Button } from '../../components/common/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { Modal } from '../../components/common/Modal/Modal';
import { Skeleton } from '../../components/common/Skeleton/Skeleton';
import { FormSettingsPanel, type FormSettingsValue } from '../../components/forms/builder/FormSettingsPanel';
import { FormSharePanel } from '../../components/forms/builder/FormSharePanel';
import { QuestionsEditor } from '../../components/forms/builder/QuestionsEditor';
import { ThemeEditor } from '../../components/forms/builder/ThemeEditor';
import { formErrorText } from '../../components/forms/builder/formErrors';
import { FormRenderer } from '../../components/forms/renderer/FormRenderer';
import { presetTheme, resolveFormTheme } from '../../components/forms/theme/formThemes';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
    isTenantLegalComplete,
    publishForm,
    saveFormDraft,
    subscribeForm,
    subscribeFormQuota,
    uploadFormAsset,
    type FormDraftPatch
} from '../../services/domain/formsService';
import { getTenant } from '../../services/domain/workspaceService';
import { getWorkspaceMembers } from '../../services/domain/workspaceMembersService';
import { formAssetUrl } from '../../services/forms/publicFormsApi';
import type { Member } from '../../types';
import type { FormDoc, FormTheme, TenantLegal } from '../../types/forms';
import { formFeaturesUsed, validateFormSchema, type FormQuota, type FormSchema } from '../../utils/formsLogic';
import { formStatusLabelKey } from './FormsScreen';
import './forms.scss';

type Mode = 'questions' | 'design' | 'settings' | 'share';
const MODES: { id: Mode; icon: string }[] = [
    { id: 'questions', icon: 'list_alt' },
    { id: 'design', icon: 'palette' },
    { id: 'settings', icon: 'tune' },
    { id: 'share', icon: 'share' }
];

interface Local {
    title: string;
    description: string;
    draft: FormSchema;
    theme: FormTheme;
    settings: FormSettingsValue;
}

const fromForm = (form: FormDoc): Local => ({
    title: form.title || '',
    description: form.description || '',
    draft: form.draft,
    theme: resolveFormTheme(form.theme),
    settings: {
        audience: form.audience || 'public',
        anonymous: !!form.anonymous,
        allowGuests: !!(form as FormDoc & { allowGuests?: boolean }).allowGuests,
        language: form.language || 'de',
        settings: { ...form.settings }
    }
});

const SAVE_DELAY_MS = 800;

export const FormBuilderScreen: React.FC = () => {
    const { formId = '' } = useParams<{ formId: string }>();
    const { t } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [, setSearchParams] = useSearchParams();
    const { showError, showSuccess } = useToast();
    const workspace = useWorkspace();
    const tenantId = workspace.activeWorkspaceId || '';
    const role = workspace.activeWorkspace?.role || 'Member';

    const [form, setForm] = useState<FormDoc | null | undefined>(undefined);
    const [local, setLocal] = useState<Local | null>(null);
    const [mode, setMode] = useState<Mode>('questions');
    const [quota, setQuota] = useState<FormQuota | null>(null);
    const [legal, setLegal] = useState<TenantLegal | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [preview, setPreview] = useState(false);
    const [saveState, setSaveState] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
    const [publishing, setPublishing] = useState(false);

    const pending = useRef<FormDraftPatch>({});
    const timer = useRef<number | null>(null);
    const inflight = useRef<Promise<unknown> | null>(null);

    useEffect(() => {
        if (!tenantId || !formId) return undefined;
        const off = subscribeForm(tenantId, formId, (next) => {
            setForm(next);
            // Initialise the working copy once; later snapshots only refresh server-owned fields.
            setLocal((current) => current || (next ? fromForm(next) : null));
        }, () => setForm(null));
        const offQuota = subscribeFormQuota(tenantId, setQuota);
        getTenant(tenantId).then((tenant: any) => setLegal(tenant?.legal || null)).catch(() => setLegal(null));
        getWorkspaceMembers(tenantId).then(setMembers).catch(() => setMembers([]));
        return () => { off(); offQuota(); };
    }, [tenantId, formId]);

    const flush = useCallback(async () => {
        if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
        if (inflight.current) await inflight.current.catch(() => undefined);
        const patch = pending.current;
        if (!Object.keys(patch).length) return;
        pending.current = {};
        setSaveState('saving');
        const run = saveFormDraft(tenantId, formId, patch)
            .then(() => setSaveState(Object.keys(pending.current).length ? 'pending' : 'saved'))
            .catch((error) => {
                // Keep the failed patch so the next change or publish retries it.
                pending.current = { ...patch, ...pending.current };
                setSaveState('error');
                showError(formErrorText(t, error));
                throw error;
            });
        inflight.current = run;
        try { await run; } finally { inflight.current = null; }
    }, [tenantId, formId, showError, t]);

    // Save on leave.
    useEffect(() => () => { void flush().catch(() => undefined); }, [flush]);

    const queue = (patch: FormDraftPatch) => {
        pending.current = { ...pending.current, ...patch };
        setSaveState('pending');
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => { void flush().catch(() => undefined); }, SAVE_DELAY_MS);
    };

    const update = (patch: Partial<Local>) => {
        setLocal((current) => (current ? { ...current, ...patch } : current));
        const out: FormDraftPatch = {};
        if (patch.title !== undefined) out.title = patch.title;
        if (patch.description !== undefined) out.description = patch.description;
        if (patch.draft) out.draft = patch.draft;
        if (patch.theme) out.theme = patch.theme;
        if (patch.settings) {
            out.audience = patch.settings.audience;
            out.anonymous = patch.settings.anonymous;
            out.allowGuests = patch.settings.allowGuests;
            out.language = patch.settings.language;
            out.settings = patch.settings.settings;
        }
        queue(out);
    };

    const issues = useMemo(() => (local ? validateFormSchema(local.draft) : []), [local]);
    const features = useMemo(() => (local ? formFeaturesUsed(local.draft) : { uploads: false, logic: false }), [local]);
    const planBlocks = [
        features.uploads && quota && !quota.uploads ? t('forms.plan.uploads') : null,
        features.logic && quota && !quota.logic ? t('forms.plan.logic') : null
    ].filter(Boolean) as string[];

    const publishedAt = (form as (FormDoc & { publishedAt?: any }) | null | undefined)?.publishedAt;
    const publishedAtMs = publishedAt?.toMillis ? publishedAt.toMillis() : typeof publishedAt === 'number' ? publishedAt : null;
    const hasUnpublished = !form?.publishedVersion || !publishedAtMs || saveState !== 'saved' || (form.updatedAt > publishedAtMs + 500);

    const publish = async () => {
        if (!local) return;
        if (issues.length) {
            setMode('questions');
            showError(t('forms.publish.fixIssues'));
            return;
        }
        setPublishing(true);
        try {
            await flush();
            await publishForm(tenantId, formId);
            showSuccess(form?.publishedVersion ? t('forms.publish.updated') : t('forms.publish.done'));
            if (!form?.publishedVersion) setMode('share');
        } catch (error) {
            showError(formErrorText(t, error));
        } finally {
            setPublishing(false);
        }
    };

    if (form === undefined || (form && !local)) return <Skeleton className="forms-page__skeleton" />;
    if (form === null || !local) {
        return (
            <EmptyState title={t('forms.notFound')} icon={<span className="material-symbols-outlined">assignment_late</span>}
                actions={<Button variant="secondary" onClick={() => navigate('/forms')}>{t('forms.backToList')}</Button>} />
        );
    }

    const canManageEditors = role === 'Owner' || role === 'Admin' || form.ownerId === user?.uid;
    const theme = quota && !quota.fullTheme ? presetTheme(local.theme.preset || 'projectflow-light') : local.theme;

    return (
        <div className="form-builder">
            <header className="form-builder__bar">
                <Link to="/forms" className="form-builder__back" aria-label={t('forms.backToList')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <div className="form-builder__heading">
                    <span className="form-builder__crumb">{t('nav.forms')}</span>
                    <span className="form-builder__name">{local.title || t('forms.untitled')}</span>
                </div>
                <span className={`forms-status forms-status--${form.status}`}>{t(formStatusLabelKey(form.status))}</span>
                <span className={`form-builder__save form-builder__save--${saveState}`} aria-live="polite">{t(`forms.save.${saveState}`)}</span>
                <nav className="form-builder__modes" aria-label={t('forms.builder.modes')}>
                    {MODES.map((entry) => (
                        <button key={entry.id} type="button" className={`form-builder__mode${mode === entry.id ? ' is-active' : ''}`}
                            aria-current={mode === entry.id ? 'page' : undefined} onClick={() => setMode(entry.id)}>
                            <span className="material-symbols-outlined" aria-hidden="true">{entry.icon}</span>
                            <span>{t(`forms.mode.${entry.id}`)}</span>
                        </button>
                    ))}
                </nav>
                <div className="form-builder__bar-actions">
                    {form.counts.responses > 0 && (
                        <span className="form-builder__responses">{t(form.counts.responses === 1 ? 'forms.list.response' : 'forms.list.responses').replace('{n}', String(form.counts.responses))}</span>
                    )}
                    <Button variant="ghost" icon={<span className="material-symbols-outlined">visibility</span>} onClick={() => setPreview(true)}>
                        {t('forms.preview')}
                    </Button>
                    <Button isLoading={publishing} disabled={!hasUnpublished && form.status !== 'draft'} onClick={() => void publish()}>
                        {!form.publishedVersion ? t('forms.publish.action') : hasUnpublished ? t('forms.publish.changes') : t('forms.publish.upToDate')}
                    </Button>
                </div>
            </header>

            {(issues.length > 0 || planBlocks.length > 0) && mode !== 'share' && (
                <div className="form-builder__alert" role="status">
                    <span className="material-symbols-outlined" aria-hidden="true">error</span>
                    <span>
                        {issues.length > 0 && t(issues.length === 1 ? 'forms.issues.one' : 'forms.issues.many').replace('{n}', String(issues.length))}
                        {planBlocks.length > 0 && ` ${planBlocks.join(' ')}`}
                    </span>
                </div>
            )}

            <main className={`form-builder__canvas form-builder__canvas--${mode}`}>
                {mode === 'questions' && (
                    <>
                        <div className="form-builder__intro">
                            <input className="form-builder__title-input" value={local.title} maxLength={200} placeholder={t('forms.builder.titlePlaceholder')}
                                aria-label={t('forms.builder.title')} onChange={(event) => update({ title: event.target.value })} />
                            <textarea className="form-builder__description-input" value={local.description} maxLength={2000} rows={2}
                                placeholder={t('forms.builder.descriptionPlaceholder')} aria-label={t('forms.builder.description')}
                                onChange={(event) => update({ description: event.target.value })} />
                        </div>
                        <QuestionsEditor
                            draft={local.draft}
                            onChange={(draft) => update({ draft })}
                            issues={issues}
                            logicAllowed={!!quota?.logic}
                            uploadsAllowed={!!quota?.uploads}
                            maxFileBytesCap={25 * 1024 * 1024}
                        />
                    </>
                )}
                {mode === 'design' && (
                    <ThemeEditor
                        theme={local.theme}
                        fullTheme={!!quota?.fullTheme}
                        onChange={(next) => update({ theme: next })}
                        onUpload={(kind, file) => uploadFormAsset(tenantId, formId, kind, file)}
                    />
                )}
                {mode === 'settings' && (
                    <FormSettingsPanel value={local.settings} quota={quota}
                        onChange={(patch) => update({ settings: { ...local.settings, ...patch } })} />
                )}
                {mode === 'share' && (
                    <FormSharePanel
                        tenantId={tenantId}
                        form={form}
                        members={members}
                        canManageEditors={canManageEditors}
                        currentUid={user?.uid || ''}
                        legalComplete={isTenantLegalComplete(legal)}
                        onOpenLegal={() => setSearchParams({ openSettings: 'workspace' })}
                    />
                )}
            </main>

            <Modal isOpen={preview} onClose={() => setPreview(false)} title={t('forms.preview')} size="full" className="form-preview-modal">
                <div className="form-preview">
                    <FormRenderer
                        title={local.title || t('forms.untitled')}
                        description={local.description}
                        schema={local.draft}
                        theme={theme}
                        language={local.settings.language}
                        legal={local.settings.audience === 'public' ? legal : null}
                        consent={local.settings.settings.consent}
                        hideBranding={!!local.settings.settings.hideBranding && !!quota?.removeBranding}
                        uploadsEnabled={false}
                        assetUrl={formAssetUrl}
                        inApp={local.settings.audience === 'workspace'}
                        preview
                        onSubmit={async () => ({ ok: true, confirmation: { text: t('forms.previewSubmitted') } })}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default FormBuilderScreen;
