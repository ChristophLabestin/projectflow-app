import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useInAppAi } from '../../../hooks/useInAppAi';
import { AiAssistError, streamAiAssist, type AiFieldKind, type AiWriteAction } from '../../../services/aiAssistClient';
import { aiErrorMessage } from './aiErrors';
import { aiAccessFromError, type AiAccessStatus } from '../../../hooks/useAiAccess';

/**
 * Headless writing assistant for one text field (UI-independent): runs a write action on the whole
 * text or a range, streams the suggestion, and produces the new field value on `apply`. The surface
 * (caret chip, selection tools, popover) only renders `phase`, `suggestion` and `error`.
 */
export type AiWritePhase = 'idle' | 'running' | 'done' | 'error';

export interface AiWriteTarget {
    field: AiFieldKind;
    itemTitle?: string;
    projectTitle?: string;
}

export const useAiWrite = (target: AiWriteTarget) => {
    const { t } = useLanguage();
    const { enabled, tenantId } = useInAppAi();
    const [phase, setPhase] = useState<AiWritePhase>('idle');
    const [suggestion, setSuggestion] = useState('');
    const [error, setError] = useState('');
    /** Set when the server refused for plan reasons → render <AiPlanHint status={planStatus} />. */
    const [planStatus, setPlanStatus] = useState<AiAccessStatus | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastRef = useRef<{ action: AiWriteAction; text: string; instruction?: string; range: { start: number; end: number } | null } | null>(null);

    useEffect(() => () => abortRef.current?.abort(), []);

    /** `value` is the full field value; `range` limits the action to a selection. */
    const run = useCallback(async (action: AiWriteAction, value: string, options: { range?: { start: number; end: number } | null; instruction?: string } = {}) => {
        if (!tenantId) return;
        const range = options.range && options.range.end > options.range.start ? options.range : null;
        const text = range ? value.slice(range.start, range.end) : value;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        lastRef.current = { action, text: value, instruction: options.instruction, range };
        setSuggestion('');
        setError('');
        setPlanStatus(null);
        setPhase('running');
        try {
            const result = await streamAiAssist({
                capability: 'write',
                tenantId,
                input: { action, field: target.field, text, instruction: options.instruction, itemTitle: target.itemTitle, projectTitle: target.projectTitle }
            }, { signal: controller.signal, onDelta: (delta) => setSuggestion((current) => current + delta) });
            if (controller.signal.aborted) return;
            setSuggestion(result.text.trim());
            setPhase('done');
        } catch (caught) {
            if (controller.signal.aborted) return;
            const code = caught instanceof AiAssistError ? caught.code : 'internal';
            setPlanStatus(aiAccessFromError(code));
            setError(aiErrorMessage(code, t));
            setPhase('error');
        }
    }, [tenantId, target.field, target.itemTitle, target.projectTitle, t]);

    const retry = useCallback(() => {
        const last = lastRef.current;
        if (last) void run(last.action, last.text, { range: last.range, instruction: last.instruction });
    }, [run]);

    /** New full field value with the suggestion applied (or null when there is nothing to apply). */
    const applyTo = useCallback((value: string) => {
        const text = suggestion.trim();
        if (!text) return null;
        const range = lastRef.current?.range;
        return range ? `${value.slice(0, range.start)}${text}${value.slice(range.end)}` : text;
    }, [suggestion]);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setPhase('idle');
        setSuggestion('');
        setError('');
        setPlanStatus(null);
    }, []);

    return { enabled, phase, suggestion, error, planStatus, run, retry, applyTo, reset, range: lastRef.current?.range ?? null };
};
