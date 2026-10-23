import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Moon, Search, Sun } from 'lucide-react';
import { BrandGlyph } from '@pf/brand';
import { useSession } from '../auth/session';
import { overlayOpen } from '../ui/Overlay';
import { CommandPalette } from './CommandPalette';
import { NAV } from './nav';

const THEME_KEY = 'pf.admin.theme';
const applyTheme = (dark: boolean) => document.documentElement.classList.toggle('dark', dark);

const isTyping = () => {
    const el = document.activeElement as HTMLElement | null;
    return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
};

const SessionPill: React.FC = () => {
    const { idleDeadline } = useSession();
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 15_000);
        return () => clearInterval(t);
    }, []);
    const minutes = Math.max(0, Math.ceil((idleDeadline - now) / 60_000));
    return <span className={`ac-session ${minutes <= 3 ? 'is-warn' : ''}`} title="Abmeldung bei Inaktivität"><span className="dot" />Sitzung · {minutes} min</span>;
};

export const Layout: React.FC = () => {
    const { email, logout } = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const [palette, setPalette] = useState(false);
    const [dark, setDark] = useState(() => {
        const stored = localStorage.getItem(THEME_KEY);
        return stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        applyTheme(dark);
        localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    }, [dark]);

    // ⌘K palette, `g <key>` navigation, ⇧D theme.
    useEffect(() => {
        let pendingG = 0;
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setPalette((open) => !open);
                return;
            }
            if (isTyping() || overlayOpen() || palette || event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key === 'D' && event.shiftKey) { setDark((d) => !d); return; }
            if (event.key === '/') { event.preventDefault(); setPalette(true); return; }
            if (event.key === 'g') { pendingG = Date.now(); return; }
            if (Date.now() - pendingG < 1200) {
                const item = NAV.find((n) => n.key === event.key.toLowerCase());
                pendingG = 0;
                if (item) { event.preventDefault(); navigate(item.to); }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [navigate, palette]);

    const current = [...NAV].sort((a, b) => b.to.length - a.to.length).find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));
    useEffect(() => { document.title = `${current?.label ?? 'Admin'} · ProjectFlow Admin`; }, [current]);

    const groups = Array.from(new Set(NAV.map((n) => n.group)));

    return (
        <div className="ac-app">
            <aside className="ac-sidebar">
                <div className="ac-sidebar__brand"><BrandGlyph />ProjectFlow<small>Admin</small></div>
                <button className="ac-sidebar__search" onClick={() => setPalette(true)}><Search size={14} /><span>Suchen…</span><kbd>⌘K</kbd></button>
                <nav className="ac-sidebar__nav" aria-label="Admin">
                    {groups.map((group) => (
                        <React.Fragment key={group}>
                            <div className="ac-sidebar__group">{group}</div>
                            {NAV.filter((n) => n.group === group).map((n) => (
                                <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `ac-sidebar__link ${isActive ? 'is-active' : ''}`}>
                                    <n.icon size={15} />{n.label}<kbd>G {n.key.toUpperCase()}</kbd>
                                </NavLink>
                            ))}
                        </React.Fragment>
                    ))}
                </nav>
                <div className="ac-sidebar__footer">
                    <span className="ac-sidebar__who" title={email}>{email}</span>
                    <button className="ac-btn ac-btn--ghost ac-btn--icon ac-btn--sm" onClick={() => setDark((d) => !d)} aria-label="Theme umschalten">{dark ? <Sun size={14} /> : <Moon size={14} />}</button>
                    <button className="ac-btn ac-btn--ghost ac-btn--icon ac-btn--sm" onClick={() => logout('signed-out')} aria-label="Abmelden"><LogOut size={14} /></button>
                </div>
            </aside>
            <div className="ac-main">
                <header className="ac-topbar">
                    <div className="ac-topbar__crumbs">Admin<ChevronRight size={13} /><b>{current?.label ?? 'Seite'}</b></div>
                    <span className="ac-topbar__spacer" />
                    <SessionPill />
                </header>
                <main className="ac-content"><Outlet /></main>
            </div>
            {palette && <CommandPalette onClose={() => setPalette(false)} toggleTheme={() => setDark((d) => !d)} logout={() => logout('signed-out')} />}
        </div>
    );
};
