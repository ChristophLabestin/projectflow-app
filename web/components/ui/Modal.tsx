import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

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
        <div className={`ui-modal ${className}`.trim()}>
            <div
                ref={overlayRef}
                className="ui-modal__backdrop"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className={`ui-modal__panel ${sizeClasses[size]}`} role="dialog" aria-modal="true">
                {!hideHeader && (
                    <div className="ui-modal__header">
                        <h2 className="ui-modal__title">
                            {title}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="ui-modal__close"
                            aria-label="Close"
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
