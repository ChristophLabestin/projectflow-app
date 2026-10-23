import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDesktopUpdate } from '../../hooks/useDesktopUpdate';
import {
    getDesktopBridge,
    hasDesktopCapability,
    type DesktopQuickAccessState,
    type DesktopWindowState
} from '../../services/desktop';

interface DesktopTitleBarProps {
    /** `inline`: authenticated shell, content starts below the bar. `overlay`: transparent drag strip over public pages. */
    mode: 'inline' | 'overlay';
}

const INITIAL_STATE: DesktopWindowState = {
    isMaximized: false,
    isFullScreen: false,
    isFocused: true,
    isAlwaysOnTop: false,
    canGoBack: false,
    canGoForward: false,
    zoomFactor: 1
};

/**
 * Custom window title bar of the desktop app. It is a drag region that hosts the native window controls:
 * macOS traffic lights sit in the left inset, Windows caption buttons (titleBarOverlay) on the right.
 * Renders nothing in the browser.
 */
export const DesktopTitleBar: React.FC<DesktopTitleBarProps> = ({ mode }) => {
    const bridge = getDesktopBridge();
    const { t } = useLanguage();
    const { activeWorkspace } = useWorkspace();
    const [state, setState] = useState<DesktopWindowState>(INITIAL_STATE);
    const [quickAccess, setQuickAccess] = useState<DesktopQuickAccessState | null>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const update = useDesktopUpdate();

    useEffect(() => {
        if (!bridge) return;
        let mounted = true;
        void bridge.getWindowState().then((next) => { if (mounted && next) setState(next); });
        const unsubscribeState = bridge.onWindowStateChange(setState);
        let unsubscribeQuickAccess = () => {};
        if (hasDesktopCapability('popout')) {
            void bridge.quickAccess('state').then((next) => { if (mounted) setQuickAccess(next); });
            unsubscribeQuickAccess = bridge.onQuickAccessChange(setQuickAccess);
        }
        return () => {
            mounted = false;
            unsubscribeState();
            unsubscribeQuickAccess();
        };
    }, [bridge]);

    // Layout hooks for the rest of the app (content offset, fullscreen inset).
    useEffect(() => {
        if (!bridge) return;
        const root = document.documentElement;
        root.dataset.desktopTitlebar = mode;
        return () => { delete root.dataset.desktopTitlebar; };
    }, [bridge, mode]);

    useEffect(() => {
        document.documentElement.classList.toggle('desktop-fullscreen', state.isFullScreen);
        document.documentElement.classList.toggle('desktop-window-inactive', !state.isFocused);
    }, [state.isFullScreen, state.isFocused]);

    if (!bridge || bridge.platform === 'linux' || !hasDesktopCapability('titlebar')) return null;

    const isWindows = bridge.platform === 'win32';

    const openAppMenu = () => {
        const rect = menuButtonRef.current?.getBoundingClientRect();
        bridge.showAppMenu(Math.round(rect?.left ?? 8), Math.round(rect?.bottom ?? 40));
    };

    return (
        <div
            className={`desktop-titlebar desktop-titlebar--${mode} ${state.isFocused ? '' : 'is-inactive'}`.trim()}
            role="presentation"
        >
            <div className="desktop-titlebar__leading">
                {isWindows && hasDesktopCapability('app-menu') && (
                    <button
                        ref={menuButtonRef}
                        type="button"
                        className="desktop-titlebar__button desktop-titlebar__menu-button"
                        onClick={openAppMenu}
                        title={t('desktop.titlebar.menu')}
                        aria-label={t('desktop.titlebar.menu')}
                    >
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                )}
                {mode === 'inline' && (
                    <>
                        <button
                            type="button"
                            className="desktop-titlebar__button"
                            onClick={() => bridge.windowAction('back')}
                            disabled={!state.canGoBack}
                            title={t('desktop.titlebar.back')}
                            aria-label={t('desktop.titlebar.back')}
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <button
                            type="button"
                            className="desktop-titlebar__button"
                            onClick={() => bridge.windowAction('forward')}
                            disabled={!state.canGoForward}
                            title={t('desktop.titlebar.forward')}
                            aria-label={t('desktop.titlebar.forward')}
                        >
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                        <button
                            type="button"
                            className="desktop-titlebar__button"
                            onClick={() => window.location.reload()}
                            title={t('desktop.titlebar.reload')}
                            aria-label={t('desktop.titlebar.reload')}
                        >
                            <span className="material-symbols-outlined">refresh</span>
                        </button>
                    </>
                )}
            </div>

            {mode === 'inline' && (
                <div className="desktop-titlebar__title">
                    <span className="desktop-titlebar__app-name">ProjectFlow</span>
                    {activeWorkspace?.name && (
                        <>
                            <span className="desktop-titlebar__separator">/</span>
                            <span className="desktop-titlebar__workspace">{activeWorkspace.name}</span>
                        </>
                    )}
                </div>
            )}

            <div className="desktop-titlebar__trailing">
                {mode === 'inline' && update.status !== 'none' && (
                    <button
                        type="button"
                        className="desktop-titlebar__update"
                        onClick={() => bridge.applyUpdate?.()}
                        title={t(update.status === 'ready' ? 'desktop.update.readyHint' : 'desktop.update.availableHint').replace('{version}', update.version || '')}
                    >
                        <span className="material-symbols-outlined">{update.status === 'ready' ? 'restart_alt' : 'download'}</span>
                        {t(update.status === 'ready' ? 'desktop.update.ready' : 'desktop.update.available')}
                    </button>
                )}
                {mode === 'inline' && quickAccess && (
                    <button
                        type="button"
                        className={`desktop-titlebar__button ${quickAccess.isOpen ? 'is-active' : ''}`.trim()}
                        onClick={() => void bridge.quickAccess('toggle')}
                        title={quickAccess.isOpen ? t('desktop.titlebar.closeQuickAccessWindow') : t('desktop.titlebar.popOutQuickAccess')}
                        aria-label={quickAccess.isOpen ? t('desktop.titlebar.closeQuickAccessWindow') : t('desktop.titlebar.popOutQuickAccess')}
                        aria-pressed={quickAccess.isOpen}
                    >
                        <span className="material-symbols-outlined">picture_in_picture_alt</span>
                    </button>
                )}
            </div>
        </div>
    );
};
