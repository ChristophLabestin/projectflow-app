import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useInAppAi } from '../../../hooks/useInAppAi';
import { AiAssistError, streamAiAssist, type AiChatMessage, type AiContextEnvelope, type AiProposalPreview, type AiSnapResult } from '../../../services/aiAssistClient';
import { prepareSnapImage } from './snapImage';
import { clearThread, loadThread, saveThread, threadKey } from '../../../services/aiThreads';
import { aiErrorMessage } from './aiErrors';
import { aiAccessFromError, type AiAccessStatus } from '../../../hooks/useAiAccess';

/**
 * Headless conversation with the in-app assistant (UI-independent; any surface — popover, command bar,
 * panel — renders it). Owns: screen context, thread per object (30 days), streaming, tool steps,
 * proposals for action cards, abort, errors. Concept §4, §5.
 */
export type AiConversationMessage = AiChatMessage & {
    proposals?: AiProposalPreview[];
    /** Snap: the user's image (object URL for the thumbnail, original file for attaching). */
    image?: { url: string; file: File };
    snap?: AiSnapResult;
};
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
    const [planStatus, setPlanStatus] = useState<AiAccessStatus | null>(null);
    const [chips, setChips] = useState<AiContextChip[]>([]);
    const chipsRef = useRef<AiContextChip[]>([]);
    chipsRef.current = chips;
    const [context, setContext] = useState<AiContextEnvelope>({ surface: 'other' });
    /** The object's saved thread is loaded: sending now cannot be overwritten by the load. */
    const [threadReady, setThreadReady] = useState(false);
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
        setThreadReady(false);
        void loadThread(user.uid, key).then((loaded) => {
            if (keyRef.current !== key) return;
            setMessages(loaded);
            setThreadReady(true);
        });
    }, [active, screenKey, getContext, user, tenantId, t]);

    useEffect(() => () => abortRef.current?.abort(), []);

    /** `standalone`: a self-contained request (section actions) — the model does not see the earlier turns. */
    const send = useCallback(async (text: string, options: { standalone?: boolean } = {}) => {
        const content = text.trim();
        if (!content || running || !tenantId || !user) return;
        const key = keyRef.current;
        const earlierTurns: AiChatMessage[] = messages.filter((message) => !message.image && !message.snap && message.content).map(({ role, content: body }) => ({ role, content: body }));
        const history: AiChatMessage[] = [...earlierTurns, { role: 'user', content }];
        const modelHistory: AiChatMessage[] = options.standalone ? [{ role: 'user', content }] : history;
        const earlier: AiConversationMessage[] = [...messages, { role: 'user', content }];
        let proposals: AiProposalPreview[] = [];
        let answer = '';
        const show = () => setMessages([...earlier, { role: 'assistant', content: answer, proposals }]);
        show();
        setSteps([]);
        setError('');
        setPlanStatus(null);
        setRunning(true);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            await streamAiAssist({ capability: 'assist', tenantId, messages: modelHistory, context }, {
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
            if (keyRef.current === key) {
                const label = chipsRef.current.find((chip) => chip.kind === 'task')?.label || chipsRef.current.find((chip) => chip.kind === 'project')?.label || chipsRef.current[0]?.label;
                void saveThread(user.uid, key, tenantId, [...history, { role: 'assistant', content: answer }], { route: screenKey, label }).catch(() => undefined);
            }
        } catch (caught) {
            if (!controller.signal.aborted) {
                const code = caught instanceof AiAssistError ? caught.code : 'internal';
                setPlanStatus(aiAccessFromError(code));
                setError(aiErrorMessage(code, t));
            }
            setMessages(answer || proposals.length ? [...earlier, { role: 'assistant', content: answer, proposals }] : earlier);
        } finally {
            setRunning(false);
            setSteps([]);
        }
    }, [messages, running, tenantId, user, context, screenKey, t]);

    /** Snap: image (+ optional note) → recognized kind, short summary and task proposals. Not saved to the thread. */
    const snap = useCallback(async (file: File, note: string) => {
        if (running || !tenantId || !user) return;
        const earlier: AiConversationMessage[] = [...messages, { role: 'user', content: note.trim(), image: { url: URL.createObjectURL(file), file } }];
        let proposals: AiProposalPreview[] = [];
        let result: AiSnapResult | undefined;
        const show = () => setMessages([...earlier, { role: 'assistant', content: result?.summary || '', proposals, snap: result }]);
        setMessages(earlier);
        setSteps(['snap_look']);
        setError('');
        setPlanStatus(null);
        setRunning(true);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const image = await prepareSnapImage(file);
            await streamAiAssist({ capability: 'snap', tenantId, input: { image, note: note.trim() || undefined }, context }, {
                signal: controller.signal,
                onSnap: (snapped) => { result = snapped; show(); },
                onProposal: (proposal) => { proposals = [...proposals, proposal]; show(); },
                onStep: ({ tool }) => setSteps((current) => [...current, tool])
            });
            if (!result) result = { kind: 'other' };
            show();
        } catch (caught) {
            if (!controller.signal.aborted) {
                const code = caught instanceof AiAssistError ? caught.code : 'internal';
                setPlanStatus(aiAccessFromError(code));
                setError(aiErrorMessage(code, t));
            }
            if (result || proposals.length) show();
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

    return { messages, running, steps, error, planStatus, chips, context, threadReady, send, snap, stop, reset };
};
