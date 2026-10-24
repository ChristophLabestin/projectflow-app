import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { AI_DATA_CHANGED_EVENT, applyAiProposal, undoAiProposal } from '../../services/aiActions';
import type { AiProposalPreview } from '../../services/aiAssistClient';
import './ai-ds.scss';

/**
 * A change the assistant prepared (P3). Nothing happens until „Übernehmen“; afterwards the change can be
 * undone (created items are deleted, changed fields restored). Concept §5 D.
 */
const announceChange = (projectId: string, taskId?: string) =>
    window.dispatchEvent(new CustomEvent(AI_DATA_CHANGED_EVENT, { detail: { projectId, taskId } }));

type State = 'pending' | 'applying' | 'applied' | 'undoing' | 'undone' | 'dismissed' | 'error';

const formatValue = (value: unknown, t: (key: string) => string): string => {
    if (Array.isArray(value)) return value.length ? t('ai.card.people').replace('{count}', String(value.length)) : t('ai.card.none');
    if (value === '' || value === null || value === undefined) return t('ai.card.none');
    return String(value);
};

export interface AiActionCardProps {
    proposal: AiProposalPreview;
    /** Demo/testing: replace the real callables (style guide). */
    onApply?: () => Promise<{ canUndo: boolean; createdId: string | null }>;
    onUndo?: () => Promise<unknown>;
    /** After a successful apply (Snap attaches its image to the created task). */
    onApplied?: (createdId: string | null) => void;
}

export const AiActionCard: React.FC<AiActionCardProps> = ({ proposal, onApply, onUndo, onApplied }) => {
    const { t } = useLanguage();
    const [state, setState] = useState<State>('pending');
    const [canUndo, setCanUndo] = useState(false);
    const [createdId, setCreatedId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const apply = async () => {
        setState('applying');
        setError('');
        try {
            const result = onApply ? await onApply() : await applyAiProposal(proposal.id);
            setCanUndo(result.canUndo);
            setCreatedId(result.createdId);
            setState('applied');
            announceChange(proposal.target.projectId, proposal.target.taskId);
            onApplied?.(result.createdId);
        } catch (caught: any) {
            setError(caught?.message || t('ai.error.internal'));
            setState('error');
        }
    };

    const undo = async () => {
        setState('undoing');
        try {
            await (onUndo ? onUndo() : undoAiProposal(proposal.id));
            setState('undone');
            announceChange(proposal.target.projectId, proposal.target.taskId);
        } catch (caught: any) {
            setError(caught?.message || t('ai.error.internal'));
            setState('applied');
        }
    };

    const { target } = proposal;
    const taskPath = target.taskId ? `/project/${target.projectId}/tasks/${target.taskId}` : null;
    const createdPath = proposal.tool === 'create_task' && createdId ? `/project/${target.projectId}/tasks/${createdId}` : null;

    return (
        <div className={`ai-card ai-card--${state}`} role="group" aria-label={t(`ai.card.tool.${proposal.tool}`)}>
            <div className="ai-card__head">
                <span className="material-symbols-outlined" aria-hidden="true">
                    {proposal.tool === 'create_task' ? 'add_task' : proposal.tool === 'add_comment' ? 'chat' : proposal.tool === 'add_subtask' ? 'checklist' : 'edit'}
                </span>
                <div>
                    <strong>{t(`ai.card.tool.${proposal.tool}`)}</strong>
                    <span className="ai-card__target">
                        {taskPath ? <Link to={taskPath}>{target.taskTitle}</Link> : target.projectTitle}
                        {taskPath && target.projectTitle ? ` · ${target.projectTitle}` : ''}
                    </span>
                </div>
            </div>

            <dl className="ai-card__changes">
                {proposal.changes.map((change) => {
                    const labelKey = `ai.card.field.${change.field}`;
                    const label = t(labelKey);
                    return (
                        <div key={change.field} className="ai-card__change">
                            <dt>{label === labelKey ? change.field : label}</dt>
                            <dd>
                                {'from' in change && (
                                    <><span className="ai-card__from">{formatValue(change.from, t)}</span><span aria-hidden="true"> → </span></>
                                )}
                                <span className="ai-card__to">{formatValue(change.to, t)}</span>
                            </dd>
                        </div>
                    );
                })}
            </dl>

            {error && <p className="ai-card__error" role="alert">{error}</p>}

            <div className="ai-card__actions">
                {(state === 'pending' || state === 'error') && (
                    <>
                        <button type="button" className="ai-card__btn ai-card__btn--primary" onClick={() => void apply()}>{t('ai.card.apply')}</button>
                        <button type="button" className="ai-card__btn" onClick={() => setState('dismissed')}>{t('ai.card.dismiss')}</button>
                    </>
                )}
                {state === 'applying' && <span className="ai-card__status">{t('ai.card.applying')}</span>}
                {state === 'applied' && (
                    <>
                        <span className="ai-card__status ai-card__status--done">
                            <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                            {t('ai.card.applied')}
                        </span>
                        {createdPath && <Link className="ai-card__btn" to={createdPath}>{t('ai.card.open')}</Link>}
                        {canUndo && <button type="button" className="ai-card__btn" onClick={() => void undo()}>{t('ai.card.undo')}</button>}
                    </>
                )}
                {state === 'undoing' && <span className="ai-card__status">{t('ai.card.undoing')}</span>}
                {state === 'undone' && <span className="ai-card__status">{t('ai.card.undone')}</span>}
                {state === 'dismissed' && <span className="ai-card__status">{t('ai.card.dismissed')}</span>}
            </div>
        </div>
    );
};
