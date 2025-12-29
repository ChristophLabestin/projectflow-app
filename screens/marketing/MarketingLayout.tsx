import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const MarketingLayout = () => {
    const location = useLocation();
    const tabs = [
        { to: "", label: "Overview", end: true, icon: "dashboard" },
        { to: "ads", label: "Paid Ads", icon: "ads_click" },
        { to: "email", label: "Email Marketing", icon: "mail" },
        { to: "recipients", label: "Recipients", icon: "group" },
        { to: "blog", label: "Example Blog", icon: "article" },
        { to: "settings", label: "Settings", icon: "settings" },
    ];

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
            {/* Minimal Topbar Navigation - Matching App Header */}
            <div className="px-4 h-12 border-b border-[var(--color-surface-border)] shrink-0 bg-[var(--color-surface-card)] sticky top-0 z-20 flex items-center gap-4">

                {/* Title (Text Only) */}
                <h1 className="text-sm font-bold text-[var(--color-text-main)] shrink-0">
                    Online Marketing
                </h1>

                <div className="h-4 w-px bg-[var(--color-surface-border)] shrink-0" />

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
                                    ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] shadow-sm'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
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
