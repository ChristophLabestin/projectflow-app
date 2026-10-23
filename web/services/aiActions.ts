import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/** Screens that load data once listen for this to refresh after an AI change (detail: projectId, taskId). */
export const AI_DATA_CHANGED_EVENT = 'pf:ai-data-changed';

/** Apply / undo an assistant proposal (action card). Server: functions/src/ai-actions.ts. */
export const applyAiProposal = async (proposalId: string) => {
    const call = httpsCallable<{ proposalId: string }, { status: 'applied'; canUndo: boolean; createdId: string | null }>(functions, 'aiApplyProposal');
    return (await call({ proposalId })).data;
};

export const undoAiProposal = async (proposalId: string) => {
    const call = httpsCallable<{ proposalId: string }, { status: 'undone' }>(functions, 'aiUndoProposal');
    return (await call({ proposalId })).data;
};
