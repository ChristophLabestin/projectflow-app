import { MediaLibrary } from '../../components/MediaLibrary/MediaLibraryModal';
import { useState } from 'react';
import React from 'react';
import { NavLink, Outlet, useParams, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

export const SocialLayout = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [showMediaLibrary, setShowMediaLibrary] = useState(false);
    const location = useLocation();
    const { t } = useLanguage();

    const tabs = [
        { to: "", label: t('socialLayout.tabs.dashboard'), end: true, icon: "dashboard" },
        { to: "calendar", label: t('socialLayout.tabs.calendar'), icon: "calendar_month" },
        { to: "campaigns", label: t('socialLayout.tabs.campaigns'), icon: "campaign" },
        { to: "posts", label: t('socialLayout.tabs.posts'), icon: "post" },
        { to: "assets", label: t('socialLayout.tabs.assets'), icon: "perm_media" }, // This will be intercepted
        { to: "settings", label: t('socialLayout.tabs.settings'), icon: "settings" },
    ];

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Minimal Topbar Navigation - Matching App Header */}
            <div className="px-4 h-12 border-b border-surface shrink-0 bg-card sticky top-0 z-20 flex items-center gap-4">

                {/* Title (Text Only) */}
                <h1 className="text-sm font-bold text-main shrink-0">
                    {t('socialLayout.title')}
                </h1>

                <div className="h-4 w-px bg-surface-border shrink-0" />

                {/* Navigation Tabs */}
                <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar h-full">
                    {tabs.map((tab) => {
                        if (tab.to === 'assets') {
                            return (
                                <button
                                    key={tab.to}
                                    onClick={() => setShowMediaLibrary(true)}
                                    className="relative h-8 px-3 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all whitespace-nowrap text-muted hover:text-main hover:bg-surface-hover"
                                >
                                    <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            );
                        }
                        return (
                            <NavLink
                                key={tab.to}
                                to={tab.to}
                                end={tab.end}
                                className={({ isActive }) => `
                                relative h-8 px-3 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all whitespace-nowrap
                                ${isActive
                                        ? 'bg-surface-hover text-main shadow-sm'
                                        : 'text-muted hover:text-main hover:bg-surface-hover'
                                    }
                            `}
                            >
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                <span>{tab.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                {/* 
                  Check if we are on Campaign Detail Page (no /edit, no /create). 
                  If so, remove constraints (max-w, padding) so it can be full screen/edge-to-edge.
                */}
                {(location.pathname.includes('/social/campaigns/') && !location.pathname.includes('/edit') && !location.pathname.includes('/create')) ? (
                    <div className="h-full w-full">
                        <Outlet />
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 h-full">
                        <Outlet />
                    </div>
                )}
            </div>

            <MediaLibrary
                isOpen={showMediaLibrary}
                onClose={() => setShowMediaLibrary(false)}
                projectId={projectId || ''}
            />
        </div>
    );
};
