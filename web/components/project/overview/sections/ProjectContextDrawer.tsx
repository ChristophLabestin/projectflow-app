import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type ProjectContextDrawerProps = {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    t: (key: string, fallback?: string) => string;
};

/**
 * Right-hand slide-over for project context (brief, team, resources) so the
 * overview itself stays a single work surface.
 */
export const ProjectContextDrawer: React.FC<ProjectContextDrawerProps> = ({ isOpen, onClose, title, children, t }) => {
    const panelRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        panelRef.current?.focus();
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    return createPortal(
        <div className={`po-drawer ${isOpen ? 'is-open' : ''}`.trim()} aria-hidden={!isOpen}>
            <div className="po-drawer__backdrop" onClick={onClose} />
            <aside
                ref={panelRef}
                className="po-drawer__panel"
                // Only a real dialog while open: other Esc handlers check for [role="dialog"].
                role={isOpen ? 'dialog' : undefined}
                aria-modal={isOpen || undefined}
                aria-label={t('projectOverview.v2.context.title')}
                tabIndex={-1}
            >
                <header className="po-drawer__head">
                    <div className="po-drawer__heading">
                        <span className="po-drawer__eyebrow">{t('projectOverview.v2.context.title')}</span>
                        <h2 className="po-drawer__title">{title}</h2>
                    </div>
                    <button type="button" className="po-drawer__close" onClick={onClose} aria-label={t('common.close')}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div className="po-drawer__body">{isOpen && children}</div>
            </aside>
        </div>,
        document.body
    );
};
