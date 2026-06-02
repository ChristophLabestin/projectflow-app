import React, { useState } from 'react';
import { Button } from '../../common/Button/Button';
import { TextInput } from '../../common/Input/TextInput';
import { useLanguage } from '../../../context/LanguageContext';

type ProjectOverviewTasksQuickAddProps = {
    disabled?: boolean;
    onSubmit: (title: string) => Promise<void>;
};

export const ProjectOverviewTasksQuickAdd: React.FC<ProjectOverviewTasksQuickAddProps> = ({
    disabled = false,
    onSubmit
}) => {
    const { t } = useLanguage();
    const [title, setTitle] = useState('');
    const [submitting, setSubmitting] = useState(false);

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
        <form className="project-overview-tasks-quick-add" onSubmit={handleSubmit}>
            <TextInput
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('projectOverview.workspace.quickAdd.placeholder')}
                className="project-overview-tasks-quick-add__input"
                disabled={submitting || disabled}
                aria-label={t('projectOverview.workspace.quickAdd.placeholder')}
            />
            <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting || disabled || !title.trim()}
                icon={<span className="material-symbols-outlined">add_task</span>}
            >
                {t('projectOverview.workspace.quickAdd.action')}
            </Button>
        </form>
    );
};
