import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { subscribeProjectTasks } from '../services/dataService';
import { TextInput } from './common/Input/TextInput';
import { useLanguage } from '../context/LanguageContext';

interface TaskDependencySelectorProps {
    projectId: string;
    currentTaskId?: string; // To exclude self
    selectedDependencyIds: string[];
    onChange: (ids: string[]) => void;
}

export const TaskDependencySelector: React.FC<TaskDependencySelectorProps> = ({
    projectId,
    currentTaskId,
    selectedDependencyIds,
    onChange
}) => {
    const { t } = useLanguage();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(true);
        // Subscribe to tasks to get the list for dependencies
        const unsubscribe = subscribeProjectTasks(projectId, (data) => {
            setTasks(data);
            setLoading(false);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [projectId]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter tasks: exclude current task, exclude already selected (logic handled in render), match search
    const filteredTasks = tasks.filter(t =>
        t.id !== currentTaskId &&
        t.title.toLowerCase().includes(search.toLowerCase()) &&
        !selectedDependencyIds.includes(t.id) &&
        !t.isCompleted // Optional: don't allow depend on completed tasks? Maybe allow it.
    );

    const toggleSelection = (taskId: string) => {
        if (selectedDependencyIds.includes(taskId)) {
            onChange(selectedDependencyIds.filter(id => id !== taskId));
        } else {
            onChange([...selectedDependencyIds, taskId]);
        }
        setSearch(''); // Reset search after selection? Maybe keep it.
    };

    const removeDependency = (taskId: string) => {
        onChange(selectedDependencyIds.filter(id => id !== taskId));
    };

    // Look up selected tasks to display their titles
    const selectedTasks = tasks.filter(t => selectedDependencyIds.includes(t.id));

    return (
        <div
            className="task-dependency-selector"
            ref={containerRef}
            data-open={isOpen ? 'true' : 'false'}
        >
            {selectedTasks.length > 0 && (
                <div className="task-dependency-selector__list">
                    {selectedTasks.map(task => (
                        <div key={task.id} className="task-dependency-selector__tag">
                            <span className="material-symbols-outlined task-dependency-selector__tag-icon">link</span>
                            <span className="task-dependency-selector__tag-text">{task.title}</span>
                            <button
                                type="button"
                                onClick={() => removeDependency(task.id)}
                                className="task-dependency-selector__tag-remove"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="task-dependency-selector__control">
                <TextInput
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={t('taskDetail.dependencies.searchPlaceholder')}
                    className="task-dependency-selector__input"
                    leftElement={<span className="material-symbols-outlined">add_link</span>}
                    rightElement={<span className="material-symbols-outlined task-dependency-selector__chevron">expand_more</span>}
                />
            </div>

            {isOpen && (
                <div className="task-dependency-selector__menu">
                    {loading && tasks.length === 0 ? (
                        <div className="task-dependency-selector__menu-empty">{t('taskDetail.dependencies.loading')}</div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="task-dependency-selector__menu-empty">
                            {search ? t('taskDetail.dependencies.emptyMatch') : t('taskDetail.dependencies.empty')}
                        </div>
                    ) : (
                        <div className="task-dependency-selector__menu-list">
                            {filteredTasks.map(task => (
                                <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => {
                                        toggleSelection(task.id);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className="task-dependency-selector__menu-item"
                                >
                                    <span className="task-dependency-selector__menu-dot" data-complete={task.isCompleted ? 'true' : 'false'} />
                                    <span className="task-dependency-selector__menu-text">{task.title}</span>
                                    {task.priority === 'Urgent' && (
                                        <span className="task-dependency-selector__menu-tag">{t('tasks.priority.urgent')}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
