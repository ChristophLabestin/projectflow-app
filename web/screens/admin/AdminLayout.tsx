import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import { hasPlatformAdminClaim } from '../../services/onboardingInsightsService';
import { NotFound } from '../NotFound';
import './admin.scss';

const SECTIONS = [
    { to: '/admin/crashes', icon: 'bug_report', label: 'admin.nav.crashes' },
    { to: '/admin/legal', icon: 'gavel', label: 'admin.nav.legal' },
    { to: '/insights/onboarding', icon: 'insights', label: 'admin.nav.onboarding' },
] as const;

/** Admin platform shell (/admin/*): platform admins only (custom claim `platformAdmin`), everyone else gets 404. */
export const AdminLayout: React.FC = () => {
    const { t } = useLanguage();
    const [allowed, setAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        hasPlatformAdminClaim().then((value) => { if (!cancelled) setAllowed(value); }).catch(() => { if (!cancelled) setAllowed(false); });
        return () => { cancelled = true; };
    }, []);

    if (allowed === null) return null;
    if (!allowed) return <NotFound />;

    return (
        <div className="admin-platform">
            <nav className="admin-platform__nav" aria-label={t('admin.title')}>
                <p className="admin-platform__brand">
                    <span className="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>
                    {t('admin.title')}
                </p>
                {SECTIONS.map((section) => (
                    <NavLink
                        key={section.to}
                        to={section.to}
                        className={({ isActive }) => `admin-platform__link ${isActive ? 'is-active' : ''}`.trim()}
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">{section.icon}</span>
                        {t(section.label)}
                    </NavLink>
                ))}
            </nav>
            <main className="admin-platform__content">
                <Outlet />
            </main>
        </div>
    );
};
