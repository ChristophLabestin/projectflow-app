import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Project } from '../types';
import { usePinnedProject } from '../context/PinnedProjectContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useUIState } from '../context/UIContext';
import { getUserProjects, getSharedProjects } from '../services/domain/projectsService';
import { isCompanyProject } from '../config/projectTemplates';
import logo from '../assets/logo.svg';

const RECENT_PROJECTS_STORAGE_PREFIX = 'projectflow.recentProjects';
const MAX_RECENT_PROJECTS = 100;

interface ProjectSwitcherProps {
    currentProjectId?: string;
    currentProjectTitle?: string;
    onClose?: () => void;
}

type RecentProjectAccess = Record<string, number>;

const getProjectTimestamp = (project: Project) => {
    const value = project.updatedAt || project.createdAt;
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return new Date(value).getTime() || 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return new Date(value).getTime() || 0;
};

const getRecentProjectsStorageKey = (userId?: string) => (
    `${RECENT_PROJECTS_STORAGE_PREFIX}.${userId || 'anonymous'}`
);

const readRecentProjectAccess = (userId?: string): RecentProjectAccess => {
    if (typeof window === 'undefined') return {};

    try {
        const stored = window.localStorage.getItem(getRecentProjectsStorageKey(userId));
        if (!stored) return {};
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed === 'object' ? parsed as RecentProjectAccess : {};
    } catch {
        return {};
    }
};

const writeRecentProjectAccess = (userId: string | undefined, access: RecentProjectAccess) => {
    if (typeof window === 'undefined') return;

    const compactAccess = Object.entries(access)
        .filter(([, timestamp]) => Number.isFinite(timestamp))
        .sort(([, timestampA], [, timestampB]) => timestampB - timestampA)
        .slice(0, MAX_RECENT_PROJECTS)
        .reduce<RecentProjectAccess>((next, [projectId, timestamp]) => {
            next[projectId] = timestamp;
            return next;
        }, {});

    try {
        window.localStorage.setItem(getRecentProjectsStorageKey(userId), JSON.stringify(compactAccess));
    } catch {
        // Recent access improves sorting only; ignore storage failures.
    }
};

export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ currentProjectId, currentProjectTitle, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
    const [recentProjectAccess, setRecentProjectAccess] = useState<RecentProjectAccess>(() => readRecentProjectAccess());
    const dropdownRef = useRef<HTMLDivElement>(null);
    const lastRecordedProjectIdRef = useRef<string | undefined>(undefined);
    const { pinProject, unpinProject, pinnedProjectId } = usePinnedProject();
    const { t } = useLanguage();
    const { isAuthReady, isAuthenticated, user } = useAuth();
    const { openProjectCreateModal } = useUIState();
    const trimmedSearchQuery = searchQuery.trim().toLowerCase();

    useEffect(() => {
        if (!isAuthReady) return;
        setRecentProjectAccess(readRecentProjectAccess(user?.uid));
    }, [isAuthReady, user?.uid]);

    // Fetch projects lazily so the sidebar does not duplicate workspace queries on first load.
    useEffect(() => {
        if (!isAuthReady || !isAuthenticated) {
            setProjects([]);
            setHasLoadedProjects(false);
            return;
        }

        if (!isOpen || hasLoadedProjects) return;

        const fetchProjects = async () => {
            setLoading(true);
            try {
                const [myProjects, sharedProjects] = await Promise.all([
                    getUserProjects(undefined, { includeScreenshots: false }),
                    getSharedProjects({ includeScreenshots: false })
                ]);
                const combined = [...myProjects, ...sharedProjects];
                const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());

                unique.sort((a, b) => {
                    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                    return dateB - dateA;
                });

                setProjects(unique);
                setHasLoadedProjects(true);
            } catch (error) {
                console.error("Failed to load projects", error);
            } finally {
                setLoading(false);
            }
        };
        void fetchProjects();
    }, [hasLoadedProjects, isAuthReady, isAuthenticated, isOpen]);

    const activeProject = projects.find(p => p.id === currentProjectId);
    const pinnedProject = projects.find(p => p.id === pinnedProjectId);
    const activeCompanyProject = activeProject?.companyProjectId
        ? projects.find(p => p.id === activeProject.companyProjectId)
        : null;

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const projectMatchesSearch = (project: Project, companyProject?: Project | null) => {
        if (!trimmedSearchQuery) return true;
        return project.title?.toLowerCase().includes(trimmedSearchQuery)
            || project.status?.toLowerCase().includes(trimmedSearchQuery)
            || companyProject?.title?.toLowerCase().includes(trimmedSearchQuery);
    };

    const companyProjects = useMemo(() => projects.filter(isCompanyProject), [projects]);
    const ordinaryProjects = useMemo(() => projects.filter(project => !isCompanyProject(project)), [projects]);
    const companyProjectMap = useMemo(() => new Map(companyProjects.map(project => [project.id, project])), [companyProjects]);
    const filteredOrdinaryProjects = ordinaryProjects.filter(project => {
        const companyProject = project.companyProjectId ? companyProjectMap.get(project.companyProjectId) : null;
        return projectMatchesSearch(project, companyProject);
    });
    const filteredCompanyProjects = companyProjects.filter(project =>
        projectMatchesSearch(project)
        || filteredOrdinaryProjects.some(child => child.companyProjectId === project.id)
    );
    const getProjectSortScore = (project: Project) => recentProjectAccess[project.id] || getProjectTimestamp(project);
    const sortProjectsByRecentAccess = (items: Project[]) => [...items].sort((projectA, projectB) => {
        const scoreDiff = getProjectSortScore(projectB) - getProjectSortScore(projectA);
        if (scoreDiff !== 0) return scoreDiff;
        return projectA.title.localeCompare(projectB.title);
    });
    const sortedCompanyProjects = sortProjectsByRecentAccess(filteredCompanyProjects);
    const sortedOrdinaryProjects = sortProjectsByRecentAccess(filteredOrdinaryProjects);
    const ungroupedProjects = sortedOrdinaryProjects.filter(project => !project.companyProjectId);
    const hasFilteredProjects = filteredCompanyProjects.length > 0 || ungroupedProjects.length > 0;
    const highlightedProjects = [activeProject, pinnedProject]
        .filter((project): project is Project => Boolean(project))
        .filter((project, index, list) => list.findIndex(item => item.id === project.id) === index)
        .filter(project => projectMatchesSearch(project, project.companyProjectId ? companyProjectMap.get(project.companyProjectId) : null));
    const isWorkspaceActive = !currentProjectId && location.pathname === '/';
    const projectCountLabel = t('projectSwitcher.projectsCount').replace('{count}', String(projects.length));

    const handleSwitch = (projectId: string) => {
        const nextRecentAccess = { ...recentProjectAccess, [projectId]: Date.now() };
        setRecentProjectAccess(nextRecentAccess);
        writeRecentProjectAccess(user?.uid, nextRecentAccess);
        lastRecordedProjectIdRef.current = projectId;
        navigate(`/project/${projectId}`);
        setIsOpen(false);
        if (onClose) onClose();
    };

    useEffect(() => {
        if (!currentProjectId || !isAuthReady || !isAuthenticated) return;
        if (lastRecordedProjectIdRef.current === currentProjectId) return;

        lastRecordedProjectIdRef.current = currentProjectId;
        setRecentProjectAccess((previousAccess) => {
            const nextRecentAccess = { ...previousAccess, [currentProjectId]: Date.now() };
            writeRecentProjectAccess(user?.uid, nextRecentAccess);
            return nextRecentAccess;
        });
    }, [currentProjectId, isAuthReady, isAuthenticated, user?.uid]);

    const handleWorkspaceClick = () => {
        navigate('/');
        setIsOpen(false);
        if (onClose) onClose();
    };

    const getProjectMeta = (project: Project, options: { companyTitle?: string } = {}) => {
        if (options.companyTitle) {
            return t('projectSwitcher.companyContext').replace('{company}', options.companyTitle);
        }

        if (isCompanyProject(project)) {
            return t('projectSwitcher.companyProject');
        }

        const isOwner = project.ownerId === user?.uid || project.roles?.[user?.uid || ''] === 'Owner';
        return isOwner ? t('projectSwitcher.role.owner') : t('projectSwitcher.role.member');
    };

    const renderProjectAvatar = (project: Project, size: 'sm' | 'md' = 'sm') => (
        <span className={`project-switcher__avatar project-switcher__avatar--${size} ${isCompanyProject(project) ? 'project-switcher__avatar--company' : ''}`}>
            {project.squareIcon ? (
                <img src={project.squareIcon} alt="" />
            ) : isCompanyProject(project) ? (
                <span className="material-symbols-outlined">domain</span>
            ) : (
                <span>{project.title ? project.title.substring(0, 1).toUpperCase() : 'P'}</span>
            )}
        </span>
    );

    const renderProjectRow = (p: Project, options: { nested?: boolean; companyTitle?: string; compact?: boolean } = {}) => (
        <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => handleSwitch(p.id)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSwitch(p.id);
                }
            }}
            className={[
                'project-switcher__row',
                options.nested ? 'project-switcher__row--nested' : '',
                options.compact ? 'project-switcher__row--compact' : '',
                currentProjectId === p.id ? 'is-active' : ''
            ].filter(Boolean).join(' ')}
            aria-current={currentProjectId === p.id ? 'page' : undefined}
        >
            {renderProjectAvatar(p)}
            <div className="project-switcher__row-copy">
                <span className="project-switcher__row-title">{p.title}</span>
                <span className="project-switcher__row-meta">{getProjectMeta(p, options)}</span>
            </div>
            {pinnedProjectId === p.id && (
                <span className="project-switcher__row-chip" aria-label={t('projectSwitcher.pinned')}>
                    <span className="material-symbols-outlined">push_pin</span>
                </span>
            )}
            {currentProjectId === p.id && (
                <span className="material-symbols-outlined project-switcher__row-check">check</span>
            )}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (pinnedProjectId === p.id) {
                        unpinProject();
                    } else {
                        pinProject(p.id);
                    }
                }}
                className={`project-switcher__pin ${pinnedProjectId === p.id ? 'is-pinned' : ''}`}
                title={pinnedProjectId === p.id ? t('projectSwitcher.unpinProject') : t('projectSwitcher.pinProject')}
                aria-label={pinnedProjectId === p.id ? t('projectSwitcher.unpinProject') : t('projectSwitcher.pinProject')}
            >
                <span className="material-symbols-outlined">{pinnedProjectId === p.id ? 'push_pin' : 'keep'}</span>
            </button>
        </div>
    );

    return (
        <div className="project-switcher" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`project-switcher__trigger ${isOpen ? 'is-open' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
            >
                <span className="project-switcher__trigger-main">
                    {activeProject ? (
                        renderProjectAvatar(activeProject, 'md')
                    ) : (
                        <span className="project-switcher__avatar project-switcher__avatar--md project-switcher__avatar--workspace">
                            <img src={logo} alt="" />
                        </span>
                    )}
                    <span className="project-switcher__trigger-copy">
                        <span className="project-switcher__scope">
                            {activeCompanyProject
                                ? t('projectSwitcher.scope.linkedProject')
                                : currentProjectId
                                    ? t('projectSwitcher.scope.project')
                                    : t('projectSwitcher.scope.workspace')}
                        </span>
                        <span className="project-switcher__title">
                            {currentProjectTitle || t('app.brand')}
                        </span>
                        {activeCompanyProject ? (
                            <span className="project-switcher__context">
                                {t('projectSwitcher.companyContext').replace('{company}', activeCompanyProject.title)}
                            </span>
                        ) : currentProjectId ? (
                            <span className="project-switcher__context">{projectCountLabel}</span>
                        ) : (
                            <span className="project-switcher__context">{t('nav.dashboard')}</span>
                        )}
                    </span>
                </span>
                <span className="material-symbols-outlined project-switcher__chevron">unfold_more</span>
            </button>

            {isOpen && (
                <div className="project-switcher__dropdown" role="dialog" aria-label={t('nav.projects')}>
                    <div className="project-switcher__panel">
                        <div className="project-switcher__search">
                            <div className="project-switcher__search-field">
                                <span className="material-symbols-outlined">search</span>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder={t('projectSwitcher.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="project-switcher__list">
                            <button
                                type="button"
                                onClick={handleWorkspaceClick}
                                className={`project-switcher__workspace ${isWorkspaceActive ? 'is-active' : ''}`}
                            >
                                <span className="project-switcher__avatar project-switcher__avatar--sm project-switcher__avatar--workspace">
                                    <span className="material-symbols-outlined">space_dashboard</span>
                                </span>
                                <span className="project-switcher__row-copy">
                                    <span className="project-switcher__row-title">{t('nav.dashboard')}</span>
                                    <span className="project-switcher__row-meta">{t('projectSwitcher.scope.workspace')}</span>
                                </span>
                                {isWorkspaceActive && (
                                    <span className="material-symbols-outlined project-switcher__row-check">check</span>
                                )}
                            </button>

                            {highlightedProjects.length > 0 && (
                                <section className="project-switcher__section">
                                    <div className="project-switcher__section-heading">
                                        <span>{t('projectSwitcher.quickAccess')}</span>
                                    </div>
                                    {highlightedProjects.map(project => renderProjectRow(project, { compact: true }))}
                                </section>
                            )}

                            <section className="project-switcher__section">
                                <div className="project-switcher__section-heading">
                                    <span>{t('nav.projects')}</span>
                                    <span>{projectCountLabel}</span>
                                </div>

                                {loading && !hasFilteredProjects ? (
                                <div className="project-switcher__state">
                                    <span className="material-symbols-outlined">sync</span>
                                    {t('projectSwitcher.loading')}
                                </div>
                                ) : hasFilteredProjects ? (
                                    <>
                                    {filteredCompanyProjects.length > 0 && (
                                        <div className="project-switcher__group">
                                            <div className="project-switcher__group-label">
                                                {t('projectSwitcher.companyProjects')}
                                            </div>
                                            {sortedCompanyProjects.map(companyProject => {
                                                const linkedProjects = sortedOrdinaryProjects.filter(project => project.companyProjectId === companyProject.id);
                                                return (
                                                    <div className="project-switcher__company-block" key={companyProject.id}>
                                                        {renderProjectRow(companyProject)}
                                                        {linkedProjects.map(project => renderProjectRow(project, { nested: true, companyTitle: companyProject.title }))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {ungroupedProjects.length > 0 && (
                                        <div className="project-switcher__group">
                                            <div className="project-switcher__group-label">
                                                {t('projectSwitcher.otherProjects')}
                                            </div>
                                            {ungroupedProjects.map(project => renderProjectRow(project))}
                                        </div>
                                    )}
                                    </>
                                ) : (
                                <div className="project-switcher__state project-switcher__state--empty">
                                    <span className="material-symbols-outlined">folder_off</span>
                                    {t('projectSwitcher.empty')}
                                </div>
                                )}
                            </section>
                        </div>

                        <div className="project-switcher__footer">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    openProjectCreateModal();
                                    if (onClose) onClose();
                                }}
                                className="project-switcher__create"
                            >
                                <span className="material-symbols-outlined">add</span>
                                {t('projectSwitcher.createProject')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
