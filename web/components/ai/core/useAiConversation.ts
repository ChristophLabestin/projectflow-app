import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useInAppAi } from '../../../hooks/useInAppAi';
import { AiAssistError, streamAiAssist, type AiChatMessage, type AiContextEnvelope, type AiProposalPreview } from '../../../services/aiAssistClient';
import { clearThread, loadThread, saveThread, threadKey } from '../../../services/aiThreads';
import { aiErrorMessage } from './aiErrors';

/**
 * Headless conversation with the in-app assistant (UI-independent; any surface — popover, command bar,
 * panel — renders it). Owns: screen context, thread per object (30 days), streaming, tool steps,
 * proposals for action cards, abort, errors. Concept §4, §5.
 */
export type AiConversationMessage = AiChatMessage & { proposals?: AiProposalPreview[] };
export type AiContextChip = { kind: 'project' | 'task' | 'selection' | 'surface'; label: string };

export interface UseAiConversationOptions {
    /** Load/follow the thread only while the surface is visible. */
    active: boolean;
    getContext: () => AiContextEnvelope;
    /** Changes when the screen changes (e.g. location.pathname) so context + thread follow it. */
    screenKey: string;
}

export const useAiConversation = ({ active, getContext, screenKey }: UseAiConversationOptions) => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const { tenantId } = useInAppAi();
    const [messages, setMessages] = useState<AiConversationMessage[]>([]);
    const [running, setRunning] = useState(false);
    const [steps, setSteps] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [chips, setChips] = useState<AiContextChip[]>([]);
    const [context, setContext] = useState<AiContextEnvelope>({ surface: 'other' });
    const abortRef = useRef<AbortController | null>(null);
    const keyRef = useRef('');

    useEffect(() => {
        if (!active) return;
        const next = getContext();
        setContext(next);
        setChips(next.entity
            ? [{ kind: next.entity.kind, label: t(`ai.panel.chip.${next.entity.kind}`) }]
            : [{ kind: 'surface', label: t(`ai.panel.surface.${next.surface}`) }]);
        if (!user || !tenantId) return;
        const key = threadKey(tenantId, next);
        if (key === keyRef.current) return;
        keyRef.current = key;
        abortRef.current?.abort();
        setMessages([]);
        setSteps([]);
        setError('');
        void loadThread(user.uid, key).then((loaded) => { if (keyRef.current === key) setMessages(loaded); });
    }, [active, screenKey, getContext, user, tenantId, t]);

    useEffect(() => () => abortRef.current?.abort(), []);

    const send = useCallback(async (text: string) => {
        const content = text.trim();
        if (!content || running || !tenantId || !user) return;
        const key = keyRef.current;
        const history: AiChatMessage[] = [...messages.map(({ role, content: body }) => ({ role, content: body })), { role: 'user', content }];
        const earlier: AiConversationMessage[] = [...messages, { role: 'user', content }];
        let proposals: AiProposalPreview[] = [];
        let answer = '';
        const show = () => setMessages([...earlier, { role: 'assistant', content: answer, proposals }]);
        show();
        setSteps([]);
        setError('');
        setRunning(true);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            await streamAiAssist({ capability: 'assist', tenantId, messages: history, context }, {
                signal: controller.signal,
                onDelta: (delta) => { answer += delta; show(); },
                onProposal: (proposal) => { proposals = [...proposals, proposal]; show(); },
                onStep: ({ tool }) => setSteps((current) => [...current, tool]),
                onContext: (resolved: any) => {
                    const next: AiContextChip[] = [];
                    if (resolved.project?.title) next.push({ kind: 'project', label: resolved.project.title });
                    if (resolved.task?.title) next.push({ kind: 'task', label: resolved.task.title });
                    if (resolved.selected) next.push({ kind: 'selection', label: t('ai.panel.chip.selected').replace('{count}', String(resolved.selected)) });
                    if (next.length) setChips(next);
                }
            });
            answer = answer.trim() || (proposals.length ? t('ai.panel.proposed') : t('ai.panel.empty'));
            show();
            if (keyRef.current === key) void saveThread(user.uid, key, tenantId, [...history, { role: 'assistant', content: answer }]).catch(() => undefined);
        } catch (caught) {
            if (!controller.signal.aborted) setError(aiErrorMessage(caught instanceof AiAssistError ? caught.code : 'internal', t));
            setMessages(answer || proposals.length ? [...earlier, { role: 'assistant', content: answer, proposals }] : earlier);
        } finally {
            setRunning(false);
            setSteps([]);
        }
    }, [messages, running, tenantId, user, context, t]);

    const stop = useCallback(() => abortRef.current?.abort(), []);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setMessages([]);
        setError('');
        if (user && keyRef.current) void clearThread(user.uid, keyRef.current).catch(() => undefined);
    }, [user]);

    return { messages, running, steps, error, chips, context, send, stop, reset };
};
