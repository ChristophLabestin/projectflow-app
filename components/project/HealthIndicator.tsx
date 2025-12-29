import React, { useState } from 'react';
import { ProjectHealth, HealthStatus } from '../../services/healthService';
import { useLanguage } from '../../context/LanguageContext';
import { getHealthFactorText, getHealthRecommendations } from '../../utils/healthLocalization';

interface HealthIndicatorProps {
    health: ProjectHealth;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    onOpenDetail?: () => void;
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({ health, size = 'md', showLabel = true, onOpenDetail }) => {

    const [showTooltip, setShowTooltip] = useState(false);
    const { t } = useLanguage();
    const statusLabel = t(`status.${health.status}`, health.status);
    const recommendations = getHealthRecommendations(health, t);

    const getStatusColor = (status: HealthStatus) => {
        switch (status) {
            case 'excellent': return 'text-emerald-500';
            case 'healthy': return 'text-green-500';
            case 'normal': return 'text-indigo-500';
            case 'warning': return 'text-amber-500';
            case 'critical': return 'text-rose-500';
            case 'stalemate': return 'text-slate-500';
            default: return 'text-slate-400';
        }
    };

    const getStatusBg = (status: HealthStatus) => {
        switch (status) {
            case 'excellent': return 'bg-emerald-500/10';
            case 'healthy': return 'bg-green-500/10';
            case 'normal': return 'bg-indigo-500/10';
            case 'warning': return 'bg-amber-500/10';
            case 'critical': return 'bg-rose-500/10';
            case 'stalemate': return 'bg-slate-500/10';
            default: return 'bg-slate-400/10';
        }
    };

    const dimensions = {
        sm: 'size-8 text-[10px]',
        md: 'size-12 text-xs',
        lg: 'size-20 text-base',
    };

    const strokeWidth = size === 'lg' ? 6 : size === 'md' ? 4 : 3;
    const radius = 50 - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (health.score / 100) * circumference;

    return (
        <div className="relative inline-flex items-center gap-3">
            <div
                className={`relative flex items-center justify-center group ${onOpenDetail ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-help'}`}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={onOpenDetail}
            >
                {/* SVG Gauge */}

                <svg className={`${dimensions[size]} -rotate-90`} viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-slate-200 dark:text-white/5"
                    />
                    {/* Progress Ring */}
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className={`${getStatusColor(health.status)} transition-all duration-1000 ease-out`}
                    />
                </svg>

                {/* Score Text */}
                <span className={`absolute font-black ${getStatusColor(health.status)}`}>
                    {health.score}
                </span>

                {/* Detailed Tooltip */}
                {showTooltip && (
                    <div className="absolute top-full left-0 mt-3 w-72 z-[100] animate-in fade-in zoom-in duration-200">
                        <div className="glass-card bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl border border-white/20 rounded-2xl ring-1 ring-black/5">
                            <div className="flex items-center justify-between mb-3">

                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                                        {t('health.tooltip.title')}
                                        <div className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${getStatusBg(health.status)} ${getStatusColor(health.status)}`}>
                                            {statusLabel}
                                        </div>
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-medium">{t('health.tooltip.subtitle')}</p>
                                </div>
                                <div className="text-right">
                                    <span className="material-symbols-outlined text-slate-400 text-sm">
                                        {health.trend === 'improving' ? 'trending_up' : health.trend === 'declining' ? 'trending_down' : 'trending_flat'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {health.factors.slice(0, 3).map((factor) => {
                                    const { label, description } = getHealthFactorText(factor, t);
                                    return (
                                        <div key={factor.id} className="flex gap-2.5">
                                        <div className={`mt-1 size-1.5 rounded-full shrink-0 ${factor.type === 'positive' ? 'bg-emerald-500' :
                                            factor.type === 'negative' ? 'bg-rose-500' : 'bg-slate-400'
                                            }`} />
                                        <div className="space-y-0.5">
                                            <div className="flex items-center justify-between w-full gap-4">
                                                <div className="text-[10.5px] font-bold text-slate-800 dark:text-white leading-tight">
                                                    {label}
                                                </div>
                                                {factor.impact !== 0 && (
                                                    <div className={`text-[9px] font-black font-mono ${factor.type === 'positive' ? 'text-emerald-500' :
                                                        factor.type === 'negative' ? 'text-rose-500' : 'text-slate-400'}`}>
                                                        {factor.impact > 0 ? '+' : ''}{factor.impact}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-tight">
                                                {description}
                                            </p>
                                        </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {recommendations.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t('health.tooltip.recommendation')}</span>
                                    <p className="text-[10px] font-bold text-[var(--color-primary)] leading-tight italic">
                                        "{recommendations[0]}"
                                    </p>
                                </div>
                            )}

                            {onOpenDetail && (
                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 text-center">
                                    <span className="text-[10px] font-bold text-[var(--color-primary)] flex items-center justify-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                        {t('health.tooltip.fullDetails')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {showLabel && (
                <div className="flex flex-col">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${getStatusColor(health.status)}`}>
                        {statusLabel}
                    </span>
                    <span className="text-xs font-bold text-slate-400 dark:text-white/40 -mt-0.5">
                        {t('health.tooltip.scoreLabel')}
                    </span>
                </div>
            )}
        </div>
    );
};
