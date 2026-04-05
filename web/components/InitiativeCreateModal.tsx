import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Button } from './common/Button/Button';
import { TextInput } from './common/Input/TextInput';
import { TextArea } from './common/Input/TextArea';
import { DatePicker } from './common/DateTime/DatePicker';
import { Select, type SelectOption } from './common/Select/Select';
import { createInitiative } from '../services/domain/initiativesService';
import type { Initiative, Task } from '../types';
import { useLanguage } from '../context/LanguageContext';

type InitiativeFormState = Partial<Pick<
    Initiative,
    'description' | 'status' | 'priority' | 'startDate' | 'dueDate'
>>;

export interface InitiativeCreateModalProps {
    isOpen: boolean;
    projectId: string;
    tenantId?: string;
    onClose: () => void;
    onCreated?: (initiativeId: string) => void;
}

const INITIAL_FORM: InitiativeFormState = {
    description: '',
    status: 'Planning',
    priority: 'Medium',
    startDate: '',
    dueDate: ''
};

export const InitiativeCreateModal: React.FC<InitiativeCreateModalProps> = ({
    isOpen,
    projectId,
    tenantId,
    onClose,
    onCreated
}) => {
    const { t } = useLanguage();
    const [title, setTitle] = useState('');
    const [form, setForm] = useState<InitiativeFormState>(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    const resetState = () => {
        setTitle('');
        setForm(INITIAL_FORM);
        setSaving(false);
        setError(null);
    };

    const handleClose = () => {
        if (saving) return;
        resetState();
        onClose();
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };

        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, saving]);

    const hasInvalidDateRange = Boolean(
        form.startDate &&
        form.dueDate &&
        form.startDate > form.dueDate
    );

    const validateForm = () => {
        if (!title.trim()) {
            setError(t('initiatives.create.validation.titleRequired'));
            return false;
        }

        if (hasInvalidDateRange) {
            setError(t('initiatives.create.validation.dateRange'));
            return false;
        }

        setError(null);
        return true;
    };

    const handleCreate = async () => {
        if (!validateForm()) return;

        setSaving(true);
        try {
            const initiativeId = await createInitiative(
                projectId,
                title.trim(),
                {
                    description: form.description,
                    status: form.status as Initiative['status'],
                    priority: form.priority as Task['priority'],
                    startDate: form.startDate,
                    dueDate: form.dueDate
                },
                tenantId
            );
            onCreated?.(initiativeId);
            handleClose();
        } catch (createError) {
            console.error('Failed to create initiative', createError);
            setError(t('initiatives.create.validation.createFailed'));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

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
                    className="task-create-form initiative-create"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void handleCreate();
                    }}
                >
                    <div className="title-input-section">
                        <TextInput
                            value={title}
                            onChange={(event) => {
                                setTitle(event.target.value);
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
                            value={form.description || ''}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            placeholder={t('initiatives.fields.descriptionPlaceholder')}
                            rows={4}
                            aria-label={t('initiatives.fields.description')}
                            className="task-create__description-input"
                        />
                    </div>

                    <div className="initiative-create__toolbar-row">
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.status')}</label>
                            <Select
                                value={form.status || 'Planning'}
                                onChange={(value) => setForm((current) => ({ ...current, status: String(value) as Initiative['status'] }))}
                                options={statusOptions}
                            />
                        </div>
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.priority')}</label>
                            <Select
                                value={form.priority || 'Medium'}
                                onChange={(value) => setForm((current) => ({ ...current, priority: String(value) as Task['priority'] }))}
                                options={priorityOptions}
                            />
                        </div>
                    </div>

                    <div className="fields-grid">
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.startDate')}</label>
                            <DatePicker
                                value={form.startDate ? new Date(form.startDate) : null}
                                onChange={(date) => {
                                    setForm((current) => ({ ...current, startDate: date ? format(date, 'yyyy-MM-dd') : '' }));
                                    if (error) setError(null);
                                }}
                            />
                        </div>
                        <div className="task-field">
                            <label className="section-label">{t('initiatives.fields.dueDate')}</label>
                            <DatePicker
                                value={form.dueDate ? new Date(form.dueDate) : null}
                                onChange={(date) => {
                                    setForm((current) => ({ ...current, dueDate: date ? format(date, 'yyyy-MM-dd') : '' }));
                                    if (error) setError(null);
                                }}
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
                                onClick={() => void handleCreate()}
                                disabled={!title.trim() || saving}
                                isLoading={saving}
                                type="button"
                            >
                                {t('initiatives.create.action')}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
