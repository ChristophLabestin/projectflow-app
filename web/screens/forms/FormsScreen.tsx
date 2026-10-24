// /forms — forms I own or edit (Owner/Admin: all), quota at a glance, "new form" from a template.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '../../components/common/Button/Button';
import { ConfirmModal } from '../../components/common/Modal/ConfirmModal';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { Modal } from '../../components/common/Modal/Modal';
import { Skeleton } from '../../components/common/Skeleton/Skeleton';
import { FORM_TEMPLATES } from '../../components/forms/builder/formFactory';
import { formErrorText } from '../../components/forms/builder/formErrors';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
    createForm,
    deleteForm,
    duplicateForm,
    subscribeFormQuota,
    subscribeForms,
    subscribeFormsUsage
} from '../../services/domain/formsService';
import type { FormDoc } from '../../types/forms';
import type { FormQuota } from '../../utils/formsLogic';
import './forms.scss';

export const formStatusLabelKey = (status: FormDoc['status']) => `forms.status.${status}`;

export const FormsScreen: React.FC = () => {
    const { t, dateLocale, language } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showError } = useToast();
    const workspace = useWorkspace();
    const tenantId = workspace.activeWorkspaceId || '';
    const role = workspace.activeWorkspace?.role || 'Member';
    const isGuest = role === 'Guest';
    const seeAll = role === 'Owner' || role === 'Admin';
    const [forms, setForms] = useState<FormDoc[] | null>(null);
    const [quota, setQuota] = useState<FormQuota | null>(null);
    const [usage, setUsage] = useState(0);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [creating, setCreating] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<FormDoc | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        if (!tenantId || !user?.uid || isGuest) return undefined;
        setForms(null);
        const offForms = subscribeForms(tenantId, user.uid, seeAll, setForms, () => setForms([]));
        const offQuota = subscribeFormQuota(tenantId, setQuota);
        const offUsage = subscribeFormsUsage(tenantId, setUsage);
        return () => { offForms(); offQuota(); offUsage(); };
    }, [tenantId, user?.uid, seeAll, isGuest]);

    const active = useMemo(() => (forms || []).filter((form) => form.status === 'published' || form.status === 'paused').length, [forms]);

    const errorMessage = (error: unknown) => formErrorText(t, error);

    const create = async (templateId: string) => {
        const template = FORM_TEMPLATES.find((entry) => entry.id === templateId);
        if (!template) return;
        setCreating(templateId);
        try {
            const built = template.build(t);
            const { formId } = await createForm(tenantId, { ...built, language: language === 'de' ? 'de' : 'en' });
            navigate(`/forms/${formId}/edit`);
        } catch (error) {
            showError(errorMessage(error));
        } finally {
            setCreating(null);
        }
    };

    const duplicate = async (form: FormDoc) => {
        setBusyId(form.id);
        try {
            const { formId } = await duplicateForm(tenantId, form.id);
            navigate(`/forms/${formId}/edit`);
        } catch (error) {
            showError(errorMessage(error));
        } finally {
            setBusyId(null);
        }
    };

    const remove = async () => {
        if (!toDelete) return;
        setBusyId(toDelete.id);
        try {
            await deleteForm(tenantId, toDelete.id);
            setToDelete(null);
        } catch (error) {
            showError(errorMessage(error));
        } finally {
            setBusyId(null);
        }
    };

    if (isGuest) {
        return <EmptyState title={t('forms.noAccess')} icon={<span className="material-symbols-outlined">lock</span>} />;
    }

    return (
        <div className="forms-page">
            <header className="forms-page__head">
                <div>
                    <h1>{t('nav.forms')}</h1>
                    <p>{t('forms.intro')}</p>
                </div>
                <Button icon={<span className="material-symbols-outlined">add</span>} onClick={() => setPickerOpen(true)}>
                    {t('forms.new')}
                </Button>
            </header>

            {quota && (
                <section className="forms-page__stats" aria-label={t('forms.quota.title')}>
                    <div className="forms-stat">
                        <span className="forms-stat__label">{t('forms.quota.active')}</span>
                        <span className="forms-stat__value">{active}{quota.activeForms !== null && <small> / {quota.activeForms}</small>}</span>
                    </div>
                    <div className={`forms-stat${usage >= quota.responsesPerMonth * 0.8 ? ' is-warning' : ''}`}>
                        <span className="forms-stat__label">{t('forms.quota.responses')}</span>
                        <span className="forms-stat__value">{usage.toLocaleString(language)}<small> / {quota.responsesPerMonth.toLocaleString(language)}</small></span>
                    </div>
                </section>
            )}

            {forms === null ? (
                <Skeleton className="forms-page__skeleton" />
            ) : forms.length === 0 ? (
                <EmptyState
                    title={t('forms.empty.title')}
                    message={t('forms.empty.message')}
                    icon={<span className="material-symbols-outlined">assignment</span>}
                    actions={<Button onClick={() => setPickerOpen(true)}>{t('forms.new')}</Button>}
                />
            ) : (
                <ul className="forms-list">
                    {forms.map((form) => (
                        <li key={form.id} className="forms-list__row">
                            <button type="button" className="forms-list__main" onClick={() => navigate(`/forms/${form.id}/edit`)}>
                                <span className="material-symbols-outlined forms-list__icon" aria-hidden="true">
                                    {form.audience === 'workspace' ? 'groups' : 'assignment'}
                                </span>
                                <span className="forms-list__text">
                                    <span className="forms-list__title">{form.title || t('forms.untitled')}</span>
                                    <span className="forms-list__meta">
                                        {t(form.counts.responses === 1 ? 'forms.list.response' : 'forms.list.responses').replace('{n}', form.counts.responses.toLocaleString(language))}
                                        {form.counts.lastResponseAt ? ` · ${t('forms.list.lastResponse').replace('{when}', formatDistanceToNow(form.counts.lastResponseAt, { addSuffix: true, locale: dateLocale }))}` : ''}
                                        {form.updatedAt ? ` · ${t('forms.list.updated').replace('{when}', formatDistanceToNow(form.updatedAt, { addSuffix: true, locale: dateLocale }))}` : ''}
                                    </span>
                                </span>
                                <span className={`forms-status forms-status--${form.status}`}>{t(formStatusLabelKey(form.status))}</span>
                            </button>
                            <div className="forms-list__actions">
                                <Button variant="ghost" size="icon" title={t('forms.list.duplicate')} aria-label={t('forms.list.duplicate')}
                                    disabled={busyId === form.id} onClick={() => void duplicate(form)}>
                                    <span className="material-symbols-outlined">content_copy</span>
                                </Button>
                                {(seeAll || form.ownerId === user?.uid) && (
                                    <Button variant="ghost" size="icon" title={t('forms.list.delete')} aria-label={t('forms.list.delete')}
                                        disabled={busyId === form.id} onClick={() => setToDelete(form)}>
                                        <span className="material-symbols-outlined">delete</span>
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <Modal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} title={t('forms.new')} size="lg">
                <div className="forms-templates">
                    {FORM_TEMPLATES.map((template) => (
                        <button
                            key={template.id}
                            type="button"
                            className="forms-templates__card"
                            disabled={creating !== null}
                            onClick={() => void create(template.id)}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">{template.icon}</span>
                            <strong>{t(`forms.template.${template.id}.title`)}</strong>
                            <small>{t(`forms.template.${template.id}.hint`)}</small>
                            {creating === template.id && <span className="forms-templates__busy">{t('forms.creating')}</span>}
                        </button>
                    ))}
                </div>
            </Modal>

            <ConfirmModal
                isOpen={!!toDelete}
                onClose={() => setToDelete(null)}
                onConfirm={() => void remove()}
                title={t('forms.delete.title')}
                message={t('forms.delete.message').replace('{title}', toDelete?.title || '').replace('{n}', String(toDelete?.counts.responses || 0))}
                confirmLabel={t('forms.list.delete')}
                variant="danger"
                isLoading={!!toDelete && busyId === toDelete.id}
            />
        </div>
    );
};

export default FormsScreen;
