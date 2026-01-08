import React from 'react';
import { RiskWinAnalysis } from '../../../types';
import { Button } from '../common/Button/Button';
import { Card } from '../common/Card/Card';
import { useLanguage } from '../../context/LanguageContext';

interface AnalysisDashboardProps {
    analysis?: RiskWinAnalysis;
    onRunAnalysis?: () => void;
    loading: boolean;
}

type ScoreTone = 'success' | 'warning' | 'danger';

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ analysis, onRunAnalysis, loading }) => {
    const { t } = useLanguage();
    const [loadingStage, setLoadingStage] = React.useState(0);

    React.useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => {
            setLoadingStage((prev) => (prev + 1) % 4);
        }, 1500);
        return () => clearInterval(interval);
    }, [loading]);

    const loadingStages = [
        t('analysisDashboard.loading.stage1'),
        t('analysisDashboard.loading.stage2'),
        t('analysisDashboard.loading.stage3'),
        t('analysisDashboard.loading.stage4'),
    ];

    if (loading) {
        return (
            <div className="analysis-dashboard analysis-dashboard--loading">
                <div className="analysis-dashboard__pulse">
                    <span className="analysis-dashboard__pulse-ring analysis-dashboard__pulse-ring--first" />
                    <span className="analysis-dashboard__pulse-ring analysis-dashboard__pulse-ring--second" />
                    <span className="analysis-dashboard__pulse-core">
                        <span className="material-symbols-outlined">psychology</span>
                    </span>
                </div>

                <h3 className="analysis-dashboard__loading-title">
                    {loadingStages[loadingStage]}
                </h3>
                <p className="analysis-dashboard__loading-subtitle">
                    {t('analysisDashboard.loading.subtitle')}
                </p>

                <div className="analysis-dashboard__loading-progress">
                    <span className="analysis-dashboard__loading-bar" />
                </div>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="analysis-dashboard analysis-dashboard--empty">
                <div className="analysis-dashboard__empty-icon">
                    <span className="material-symbols-outlined">analytics</span>
                </div>
                <h3 className="analysis-dashboard__empty-title">{t('analysisDashboard.empty.title')}</h3>
                <p className="analysis-dashboard__empty-subtitle">{t('analysisDashboard.empty.subtitle')}</p>
                {onRunAnalysis && (
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={onRunAnalysis}
                        isLoading={loading}
                        icon={<span className="material-symbols-outlined">network_intelligence</span>}
                        className="analysis-dashboard__empty-action"
                    >
                        {t('analysisDashboard.empty.action')}
                    </Button>
                )}
            </div>
        );
    }

    const {
        successProbability,
        marketFitScore,
        technicalFeasibilityScore,
        risks,
        wins,
        recommendation,
    } = analysis;

    const getScoreTone = (score: number, max: number = 10): ScoreTone => {
        const percentage = max > 0 ? (score / max) * 100 : 0;
        if (percentage >= 80) return 'success';
        if (percentage >= 50) return 'warning';
        return 'danger';
    };

    const getLevelTone = (level: string): ScoreTone => {
        const normalized = level.toLowerCase();
        if (normalized === 'high') return 'danger';
        if (normalized === 'medium') return 'warning';
        if (normalized === 'low') return 'success';
        return 'warning';
    };

    const levelLabels: Record<string, string> = {
        high: t('analysisDashboard.level.high'),
        medium: t('analysisDashboard.level.medium'),
        low: t('analysisDashboard.level.low'),
    };

    const successTone = getScoreTone(successProbability, 100);
    const marketTone = getScoreTone(marketFitScore);
    const feasibilityTone = getScoreTone(technicalFeasibilityScore);

    return (
        <div className="analysis-dashboard">
            <div className="analysis-dashboard__grid">
                <Card className="analysis-dashboard__card analysis-dashboard__card--gauge">
                    <h4 className="analysis-dashboard__card-label">{t('analysisDashboard.summary.successProbability')}</h4>
                    <div className="analysis-dashboard__gauge">
                        <svg className="analysis-dashboard__gauge-svg" viewBox="0 0 36 36">
                            <path
                                className="analysis-dashboard__gauge-bg"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                            />
                            <path
                                className={`analysis-dashboard__gauge-ring analysis-dashboard__gauge-ring--${successTone}`}
                                strokeDasharray={`${successProbability}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                            />
                        </svg>
                        <div className="analysis-dashboard__gauge-value">
                            <span>{successProbability}%</span>
                        </div>
                    </div>
                </Card>

                <Card className="analysis-dashboard__card">
                    <h4 className="analysis-dashboard__card-label">{t('analysisDashboard.summary.marketFit')}</h4>
                    <div className="analysis-dashboard__score">
                        <div className="analysis-dashboard__score-row">
                            <span className="analysis-dashboard__score-value">
                                {marketFitScore}
                                <span className="analysis-dashboard__score-total">/10</span>
                            </span>
                            <span className="material-symbols-outlined analysis-dashboard__score-icon">storefront</span>
                        </div>
                        <div className="analysis-dashboard__score-bar">
                            <span
                                className={`analysis-dashboard__score-bar-fill analysis-dashboard__score-bar-fill--${marketTone}`}
                                style={{ width: `${(marketFitScore / 10) * 100}%` }}
                            />
                        </div>
                    </div>
                </Card>

                <Card className="analysis-dashboard__card">
                    <h4 className="analysis-dashboard__card-label">{t('analysisDashboard.summary.feasibility')}</h4>
                    <div className="analysis-dashboard__score">
                        <div className="analysis-dashboard__score-row">
                            <span className="analysis-dashboard__score-value">
                                {technicalFeasibilityScore}
                                <span className="analysis-dashboard__score-total">/10</span>
                            </span>
                            <span className="material-symbols-outlined analysis-dashboard__score-icon">code</span>
                        </div>
                        <div className="analysis-dashboard__score-bar">
                            <span
                                className={`analysis-dashboard__score-bar-fill analysis-dashboard__score-bar-fill--${feasibilityTone}`}
                                style={{ width: `${(technicalFeasibilityScore / 10) * 100}%` }}
                            />
                        </div>
                    </div>
                </Card>
            </div>

            <div className="analysis-dashboard__verdict">
                <span className="material-symbols-outlined">psychology_alt</span>
                <div className="analysis-dashboard__verdict-body">
                    <h4 className="analysis-dashboard__verdict-title">{t('analysisDashboard.summary.verdict')}</h4>
                    <p className="analysis-dashboard__verdict-text">"{recommendation}"</p>
                </div>
            </div>

            <div className="analysis-dashboard__columns">
                <div className="analysis-dashboard__column">
                    <h4 className="analysis-dashboard__section-title">
                        <span className="material-symbols-outlined">warning</span>
                        {t('analysisDashboard.summary.risks')}
                    </h4>
                    <div className="analysis-dashboard__list">
                        {risks.map((risk, i) => {
                            const tone = getLevelTone(risk.severity);
                            const label = levelLabels[risk.severity.toLowerCase()] || risk.severity;
                            return (
                                <div key={i} className="analysis-dashboard__item">
                                    <span className={`analysis-dashboard__pill analysis-dashboard__pill--${tone}`}>
                                        {label}
                                    </span>
                                    <div className="analysis-dashboard__item-body">
                                        <p className="analysis-dashboard__item-title">{risk.title}</p>
                                        {risk.mitigation && (
                                            <p className="analysis-dashboard__item-note">
                                                <span className="analysis-dashboard__item-label">
                                                    {t('analysisDashboard.risk.mitigationLabel')}
                                                </span>{' '}
                                                {risk.mitigation}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="analysis-dashboard__column">
                    <h4 className="analysis-dashboard__section-title">
                        <span className="material-symbols-outlined">trophy</span>
                        {t('analysisDashboard.summary.wins')}
                    </h4>
                    <div className="analysis-dashboard__list">
                        {wins.map((win, i) => {
                            const tone = getLevelTone(win.impact);
                            const label = levelLabels[win.impact.toLowerCase()] || win.impact;
                            return (
                                <div key={i} className="analysis-dashboard__item">
                                    <span className={`analysis-dashboard__pill analysis-dashboard__pill--${tone}`}>
                                        {label}
                                    </span>
                                    <div className="analysis-dashboard__item-body">
                                        <p className="analysis-dashboard__item-title">{win.title}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
