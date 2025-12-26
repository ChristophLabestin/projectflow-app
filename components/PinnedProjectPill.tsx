import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePinnedProject } from '../context/PinnedProjectContext';
import { useUIState } from '../context/UIContext';
import { Project, Task, Issue, Milestone, Activity } from '../types';
import { subscribeProjectTasks, subscribeProjectIssues, subscribeProjectMilestones, subscribeProjectActivity } from '../services/dataService';
import { calculateProjectHealth, ProjectHealth } from '../services/healthService';

export const PinnedProjectPill = () => {
    const { pinnedProject, isLoading } = usePinnedProject();
    const { openTaskCreateModal, openIdeaCreateModal, openIssueCreateModal } = useUIState();
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
                title={`Pinned Project: ${pinnedProject.title}`}
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
                        {health ? `${health.score} Health Score` : 'Loading...'}
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
                    className="fixed z-[100] w-80 rounded-2xl shadow-2xl ring-1 ring-black/10 overflow-hidden origin-top animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: dropdownCoords.top,
                        left: dropdownCoords.left,
                        transform: 'translateX(-50%)',
                        // Glass Styles
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        backdropFilter: 'saturate(180%) blur(25px)',
                        WebkitBackdropFilter: 'saturate(180%) blur(25px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                >
                    {/* Header with Health Score */}
                    <div className="p-4 border-b border-slate-100 dark:border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <span className="material-symbols-outlined text-6xl">analytics</span>
                        </div>

                        <div className="relative z-10 flex items-start justify-between gap-4 mb-3">
                            <div>
                                <h4 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">{pinnedProject.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge status={health?.status} />
                                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{health?.trend} trend</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center size-14 rounded-full border-4 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shrink-0">
                                <span className={`text-lg font-black ${getHealthColor(health?.status)}`}>{health?.score || 0}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Score</span>
                            </div>
                        </div>

                        {/* Health Factors */}
                        {health && health.factors.length > 0 && (
                            <div className="space-y-2 mt-4">
                                {health.factors.slice(0, 2).map(factor => (
                                    <div key={factor.id} className="flex gap-2 items-start bg-slate-50 dark:bg-white/5 p-2 rounded-lg">
                                        <div className={`mt-0.5 size-1.5 rounded-full shrink-0 ${factor.type === 'positive' ? 'bg-emerald-500' : factor.type === 'negative' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                                        <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-tight">
                                            <span className="font-bold text-slate-900 dark:text-white">{factor.label}:</span> {factor.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="p-2 grid grid-cols-3 gap-1 bg-slate-50/50 dark:bg-black/20">
                        <button
                            onClick={() => handleAction(() => openTaskCreateModal(pinnedProject.id))}
                            className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl hover:bg-white dark:hover:bg-white/10 hover:shadow-sm transition-all group/btn"
                        >
                            <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-[18px]">add_task</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">New Task</span>
                        </button>

                        {(modules.includes('ideas') || modules.length === 0) && (
                            <button
                                onClick={() => handleAction(() => openIdeaCreateModal(pinnedProject.id))}
                                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl hover:bg-white dark:hover:bg-white/10 hover:shadow-sm transition-all group/btn"
                            >
                                <div className="size-8 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">New Idea</span>
                            </button>
                        )}

                        {(modules.includes('issues') || modules.length === 0) && (
                            <button
                                onClick={() => handleAction(() => openIssueCreateModal(pinnedProject.id))}
                                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl hover:bg-white dark:hover:bg-white/10 hover:shadow-sm transition-all group/btn"
                            >
                                <div className="size-8 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-[18px]">bug_report</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">New Issue</span>
                            </button>
                        )}
                    </div>

                    {/* Navigation Footer */}
                    <div className="p-3 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/40 flex gap-2">
                        <button
                            onClick={() => handleAction(() => navigate(`/project/${pinnedProject.id}`))}
                            className="flex-1 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-indigo-500 hover:text-indigo-500 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[16px]">dashboard</span>
                            Overview
                        </button>
                        <button
                            onClick={() => handleAction(() => navigate(`/project/${pinnedProject.id}/tasks`))}
                            className="flex-1 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-indigo-500 hover:text-indigo-500 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[16px]">list_alt</span>
                            Tasks
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

    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getColor(status)}`}>
            {status || 'Unknown'}
        </span>
    );
};
