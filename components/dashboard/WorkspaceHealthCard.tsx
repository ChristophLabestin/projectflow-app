import React, { useMemo } from 'react';
import { WorkspaceHealth } from '../../services/healthService';
import { useLanguage } from '../../context/LanguageContext';
import './dashboard-cards.scss';

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

    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (health.score / 100) * circumference;

    const strokeClass =
        health.status === 'critical' ? 'stroke-rose-500' :
            health.status === 'warning' ? 'stroke-amber-500' :
                health.status === 'excellent' ? 'stroke-emerald-500' :
                    health.status === 'healthy' ? 'stroke-emerald-400' :
                        'stroke-indigo-500';

    return (
        <div className="health-card">
            <div className="health-card__header">
                <div className="health-card__title-group">
                    <h3 className="health-card__title">{t('dashboard.health.title')}</h3>
                    <p className="health-card__subtitle">{t('dashboard.health.subtitle')}</p>
                </div>
                <div className={`health-card__badge health-card__badge--${health.status}`}>
                    {statusLabels[health.status as keyof typeof statusLabels] || health.status}
                </div>
            </div>

            <div className="health-card__content">
                {/* Radial Gauge */}
                <div className="health-card__gauge">
                    <svg>
                        <circle
                            cx="48" cy="48" r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            style={{ color: 'var(--color-surface-hover)' }}
                        />
                        <circle
                            cx="48" cy="48" r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            className={`${strokeClass}`} // Using standard tailwind class for color here as map was complex, but stroke color is css variable friendly if we define them. 
                            // Actually, let's use inline styles or specific classes if we want to be pure SCSS 
                            // Attempting to rely on the tailwind utility classes for color ONLY is risky if we are removing tailwind.
                            // However, my SCSS file didn't define .stroke-rose-500. 
                            // Let's use style={{ stroke: 'var(--color-xxx)' }} instead.
                            style={{
                                stroke: health.status === 'critical' ? 'var(--color-error)' :
                                    health.status === 'warning' ? 'var(--color-warning)' :
                                        health.status === 'excellent' ? 'var(--color-success-dark)' :
                                            health.status === 'healthy' ? 'var(--color-success)' :
                                                'var(--color-info)'
                            }}
                        />
                    </svg>
                    <div className="health-card__gauge-value">{health.score}</div>
                </div>

                {/* Stat Breakdown */}
                <div className="health-card__stats">
                    <div className="health-card__stat-row">
                        <span className="health-card__stat-row-label">
                            <span className="health-card__stat-row-dot health-card__stat-row-dot--critical"></span> {t('status.critical')}
                        </span>
                        <span className="health-card__stat-row-val">{health.breakdown.critical}</span>
                    </div>
                    <div className="health-card__stat-row">
                        <span className="health-card__stat-row-label">
                            <span className="health-card__stat-row-dot health-card__stat-row-dot--warning"></span> {t('status.warning')}
                        </span>
                        <span className="health-card__stat-row-val">{health.breakdown.warning}</span>
                    </div>
                    <div className="health-card__stat-row">
                        <span className="health-card__stat-row-label">
                            <span className="health-card__stat-row-dot health-card__stat-row-dot--healthy"></span> {t('status.healthy')}
                        </span>
                        <span className="health-card__stat-row-val">{health.breakdown.healthy + health.breakdown.excellent}</span>
                    </div>

                    <div className="health-card__trend">
                        {health.trend === 'improving' ? (
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-success)' }}>trending_up</span>
                        ) : health.trend === 'declining' ? (
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-error)' }}>trending_down</span>
                        ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-text-subtle)' }}>trending_flat</span>
                        )}
                        <span>{t(`trend.${health.trend}`, health.trend)} {t('dashboard.health.trendSuffix')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
