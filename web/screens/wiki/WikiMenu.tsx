import React from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../../components/motion';

export interface WikiMenuItem {
    key: string;
    icon: string;
    label: string;
    onSelect: () => void;
    danger?: boolean;
    hidden?: boolean;
    disabled?: boolean;
    hint?: string;
}

interface WikiMenuProps {
    icon?: string;
    label: string;
    items: WikiMenuItem[];
    /** Renders a text button instead of an icon button. */
    text?: string;
    className?: string;
    align?: 'start' | 'end';
}

/** Small origin-aware action menu (portaled so it is never clipped by scroll containers). */
export const WikiMenu: React.FC<WikiMenuProps> = ({ icon = 'more_horiz', label, items, text, className = '', align = 'end' }) => {
    const [open, setOpen] = React.useState(false);
    const [pos, setPos] = React.useState<{ top: number; left: number; up: boolean } | null>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const { mounted, exiting } = usePresence(open);
    const visible = items.filter((item) => !item.hidden);

    React.useLayoutEffect(() => {
        if (!open || !buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const height = Math.min(360, visible.length * 36 + 12);
        const up = rect.bottom + height + 8 > window.innerHeight;
        const width = 232;
        const left = align === 'end' ? rect.right - width : rect.left;
        setPos({ top: up ? rect.top - height - 6 : rect.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)), up });
    }, [align, open, visible.length]);

    React.useEffect(() => {
        if (!open) return undefined;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent) {
                if (event.key === 'Escape') setOpen(false);
                return;
            }
            const target = event.target as Node;
            if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`${text ? 'wiki-chip-btn' : 'wiki-icon-btn'} ${className}${open ? ' is-open' : ''}`}
                aria-label={label}
                title={label}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((value) => !value);
                }}
            >
                <span className="material-symbols-outlined">{icon}</span>
                {text && <span>{text}</span>}
            </button>
            {mounted && pos && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    className={`wiki-menu${exiting ? ' is-exiting' : ''}${pos.up ? ' is-up' : ''}`}
                    style={{ top: pos.top, left: pos.left }}
                >
                    {visible.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            className={`wiki-menu__item${item.danger ? ' is-danger' : ''}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                setOpen(false);
                                item.onSelect();
                            }}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span className="wiki-menu__label">{item.label}</span>
                            {item.hint && <span className="wiki-menu__hint">{item.hint}</span>}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    );
};
