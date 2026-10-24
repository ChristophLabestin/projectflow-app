import { auth } from './firebase';
import { getAIResponseInstruction } from '../utils/aiLanguage';

/**
 * Streaming client for the in-app assistant endpoint `aiAssist` (Server-Sent Events).
 * Concept: brain/plans/in-app-ai-concept.md §4.4. Production goes through the same-origin hosting
 * rewrite `/api/assist`; the emulator and other origins call the function URL directly.
 */

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const PROD_ORIGINS = ['https://app.getprojectflow.com', 'https://projectflow-labestin.web.app', 'https://projectflow-labestin.firebaseapp.com'];

const assistUrl = () => {
    if (useEmulators) {
        const port = Number(import.meta.env.VITE_EMULATOR_FUNCTIONS_PORT) || 5001;
        return `http://127.0.0.1:${port}/${import.meta.env.VITE_EMULATOR_PROJECT_ID || 'demo-projectflow'}/europe-west3/aiAssist`;
    }
    if (typeof location !== 'undefined' && PROD_ORIGINS.includes(location.origin)) return '/api/assist';
    return `https://europe-west3-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/aiAssist`;
};

export type AiWriteAction = 'draft' | 'expand' | 'shorten' | 'rephrase' | 'friendlier' | 'formal' | 'bullets' | 'translate' | 'fix' | 'custom';
export type AiFieldKind = 'description' | 'comment' | 'title' | 'wiki' | 'freeText';

export interface AiWriteInput {
    action: AiWriteAction;
    field: AiFieldKind;
    text: string;
    instruction?: string;
    itemTitle?: string;
    projectTitle?: string;
    /** Text around the target (context only): before/after the caret or the selection. */
    before?: string;
    after?: string;
}

export interface AiContextEnvelope {
    surface: string;
    route?: string;
    projectId?: string;
    entity?: { kind: 'task' | 'project'; id: string; projectId?: string };
    selection?: { ids?: string[]; text?: string };
    view?: { items?: Array<{ id: string; title: string }> };
}

export interface AiChatMessage { role: 'user' | 'assistant'; content: string }

export type AiAssistRequest =
    | { capability: 'write'; tenantId: string; input: AiWriteInput }
    | { capability: 'assist'; tenantId: string; messages: AiChatMessage[]; context: AiContextEnvelope }
    | { capability: 'snap'; tenantId: string; input: { image: string; note?: string; projectId?: string }; context: AiContextEnvelope };

export type AiSnapKind = 'bug' | 'error' | 'mockup' | 'whiteboard' | 'note' | 'other';
export interface AiSnapResult { kind: AiSnapKind; confidence?: number; summary?: string }

export interface AiProposalPreview {
    id: string;
    tool: 'create_task' | 'update_task' | 'add_comment' | 'add_subtask';
    target: { projectId: string; projectTitle?: string; taskId?: string; taskTitle?: string };
    changes: Array<{ field: string; from?: unknown; to: unknown }>;
}

export interface AiStreamHandlers {
    onDelta?: (text: string) => void;
    onProposal?: (proposal: AiProposalPreview) => void;
    onContext?: (context: Record<string, unknown>) => void;
    onStep?: (step: { tool: string }) => void;
    onSnap?: (result: AiSnapResult) => void;
    signal?: AbortSignal;
}

/** Error codes from the endpoint (`code` field), used for user-facing messages. */
export type AiErrorCode =
    | 'unauthenticated' | 'forbidden' | 'disabled' | 'invalid-argument' | 'resource-exhausted'
    | 'credits-exhausted' | 'ai-plan-required' | 'ai-addon-required' | 'provider-quota' | 'provider-unavailable' | 'internal' | 'network' | 'aborted';

export class AiAssistError extends Error {
    constructor(readonly code: AiErrorCode, message: string) {
        super(message);
    }
}

export interface AiAssistResult { text: string; credits?: number; limit?: number }

/** Run one assistant request and stream text deltas; resolves with the full text. */
export const streamAiAssist = async (request: AiAssistRequest, handlers: AiStreamHandlers = {}): Promise<AiAssistResult> => {
    const user = auth.currentUser;
    if (!user) throw new AiAssistError('unauthenticated', 'Not signed in.');
    const token = await user.getIdToken();
    const { language } = getAIResponseInstruction();

    let response: Response;
    try {
        response = await fetch(assistUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...request, language }),
            signal: handlers.signal
        });
    } catch (error: any) {
        if (error?.name === 'AbortError') throw new AiAssistError('aborted', 'Aborted.');
        throw new AiAssistError('network', error?.message || 'Network error.');
    }

    if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new AiAssistError((payload.code as AiErrorCode) || 'internal', payload.error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    const result: AiAssistResult = { text: '' };
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let index: number;
            while ((index = buffer.indexOf('\n\n')) >= 0) {
                const block = buffer.slice(0, index);
                buffer = buffer.slice(index + 2);
                const event = /^event: (.+)$/m.exec(block)?.[1];
                const data = /^data: (.+)$/m.exec(block)?.[1];
                if (!event || !data) continue;
                const payload = JSON.parse(data);
                if (event === 'delta') {
                    text += payload.text;
                    handlers.onDelta?.(payload.text);
                } else if (event === 'context') {
                    handlers.onContext?.(payload);
                } else if (event === 'step') {
                    handlers.onStep?.(payload);
                } else if (event === 'snap') {
                    handlers.onSnap?.(payload);
                } else if (event === 'proposal') {
                    handlers.onProposal?.(payload);
                } else if (event === 'done') {
                    result.credits = payload.credits;
                    result.limit = payload.limit;
                } else if (event === 'error') {
                    throw new AiAssistError(payload.code || 'internal', payload.message || 'AI request failed.');
                }
            }
        }
    } catch (error: any) {
        if (error instanceof AiAssistError) throw error;
        if (error?.name === 'AbortError') throw new AiAssistError('aborted', 'Aborted.');
        throw new AiAssistError('network', error?.message || 'Stream interrupted.');
    }
    result.text = text;
    return result;
};
