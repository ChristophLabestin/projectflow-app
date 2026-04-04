import React from 'react';

import { Button } from '../common/Button/Button';
import { Card } from '../common/Card/Card';
import type { FinanceOperationRecommendation } from '../../types';

interface FinanceOpsAssistantPanelProps {
    recommendations: FinanceOperationRecommendation[];
    loading: boolean;
    enabled: boolean;
    onRefresh: () => Promise<void>;
    onUseRecommendation: (recommendation: FinanceOperationRecommendation) => void;
    t: (key: string) => string;
}

const toPercent = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

export const FinanceOpsAssistantPanel = ({
    recommendations,
    loading,
    enabled,
    onRefresh,
    onUseRecommendation,
    t,
}: FinanceOpsAssistantPanelProps) => {
    return (
        <Card className="finance-panel finance-panel--expanded">
            <div className="finance-panel__header">
                <div>
                    <h3 className="h4">{t('finance.functions.ai.title')}</h3>
                    <p className="text-muted">{t('finance.functions.ai.subtitle')}</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void onRefresh()}
                    isLoading={loading}
                    disabled={!enabled}
                >
                    {t('finance.functions.ai.refresh')}
                </Button>
            </div>

            {!enabled ? (
                <div className="finance-empty">{t('finance.functions.ai.disabled')}</div>
            ) : loading ? (
                <div className="finance-loading">{t('finance.functions.ai.loading')}</div>
            ) : recommendations.length === 0 ? (
                <div className="finance-empty">{t('finance.functions.ai.empty')}</div>
            ) : (
                <div className="finance-functions-ai-list">
                    {recommendations.map((recommendation, index) => (
                        <div className="finance-functions-ai-item" key={`${recommendation.operationType}-${index}`}>
                            <div className="finance-functions-ai-item__header">
                                <strong>{recommendation.operationType}</strong>
                                <span className={`finance-pill finance-pill--${recommendation.risk}`}>{recommendation.risk}</span>
                            </div>
                            <p className="text-muted">{recommendation.rationale}</p>
                            <p>{recommendation.whyNow}</p>
                            <div className="finance-functions-ai-item__meta">
                                <span>{`${t('finance.functions.ai.confidence')}: ${toPercent(recommendation.confidence)}`}</span>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onUseRecommendation(recommendation)}
                            >
                                {t('finance.functions.ai.use')}
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};
