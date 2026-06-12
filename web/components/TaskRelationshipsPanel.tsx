import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../src/styles/components/_task-relationships.scss';
import { Task } from '../types';
import { subscribeProjectTasks, updateTaskFields } from '../services/domain/tasksService';
import { TextInput } from './common/Input/TextInput';
import { Button } from './common/Button/Button';
import { useLanguage } from '../context/LanguageContext';

type RelationshipMode = 'blockedBy' | 'blocking' | 'parent' | 'children';

interface RelationshipConfig {
    icon: string;
    titleKey: string;
    emptyKey: string;
    searchKey: string;
}

interface TaskRelationshipsPanelProps {
    projectId: string;
    task: Task;
    tenantId?: string;
    onTaskChange: (updates: Partial<Task>) => void;
}

const RELATIONSHIPS: Record<RelationshipMode, RelationshipConfig> = {
    blockedBy: {
        icon: 'block',
        titleKey: 'taskDetail.relationships.blockedBy',
        emptyKey: 'taskDetail.relationships.blockedByEmpty',
        searchKey: 'taskDetail.relationships.blockedBySearch',
    },
    blocking: {
        icon: 'lock',
        titleKey: 'taskDetail.relationships.blocking',
        emptyKey: 'taskDetail.relationships.blockingEmpty',
        searchKey: 'taskDetail.relationships.blockingSearch',
    },
    parent: {
        icon: 'account_tree',
        titleKey: 'taskDetail.relationships.parent',
        emptyKey: 'taskDetail.relationships.parentEmpty',
        searchKey: 'taskDetail.relationships.parentSearch',
    },
    children: {
        icon: 'subdirectory_arrow_right',
        titleKey: 'taskDetail.relationships.children',
        emptyKey: 'taskDetail.relationships.childrenEmpty',
        searchKey: 'taskDetail.relationships.childrenSearch',
    },
};

const normalizeIds = (ids?: string[]) => Array.from(new Set((ids || []).filter(Boolean)));

const getTaskStatus = (task: Task) => task.status || (task.isCompleted ? 'Done' : 'Open');

const shouldAutoUnblock = (task: Task, nextDependencies: string[]) => {
    return getTaskStatus(task) === 'Blocked' && nextDependencies.length === 0 && !task.blockerNote && !task.isCompleted;
};

const collectDescendantIds = (taskId: string, tasks: Task[]) => {
    const childrenByParent = new Map<string, string[]>();

    tasks.forEach((candidate) => {
        if (!candidate.parentTaskId) return;
        const children = childrenByParent.get(candidate.parentTaskId) || [];
        children.push(candidate.id);
        childrenByParent.set(candidate.parentTaskId, children);
    });

    const descendants = new Set<string>();
    const stack = [...(childrenByParent.get(taskId) || [])];

    while (stack.length > 0) {
        const childId = stack.pop();
        if (!childId || descendants.has(childId)) continue;
        descendants.add(childId);
        stack.push(...(childrenByParent.get(childId) || []));
    }

    return descendants;
};

export const TaskRelationshipsPanel: React.FC<TaskRelationshipsPanelProps> = ({
    projectId,
    task,
    tenantId,
    onTaskChange
}) => {
    const { t } = useLanguage();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeMode, setActiveMode] = useState<RelationshipMode | null>(null);
    const [search, setSearch] = useState('');
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeProjectTasks(projectId, (nextTasks) => {
            setTasks(nextTasks);
            setLoading(false);
        }, tenantId);

        return () => unsubscribe();
    }, [projectId, tenantId]);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (!panelRef.current?.contains(event.target as Node)) {
                setActiveMode(null);
                setSearch('');
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const taskById = useMemo(() => new Map(tasks.map((candidate) => [candidate.id, candidate])), [tasks]);
    const blockedByIds = normalizeIds(task.dependencies);
    const blockedByTasks = blockedByIds.map((id) => taskById.get(id)).filter(Boolean) as Task[];
    const blockingTasks = tasks.filter((candidate) => normalizeIds(candidate.dependencies).includes(task.id));
    const parentTask = task.parentTaskId ? taskById.get(task.parentTaskId) || null : null;
    const childTasks = tasks.filter((candidate) => candidate.parentTaskId === task.id);
    const descendantIds = useMemo(() => collectDescendantIds(task.id, tasks), [task.id, tasks]);
    const tenantQuery = tenantId ? `?tenant=${tenantId}` : '';

    const getSelectedTasks = (mode: RelationshipMode) => {
        if (mode === 'blockedBy') return blockedByTasks;
        if (mode === 'blocking') return blockingTasks;
        if (mode === 'parent') return parentTask ? [parentTask] : [];
        return childTasks;
    };

    const isEligible = (candidate: Task, mode: RelationshipMode) => {
        if (candidate.id === task.id) return false;
        if (candidate.isCompleted && (mode === 'blockedBy' || mode === 'blocking')) return false;

        if (mode === 'blockedBy') {
            return !blockedByIds.includes(candidate.id) && !normalizeIds(candidate.dependencies).includes(task.id);
        }

        if (mode === 'blocking') {
            return !normalizeIds(candidate.dependencies).includes(task.id) && !blockedByIds.includes(candidate.id);
        }

        if (mode === 'parent') {
            return candidate.id !== task.parentTaskId && !descendantIds.has(candidate.id);
        }

        return candidate.parentTaskId !== task.id && candidate.id !== task.parentTaskId && !descendantIds.has(candidate.id);
    };

    const candidates = useMemo(() => {
        if (!activeMode) return [];
        const query = search.trim().toLowerCase();

        return tasks
            .filter((candidate) => isEligible(candidate, activeMode))
            .filter((candidate) => !query || candidate.title.toLowerCase().includes(query))
            .slice(0, 8);
    }, [activeMode, blockedByIds, descendantIds, search, task.id, task.parentTaskId, tasks]);

    const updateLocalTask = (taskId: string, updates: Partial<Task>) => {
        setTasks((previous) => previous.map((candidate) => candidate.id === taskId ? { ...candidate, ...updates } : candidate));
        if (taskId === task.id) {
            onTaskChange(updates);
        }
    };

    const addBlockedBy = async (candidate: Task) => {
        const dependencies = normalizeIds([...blockedByIds, candidate.id]);
        const updates: Partial<Task> = {
            dependencies,
            status: 'Blocked',
            isCompleted: false,
        };
        setSavingKey(`blockedBy:${candidate.id}`);
        updateLocalTask(task.id, updates);
        try {
            await updateTaskFields(task.id, updates, projectId, tenantId);
        } finally {
            setSavingKey(null);
        }
    };

    const removeBlockedBy = async (candidateId: string) => {
        const dependencies = blockedByIds.filter((id) => id !== candidateId);
        const updates: Partial<Task> = { dependencies };
        if (shouldAutoUnblock(task, dependencies)) {
            updates.status = 'In Progress';
        }

        setSavingKey(`removeBlockedBy:${candidateId}`);
        updateLocalTask(task.id, updates);
        try {
            await updateTaskFields(task.id, updates, projectId, tenantId);
        } finally {
            setSavingKey(null);
        }
    };

    const addBlocking = async (candidate: Task) => {
        const dependencies = normalizeIds([...(candidate.dependencies || []), task.id]);
        const updates: Partial<Task> = {
            dependencies,
            status: 'Blocked',
            isCompleted: false,
        };
        setSavingKey(`blocking:${candidate.id}`);
        updateLocalTask(candidate.id, updates);
        try {
            await updateTaskFields(candidate.id, updates, projectId, tenantId);
        } finally {
            setSavingKey(null);
        }
    };

    const removeBlocking = async (candidate: Task) => {
        const dependencies = normalizeIds(candidate.dependencies).filter((id) => id !== task.id);
        const updates: Partial<Task> = { dependencies };
        if (shouldAutoUnblock(candidate, dependencies)) {
            updates.status = 'In Progress';
        }

        setSavingKey(`removeBlocking:${candidate.id}`);
        updateLocalTask(candidate.id, updates);
        try {
            await updateTaskFields(candidate.id, updates, projectId, tenantId);
        } finally {
            setSavingKey(null);
        }
    };

    const setParentTask = async (candidate: Task | null) => {
        const updates: Partial<Task> = { parentTaskId: candidate?.id || null as unknown as string };
        setSavingKey(candidate ? `parent:${candidate.id}` : 'parent:clear');
        updateLocalTask(task.id, candidate ? { parentTaskId: candidate.id } : { parentTaskId: undefined });
        try {
            await updateTaskFields(task.id, updates, projectId, tenantId);
        } finally {
            setSavingKey(null);
        }
    };

    const addChildTask = async (candidate: Task) => {
        const updates: Partial<Task> = { parentTaskId: task.id };
        setSavingKey(`child:${candidate.id}`);
        updateLocalTask(candidate.id, updates);
        try {
            await updateTaskFields(candidate.id, updates, projectId, tenantId);
        } finally {
            setSavingKey(null);
        }
    };

    const removeChildTask = async (candidate: Task) => {
        const updates: Partial<Task> = { parentTaskId: null as unknown as string };
        setSavingKey(`removeChild:${candidate.id}`);
        updateLocalTask(candidate.id, { parentTaskId: undefined });
        try {
            await updateTaskFields(candidate.id, updates, projectId, tenantId);
        } finally {
            setSavingKey(null);
        }
    };

    const handleSelect = async (candidate: Task) => {
        if (!activeMode) return;
        if (activeMode === 'blockedBy') await addBlockedBy(candidate);
        if (activeMode === 'blocking') await addBlocking(candidate);
        if (activeMode === 'parent') await setParentTask(candidate);
        if (activeMode === 'children') await addChildTask(candidate);
        setSearch('');
        setActiveMode(null);
    };

    const renderTaskRow = (relatedTask: Task, mode: RelationshipMode) => {
        const status = getTaskStatus(relatedTask);
        const saving =
            savingKey === `removeBlockedBy:${relatedTask.id}` ||
            savingKey === `removeBlocking:${relatedTask.id}` ||
            savingKey === `removeChild:${relatedTask.id}` ||
            savingKey === 'parent:clear';
        const remove = () => {
            if (mode === 'blockedBy') void removeBlockedBy(relatedTask.id);
            if (mode === 'blocking') void removeBlocking(relatedTask);
            if (mode === 'parent') void setParentTask(null);
            if (mode === 'children') void removeChildTask(relatedTask);
        };

        return (
            <div key={relatedTask.id} className="task-relationships__row">
                <Link to={`/project/${projectId}/tasks/${relatedTask.id}${tenantQuery}`} className="task-relationships__task-link">
                    <span className="task-relationships__task-title">{relatedTask.title}</span>
                    <span className="task-relationships__task-meta">
                        {status}
                        {relatedTask.priority ? ` · ${relatedTask.priority}` : ''}
                    </span>
                </Link>
                <button
                    type="button"
                    className="task-relationships__remove"
                    onClick={remove}
                    disabled={saving}
                    aria-label={t('taskDetail.relationships.unlink')}
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
        );
    };

    const renderSection = (mode: RelationshipMode) => {
        const config = RELATIONSHIPS[mode];
        const selected = getSelectedTasks(mode);
        const isOpen = activeMode === mode;

        return (
            <section className="task-relationships__section">
                <div className="task-relationships__section-head">
                    <span className="task-relationships__section-title">
                        <span className="material-symbols-outlined">{config.icon}</span>
                        {t(config.titleKey)}
                    </span>
                    <button
                        type="button"
                        className="task-relationships__add"
                        onClick={() => {
                            setActiveMode(isOpen ? null : mode);
                            setSearch('');
                        }}
                        aria-label={t('taskDetail.relationships.add')}
                    >
                        <span className="material-symbols-outlined">{isOpen ? 'remove' : 'add'}</span>
                    </button>
                </div>

                {selected.length > 0 ? (
                    <div className="task-relationships__rows">
                        {selected.map((relatedTask) => renderTaskRow(relatedTask, mode))}
                    </div>
                ) : (
                    <p className="task-relationships__empty">{t(config.emptyKey)}</p>
                )}

                {isOpen && (
                    <div className="task-relationships__picker">
                        <TextInput
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t(config.searchKey)}
                            leftElement={<span className="material-symbols-outlined">search</span>}
                            autoFocus
                        />
                        <div className="task-relationships__results">
                            {loading ? (
                                <p className="task-relationships__empty">{t('taskDetail.relationships.loading')}</p>
                            ) : candidates.length === 0 ? (
                                <p className="task-relationships__empty">{t('taskDetail.relationships.noMatches')}</p>
                            ) : (
                                candidates.map((candidate) => (
                                    <button
                                        key={candidate.id}
                                        type="button"
                                        className="task-relationships__result"
                                        onClick={() => void handleSelect(candidate)}
                                        disabled={Boolean(savingKey)}
                                    >
                                        <span className="task-relationships__result-main">
                                            <span className="task-relationships__task-title">{candidate.title}</span>
                                            <span className="task-relationships__task-meta">
                                                {getTaskStatus(candidate)}
                                                {candidate.priority ? ` · ${candidate.priority}` : ''}
                                            </span>
                                        </span>
                                        <span className="material-symbols-outlined">add_link</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </section>
        );
    };

    return (
        <div className="task-relationships" ref={panelRef}>
            <div className="task-relationships__header">
                <span className="task-detail__sidebar-label">{t('taskDetail.relationships.title')}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="task-relationships__link-button"
                    onClick={() => setActiveMode(activeMode ? null : 'blockedBy')}
                    icon={<span className="material-symbols-outlined">hub</span>}
                >
                    {t('taskDetail.relationships.linkTask')}
                </Button>
            </div>
            <div className="task-relationships__body">
                {renderSection('blockedBy')}
                {renderSection('blocking')}
                {renderSection('parent')}
                {renderSection('children')}
            </div>
        </div>
    );
};
