// Run log of one flow: status, trigger, steps with errors, "erneut versuchen" for failed runs.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { Button } from '../common/Button/Button';
import { Skeleton } from '../common/Skeleton/Skeleton';
import {
    type FlowAiDecision,
    flowErrorMessage,
    retryFlowRun,
    subscribeFlowRuns,
    type Flow,
    type FlowRun,
} from '../../services/domain/automationsService';
import { actionSentence, type FlowNameLookup } from './flowText';

interface FlowRunLogProps {
    t: (key: string) => string;
    tenantId: string;
    flow: Flow;
    names: FlowNameLookup;
    canRetry: boolean;
}

const STATUS_ICON: Record<string, string> = {
    succeeded: 'check_circle',
    failed: 'error',
    running: 'progress_activity',
    waiting: 'hourglass_top',
    skipped_limit: 'block',
    cancelled: 'cancel',
};

const pct = (value: number | undefined) => `${Math.round((value || 0) * 100)} %`;

/** AI condition results: probability / choice + confidence / score, and whether the flow continued. */
export const AiDecisionList: React.FC<{ t: (key: string) => string; decisions: FlowAiDecision[] }> = ({ t, decisions }) => {
    if (!decisions.length) return null;
    return (
        <ul className="flow-decisions">
            {decisions.map((decision) => (
                <li key={decision.key} className={`flow-decisions__item ${decision.passed ? 'is-passed' : 'is-failed'}`}>
                    <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                    <span>
                        <strong>{decision.question}</strong>
                        <em>
                            {decision.refused ? t('flows.aiCondition.refused')
                                : decision.kind === 'predicate' ? t('flows.aiCondition.probability').replace('{value}', pct(decision.probability))
                                    : decision.kind === 'choice' ? t('flows.aiCondition.choiceResult').replace('{choice}', decision.choice || '–').replace('{confidence}', pct(decision.confidence))
                                        : t('flows.aiCondition.scoreResult').replace('{score}', String(decision.score ?? '–')).replace('{confidence}', pct(decision.confidence))}
                            {' · '}{t(decision.passed ? 'flows.aiCondition.passed' : 'flows.aiCondition.notPassed')}
                        </em>
                    </span>
                </li>
            ))}
        </ul>
    );
};

export const FlowRunLog: React.FC<FlowRunLogProps> = ({ t, tenantId, flow, names, canRetry }) => {
    const { dateLocale } = useLanguage();
    const { showError } = useToast();
    const [runs, setRuns] = useState<FlowRun[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [open, setOpen] = useState<string | null>(null);
    const [retrying, setRetrying] = useState<string | null>(null);

    useEffect(() => subscribeFlowRuns(tenantId, flow.id, setRuns, () => setFailed(true)), [tenantId, flow.id]);

    const retry = async (runId: string) => {
        setRetrying(runId);
        try {
            await retryFlowRun(tenantId, runId);
        } catch (err) {
            showError(flowErrorMessage(err) || t('flows.log.retryFailed'));
        } finally {
            setRetrying(null);
        }
    };

    return (
        <section className="flow-panel" aria-label={t('flows.tab.log')}>
            <header className="flow-panel__header">
                <div>
                    <h2>{t('flows.log.title')}</h2>
                    <p>{t('flows.log.hint')}</p>
                </div>
            </header>
            {failed && <p className="flow-panel__error" role="alert">{t('flows.log.error')}</p>}
            {!runs && !failed && <Skeleton className="flows-skeleton flows-skeleton--small" />}
            {runs && runs.length === 0 && <p className="flow-hint">{t('flows.log.empty')}</p>}
            {runs && runs.length > 0 && (
                <ul className="flow-runs">
                    {runs.map((run) => {
                        const expanded = open === run.id;
                        return (
                            <li key={run.id} className={`flow-run is-${run.status}`}>
                                <button type="button" className="flow-run__row" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : run.id)}>
                                    <span className={`flow-run__icon material-symbols-outlined is-${run.status}`} aria-hidden="true">{STATUS_ICON[run.status] || 'radio_button_unchecked'}</span>
                                    <span className="flow-run__main">
                                        <span className="flow-run__status">{t(`flows.runStatus.${run.status}`)}</span>
                                        <span className="flow-run__meta">
                                            {[
                                                run.startedAtMs ? format(run.startedAtMs, 'Pp', { locale: dateLocale }) : '',
                                                t(`flows.trigger.${run.trigger}`),
                                                run.depth > 1 ? t('flows.log.chain').replace('{depth}', String(run.depth)) : '',
                                            ].filter(Boolean).join(' · ')}
                                        </span>
                                    </span>
                                    <span className="material-symbols-outlined flow-run__chevron" aria-hidden="true">{expanded ? 'expand_less' : 'expand_more'}</span>
                                </button>
                                {expanded && (
                                    <div className="flow-run__details">
                                        {run.taskId && run.projectId && (
                                            <Link to={`/project/${run.projectId}/tasks/${run.taskId}`} className="flow-run__task">
                                                <span className="material-symbols-outlined">task</span>{t('flows.log.openTask')}
                                            </Link>
                                        )}
                                        {run.status === 'skipped_limit' && <p className="flow-hint">{t(`flows.log.skip.${run.skipReason || 'month'}`)}</p>}
                                        {run.status === 'waiting' && run.resumeAtMs && (
                                            <p className="flow-hint">{t('flows.log.waitingUntil').replace('{time}', format(run.resumeAtMs, 'Pp', { locale: dateLocale }))}</p>
                                        )}
                                        <AiDecisionList t={t} decisions={run.decisions} />
                                        {run.error && run.steps.length === 0 && <p className="flow-panel__error">{run.error}</p>}
                                        <ol className="flow-dry-run">
                                            {run.steps.map((step, index) => {
                                                const action = flow.actions.find((a) => a.id === step.actionId);
                                                return (
                                                    <li key={`${step.actionId}-${index}`} className={`flow-dry-run__step is-${step.status}`}>
                                                        <span className="material-symbols-outlined" aria-hidden="true">
                                                            {step.status === 'failed' ? 'error' : step.status === 'noop' ? 'remove' : 'check'}
                                                        </span>
                                                        <span>
                                                            {action ? actionSentence(action, t, names) : t(`flows.action.${step.type}`)}
                                                            <em>
                                                                {t(`flows.log.step.${step.status}`)}{step.error ? ` – ${step.error}` : ''}
                                                                {step.decision ? ` · ${t('flows.aiCondition.choiceResult').replace('{choice}', step.decision.choice).replace('{confidence}', pct(step.decision.confidence))}` : ''}
                                                            </em>
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                        {run.status === 'failed' && canRetry && (
                                            <Button size="sm" variant="secondary" isLoading={retrying === run.id} onClick={() => void retry(run.id)}
                                                icon={<span className="material-symbols-outlined">replay</span>}>
                                                {t('flows.log.retry')}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};
