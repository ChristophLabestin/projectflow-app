import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Initiative, Project, Task } from '../types';
import { Button } from '../components/common/Button/Button';
import { Badge } from '../components/common/Badge/Badge';
import { TextInput } from '../components/common/Input/TextInput';
import { Select, type SelectOption } from '../components/common/Select/Select';
import { InitiativeCreateModal } from '../components/InitiativeCreateModal';
import { getProjectById } from '../services/domain/projectsService';
import { subscribeProjectInitiatives, subscribeProjectTasks } from '../services/dataService';
import { calculateInitiativeHealth } from '../services/healthService';
import { useLanguage } from '../context/LanguageContext';
import { useProjectPermissions } from '../hooks/useProjectPermissions';

export const ProjectInitiatives = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (title: string | null) => void }>();
    const { t, dateFormat, dateLocale } = useLanguage();
    const [project, setProject] = useState<Project | null>(null);
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [view, setView] = useState<'grid' | 'list'>('grid');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { can, hasPermission } = useProjectPermissions(project);
    const canCreateInitiatives = can('canManageTasks') || hasPermission('project.initiatives.create');

    useEffect(() => {
        setTaskTitle(t('nav.initiatives'));
        return () => setTaskTitle(null);
    }, [setTaskTitle, t]);

    useEffect(() => {
        if (!id) return;

        let unsubInitiatives = () => undefined;
        let unsubTasks = () => undefined;

        void getProjectById(id).then((nextProject) => {
            setProject(nextProject);
            if (!nextProject) {
                setLoading(false);
                return;
            }

            unsubInitiatives = subscribeProjectInitiatives(id, (items) => {
                setInitiatives(items);
                setLoading(false);
            }, nextProject.tenantId);

            unsubTasks = subscribeProjectTasks(id, setTasks, nextProject.tenantId);
        }).catch((error) => {
            console.error('Failed to load initiatives project', error);
            setLoading(false);
        });

        return () => {
            unsubInitiatives();
            unsubTasks();
        };
    }, [id]);

    const statusOptions = useMemo<SelectOption[]>(() => ([
        { value: 'all', label: t('initiatives.filters.allStatuses') },
        { value: 'Planning', label: t('initiatives.status.planning') },
        { value: 'Open', label: t('initiatives.status.open') },
        { value: 'In Progress', label: t('initiatives.status.inProgress') },
        { value: 'Review', label: t('initiatives.status.review') },
        { value: 'On Hold', label: t('initiatives.status.onHold') },
        { value: 'Blocked', label: t('initiatives.status.blocked') },
        { value: 'Done', label: t('initiatives.status.done') }
    ]), [t]);

    const initiativeStats = useMemo(() => {
        return initiatives.reduce<Record<string, { total: number; completed: number; blocked: number }>>((acc, initiative) => {
            const linkedTasks = tasks.filter((task) => task.initiativeId === initiative.id);
            acc[initiative.id] = {
                total: linkedTasks.length,
                completed: linkedTasks.filter((task) => task.isCompleted || task.status === 'Done').length,
                blocked: linkedTasks.filter((task) => task.status === 'Blocked').length
            };
            return acc;
        }, {});
    }, [initiatives, tasks]);

    const initiativeHealthMap = useMemo(() => {
        return initiatives.reduce<Record<string, ReturnType<typeof calculateInitiativeHealth>>>((acc, initiative) => {
            const linkedTasks = tasks.filter((task) => task.initiativeId === initiative.id);
            acc[initiative.id] = calculateInitiativeHealth(initiative, linkedTasks);
            return acc;
        }, {});
    }, [initiatives, tasks]);

    const filteredInitiatives = useMemo(() => {
        return initiatives.filter((initiative) => {
            if (statusFilter !== 'all' && initiative.status !== statusFilter) {
                return false;
            }
            if (!search.trim()) {
                return true;
            }

            const query = search.toLowerCase();
            return initiative.title.toLowerCase().includes(query)
                || (initiative.description || '').toLowerCase().includes(query)
                || (initiative.successMetric || '').toLowerCase().includes(query);
        });
    }, [initiatives, search, statusFilter]);

    if (loading) {
        return (
            <div className="project-initiatives__loading">
                <span className="material-symbols-outlined project-initiatives__loading-icon">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="project-initiatives">
            <header className="project-initiatives__header">
                <div>
                    <h1 className="project-initiatives__title">{t('initiatives.list.title')}</h1>
                    <p className="project-initiatives__subtitle">
                        {project?.title
                            ? t('initiatives.list.subtitleWithProject').replace('{project}', project.title)
                            : t('initiatives.list.subtitle')}
                    </p>
                </div>
                {canCreateInitiatives && id && (
                    <Button
                        variant="primary"
                        size="icon"
                        onClick={() => setShowCreateModal(true)}
                        icon={<span className="material-symbols-outlined">add</span>}
                        aria-label={t('initiatives.create.action')}
                        title={t('initiatives.create.action')}
                    />
                )}
            </header>

            <div className="project-initiatives__toolbar">
                <TextInput
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('initiatives.filters.search')}
                    leftElement={<span className="material-symbols-outlined">search</span>}
                    className="project-initiatives__search"
                />
                <Select
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(String(value))}
                    options={statusOptions}
                    className="project-initiatives__status-filter"
                />
                <div className="project-initiatives__view-toggle" role="group" aria-label={t('initiatives.view.label')}>
                    {(['grid', 'list'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            className={`project-initiatives__view-btn ${view === mode ? 'is-active' : ''}`}
                            onClick={() => setView(mode)}
                            aria-pressed={view === mode}
                            title={mode === 'grid' ? t('initiatives.view.grid') : t('initiatives.view.list')}
                            aria-label={mode === 'grid' ? t('initiatives.view.grid') : t('initiatives.view.list')}
                        >
                            <span className="material-symbols-outlined">{mode === 'grid' ? 'grid_view' : 'view_list'}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="project-initiatives__summary">
                <div className="project-initiatives__summary-card">
                    <span className="project-initiatives__summary-label">{t('initiatives.summary.total')}</span>
                    <span className="project-initiatives__summary-value">{initiatives.length}</span>
                </div>
                <div className="project-initiatives__summary-card">
                    <span className="project-initiatives__summary-label">{t('initiatives.summary.active')}</span>
                    <span className="project-initiatives__summary-value">
                        {initiatives.filter((initiative) => !['Done'].includes(initiative.status)).length}
                    </span>
                </div>
                <div className="project-initiatives__summary-card">
                    <span className="project-initiatives__summary-label">{t('initiatives.summary.atRisk')}</span>
                        <span className="project-initiatives__summary-value">
                        {initiatives.filter((initiative) => {
                            const health = initiativeHealthMap[initiative.id];
                            return health?.status === 'At Risk' || health?.status === 'Off Track';
                        }).length}
                    </span>
                </div>
            </div>

            {filteredInitiatives.length === 0 ? (
                <div className="project-initiatives__empty">
                    <span className="material-symbols-outlined project-initiatives__empty-icon">rocket_launch</span>
                    <h2>{t('initiatives.empty.title')}</h2>
                    <p>{t('initiatives.empty.description')}</p>
                </div>
            ) : (
                <div className={`project-initiatives__grid ${view === 'list' ? 'is-list' : ''}`}>
                    {filteredInitiatives.map((initiative) => {
                        const stats = initiativeStats[initiative.id] || { total: 0, completed: 0, blocked: 0 };
                        const health = initiativeHealthMap[initiative.id];
                        const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                        return (
                            <button
                                key={initiative.id}
                                type="button"
                                className={`project-initiatives__card ${view === 'list' ? 'is-row' : ''}`}
                                onClick={() => navigate(`/project/${id}/initiatives/${initiative.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                            >
                                <div className="project-initiatives__card-header">
                                    <div>
                                        <h2 className="project-initiatives__card-title">{initiative.title}</h2>
                                        <p className="project-initiatives__card-description">
                                            {initiative.description || t('initiatives.empty.description')}
                                        </p>
                                    </div>
                                    <span className="material-symbols-outlined project-initiatives__card-icon">rocket_launch</span>
                                </div>
                                <div className="project-initiatives__badges">
                                    <Badge variant="neutral">{initiative.status}</Badge>
                                    {health && <Badge variant="neutral">{health.status}</Badge>}
                                    {initiative.priority && <Badge variant="neutral">{initiative.priority}</Badge>}
                                </div>
                                <div className="project-initiatives__metrics">
                                    <div className="project-initiatives__metric">
                                        <span className="project-initiatives__metric-label">{t('initiatives.summary.workItems')}</span>
                                        <span className="project-initiatives__metric-value">{stats.completed}/{stats.total}</span>
                                    </div>
                                    <div className="project-initiatives__metric">
                                        <span className="project-initiatives__metric-label">{t('initiatives.summary.blocked')}</span>
                                        <span className="project-initiatives__metric-value">{stats.blocked}</span>
                                    </div>
                                    <div className="project-initiatives__metric">
                                        <span className="project-initiatives__metric-label">{t('initiatives.summary.progress')}</span>
                                        <span className="project-initiatives__metric-value">{progress}%</span>
                                    </div>
                                </div>
                                <div className="project-initiatives__dates">
                                    {initiative.startDate && (
                                        <span>
                                            {t('initiatives.fields.startDate')}: {format(new Date(initiative.startDate), dateFormat, { locale: dateLocale })}
                                        </span>
                                    )}
                                    {initiative.dueDate && (
                                        <span>
                                            {t('initiatives.fields.dueDate')}: {format(new Date(initiative.dueDate), dateFormat, { locale: dateLocale })}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {showCreateModal && id && (
                <InitiativeCreateModal
                    isOpen={showCreateModal}
                    projectId={id}
                    tenantId={project?.tenantId}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={(initiativeId) => {
                        setShowCreateModal(false);
                        navigate(`/project/${id}/initiatives/${initiativeId}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`);
                    }}
                />
            )}
        </div>
    );
};
