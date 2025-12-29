import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePinnedProject } from '../context/PinnedProjectContext';
import { useUIState } from '../context/UIContext';
import { Project, Task, Issue, Milestone, Activity } from '../types';
import { subscribeProjectTasks, subscribeProjectIssues, subscribeProjectMilestones, subscribeProjectActivity } from '../services/dataService';
import { calculateProjectHealth, ProjectHealth } from '../services/healthService';
import { useLanguage } from '../context/LanguageContext';
import { getHealthFactorText } from '../utils/healthLocalization';

export const PinnedProjectPill = () => {
    const { pinnedProject, isLoading } = usePinnedProject();
    const { openTaskCreateModal, openIdeaCreateModal, openIssueCreateModal } = useUIState();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Data for Health Calc
    const [tasks, setTasks] = useState<Task[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [health, setHealth] = useState<ProjectHealth | null>(null);

    // Close on click outside (modified for Portal)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is inside button (ref) or inside the portal dropdown (we can't easily ref the portal content directly here without another ref, but usually clicking "outside" implies checking the button ref first)
            // Actually, for portals, we need to be careful. Let's use a simple global click handler that checks if the target is NOT inside the button.
            // AND we need to assign a unique ID or Ref to the dropdown to check that too.
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

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('resize', () => setIsOpen(false)); // Close on resize to avoid alignment issues
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', () => setIsOpen(false));
        };
    }, [isOpen]);

    // Handle Open - Calculate Position
    const toggleDropdown = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownCoords({
                top: rect.bottom + 8,
                left: rect.left + (rect.width / 2)
            });
        }
        setIsOpen(!isOpen);
    };

    // Subscribe to project data for health calculation
    useEffect(() => {
        if (!pinnedProject) {
            setHealth(null);
            return;
        }

        const unsubTasks = subscribeProjectTasks(pinnedProject.id, setTasks, pinnedProject.tenantId);
        const unsubIssues = subscribeProjectIssues(pinnedProject.id, setIssues, pinnedProject.tenantId);
        const unsubMilestones = subscribeProjectMilestones(pinnedProject.id, setMilestones, pinnedProject.tenantId);
        const unsubActivity = subscribeProjectActivity(pinnedProject.id, setActivity, pinnedProject.tenantId);

        return () => {
            unsubTasks();
            unsubIssues();
            unsubMilestones();
            unsubActivity();
        };
    }, [pinnedProject?.id]);

    // Recalculate health when data changes
    useEffect(() => {
        if (!pinnedProject) return;
        const h = calculateProjectHealth(pinnedProject, tasks, milestones, issues, activity);
        setHealth(h);
    }, [pinnedProject, tasks, issues, milestones, activity]);

    if (isLoading || !pinnedProject) return null;

    const modules = pinnedProject.modules || [];
    const showIssues = modules.includes('issues') || modules.length === 0;
    const showMilestones = modules.includes('milestones') || modules.length === 0;
    const stats = [
        { id: 'tasks', label: t('nav.tasks'), value: tasks.length, icon: 'task_alt' },
        ...(showIssues ? [{ id: 'issues', label: t('nav.issues'), value: issues.length, icon: 'bug_report' }] : []),
        ...(showMilestones ? [{ id: 'milestones', label: t('nav.milestones'), value: milestones.length, icon: 'flag' }] : []),
    ];

    const handleAction = (action: () => void) => {
        setIsOpen(false);
        action();
    };

    const getHealthColor = (status?: string) => {
        switch (status) {
            case 'excellent': return 'text-emerald-500';
            case 'healthy': return 'text-green-500';
            case 'normal': return 'text-indigo-500';
            case 'warning': return 'text-amber-500';
            case 'critical': return 'text-rose-500';
            default: return 'text-slate-400';
        }
    };

    return (
        <>
            <button
                ref={buttonRef}
                onClick={toggleDropdown}
                className={`
                    group flex items-center gap-2 h-8 pl-1 pr-2.5 rounded-lg transition-all border
                    ${isOpen
                        ? 'bg-[var(--color-surface-hover)] border-[var(--color-surface-border)] shadow-inner'
                        : 'bg-[var(--color-surface-bg)] border-transparent hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-surface-border)]'
                    }
                `}
                title={`${t('pinned.pinnedProject', 'Pinned Project')}: ${pinnedProject.title}`}
            >
                {/* Project Icon */}
                <div className={`
                    size-6 rounded-md flex items-center justify-center overflow-hidden shrink-0 border border-transparent group-hover:border-[var(--color-surface-border)] transition-all
                    ${pinnedProject.squareIcon ? 'bg-transparent' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}
                    font-bold text-white text-[10px]
                `}>
                    {pinnedProject.squareIcon ? (
                        <img src={pinnedProject.squareIcon} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span>{pinnedProject.title.charAt(0).toUpperCase()}</span>
                    )}
                </div>

                <div className="flex flex-col items-start leading-tight max-w-[120px] hidden sm:flex">
                    <span className="text-[12px] font-bold text-[var(--color-text-main)] truncate w-full">{pinnedProject.title}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-subtle)] transition-colors">
                        {health ? `${health.score} ${t('pinned.healthScore')}` : t('pinned.loading')}
                    </span>
                </div>

                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)] transition-colors">
                    {isOpen ? 'expand_less' : 'expand_more'}
                </span>
            </button>

            {/* Portal Dropdown */}
            {isOpen && createPortal(
                <div
                    id="pinned-project-dropdown"
                    className="fixed z-[100] w-[360px] rounded-2xl shadow-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] overflow-hidden origin-top animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: dropdownCoords.top,
                        left: dropdownCoords.left,
                        transform: 'translateX(-50%)',
                    }}
                >
                    {/* Header */}
                    <div className="relative px-5 py-4 border-b border-[var(--color-surface-border)] bg-gradient-to-r from-[var(--color-surface-card)] to-[var(--color-surface-bg)] overflow-hidden">
                        <div className="absolute -top-10 -right-8 opacity-[0.08] pointer-events-none">
                            <span className="material-symbols-outlined text-[140px]">insights</span>
                        </div>

                        <div className="relative z-10 flex items-start gap-4">
                            <div className={`
                                size-11 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border border-[var(--color-surface-border)]
                                ${pinnedProject.squareIcon ? 'bg-[var(--color-surface-paper)]' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}
                                font-bold text-white text-sm
                            `}>
                                {pinnedProject.squareIcon ? (
                                    <img src={pinnedProject.squareIcon} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span>{pinnedProject.title.charAt(0).toUpperCase()}</span>
                                )}
                            </div>

                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-subtle)] font-bold">
                                    {t('pinned.pinnedProject', 'Pinned Project')}
                                </div>
                                <h4 className="text-sm font-bold text-[var(--color-text-main)] line-clamp-1">{pinnedProject.title}</h4>
                                <div className="text-[11px] text-[var(--color-text-muted)]">
                                    {health ? `${health.score} ${t('pinned.healthScore')}` : t('pinned.loading')}
                                </div>
                            </div>

                            <div className="ml-auto flex flex-col items-center justify-center size-14 rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-paper)] shadow-sm shrink-0">
                                <span className={`text-lg font-black ${getHealthColor(health?.status)}`}>{health?.score || 0}</span>
                                <span className="text-[8px] font-bold text-[var(--color-text-subtle)] uppercase">{t('pinned.score')}</span>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                            <Badge status={health?.status} />
                            <span className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                                {health ? `${t(`trend.${health.trend}`)} ${t('pinned.trend')}` : t('pinned.loading')}
                            </span>
                        </div>

                        <div className={`mt-4 grid gap-2 ${stats.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {stats.map(stat => (
                                <div key={stat.id} className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-paper)] px-3 py-2">
                                    <div className="flex items-center gap-2 text-[var(--color-text-subtle)] text-[11px] font-medium">
                                        <span className="material-symbols-outlined text-[14px]">{stat.icon}</span>
                                        <span className="uppercase tracking-wider">{stat.label}</span>
                                    </div>
                                    <div className="text-lg font-black text-[var(--color-text-main)] leading-tight mt-1">
                                        {stat.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Health Factors */}
                    <div className="px-5 py-4 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-paper)]">
                        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-subtle)]">
                            {t('pinned.healthScore')}
                        </div>
                        {health && health.factors.length > 0 ? (
                            <div className="space-y-2 mt-3">
                                {health.factors.slice(0, 2).map(factor => {
                                    const { label, description } = getHealthFactorText(factor, t);
                                    return (
                                        <div key={factor.id} className="flex gap-2 items-start bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] p-3 rounded-xl">
                                            <div className={`mt-1 size-2 rounded-full shrink-0 ${factor.type === 'positive' ? 'bg-emerald-500' : factor.type === 'negative' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                                            <p className="text-[11px] text-[var(--color-text-muted)] leading-tight">
                                                <span className="font-bold text-[var(--color-text-main)]">{label}:</span> {description}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mt-3 text-xs text-[var(--color-text-muted)]">{t('pinned.loading')}</div>
                        )}
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="px-4 py-3 bg-[var(--color-surface-bg)]">
                        <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => handleAction(() => openTaskCreateModal(pinnedProject.id))}
                            className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-transparent bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-surface-border)] transition-all group/btn"
                        >
                            <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-[18px]">add_task</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{t('quickActions.newTask')}</span>
                        </button>

                        {(modules.includes('ideas') || modules.length === 0) && (
                            <button
                                onClick={() => handleAction(() => openIdeaCreateModal(pinnedProject.id))}
                                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-transparent bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-surface-border)] transition-all group/btn"
                            >
                                <div className="size-8 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{t('quickActions.newFlow')}</span>
                            </button>
                        )}

                        {(modules.includes('issues') || modules.length === 0) && (
                            <button
                                onClick={() => handleAction(() => openIssueCreateModal(pinnedProject.id))}
                                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-transparent bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-surface-border)] transition-all group/btn"
                            >
                                <div className="size-8 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-[18px]">bug_report</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{t('quickActions.newIssue')}</span>
                            </button>
                        )}
                        </div>
                    </div>

                    {/* Navigation Footer */}
                    <div className="p-3 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-card)] flex gap-2">
                        <button
                            onClick={() => handleAction(() => navigate(`/project/${pinnedProject.id}`))}
                            className="flex-1 h-8 rounded-lg bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] hover:border-indigo-500 hover:text-indigo-500 text-xs font-semibold text-[var(--color-text-muted)] transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[16px]">dashboard</span>
                            {t('quickActions.overview')}
                        </button>
                        <button
                            onClick={() => handleAction(() => navigate(`/project/${pinnedProject.id}/tasks`))}
                            className="flex-1 h-8 rounded-lg bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] hover:border-indigo-500 hover:text-indigo-500 text-xs font-semibold text-[var(--color-text-muted)] transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[16px]">list_alt</span>
                            {t('quickActions.tasks')}
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

// Mini Badge Component
const Badge = ({ status }: { status?: string }) => {
    const { t } = useLanguage();
    const getColor = (s?: string) => {
        switch (s) {
            case 'excellent': return 'bg-emerald-500 text-white';
            case 'healthy': return 'bg-green-500 text-white';
            case 'normal': return 'bg-indigo-500 text-white';
            case 'warning': return 'bg-amber-500 text-white';
            case 'critical': return 'bg-rose-500 text-white';
            default: return 'bg-slate-400 text-white';
        }
    };

    const statusLabel = status ? t(`status.${status}`, status) : t('pinned.unknown');

    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getColor(status)}`}>
            {statusLabel}
        </span>
    );
};
