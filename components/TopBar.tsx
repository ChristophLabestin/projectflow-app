import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Breadcrumbs } from './ui/Breadcrumbs';
import { AISearchBar } from './AISearchBar';
import { PinnedProjectPill } from './PinnedProjectPill';
import { UserProfileDropdown } from './UserProfileDropdown';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { getSubTasks } from '../services/dataService';
import { Project } from '../types';
import { useUIState } from '../context/UIContext';
import { useHelpCenter } from '../context/HelpCenterContext';
import { getHelpTargetForPath } from './help/helpCenterContent';
import { useLanguage } from '../context/LanguageContext';

// --- Local Components (PinnedTasksToggle) ---
const PinnedTasksToggle = () => {
    const { toggleModal, pinnedItems, focusItemId } = usePinnedTasks();
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
                        ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                    }
                `}
                title={t('topbar.pinnedTasks')}
            >
                <span className="material-symbols-outlined text-[20px]">push_pin</span>
            </button>
        );
    }

    return (
        <button
            onClick={toggleModal}
            className="flex items-center gap-2 h-8 pl-2 pr-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all group"
            title={t('topbar.focusTask')}
        >
            <div className="relative shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">center_focus_strong</span>
                <span className="absolute -top-0.5 -right-0.5 size-1.5 bg-amber-500 rounded-full animate-pulse" />
            </div>
            <span className="text-[10px] font-semibold text-[var(--color-text-main)] truncate max-w-[100px]">
                {focusItem.title}
            </span>
        </button>
    );
};


interface TopBarProps {
    project: Project | null;
    breadcrumbs: { label: string; to?: string }[];
    onOpenNav: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ project, breadcrumbs, onOpenNav }) => {
    const { openTaskCreateModal } = useUIState();
    const location = useLocation();
    const { openHelpCenter } = useHelpCenter();
    const { t } = useLanguage();

    const handleOpenHelp = () => {
        openHelpCenter(getHelpTargetForPath(location.pathname));
    };

    return (
        <header className="
            sticky top-0 z-30 w-full h-14
            flex items-center justify-between 
            px-4
            bg-[var(--color-surface-card)]/95 backdrop-blur-sm
            border-b border-[var(--color-surface-border)]
            transition-all duration-200
        ">
            {/* LEFT: Navigation & Context */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                    onClick={onOpenNav}
                    className="md:hidden p-1.5 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
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
                    <AISearchBar />
                </div>

                <div className="h-4 w-px bg-[var(--color-surface-border)] mx-1 hidden sm:block" />

                <PinnedProjectPill />

                <div className="hidden md:block w-px h-4 bg-[var(--color-surface-border)] mx-1" />

                <PinnedTasksToggle />

                <button
                    onClick={handleOpenHelp}
                    className="flex items-center justify-center size-8 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)] transition-colors"
                    title={t('topbar.helpCenter')}
                >
                    <span className="material-symbols-outlined text-[20px]">help</span>
                </button>

                <div className="pl-1">
                    <UserProfileDropdown />
                </div>
            </div>
        </header>
    );
};
