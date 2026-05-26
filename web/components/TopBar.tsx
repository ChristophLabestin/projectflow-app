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
                className={`
                    flex items-center justify-center size-8 rounded-lg transition-all duration-200
                    ${hasItems
                        ? 'text-primary bg-primary/10 hover:bg-primary/20'
                        : 'text-muted hover:bg-surface-hover'
                    }
                `}
                title={t('topbar.pinnedTasks')}
            >
                <span className="material-symbols-outlined text-[20px]">push_pin</span>
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
        <header className="
            sticky top-0 z-30 w-full h-14
            flex items-center justify-between 
            px-4
            bg-card/95 backdrop-blur-sm
            border-b border-surface
            transition-all duration-200
        ">
            {/* LEFT: Navigation & Context */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                    onClick={onOpenNav}
                    className="md:hidden p-1.5 rounded-md text-muted hover:bg-surface-hover transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px]">menu</span>
                </button>

                {/* V3 Breadcrumbs: Clean, Text-based */}
                <div className="flex items-center text-sm">
                    <Breadcrumbs items={breadcrumbs} />
                </div>
            </div>

            {/* RIGHT: Tools & Actions */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">

                {/* Search - Right Aligned Now */}
                <div className="hidden sm:block w-64 md:w-72 lg:w-80 transition-all">
                    <Suspense fallback={<div className="h-9 rounded-lg bg-surface/60" />}>
                        <AISearchBar />
                    </Suspense>
                </div>

                <div className="h-4 w-px bg-surface-border mx-1 hidden sm:block" />

                <Suspense fallback={null}>
                    <PinnedProjectPill />
                </Suspense>

                <div className="hidden md:block w-px h-4 bg-surface-border mx-1" />

                <PinnedTasksToggle />

                <button
                    onClick={handleOpenHelp}
                    className="flex items-center justify-center size-8 rounded-lg text-muted hover:bg-surface-hover hover:text-main transition-colors"
                    title={t('topbar.helpCenter')}
                >
                    <span className="material-symbols-outlined text-[20px]">help</span>
                </button>

                <div className="pl-1">
                    <Suspense fallback={<div className="size-8 rounded-full bg-surface/60" />}>
                        <UserProfileDropdown />
                    </Suspense>
                </div>
            </div>
        </header>
    );
};
