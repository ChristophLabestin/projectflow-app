import React from 'react';
import { TaskDependencySelector } from './TaskDependencySelector';
import { useLanguage } from '../context/LanguageContext';

interface TaskDependenciesCardProps {
    projectId: string;
    currentTaskId: string;
    dependencies: string[];
    onUpdate: (ids: string[]) => void;
}

export const TaskDependenciesCard: React.FC<TaskDependenciesCardProps> = ({
    projectId,
    currentTaskId,
    dependencies,
    onUpdate
}) => {
    const { t } = useLanguage();

    return (
        <div className="app-card task-dependencies-card">
            <div className="task-dependencies-card__header">
                <span className="task-dependencies-card__title">{t('taskDetail.dependencies.title')}</span>
                <span className="material-symbols-outlined task-dependencies-card__icon">link</span>
            </div>

            <div className="task-dependencies-card__body">
                <TaskDependencySelector
                    projectId={projectId}
                    currentTaskId={currentTaskId}
                    selectedDependencyIds={dependencies}
                    onChange={onUpdate}
                />
            </div>
        </div>
    );
};
