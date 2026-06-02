import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Initiative, Project, Task } from '../types';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';
import { Select, type SelectOption } from '../components/common/Select/Select';
import { InitiativeCreateModal } from '../components/InitiativeCreateModal';
import { getProjectById } from '../services/domain/projectsService';
import { subscribeProjectInitiatives, subscribeProjectTasks } from '../services/dataService';
import { calculateInitiativeHealth } from '../services/healthService';
import { useLanguage } from '../context/LanguageContext';
import { useProjectPermissions } from '../hooks/useProjectPermissions';

const healthToneClass = (status?: string) => {
    if (status === 'On Track') return 'is-on-track';
    if (status === 'At Risk') return 'is-at-risk';
    if (status === 'Off Track') return 'is-off-track';
    return 'is-neutral';
};

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

    const activeCount = initiatives.filter((initiative) => !['Done'].includes(initiative.status)).length;
    const atRiskCount = initiatives.filter((initiative) => {
        const health = initiativeHealthMap[initiative.id];
        return health?.status === 'At Risk' || health?.status === 'Off Track';
    }).length;

    if (loading) {
        return (
            <div className="workstream-page workstream-page--initiatives">
                <div className="workstream-page__loading">
                    <span className="material-symbols-outlined workstream-page__loading-icon">progress_activity</span>
                </div>
            </div>
        );
    }

    return (
        <div className="workstream-page workstream-page--initiatives">
            <header className="workstream-page__hero">
                <div className="workstream-page__hero-copy">
                    <h1 className="workstream-page__title">{t('initiatives.list.title')}</h1>
                    <p className="workstream-page__subtitle">
                        {project?.title
                            ? t('initiatives.list.subtitleWithProject').replace('{project}', project.title)
                            : t('initiatives.list.subtitle')}
                    </p>
                </div>
                {canCreateInitiatives && id && (
                    <div className="workstream-page__actions">
                        <Button
                            variant="primary"
                            onClick={() => setShowCreateModal(true)}
                            icon={<span className="material-symbols-outlined">add</span>}
                        >
                            {t('initiatives.create.action')}
                        </Button>
                    </div>
                )}
            </header>

            <div className="workstream-page__metrics">
                <div className="workstream-page__metric">
                    <span className="workstream-page__metric-label">{t('initiatives.summary.total')}</span>
                    <span className="workstream-page__metric-value">{initiatives.length}</span>
                    <span className="workstream-page__metric-meta">{t('initiatives.list.metricTotalMeta')}</span>
                </div>
                <div className="workstream-page__metric">
                    <span className="workstream-page__metric-label">{t('initiatives.summary.active')}</span>
                    <span className="workstream-page__metric-value">{activeCount}</span>
                    <span className="workstream-page__metric-meta">{t('initiatives.list.metricActiveMeta')}</span>
                </div>
                <div className="workstream-page__metric">
                    <span className="workstream-page__metric-label">{t('initiatives.summary.atRisk')}</span>
                    <span className="workstream-page__metric-value">{atRiskCount}</span>
                    <span className="workstream-page__metric-meta">{t('initiatives.list.metricRiskMeta')}</span>
                </div>
                <div className="workstream-page__metric">
                    <span className="workstream-page__metric-label">{t('initiatives.summary.workItems')}</span>
                    <span className="workstream-page__metric-value">
                        {tasks.filter((task) => Boolean(task.initiativeId)).length}
                    </span>
                    <span className="workstream-page__metric-meta">{t('initiatives.list.metricWorkMeta')}</span>
                </div>
            </div>

            <div className="workstream-page__command">
                <div className="workstream-page__command-left">
                    <TextInput
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('initiatives.filters.search')}
                        leftElement={<span className="material-symbols-outlined">search</span>}
                        className="workstream-page__search"
                    />
                    <Select
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(String(value))}
                        options={statusOptions}
                        className="workstream-page__select"
                    />
                </div>
                <div className="workstream-page__command-right">
                    <div className="workstream-page__view-toggle" role="group" aria-label={t('initiatives.view.label')}>
                        {(['grid', 'list'] as const).map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                className={`workstream-page__view-btn ${view === mode ? 'is-active' : ''}`}
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
            </div>

            <div className="workstream-page__body">
                {filteredInitiatives.length === 0 ? (
                    <div className="workstream-page__empty">
                        <span className="material-symbols-outlined workstream-page__empty-icon">rocket_launch</span>
                        <h2>{t('initiatives.empty.title')}</h2>
                        <p>{t('initiatives.empty.description')}</p>
                        {canCreateInitiatives && id && (
                            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                                {t('initiatives.create.action')}
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className={`workstream-page__catalog ${view === 'list' ? 'is-list' : ''}`}>
                        {filteredInitiatives.map((initiative) => {
                            const stats = initiativeStats[initiative.id] || { total: 0, completed: 0, blocked: 0 };
                            const health = initiativeHealthMap[initiative.id];
                            const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                            const healthClass = healthToneClass(health?.status);
                            const ringCircumference = 2 * Math.PI * 15.5;
                            const ringDash = (progress / 100) * ringCircumference;

                            return (
                                <button
                                    key={initiative.id}
                                    type="button"
                                    className={`workstream-initiative-card ${view === 'list' ? 'is-row' : ''}`}
                                    onClick={() => navigate(`/project/${id}/initiatives/${initiative.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                                >
                                    <div className="workstream-initiative-card__main">
                                        <div className="workstream-initiative-card__head">
                                            <div className="workstream-initiative-card__title-block">
                                                <span className="workstream-initiative-card__status">{initiative.status}</span>
                                                <h2 className="workstream-initiative-card__title">{initiative.title}</h2>
                                                <p className="workstream-initiative-card__description">
                                                    {initiative.description || t('initiatives.empty.description')}
                                                </p>
                                            </div>
                                            <div className="workstream-initiative-card__progress-ring" aria-hidden="true">
                                                <svg viewBox="0 0 36 36">
                                                    <circle className="workstream-initiative-card__progress-track" cx="18" cy="18" r="15.5" />
                                                    <circle
                                                        className="workstream-initiative-card__progress-fill"
                                                        cx="18"
                                                        cy="18"
                                                        r="15.5"
                                                        strokeDasharray={`${ringDash} ${ringCircumference}`}
                                                    />
                                                </svg>
                                                <span className="workstream-initiative-card__progress-value">{progress}%</span>
                                            </div>
                                        </div>

                                        <div className="workstream-initiative-card__meta">
                                            {health && (
                                                <span className={`workstream-initiative-card__health ${healthClass}`}>
                                                    <span className="material-symbols-outlined">monitoring</span>
                                                    {health.status}
                                                </span>
                                            )}
                                            {initiative.priority && (
                                                <span className="workstream-initiative-card__pill">{initiative.priority}</span>
                                            )}
                                            {initiative.successMetric && (
                                                <span className="workstream-initiative-card__pill workstream-initiative-card__pill--muted">
                                                    <span className="material-symbols-outlined">flag</span>
                                                    {initiative.successMetric}
                                                </span>
                                            )}
                                        </div>

                                        {(initiative.startDate || initiative.dueDate) && (
                                            <div className="workstream-initiative-card__dates">
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
                                        )}

                                        <div className="workstream-initiative-card__stats">
                                            <div className="workstream-initiative-card__stat">
                                                <span className="workstream-initiative-card__stat-label">{t('initiatives.summary.workItems')}</span>
                                                <span className="workstream-initiative-card__stat-value">{stats.completed}/{stats.total}</span>
                                            </div>
                                            <div className="workstream-initiative-card__stat">
                                                <span className="workstream-initiative-card__stat-label">{t('initiatives.summary.blocked')}</span>
                                                <span className="workstream-initiative-card__stat-value">{stats.blocked}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <span className="material-symbols-outlined workstream-initiative-card__chevron">arrow_forward</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

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
