import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { PinnedTasksModal } from '../components/PinnedTasksModal';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getDesktopBridge, isDesktopQuickAccessWindow } from '../services/desktop';

/**
 * Desktop app only: content of the Quick Access pop-out window (always-on-top capable).
 * Shares the session with the main window, so it is signed in through the same Firebase Auth state;
 * pins and focus sync live through Firestore.
 */
export const QuickAccessWindow = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const bridge = getDesktopBridge();
    const wasSignedIn = useRef(false);

    // Signing out in the main window closes the pop-out.
    useEffect(() => {
        if (user) {
            wasSignedIn.current = true;
        } else if (wasSignedIn.current) {
            void bridge?.quickAccess('close');
        }
    }, [bridge, user]);

    if (!bridge || !isDesktopQuickAccessWindow()) return <Navigate to="/" replace />;

    if (!user) {
        return (
            <div className="quick-access-window">
                <div className="quick-access-window__message">
                    <span className="material-symbols-outlined">lock</span>
                    <p>{t('pinnedTasks.window.signedOut')}</p>
                    <Button variant="secondary" onClick={() => bridge.openInMain('/login')}>
                        {t('pinnedTasks.window.openMain')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="quick-access-window">
            <PinnedTasksModal variant="window" />
        </div>
    );
};
