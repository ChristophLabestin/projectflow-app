import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAiPanel } from '../../context/AiPanelContext';
import { useAiAccess } from '../../hooks/useAiAccess';
import { AiPlanHint } from '../billing/AiPlanHint';
import { AiActionCard } from './AiActionCard';
import { AiMessageText } from './AiMessageText';
import { AiWorking } from './AiWorking';
import { useAiConversation, type AiConversationMessage } from './core/useAiConversation';
import { isSnapImage, snapImageFromClipboard } from './core/snapImage';
import { useInAppAi } from '../../hooks/useInAppAi';
import { uploadFiles } from '../../services/filesService';
import type { AiProposalPreview } from '../../services/aiAssistClient';
import './ai-ds.scss';
import './ai-family.scss';

/**
 * ⌘J command bar (decision 2026-10-24, direction 2): one slim input like Spotlight/Raycast that knows
 * the current screen; the answer appears as a short text plus compact rows and proposals (action
 * cards) — only as large as needed. Follow-up questions continue the conversation of this object.
 */
const SUGGESTIONS: Record<string, string[]> = {
    dashboard: ['ai.panel.suggest.overdue', 'ai.panel.suggest.planDay', 'ai.panel.suggest.whatsNew'],
    project: ['ai.panel.suggest.projectStatus', 'ai.panel.suggest.projectBlockers', 'ai.panel.suggest.projectNext'],
    task: ['ai.panel.suggest.taskWhat', 'ai.panel.suggest.taskNext', 'ai.panel.suggest.taskSplit'],
    list: ['ai.panel.suggest.listPriorities', 'ai.panel.suggest.overdue'],
    board: ['ai.panel.suggest.listPriorities', 'ai.panel.suggest.projectBlockers'],
    other: ['ai.panel.suggest.overdue', 'ai.panel.suggest.planDay']
};

export const AiCommandBar: React.FC = () => {
    const { t } = useLanguage();
    const location = useLocation();
    const { enabled, open, draft, draftImage, closePanel, getContext } = useAiPanel();
    const { tenantId } = useInAppAi();
    const access = useAiAccess();
    const blocked = access.status === 'addon-required' || access.status === 'plan-required';
    const { messages, running, steps, error, planStatus, chips, context, send, snap, stop, reset } =
        useAiConversation({ active: open, getContext, screenKey: location.pathname });
    const [input, setInput] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [attachImage, setAttachImage] = useState(true);
    const [attachFailed, setAttachFailed] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const imageUrl = useMemo(() => (image ? URL.createObjectURL(image) : ''), [image]);

    useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

    useEffect(() => {
        if (!open) return;
        setInput(draft || '');
        setImage(draftImage);
        setAttachImage(true);
        setAttachFailed(false);
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [open, draft, draftImage]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); if (running) stop(); else closePanel(); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, running, stop, closePanel]);

    if (!enabled || !open) return null;

    const submit = (text: string) => {
        if (running || blocked) return;
        if (image) {
            setInput('');
            setImage(null);
            void snap(image, text);
            return;
        }
        if (!text.trim()) return;
        setInput('');
        void send(text);
    };

    const pickImage = (file: File | null | undefined) => {
        if (!isSnapImage(file)) return;
        setImage(file);
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    /** Snap: attach the original image to the task the user just created from it. */
    const attachTo = (message: AiConversationMessage | undefined, proposal: AiProposalPreview) => (createdId: string | null) => {
        const file = message?.image?.file;
        if (!attachImage || !file || !createdId || !tenantId || proposal.tool !== 'create_task') return;
        const title = String(proposal.changes.find((change) => change.field === 'title')?.to || '');
        void uploadFiles({ tenantId, parent: { type: 'task', id: createdId, projectId: proposal.target.projectId, title }, files: [file] })
            .then((failures) => setAttachFailed(failures.length > 0))
            .catch(() => setAttachFailed(true));
    };

    const last = messages.length && messages[messages.length - 1].role === 'assistant' ? messages[messages.length - 1] : null;
    const question = [...messages].reverse().find((message) => message.role === 'user');
    const snapSource = question?.image ? question : undefined;
    const suggestions = SUGGESTIONS[context.surface] || SUGGESTIONS.other;
    const contextLabel = chips.find((chip) => chip.kind === 'task')?.label || chips.find((chip) => chip.kind === 'project')?.label || chips[0]?.label;
    const stepKey = steps.length ? `ai.step.${steps[steps.length - 1]}` : '';
    const stepLabel = stepKey && t(stepKey) !== stepKey ? t(stepKey) : t('ai.step.default');

    return createPortal(
        <div className="ai-bar-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
            <div className="ai-bar" role="dialog" aria-label={t('ai.panel.title')} data-generating={running ? 'true' : 'false'} data-dragging={dragging ? 'true' : undefined}
                onDragOver={(event) => { if (Array.from(event.dataTransfer.types).includes('Files')) { event.preventDefault(); setDragging(true); } }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
                onDrop={(event) => { event.preventDefault(); setDragging(false); pickImage(snapImageFromClipboard(event.dataTransfer)); }}>
                {dragging && <div className="ai-bar__drop" aria-hidden="true"><span className="material-symbols-outlined">add_photo_alternate</span>{t('ai.snap.drop')}</div>}
                <form className="ai-bar__input" onSubmit={(event) => { event.preventDefault(); submit(input); }}>
                    <span className="ai-bar__mark" aria-hidden="true">✦</span>
                    {image && (
                        <span className="ai-bar__thumb">
                            <img src={imageUrl} alt={t('ai.snap.image')} />
                            <button type="button" onClick={() => setImage(null)} aria-label={t('ai.snap.remove')} title={t('ai.snap.remove')}>
                                <span className="material-symbols-outlined" aria-hidden="true">close</span>
                            </button>
                        </span>
                    )}
                    <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000}
                        onPaste={(event) => { const file = snapImageFromClipboard(event.clipboardData); if (file) { event.preventDefault(); pickImage(file); } }}
                        placeholder={image ? t('ai.snap.placeholder') : messages.length ? t('ai.bar.followUp') : t('ai.bar.placeholder')} aria-label={t('ai.bar.placeholder')} disabled={blocked} />
                    {contextLabel && <span className="ai-bar__context" title={contextLabel}><span className="material-symbols-outlined" aria-hidden="true">{chips.some((chip) => chip.kind === 'task') ? 'task_alt' : 'folder'}</span>{contextLabel}</span>}
                    {!image && !blocked && (
                        <button type="button" className="ai-bar__icon" onClick={() => fileRef.current?.click()} aria-label={t('ai.snap.add')} title={t('ai.snap.add')}>
                            <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
                        </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
                        onChange={(event) => { pickImage(event.target.files?.[0]); event.target.value = ''; }} />
                    {messages.length > 0 && !running && (
                        <button type="button" className="ai-bar__icon" onClick={reset} aria-label={t('ai.panel.reset')} title={t('ai.panel.reset')}>
                            <span className="material-symbols-outlined" aria-hidden="true">restart_alt</span>
                        </button>
                    )}
                </form>

                {(blocked || messages.length > 0 || running || error) ? (
                    <div className="ai-bar__body" aria-live="polite">
                        {blocked && <AiPlanHint status={access.status} />}
                        {!blocked && snapSource && (
                            <div className="ai-bar__snap-source">
                                <img src={snapSource.image!.url} alt={t('ai.snap.image')} />
                                <span>{snapSource.content || t('ai.snap.noNote')}</span>
                            </div>
                        )}
                        {!blocked && !snapSource && question && messages.length > 2 && <p className="ai-bar__question">{question.content}</p>}
                        {!blocked && running && !last?.content && <AiWorking label={stepLabel} className="ai-bar__working" />}
                        {!blocked && last?.snap && (
                            <p className="ai-bar__snap-kind"><span className="ai-bar__snap-tag">{t(`ai.snap.kind.${last.snap.kind}`)}</span>{last.content}</p>
                        )}
                        {!blocked && last?.content && !last.snap && <div className="ai-message"><AiMessageText text={last.content} streaming={running} /></div>}
                        {!blocked && last?.proposals?.map((proposal) => <AiActionCard key={proposal.id} proposal={proposal} onApplied={snapSource ? attachTo(snapSource, proposal) : undefined} />)}
                        {!blocked && last?.snap && !running && (last.proposals?.length ? (
                            <label className="ai-bar__attach">
                                <input type="checkbox" checked={attachImage} onChange={(event) => setAttachImage(event.target.checked)} />
                                {t('ai.snap.attach')}
                                {attachFailed && <span className="ai-bar__attach-error" role="alert">{t('ai.snap.attachFailed')}</span>}
                            </label>
                        ) : <p className="ai-bar__question">{t('ai.snap.nothing')}</p>)}
                        {error && (planStatus ? <AiPlanHint status={planStatus} /> : <p className="ai-bar__error" role="alert">{error}</p>)}
                    </div>
                ) : (
                    <div className="ai-bar__body">
                        <p className="ai-bar__section">{t('ai.bar.suggestions')}</p>
                        <ul className="ai-bar__rows">
                            {!image && (
                                <li>
                                    <button type="button" onClick={() => fileRef.current?.click()}>
                                        <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>{t('ai.snap.hint')}
                                    </button>
                                </li>
                            )}
                            {suggestions.map((key) => (
                                <li key={key}>
                                    <button type="button" onClick={() => submit(t(key))}>
                                        <span className="material-symbols-outlined" aria-hidden="true">subdirectory_arrow_right</span>{t(key)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="ai-bar__foot">
                    <span><kbd>⏎</kbd> {image ? t('ai.snap.analyse') : t('ai.bar.send')}</span>
                    <span><kbd>Esc</kbd> {running ? t('ai.spark.stop') : t('common.close')}</span>
                </div>
            </div>
        </div>,
        document.body
    );
};
