import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Button } from './common/Button/Button';
import { TextInput } from './common/Input/TextInput';
import { TextArea } from './common/Input/TextArea';
import { DatePicker } from './common/DateTime/DatePicker';
import { Select, type SelectOption } from './common/Select/Select';
import type { Initiative, Task } from '../types';
import { useLanguage } from '../context/LanguageContext';

type InitiativeSettingsDraft = {
    title: string;
    description: string;
    status: Initiative['status'];
    priority: Task['priority'] | '';
    startDate: string;
    dueDate: string;
    successMetric: string;
    outcome: string;
};

interface InitiativeSettingsModalProps {
    isOpen: boolean;
    initiative: Initiative | null;
    onClose: () => void;
    onSave: (updates: Partial<Initiative>) => Promise<void>;
}

const buildDraft = (initiative: Initiative | null): InitiativeSettingsDraft => ({
    title: initiative?.title || '',
    description: initiative?.description || '',
    status: initiative?.status || 'Planning',
    priority: initiative?.priority || '',
    startDate: initiative?.startDate || '',
    dueDate: initiative?.dueDate || '',
    successMetric: initiative?.successMetric || '',
    outcome: initiative?.outcome || ''
});

export const InitiativeSettingsModal: React.FC<InitiativeSettingsModalProps> = ({
    isOpen,
    initiative,
    onClose,
    onSave
}) => {
    const { t } = useLanguage();
    const [draft, setDraft] = useState<InitiativeSettingsDraft>(() => buildDraft(initiative));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setDraft(buildDraft(initiative));
        setSaving(false);
        setError(null);
    }, [initiative, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !saving) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, saving]);

    const statusOptions = useMemo<SelectOption[]>(() => ([
        { value: 'Planning', label: t('initiatives.status.planning') },
        { value: 'Open', label: t('initiatives.status.open') },
        { value: 'In Progress', label: t('initiatives.status.inProgress') },
        { value: 'Review', label: t('initiatives.status.review') },
        { value: 'On Hold', label: t('initiatives.status.onHold') },
        { value: 'Blocked', label: t('initiatives.status.blocked') },
        { value: 'Done', label: t('initiatives.status.done') }
    ]), [t]);

    const priorityOptions = useMemo<SelectOption[]>(() => ([
        { value: 'Urgent', label: t('tasks.priority.urgent') },
        { value: 'High', label: t('tasks.priority.high') },
        { value: 'Medium', label: t('tasks.priority.medium') },
        { value: 'Low', label: t('tasks.priority.low') }
    ]), [t]);

    const hasInvalidDateRange = Boolean(draft.startDate && draft.dueDate && draft.startDate > draft.dueDate);

    if (!isOpen || !initiative) return null;

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    const handleSave = async () => {
        if (!draft.title.trim()) {
            setError(t('initiatives.create.validation.titleRequired'));
            return;
        }

        if (hasInvalidDateRange) {
            setError(t('initiatives.create.validation.dateRange'));
            return;
        }

        setSaving(true);
        setError(null);

        try {
            await onSave({
                title: draft.title.trim(),
                description: draft.description.trim(),
                status: draft.status,
                priority: draft.priority || undefined,
                startDate: draft.startDate,
                dueDate: draft.dueDate,
                successMetric: draft.successMetric.trim(),
                outcome: draft.outcome.trim()
            });
            onClose();
        } catch (saveError) {
            console.error('Failed to save initiative settings', saveError);
            setError(t('initiatives.detail.settingsSaveFailed'));
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div
            className="modal-overlay modal-overlay--open task-modal center-aligned initiative-modal"
            onClick={handleClose}
        >
            <div
                className="modal-content initiative-modal__content"
                onClick={(event) => event.stopPropagation()}
            >
                <form
                    className="task-create-form initiative-create initiative-settings"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void handleSave();
                    }}
                >
                    <div className="title-input-section initiative-settings__header">
                        <div className="initiative-settings__eyebrow">{t('initiatives.detail.settingsTitle')}</div>
                        <TextInput
                            value={draft.title}
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, title: event.target.value }));
                                if (error) setError(null);
                            }}
                            placeholder={t('initiatives.fields.titlePlaceholder')}
                            autoFocus
                            maxLength={120}
                            aria-label={t('initiatives.fields.title')}
                            className="task-create__title-input"
                        />
                    </div>

                    <div className="description-section">
                        <TextArea
                            value={draft.description}
                            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                            placeholder={t('initiatives.fields.descriptionPlaceholder')}
                            rows={4}
                            aria-label={t('initiatives.fields.description')}
                            className="task-create__description-input"
                        />
                    </div>

                    <div className="initiative-settings__toolbar-row">
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.status')}</label>
                            <Select
                                value={draft.status}
                                onChange={(value) => setDraft((current) => ({ ...current, status: String(value) as Initiative['status'] }))}
                                options={statusOptions}
                            />
                        </div>
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.priority')}</label>
                            <Select
                                value={draft.priority || null}
                                onChange={(value) => setDraft((current) => ({ ...current, priority: String(value) as Task['priority'] }))}
                                options={priorityOptions}
                                placeholder={t('projectDetails.notSet')}
                            />
                        </div>
                    </div>

                    <div className="fields-grid">
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.startDate')}</label>
                            <DatePicker
                                value={draft.startDate ? new Date(draft.startDate) : null}
                                onChange={(date) => {
                                    setDraft((current) => ({ ...current, startDate: date ? format(date, 'yyyy-MM-dd') : '' }));
                                    if (error) setError(null);
                                }}
                            />
                        </div>
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.dueDate')}</label>
                            <DatePicker
                                value={draft.dueDate ? new Date(draft.dueDate) : null}
                                onChange={(date) => {
                                    setDraft((current) => ({ ...current, dueDate: date ? format(date, 'yyyy-MM-dd') : '' }));
                                    if (error) setError(null);
                                }}
                            />
                        </div>
                    </div>

                    <div className="initiative-settings__content-grid">
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.successMetric')}</label>
                            <TextInput
                                value={draft.successMetric}
                                onChange={(event) => setDraft((current) => ({ ...current, successMetric: event.target.value }))}
                                placeholder={t('initiatives.fields.successMetricPlaceholder')}
                            />
                        </div>
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.outcome')}</label>
                            <TextArea
                                value={draft.outcome}
                                onChange={(event) => setDraft((current) => ({ ...current, outcome: event.target.value }))}
                                placeholder={t('initiatives.fields.outcomePlaceholder')}
                                rows={4}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="task-create-form__error" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="modal-footer initiative-create__footer">
                        <div className="actions">
                            <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving} type="button">
                                {t('common.cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => void handleSave()}
                                disabled={!draft.title.trim() || saving}
                                isLoading={saving}
                                type="button"
                            >
                                {t('common.saveChanges')}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
