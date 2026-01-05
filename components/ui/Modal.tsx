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
    glass?: boolean;
    borderless?: boolean;
}

export const Modal = ({ isOpen, onClose, title, children, footer, size = 'md', className = '', hideHeader = false, noPadding = false, glass = false, ...props }: ModalProps) => {
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
        <div className={`fixed inset-0 flex items-center justify-center p-4 sm:p-6 z-50 ${className}`}>
            <div
                ref={overlayRef}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className={`
                relative w-full ${sizeClasses[size]} 
                ${glass
                    ? `bg-[var(--color-surface-paper)] ${!props.borderless ? 'border border-[var(--color-border-main)]' : ''} shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)]`
                    : `bg-[var(--color-surface-card)] ${!props.borderless ? 'border border-[var(--color-surface-border)]' : ''} shadow-xl`} 
                rounded-3xl flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-300 overflow-hidden
            `}>
                {!hideHeader && (
                    <div className={`flex items-center justify-between px-8 py-6 ${glass ? 'border-b border-[var(--color-border-main)]' : 'border-b border-[var(--color-surface-border)]'}`}>
                        <h2 className="text-xl font-black text-[var(--color-text-main)]">
                            {title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="size-8 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)] transition-all hover:rotate-90"
                        >
                            <span className="material-symbols-outlined text-[24px]">close</span>
                        </button>
                    </div>
                )}

                <div className={noPadding ? 'flex-1 overflow-hidden flex flex-col' : 'p-8 overflow-y-auto flex-1'}>
                    {children}
                </div>

                {footer && (
                    <div className={`flex items-center justify-end gap-3 px-8 py-5 ${glass ? 'border-t border-[var(--color-border-main)] bg-black/[0.02] dark:bg-white/[0.02]' : 'border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]'} rounded-b-3xl`}>
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
