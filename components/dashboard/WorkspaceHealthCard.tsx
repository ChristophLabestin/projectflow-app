import React, { useMemo } from 'react';
import { WorkspaceHealth } from '../../services/healthService';
import { useLanguage } from '../../context/LanguageContext';

interface WorkspaceHealthCardProps {
    health: WorkspaceHealth;
    projectCount: number;
}

export const WorkspaceHealthCard: React.FC<WorkspaceHealthCardProps> = ({ health, projectCount }) => {
    const { t } = useLanguage();
    const statusLabels = useMemo(() => ({
        critical: t('status.critical'),
        warning: t('status.warning'),
        normal: t('status.normal'),
        healthy: t('status.healthy'),
        excellent: t('status.excellent'),
        stalemate: t('dashboard.health.stalemate')
    }), [t]);

    // Status color mapping
    const colorMap = {
        critical: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
        warning: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
        normal: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20',
        healthy: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
        excellent: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30',
        stalemate: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20'
    };

    // Circle circumference for gauge
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (health.score / 100) * circumference;

    const strokeColor = health.status === 'critical' ? 'stroke-rose-500' :
        health.status === 'warning' ? 'stroke-amber-500' :
            health.status === 'excellent' ? 'stroke-emerald-500' :
                health.status === 'healthy' ? 'stroke-emerald-400' :
                    'stroke-indigo-500';

    return (
        <div className="bg-white dark:bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">{t('dashboard.health.title')}</h3>
                    <p className="text-[var(--color-text-muted)] text-xs mt-1">{t('dashboard.health.subtitle')}</p>
                </div>
                <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorMap[health.status]}`}>
                    {statusLabels[health.status as keyof typeof statusLabels] || health.status}
                </div>
            </div>

            <div className="flex flex-row items-center gap-6">
                {/* Radial Gauge */}
                <div className="relative size-24 flex items-center justify-center">
                    <svg className="size-full -rotate-90">
                        {/* Track */}
                        <circle
                            cx="48" cy="48" r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-slate-100 dark:text-white/5"
                        />
                        {/* Progress */}
                        <circle
                            cx="48" cy="48" r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            className={`${strokeColor} transition-all duration-1000 ease-out`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-[var(--color-text-main)] leading-none">{health.score}</span>
                    </div>
                </div>

                {/* Stat Breakdown */}
                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-[var(--color-text-muted)] font-bold">
                            <span className="size-2 rounded-full bg-rose-500"></span> {t('status.critical')}
                        </span>
                        <span className="font-black text-[var(--color-text-main)]">{health.breakdown.critical}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-[var(--color-text-muted)] font-bold">
                            <span className="size-2 rounded-full bg-amber-500"></span> {t('status.warning')}
                        </span>
                        <span className="font-black text-[var(--color-text-main)]">{health.breakdown.warning}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-[var(--color-text-muted)] font-bold">
                            <span className="size-2 rounded-full bg-emerald-500"></span> {t('status.healthy')}
                        </span>
                        <span className="font-black text-[var(--color-text-main)]">{health.breakdown.healthy + health.breakdown.excellent}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-[var(--color-surface-border)] flex items-center gap-1 text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">
                        {health.trend === 'improving' ? (
                            <span className="text-emerald-500 material-symbols-outlined text-sm">trending_up</span>
                        ) : health.trend === 'declining' ? (
                            <span className="text-rose-500 material-symbols-outlined text-sm">trending_down</span>
                        ) : (
                            <span className="text-[var(--color-text-subtle)] material-symbols-outlined text-sm">trending_flat</span>
                        )}
                        <span>{t(`trend.${health.trend}`, health.trend)} {t('dashboard.health.trendSuffix')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
