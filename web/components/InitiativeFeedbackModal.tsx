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
import {
    getInitiativeFeedbackConfigEndpoint,
    getInitiativeFeedbackSubmitEndpoint,
    saveInitiativeFeedbackConfig,
} from '../services/initiativeFeedbackService';
import {
    MAX_INITIATIVE_FEEDBACK_FIELDS,
    buildInitiativeFeedbackEmbedModel,
    createCustomInitiativeFeedbackField,
    ensureInitiativeFeedbackFields,
    feedbackFieldNeedsOptions,
    getFeedbackFieldTypeIcon,
    getInitiativeFeedbackBuilderIssues,
    localizeDefaultInitiativeFeedbackField,
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

const buildDraft = (initiative: Initiative | null, t: (key: string) => string): DraftState => {
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
        fields: hasStoredFields ? fields : fields.map((field) => localizeDefaultInitiativeFeedbackField(field, t)),
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

    const configEndpoint = useMemo(() => getInitiativeFeedbackConfigEndpoint(), []);
    const submitEndpoint = useMemo(() => getInitiativeFeedbackSubmitEndpoint(), []);

    const embedModelJson = useMemo(() => JSON.stringify(
        buildInitiativeFeedbackEmbedModel({
            token: initiative?.feedbackForm?.token,
            hostedUrl: hostedUrl || undefined,
            configEndpoint,
            submitEndpoint,
            projectTitle: '',
            initiativeTitle: initiative?.title,
            title: draft.title,
            description: draft.description,
            submitLabel: draft.submitLabel,
            successMessage: draft.successMessage,
            allowAttachments: draft.allowAttachments,
            maxAttachments: draft.maxAttachments,
            fields: draft.fields,
        }),
        null,
        2,
    ), [
        configEndpoint,
        draft.allowAttachments,
        draft.description,
        draft.fields,
        draft.maxAttachments,
        draft.submitLabel,
        draft.successMessage,
        draft.title,
        hostedUrl,
        initiative?.feedbackForm?.token,
        initiative?.title,
        submitEndpoint,
    ]);

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

    const renderCanvasField = (field: InitiativeFeedbackField, index: number) => {
        const isSelected = selectedFieldId === field.id;
        const issuesForField = builderIssues.filter((issue) => issue.fieldId === field.id);
        const hasBlockingIssue = issuesForField.some((issue) => issue.severity === 'blocking');

        return (
            <div 
                key={field.id} 
                className={`feedback-canvas__field-wrapper ${isSelected ? 'is-selected' : ''} ${hasBlockingIssue ? 'has-error' : ''} ${field.enabled === false ? 'is-hidden' : ''} ${field.width === 'full' ? 'is-full-width' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFieldId(field.id);
                }}
            >
                <div className="feedback-canvas__field-overlay" />
                <div className="feedback-canvas__field-content public-initiative-feedback__field">
                    {isSelected && (
                        <div className="feedback-canvas__field-actions">
                            <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    moveField(field.id, -1);
                                }}
                                disabled={index === 0}
                                aria-label={t('initiatives.feedback.builder.moveUp')}
                                icon={<span className="material-symbols-outlined">keyboard_arrow_up</span>}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    moveField(field.id, 1);
                                }}
                                disabled={index === draft.fields.length - 1}
                                aria-label={t('initiatives.feedback.builder.moveDown')}
                                icon={<span className="material-symbols-outlined">keyboard_arrow_down</span>}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveField(field.id);
                                }}
                                aria-label={t('initiatives.feedback.builder.removeField')}
                                icon={<span className="material-symbols-outlined">delete</span>}
                                className="feedback-canvas__delete-btn"
                            />
                        </div>
                    )}
                    <label className="public-initiative-feedback__field-label">
                        {field.label || t('initiatives.feedback.builder.unnamedField')}
                        {field.required && <span>*</span>}
                    </label>
                    {field.type === 'longText' ? (
                        <textarea
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
                        <input
                            value={sampleValueForField(field)}
                            onChange={() => undefined}
                            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                            readOnly
                            className="public-initiative-feedback__preview-input"
                            placeholder={field.placeholder}
                        />
                    )}
                    {field.helpText && (
                        <p className="public-initiative-feedback__field-help">{field.helpText}</p>
                    )}
                </div>
            </div>
        );
    };

    const renderCanvas = () => (
        <div className="feedback-builder__canvas-area" onClick={() => setSelectedFieldId(null)}>
            <div className="feedback-builder__canvas-container">
                <div className="public-initiative-feedback__shell feedback-builder__live-form">
                    <div 
                        className={`feedback-canvas__header-wrapper ${selectedFieldId === null ? 'is-selected' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFieldId(null);
                        }}
                    >
                        <div className="feedback-canvas__field-overlay" />
                        <div className="feedback-canvas__field-content public-initiative-feedback__header">
                            <span className="public-initiative-feedback__eyebrow">{initiative.title}</span>
                            <h1>{draft.title || t('initiatives.feedback.fields.titlePlaceholder')}</h1>
                            <p>{draft.description || t('initiatives.feedback.public.descriptionFallback').replace('{initiative}', initiative.title)}</p>
                        </div>
                    </div>

                    <div className="public-initiative-feedback__form">
                        <div className="public-initiative-feedback__grid feedback-canvas__grid">
                            {draft.fields.map((field, index) => renderCanvasField(field, index))}
                        </div>

                        <div className="feedback-canvas__add-field">
                            <Button 
                                variant="secondary" 
                                size="lg" 
                                type="button"
                                icon={<span className="material-symbols-outlined">add</span>}
                                onClick={() => handleAddField('shortText')}
                                disabled={draft.fields.length >= MAX_INITIATIVE_FEEDBACK_FIELDS}
                            >
                                {t('initiatives.feedback.builder.addQuestion')}
                            </Button>
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
                            <Button variant="primary" type="button" size="lg">
                                {draft.submitLabel || t('initiatives.feedback.fields.submitLabelPlaceholder')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderInspector = () => {
        if (selectedFieldId === null) {
            return renderGeneralSettings();
        }
        
        const field = draft.fields.find(f => f.id === selectedFieldId);
        if (!field) return renderGeneralSettings();
        
        const index = draft.fields.findIndex(f => f.id === selectedFieldId);
        const issuesForField = builderIssues.filter(i => i.fieldId === selectedFieldId);
        
        return renderFieldEditor(field, issuesForField, index);
    };

    const renderGeneralSettings = () => (
        <div className="feedback-builder__inspector-content">
            <div className="feedback-builder__inspector-header">
                <h3>{t('initiatives.feedback.builder.formPanel')}</h3>
                <p>{t('initiatives.feedback.builder.formPanelDescription')}</p>
            </div>
            <div className="feedback-builder__inspector-body">
                <div className="task-field">
                    <label className="section-label">{t('initiatives.feedback.fields.title')}</label>
                    <TextInput
                        value={draft.title}
                        onChange={(e) => setDraft(c => ({ ...c, title: e.target.value }))}
                        placeholder={t('initiatives.feedback.fields.titlePlaceholder')}
                    />
                </div>
                <div className="task-field">
                    <label className="section-label">{t('initiatives.feedback.fields.description')}</label>
                    <TextArea
                        value={draft.description}
                        onChange={(e) => setDraft(c => ({ ...c, description: e.target.value }))}
                        placeholder={t('initiatives.feedback.fields.descriptionPlaceholder')}
                        rows={3}
                    />
                </div>
                
                <div className="feedback-builder__inspector-divider" />
                
                <div className="task-field">
                    <label className="section-label">{t('initiatives.feedback.fields.submitLabel')}</label>
                    <TextInput
                        value={draft.submitLabel}
                        onChange={(e) => setDraft(c => ({ ...c, submitLabel: e.target.value }))}
                        placeholder={t('initiatives.feedback.fields.submitLabelPlaceholder')}
                    />
                </div>
                <div className="task-field">
                    <label className="section-label">{t('initiatives.feedback.fields.successMessage')}</label>
                    <TextInput
                        value={draft.successMessage}
                        onChange={(e) => setDraft(c => ({ ...c, successMessage: e.target.value }))}
                        placeholder={t('initiatives.feedback.fields.successMessagePlaceholder')}
                    />
                </div>

                <div className="feedback-builder__inspector-divider" />

                <div className="initiative-feedback-builder__toggle-card">
                    <Checkbox
                        checked={draft.allowAttachments}
                        onChange={(e) => setDraft(c => ({ ...c, allowAttachments: e.target.checked }))}
                        label={t('initiatives.feedback.fields.allowAttachments')}
                    />
                </div>
                {draft.allowAttachments && (
                    <div className="task-field">
                        <label className="section-label">{t('initiatives.feedback.fields.maxAttachments')}</label>
                        <TextInput
                            type="number"
                            min={1}
                            max={4}
                            value={String(draft.maxAttachments)}
                            onChange={(e) => setDraft(c => ({
                                ...c,
                                maxAttachments: Math.min(4, Math.max(1, Number(e.target.value) || 1)),
                            }))}
                        />
                    </div>
                )}
            </div>
        </div>
    );

    const renderFieldEditor = (field: InitiativeFeedbackField, issuesForField: InitiativeFeedbackBuilderIssue[], index: number) => (
        <div className="feedback-builder__inspector-content">
            <div className="feedback-builder__inspector-header">
                <h3>{t('initiatives.feedback.builder.fieldSettings')}</h3>
                <p>{t('initiatives.feedback.builder.fieldSettingsDescription') || 'Configure the selected field.'}</p>
            </div>

            {issuesForField.length > 0 && renderIssueList(issuesForField)}

            <div className="feedback-builder__inspector-body">
                <div className="task-field">
                    <label className="section-label">{t('initiatives.feedback.builder.fieldLabel')}</label>
                    <TextInput
                        value={field.label}
                        onChange={(event) => updateField(field.id, (currentField) => ({ ...currentField, label: event.target.value }))}
                    />
                </div>

                <div className="task-field">
                    <label className="section-label">{t('initiatives.feedback.builder.fieldType')}</label>
                    <Select
                        value={field.type}
                        onChange={(value) => handleTypeChange(field.id, value)}
                        options={fieldTypeOptions}
                    />
                </div>

                <div className="task-field">
                    <label className="section-label">{t('initiatives.feedback.builder.mapping')}</label>
                    <Select
                        value={field.role || 'general'}
                        onChange={(value) => handleRoleChange(field.id, value)}
                        options={fieldRoleOptions}
                    />
                </div>

                <div className="task-field">
                    <label className="section-label">{t('initiatives.feedback.builder.placeholder')}</label>
                    <TextInput
                        value={field.placeholder || ''}
                        onChange={(event) => updateField(field.id, (currentField) => ({ ...currentField, placeholder: event.target.value }))}
                    />
                </div>

                <div className="task-field">
                    <label className="section-label">{t('initiatives.feedback.builder.helpText')}</label>
                    <TextInput
                        value={field.helpText || ''}
                        onChange={(event) => updateField(field.id, (currentField) => ({ ...currentField, helpText: event.target.value }))}
                    />
                </div>

                {feedbackFieldNeedsOptions(field.type) && (
                    <div className="task-field">
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

                <div className="feedback-builder__inspector-divider" />

                <div className="feedback-builder__publish-toggle" onClick={() => updateField(field.id, (currentField) => ({ ...currentField, required: !currentField.required }))}>
                    <span className="feedback-builder__publish-label">{t('initiatives.feedback.builder.required')}</span>
                    <button
                        type="button"
                        className={`switch-track ${field.required === true ? 'active' : ''}`}
                        role="switch"
                        aria-checked={field.required === true}
                    >
                        <span className="switch-handle" />
                    </button>
                </div>

                <div className="feedback-builder__publish-toggle" onClick={() => updateField(field.id, (currentField) => ({ ...currentField, enabled: currentField.enabled === false ? true : false }))}>
                    <span className="feedback-builder__publish-label">{t('initiatives.feedback.builder.visibleOnForm')}</span>
                    <button
                        type="button"
                        className={`switch-track ${field.enabled !== false ? 'active' : ''}`}
                        role="switch"
                        aria-checked={field.enabled !== false}
                    >
                        <span className="switch-handle" />
                    </button>
                </div>

                <div className="feedback-builder__publish-toggle" onClick={() => updateField(field.id, (currentField) => ({ ...currentField, width: currentField.width === 'full' ? 'half' : 'full' }))}>
                    <span className="feedback-builder__publish-label">{t('initiatives.feedback.builder.widthFull')}</span>
                    <button
                        type="button"
                        className={`switch-track ${field.width === 'full' ? 'active' : ''}`}
                        role="switch"
                        aria-checked={field.width === 'full'}
                    >
                        <span className="switch-handle" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderQuestionsView = () => (
        <section className="feedback-builder__main">
            {renderCanvas()}
            <div className="feedback-builder__inspector-pane">
                {renderInspector()}
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

            <div className="initiative-feedback-builder__share-panel initiative-feedback-builder__embed-panel">
                <div className="initiative-feedback-builder__embed-head">
                    <div>
                        <h4>{t('initiatives.feedback.builder.embedModelTitle')}</h4>
                        <p>{t('initiatives.feedback.builder.embedModelDescription')}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => void handleCopy(embedModelJson, 'embed-model')}
                    >
                        {copiedField === 'embed-model' ? t('common.copied') : t('common.copy')}
                    </Button>
                </div>
                <pre className="initiative-feedback-builder__embed-json">
                    <code>{embedModelJson}</code>
                </pre>
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
                                        placeholder={field.placeholder}
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
                        <Button variant="primary" type="button" size="lg">
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
                className="modal-content initiative-feedback-modal"
                onClick={(event) => event.stopPropagation()}
            >
                <form
                    className="task-create-form initiative-feedback-builder"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void handleSave(false);
                    }}
                >
                    <div className="feedback-builder__topbar">
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
                        
                        <div className="feedback-builder__topbar-actions">
                            <span className={`initiative-feedback-builder__footer-status ${blockingIssues.length > 0 ? 'is-blocked' : warningIssues.length > 0 ? 'has-warnings' : 'is-ready'}`}>
                                <span className="material-symbols-outlined">
                                    {blockingIssues.length > 0 ? 'error' : warningIssues.length > 0 ? 'info' : 'check_circle'}
                                </span>
                                {healthText}
                            </span>
                            <div className="feedback-builder__topbar-divider" />
                            
                            <div 
                                className="feedback-builder__publish-toggle"
                                onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
                            >
                                <span className="feedback-builder__publish-label">{t('initiatives.feedback.builder.publish')}</span>
                                <button
                                    type="button"
                                    className={`switch-track ${draft.enabled ? 'active' : ''}`}
                                    role="switch"
                                    aria-checked={draft.enabled}
                                >
                                    <span className="switch-handle" />
                                </button>
                            </div>

                            <div className="feedback-builder__topbar-divider" />
                            
                            <Button variant="secondary" size="md" type="button" onClick={onClose} disabled={saving}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                type="submit"
                                isLoading={saving}
                                disabled={blockingIssues.length > 0}
                            >
                                {t('common.saveChanges')}
                            </Button>
                        </div>
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
                        {activeView === 'questions' ? renderQuestionsView() : (
                            <div className="initiative-feedback-builder__workarea">
                                {renderShareView()}
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
};
