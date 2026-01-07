import React, { useState } from 'react';
import { ProjectHealth } from '../../services/healthService';
import { useLanguage } from '../../context/LanguageContext';
import { getHealthFactorText, getHealthRecommendations } from '../../utils/healthLocalization';
import './health-indicator.scss';

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

    const strokeWidth = size === 'lg' ? 6 : size === 'md' ? 4 : 3;
    const radius = 50 - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (health.score / 100) * circumference;
    const sizeClass = `health-indicator--${size}`;
    const statusClass = `health-indicator--${health.status}`;
    const interactionClass = onOpenDetail ? 'health-indicator--interactive' : '';

    return (
        <div className={`health-indicator ${sizeClass} ${statusClass} ${interactionClass}`.trim()}>
            <div
                className="health-indicator__ring"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={onOpenDetail}
            >
                {/* SVG Gauge */}

                <svg className="health-indicator__svg" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="health-indicator__track"
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
                        className="health-indicator__progress"
                    />
                </svg>

                {/* Score Text */}
                <span className="health-indicator__score">
                    {health.score}
                </span>

                {/* Detailed Tooltip */}
                {showTooltip && (
                    <div className="health-indicator__tooltip">
                        <div className="health-indicator__tooltip-header">
                            <div>
                                <h4 className="health-indicator__tooltip-title">
                                    {t('health.tooltip.title')}
                                    <span className="health-indicator__status-pill">{statusLabel}</span>
                                </h4>
                                <p className="health-indicator__tooltip-subtitle">{t('health.tooltip.subtitle')}</p>
                            </div>
                            <div className="health-indicator__trend">
                                <span className="material-symbols-outlined health-indicator__trend-icon">
                                    {health.trend === 'improving' ? 'trending_up' : health.trend === 'declining' ? 'trending_down' : 'trending_flat'}
                                </span>
                            </div>
                        </div>

                        <div className="health-indicator__factors">
                            {health.factors.slice(0, 3).map((factor) => {
                                const { label, description } = getHealthFactorText(factor, t);
                                return (
                                    <div key={factor.id} className="health-indicator__factor">
                                        <span className={`health-indicator__factor-dot health-indicator__factor-dot--${factor.type}`} />
                                        <div className="health-indicator__factor-body">
                                            <div className="health-indicator__factor-header">
                                                <span className="health-indicator__factor-title">{label}</span>
                                                {factor.impact !== 0 && (
                                                    <span className={`health-indicator__factor-impact health-indicator__factor-impact--${factor.type}`}>
                                                        {factor.impact > 0 ? '+' : ''}{factor.impact}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="health-indicator__factor-text">{description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {recommendations.length > 0 && (
                            <div className="health-indicator__recommendation">
                                <span className="health-indicator__recommendation-label">{t('health.tooltip.recommendation')}</span>
                                <p className="health-indicator__recommendation-text">"{recommendations[0]}"</p>
                            </div>
                        )}

                        {onOpenDetail && (
                            <div className="health-indicator__footer">
                                <span className="health-indicator__footer-text">
                                    <span className="material-symbols-outlined health-indicator__footer-icon">open_in_new</span>
                                    {t('health.tooltip.fullDetails')}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showLabel && (
                <div className="health-indicator__label">
                    <span className="health-indicator__label-title">
                        {statusLabel}
                    </span>
                    <span className="health-indicator__label-subtitle">
                        {t('health.tooltip.scoreLabel')}
                    </span>
                </div>
            )}
        </div>
    );
};
