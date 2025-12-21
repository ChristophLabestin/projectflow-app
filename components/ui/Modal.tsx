import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export const Modal = ({ isOpen, onClose, title, children, footer, size = 'md', className = '' }: ModalProps) => {
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
        xl: 'max-w-4xl'
    };

    return createPortal(
        <div className={`fixed inset-0 flex items-center justify-center p-4 sm:p-6 ${className || 'z-50'}`}>
            <div
                ref={overlayRef}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className={`
                relative w-full ${sizeClasses[size]} bg-[var(--color-surface-card)] rounded-xl shadow-xl 
                border border-[var(--color-surface-border)] flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200
            `}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-surface-border)]">
                    <h2 className="text-lg font-bold text-[var(--color-text-main)]">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {children}
                </div>

                {footer && (
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] rounded-b-xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
