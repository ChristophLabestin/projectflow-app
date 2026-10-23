import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePinnedTasks, type PinnedItem } from '../context/PinnedTasksContext';
import { useToast } from '../context/UIContext';
import { getDesktopBridge, desktopWindowKind } from '../services/desktop';
import { type DayPlanStop } from '../utils/dayPlan';
import { dayPlanStopPath, useDesktopDayPlan } from '../hooks/useDesktopDayPlan';

/**
 * Desktop app only: day start (morning plan) and day close window, opened by the shell on the first unlock of
 * the morning and at the configured end of the day. Uses the same plan logic as the Dashboard (utils/dayPlan).
 */
export const DesktopDayWindow = () => {
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode') === 'close' ? 'close' : 'start';
    const bridge = getDesktopBridge();
    const { user } = useAuth();
    const { t } = useLanguage();
    const { showError } = useToast();
    const { focusItem, startFocusItem, clearFocusItem } = usePinnedTasks();
    const { plan, loading, handled, complete, moveToTomorrow, message } = useDesktopDayPlan();

    if (!bridge || desktopWindowKind() !== 'day') return <Navigate to="/" replace />;

    const close = () => bridge.closeSelf?.();
    const openInMain = (path: string) => bridge.openInMain(path);

    const stops = plan.stops.filter((stop) => !stop.proposed || mode === 'start');

    const handleComplete = async (stop: DayPlanStop) => {
        if (!(await complete(stop))) showError(t('desktop.toast.actionFailed'));
    };

    const handleTomorrow = async (stop: DayPlanStop) => {
        if (!(await moveToTomorrow(stop))) showError(t('desktop.toast.actionFailed'));
    };

    const handleFocus = (stop: DayPlanStop) => {
        if (!stop.canFocus || !stop.projectId) return;
        const item: PinnedItem = {
            id: stop.taskId,
            type: stop.itemType === 'initiative' ? 'initiative' : 'task',
            title: stop.title,
            projectId: stop.projectId,
            tenantId: stop.tenantId || undefined
        };
        startFocusItem(item);
        close();
    };

    const firstName = user?.displayName?.split(' ')[0] || '';
    const isClose = mode === 'close';
    const openCount = stops.filter((stop) => !handled[stop.id]).length;

    return (
        <div className="desktop-day-window">
            <header className="desktop-day-window__header">
                <div>
                    <p className="desktop-day-window__eyebrow">{isClose ? t('desktop.day.close.eyebrow') : t('desktop.day.start.eyebrow')}</p>
                    <h1>
                        {isClose
                            ? t('desktop.day.close.title')
                            : firstName ? t('desktop.day.start.titleNamed').replace('{name}', firstName) : t('desktop.day.start.title')}
                    </h1>
                    <p className="desktop-day-window__summary">
                        {isClose
                            ? t('desktop.day.close.summary').replace('{open}', String(openCount))
                            : t('desktop.day.start.summary')
                                .replace('{overdue}', String(plan.counts.overdue))
                                .replace('{today}', String(plan.counts.dueToday + plan.counts.scheduledToday))}
                    </p>
                </div>
                <button type="button" className="desktop-day-window__close" onClick={close} aria-label={t('pinnedTasks.actions.close')}>
                    <span className="material-symbols-outlined">close</span>
                </button>
            </header>

            {isClose && focusItem && (
                <div className="desktop-day-window__focus">
                    <span className="material-symbols-outlined">center_focus_strong</span>
                    <span className="desktop-day-window__focus-title">{focusItem.title}</span>
                    <Button variant="secondary" onClick={() => clearFocusItem()}>{t('desktop.day.close.endFocus')}</Button>
                </div>
            )}

            <div className="desktop-day-window__list">
                {loading && <p className="desktop-day-window__empty">{t('app.loading.connecting')}</p>}
                {!loading && stops.length === 0 && (
                    <p className="desktop-day-window__empty">{isClose ? t('desktop.day.close.empty') : t('desktop.day.start.empty')}</p>
                )}
                {!loading && stops.map((stop) => (
                    <div key={stop.id} className={`desktop-day-window__item desktop-day-window__item--${stop.tone} ${handled[stop.id] ? 'is-handled' : ''}`.trim()}>
                        <button
                            type="button"
                            className="desktop-day-window__check"
                            onClick={() => void handleComplete(stop)}
                            disabled={Boolean(handled[stop.id])}
                            aria-label={t('dashboard.route.complete')}
                            title={t('dashboard.route.complete')}
                        >
                            <span className="material-symbols-outlined">{handled[stop.id] === 'done' ? 'check_circle' : 'check'}</span>
                        </button>
                        <button type="button" className="desktop-day-window__copy" onClick={() => openInMain(dayPlanStopPath(stop))}>
                            <span className="desktop-day-window__title">{stop.title}</span>
                            <span className="desktop-day-window__reason">
                                {handled[stop.id] === 'moved' ? t('desktop.day.close.moved') : message(stop.reason)}
                                {stop.projectName ? ` · ${stop.projectName}` : ''}
                            </span>
                        </button>
                        {!handled[stop.id] && (
                            isClose ? (
                                <button type="button" className="desktop-day-window__action" onClick={() => void handleTomorrow(stop)}>
                                    {t('work.due.tomorrow')}
                                </button>
                            ) : stop.canFocus && (
                                <button type="button" className="desktop-day-window__action" onClick={() => handleFocus(stop)}>
                                    {t('desktop.day.start.focus')}
                                </button>
                            )
                        )}
                    </div>
                ))}
                {!loading && plan.moreCount > 0 && (
                    <p className="desktop-day-window__more">{t('desktop.day.more').replace('{count}', String(plan.moreCount))}</p>
                )}
            </div>

            <footer className="desktop-day-window__footer">
                <Button variant="ghost" onClick={() => { openInMain('/'); close(); }}>{t('desktop.day.openDashboard')}</Button>
                <Button onClick={close}>{isClose ? t('desktop.day.close.done') : t('desktop.day.start.go')}</Button>
            </footer>
        </div>
    );
};
