import React from 'react';

import { Card } from '../common/Card/Card';
import type { FinanceOperationRun } from '../../types';

interface FinanceOperationRunTimelineProps {
    run: FinanceOperationRun | null;
    formatDateTime: (value: unknown) => string;
    t: (key: string) => string;
}

export const FinanceOperationRunTimeline = ({ run, formatDateTime, t }: FinanceOperationRunTimelineProps) => {
    if (!run) {
        return (
            <Card className="finance-panel finance-panel--expanded">
                <div className="finance-empty">{t('finance.functions.run.emptySelection')}</div>
            </Card>
        );
    }

    return (
        <Card className="finance-panel finance-panel--expanded">
            <div className="finance-panel__header">
                <div>
                    <h3 className="h4">{t('finance.functions.run.title')}</h3>
                    <p className="text-muted">{run.operationType}</p>
                </div>
                <span className={`finance-pill finance-pill--${run.status}`}>{run.status}</span>
            </div>

            <div className="finance-functions-run-meta">
                <span>{`${t('finance.functions.run.id')}: ${run.id}`}</span>
                <span>{`${t('finance.functions.run.risk')}: ${run.risk}`}</span>
                <span>{`${t('finance.functions.run.createdAt')}: ${formatDateTime(run.createdAt)}`}</span>
                <span>{`${t('finance.functions.run.finishedAt')}: ${formatDateTime(run.finishedAt)}`}</span>
            </div>

            <div className="finance-functions-run-steps">
                {(run.steps || []).map((step, index) => (
                    <div className="finance-functions-run-step" key={`${step.name}-${index}`}>
                        <div className="finance-functions-run-step__head">
                            <strong>{step.name}</strong>
                            <span className={`finance-pill finance-pill--${step.status}`}>{step.status}</span>
                        </div>
                        <div className="finance-functions-run-step__meta">
                            <span>{`${t('finance.functions.run.startedAt')}: ${formatDateTime(step.startedAt)}`}</span>
                            <span>{`${t('finance.functions.run.finishedAt')}: ${formatDateTime(step.finishedAt)}`}</span>
                        </div>
                        {step.error && (
                            <p className="finance-functions-run-step__error">{step.error}</p>
                        )}
                    </div>
                ))}
            </div>

            {(run.warnings || []).length > 0 && (
                <div className="finance-functions-run-warnings">
                    <h4 className="h5">{t('finance.functions.run.warnings')}</h4>
                    <ul>
                        {(run.warnings || []).map((warning, index) => (
                            <li key={`${warning}-${index}`}>{warning}</li>
                        ))}
                    </ul>
                </div>
            )}

            {(run.artifacts || []).length > 0 && (
                <div className="finance-functions-run-artifacts">
                    <h4 className="h5">{t('finance.functions.run.artifacts')}</h4>
                    {(run.artifacts || []).map((artifact, index) => (
                        <div className="finance-functions-run-artifact" key={`${artifact.name}-${index}`}>
                            <strong>{artifact.name}</strong>
                            <span>{artifact.type}</span>
                            {artifact.payloadPreview && (
                                <pre>{artifact.payloadPreview}</pre>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};
