import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button/Button';
import './modal.scss';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    children: React.ReactNode;
    footer?: React.ReactNode;
    closeOnOutsideClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    size = 'md',
    children,
    footer,
    closeOnOutsideClick = true,
}) => {
    const [isRendered, setIsRendered] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle animation mounting/unmounting
    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
            document.body.style.overflow = 'hidden'; // Lock scroll
        } else {
            const timer = setTimeout(() => setIsRendered(false), 300); // Match CSS transition duration
            document.body.style.overflow = '';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Handle outside click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (closeOnOutsideClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isRendered && !isOpen) return null;

    return createPortal(
        <div
            className={`modal-overlay ${isOpen ? 'modal-overlay--open' : ''}`}
            onClick={handleBackdropClick}
            aria-modal="true"
            role="dialog"
        >
            <div className={`modal modal--${size} ${isOpen ? 'modal--open' : ''}`} ref={modalRef}>
                {(title || onClose) && (
                    <div className="modal__header">
                        {title && <h2 className="modal__title">{title}</h2>}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="modal__close-btn"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            ✕
                        </Button>
                    </div>
                )}
                <div className="modal__content">{children}</div>
                {footer && <div className="modal__footer">{footer}</div>}
            </div>
        </div>,
        document.body
    );
};
