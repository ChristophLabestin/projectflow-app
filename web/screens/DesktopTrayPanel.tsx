import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePinnedTasks, type PinnedItem } from '../context/PinnedTasksContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useToast } from '../context/UIContext';
import { dayPlanStopPath, useDesktopDayPlan } from '../hooks/useDesktopDayPlan';
import { useDesktopUpdate } from '../hooks/useDesktopUpdate';
import { desktopWindowKind, getDesktopBridge, pinnedItemPath } from '../services/desktop';
import { completeItem, createCapturedTask } from '../services/desktopActions';
import { markAllNotificationsAsRead, markNotificationAsRead, subscribeToNotifications } from '../services/notificationService';
import type { Notification } from '../types';
import type { DayPlanStop } from '../utils/dayPlan';
import { parseCapture, rankProjects } from '../utils/quickCapture';
import logoUrl from '../assets/favicon.svg';

type Tab = 'today' | 'pinned' | 'inbox';
type UpcomingEvent = { id: string; title: string; start: string; end: string };

const notificationPath = (notification: Notification) => {
    if (notification.taskId && notification.projectId) return `/project/${notification.projectId}/tasks/${notification.taskId}`;
    if (notification.projectId) return `/project/${notification.projectId}`;
    if (notification.deepLink?.startsWith('/')) return notification.deepLink;
    return '/notifications';
};

const toMillis = (value: unknown) => {
    if (!value) return 0;
    if (typeof value === 'object' && value && 'seconds' in value) return Number((value as { seconds: number }).seconds) * 1000;
    const parsed = new Date(value as string).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

/** Ticks every `intervalMs` so relative times and the focus timer stay current while the panel is open. */
const useNow = (intervalMs: number) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);
    return now;
};

/** "0:42" (h:mm) since the focus started. */
const formatTimer = (startedAt: string | undefined, now: number) => {
    const start = startedAt ? Date.parse(startedAt) : NaN;
    if (!Number.isFinite(start) || start > now) return null;
    const minutes = Math.floor((now - start) / 60000);
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
};

/**
 * Desktop app only: the menu bar panel (tray click). Focus with running timer and controls, inline capture,
 * today's plan, pinned items, notification inbox, next meeting and quick actions — the app at a glance
 * without opening the main window.
 */
export const DesktopTrayPanel = () => {
    const bridge = getDesktopBridge();
    const update = useDesktopUpdate();
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const { activeWorkspace, activeWorkspaceId, status: workspaceStatus, refresh: refreshWorkspace } = useWorkspace();
    const {
        focusItem, focusState, pinnedItems,
        startFocusItem, snoozeFocusItem, completeFocusItem, pinItem
    } = usePinnedTasks();
    const { plan, loading, handled, reload, complete, message, projects } = useDesktopDayPlan();
    const { showError } = useToast();
    const [tab, setTab] = useState<Tab>('today');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [events, setEvents] = useState<UpcomingEvent[]>([]);
    const [draft, setDraft] = useState('');
    const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [busy, setBusy] = useState(false);
    const now = useNow(15_000);

    const loadEvents = useCallback(async () => {
        setEvents((await bridge?.getUpcomingEvents?.().catch(() => [])) ?? []);
    }, [bridge]);

    // Fresh data every time the panel opens (it stays alive hidden between clicks).
    useEffect(() => {
        void loadEvents();
        return bridge?.onWindowPayload?.(() => {
            // Hidden helper windows may have hit a failed workspace load at startup; retry when opened.
            if (workspaceStatus === 'error') void refreshWorkspace();
            void reload();
            void loadEvents();
            setDraftState('idle');
        });
    }, [bridge, loadEvents, reload, workspaceStatus, refreshWorkspace]);

    useEffect(() => {
        if (!user) return;
        return subscribeToNotifications(user.uid, setNotifications, activeWorkspaceId || undefined);
    }, [user, activeWorkspaceId]);

    const unread = useMemo(() => notifications.filter((notification) => !notification.read), [notifications]);
    const relative = useMemo(() => new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' }), [language]);
    const timeFormat = useMemo(() => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }), [language]);

    if (!bridge || desktopWindowKind() !== 'tray') return <Navigate to="/" replace />;

    if (!user) {
        return (
            <div className="tray-panel">
                <div className="tray-panel__card tray-panel__card--empty">
                    <span className="material-symbols-outlined">lock</span>
                    <p>{t('pinnedTasks.window.signedOut')}</p>
                    <button type="button" className="tray-panel__primary" onClick={() => bridge.appAction?.('show-main')}>
                        {t('pinnedTasks.window.openMain')}
                    </button>
                </div>
            </div>
        );
    }

    const open = (path: string) => bridge.openInMain(path);
    const ago = (millis: number) => {
        const minutes = Math.round((millis - now) / 60000);
        if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
        const hours = Math.round(minutes / 60);
        if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
        return relative.format(Math.round(hours / 24), 'day');
    };

    // --- Focus ---------------------------------------------------------------
    const isSnoozed = focusState?.status === 'snoozed'
        && Boolean(focusState.snoozedUntil)
        && new Date(focusState.snoozedUntil || '').getTime() > now;
    const focusStatus = focusItem ? (isSnoozed ? 'snoozed' : focusState?.status === 'blocked' ? 'blocked' : 'active') : null;
    const timer = focusStatus === 'active' ? formatTimer(focusState?.startedAt, now) : null;
    const suggestion = !focusItem ? plan.stops.find((stop) => stop.canFocus && !handled[stop.id]) : null;

    const startStop = (stop: DayPlanStop) => {
        if (!stop.projectId) return;
        startFocusItem({
            id: stop.taskId,
            type: stop.itemType === 'initiative' ? 'initiative' : 'task',
            title: stop.title,
            projectId: stop.projectId,
            tenantId: stop.tenantId || undefined
        });
    };

    const completeFocus = async () => {
        if (!focusItem || busy) return;
        setBusy(true);
        try {
            await completeItem(focusItem);
            completeFocusItem(focusItem.id);
        } catch {
            showError(t('desktop.toast.actionFailed'));
        } finally {
            setBusy(false);
        }
    };

    // --- Inline capture --------------------------------------------------------
    const parsed = parseCapture(draft);
    const targetProject = parsed.projectQuery ? rankProjects(projects, parsed.projectQuery, 1)[0] ?? null : null;
    const submitDraft = async () => {
        if (!parsed.title || draftState === 'saving') return;
        setDraftState('saving');
        try {
            const created = await createCapturedTask(parsed, targetProject);
            pinItem(created.pinned as PinnedItem);
            setDraft('');
            setDraftState('saved');
            void reload();
            setTab('pinned');
        } catch {
            setDraftState('error');
        }
    };

    // --- Meeting ---------------------------------------------------------------
    const nextEvent = events.find((event) => Date.parse(event.end) > now);
    const eventStart = nextEvent ? Date.parse(nextEvent.start) : 0;
    const eventRunning = nextEvent ? eventStart <= now : false;

    const todayStops = plan.stops.filter((stop) => !stop.proposed);
    const tabs: { id: Tab; label: string; count: number }[] = [
        { id: 'today', label: t('desktop.tray.tabs.today'), count: todayStops.filter((stop) => !handled[stop.id]).length },
        { id: 'pinned', label: t('desktop.tray.tabs.pinned'), count: pinnedItems.length },
        { id: 'inbox', label: t('desktop.tray.tabs.inbox'), count: unread.length }
    ];

    return (
        <div className="tray-panel">
            <div className="tray-panel__card">
                <header className="tray-panel__header">
                    <div className="tray-panel__brand">
                        <img className="tray-panel__logo" src={logoUrl} alt="" aria-hidden="true" />
                        <div>
                            <strong>ProjectFlow</strong>
                            {activeWorkspace?.name && <span>{activeWorkspace.name}</span>}
                        </div>
                    </div>
                    <div className="tray-panel__header-actions">
                        <button type="button" className="tray-panel__icon" onClick={() => bridge.appAction?.('capture')} title={t('desktop.tray.actions.capture')} aria-label={t('desktop.tray.actions.capture')}>
                            <span className="material-symbols-outlined">add_task</span>
                        </button>
                        <button type="button" className="tray-panel__icon" onClick={() => bridge.appAction?.('quick-access')} title={t('desktop.tray.actions.quickAccess')} aria-label={t('desktop.tray.actions.quickAccess')}>
                            <span className="material-symbols-outlined">picture_in_picture_alt</span>
                        </button>
                        <button type="button" className="tray-panel__icon" onClick={() => bridge.appAction?.('show-main')} title={t('desktop.tray.actions.openApp')} aria-label={t('desktop.tray.actions.openApp')}>
                            <span className="material-symbols-outlined">open_in_new</span>
                        </button>
                    </div>
                </header>

                <section className={`tray-panel__focus tray-panel__focus--${focusStatus ?? 'none'}`} aria-label={t('desktop.tray.focus.label')}>
                    {focusItem ? (
                        <>
                            <div className="tray-panel__focus-top">
                                <span className="tray-panel__focus-status">
                                    <span className="tray-panel__pulse" aria-hidden="true" />
                                    {focusStatus === 'snoozed'
                                        ? t('desktop.tray.focus.pausedUntil').replace('{time}', timeFormat.format(new Date(focusState?.snoozedUntil || now)))
                                        : focusStatus === 'blocked' ? t('pinnedTasks.focus.status.blocked') : t('desktop.tray.focus.active')}
                                </span>
                                {timer && <span className="tray-panel__timer" aria-label={t('desktop.tray.focus.elapsed')}>{timer}</span>}
                            </div>
                            <button type="button" className="tray-panel__focus-title" onClick={() => { const path = pinnedItemPath(focusItem); if (path) open(path); }}>
                                {focusItem.title}
                            </button>
                            <div className="tray-panel__focus-actions">
                                {focusStatus === 'active' ? (
                                    <button type="button" className="tray-panel__secondary" onClick={() => snoozeFocusItem(30)}>
                                        <span className="material-symbols-outlined">pause</span>{t('desktop.tray.focus.pause')}
                                    </button>
                                ) : (
                                    <button type="button" className="tray-panel__secondary" onClick={() => startFocusItem(focusItem)}>
                                        <span className="material-symbols-outlined">play_arrow</span>{t('pinnedTasks.focus.resume')}
                                    </button>
                                )}
                                <button type="button" className="tray-panel__primary" onClick={() => void completeFocus()} disabled={busy}>
                                    <span className="material-symbols-outlined">check</span>{t('pinnedTasks.focus.complete')}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="tray-panel__focus-empty">
                            <span className="tray-panel__focus-status">{t('desktop.tray.focus.none')}</span>
                            {suggestion ? (
                                <>
                                    <p className="tray-panel__focus-suggestion">{suggestion.title}</p>
                                    <span className="tray-panel__muted">{message(suggestion.reason)}</span>
                                    <button type="button" className="tray-panel__primary" onClick={() => startStop(suggestion)}>
                                        <span className="material-symbols-outlined">play_arrow</span>{t('desktop.day.start.focus')}
                                    </button>
                                </>
                            ) : (
                                <span className="tray-panel__muted">{loading ? t('app.loading.connecting') : t('desktop.tray.focus.noneHint')}</span>
                            )}
                        </div>
                    )}
                </section>

                {nextEvent && (
                    <button type="button" className={`tray-panel__meeting ${eventRunning ? 'is-running' : ''}`.trim()} onClick={() => bridge.appAction?.('capture')} title={t('desktop.tray.meeting.capture')}>
                        <span className="material-symbols-outlined">event</span>
                        <span className="tray-panel__meeting-title">{nextEvent.title}</span>
                        <span className="tray-panel__meeting-time">
                            {eventRunning ? t('desktop.tray.meeting.now') : `${timeFormat.format(new Date(eventStart))} · ${ago(eventStart)}`}
                        </span>
                    </button>
                )}

                <form
                    className={`tray-panel__capture ${draftState === 'error' ? 'is-error' : ''}`.trim()}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submitDraft();
                    }}
                >
                    <span className="material-symbols-outlined">{draftState === 'saved' ? 'check_circle' : 'add'}</span>
                    <input
                        value={draft}
                        onChange={(event) => { setDraft(event.target.value); setDraftState('idle'); }}
                        placeholder={draftState === 'saved' ? t('desktop.tray.capture.saved') : t('desktop.tray.capture.placeholder')}
                        aria-label={t('desktop.capture.label')}
                        disabled={draftState === 'saving'}
                    />
                    {draft && (targetProject || parsed.priority || parsed.dueInDays !== null) && (
                        <span className="tray-panel__capture-meta">{[targetProject?.title, parsed.priority && t(`tasks.priority.${parsed.priority.toLowerCase()}`)].filter(Boolean).join(' · ')}</span>
                    )}
                </form>

                <div className="tray-panel__tabs" role="tablist">
                    {tabs.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === entry.id}
                            className={`tray-panel__tab ${tab === entry.id ? 'is-active' : ''}`.trim()}
                            onClick={() => setTab(entry.id)}
                        >
                            {entry.label}
                            {entry.count > 0 && <span className={`tray-panel__count ${entry.id === 'inbox' ? 'is-alert' : ''}`.trim()}>{entry.count > 99 ? '99+' : entry.count}</span>}
                        </button>
                    ))}
                </div>

                <div className="tray-panel__list custom-scrollbar" role="tabpanel">
                    {tab === 'today' && (
                        todayStops.length === 0
                            ? <p className="tray-panel__empty">{loading ? t('app.loading.connecting') : t('desktop.day.start.empty')}</p>
                            : todayStops.map((stop) => (
                                <div key={stop.id} className={`tray-panel__row tray-panel__row--${stop.tone} ${handled[stop.id] ? 'is-done' : ''}`.trim()}>
                                    <button type="button" className="tray-panel__check" onClick={() => void complete(stop)} disabled={Boolean(handled[stop.id])} aria-label={t('dashboard.route.complete')} title={t('dashboard.route.complete')}>
                                        <span className="material-symbols-outlined">check</span>
                                    </button>
                                    <button type="button" className="tray-panel__row-copy" onClick={() => open(dayPlanStopPath(stop))}>
                                        <span className="tray-panel__row-title">{stop.title}</span>
                                        <span className="tray-panel__row-meta">{message(stop.reason)}{stop.projectName ? ` · ${stop.projectName}` : ''}</span>
                                    </button>
                                    {stop.canFocus && focusItem?.id !== stop.taskId && !handled[stop.id] && (
                                        <button type="button" className="tray-panel__row-action" onClick={() => startStop(stop)} title={t('desktop.day.start.focus')} aria-label={t('desktop.day.start.focus')}>
                                            <span className="material-symbols-outlined">center_focus_strong</span>
                                        </button>
                                    )}
                                </div>
                            ))
                    )}

                    {tab === 'pinned' && (
                        pinnedItems.length === 0
                            ? <p className="tray-panel__empty">{t('pinnedTasks.window.empty')}</p>
                            : pinnedItems.map((item) => {
                                const path = pinnedItemPath(item);
                                const isFocus = focusItem?.id === item.id;
                                return (
                                    <div key={item.id} className={`tray-panel__row ${isFocus ? 'is-focus' : ''}`.trim()}>
                                        <span className="material-symbols-outlined tray-panel__row-icon">
                                            {isFocus ? 'center_focus_strong' : item.type === 'initiative' ? 'rocket_launch' : item.type === 'personal-task' ? 'lock' : 'push_pin'}
                                        </span>
                                        <button type="button" className="tray-panel__row-copy" onClick={() => { if (path) open(path); }} disabled={!path}>
                                            <span className="tray-panel__row-title">{item.title}</span>
                                            <span className="tray-panel__row-meta">{t(`pinnedTasks.types.${item.type === 'personal-task' ? 'personalTask' : item.type}`)}</span>
                                        </button>
                                        {!isFocus && item.projectId && (
                                            <button type="button" className="tray-panel__row-action" onClick={() => startFocusItem(item)} title={t('desktop.day.start.focus')} aria-label={t('desktop.day.start.focus')}>
                                                <span className="material-symbols-outlined">play_arrow</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                    )}

                    {tab === 'inbox' && (
                        unread.length === 0
                            ? <p className="tray-panel__empty">{t('desktop.tray.inbox.empty')}</p>
                            : (
                                <>
                                    {unread.slice(0, 20).map((notification) => (
                                        <button
                                            key={notification.id}
                                            type="button"
                                            className="tray-panel__row tray-panel__row--notification"
                                            onClick={() => {
                                                void markNotificationAsRead(notification.id, notification.tenantId);
                                                open(notificationPath(notification));
                                            }}
                                        >
                                            <span className="tray-panel__unread-dot" aria-hidden="true" />
                                            <span className="tray-panel__row-copy">
                                                <span className="tray-panel__row-title">{notification.title}</span>
                                                <span className="tray-panel__row-meta">{notification.message}</span>
                                            </span>
                                            <span className="tray-panel__row-time">{ago(toMillis(notification.createdAt) || now)}</span>
                                        </button>
                                    ))}
                                    <button type="button" className="tray-panel__link" onClick={() => void markAllNotificationsAsRead(user.uid, activeWorkspaceId || undefined)}>
                                        {t('desktop.tray.inbox.markAll')}
                                    </button>
                                </>
                            )
                    )}
                </div>

                {update.status !== 'none' && (
                    <button type="button" className="tray-panel__update" onClick={() => bridge.applyUpdate?.()}>
                        <span className="material-symbols-outlined">{update.status === 'ready' ? 'restart_alt' : 'download'}</span>
                        {t(update.status === 'ready' ? 'desktop.update.readyHint' : 'desktop.update.availableHint').replace('{version}', update.version || '')}
                    </button>
                )}
                <footer className="tray-panel__footer">
                    <button type="button" className="tray-panel__footer-action" onClick={() => bridge.appAction?.('day-close')}>
                        <span className="material-symbols-outlined">bedtime</span>{t('desktop.tray.actions.dayClose')}
                    </button>
                    <button type="button" className="tray-panel__footer-action" onClick={() => bridge.appAction?.('settings')}>
                        <span className="material-symbols-outlined">settings</span>{t('desktop.tray.actions.settings')}
                    </button>
                    <button type="button" className="tray-panel__footer-action" onClick={() => bridge.appAction?.('quit')}>
                        <span className="material-symbols-outlined">power_settings_new</span>{t('desktop.tray.actions.quit')}
                    </button>
                </footer>
            </div>
        </div>
    );
};
