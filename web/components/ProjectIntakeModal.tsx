import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
    Project,
    ProjectIntakeCategory,
    ProjectIntakeField,
    ProjectIntakeFieldType,
    ProjectIntakeFieldRole,
    ProjectIntakeFormSettings,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';
import {
    saveProjectIntakeConfig,
    getPublicProjectIntakeUrl,
} from '../services/projectIntakeService';
import {
    createCustomIntakeCategory,
    createCustomIntakeField,
    localizedDefaultIntakeCategories,
    localizeIntakeCategory,
    localizeIntakeFormCopy,
    getIntakeCategoryIcon,
    intakeFieldNeedsOptions,
    prepareIntakeCategoriesForSave,
    MAX_INTAKE_CATEGORIES,
    MAX_INTAKE_FIELDS_PER_CATEGORY,
} from '../utils/projectIntakeBuilder';
import { Button } from './common/Button/Button';
import { TextInput } from './common/Input/TextInput';
import { TextArea } from './common/Input/TextArea';
import { Select, type SelectOption } from './common/Select/Select';

interface ProjectIntakeModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onSaved: (settings: ProjectIntakeFormSettings) => void;
}

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
    <div className="feedback-builder__publish-toggle" onClick={() => onChange(!checked)}>
        <span className="feedback-builder__publish-label">{label}</span>
        <button type="button" className={`switch-track ${checked ? 'active' : ''}`} role="switch" aria-checked={checked}>
            <span className="switch-handle" />
        </button>
    </div>
);

const cloneCategories = (cats: ProjectIntakeCategory[]): ProjectIntakeCategory[] =>
    cats.map((c) => ({ ...c, fields: c.fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })) }));

export const ProjectIntakeModal: React.FC<ProjectIntakeModalProps> = ({ isOpen, onClose, project, onSaved }) => {
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const current = project.intakeForm;
    // Localize untouched English defaults so a German app shows German content even for
    // forms that were saved earlier with the English server defaults.
    const localizedCopy = localizeIntakeFormCopy(
        { title: current?.title, submitLabel: current?.submitLabel, successMessage: current?.successMessage },
        t,
    );

    const [enabled, setEnabled] = useState(current?.enabled === true);
    const [title, setTitle] = useState(localizedCopy.title || '');
    const [description, setDescription] = useState(current?.description || '');
    const [submitLabel, setSubmitLabel] = useState(localizedCopy.submitLabel || '');
    const [successMessage, setSuccessMessage] = useState(localizedCopy.successMessage || '');
    const [allowAttachments, setAllowAttachments] = useState(current?.allowAttachments !== false);
    const [maxAttachments, setMaxAttachments] = useState(current?.maxAttachments || 4);
    const [autoCreateTask, setAutoCreateTask] = useState(current?.autoCreateTask === true);
    const [categories, setCategories] = useState<ProjectIntakeCategory[]>(() =>
        cloneCategories(current?.categories?.length
            ? current.categories.map((c) => localizeIntakeCategory(c, t))
            : localizedDefaultIntakeCategories(t)),
    );
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() => categories[0]?.id || null);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'category' | 'form'>('category');
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (copied) {
            const tmr = window.setTimeout(() => setCopied(false), 1800);
            return () => window.clearTimeout(tmr);
        }
    }, [copied]);

    const typeOptions = useMemo<SelectOption[]>(() => ([
        { value: 'shortText', label: t('intake.builder.types.shortText') },
        { value: 'longText', label: t('intake.builder.types.longText') },
        { value: 'email', label: t('intake.builder.types.email') },
        { value: 'url', label: t('intake.builder.types.url') },
        { value: 'select', label: t('intake.builder.types.select') },
    ]), [t]);

    const roleOptions = useMemo<SelectOption[]>(() => ([
        { value: 'general', label: t('intake.builder.roles.general') },
        { value: 'title', label: t('intake.builder.roles.title') },
        { value: 'description', label: t('intake.builder.roles.description') },
        { value: 'sourceUrl', label: t('intake.builder.roles.sourceUrl') },
    ]), [t]);

    const shareUrl = current?.token ? getPublicProjectIntakeUrl(current.token) : '';

    const activeCategoryIndex = categories.findIndex((c) => c.id === activeCategoryId);
    const activeCategory = activeCategoryIndex >= 0 ? categories[activeCategoryIndex] : null;
    const selectedField = activeCategory?.fields.find((f) => f.id === selectedFieldId) || null;
    const selectedFieldIndex = activeCategory ? activeCategory.fields.findIndex((f) => f.id === selectedFieldId) : -1;

    // --- mutations ---
    const patchCategory = (index: number, patch: Partial<ProjectIntakeCategory>) =>
        setCategories((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

    const patchField = (fieldId: string, updater: (f: ProjectIntakeField) => ProjectIntakeField) =>
        setCategories((prev) => prev.map((c, i) => (i === activeCategoryIndex
            ? { ...c, fields: c.fields.map((f) => (f.id === fieldId ? updater(f) : f)) }
            : c)));

    const addField = () => {
        if (!activeCategory) return;
        if (activeCategory.fields.length >= MAX_INTAKE_FIELDS_PER_CATEGORY) return;
        const field = createCustomIntakeField(undefined, t);
        setCategories((prev) => prev.map((c, i) => (i === activeCategoryIndex ? { ...c, fields: [...c.fields, field] } : c)));
        setSelectedFieldId(field.id);
    };

    const removeField = (fieldId: string) => {
        setCategories((prev) => prev.map((c, i) => (i === activeCategoryIndex
            ? { ...c, fields: c.fields.filter((f) => f.id !== fieldId) }
            : c)));
        if (selectedFieldId === fieldId) setSelectedFieldId(null);
    };

    const moveField = (fieldId: string, dir: -1 | 1) => {
        setCategories((prev) => prev.map((c, i) => {
            if (i !== activeCategoryIndex) return c;
            const idx = c.fields.findIndex((f) => f.id === fieldId);
            const next = idx + dir;
            if (idx < 0 || next < 0 || next >= c.fields.length) return c;
            const fields = [...c.fields];
            const [moved] = fields.splice(idx, 1);
            fields.splice(next, 0, moved);
            return { ...c, fields };
        }));
    };

    const handleTypeChange = (fieldId: string, value: string | number) => {
        const nextType = String(value) as ProjectIntakeFieldType;
        patchField(fieldId, (f) => ({
            ...f,
            type: nextType,
            width: nextType === 'longText' ? 'full' : f.width,
            options: nextType === 'select'
                ? (f.options?.length ? f.options : [
                    { id: `${f.id}-o1`, label: t('intake.builder.optionSample1'), value: t('intake.builder.optionSample1') },
                    { id: `${f.id}-o2`, label: t('intake.builder.optionSample2'), value: t('intake.builder.optionSample2') },
                ])
                : [],
        }));
    };

    const addCategory = () => {
        if (categories.length >= MAX_INTAKE_CATEGORIES) return;
        const cat = createCustomIntakeCategory(t);
        setCategories((prev) => [...prev, cat]);
        setActiveCategoryId(cat.id);
        setSelectedFieldId(null);
        setInspectorTab('category');
    };

    const removeCategory = (index: number) => {
        setCategories((prev) => {
            const next = prev.filter((_, i) => i !== index);
            if (categories[index]?.id === activeCategoryId) {
                setActiveCategoryId(next[0]?.id || null);
                setSelectedFieldId(null);
            }
            return next;
        });
    };

    const selectCategory = (id: string) => {
        setActiveCategoryId(id);
        setSelectedFieldId(null);
        setInspectorTab('category');
    };

    const selectForm = () => {
        setSelectedFieldId(null);
        setInspectorTab('form');
    };

    const handleCopyLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
        } catch {
            showError(shareUrl);
        }
    };

    const persist = async (regenerateToken = false) => {
        const tenantId = project.tenantId;
        if (!tenantId) { showError(t('intake.inbox.actionError')); return; }
        setSaving(true);
        try {
            const result = await saveProjectIntakeConfig({
                tenantId,
                projectId: project.id,
                enabled,
                title: title.trim(),
                description: description.trim(),
                submitLabel: submitLabel.trim(),
                successMessage: successMessage.trim(),
                allowAttachments,
                maxAttachments,
                autoCreateTask,
                categories: prepareIntakeCategoriesForSave(categories),
                regenerateToken,
            });
            onSaved(result.intakeForm);
            showSuccess(t('intake.builder.saved'));
            if (!regenerateToken) onClose();
        } catch (error) {
            console.error('Failed to save intake config', error);
            showError((error as Error).message || t('intake.inbox.actionError'));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    // --- canvas field preview (read-only, click to select) ---
    const renderCanvasField = (field: ProjectIntakeField, index: number) => {
        const isSelected = selectedFieldId === field.id;
        return (
            <div
                key={field.id}
                className={`feedback-canvas__field-wrapper ${isSelected ? 'is-selected' : ''} ${field.enabled === false ? 'is-hidden' : ''} ${field.width === 'full' ? 'is-full-width' : ''}`}
                onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
            >
                <div className="feedback-canvas__field-overlay" />
                <div className="feedback-canvas__field-content public-initiative-feedback__field">
                    {isSelected && (
                        <div className="feedback-canvas__field-actions">
                            <Button variant="ghost" size="icon" type="button" disabled={index === 0}
                                onClick={(e) => { e.stopPropagation(); moveField(field.id, -1); }}
                                aria-label={t('intake.builder.moveUp')}
                                icon={<span className="material-symbols-outlined">keyboard_arrow_up</span>} />
                            <Button variant="ghost" size="icon" type="button" disabled={index === (activeCategory?.fields.length || 0) - 1}
                                onClick={(e) => { e.stopPropagation(); moveField(field.id, 1); }}
                                aria-label={t('intake.builder.moveDown')}
                                icon={<span className="material-symbols-outlined">keyboard_arrow_down</span>} />
                            <Button variant="ghost" size="icon" type="button" className="feedback-canvas__delete-btn"
                                onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                                aria-label={t('intake.builder.removeField')}
                                icon={<span className="material-symbols-outlined">delete</span>} />
                        </div>
                    )}
                    <label className="public-initiative-feedback__field-label">
                        {field.label || t('intake.builder.fieldLabelPlaceholder')}
                        {field.required && <span>*</span>}
                    </label>
                    {field.type === 'longText' ? (
                        <textarea className="public-initiative-feedback__preview-input" rows={4} readOnly value="" placeholder={field.placeholder} onChange={() => undefined} />
                    ) : intakeFieldNeedsOptions(field.type) ? (
                        <select className="public-initiative-feedback__native-select" value="" disabled onChange={() => undefined}>
                            <option value="">{field.placeholder || field.label}</option>
                            {(field.options || []).map((o) => <option key={o.id} value={o.value}>{o.label}</option>)}
                        </select>
                    ) : (
                        <input className="public-initiative-feedback__preview-input" readOnly value=""
                            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                            placeholder={field.placeholder} onChange={() => undefined} />
                    )}
                    {field.helpText && <p className="public-initiative-feedback__field-help">{field.helpText}</p>}
                </div>
            </div>
        );
    };

    const renderCanvas = () => (
        <div className="feedback-builder__canvas-area" onClick={() => setSelectedFieldId(null)}>
            <div className="feedback-builder__canvas-container">
                {/* Category tabs */}
                <div className="pib-cats" onClick={(e) => e.stopPropagation()}>
                    {categories.map((c) => (
                        <button key={c.id} type="button"
                            className={`pib-cats__tab ${c.id === activeCategoryId ? 'is-active' : ''} ${c.enabled === false ? 'is-off' : ''}`}
                            onClick={() => selectCategory(c.id)}>
                            <span className="material-symbols-outlined">{getIntakeCategoryIcon(c.id, c.icon)}</span>
                            <span className="pib-cats__label">{c.label || t('intake.builder.categoryLabelPlaceholder')}</span>
                            <span className="pib-cats__count">{c.fields.length}</span>
                        </button>
                    ))}
                    <button type="button" className="pib-cats__add" onClick={addCategory}
                        disabled={categories.length >= MAX_INTAKE_CATEGORIES} title={t('intake.builder.addCategory')}>
                        <span className="material-symbols-outlined">add</span>
                    </button>
                </div>

                <div className="public-initiative-feedback__shell feedback-builder__live-form">
                    <div className={`feedback-canvas__header-wrapper ${selectedFieldId === null && inspectorTab === 'form' ? 'is-selected' : ''}`}
                        onClick={(e) => { e.stopPropagation(); selectForm(); }}>
                        <div className="feedback-canvas__field-overlay" />
                        <div className="feedback-canvas__field-content public-initiative-feedback__header">
                            <span className="public-initiative-feedback__eyebrow">{project.title}</span>
                            <h1>{title || t('intake.builder.formTitlePlaceholder')}</h1>
                            <p>{description || t('intake.builder.formDescriptionPlaceholder')}</p>
                        </div>
                    </div>

                    {activeCategory && (
                        <div className="public-initiative-feedback__form">
                            <div className="public-initiative-feedback__grid feedback-canvas__grid">
                                {activeCategory.fields.map((field, index) => renderCanvasField(field, index))}
                            </div>

                            <div className="feedback-canvas__add-field">
                                <Button variant="secondary" size="lg" type="button"
                                    icon={<span className="material-symbols-outlined">add</span>}
                                    onClick={addField}
                                    disabled={activeCategory.fields.length >= MAX_INTAKE_FIELDS_PER_CATEGORY}>
                                    {t('intake.builder.addField')}
                                </Button>
                            </div>

                            {allowAttachments && (
                                <div className="public-initiative-feedback__attachments">
                                    <label className="public-initiative-feedback__attachments-label">
                                        {t('intake.public.fields.attachments')}
                                    </label>
                                    <div className="initiative-feedback-builder__attachment-dropzone">
                                        <span className="material-symbols-outlined">cloud_upload</span>
                                        <div>
                                            <strong>{t('intake.public.uploadTitle')}</strong>
                                            <p>{t('intake.public.attachmentsHint').replace('{count}', String(maxAttachments))}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="public-initiative-feedback__footer">
                                <span className="public-initiative-feedback__footer-note">{t('intake.public.privacyNote')}</span>
                                <Button variant="primary" type="button" size="lg">
                                    {submitLabel || t('intake.builder.submitLabelPlaceholder')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderFieldEditor = (field: ProjectIntakeField) => (
        <div className="feedback-builder__inspector-content">
            <div className="feedback-builder__inspector-header">
                <button type="button" className="pib-inspector__back" onClick={() => setSelectedFieldId(null)}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    {activeCategory?.label}
                </button>
                <h3>{t('intake.builder.fieldSettings')}</h3>
            </div>
            <div className="feedback-builder__inspector-body">
                <div className="task-field">
                    <label className="section-label">{t('intake.builder.fieldLabel')}</label>
                    <TextInput value={field.label} onChange={(e) => patchField(field.id, (f) => ({ ...f, label: e.target.value }))} />
                </div>
                <div className="task-field">
                    <label className="section-label">{t('intake.builder.fieldType')}</label>
                    <Select value={field.type} onChange={(v) => handleTypeChange(field.id, v)} options={typeOptions} />
                </div>
                <div className="task-field">
                    <label className="section-label">{t('intake.builder.mapping')}</label>
                    <Select value={field.role || 'general'} onChange={(v) => patchField(field.id, (f) => ({ ...f, role: String(v) as ProjectIntakeFieldRole }))} options={roleOptions} />
                </div>
                <div className="task-field">
                    <label className="section-label">{t('intake.builder.placeholder')}</label>
                    <TextInput value={field.placeholder || ''} onChange={(e) => patchField(field.id, (f) => ({ ...f, placeholder: e.target.value }))} />
                </div>
                <div className="task-field">
                    <label className="section-label">{t('intake.builder.helpText')}</label>
                    <TextInput value={field.helpText || ''} onChange={(e) => patchField(field.id, (f) => ({ ...f, helpText: e.target.value }))} />
                </div>
                {intakeFieldNeedsOptions(field.type) && (
                    <div className="task-field">
                        <label className="section-label">{t('intake.builder.options')}</label>
                        <TextArea
                            value={(field.options || []).map((o) => o.label).join('\n')}
                            onChange={(e) => patchField(field.id, (f) => ({
                                ...f,
                                options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8)
                                    .map((label, i) => ({ id: `${f.id}-o${i + 1}`, label, value: label })),
                            }))}
                            rows={3}
                            placeholder={t('intake.builder.optionsPlaceholder')}
                        />
                    </div>
                )}

                <div className="feedback-builder__inspector-divider" />

                <Toggle checked={field.required === true} label={t('intake.builder.required')}
                    onChange={(v) => patchField(field.id, (f) => ({ ...f, required: v }))} />
                <Toggle checked={field.enabled !== false} label={t('intake.builder.visibleOnForm')}
                    onChange={(v) => patchField(field.id, (f) => ({ ...f, enabled: v }))} />
                <Toggle checked={field.width === 'full'} label={t('intake.builder.widthFull')}
                    onChange={(v) => patchField(field.id, (f) => ({ ...f, width: v ? 'full' : 'half' }))} />
            </div>
        </div>
    );

    const renderCategorySettings = () => {
        if (!activeCategory) {
            return (
                <div className="feedback-builder__inspector-content">
                    <div className="pib-inspector__empty">
                        <span className="material-symbols-outlined">category</span>
                        <p>{t('intake.builder.noCategory')}</p>
                        <Button variant="primary" type="button" onClick={addCategory}>{t('intake.builder.addCategory')}</Button>
                    </div>
                </div>
            );
        }
        return (
            <div className="feedback-builder__inspector-content">
                {renderInspectorTabs()}
                <div className="feedback-builder__inspector-body">
                    <div className="task-field">
                        <label className="section-label">{t('intake.builder.categoryNameLabel')}</label>
                        <TextInput value={activeCategory.label}
                            onChange={(e) => patchCategory(activeCategoryIndex, { label: e.target.value })}
                            placeholder={t('intake.builder.categoryLabelPlaceholder')} />
                    </div>
                    <div className="task-field">
                        <label className="section-label">{t('intake.builder.categoryDescriptionLabel')}</label>
                        <TextArea value={activeCategory.description || ''}
                            onChange={(e) => patchCategory(activeCategoryIndex, { description: e.target.value })}
                            placeholder={t('intake.builder.categoryDescriptionPlaceholder')} rows={2} />
                    </div>
                    <Toggle checked={activeCategory.enabled !== false} label={t('intake.builder.categoryEnabled')}
                        onChange={(v) => patchCategory(activeCategoryIndex, { enabled: v })} />

                    <div className="feedback-builder__inspector-divider" />

                    <div className="pib-inspector__rowactions">
                        <Button variant="secondary" type="button"
                            icon={<span className="material-symbols-outlined">add</span>}
                            onClick={addField} disabled={activeCategory.fields.length >= MAX_INTAKE_FIELDS_PER_CATEGORY}>
                            {t('intake.builder.addField')}
                        </Button>
                        <Button variant="ghost" type="button" className="pib-inspector__danger"
                            icon={<span className="material-symbols-outlined">delete</span>}
                            onClick={() => removeCategory(activeCategoryIndex)}>
                            {t('intake.builder.removeCategory')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderFormSettings = () => (
        <div className="feedback-builder__inspector-content">
            {renderInspectorTabs()}
            <div className="feedback-builder__inspector-body">
                <div className="task-field">
                    <label className="section-label">{t('intake.builder.formTitle')}</label>
                    <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('intake.builder.formTitlePlaceholder')} />
                </div>
                <div className="task-field">
                    <label className="section-label">{t('intake.builder.formDescription')}</label>
                    <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('intake.builder.formDescriptionPlaceholder')} rows={2} />
                </div>
                <div className="task-field">
                    <label className="section-label">{t('intake.builder.submitLabel')}</label>
                    <TextInput value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} placeholder={t('intake.builder.submitLabelPlaceholder')} />
                </div>
                <div className="task-field">
                    <label className="section-label">{t('intake.builder.successMessage')}</label>
                    <TextInput value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} placeholder={t('intake.builder.successMessagePlaceholder')} />
                </div>

                <div className="feedback-builder__inspector-divider" />

                <Toggle checked={autoCreateTask} label={t('intake.builder.autoCreateTask')} onChange={setAutoCreateTask} />
                <p className="pib-inspector__hint">{t('intake.builder.autoCreateTaskHint')}</p>
                <Toggle checked={allowAttachments} label={t('intake.builder.allowAttachments')} onChange={setAllowAttachments} />
                {allowAttachments && (
                    <div className="task-field">
                        <label className="section-label">{t('intake.builder.maxAttachments')}</label>
                        <TextInput type="number" min={1} max={6} value={String(maxAttachments)}
                            onChange={(e) => setMaxAttachments(Math.min(6, Math.max(1, Number(e.target.value) || 1)))} />
                    </div>
                )}

                {shareUrl && (
                    <>
                        <div className="feedback-builder__inspector-divider" />
                        <div className="task-field">
                            <label className="section-label">{t('intake.inbox.shareLink')}</label>
                            <div className="pib-inspector__share">
                                <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
                                <Button variant="secondary" size="sm" type="button" onClick={handleCopyLink}>
                                    {copied ? t('common.copied') : t('common.copy')}
                                </Button>
                            </div>
                            <button type="button" className="pib-inspector__regen" onClick={() => persist(true)} disabled={saving}>
                                <span className="material-symbols-outlined">autorenew</span>
                                {t('intake.builder.regenerate')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    const renderInspectorTabs = () => (
        <div className="pib-inspector__tabs">
            <button type="button" className={inspectorTab === 'category' ? 'is-active' : ''} onClick={() => setInspectorTab('category')}>
                {t('intake.builder.tabCategory')}
            </button>
            <button type="button" className={inspectorTab === 'form' ? 'is-active' : ''} onClick={() => setInspectorTab('form')}>
                {t('intake.builder.tabForm')}
            </button>
        </div>
    );

    const renderInspector = () => {
        if (selectedField) return renderFieldEditor(selectedField);
        if (inspectorTab === 'form') return renderFormSettings();
        return renderCategorySettings();
    };

    return createPortal(
        <div className="modal-overlay modal-overlay--open task-modal center-aligned initiative-modal" onClick={onClose}>
            <div className="modal-content initiative-feedback-modal" onClick={(e) => e.stopPropagation()}>
                <form className="task-create-form initiative-feedback-builder" onSubmit={(e) => { e.preventDefault(); void persist(false); }}>
                    <div className="feedback-builder__topbar">
                        <div className="pib-topbar__title">
                            <span className="material-symbols-outlined">inbox</span>
                            {t('intake.builder.title')}
                        </div>
                        <div className="feedback-builder__topbar-actions">
                            <Toggle checked={enabled} label={t('intake.builder.publish')} onChange={setEnabled} />
                            <div className="feedback-builder__topbar-divider" />
                            <Button variant="secondary" size="md" type="button" onClick={onClose} disabled={saving}>
                                {t('common.cancel')}
                            </Button>
                            <Button variant="primary" size="md" type="submit" isLoading={saving}>
                                {t('common.saveChanges')}
                            </Button>
                        </div>
                    </div>

                    <div className="initiative-feedback-builder__body">
                        <section className="feedback-builder__main">
                            {renderCanvas()}
                            <div className="feedback-builder__inspector-pane">
                                {renderInspector()}
                            </div>
                        </section>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
};
