import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const MarketingLayout = () => {
    const location = useLocation();
    const { t } = useLanguage();
    const tabs = [
        { to: '', label: t('marketing.layout.tabs.overview'), end: true, icon: 'dashboard' },
        { to: 'ads', label: t('marketing.layout.tabs.ads'), icon: 'ads_click' },
        { to: 'email', label: t('marketing.layout.tabs.email'), icon: 'mail' },
        { to: 'recipients', label: t('marketing.layout.tabs.recipients'), icon: 'group' },
        { to: 'blog', label: t('marketing.layout.tabs.blog'), icon: 'article' },
        { to: 'settings', label: t('marketing.layout.tabs.settings'), icon: 'settings' },
    ];

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Minimal Topbar Navigation - Matching App Header */}
            <div className="px-4 h-12 border-b border-surface shrink-0 bg-card sticky top-0 z-20 flex items-center gap-4">

                {/* Title (Text Only) */}
                <h1 className="text-sm font-bold text-main shrink-0">
                    {t('marketing.layout.title')}
                </h1>

                <div className="h-4 w-px bg-surface-border shrink-0" />

                {/* Navigation Tabs */}
                <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar h-full">
                    {tabs.map((tab) => (
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
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                <div className={`${location.pathname.includes('/email/builder') || location.pathname.includes('/email/create') ? 'w-full h-full' : 'max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6'} h-full`}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export { MarketingLayout };
