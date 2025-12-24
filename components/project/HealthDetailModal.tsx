import React, { useMemo } from 'react';
import { ProjectHealth, HealthStatus, HealthFactor } from '../../services/healthService';
import { Task, Milestone, Issue } from '../../types';
import { Button } from '../ui/Button';

interface HealthDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    health: ProjectHealth;
    tasks?: Task[];
    milestones?: Milestone[];
    issues?: Issue[];
    projectTitle?: string;
}

const themes = {
    critical: {
        badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30',
        gradient: 'from-rose-50 via-red-50 to-orange-50 dark:from-rose-950/50 dark:via-red-950/50 dark:to-slate-900',
        progressBar: 'from-rose-500 via-red-500 to-orange-500',
        border: 'border-rose-200/50 dark:border-rose-500/20',
        shadow: 'shadow-[0_20px_60px_-15px_rgba(244,63,94,0.4)]',
        statusDot: 'bg-rose-500',
        statusText: 'Critical',
        color: '#f43f5e',
        ring: 'ring-rose-500/30'
    },
    warning: {
        badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
        gradient: 'from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/50 dark:via-orange-950/50 dark:to-slate-900',
        progressBar: 'from-amber-500 via-orange-500 to-yellow-500',
        border: 'border-amber-200/50 dark:border-amber-500/20',
        shadow: 'shadow-[0_20px_60px_-15px_rgba(245,158,11,0.4)]',
        statusDot: 'bg-amber-500',
        statusText: 'Warning',
        color: '#f59e0b',
        ring: 'ring-amber-500/30'
    },
    success: {
        badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
        gradient: 'from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/50 dark:via-green-950/50 dark:to-slate-900',
        progressBar: 'from-emerald-500 via-green-500 to-teal-500',
        border: 'border-emerald-200/50 dark:border-emerald-500/20',
        shadow: 'shadow-[0_20px_60px_-15px_rgba(16,185,129,0.35)]',
        statusDot: 'bg-emerald-500',
        statusText: 'Healthy',
        color: '#10b981',
        ring: 'ring-emerald-500/30'
    },
    normal: {
        badge: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30',
        gradient: 'from-indigo-50 via-purple-50 to-slate-50 dark:from-indigo-950/50 dark:via-purple-950/50 dark:to-slate-900',
        progressBar: 'from-indigo-500 via-purple-500 to-pink-500',
        border: 'border-slate-200/50 dark:border-white/10',
        shadow: 'shadow-[0_20px_60px_-15px_rgba(99,102,241,0.35)]',
        statusDot: 'bg-indigo-500',
        statusText: 'Normal',
        color: '#6366f1',
        ring: 'ring-indigo-500/30'
    },
};

const getThemeState = (status: HealthStatus): keyof typeof themes => {
    if (status === 'excellent' || status === 'healthy') return 'success';
    if (status === 'warning') return 'warning';
    if (status === 'critical') return 'critical';
    return 'normal';
};

export const HealthDetailModal: React.FC<HealthDetailModalProps> = ({
    isOpen,
    onClose,
    health,
    tasks = [],
    milestones = [],
    issues = [],
    projectTitle
}) => {
    const state = getThemeState(health.status);
    const theme = themes[state];

    // Derive at-risk items
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const { overdueTasks, dueSoonTasks, blockedTasks, overdueMilestones, urgentIssues } = useMemo(() => ({
        overdueTasks: tasks.filter(t => {
            if (t.isCompleted || t.status === 'Done' || !t.dueDate) return false;
            return new Date(t.dueDate).getTime() < now;
        }),
        dueSoonTasks: tasks.filter(t => {
            if (t.isCompleted || t.status === 'Done' || !t.dueDate) return false;
            const due = new Date(t.dueDate).getTime();
            return due >= now && due <= now + 3 * DAY;
        }),
        blockedTasks: tasks.filter(t => t.status === 'Blocked'),
        overdueMilestones: milestones.filter(m => {
            if (m.status === 'Achieved' || !m.dueDate) return false;
            return new Date(m.dueDate).getTime() < now;
        }),
        urgentIssues: issues.filter(i =>
            (i.priority === 'Urgent' || i.priority === 'High') &&
            i.status !== 'Resolved' && i.status !== 'Closed'
        )
    }), [tasks, milestones, issues, now]);

    const attentionCount = overdueTasks.length + dueSoonTasks.length + blockedTasks.length + overdueMilestones.length + urgentIssues.length;

    const negativeFactors = health.factors.filter(f => f.type === 'negative');
    const positiveFactors = health.factors.filter(f => f.type === 'positive');

    // Gauge
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (health.score / 100) * circumference;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className={`relative w-full max-w-2xl ${theme.shadow} animate-in zoom-in-95 fade-in duration-300`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`w-full relative rounded-3xl overflow-hidden border ${theme.border} bg-white dark:bg-[var(--color-surface-card)] ring-1 ${theme.ring}`}>
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-50`} />

                    {/* Content */}
                    <div className="relative z-10">
                        {/* Header */}
                        <div className="p-8 pb-0">
                            <div className="flex items-start gap-6">
                                {/* Score Gauge */}
                                <div className="relative shrink-0">
                                    <div className="relative size-40">
                                        <svg className="size-full -rotate-90" viewBox="0 0 160 160">
                                            <circle
                                                cx="80" cy="80" r={radius}
                                                fill="none"
                                                strokeWidth="12"
                                                className="stroke-slate-200/50 dark:stroke-white/10"
                                            />
                                            <circle
                                                cx="80" cy="80" r={radius}
                                                fill="none"
                                                strokeWidth="12"
                                                strokeLinecap="round"
                                                strokeDasharray={circumference}
                                                strokeDashoffset={offset}
                                                stroke={theme.color}
                                                className="transition-all duration-1000 ease-out"
                                                style={{ filter: `drop-shadow(0 0 8px ${theme.color}50)` }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-5xl font-black text-slate-900 dark:text-white">{health.score}</span>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-widest">Score</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 pt-2">
                                    <button
                                        onClick={onClose}
                                        className="absolute top-6 right-6 size-9 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 flex items-center justify-center text-slate-500 dark:text-white/60 transition-colors"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>

                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                                        Project Health
                                    </h2>
                                    {projectTitle && (
                                        <p className="text-slate-500 dark:text-white/60 font-medium mb-4 truncate">{projectTitle}</p>
                                    )}

                                    <div className="flex items-center gap-3 mb-6">
                                        <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme.badge}`}>
                                            <span className={`size-2 rounded-full ${theme.statusDot} animate-pulse`} />
                                            {theme.statusText}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-white/70 font-medium">
                                            <span className={`material-symbols-outlined text-[18px] ${health.trend === 'improving' ? 'text-emerald-500' : health.trend === 'declining' ? 'text-rose-500' : 'text-slate-400'}`}>
                                                {health.trend === 'improving' ? 'trending_up' : health.trend === 'declining' ? 'trending_down' : 'trending_flat'}
                                            </span>
                                            {health.trend.charAt(0).toUpperCase() + health.trend.slice(1)}
                                        </div>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5">
                                            <span className="block text-2xl font-black text-rose-500">{negativeFactors.length}</span>
                                            <span className="text-[10px] text-slate-500 dark:text-white/50 uppercase font-bold tracking-wide">Risks</span>
                                        </div>
                                        <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5">
                                            <span className="block text-2xl font-black text-emerald-500">{positiveFactors.length}</span>
                                            <span className="text-[10px] text-slate-500 dark:text-white/50 uppercase font-bold tracking-wide">Strengths</span>
                                        </div>
                                        <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5">
                                            <span className="block text-2xl font-black text-amber-500">{attentionCount}</span>
                                            <span className="text-[10px] text-slate-500 dark:text-white/50 uppercase font-bold tracking-wide">Attention</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-8 pt-6 max-h-[45vh] overflow-y-auto space-y-6">

                            {/* Attention Items */}
                            {attentionCount > 0 && (
                                <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 p-5 rounded-2xl border border-slate-200 dark:border-white/10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-outlined text-amber-500">warning</span>
                                        <span className="font-bold text-slate-900 dark:text-white">Needs Attention</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {overdueTasks.length > 0 && (
                                            <AttentionChip icon="event_busy" label="Overdue Tasks" count={overdueTasks.length} color="rose" />
                                        )}
                                        {dueSoonTasks.length > 0 && (
                                            <AttentionChip icon="schedule" label="Due Soon" count={dueSoonTasks.length} color="amber" />
                                        )}
                                        {blockedTasks.length > 0 && (
                                            <AttentionChip icon="block" label="Blocked" count={blockedTasks.length} color="rose" />
                                        )}
                                        {overdueMilestones.length > 0 && (
                                            <AttentionChip icon="flag" label="Milestones" count={overdueMilestones.length} color="orange" />
                                        )}
                                        {urgentIssues.length > 0 && (
                                            <AttentionChip icon="bug_report" label="Critical Issues" count={urgentIssues.length} color="rose" />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Factors */}
                            {health.factors.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">analytics</span>
                                        Health Factors
                                    </h3>
                                    <div className="space-y-2">
                                        {health.factors.map((factor) => (
                                            <FactorRow key={factor.id} factor={factor} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recommendations */}
                            {health.recommendations.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                        AI Recommendations
                                    </h3>
                                    <div className="space-y-2">
                                        {health.recommendations.map((rec, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20"
                                            >
                                                <span className="material-symbols-outlined text-indigo-500 mt-0.5">lightbulb</span>
                                                <p className="text-sm text-slate-700 dark:text-white/80 font-medium">{rec}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {health.factors.length === 0 && health.recommendations.length === 0 && attentionCount === 0 && (
                                <div className="text-center py-8">
                                    <span className="material-symbols-outlined text-5xl text-emerald-500 mb-3">verified</span>
                                    <p className="text-slate-900 dark:text-white font-bold text-lg">All Clear!</p>
                                    <p className="text-sm text-slate-500 dark:text-white/60">This project is in great shape.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 pt-0 flex justify-end">
                            <Button onClick={onClose} size="lg" className="px-8 rounded-xl font-bold">Done</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AttentionChip: React.FC<{ icon: string; label: string; count: number; color: 'rose' | 'amber' | 'orange' }> = ({ icon, label, count, color }) => {
    const colors = {
        rose: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
        amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
        orange: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
    };

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${colors[color]}`}>
            <span className="material-symbols-outlined text-sm">{icon}</span>
            <span>{label}</span>
            <span className="font-bold">{count}</span>
        </div>
    );
};

const FactorRow: React.FC<{ factor: HealthFactor }> = ({ factor }) => {
    const isNegative = factor.type === 'negative';
    const isPositive = factor.type === 'positive';

    const dotColor = isNegative ? 'bg-rose-500' : isPositive ? 'bg-emerald-500' : 'bg-slate-400';
    const impactClass = isNegative
        ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
        : isPositive
            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-white/10 text-slate-500';

    return (
        <div className="flex items-start gap-4 p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 transition-colors">
            <div className={`size-2.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1">
                    <h4 className="font-bold text-slate-900 dark:text-white">{factor.label}</h4>
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${impactClass}`}>
                        {factor.impact > 0 ? '+' : ''}{factor.impact}
                    </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-white/60">{factor.description}</p>
            </div>
        </div>
    );
};
