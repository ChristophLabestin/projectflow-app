import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface InlineMenuOption {
    value: string;
    label: string;
    /** Optional leading element (icon, dot, avatar). */
    leading?: React.ReactNode;
    hint?: string;
    /** Single key that picks this option while the menu is open (shown as the hint). */
    shortcut?: string;
    /** Render a separator above this option (e.g. to set a rarer action apart). */
    dividerBefore?: boolean;
}

interface InlineMenuProps {
    /** Accessible name of the trigger, e.g. "Change status". */
    label: string;
    trigger: React.ReactNode;
    triggerClassName?: string;
    options: InlineMenuOption[];
    value?: string | null;
    /** Multi-select mode: options in this list are shown as checked and the menu stays open. */
    selectedValues?: string[];
    onSelect: (value: string) => void;
    disabled?: boolean;
    /** Extra content under the options (e.g. a date input). Receives close(). */
    footer?: (close: () => void) => React.ReactNode;
    width?: number;
}

const MENU_GAP = 6;

/**
 * Small popover menu for inline edits in work lists. Opens under its trigger,
 * supports arrow keys / Enter / Escape and closes on outside click.
 */
export const InlineMenu = ({
    label,
    trigger,
    triggerClassName = '',
    options,
    value,
    selectedValues,
    onSelect,
    disabled,
    footer,
    width = 220
}: InlineMenuProps) => {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const close = useCallback((focusTrigger = true) => {
        setOpen(false);
        if (focusTrigger) triggerRef.current?.focus();
    }, []);

    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const menuHeight = menuRef.current?.offsetHeight || 240;
        const fitsBelow = rect.bottom + MENU_GAP + menuHeight < window.innerHeight;
        const top = fitsBelow ? rect.bottom + MENU_GAP : Math.max(8, rect.top - MENU_GAP - menuHeight);
        const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
        setPosition({ top, left });
    }, [open, width]);

    useEffect(() => {
        if (!open) return;
        const selected = options.findIndex((option) => (selectedValues ? selectedValues.includes(option.value) : option.value === value));
        setActiveIndex(selected >= 0 ? selected : 0);
        const onPointer = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
            close(false);
        };
        const onScroll = (event: Event) => {
            if (menuRef.current?.contains(event.target as Node)) return;
            close(false);
        };
        document.addEventListener('mousedown', onPointer);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (open) menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.focus();
    }, [open, activeIndex]);

    const isSelected = (optionValue: string) => (
        selectedValues ? selectedValues.includes(optionValue) : optionValue === value
    );

    const choose = (next: string) => {
        if (selectedValues) {
            onSelect(next);
            return;
        }
        close();
        if (next !== value) onSelect(next);
    };

    const onMenuKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % options.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + options.length) % options.length);
        } else if (event.key === 'Tab') {
            close(false);
        } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
            const match = options.find((option) => option.shortcut?.toLowerCase() === event.key.toLowerCase());
            if (match) {
                event.preventDefault();
                choose(match.value);
            }
        }
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`inline-menu__trigger ${triggerClassName}`}
                aria-label={label}
                title={label}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((current) => !current);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && !open) {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                {trigger}
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    className="inline-menu"
                    role="menu"
                    aria-label={label}
                    style={{ top: position.top, left: position.left, width }}
                    onKeyDown={onMenuKeyDown}
                    onClick={(event) => event.stopPropagation()}
                >
                    {options.map((option, index) => (
                        <React.Fragment key={option.value}>
                        {option.dividerBefore && <span className="inline-menu__divider" role="separator" />}
                        <button
                            type="button"
                            role={selectedValues ? 'menuitemcheckbox' : 'menuitemradio'}
                            aria-checked={isSelected(option.value)}
                            data-index={index}
                            tabIndex={index === activeIndex ? 0 : -1}
                            className={`inline-menu__option ${isSelected(option.value) ? 'is-selected' : ''}`}
                            onClick={() => choose(option.value)}
                            onMouseEnter={() => setActiveIndex(index)}
                        >
                            {option.leading && <span className="inline-menu__leading">{option.leading}</span>}
                            <span className="inline-menu__label">{option.label}</span>
                            {(option.hint || option.shortcut) && (
                                <span className={`inline-menu__hint ${option.shortcut && !option.hint ? 'inline-menu__hint--key' : ''}`.trim()}>
                                    {option.hint || option.shortcut?.toUpperCase()}
                                </span>
                            )}
                            {isSelected(option.value) && <span className="material-symbols-outlined inline-menu__check">check</span>}
                        </button>
                        </React.Fragment>
                    ))}
                    {footer && <div className="inline-menu__footer">{footer(() => close())}</div>}
                </div>,
                document.body
            )}
        </>
    );
};
