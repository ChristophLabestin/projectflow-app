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
    MAX_INITIATIVE_FEEDBACK_FIELDS,
    createCustomInitiativeFeedbackField,
    ensureInitiativeFeedbackFields,
    feedbackFieldNeedsOptions,
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

type BuilderView = 'questions' | 'share';
type FieldTemplateId = InitiativeFeedbackFieldType;

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

const getTemplateLabelKey = (templateId: FieldTemplateId) => `initiatives.feedback.builder.templates.${templateId}`;
const getTemplateFieldLabelKey = (templateId: FieldTemplateId) => `initiatives.feedback.builder.templateLabels.${templateId}`;
const getTemplatePlaceholderKey = (templateId: FieldTemplateId) => `initiatives.feedback.builder.templatePlaceholders.${templateId}`;

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
    const [activeView, setActiveView] = useState<BuilderView>('questions');
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const nextDraft = buildDraft(initiative, t);
        setDraft(nextDraft);
        setSaving(false);
        setError(null);
        setCopiedField(null);
        setSelectedFieldId(null);
        setActiveView('questions');
        setShowPreview(false);
    }, [initiative, isOpen, t]);

    useEffect(() => {
        if (!copiedField) return;
        const timer = window.setTimeout(() => setCopiedField(null), 1800);
        return () => window.clearTimeout(timer);
    }, [copiedField]);

    useEffect(() => {
        if (selectedFieldId && !draft.fields.some((field) => field.id === selectedFieldId)) {
            setSelectedFieldId(null);
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
    }), [draft.fields.length, enabledFields.length]);

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

    const fieldRoleOptions = useMemo<SelectOption[]>(
        () => [
            { value: 'general', label: t('initiatives.feedback.builder.roles.general') },
            { value: 'title', label: t('initiatives.feedback.builder.roles.title') },
            { value: 'description', label: t('initiatives.feedback.builder.roles.description') },
            { value: 'customerName', label: t('initiatives.feedback.builder.roles.customerName') },
            { value: 'customerEmail', label: t('initiatives.feedback.builder.roles.customerEmail') },
            { value: 'company', label: t('initiatives.feedback.builder.roles.company') },
            { value: 'sourceUrl', label: t('initiatives.feedback.builder.roles.sourceUrl') },
        ],
        [t],
    );

    const templateOptions = useMemo<FieldTemplateId[]>(
        () => ['shortText', 'longText', 'email', 'url', 'select'],
        [],
    );

    const addQuestionOptions = useMemo<SelectOption[]>(
        () => templateOptions.map((templateId) => ({
            value: templateId,
            label: t(getTemplateLabelKey(templateId)),
        })),
        [templateOptions, t],
    );

    if (!isOpen || !initiative || !tenantId) return null;

    const defaultOptionsForField = (fieldId: string) => [
        {
            id: `${fieldId}-option-1`,
            label: t('initiatives.feedback.builder.defaultOptions.bug'),
            value: t('initiatives.feedback.builder.defaultOptions.bug'),
        },
        {
            id: `${fieldId}-option-2`,
            label: t('initiatives.feedback.builder.defaultOptions.improvement'),
            value: t('initiatives.feedback.builder.defaultOptions.improvement'),
        },
    ];

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

    const getFieldTypeLabel = (type: InitiativeFeedbackFieldType) => (
        fieldTypeOptions.find((option) => option.value === type)?.label || type
    );

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

    const buildTemplateField = (templateId: FieldTemplateId) => {
        const field = createCustomInitiativeFeedbackField({
            label: t(getTemplateFieldLabelKey(templateId)),
            placeholder: t(getTemplatePlaceholderKey(templateId)),
        });

        return {
            ...field,
            type: templateId,
            width: templateId === 'longText' ? 'full' : 'half',
            options: templateId === 'select' ? defaultOptionsForField(field.id) : [],
        };
    };

    const handleAddField = (templateId: FieldTemplateId = 'shortText') => {
        const nextField = buildTemplateField(templateId);
        setDraft((current) => {
            if (current.fields.length >= MAX_INITIATIVE_FEEDBACK_FIELDS) return current;
            return { ...current, fields: [...current.fields, nextField] };
        });
        setSelectedFieldId(nextField.id);
        setActiveView('questions');
    };

    const handleRemoveField = (fieldId: string) => {
        setDraft((current) => ({ ...current, fields: current.fields.filter((field) => field.id !== fieldId) }));
    };

    const handleTypeChange = (fieldId: string, value: string | number) => {
        const nextType = String(value) as InitiativeFeedbackFieldType;
        updateField(fieldId, (field) => ({
            ...field,
            type: nextType,
            width: nextType === 'longText' ? 'full' : field.width,
            options: nextType === 'select'
                ? (field.options?.length ? field.options : defaultOptionsForField(field.id))
                : [],
        }));
    };

    const handleRoleChange = (fieldId: string, value: string | number) => {
        const nextRole = String(value) as InitiativeFeedbackFieldRole;
        updateField(fieldId, (field) => ({
            ...field,
            role: nextRole,
            isDefault: nextRole === 'general' ? false : field.isDefault,
        }));
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
            setActiveView('questions');
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
            case 'duplicateRoleMapping':
                return t('initiatives.feedback.builder.issues.duplicateRoleMapping')
                    .replace('{role}', getRoleLabel(fieldLabel as InitiativeFeedbackFieldRole));
            default:
                return '';
        }
    };

    const jumpToIssue = (issue: InitiativeFeedbackBuilderIssue) => {
        setActiveView('questions');
        if (issue.fieldId) setSelectedFieldId(issue.fieldId);
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
                        <button type="button" onClick={() => jumpToIssue(issue)}>
                            {t('initiatives.feedback.builder.reviewIssue')}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );

    const renderCopyEditor = () => (
        <>
            <div className="title-input-section initiative-feedback-builder__title-section">
                <TextInput
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder={t('initiatives.feedback.fields.titlePlaceholder')}
                    aria-label={t('initiatives.feedback.fields.title')}
                    className="task-create__title-input"
                />
                <div
                    className="initiative-feedback-builder__meta"
                    aria-label={t('initiatives.feedback.builder.statusSummary')
                        .replace('{visible}', String(fieldStats.visible))
                        .replace('{total}', String(fieldStats.total))}
                >
                    <span className={draft.enabled ? 'is-live' : ''}>
                        {draft.enabled ? t('initiatives.feedback.status.enabled') : t('initiatives.feedback.status.disabled')}
                    </span>
                    <span>{fieldStats.visible}/{fieldStats.total} {t('initiatives.feedback.stats.fields')}</span>
                    {builderIssues.length > 0 && (
                        <span className={blockingIssues.length > 0 ? 'is-blocked' : 'has-warnings'}>
                            {builderIssues.length} {t('initiatives.feedback.builder.stats.issues')}
                        </span>
                    )}
                </div>
            </div>

            <div className="description-section initiative-feedback-builder__description-section">
                <TextArea
                    value={draft.description}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder={t('initiatives.feedback.fields.descriptionPlaceholder')}
                    aria-label={t('initiatives.feedback.fields.description')}
                    rows={2}
                    className="task-create__description-input"
                />
                <details className="initiative-feedback-builder__copy-more">
                    <summary>{t('initiatives.feedback.builder.responseCopy')}</summary>
                    <div>
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.feedback.fields.submitLabel')}</label>
                            <TextInput
                                value={draft.submitLabel}
                                onChange={(event) => setDraft((current) => ({ ...current, submitLabel: event.target.value }))}
                                placeholder={t('initiatives.feedback.fields.submitLabelPlaceholder')}
                            />
                        </div>
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.feedback.fields.successMessage')}</label>
                            <TextInput
                                value={draft.successMessage}
                                onChange={(event) => setDraft((current) => ({ ...current, successMessage: event.target.value }))}
                                placeholder={t('initiatives.feedback.fields.successMessagePlaceholder')}
                            />
                        </div>
                    </div>
                </details>
            </div>
        </>
    );

    const renderFieldRow = (field: InitiativeFeedbackField, index: number) => {
        const issuesForField = builderIssues.filter((issue) => issue.fieldId === field.id);
        const hasBlockingIssue = issuesForField.some((issue) => issue.severity === 'blocking');
        const isActive = selectedFieldId === field.id;

        const stateLabel = field.enabled === false
            ? t('initiatives.feedback.builder.hidden')
            : field.required
                ? t('initiatives.feedback.builder.required')
                : t('initiatives.feedback.builder.optional');

        return (
            <div key={field.id} className="initiative-feedback-builder__question-item">
                <div
                    className={[
                        'initiative-feedback-builder__question-row',
                        isActive ? 'is-active' : '',
                        hasBlockingIssue ? 'has-blocking-issue' : '',
                        field.enabled === false ? 'is-hidden' : '',
                    ].filter(Boolean).join(' ')}
                >
                    <button
                        type="button"
                        className="initiative-feedback-builder__question-main"
                        onClick={() => setSelectedFieldId(isActive ? null : field.id)}
                    >
                        <span className="initiative-feedback-builder__question-index">{index + 1}</span>
                        <span className="initiative-feedback-builder__field-icon material-symbols-outlined">
                            {getFeedbackFieldTypeIcon(field.type)}
                        </span>
                        <span className="initiative-feedback-builder__question-copy">
                            <strong>{field.label || t('initiatives.feedback.builder.unnamedField')}</strong>
                            <span>{getRoleLabel(field.role)} / {getFieldTypeLabel(field.type)} / {stateLabel}</span>
                        </span>
                        {issuesForField.length > 0 && (
                            <span className={`initiative-feedback-builder__issue-chip ${hasBlockingIssue ? 'is-blocking' : ''}`}>
                                {hasBlockingIssue
                                    ? t('initiatives.feedback.builder.needsFix')
                                    : t('initiatives.feedback.builder.warning')}
                            </span>
                        )}
                    </button>
                    <div className="initiative-feedback-builder__question-actions">
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => setSelectedFieldId(isActive ? null : field.id)}
                            aria-label={t('initiatives.feedback.builder.fieldSettings')}
                            icon={<span className="material-symbols-outlined">{isActive ? 'expand_less' : 'expand_more'}</span>}
                        />
                    </div>
                </div>
                {isActive && renderFieldEditor(field, issuesForField, index)}
            </div>
        );
    };

    const renderTemplateControl = () => (
        <div className="initiative-feedback-builder__add-control">
            <Select
                value={null}
                onChange={(value) => handleAddField(String(value) as FieldTemplateId)}
                options={addQuestionOptions}
                placeholder={t('initiatives.feedback.builder.addQuestion')}
                disabled={draft.fields.length >= MAX_INITIATIVE_FEEDBACK_FIELDS}
            />
        </div>
    );

    const renderFieldEditor = (field: InitiativeFeedbackField, issuesForField: InitiativeFeedbackBuilderIssue[], index: number) => (
        <div className="initiative-feedback-builder__question-editor">
            <div className="initiative-feedback-builder__inspector-head">
                <span className="section-label">{t('initiatives.feedback.builder.fieldSettings')}</span>
                <div className="initiative-feedback-builder__editor-actions">
                    <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => moveField(field.id, -1)}
                        disabled={index === 0}
                        aria-label={t('initiatives.feedback.builder.moveUp')}
                        icon={<span className="material-symbols-outlined">keyboard_arrow_up</span>}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => moveField(field.id, 1)}
                        disabled={index === draft.fields.length - 1}
                        aria-label={t('initiatives.feedback.builder.moveDown')}
                        icon={<span className="material-symbols-outlined">keyboard_arrow_down</span>}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => handleRemoveField(field.id)}
                        aria-label={t('initiatives.feedback.builder.removeField')}
                        icon={<span className="material-symbols-outlined">delete</span>}
                    />
                </div>
            </div>

            {issuesForField.length > 0 && renderIssueList(issuesForField)}

            <div className="initiative-feedback-builder__field-form">
                <div className="task-field initiative-feedback-builder__field initiative-feedback-builder__field--full">
                    <label className="section-label">{t('initiatives.feedback.builder.fieldLabel')}</label>
                    <TextInput
                        value={field.label}
                        onChange={(event) => updateField(field.id, (currentField) => ({ ...currentField, label: event.target.value }))}
                    />
                </div>

                <div className="task-field initiative-feedback-builder__field">
                    <label className="section-label">{t('initiatives.feedback.builder.fieldType')}</label>
                    <Select
                        value={field.type}
                        onChange={(value) => handleTypeChange(field.id, value)}
                        options={fieldTypeOptions}
                    />
                </div>

                <div className="task-field initiative-feedback-builder__field">
                    <label className="section-label">{t('initiatives.feedback.builder.mapping')}</label>
                    <Select
                        value={field.role || 'general'}
                        onChange={(value) => handleRoleChange(field.id, value)}
                        options={fieldRoleOptions}
                    />
                </div>

                <div className="task-field initiative-feedback-builder__field">
                    <label className="section-label">{t('initiatives.feedback.builder.placeholder')}</label>
                    <TextInput
                        value={field.placeholder || ''}
                        onChange={(event) => updateField(field.id, (currentField) => ({ ...currentField, placeholder: event.target.value }))}
                    />
                </div>

                <div className="task-field initiative-feedback-builder__field">
                    <label className="section-label">{t('initiatives.feedback.builder.helpText')}</label>
                    <TextInput
                        value={field.helpText || ''}
                        onChange={(event) => updateField(field.id, (currentField) => ({ ...currentField, helpText: event.target.value }))}
                    />
                </div>

                {feedbackFieldNeedsOptions(field.type) && (
                    <div className="task-field initiative-feedback-builder__field initiative-feedback-builder__field--full">
                        <label className="section-label">{t('initiatives.feedback.builder.options')}</label>
                        <TextArea
                            value={(field.options || []).map((option) => option.label).join('\n')}
                            onChange={(event) => updateField(field.id, (currentField) => ({
                                ...currentField,
                                options: event.target.value
                                    .split('\n')
                                    .map((entry) => entry.trim())
                                    .filter(Boolean)
                                    .slice(0, 8)
                                    .map((label, optionIndex) => ({
                                        id: `${currentField.id}-option-${optionIndex + 1}`,
                                        label,
                                        value: label,
                                    })),
                            }))}
                            rows={3}
                            placeholder={t('initiatives.feedback.builder.optionsPlaceholder')}
                        />
                    </div>
                )}

                <div className="initiative-feedback-builder__field-toggles initiative-feedback-builder__field initiative-feedback-builder__field--full">
                    <div className="initiative-feedback-builder__toggle-card">
                        <Checkbox
                            checked={field.required === true}
                            onChange={(event) => updateField(field.id, (currentField) => ({ ...currentField, required: event.target.checked }))}
                            label={t('initiatives.feedback.builder.required')}
                        />
                    </div>
                    <div className="initiative-feedback-builder__toggle-card">
                        <Checkbox
                            checked={field.enabled !== false}
                            onChange={(event) => updateField(field.id, (currentField) => ({ ...currentField, enabled: event.target.checked }))}
                            label={t('initiatives.feedback.builder.visibleOnForm')}
                        />
                    </div>
                    <div className="initiative-feedback-builder__toggle-card">
                        <Checkbox
                            checked={field.width === 'full'}
                            onChange={(event) => updateField(field.id, (currentField) => ({ ...currentField, width: event.target.checked ? 'full' : 'half' }))}
                            label={t('initiatives.feedback.builder.widthFull')}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    const renderQuestionsView = () => (
        <section className="initiative-feedback-builder__canvas">
            <div className="initiative-feedback-builder__canvas-head">
                <div>
                    <label className="section-label">{t('initiatives.feedback.builder.views.questions')}</label>
                    <span>{t('initiatives.feedback.builder.questionsSummary').replace('{count}', String(fieldStats.visible))}</span>
                </div>
            </div>

            <div className="initiative-feedback-builder__question-list" aria-label={t('initiatives.feedback.builder.fieldListLabel')}>
                {draft.fields.map(renderFieldRow)}
            </div>
        </section>
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

    const renderShareView = () => (
        <section className="initiative-feedback-builder__canvas initiative-feedback-builder__share-view">
            <div className="initiative-feedback-builder__canvas-head">
                <div>
                    <label className="section-label">{t('initiatives.feedback.builder.views.share')}</label>
                    <span>{draft.enabled ? t('initiatives.feedback.builder.publishEnabled') : t('initiatives.feedback.builder.publishDisabled')}</span>
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

            <div className="initiative-feedback-builder__share-grid">
                <div className="initiative-feedback-builder__share-panel">
                    <div className="initiative-feedback-builder__publish-status">
                        <span className="material-symbols-outlined">{draft.enabled ? 'public' : 'lock'}</span>
                        <div>
                            <strong>
                                {draft.enabled
                                    ? t('initiatives.feedback.builder.publishEnabled')
                                    : t('initiatives.feedback.builder.publishDisabled')}
                            </strong>
                            <p>
                                {draft.enabled
                                    ? t('initiatives.feedback.builder.publishReady')
                                    : t('initiatives.feedback.builder.publishDisabledHint')}
                            </p>
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

                <div className="initiative-feedback-builder__share-panel">
                    <h4>{t('initiatives.feedback.builder.intakeSettings')}</h4>
                    <div className="initiative-feedback-builder__share-settings">
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
                </div>
            </div>
        </section>
    );

    const renderPreviewPanel = () => (
        <aside className="initiative-feedback-builder__preview">
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
                                        rows={4}
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
    );

    const firstVisibleIssue = blockingIssues[0] || warningIssues[0];
    const healthText = blockingIssues.length > 0
        ? t('initiatives.feedback.builder.statusNeedsFixes')
        : warningIssues.length > 0
            ? t('initiatives.feedback.builder.statusWarnings')
            : t('initiatives.feedback.builder.statusReady');

    return createPortal(
        <div className="modal-overlay modal-overlay--open task-modal center-aligned initiative-modal" onClick={onClose}>
            <div
                className={`modal-content initiative-feedback-modal ${showPreview ? 'has-preview' : ''}`}
                onClick={(event) => event.stopPropagation()}
            >
                <form
                    className={`task-create-form initiative-feedback-builder ${showPreview ? 'has-preview' : ''}`}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void handleSave(false);
                    }}
                >
                    {renderCopyEditor()}

                    <div className="toolbar-row initiative-feedback-builder__toolbar">
                        <div className="initiative-feedback-builder__mode-tabs" aria-label={t('initiatives.feedback.builder.navigation')}>
                            <button
                                type="button"
                                className={activeView === 'questions' ? 'is-active' : ''}
                                onClick={() => setActiveView('questions')}
                            >
                                {t('initiatives.feedback.builder.views.questions')}
                            </button>
                            <button
                                type="button"
                                className={activeView === 'share' ? 'is-active' : ''}
                                onClick={() => setActiveView('share')}
                            >
                                {t('initiatives.feedback.builder.views.share')}
                            </button>
                        </div>
                        {activeView === 'questions' && renderTemplateControl()}
                        <div className="divider" />
                        <button
                            type="button"
                            className={`initiative-feedback-builder__toolbar-button ${showPreview ? 'is-active' : ''}`}
                            onClick={() => setShowPreview((current) => !current)}
                        >
                            <span className="material-symbols-outlined">{showPreview ? 'visibility_off' : 'visibility'}</span>
                            {showPreview
                                ? t('initiatives.feedback.builder.hidePreview')
                                : t('initiatives.feedback.builder.showPreview')}
                        </button>
                        <Checkbox
                            checked={draft.enabled}
                            onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
                            label={t('initiatives.feedback.builder.publish')}
                        />
                    </div>

                    {(firstVisibleIssue || error) && (
                        <div className={`task-create-form__error initiative-feedback-builder__inline-alert ${blockingIssues.length > 0 || error ? 'is-blocking' : 'is-warning'}`}>
                            <span>{error || getIssueMessage(firstVisibleIssue!)}</span>
                            {firstVisibleIssue?.fieldId && (
                                <button type="button" onClick={() => jumpToIssue(firstVisibleIssue)}>
                                    {t('initiatives.feedback.builder.reviewIssue')}
                                </button>
                            )}
                        </div>
                    )}

                    <div className="initiative-feedback-builder__body">
                        <div className="initiative-feedback-builder__workarea">
                            {activeView === 'questions' ? renderQuestionsView() : renderShareView()}
                        </div>

                        {showPreview && renderPreviewPanel()}
                    </div>

                    <div className="modal-footer initiative-feedback-builder__footer">
                        <span className={`initiative-feedback-builder__footer-status ${blockingIssues.length > 0 ? 'is-blocked' : warningIssues.length > 0 ? 'has-warnings' : 'is-ready'}`}>
                            <span className="material-symbols-outlined">
                                {blockingIssues.length > 0 ? 'error' : warningIssues.length > 0 ? 'info' : 'check_circle'}
                            </span>
                            {healthText}
                        </span>
                        <div className="actions">
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
                </form>
            </div>
        </div>,
        document.body,
    );
};
