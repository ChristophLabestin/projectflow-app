import React, { useEffect, useState } from 'react';

import { Button } from '../components/common/Button/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchOnboardingStats, hasPlatformAdminClaim, type OnboardingStats } from '../services/onboardingInsightsService';
import { SURVEY_OPTIONS, SURVEY_QUESTIONS } from '../utils/onboardingSurvey';
import { NotFound } from './NotFound';
import './onboarding-insights.scss';

type Range = 30 | 0;

const percent = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

/** Platform-admin only: aggregated onboarding survey answers (callable getOnboardingStats). */
export const OnboardingInsights: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [allowed, setAllowed] = useState<boolean | null>(null);
    const [range, setRange] = useState<Range>(30);
    const [stats, setStats] = useState<OnboardingStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        hasPlatformAdminClaim().then((value) => { if (!cancelled) setAllowed(value); }).catch(() => { if (!cancelled) setAllowed(false); });
        return () => { cancelled = true; };
    }, [user?.uid]);

    useEffect(() => {
        if (!allowed) return;
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        fetchOnboardingStats(range || undefined)
            .then((next) => { if (!cancelled) setStats(next); })
            .catch((error) => { console.error(error); if (!cancelled) setFailed(true); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [allowed, range]);

    if (allowed === null) return null;
    if (!allowed) return <NotFound />;

    const total = stats?.total ?? 0;

    return (
        <div className="onboarding-insights">
            <header className="onboarding-insights__head">
                <div>
                    <h1 className="onboarding-insights__title">{t('insights.onboarding.title')}</h1>
                    <p className="onboarding-insights__subtitle">{t('insights.onboarding.subtitle')}</p>
                </div>
                <div className="onboarding-insights__range" role="group">
                    {([30, 0] as const).map((option) => (
                        <Button
                            key={option}
                            size="sm"
                            variant={range === option ? 'primary' : 'ghost'}
                            onClick={() => setRange(option)}
                        >
                            {t(option ? 'insights.onboarding.range30' : 'insights.onboarding.rangeAll')}
                        </Button>
                    ))}
                </div>
            </header>

            {failed && <p className="onboarding-insights__error" role="alert">{t('insights.onboarding.error')}</p>}

            {stats && (
                <>
                    <div className="onboarding-insights__summary">
                        <Card className="onboarding-insights__stat">
                            <strong>{total}</strong>
                            <span>{t('insights.onboarding.responses')}</span>
                        </Card>
                        {Object.entries(stats.platforms).map(([platform, count]) => (
                            <Card key={platform} className="onboarding-insights__stat">
                                <strong>{count}</strong>
                                <span>{t(`insights.onboarding.platform.${platform}`) === `insights.onboarding.platform.${platform}` ? platform : t(`insights.onboarding.platform.${platform}`)} · {percent(count, total)}%</span>
                            </Card>
                        ))}
                    </div>

                    {total === 0 && <p className="onboarding-insights__empty">{t('insights.onboarding.noAnswers')}</p>}

                    {total > 0 && SURVEY_QUESTIONS.map((question) => {
                        const counts = stats.questions[question] || {};
                        const answered = Object.values(counts).reduce((sum, value) => sum + value, 0);
                        // Single-choice percentages are relative to answers; multi-choice to respondents.
                        const base = question === 'useCases' ? total : answered;
                        const ids = [...SURVEY_OPTIONS[question] as readonly string[], ...Object.keys(counts).filter((id) => !(SURVEY_OPTIONS[question] as readonly string[]).includes(id))];
                        return (
                            <Card key={question} className="onboarding-insights__question">
                                <h2>{t(`onboardingSurvey.${question}.label`)}</h2>
                                <ul className="onboarding-insights__bars">
                                    {ids.map((id) => {
                                        const count = counts[id] || 0;
                                        const share = percent(count, base);
                                        return (
                                            <li key={id} className="onboarding-insights__bar">
                                                <span className="onboarding-insights__bar-label">{t(`onboardingSurvey.${question}.${id}`)}</span>
                                                <span className="onboarding-insights__bar-track" aria-hidden="true">
                                                    <span className="onboarding-insights__bar-fill" style={{ width: `${share}%` }} />
                                                </span>
                                                <span className="onboarding-insights__bar-value">{count} · {share}%</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <small className="onboarding-insights__meta">{t('insights.onboarding.answered').replace('{count}', String(answered))}</small>
                            </Card>
                        );
                    })}
                </>
            )}
            {loading && !stats && <p className="onboarding-insights__empty">…</p>}
        </div>
    );
};
