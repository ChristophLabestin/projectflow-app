import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { desktopWindowKind, getDesktopBridge } from '../services/desktop';
import { createCapturedTask } from '../services/desktopActions';
import { getSharedProjects, getUserProjects } from '../services/domain/projectsService';
import { isProjectActiveForGlobalSignals } from '../services/healthService';
import type { Project } from '../types';
import { addDaysFromToday, toIsoDate } from '../utils/taskDates';
import { activeProjectToken, completeProjectToken, parseCapture, rankProjects } from '../utils/quickCapture';

type CaptureState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; message: string } | { kind: 'error' };

const PRIORITY_KEYS: Record<string, string> = {
    Low: 'tasks.priority.low',
    Medium: 'tasks.priority.medium',
    High: 'tasks.priority.high',
    Urgent: 'tasks.priority.urgent'
};

/**
 * Desktop app only: the Spotlight-like Quick Capture panel (global shortcut). Creates a project task
 * (`#project`) or a personal task, optionally pinned; ⌘/Ctrl+Enter also opens it in the main window.
 */
export const QuickCaptureWindow = () => {
    const bridge = getDesktopBridge();
    const { user } = useAuth();
    const { t } = useLanguage();
    const { pinItem } = usePinnedTasks();
    const { status: workspaceStatus, refresh: refreshWorkspace } = useWorkspace();
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState('');
    const [clipboardText, setClipboardText] = useState('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [pickerIndex, setPickerIndex] = useState(0);
    const [chosenProject, setChosenProject] = useState<Project | null>(null);
    const [pin, setPin] = useState(false);
    const [state, setState] = useState<CaptureState>({ kind: 'idle' });

    const loadProjects = useCallback(async () => {
        if (!user) return;
        const [owned, shared] = await Promise.all([
            getUserProjects(undefined, { hydrateAssets: false }).catch(() => []),
            getSharedProjects({ hydrateAssets: false }).catch(() => [])
        ]);
        const unique = new Map<string, Project>();
        [...owned, ...shared].filter(isProjectActiveForGlobalSignals).forEach((project) => unique.set(project.id, project));
        setProjects([...unique.values()]);
    }, [user]);

    // Each time the shell shows the panel: reset, prefill, refresh projects, focus the field.
    useEffect(() => {
        if (!bridge?.onWindowPayload) return;
        return bridge.onWindowPayload((payload) => {
            if (payload.clipboardOnly) {
                setClipboardText(typeof payload.clipboard === 'string' ? payload.clipboard : '');
                return;
            }
            setValue(typeof payload.text === 'string' ? payload.text : '');
            setClipboardText(typeof payload.clipboard === 'string' ? payload.clipboard : '');
            if (workspaceStatus === 'error') void refreshWorkspace();
            setChosenProject(null);
            setPin(false);
            setState({ kind: 'idle' });
            void loadProjects();
            requestAnimationFrame(() => inputRef.current?.focus());
        });
    }, [bridge, loadProjects, workspaceStatus, refreshWorkspace]);

    useEffect(() => { void loadProjects(); }, [loadProjects]);

    const parsed = useMemo(() => parseCapture(value), [value]);
    const token = activeProjectToken(value);
    const suggestions = useMemo(() => (token === null ? [] : rankProjects(projects, token)), [projects, token]);
    const targetProject = useMemo(() => {
        if (!parsed.projectQuery) return null;
        // A project picked from the list wins over the fuzzy match of its (first-word) token.
        if (chosenProject && chosenProject.title.split(/\s+/)[0] === parsed.projectQuery) return chosenProject;
        return rankProjects(projects, parsed.projectQuery, 1)[0] ?? null;
    }, [chosenProject, parsed.projectQuery, projects]);

    useEffect(() => setPickerIndex(0), [token]);

    if (!bridge || desktopWindowKind() !== 'capture') return <Navigate to="/" replace />;

    const close = () => bridge.closeSelf?.();

    const choose = (project: Project) => {
        setChosenProject(project);
        setValue((current) => completeProjectToken(current, project.title));
        inputRef.current?.focus();
    };

    const submit = async (openAfter: boolean) => {
        if (!parsed.title || state.kind === 'saving') return;
        setState({ kind: 'saving' });
        try {
            const created = await createCapturedTask(parsed, targetProject);
            const path = created.path;
            if (pin) pinItem(created.pinned);
            setState({
                kind: 'saved',
                message: targetProject
                    ? t('desktop.capture.savedProject').replace('{project}', targetProject.title)
                    : t('desktop.capture.savedPersonal')
            });
            if (openAfter) bridge.openInMain(path);
            setTimeout(close, openAfter ? 200 : 900);
        } catch {
            setState({ kind: 'error' });
        }
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }
        if (suggestions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setPickerIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
            return;
        }
        if (suggestions.length && (event.key === 'Tab' || (event.key === 'Enter' && !event.metaKey && !event.ctrlKey))) {
            event.preventDefault();
            choose(suggestions[pickerIndex]);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            void submit(event.metaKey || event.ctrlKey);
        }
    };

    const isMac = bridge.platform === 'darwin';

    return (
        <div className="quick-capture">
            <div className="quick-capture__card">
                <div className="quick-capture__field">
                    <span className="material-symbols-outlined quick-capture__icon">{state.kind === 'saved' ? 'check_circle' : 'add_task'}</span>
                    <input
                        ref={inputRef}
                        className="quick-capture__input"
                        value={value}
                        autoFocus
                        disabled={!user || state.kind === 'saving'}
                        placeholder={user ? t('desktop.capture.placeholder') : t('pinnedTasks.window.signedOut')}
                        aria-label={t('desktop.capture.label')}
                        onChange={(event) => {
                            setValue(event.target.value);
                            if (state.kind !== 'idle') setState({ kind: 'idle' });
                        }}
                        onKeyDown={onKeyDown}
                    />
                </div>

                {suggestions.length > 0 && (
                    <ul className="quick-capture__suggestions" role="listbox" aria-label={t('desktop.capture.projects')}>
                        {suggestions.map((project, index) => (
                            <li key={project.id} role="option" aria-selected={index === pickerIndex}>
                                <button
                                    type="button"
                                    className={`quick-capture__suggestion ${index === pickerIndex ? 'is-active' : ''}`.trim()}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => choose(project)}
                                >
                                    <span className="material-symbols-outlined">folder</span>
                                    {project.title}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {suggestions.length === 0 && (
                    <div className="quick-capture__meta">
                        <span className={`quick-capture__chip ${targetProject ? 'is-set' : ''}`.trim()}>
                            <span className="material-symbols-outlined">{targetProject ? 'folder' : 'lock'}</span>
                            {targetProject ? targetProject.title : t('desktop.capture.personal')}
                        </span>
                        {parsed.priority && (
                            <span className="quick-capture__chip is-set">
                                <span className="material-symbols-outlined">flag</span>
                                {t(PRIORITY_KEYS[parsed.priority])}
                            </span>
                        )}
                        {parsed.dueInDays !== null && (
                            <span className="quick-capture__chip is-set">
                                <span className="material-symbols-outlined">event</span>
                                {parsed.dueInDays === 0 ? t('work.due.today') : parsed.dueInDays === 1 ? t('work.due.tomorrow') : toIsoDate(addDaysFromToday(parsed.dueInDays))}
                            </span>
                        )}
                        <button
                            type="button"
                            className={`quick-capture__chip quick-capture__chip--toggle ${pin ? 'is-set' : ''}`.trim()}
                            aria-pressed={pin}
                            onClick={() => setPin((current) => !current)}
                        >
                            <span className="material-symbols-outlined">push_pin</span>
                            {t('desktop.capture.pin')}
                        </button>
                        {clipboardText && !value.includes(clipboardText) && (
                            <button
                                type="button"
                                className="quick-capture__chip quick-capture__chip--toggle"
                                title={clipboardText}
                                onClick={() => {
                                    setValue((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${clipboardText}`);
                                    inputRef.current?.focus();
                                }}
                            >
                                <span className="material-symbols-outlined">content_paste</span>
                                {t('desktop.capture.clipboard')}
                            </button>
                        )}
                    </div>
                )}

                <div className="quick-capture__footer" role="status" aria-live="polite">
                    {state.kind === 'saved' && <span className="quick-capture__status is-success">{state.message}</span>}
                    {state.kind === 'error' && <span className="quick-capture__status is-error">{t('desktop.toast.actionFailed')}</span>}
                    {(state.kind === 'idle' || state.kind === 'saving') && (
                        <span className="quick-capture__hint">
                            {t('desktop.capture.hint').replace('{open}', isMac ? '⌘↩' : 'Ctrl+↩')}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
