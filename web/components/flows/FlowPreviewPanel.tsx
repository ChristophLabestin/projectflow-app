// Editor side panel: live match preview ("würde auf diese 3 Aufgaben zutreffen") + dry run on one task.
import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../common/Button/Button';
import {
    dryRunFlow,
    flowErrorMessage,
    previewFlow,
    type FlowDefinition,
    type FlowDryRunResult,
    type FlowPreviewResult,
} from '../../services/domain/automationsService';
import { TASKLESS_TRIGGERS, actionSentence, type FlowNameLookup } from './flowText';
import { AiDecisionList } from './FlowRunLog';

interface FlowPreviewPanelProps {
    t: (key: string) => string;
    tenantId: string;
    draft: FlowDefinition;
    names: FlowNameLookup;
    /** Returns an i18n error key when the draft cannot be previewed yet. */
    validate: () => string | null;
    /** Saved, unchanged flows can run for real on a matching task. */
    onRunOnTask?: (target: { taskId: string; projectId: string }) => void;
}

export const FlowPreviewPanel: React.FC<FlowPreviewPanelProps> = ({ t, tenantId, draft, names, validate, onRunOnTask }) => {
    const [preview, setPreview] = useState<FlowPreviewResult | null>(null);
    const [dryRun, setDryRun] = useState<{ taskId: string; result: FlowDryRunResult } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const taskless = TASKLESS_TRIGGERS.has(draft.trigger.type);

    const runPreview = useCallback(async () => {
        const invalid = validate();
        if (invalid) {
            setError(t(invalid));
            return;
        }
        setBusy('preview');
        setError(null);
        setDryRun(null);
        try {
            setPreview(await previewFlow(tenantId, draft));
        } catch (err) {
            setError(flowErrorMessage(err) || t('flows.preview.error'));
        } finally {
            setBusy(null);
        }
    }, [draft, tenantId, t, validate]);

    const runDry = async (taskId: string, projectId: string) => {
        setBusy(taskId);
        setError(null);
        try {
            setDryRun({ taskId, result: await dryRunFlow(tenantId, draft, taskId, projectId) });
        } catch (err) {
            setError(flowErrorMessage(err) || t('flows.preview.error'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <section className="flow-panel" aria-label={t('flows.preview.title')}>
            <header className="flow-panel__header">
                <div>
                    <h2>{t('flows.preview.title')}</h2>
                    <p>{t(taskless ? 'flows.preview.tasklessHint' : 'flows.preview.hint')}</p>
                </div>
                {!taskless && (
                    <Button size="sm" variant="secondary" onClick={() => void runPreview()} isLoading={busy === 'preview'}
                        icon={<span className="material-symbols-outlined">manage_search</span>}>
                        {preview ? t('flows.preview.refresh') : t('flows.preview.run')}
                    </Button>
                )}
            </header>
            {error && <p className="flow-panel__error" role="alert">{error}</p>}
            {preview && (
                <div className="flow-preview">
                    <p className="flow-preview__summary">
                        {(preview.total === 1 ? t('flows.preview.matchesOne') : t('flows.preview.matches'))
                            .replace('{count}', String(preview.total)).replace('{scanned}', String(preview.scanned))}
                    </p>
                    <ul className="flow-preview__list">
                        {preview.tasks.map((task) => (
                            <li key={task.id} className="flow-preview__task">
                                <div className="flow-preview__task-main">
                                    <Link to={`/project/${task.projectId}/tasks/${task.id}`} className="flow-preview__task-title">{task.title || task.id}</Link>
                                    {task.aiPending && <span className="flow-preview__ai">{t('flows.preview.aiPending')}</span>}
                                    <span className="flow-preview__task-meta">
                                        {[names.project(task.projectId), task.status && t(`flows.status.${task.status}`), task.priority && t(`flows.priority.${task.priority}`)]
                                            .filter(Boolean).join(' · ')}
                                    </span>
                                </div>
                                <div className="flow-preview__task-actions">
                                    <Button size="sm" variant="ghost" isLoading={busy === task.id} onClick={() => void runDry(task.id, task.projectId)}>
                                        {t('flows.preview.dryRun')}
                                    </Button>
                                    {onRunOnTask && (
                                        <Button size="sm" variant="ghost" onClick={() => onRunOnTask({ taskId: task.id, projectId: task.projectId })}
                                            icon={<span className="material-symbols-outlined">play_arrow</span>} aria-label={t('flows.run.onTask')} title={t('flows.run.onTask')} />
                                    )}
                                </div>
                                {dryRun?.taskId === task.id && Boolean(dryRun.result.decisions?.length || dryRun.result.aiError) && (
                                    <div className="flow-preview__decisions">
                                        <AiDecisionList t={t} decisions={dryRun.result.decisions || []} />
                                        {dryRun.result.aiError && <p className="flow-panel__error">{dryRun.result.aiError}</p>}
                                        {!dryRun.result.matches && <p className="flow-hint">{t('flows.preview.wouldNotRun')}</p>}
                                    </div>
                                )}
                                {dryRun?.taskId === task.id && (
                                    <ol className="flow-dry-run">
                                        {dryRun.result.steps.map((step) => {
                                            const action = draft.actions.find((a) => a.id === step.actionId);
                                            return (
                                                <li key={step.actionId} className={`flow-dry-run__step is-${step.status}`}>
                                                    <span className="material-symbols-outlined" aria-hidden="true">
                                                        {step.status === 'failed' ? 'error' : step.status === 'noop' ? 'remove' : 'check'}
                                                    </span>
                                                    <span>
                                                        {action ? actionSentence(action, t, names) : step.type}
                                                        <em>{t(`flows.preview.step.${step.status}`)}{step.error ? ` – ${step.error}` : ''}</em>
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                )}
                            </li>
                        ))}
                    </ul>
                    {preview.total === 0 && <p className="flow-hint">{t('flows.preview.none')}</p>}
                </div>
            )}
        </section>
    );
};
