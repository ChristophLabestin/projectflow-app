import { TASK_TITLE_MAX_LENGTH } from '../../../utils/taskLimits';
import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';

type ProjectOverviewTasksQuickAddProps = {
    disabled?: boolean;
    onSubmit: (title: string) => Promise<void>;
};

/** Inline "add a task" field; the submit button only appears once there is a title. */
export const ProjectOverviewTasksQuickAdd: React.FC<ProjectOverviewTasksQuickAddProps> = ({
    disabled = false,
    onSubmit
}) => {
    const { t } = useLanguage();
    const [title, setTitle] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const hasTitle = Boolean(title.trim());

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = title.trim();
        if (!trimmed || submitting || disabled) return;
        setSubmitting(true);
        try {
            await onSubmit(trimmed);
            setTitle('');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className={`po-quick-add ${hasTitle ? 'has-value' : ''}`.trim()} onSubmit={handleSubmit}>
            <span className="material-symbols-outlined po-quick-add__icon" aria-hidden="true">add</span>
            <input
                id="po-quick-add-input"
                className="po-quick-add__input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('projectOverview.workspace.quickAdd.placeholder')}
                disabled={submitting || disabled}
                maxLength={TASK_TITLE_MAX_LENGTH}
                aria-label={t('projectOverview.workspace.quickAdd.placeholder')}
            />
            {hasTitle && (
                <button type="submit" className="po-quick-add__submit" disabled={submitting || disabled}>
                    {t('projectOverview.workspace.quickAdd.action')}
                    <kbd>↵</kbd>
                </button>
            )}
        </form>
    );
};
