import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listRecentThreads, type AiThreadSummary } from '../../services/aiThreads';
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
/** „vor 5 Min.“ / „5 min ago“ for the history rows. */
const relativeTime = (millis: number, language: string) => {
    const minutes = Math.round((millis - Date.now()) / 60000);
    const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' });
    if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return format.format(hours, 'hour');
    return format.format(Math.round(hours / 24), 'day');
};

const SUGGESTIONS: Record<string, string[]> = {
    dashboard: ['ai.panel.suggest.overdue', 'ai.panel.suggest.planDay', 'ai.panel.suggest.whatsNew'],
    project: ['ai.panel.suggest.projectStatus', 'ai.panel.suggest.projectBlockers', 'ai.panel.suggest.projectNext'],
    task: ['ai.panel.suggest.taskWhat', 'ai.panel.suggest.taskNext', 'ai.panel.suggest.taskSplit'],
    list: ['ai.panel.suggest.listPriorities', 'ai.panel.suggest.overdue'],
    board: ['ai.panel.suggest.listPriorities', 'ai.panel.suggest.projectBlockers'],
    other: ['ai.panel.suggest.overdue', 'ai.panel.suggest.planDay']
};

export interface AiCommandBarProps {
    /** `window`: desktop AI pop-out (no scrim/portal; the window is the frame). */
    variant?: 'overlay' | 'window';
    /** Desktop pop-out: "attach screen" (only on click). */
    onCaptureScreen?: () => Promise<File | null>;
    /** Desktop pop-out: open app links in the main window instead of navigating the pop-out. */
    onNavigate?: (path: string) => void;
}

export const AiCommandBar: React.FC<AiCommandBarProps> = ({ variant = 'overlay', onCaptureScreen, onNavigate }) => {
    const { t, language } = useLanguage();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { enabled, open, draft, draftImage, autoSend, closePanel, getContext } = useAiPanel();
    const { tenantId } = useInAppAi();
    const access = useAiAccess();
    const blocked = access.status === 'addon-required' || access.status === 'plan-required';
    const { messages, running, steps, error, planStatus, context, threadReady, send, snap, stop, reset } =
        useAiConversation({ active: open, getContext, screenKey: location.pathname });
    const [input, setInput] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [attachImage, setAttachImage] = useState(true);
    const [attachFailed, setAttachFailed] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const imageUrl = useMemo(() => (image ? URL.createObjectURL(image) : ''), [image]);

    useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

    // History: recent conversations of this workspace, shown while the bar is empty.
    const [recent, setRecent] = useState<AiThreadSummary[]>([]);
    const empty = messages.length === 0;
    useEffect(() => {
        if (!open || !empty || !user || !tenantId) return undefined;
        let alive = true;
        listRecentThreads(user.uid, tenantId).then((list) => { if (alive) setRecent(list); }).catch(() => undefined);
        return () => { alive = false; };
    }, [open, empty, user, tenantId]);

    // Section actions open the bar with a prompt to send right away (once per opening, after the thread loaded).
    const autoSent = useRef(false);
    useEffect(() => { if (!open) autoSent.current = false; }, [open]);

    useEffect(() => {
        if (!open) return;
        setInput(autoSend ? '' : draft || '');
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

    useEffect(() => {
        if (!open || !autoSend || !draft.trim() || !threadReady || running || blocked || autoSent.current) return;
        autoSent.current = true;
        void send(draft, { standalone: true });
    }, [open, autoSend, draft, threadReady, running, blocked, send]);

    if (!enabled || !open) return null;

    const submit = (text: string) => {
        if (running || blocked) return;
        if (image) {
            setInput('');
            setImage(null);
            void snap(image, text);
            requestAnimationFrame(() => inputRef.current?.focus());
            return;
        }
        if (!text.trim()) return;
        setInput('');
        void send(text);
        // Clicking a suggestion moves focus to the button: keep the input ready for the follow-up.
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    /** Reopen a past conversation: go to its object; the bar follows the screen and loads that thread. */
    const openThread = (thread: AiThreadSummary) => {
        if (variant === 'window' && onNavigate) onNavigate(thread.route);
        else navigate(thread.route);
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
    const stepKey = steps.length ? `ai.step.${steps[steps.length - 1]}` : '';
    const stepLabel = stepKey && t(stepKey) !== stepKey ? t(stepKey) : t('ai.step.default');

    const captureScreen = async () => {
        if (!onCaptureScreen || capturing) return;
        setCapturing(true);
        try { pickImage(await onCaptureScreen()); } finally { setCapturing(false); }
    };

    const bar = (
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
                    {!image && !blocked && onCaptureScreen && (
                        <button type="button" className="ai-bar__icon" onClick={() => void captureScreen()} disabled={capturing} aria-label={t('ai.snap.screen')} title={t('ai.snap.screen')}>
                            <span className="material-symbols-outlined" aria-hidden="true">screenshot_monitor</span>
                        </button>
                    )}
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
                        {recent.filter((thread) => thread.route !== location.pathname).length > 0 && (
                            <>
                                <p className="ai-bar__section ai-bar__section--spaced">{t('ai.bar.recent')}</p>
                                <ul className="ai-bar__rows ai-bar__rows--recent">
                                    {recent.filter((thread) => thread.route !== location.pathname).map((thread) => (
                                        <li key={thread.key}>
                                            <button type="button" onClick={() => openThread(thread)} title={thread.question}>
                                                <span className="material-symbols-outlined" aria-hidden="true">history</span>
                                                <span className="ai-bar__recent-question">{thread.question}</span>
                                                <span className="ai-bar__recent-meta">{[thread.label, thread.updatedAt ? relativeTime(thread.updatedAt, language) : ''].filter(Boolean).join(' · ')}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                )}

                <div className="ai-bar__foot">
                    <span><kbd>⏎</kbd> {image ? t('ai.snap.analyse') : t('ai.bar.send')}</span>
                    <span><kbd>Esc</kbd> {running ? t('ai.spark.stop') : t('common.close')}</span>
                </div>
            </div>
    );

    if (variant === 'window') {
        return (
            <div className="ai-bar-window" onClickCapture={(event) => {
                const anchor = (event.target as HTMLElement).closest('a');
                const href = anchor?.getAttribute('href') || '';
                if (onNavigate && href.startsWith('/')) {
                    event.preventDefault();
                    event.stopPropagation();
                    onNavigate(href);
                }
            }}>
                {bar}
            </div>
        );
    }

    return createPortal(
        <div className="ai-bar-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
            {bar}
        </div>,
        document.body
    );
};
