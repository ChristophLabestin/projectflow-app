import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
    Initiative,
    InitiativeFeedbackField,
    InitiativeFeedbackFieldRole,
    InitiativeFeedbackFormSettings,
    InitiativeFeedbackFieldType,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { saveInitiativeFeedbackConfig } from '../services/initiativeFeedbackService';
import {
    createCustomInitiativeFeedbackField,
    defaultInitiativeFeedbackFields,
    ensureInitiativeFeedbackFields,
    feedbackFieldNeedsOptions,
    getFeedbackFieldRoleIcon,
    getFeedbackFieldTypeIcon,
} from '../utils/initiativeFeedbackBuilder';
import { Button } from './common/Button/Button';
import { Checkbox } from './common/Checkbox/Checkbox';
import { TextArea } from './common/Input/TextArea';
import { TextInput } from './common/Input/TextInput';
import { Select, type SelectOption } from './common/Select/Select';

interface InitiativeFeedbackModalProps {
    isOpen: boolean;
    tenantId?: string;
    projectId: string;
    initiative: Initiative | null;
    onClose: () => void;
    onSaved: (feedbackForm: InitiativeFeedbackFormSettings) => void;
}

type DraftState = {
    enabled: boolean;
    title: string;
    description: string;
    submitLabel: string;
    successMessage: string;
    allowAttachments: boolean;
    maxAttachments: number;
    fields: InitiativeFeedbackField[];
};

const buildDraft = (initiative: Initiative | null): DraftState => ({
    enabled: initiative?.feedbackForm?.enabled === true,
    title: initiative?.feedbackForm?.title || '',
    description: initiative?.feedbackForm?.description || '',
    submitLabel: initiative?.feedbackForm?.submitLabel || '',
    successMessage: initiative?.feedbackForm?.successMessage || '',
    allowAttachments: initiative?.feedbackForm?.allowAttachments !== false,
    maxAttachments: initiative?.feedbackForm?.maxAttachments || 3,
    fields: ensureInitiativeFeedbackFields(initiative?.feedbackForm?.fields).map((field) => ({
        ...field,
        options: Array.isArray(field.options) ? field.options : [],
    })),
});

const SAMPLE_VALUES: Record<InitiativeFeedbackFieldRole | 'general', string> = {
    title: 'The settings save button did not respond',
    description: 'I changed the workspace name, clicked save, and nothing happened. A loading state or inline confirmation would help.',
    customerName: 'Jordan Lee',
    customerEmail: 'jordan@acme.co',
    company: 'Acme Co.',
    sourceUrl: 'https://app.example.com/workspace/settings',
    general: 'Example response',
};

const sampleValueForField = (field: InitiativeFeedbackField) => {
    if (field.type === 'select') {
        return field.options?.[0]?.label || 'Choose an option';
    }
    return SAMPLE_VALUES[field.role || 'general'] || 'Example response';
};

export const InitiativeFeedbackModal: React.FC<InitiativeFeedbackModalProps> = ({
    isOpen,
    tenantId,
    projectId,
    initiative,
    onClose,
    onSaved,
}) => {
    const { t } = useLanguage();
    const [draft, setDraft] = useState<DraftState>(() => buildDraft(initiative));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const nextDraft = buildDraft(initiative);
        setDraft(nextDraft);
        setSaving(false);
        setError(null);
        setCopiedField(null);
        setSelectedFieldId(nextDraft.fields[0]?.id || null);
    }, [initiative, isOpen]);

    useEffect(() => {
        if (!copiedField) return;
        const timer = window.setTimeout(() => setCopiedField(null), 1800);
        return () => window.clearTimeout(timer);
    }, [copiedField]);

    useEffect(() => {
        if (!draft.fields.some((field) => field.id === selectedFieldId)) {
            setSelectedFieldId(draft.fields[0]?.id || null);
        }
    }, [draft.fields, selectedFieldId]);

    const hostedUrl = useMemo(() => {
        if (!initiative?.feedbackForm?.token) return '';
        return `${window.location.origin}/feedback/initiative/${initiative.feedbackForm.token}`;
    }, [initiative?.feedbackForm?.token]);

    const submitEndpoint = useMemo(() => {
        const base = import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL
            ? String(import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL).replace(/\/$/, '')
            : `https://europe-west3-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`;
        return `${base}/submitInitiativeFeedback`;
    }, []);

    const selectedField = useMemo(
        () => draft.fields.find((field) => field.id === selectedFieldId) || null,
        [draft.fields, selectedFieldId],
    );

    const enabledFields = useMemo(
        () => draft.fields.filter((field) => field.enabled !== false),
        [draft.fields],
    );

    const fieldTypeOptions = useMemo<SelectOption[]>(
        () => [
            { value: 'shortText', label: t('initiatives.feedback.builder.fieldTypes.shortText') },
            { value: 'longText', label: t('initiatives.feedback.builder.fieldTypes.longText') },
            { value: 'email', label: t('initiatives.feedback.builder.fieldTypes.email') },
            { value: 'url', label: t('initiatives.feedback.builder.fieldTypes.url') },
            { value: 'select', label: t('initiatives.feedback.builder.fieldTypes.select') },
        ],
        [t],
    );

    const getRoleLabel = (role?: InitiativeFeedbackFieldRole) => {
        switch (role) {
            case 'title':
                return t('initiatives.feedback.builder.roles.title');
            case 'description':
                return t('initiatives.feedback.builder.roles.description');
            case 'customerName':
                return t('initiatives.feedback.builder.roles.customerName');
            case 'customerEmail':
                return t('initiatives.feedback.builder.roles.customerEmail');
            case 'company':
                return t('initiatives.feedback.builder.roles.company');
            case 'sourceUrl':
                return t('initiatives.feedback.builder.roles.sourceUrl');
            default:
                return t('initiatives.feedback.builder.roles.general');
        }
    };

    if (!isOpen || !initiative || !tenantId) return null;

    const updateField = (fieldId: string, updater: (field: InitiativeFeedbackField) => InitiativeFeedbackField) => {
        setDraft((current) => ({
            ...current,
            fields: current.fields.map((field) => (field.id === fieldId ? updater(field) : field)),
        }));
    };

    const moveField = (fieldId: string, direction: -1 | 1) => {
        setDraft((current) => {
            const index = current.fields.findIndex((field) => field.id === fieldId);
            const nextIndex = index + direction;
            if (index < 0 || nextIndex < 0 || nextIndex >= current.fields.length) return current;
            const nextFields = [...current.fields];
            const [entry] = nextFields.splice(index, 1);
            nextFields.splice(nextIndex, 0, entry);
            return { ...current, fields: nextFields };
        });
    };

    const handleAddField = () => {
        const nextField = createCustomInitiativeFeedbackField();
        setDraft((current) => ({ ...current, fields: [...current.fields, nextField] }));
        setSelectedFieldId(nextField.id);
    };

    const handleRemoveField = (fieldId: string) => {
        setDraft((current) => ({ ...current, fields: current.fields.filter((field) => field.id !== fieldId) }));
    };

    const handleCopy = async (value: string, field: string) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(field);
        } catch (copyError) {
            console.error('Failed to copy feedback value', copyError);
        }
    };

    const handleSave = async (regenerateToken = false) => {
        setSaving(true);
        setError(null);

        try {
            const result = await saveInitiativeFeedbackConfig({
                tenantId,
                projectId,
                initiativeId: initiative.id,
                enabled: draft.enabled,
                title: draft.title,
                description: draft.description,
                submitLabel: draft.submitLabel,
                successMessage: draft.successMessage,
                allowAttachments: draft.allowAttachments,
                maxAttachments: draft.maxAttachments,
                fields: draft.fields,
                regenerateToken,
            });

            onSaved(result.feedbackForm);
        } catch (saveError) {
            console.error('Failed to save initiative feedback config', saveError);
            setError(t('initiatives.feedback.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="modal-overlay modal-overlay--open task-modal center-aligned initiative-modal" onClick={onClose}>
            <div className="modal-content initiative-modal__content initiative-feedback-modal" onClick={(event) => event.stopPropagation()}>
                <form
                    className="initiative-feedback-builder"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void handleSave(false);
                    }}
                >
                    <div className="initiative-feedback-builder__main">
                        <div className="initiative-feedback-builder__editor">
                            <div className="initiative-feedback-builder__header">
                                <div>
                                    <div className="initiative-settings__eyebrow">{t('initiatives.feedback.title')}</div>
                                    <h2>{t('initiatives.feedback.builder.title')}</h2>
                                    <p>{t('initiatives.feedback.builder.subtitle')}</p>
                                </div>
                                <div className="initiative-feedback-builder__header-actions">
                                    <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={saving}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button variant="primary" size="sm" type="submit" isLoading={saving}>
                                        {t('common.saveChanges')}
                                    </Button>
                                </div>
                            </div>

                            <div className="initiative-feedback-builder__panel">
                                <div className="initiative-feedback-builder__panel-header">
                                    <div>
                                        <h3>{t('initiatives.feedback.builder.formPanel')}</h3>
                                        <p>{t('initiatives.feedback.builder.formPanelDescription')}</p>
                                    </div>
                                </div>

                                <div className="initiative-feedback-builder__form-grid">
                                    <div className="task-field initiative-feedback-builder__field initiative-feedback-builder__field--full">
                                        <label className="section-label">{t('initiatives.feedback.fields.title')}</label>
                                        <TextInput
                                            value={draft.title}
                                            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                                            placeholder={t('initiatives.feedback.fields.titlePlaceholder')}
                                            className="task-create__title-input"
                                        />
                                    </div>
                                    <div className="task-field initiative-feedback-builder__field initiative-feedback-builder__field--full">
                                        <label className="section-label">{t('initiatives.feedback.fields.description')}</label>
                                        <TextArea
                                            value={draft.description}
                                            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                                            placeholder={t('initiatives.feedback.fields.descriptionPlaceholder')}
                                            rows={4}
                                            className="task-create__description-input"
                                        />
                                    </div>
                                    <div className="initiative-feedback-builder__toggle-grid initiative-feedback-builder__field initiative-feedback-builder__field--full">
                                        <div className="initiative-feedback-builder__toggle-card">
                                            <Checkbox
                                                checked={draft.enabled}
                                                onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
                                                label={t('initiatives.feedback.fields.enabled')}
                                            />
                                        </div>
                                        <div className="initiative-feedback-builder__toggle-card">
                                            <Checkbox
                                                checked={draft.allowAttachments}
                                                onChange={(event) => setDraft((current) => ({ ...current, allowAttachments: event.target.checked }))}
                                                label={t('initiatives.feedback.fields.allowAttachments')}
                                            />
                                        </div>
                                        <div className="task-field initiative-feedback-builder__count-field">
                                            <label className="section-label">{t('initiatives.feedback.fields.maxAttachments')}</label>
                                            <TextInput
                                                type="number"
                                                min={1}
                                                max={4}
                                                disabled={!draft.allowAttachments}
                                                value={String(draft.maxAttachments)}
                                                onChange={(event) => setDraft((current) => ({
                                                    ...current,
                                                    maxAttachments: Math.min(4, Math.max(1, Number(event.target.value) || 1)),
                                                }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="task-field initiative-feedback-builder__field">
                                        <label className="section-label">{t('initiatives.feedback.fields.submitLabel')}</label>
                                        <TextInput
                                            value={draft.submitLabel}
                                            onChange={(event) => setDraft((current) => ({ ...current, submitLabel: event.target.value }))}
                                            placeholder={t('initiatives.feedback.fields.submitLabelPlaceholder')}
                                        />
                                    </div>
                                    <div className="task-field initiative-feedback-builder__field">
                                        <label className="section-label">{t('initiatives.feedback.fields.successMessage')}</label>
                                        <TextInput
                                            value={draft.successMessage}
                                            onChange={(event) => setDraft((current) => ({ ...current, successMessage: event.target.value }))}
                                            placeholder={t('initiatives.feedback.fields.successMessagePlaceholder')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="initiative-feedback-builder__panel">
                                <div className="initiative-feedback-builder__panel-header initiative-feedback-builder__panel-header--split">
                                    <div>
                                        <h3>{t('initiatives.feedback.builder.fieldsPanel')}</h3>
                                        <p>{t('initiatives.feedback.builder.fieldsPanelDescription')}</p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        type="button"
                                        icon={<span className="material-symbols-outlined">add</span>}
                                        onClick={handleAddField}
                                    >
                                        {t('initiatives.feedback.builder.addField')}
                                    </Button>
                                </div>

                                <div className="initiative-feedback-builder__workspace">
                                    <div className="initiative-feedback-builder__field-list">
                                        {draft.fields.map((field, index) => (
                                            <button
                                                key={field.id}
                                                type="button"
                                                className={`initiative-feedback-builder__field-card ${selectedFieldId === field.id ? 'is-active' : ''}`}
                                                onClick={() => setSelectedFieldId(field.id)}
                                            >
                                                <div className="initiative-feedback-builder__field-card-head">
                                                    <span className="initiative-feedback-builder__field-index">{index + 1}</span>
                                                    <div className="initiative-feedback-builder__field-badges">
                                                        <span className="initiative-feedback-builder__badge">
                                                            <span className="material-symbols-outlined">{getFeedbackFieldTypeIcon(field.type)}</span>
                                                            {fieldTypeOptions.find((option) => option.value === field.type)?.label || field.type}
                                                        </span>
                                                        <span className="initiative-feedback-builder__badge initiative-feedback-builder__badge--muted">
                                                            <span className="material-symbols-outlined">{getFeedbackFieldRoleIcon(field.role)}</span>
                                                            {getRoleLabel(field.role)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <strong>{field.label}</strong>
                                                <p>{field.placeholder || t('initiatives.feedback.builder.noPlaceholder')}</p>
                                                <div className="initiative-feedback-builder__field-meta">
                                                    {field.required && <span>{t('initiatives.feedback.builder.required')}</span>}
                                                    {field.enabled === false && <span>{t('initiatives.feedback.builder.hidden')}</span>}
                                                    {field.width === 'full' && <span>{t('initiatives.feedback.builder.widthFull')}</span>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="initiative-feedback-builder__field-editor">
                                        {selectedField ? (
                                            <>
                                                <div className="initiative-feedback-builder__field-editor-head">
                                                    <div>
                                                        <h4>{t('initiatives.feedback.builder.fieldSettings')}</h4>
                                                        <p>{t('initiatives.feedback.builder.fieldSettingsDescription')}</p>
                                                    </div>
                                                    <div className="initiative-feedback-builder__field-editor-actions">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            type="button"
                                                            onClick={() => moveField(selectedField.id, -1)}
                                                            disabled={draft.fields[0]?.id === selectedField.id}
                                                            aria-label={t('initiatives.feedback.builder.moveUp')}
                                                            icon={<span className="material-symbols-outlined">arrow_upward</span>}
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            type="button"
                                                            onClick={() => moveField(selectedField.id, 1)}
                                                            disabled={draft.fields[draft.fields.length - 1]?.id === selectedField.id}
                                                            aria-label={t('initiatives.feedback.builder.moveDown')}
                                                            icon={<span className="material-symbols-outlined">arrow_downward</span>}
                                                        />
                                                        {!selectedField.isDefault && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                type="button"
                                                                onClick={() => handleRemoveField(selectedField.id)}
                                                                aria-label={t('initiatives.feedback.builder.removeField')}
                                                                icon={<span className="material-symbols-outlined">delete</span>}
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="initiative-feedback-builder__field-form">
                                                    <div className="task-field initiative-feedback-builder__field initiative-feedback-builder__field--full">
                                                        <label className="section-label">{t('initiatives.feedback.builder.fieldLabel')}</label>
                                                        <TextInput
                                                            value={selectedField.label}
                                                            onChange={(event) => updateField(selectedField.id, (field) => ({ ...field, label: event.target.value }))}
                                                        />
                                                    </div>

                                                    <div className="task-field initiative-feedback-builder__field">
                                                        <label className="section-label">{t('initiatives.feedback.builder.fieldType')}</label>
                                                        <Select
                                                            value={selectedField.type}
                                                            onChange={(value) => updateField(selectedField.id, (field) => ({
                                                                ...field,
                                                                type: String(value) as InitiativeFeedbackFieldType,
                                                                width: String(value) === 'longText' ? 'full' : field.width,
                                                                options: String(value) === 'select'
                                                                    ? (field.options?.length ? field.options : [
                                                                        { id: `${field.id}-option-1`, label: 'Bug', value: 'Bug' },
                                                                        { id: `${field.id}-option-2`, label: 'Improvement', value: 'Improvement' },
                                                                    ])
                                                                    : [],
                                                            }))}
                                                            options={fieldTypeOptions}
                                                            disabled={selectedField.isDefault === true}
                                                        />
                                                    </div>

                                                    <div className="task-field initiative-feedback-builder__field">
                                                        <label className="section-label">{t('initiatives.feedback.builder.mapping')}</label>
                                                        <div className="initiative-feedback-builder__mapping-pill">
                                                            <span className="material-symbols-outlined">{getFeedbackFieldRoleIcon(selectedField.role)}</span>
                                                            {getRoleLabel(selectedField.role)}
                                                        </div>
                                                    </div>

                                                    <div className="task-field initiative-feedback-builder__field initiative-feedback-builder__field--full">
                                                        <label className="section-label">{t('initiatives.feedback.builder.placeholder')}</label>
                                                        <TextInput
                                                            value={selectedField.placeholder || ''}
                                                            onChange={(event) => updateField(selectedField.id, (field) => ({ ...field, placeholder: event.target.value }))}
                                                        />
                                                    </div>

                                                    <div className="task-field initiative-feedback-builder__field initiative-feedback-builder__field--full">
                                                        <label className="section-label">{t('initiatives.feedback.builder.helpText')}</label>
                                                        <TextArea
                                                            value={selectedField.helpText || ''}
                                                            onChange={(event) => updateField(selectedField.id, (field) => ({ ...field, helpText: event.target.value }))}
                                                            rows={3}
                                                        />
                                                    </div>

                                                    {feedbackFieldNeedsOptions(selectedField.type) && (
                                                        <div className="task-field initiative-feedback-builder__field initiative-feedback-builder__field--full">
                                                            <label className="section-label">{t('initiatives.feedback.builder.options')}</label>
                                                            <TextArea
                                                                value={(selectedField.options || []).map((option) => option.label).join('\n')}
                                                                onChange={(event) => updateField(selectedField.id, (field) => ({
                                                                    ...field,
                                                                    options: event.target.value
                                                                        .split('\n')
                                                                        .map((entry) => entry.trim())
                                                                        .filter(Boolean)
                                                                        .map((label, index) => ({
                                                                            id: `${field.id}-option-${index + 1}`,
                                                                            label,
                                                                            value: label,
                                                                        })),
                                                                }))}
                                                                rows={4}
                                                                placeholder={t('initiatives.feedback.builder.optionsPlaceholder')}
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="initiative-feedback-builder__field-toggles initiative-feedback-builder__field initiative-feedback-builder__field--full">
                                                        <div className="initiative-feedback-builder__toggle-card">
                                                            <Checkbox
                                                                checked={selectedField.required === true}
                                                                onChange={(event) => updateField(selectedField.id, (field) => ({ ...field, required: event.target.checked }))}
                                                                label={t('initiatives.feedback.builder.required')}
                                                            />
                                                        </div>
                                                        <div className="initiative-feedback-builder__toggle-card">
                                                            <Checkbox
                                                                checked={selectedField.enabled !== false}
                                                                onChange={(event) => updateField(selectedField.id, (field) => ({ ...field, enabled: event.target.checked }))}
                                                                label={t('initiatives.feedback.builder.visibleOnForm')}
                                                            />
                                                        </div>
                                                        <div className="initiative-feedback-builder__toggle-card">
                                                            <Checkbox
                                                                checked={selectedField.width === 'full'}
                                                                onChange={(event) => updateField(selectedField.id, (field) => ({ ...field, width: event.target.checked ? 'full' : 'half' }))}
                                                                label={t('initiatives.feedback.builder.widthFull')}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="initiative-feedback-builder__empty-editor">
                                                <span className="material-symbols-outlined">view_carousel</span>
                                                <p>{t('initiatives.feedback.builder.selectField')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {initiative.feedbackForm?.token && (
                                <div className="initiative-feedback-builder__panel">
                                    <div className="initiative-feedback-builder__panel-header initiative-feedback-builder__panel-header--split">
                                        <div>
                                            <h3>{t('initiatives.feedback.builder.accessPanel')}</h3>
                                            <p>{t('initiatives.feedback.builder.accessPanelDescription')}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            type="button"
                                            disabled={saving || !draft.enabled}
                                            onClick={() => void handleSave(true)}
                                        >
                                            {t('initiatives.feedback.actions.regenerate')}
                                        </Button>
                                    </div>
                                    <div className="initiative-feedback-builder__access-list">
                                        <div className="initiative-feedback-builder__access-row">
                                            <div>
                                                <span className="section-label">{t('initiatives.feedback.hostedLabel')}</span>
                                                <code>{hostedUrl}</code>
                                            </div>
                                            <Button variant="ghost" size="sm" type="button" onClick={() => void handleCopy(hostedUrl, 'hosted')}>
                                                {copiedField === 'hosted' ? t('common.copied') : t('common.copy')}
                                            </Button>
                                        </div>
                                        <div className="initiative-feedback-builder__access-row">
                                            <div>
                                                <span className="section-label">{t('initiatives.feedback.endpointLabel')}</span>
                                                <code>{submitEndpoint}</code>
                                            </div>
                                            <Button variant="ghost" size="sm" type="button" onClick={() => void handleCopy(submitEndpoint, 'endpoint')}>
                                                {copiedField === 'endpoint' ? t('common.copied') : t('common.copy')}
                                            </Button>
                                        </div>
                                        <div className="initiative-feedback-builder__access-row">
                                            <div>
                                                <span className="section-label">{t('initiatives.feedback.tokenLabel')}</span>
                                                <code>{initiative.feedbackForm.token}</code>
                                            </div>
                                            <Button variant="ghost" size="sm" type="button" onClick={() => void handleCopy(initiative.feedbackForm?.token || '', 'token')}>
                                                {copiedField === 'token' ? t('common.copied') : t('common.copy')}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && <div className="task-create-form__error">{error}</div>}
                        </div>

                        <div className="initiative-feedback-builder__preview">
                            <div className="initiative-feedback-builder__preview-header">
                                <div>
                                    <div className="initiative-settings__eyebrow">{t('initiatives.feedback.builder.previewEyebrow')}</div>
                                    <h3>{t('initiatives.feedback.builder.previewTitle')}</h3>
                                    <p>{t('initiatives.feedback.builder.previewDescription')}</p>
                                </div>
                            </div>

                            <div className="public-initiative-feedback__shell initiative-feedback-builder__preview-shell">
                                <div className="public-initiative-feedback__header">
                                    <span className="public-initiative-feedback__eyebrow">{initiative.title}</span>
                                    <h1>{draft.title || t('initiatives.feedback.fields.titlePlaceholder')}</h1>
                                    <p>{draft.description || t('initiatives.feedback.public.descriptionFallback').replace('{initiative}', initiative.title)}</p>
                                </div>

                                <div className="public-initiative-feedback__form">
                                    <div className="public-initiative-feedback__grid">
                                        {enabledFields.map((field) => (
                                            <div
                                                key={field.id}
                                                className={`public-initiative-feedback__field ${field.width === 'full' ? 'public-initiative-feedback__field--full' : ''}`}
                                            >
                                                <label className="public-initiative-feedback__field-label">
                                                    {field.label}
                                                    {field.required && <span>*</span>}
                                                </label>
                                                {field.type === 'longText' ? (
                                                    <TextArea
                                                        value={sampleValueForField(field)}
                                                        onChange={() => undefined}
                                                        rows={5}
                                                        className="public-initiative-feedback__preview-input"
                                                    />
                                                ) : (
                                                    <TextInput
                                                        value={sampleValueForField(field)}
                                                        onChange={() => undefined}
                                                        type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                                                        className="public-initiative-feedback__preview-input"
                                                    />
                                                )}
                                                {field.helpText && (
                                                    <p className="public-initiative-feedback__field-help">{field.helpText}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {draft.allowAttachments && (
                                        <div className="public-initiative-feedback__attachments">
                                            <label className="public-initiative-feedback__attachments-label">
                                                {t('initiatives.feedback.public.fields.attachments')}
                                            </label>
                                            <div className="initiative-feedback-builder__attachment-dropzone">
                                                <span className="material-symbols-outlined">image</span>
                                                <div>
                                                    <strong>{t('initiatives.feedback.builder.previewAttachmentTitle')}</strong>
                                                    <p>{t('initiatives.feedback.public.attachmentsHint').replace('{count}', String(draft.maxAttachments))}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="public-initiative-feedback__footer">
                                        <span className="public-initiative-feedback__footer-note">
                                            {draft.allowAttachments
                                                ? t('initiatives.feedback.public.attachmentsHint').replace('{count}', String(draft.maxAttachments))
                                                : t('initiatives.feedback.public.noAttachments')}
                                        </span>
                                        <Button variant="primary" type="button">
                                            {draft.submitLabel || t('initiatives.feedback.fields.submitLabelPlaceholder')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
};
