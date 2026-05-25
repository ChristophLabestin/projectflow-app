import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
    Initiative,
    InitiativeFeedbackField,
    InitiativeFeedbackFieldRole,
    InitiativeFeedbackFieldType,
    InitiativeFeedbackFormSettings,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { saveInitiativeFeedbackConfig } from '../services/initiativeFeedbackService';
import {
    createCustomInitiativeFeedbackField,
    ensureInitiativeFeedbackFields,
    feedbackFieldNeedsOptions,
    getFeedbackFieldRoleIcon,
    getFeedbackFieldTypeIcon,
    getInitiativeFeedbackBuilderIssues,
    prepareInitiativeFeedbackFieldsForSave,
    type InitiativeFeedbackBuilderIssue,
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

type BuilderStep = 'setup' | 'fields' | 'publish';

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

type Translate = (key: string) => string;

const localizeDefaultField = (field: InitiativeFeedbackField, t: Translate): InitiativeFeedbackField => {
    if (!field.isDefault) return field;

    switch (field.role) {
        case 'customerName':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.customerName'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.customerName'),
            };
        case 'customerEmail':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.customerEmail'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.customerEmail'),
            };
        case 'company':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.company'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.company'),
            };
        case 'sourceUrl':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.sourceUrl'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.sourceUrl'),
            };
        case 'title':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.title'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.title'),
            };
        case 'description':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.description'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.description'),
            };
        default:
            return field;
    }
};

const buildDraft = (initiative: Initiative | null, t: Translate): DraftState => {
    const hasStoredFields = Array.isArray(initiative?.feedbackForm?.fields) && initiative.feedbackForm.fields.length > 0;
    const fields = ensureInitiativeFeedbackFields(initiative?.feedbackForm?.fields).map((field) => ({
        ...field,
        options: Array.isArray(field.options) ? field.options : [],
    }));

    return {
        enabled: initiative?.feedbackForm?.enabled === true,
        title: initiative?.feedbackForm?.title || '',
        description: initiative?.feedbackForm?.description || '',
        submitLabel: initiative?.feedbackForm?.submitLabel || '',
        successMessage: initiative?.feedbackForm?.successMessage || '',
        allowAttachments: initiative?.feedbackForm?.allowAttachments !== false,
        maxAttachments: initiative?.feedbackForm?.maxAttachments || 3,
        fields: hasStoredFields ? fields : fields.map((field) => localizeDefaultField(field, t)),
    };
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
    const [draft, setDraft] = useState<DraftState>(() => buildDraft(initiative, t));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState<BuilderStep>('setup');

    useEffect(() => {
        if (!isOpen) return;
        const nextDraft = buildDraft(initiative, t);
        setDraft(nextDraft);
        setSaving(false);
        setError(null);
        setCopiedField(null);
        setSelectedFieldId(nextDraft.fields[0]?.id || null);
        setActiveStep('setup');
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

    const preparedFields = useMemo(
        () => prepareInitiativeFeedbackFieldsForSave(draft.fields),
        [draft.fields],
    );

    const enabledFields = useMemo(
        () => preparedFields.filter((field) => field.enabled !== false),
        [preparedFields],
    );

    const builderIssues = useMemo(
        () => getInitiativeFeedbackBuilderIssues(draft.fields),
        [draft.fields],
    );

    const blockingIssues = useMemo(
        () => builderIssues.filter((issue) => issue.severity === 'blocking'),
        [builderIssues],
    );

    const warningIssues = useMemo(
        () => builderIssues.filter((issue) => issue.severity === 'warning'),
        [builderIssues],
    );

    const fieldStats = useMemo(() => ({
        total: draft.fields.length,
        visible: enabledFields.length,
        required: enabledFields.filter((field) => field.required === true).length,
        custom: draft.fields.filter((field) => field.role === 'general' || field.isDefault === false).length,
    }), [draft.fields, enabledFields]);

    const selectedField = useMemo(
        () => draft.fields.find((field) => field.id === selectedFieldId) || null,
        [draft.fields, selectedFieldId],
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

    const stepOptions = useMemo<Array<{ id: BuilderStep; icon: string; label: string; description: string }>>(
        () => [
            {
                id: 'setup',
                icon: 'tune',
                label: t('initiatives.feedback.builder.steps.setup'),
                description: t('initiatives.feedback.builder.steps.setupDescription'),
            },
            {
                id: 'fields',
                icon: 'view_list',
                label: t('initiatives.feedback.builder.steps.fields'),
                description: t('initiatives.feedback.builder.steps.fieldsDescription'),
            },
            {
                id: 'publish',
                icon: 'share',
                label: t('initiatives.feedback.builder.steps.publish'),
                description: t('initiatives.feedback.builder.steps.publishDescription'),
            },
        ],
        [t],
    );

    if (!isOpen || !initiative || !tenantId) return null;

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

    const sampleValueForField = (field: InitiativeFeedbackField) => {
        if (field.type === 'select') {
            return field.options?.[0]?.value || '';
        }

        switch (field.role || 'general') {
            case 'title':
                return t('initiatives.feedback.builder.previewSamples.title');
            case 'description':
                return t('initiatives.feedback.builder.previewSamples.description');
            case 'customerName':
                return t('initiatives.feedback.builder.previewSamples.customerName');
            case 'customerEmail':
                return t('initiatives.feedback.builder.previewSamples.customerEmail');
            case 'company':
                return t('initiatives.feedback.builder.previewSamples.company');
            case 'sourceUrl':
                return t('initiatives.feedback.builder.previewSamples.sourceUrl');
            default:
                return t('initiatives.feedback.builder.previewSamples.general');
        }
    };

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
        const nextField = createCustomInitiativeFeedbackField({
            label: t('initiatives.feedback.builder.customFieldDefaultLabel'),
            placeholder: t('initiatives.feedback.builder.customFieldDefaultPlaceholder'),
        });
        setDraft((current) => ({ ...current, fields: [...current.fields, nextField] }));
        setSelectedFieldId(nextField.id);
        setActiveStep('fields');
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
        const fieldsForSave = prepareInitiativeFeedbackFieldsForSave(draft.fields);
        const nextIssues = getInitiativeFeedbackBuilderIssues(fieldsForSave);
        const firstBlockingIssue = nextIssues.find((issue) => issue.severity === 'blocking');

        if (firstBlockingIssue) {
            setError(t('initiatives.feedback.builder.fixBlockingIssues'));
            setActiveStep(firstBlockingIssue.fieldId ? 'fields' : 'setup');
            if (firstBlockingIssue.fieldId) {
                setSelectedFieldId(firstBlockingIssue.fieldId);
            }
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const result = await saveInitiativeFeedbackConfig({
                tenantId,
                projectId,
                initiativeId: initiative.id,
                enabled: draft.enabled,
                title: draft.title.trim(),
                description: draft.description.trim(),
                submitLabel: draft.submitLabel.trim(),
                successMessage: draft.successMessage.trim(),
                allowAttachments: draft.allowAttachments,
                maxAttachments: draft.maxAttachments,
                fields: fieldsForSave,
                regenerateToken,
            });

            onSaved(result.feedbackForm);
            setDraft((current) => ({
                ...current,
                fields: fieldsForSave,
            }));
        } catch (saveError) {
            console.error('Failed to save initiative feedback config', saveError);
            setError(t('initiatives.feedback.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    const getIssueMessage = (issue: InitiativeFeedbackBuilderIssue) => {
        const fieldLabel = issue.fieldLabel || t('initiatives.feedback.builder.unnamedField');

        switch (issue.code) {
            case 'noEnabledFields':
                return t('initiatives.feedback.builder.issues.noEnabledFields');
            case 'missingLabel':
                return t('initiatives.feedback.builder.issues.missingLabel').replace('{field}', fieldLabel);
            case 'selectNeedsOptions':
                return t('initiatives.feedback.builder.issues.selectNeedsOptions').replace('{field}', fieldLabel);
            case 'hiddenRequired':
                return t('initiatives.feedback.builder.issues.hiddenRequired').replace('{field}', fieldLabel);
            case 'missingTitleMapping':
                return t('initiatives.feedback.builder.issues.missingTitleMapping');
            case 'missingDescriptionMapping':
                return t('initiatives.feedback.builder.issues.missingDescriptionMapping');
            case 'duplicateLabel':
                return t('initiatives.feedback.builder.issues.duplicateLabel').replace('{field}', fieldLabel);
            default:
                return '';
        }
    };

    const renderIssueList = (issues: InitiativeFeedbackBuilderIssue[]) => (
        <div className="initiative-feedback-builder__issue-list">
            {issues.map((issue, index) => (
                <div
                    key={`${issue.code}-${issue.fieldId || index}`}
                    className={`initiative-feedback-builder__issue-row initiative-feedback-builder__issue-row--${issue.severity}`}
                >
                    <span className="material-symbols-outlined">
                        {issue.severity === 'blocking' ? 'error' : 'info'}
                    </span>
                    <p>{getIssueMessage(issue)}</p>
                    {issue.fieldId && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedFieldId(issue.fieldId || null);
                                setActiveStep('fields');
                            }}
                        >
                            {t('initiatives.feedback.builder.reviewIssue')}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );

    const renderSetupStep = () => (
        <div className="initiative-feedback-builder__panel initiative-feedback-builder__panel--open">
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
    );

    const renderFieldCard = (field: InitiativeFeedbackField, index: number) => {
        const issuesForField = builderIssues.filter((issue) => issue.fieldId === field.id);
        const hasBlockingIssue = issuesForField.some((issue) => issue.severity === 'blocking');
        const typeLabel = fieldTypeOptions.find((option) => option.value === field.type)?.label || field.type;
        const isActive = selectedFieldId === field.id;

        return (
            <div
                key={field.id}
                className={[
                    'initiative-feedback-builder__field-row',
                    isActive ? 'is-active' : '',
                    hasBlockingIssue ? 'has-blocking-issue' : '',
                    field.enabled === false ? 'is-hidden' : '',
                ].filter(Boolean).join(' ')}
            >
                <button
                    type="button"
                    className="initiative-feedback-builder__field-row-main"
                    onClick={() => setSelectedFieldId(field.id)}
                >
                    <span className="initiative-feedback-builder__field-index">{index + 1}</span>
                    <span className="initiative-feedback-builder__field-icon material-symbols-outlined">
                        {getFeedbackFieldTypeIcon(field.type)}
                    </span>
                    <span className="initiative-feedback-builder__field-row-copy">
                        <strong>{field.label || t('initiatives.feedback.builder.unnamedField')}</strong>
                        <span>{typeLabel} · {getRoleLabel(field.role)}</span>
                    </span>
                    <span className="initiative-feedback-builder__field-row-meta">
                        {field.required && <span>{t('initiatives.feedback.builder.required')}</span>}
                        {field.enabled === false && <span>{t('initiatives.feedback.builder.hidden')}</span>}
                        {issuesForField.length > 0 && (
                            <span className={hasBlockingIssue ? 'is-blocking' : ''}>
                                {hasBlockingIssue
                                    ? t('initiatives.feedback.builder.needsFix')
                                    : t('initiatives.feedback.builder.warning')}
                            </span>
                        )}
                    </span>
                </button>
                <div className="initiative-feedback-builder__field-row-actions">
                    <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => moveField(field.id, -1)}
                        disabled={index === 0}
                        aria-label={t('initiatives.feedback.builder.moveUp')}
                        icon={<span className="material-symbols-outlined">arrow_upward</span>}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => moveField(field.id, 1)}
                        disabled={index === draft.fields.length - 1}
                        aria-label={t('initiatives.feedback.builder.moveDown')}
                        icon={<span className="material-symbols-outlined">arrow_downward</span>}
                    />
                </div>
            </div>
        );
    };

    const renderFieldsStep = () => (
        <div className="initiative-feedback-builder__panel initiative-feedback-builder__panel--open">
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

            {builderIssues.length > 0 ? renderIssueList(builderIssues) : (
                <div className="initiative-feedback-builder__ready-row">
                    <span className="material-symbols-outlined">task_alt</span>
                    <p>{t('initiatives.feedback.builder.healthReady')}</p>
                </div>
            )}

            <div className="initiative-feedback-builder__workspace">
                <div className="initiative-feedback-builder__field-list" aria-label={t('initiatives.feedback.builder.fieldListLabel')}>
                    {draft.fields.map(renderFieldCard)}
                </div>

                <div className="initiative-feedback-builder__field-editor">
                    {selectedField ? (
                        <>
                            <div className="initiative-feedback-builder__field-editor-head">
                                <div>
                                    <h4>{t('initiatives.feedback.builder.fieldSettings')}</h4>
                                    <p>{getRoleLabel(selectedField.role)} · {selectedField.enabled === false ? t('initiatives.feedback.builder.hidden') : t('initiatives.feedback.builder.visibleOnForm')}</p>
                                </div>
                                <div className="initiative-feedback-builder__field-editor-actions">
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
                                                    {
                                                        id: `${field.id}-option-1`,
                                                        label: t('initiatives.feedback.builder.defaultOptions.bug'),
                                                        value: t('initiatives.feedback.builder.defaultOptions.bug'),
                                                    },
                                                    {
                                                        id: `${field.id}-option-2`,
                                                        label: t('initiatives.feedback.builder.defaultOptions.improvement'),
                                                        value: t('initiatives.feedback.builder.defaultOptions.improvement'),
                                                    },
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
                                        <span>{getRoleLabel(selectedField.role)}</span>
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
                                                    .slice(0, 8)
                                                    .map((label, optionIndex) => ({
                                                        id: `${field.id}-option-${optionIndex + 1}`,
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
    );

    const renderAccessRow = (label: string, value: string, copyKey: string) => (
        <div className="initiative-feedback-builder__access-row">
            <div>
                <span className="section-label">{label}</span>
                <code>{value}</code>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={() => void handleCopy(value, copyKey)}>
                {copiedField === copyKey ? t('common.copied') : t('common.copy')}
            </Button>
        </div>
    );

    const renderPublishStep = () => (
        <div className="initiative-feedback-builder__panel initiative-feedback-builder__panel--open">
            <div className="initiative-feedback-builder__panel-header initiative-feedback-builder__panel-header--split">
                <div>
                    <h3>{t('initiatives.feedback.builder.accessPanel')}</h3>
                    <p>{t('initiatives.feedback.builder.accessPanelDescription')}</p>
                </div>
                {initiative.feedbackForm?.token && (
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        disabled={saving || !draft.enabled}
                        onClick={() => void handleSave(true)}
                    >
                        {t('initiatives.feedback.actions.regenerate')}
                    </Button>
                )}
            </div>

            <div className="initiative-feedback-builder__publish-grid">
                <div className="initiative-feedback-builder__publish-status">
                    <span className="material-symbols-outlined">{draft.enabled ? 'public' : 'lock'}</span>
                    <div>
                        <strong>
                            {draft.enabled
                                ? t('initiatives.feedback.builder.publishEnabled')
                                : t('initiatives.feedback.builder.publishDisabled')}
                        </strong>
                        <p>
                            {blockingIssues.length > 0
                                ? t('initiatives.feedback.builder.publishNeedsFixes')
                                : t('initiatives.feedback.builder.publishReady')}
                        </p>
                    </div>
                </div>

                <div className="initiative-feedback-builder__summary-grid">
                    <div>
                        <strong>{fieldStats.visible}</strong>
                        <span>{t('initiatives.feedback.builder.stats.visible')}</span>
                    </div>
                    <div>
                        <strong>{fieldStats.required}</strong>
                        <span>{t('initiatives.feedback.builder.stats.required')}</span>
                    </div>
                    <div>
                        <strong>{draft.allowAttachments ? draft.maxAttachments : 0}</strong>
                        <span>{t('initiatives.feedback.builder.stats.attachments')}</span>
                    </div>
                </div>
            </div>

            {blockingIssues.length > 0 && renderIssueList(blockingIssues)}

            {initiative.feedbackForm?.token ? (
                <div className="initiative-feedback-builder__access-list">
                    {renderAccessRow(t('initiatives.feedback.hostedLabel'), hostedUrl, 'hosted')}
                    {renderAccessRow(t('initiatives.feedback.endpointLabel'), submitEndpoint, 'endpoint')}
                    {renderAccessRow(t('initiatives.feedback.tokenLabel'), initiative.feedbackForm.token, 'token')}
                </div>
            ) : (
                <div className="initiative-feedback-builder__empty-link-state">
                    <span className="material-symbols-outlined">link</span>
                    <div>
                        <strong>{t('initiatives.feedback.builder.noLinkTitle')}</strong>
                        <p>{t('initiatives.feedback.builder.noLinkDescription')}</p>
                    </div>
                </div>
            )}
        </div>
    );

    const renderActiveStep = () => {
        if (activeStep === 'fields') return renderFieldsStep();
        if (activeStep === 'publish') return renderPublishStep();
        return renderSetupStep();
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
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        type="submit"
                                        isLoading={saving}
                                        disabled={blockingIssues.length > 0}
                                    >
                                        {t('common.saveChanges')}
                                    </Button>
                                </div>
                            </div>

                            <div className="initiative-feedback-builder__status-strip">
                                <span className={`initiative-feedback-builder__status-dot ${blockingIssues.length > 0 ? 'is-blocked' : warningIssues.length > 0 ? 'has-warnings' : 'is-ready'}`} />
                                <strong>
                                    {blockingIssues.length > 0
                                        ? t('initiatives.feedback.builder.statusNeedsFixes')
                                        : warningIssues.length > 0
                                            ? t('initiatives.feedback.builder.statusWarnings')
                                            : t('initiatives.feedback.builder.statusReady')}
                                </strong>
                                <span>
                                    {t('initiatives.feedback.builder.statusSummary')
                                        .replace('{visible}', String(fieldStats.visible))
                                        .replace('{total}', String(fieldStats.total))}
                                </span>
                            </div>

                            <div className="initiative-feedback-builder__stepper" role="tablist" aria-label={t('initiatives.feedback.builder.stepperLabel')}>
                                {stepOptions.map((step) => (
                                    <button
                                        key={step.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeStep === step.id}
                                        className={`initiative-feedback-builder__step ${activeStep === step.id ? 'is-active' : ''}`}
                                        onClick={() => setActiveStep(step.id)}
                                    >
                                        <span className="material-symbols-outlined">{step.icon}</span>
                                        <span>
                                            <strong>{step.label}</strong>
                                            <small>{step.description}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {renderActiveStep()}

                            {error && <div className="task-create-form__error">{error}</div>}
                        </div>

                        <aside className="initiative-feedback-builder__preview">
                            <div className="initiative-feedback-builder__preview-header">
                                <div>
                                    <div className="initiative-settings__eyebrow">{t('initiatives.feedback.builder.previewEyebrow')}</div>
                                    <h3>{t('initiatives.feedback.builder.previewTitle')}</h3>
                                    <p>{t('initiatives.feedback.builder.previewDescription')}</p>
                                </div>
                            </div>

                            <div className="initiative-feedback-builder__preview-summary">
                                <div>
                                    <strong>{fieldStats.visible}</strong>
                                    <span>{t('initiatives.feedback.builder.stats.visible')}</span>
                                </div>
                                <div>
                                    <strong>{fieldStats.custom}</strong>
                                    <span>{t('initiatives.feedback.builder.stats.custom')}</span>
                                </div>
                                <div>
                                    <strong>{blockingIssues.length}</strong>
                                    <span>{t('initiatives.feedback.builder.stats.issues')}</span>
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
                                                    {field.label || t('initiatives.feedback.builder.unnamedField')}
                                                    {field.required && <span>*</span>}
                                                </label>
                                                {field.type === 'longText' ? (
                                                    <TextArea
                                                        value={sampleValueForField(field)}
                                                        onChange={() => undefined}
                                                        rows={5}
                                                        readOnly
                                                        className="public-initiative-feedback__preview-input"
                                                    />
                                                ) : feedbackFieldNeedsOptions(field.type) ? (
                                                    <select
                                                        className="public-initiative-feedback__native-select"
                                                        value={sampleValueForField(field)}
                                                        onChange={() => undefined}
                                                        disabled
                                                    >
                                                        <option value="">
                                                            {field.placeholder || t('initiatives.feedback.builder.previewSamples.selectPlaceholder')}
                                                        </option>
                                                        {(field.options || []).map((option) => (
                                                            <option key={option.id} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <TextInput
                                                        value={sampleValueForField(field)}
                                                        onChange={() => undefined}
                                                        type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                                                        readOnly
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
                        </aside>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
};
