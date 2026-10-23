import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, LogOut, Moon, Search, User } from 'lucide-react';
import { adminApi } from '../lib/api';
import { NAV } from './nav';

type Item = { id: string; group: string; label: string; hint?: string; icon: React.ReactNode; run: () => void };

/** ⌘K: navigation, actions and a live user search (users.search). */
export const CommandPalette: React.FC<{ onClose: () => void; toggleTheme: () => void; logout: () => void }> = ({ onClose, toggleTheme, logout }) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [users, setUsers] = useState<{ uid: string; email: string; displayName?: string }[]>([]);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 3) {
            setUsers([]);
            return;
        }
        const timer = setTimeout(() => {
            adminApi<{ users: any[] }>('users.search', { query: q, limit: 6 }).then((r) => setUsers(r.users || [])).catch(() => setUsers([]));
        }, 220);
        return () => clearTimeout(timer);
    }, [query]);

    const items = useMemo<Item[]>(() => {
        const go = (to: string) => () => { navigate(to); onClose(); };
        const q = query.trim().toLowerCase();
        const match = (text: string) => !q || text.toLowerCase().includes(q);
        const nav = NAV.filter((n) => match(`${n.label} ${n.keywords || ''}`)).map((n) => ({ id: n.to, group: 'Navigation', label: n.label, hint: `G ${n.key.toUpperCase()}`, icon: <n.icon size={15} />, run: go(n.to) }));
        const actions: Item[] = [
            { id: 'theme', group: 'Aktionen', label: 'Hell/Dunkel umschalten', hint: '⇧ D', icon: <Moon size={15} />, run: () => { toggleTheme(); onClose(); } },
            { id: 'logout', group: 'Aktionen', label: 'Abmelden', icon: <LogOut size={15} />, run: () => { onClose(); logout(); } },
        ].filter((a) => match(a.label));
        const people = users.map((u) => ({ id: `u-${u.uid}`, group: 'Nutzer', label: u.displayName ? `${u.displayName} · ${u.email}` : u.email, icon: <User size={15} />, run: go(`/users?uid=${encodeURIComponent(u.uid)}`) }));
        return [...nav, ...people, ...actions];
    }, [query, users, navigate, onClose, toggleTheme, logout]);

    useEffect(() => setActive(0), [query]);
    useEffect(() => { listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' }); }, [active]);

    const onKey = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
        else if (event.key === 'Enter') { event.preventDefault(); items[active]?.run(); }
        else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };

    let lastGroup = '';
    return createPortal(
        <>
            <div className="ac-overlay ac-overlay--palette" onClick={onClose} />
            <div className="ac-palette" role="dialog" aria-modal="true" aria-label="Befehle">
                <div className="ac-palette__input">
                    <Search size={16} />
                    <input autoFocus placeholder="Seite, Aktion oder Nutzer (E-Mail/UID) suchen…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} />
                    <kbd>esc</kbd>
                </div>
                <div className="ac-palette__list" ref={listRef}>
                    {items.length === 0 && <div className="ac-empty">Nichts gefunden</div>}
                    {items.map((item, index) => {
                        const header = item.group !== lastGroup ? <div className="ac-palette__group">{item.group}</div> : null;
                        lastGroup = item.group;
                        return (
                            <React.Fragment key={item.id}>
                                {header}
                                <button className={`ac-palette__item ${index === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(index)} onClick={item.run}>
                                    {item.icon}{item.label}{item.hint && <span className="hint">{item.hint}</span>}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
                <div className="ac-palette__foot"><span>↑↓ wählen</span><span><CornerDownLeft size={11} /> öffnen</span><span>G + Taste: direkt springen</span></div>
            </div>
        </>,
        document.body
    );
};
