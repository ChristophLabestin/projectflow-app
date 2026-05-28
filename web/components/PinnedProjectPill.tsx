import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePinnedProject } from '../context/PinnedProjectContext';
import { useUIState } from '../context/UIContext';
import { ProjectModule, Task, Issue, Milestone, Activity, Initiative, Idea } from '../types';
import { calculateProjectHealth, ProjectHealth } from '../services/healthService';
import { useLanguage } from '../context/LanguageContext';
import { getHealthFactorText } from '../utils/healthLocalization';
import { subscribeProjectTasks } from '../services/domain/tasksService';
import { subscribeProjectIssues } from '../services/domain/issuesService';
import { subscribeProjectInitiatives } from '../services/domain/initiativesService';
import { subscribeProjectMilestones } from '../services/domain/projectMetaService';
import { subscribeProjectActivity } from '../services/domain/activityService';
import { subscribeProjectIdeas } from '../services/domain/ideasService';

const DROPDOWN_WIDTH = 376;
const DROPDOWN_GAP = 12;

type DropdownCoords = {
    top: number;
    left: number;
    width: number;
};

export const PinnedProjectPill = () => {
    const { pinnedProject, isLoading } = usePinnedProject();
    const { openTaskCreateModal, openIdeaCreateModal, openIssueCreateModal } = useUIState();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [dropdownCoords, setDropdownCoords] = useState<DropdownCoords>({ top: 0, left: 0, width: DROPDOWN_WIDTH });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [health, setHealth] = useState<ProjectHealth | null>(null);

    const updateDropdownPosition = useCallback(() => {
        if (!buttonRef.current) return;

        const rect = buttonRef.current.getBoundingClientRect();
        const width = Math.min(DROPDOWN_WIDTH, window.innerWidth - DROPDOWN_GAP * 2);
        const preferredLeft = rect.right - width;
        const maxLeft = window.innerWidth - width - DROPDOWN_GAP;

        setDropdownCoords({
            top: rect.bottom + 10,
            left: Math.min(Math.max(preferredLeft, DROPDOWN_GAP), maxLeft),
            width,
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const dropdownEl = document.getElementById('pinned-project-dropdown');
            if (
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node) &&
                dropdownEl &&
                !dropdownEl.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        updateDropdownPosition();
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', updateDropdownPosition);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', updateDropdownPosition);
        };
    }, [isOpen, updateDropdownPosition]);

    const toggleDropdown = () => {
        if (!isOpen) {
            updateDropdownPosition();
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        if (!pinnedProject) {
            setTasks([]);
            setIssues([]);
            setInitiatives([]);
            setMilestones([]);
            setActivity([]);
            setIdeas([]);
            setHealth(null);
            return;
        }

        const unsubTasks = subscribeProjectTasks(pinnedProject.id, setTasks, pinnedProject.tenantId);
        const unsubIssues = subscribeProjectIssues(pinnedProject.id, setIssues, pinnedProject.tenantId);
        const unsubInitiatives = subscribeProjectInitiatives(pinnedProject.id, setInitiatives, pinnedProject.tenantId);
        const unsubMilestones = subscribeProjectMilestones(pinnedProject.id, setMilestones, pinnedProject.tenantId);
        const unsubActivity = subscribeProjectActivity(pinnedProject.id, setActivity, pinnedProject.tenantId);
        const unsubIdeas = subscribeProjectIdeas(pinnedProject.id, setIdeas, pinnedProject.tenantId);

        return () => {
            unsubTasks();
            unsubIssues();
            unsubInitiatives();
            unsubMilestones();
            unsubActivity();
            unsubIdeas();
        };
    }, [pinnedProject?.id, pinnedProject?.tenantId]);

    useEffect(() => {
        if (!pinnedProject) return;
        const h = calculateProjectHealth(pinnedProject, tasks, milestones, issues, [], activity, [], initiatives, ideas);
        setHealth(h);
    }, [pinnedProject, tasks, issues, initiatives, milestones, activity, ideas]);

    if (isLoading || !pinnedProject) return null;

    const modules = pinnedProject.modules ?? [];
    const moduleEnabled = (module: ProjectModule) => modules.length === 0 || modules.includes(module);
    const showTasks = moduleEnabled('tasks');
    const showInitiatives = moduleEnabled('initiatives');
    const showIdeas = moduleEnabled('ideas');
    const showActivity = moduleEnabled('activity');
    const showIssues = moduleEnabled('issues');
    const showMilestones = moduleEnabled('milestones');
    const healthStatusClass = `pinned-project-health--${health?.status ?? 'unknown'}`;
    const visibleFactors = health?.factors.slice(0, 2) ?? [];

    const stats = [
        ...(showTasks ? [{ id: 'tasks', label: t('nav.tasks'), value: tasks.length, icon: 'task_alt' }] : []),
        ...(showInitiatives ? [{ id: 'initiatives', label: t('nav.initiatives'), value: initiatives.length, icon: 'account_tree' }] : []),
        ...(showIdeas ? [{ id: 'flows', label: t('nav.flows'), value: ideas.length, icon: 'schema' }] : []),
        ...(showIssues ? [{ id: 'issues', label: t('nav.issues'), value: issues.length, icon: 'bug_report' }] : []),
        ...(showMilestones ? [{ id: 'milestones', label: t('nav.milestones'), value: milestones.length, icon: 'flag' }] : []),
        ...(showActivity ? [{ id: 'activity', label: t('nav.activity'), value: activity.length, icon: 'history' }] : []),
    ];

    const quickActions = [
        {
            id: 'task',
            label: t('quickActions.newTask'),
            icon: 'add_task',
            onSelect: () => openTaskCreateModal(pinnedProject.id),
        },
        ...(showIdeas ? [{
            id: 'flow',
            label: t('quickActions.newFlow'),
            icon: 'lightbulb',
            onSelect: () => openIdeaCreateModal(pinnedProject.id),
        }] : []),
        ...(showIssues ? [{
            id: 'issue',
            label: t('quickActions.newIssue'),
            icon: 'bug_report',
            onSelect: () => openIssueCreateModal(pinnedProject.id),
        }] : []),
    ];

    const navigationItems = [
        { id: 'overview', label: t('nav.overview'), icon: 'dashboard', path: `/project/${pinnedProject.id}` },
        ...(showTasks ? [{ id: 'tasks', label: t('nav.tasks'), icon: 'list_alt', path: `/project/${pinnedProject.id}/tasks` }] : []),
        ...(showInitiatives ? [{ id: 'initiatives', label: t('nav.initiatives'), icon: 'account_tree', path: `/project/${pinnedProject.id}/initiatives` }] : []),
        ...(showIdeas ? [{ id: 'flows', label: t('nav.flows'), icon: 'schema', path: `/project/${pinnedProject.id}/flows` }] : []),
        ...(showIssues ? [{ id: 'issues', label: t('nav.issues'), icon: 'bug_report', path: `/project/${pinnedProject.id}/issues` }] : []),
        ...(showMilestones ? [{ id: 'milestones', label: t('nav.milestones'), icon: 'flag', path: `/project/${pinnedProject.id}/milestones` }] : []),
    ];

    const handleAction = (action: () => void) => {
        setIsOpen(false);
        action();
    };

    return (
        <>
            <button
                type="button"
                ref={buttonRef}
                onClick={toggleDropdown}
                className={`pinned-project-trigger${isOpen ? ' is-open' : ''}`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-controls={isOpen ? 'pinned-project-dropdown' : undefined}
                title={`${t('pinned.pinnedProject')}: ${pinnedProject.title}`}
            >
                <span className={`pinned-project-icon pinned-project-icon--trigger${pinnedProject.squareIcon ? ' has-image' : ''}`}>
                    {pinnedProject.squareIcon ? (
                        <img src={pinnedProject.squareIcon} alt="" />
                    ) : (
                        <span>{pinnedProject.title.charAt(0).toUpperCase()}</span>
                    )}
                </span>

                <span className="pinned-project-trigger__copy">
                    <span className="pinned-project-trigger__title">{pinnedProject.title}</span>
                    <span className="pinned-project-trigger__meta">
                        {health ? `${health.score} ${t('pinned.healthScore')}` : t('pinned.loading')}
                    </span>
                </span>

                <span className="material-symbols-outlined pinned-project-trigger__chevron">
                    {isOpen ? 'expand_less' : 'expand_more'}
                </span>
            </button>

            {isOpen && createPortal(
                <div
                    id="pinned-project-dropdown"
                    className="pinned-project-menu"
                    role="menu"
                    aria-label={t('pinned.projectMenu')}
                    style={{
                        top: dropdownCoords.top,
                        left: dropdownCoords.left,
                        width: dropdownCoords.width,
                        maxHeight: `calc(100vh - ${dropdownCoords.top + DROPDOWN_GAP}px)`,
                    }}
                >
                    <div className="pinned-project-menu__scroll">
                        <div className="pinned-project-menu__header">
                            <div className="pinned-project-menu__identity">
                                <span className={`pinned-project-icon pinned-project-icon--menu${pinnedProject.squareIcon ? ' has-image' : ''}`}>
                                    {pinnedProject.squareIcon ? (
                                        <img src={pinnedProject.squareIcon} alt="" />
                                    ) : (
                                        <span>{pinnedProject.title.charAt(0).toUpperCase()}</span>
                                    )}
                                </span>

                                <div className="pinned-project-menu__copy">
                                    <div className="pinned-project-menu__eyebrow">{t('pinned.pinnedProject')}</div>
                                    <h4 className="pinned-project-menu__title">{pinnedProject.title}</h4>
                                    <div className="pinned-project-menu__meta">
                                        {health ? `${t(`trend.${health.trend}`)} ${t('pinned.trend')}` : t('pinned.loading')}
                                    </div>
                                </div>
                            </div>

                            <div className="pinned-project-menu__score-card">
                                <span className={`pinned-project-menu__score-value ${healthStatusClass}`}>{health?.score ?? 0}</span>
                                <span className="pinned-project-menu__score-label">{t('pinned.score')}</span>
                            </div>
                        </div>

                        <div className="pinned-project-menu__status-row">
                            <Badge status={health?.status} />
                            <span>{health ? `${health.score} ${t('pinned.healthScore')}` : t('pinned.loading')}</span>
                        </div>

                        <div className="pinned-project-menu__stats">
                            {stats.map((stat) => (
                                <div key={stat.id} className="pinned-project-menu__stat">
                                    <div className="pinned-project-menu__stat-label">
                                        <span className="material-symbols-outlined">{stat.icon}</span>
                                        <span>{stat.label}</span>
                                    </div>
                                    <div className="pinned-project-menu__stat-value">{stat.value}</div>
                                </div>
                            ))}
                        </div>
                        <section className="pinned-project-menu__section">
                            <div className="pinned-project-menu__section-title">{t('pinned.healthSignals')}</div>
                            {visibleFactors.length > 0 ? (
                                <div className="pinned-project-menu__health-list">
                                    {visibleFactors.map((factor) => {
                                        const factorClass = `pinned-project-health-factor--${factor.type}`;
                                        const { label, description } = getHealthFactorText(factor, t);

                                        return (
                                            <div key={factor.id} className={`pinned-project-health-factor ${factorClass}`}>
                                                <span className="pinned-project-health-factor__dot" />
                                                <p>
                                                    <span>{label}:</span> {description}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="pinned-project-menu__empty">
                                    {health ? t('pinned.noFactors') : t('pinned.loading')}
                                </div>
                            )}
                        </section>

                        <section className="pinned-project-menu__section">
                            <div className="pinned-project-menu__section-title">{t('pinned.quickActions')}</div>
                            <div className="pinned-project-menu__quick-actions">
                                {quickActions.map((action) => (
                                    <button
                                        key={action.id}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleAction(action.onSelect)}
                                        className={`pinned-project-menu__quick-action pinned-project-menu__quick-action--${action.id}`}
                                    >
                                        <span className="pinned-project-menu__quick-icon">
                                            <span className="material-symbols-outlined">{action.icon}</span>
                                        </span>
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="pinned-project-menu__section pinned-project-menu__section--navigation">
                            <div className="pinned-project-menu__section-title">{t('pinned.projectMenu')}</div>
                            <div className="pinned-project-menu__nav-grid">
                                {navigationItems.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleAction(() => navigate(item.path))}
                                        className="pinned-project-menu__nav-button"
                                    >
                                        <span className="material-symbols-outlined">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

const Badge = ({ status }: { status?: ProjectHealth['status'] }) => {
    const { t } = useLanguage();
    const statusLabel = status ? t(`status.${status}`, status) : t('pinned.unknown');

    return (
        <span className={`pinned-project-badge pinned-project-health--${status ?? 'unknown'}`}>
            {statusLabel}
        </span>
    );
};
