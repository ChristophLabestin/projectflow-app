import React, { Suspense, lazy, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Breadcrumbs } from './ui/Breadcrumbs';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { getSubTasks } from '../services/domain/tasksService';
import { Project } from '../types';
import { useHelpCenter } from '../context/HelpCenterContext';
import { getHelpTargetForPath } from './help/helpCenterContent';
import { useLanguage } from '../context/LanguageContext';

const AISearchBar = lazy(() => import('./AISearchBar').then((module) => ({ default: module.AISearchBar })));
const PinnedProjectPill = lazy(() => import('./PinnedProjectPill').then((module) => ({ default: module.PinnedProjectPill })));
const UserProfileDropdown = lazy(() => import('./UserProfileDropdown').then((module) => ({ default: module.UserProfileDropdown })));

// --- Local Components (PinnedTasksToggle) ---
const PinnedTasksToggle = () => {
    const { toggleModal, pinnedItems, focusItemId, focusState } = usePinnedTasks();
    const { t } = useLanguage();
    const hasItems = pinnedItems.length > 0;
    const focusItem = focusItemId ? pinnedItems.find(i => i.id === focusItemId) : null;
    const [subtaskStats, setSubtaskStats] = useState<{ done: number; total: number } | null>(null);

    useEffect(() => {
        if (!focusItemId || !focusItem || focusItem.type !== 'task') {
            setSubtaskStats(null);
            return;
        }
        let mounted = true;
        getSubTasks(focusItemId).then(subs => {
            if (mounted) {
                setSubtaskStats({
                    done: subs.filter(s => s.isCompleted).length,
                    total: subs.length
                });
            }
        }).catch(() => { if (mounted) setSubtaskStats(null); });
        return () => { mounted = false; };
    }, [focusItemId, focusItem?.type]);

    if (!focusItem) {
        return (
            <button
                onClick={toggleModal}
                className={`topbar-icon-button ${hasItems ? 'is-active' : ''}`}
                title={t('topbar.pinnedTasks')}
                aria-label={t('topbar.pinnedTasks')}
            >
                <span className="material-symbols-outlined">push_pin</span>
            </button>
        );
    }

    const isSnoozed = focusState?.status === 'snoozed'
        && Boolean(focusState.snoozedUntil)
        && new Date(focusState.snoozedUntil || '').getTime() > Date.now();
    const status = isSnoozed ? 'snoozed' : focusState?.status || 'active';
    const statusLabel = status === 'blocked'
        ? t('topbar.focusStatus.blocked')
        : status === 'snoozed'
            ? t('topbar.focusStatus.snoozed')
            : t('topbar.focusStatus.active');

    return (
        <button
            onClick={toggleModal}
            className={`topbar-focus-pill topbar-focus-pill--${status}`}
            title={t('topbar.focusTask')}
        >
            <div className="relative shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined topbar-focus-pill__icon">
                    {status === 'blocked' ? 'block' : status === 'snoozed' ? 'snooze' : 'center_focus_strong'}
                </span>
                {status === 'active' && <span className="topbar-focus-pill__pulse" />}
            </div>
            <span className="topbar-focus-pill__text">{focusItem.title}</span>
            <span className="topbar-focus-pill__status">{statusLabel}</span>
        </button>
    );
};


interface TopBarProps {
    project: Project | null;
    breadcrumbs: { label: string; to?: string }[];
    onOpenNav: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ project, breadcrumbs, onOpenNav }) => {
    const location = useLocation();
    const { openHelpCenter } = useHelpCenter();
    const { t } = useLanguage();
    void project;

    const handleOpenHelp = () => {
        openHelpCenter(getHelpTargetForPath(location.pathname));
    };

    return (
        <header className="topbar-shell">
            <div className="topbar-context-pill">
                <button
                    onClick={onOpenNav}
                    className="topbar-icon-button topbar-nav-toggle"
                    aria-label={t('topbar.openNavigation')}
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>

                <div className="topbar-breadcrumbs">
                    <Breadcrumbs items={breadcrumbs} />
                </div>
            </div>

            <div className="topbar-right">
                <div className="topbar-search-pill">
                    <Suspense fallback={<div className="h-9 rounded-lg bg-surface/60" />}>
                        <AISearchBar />
                    </Suspense>
                </div>

                <div className="topbar-tools-pill">
                    <span className="topbar-pinned-project-slot">
                        <Suspense fallback={null}>
                            <PinnedProjectPill />
                        </Suspense>
                    </span>

                    <PinnedTasksToggle />

                    <button
                        onClick={handleOpenHelp}
                        className="topbar-icon-button"
                        title={t('topbar.helpCenter')}
                        aria-label={t('topbar.helpCenter')}
                    >
                        <span className="material-symbols-outlined">help</span>
                    </button>

                    <span className="topbar-profile-slot">
                        <Suspense fallback={<div className="topbar-avatar-skeleton" />}>
                            <UserProfileDropdown />
                        </Suspense>
                    </span>
                </div>
            </div>
        </header>
    );
};
