import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../motion/usePresence';
import { useLanguage } from '../../context/LanguageContext';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

// Open modals, top-most last: only the top one handles Escape / Tab.
const openModalStack: symbol[] = [];

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
    className?: string;
    hideHeader?: boolean;
    noPadding?: boolean;
}

export const Modal = ({ isOpen, onClose, title, children, footer, size = 'md', className = '', hideHeader = false, noPadding = false }: ModalProps) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const titleId = useId();
    const { t } = useLanguage();

    // Escape + focus trap + focus restore. Only the top-most open modal reacts.
    useEffect(() => {
        if (!isOpen) return undefined;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const token = Symbol('modal');
        openModalStack.push(token);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const getFocusable = () => Array.from(
            panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || []
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);

        // Move focus into the dialog unless something inside already took it (e.g. autoFocus).
        const focusTimer = window.setTimeout(() => {
            if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
                (getFocusable()[0] || panelRef.current).focus();
            }
        }, 0);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (openModalStack[openModalStack.length - 1] !== token) return;
            if (e.key === 'Escape') {
                if (e.defaultPrevented) return;
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab' || !panelRef.current) return;
            const focusable = getFocusable();
            if (focusable.length === 0) {
                e.preventDefault();
                panelRef.current.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement as HTMLElement | null;
            if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            const index = openModalStack.indexOf(token);
            if (index >= 0) openModalStack.splice(index, 1);
            document.body.style.overflow = openModalStack.length > 0 ? 'hidden' : previousOverflow;
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            }
        };
    }, [isOpen]);

    // Stays mounted for the exit animation (backdrop fades, panel sinks).
    const presence = usePresence(isOpen);
    if (!presence.mounted) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-3xl',
        '2xl': 'max-w-4xl',
        '3xl': 'max-w-5xl',
        '4xl': 'max-w-6xl',
        '5xl': 'max-w-7xl',
        'full': 'max-w-[96vw]'
    };

    return createPortal(
        <div className={`ui-modal ${presence.exiting ? 'is-exiting' : ''} ${className}`.trim()}>
            <div
                ref={overlayRef}
                className="ui-modal__backdrop"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={panelRef}
                tabIndex={-1}
                className={`ui-modal__panel ${sizeClasses[size]}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={!hideHeader && title ? titleId : undefined}
            >
                {!hideHeader && (
                    <div className="ui-modal__header">
                        <h2 id={titleId} className="ui-modal__title">
                            {title}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="ui-modal__close"
                            aria-label={t('common.close')}
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                )}

                <div className={noPadding ? 'ui-modal__body ui-modal__body--flush' : 'ui-modal__body'}>
                    {children}
                </div>

                {footer && (
                    <div className="ui-modal__footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
