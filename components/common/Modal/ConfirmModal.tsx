import React from 'react';
import { Modal } from './Modal';
import { Button } from '../Button/Button';
import './confirm-modal.scss';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'neutral';
    isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'neutral',
    isLoading = false,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title}>
            <div className="confirm-modal__message">{message}</div>
            <div className="confirm-modal__actions">
                <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                    {cancelLabel}
                </Button>
                <Button
                    variant={variant === 'danger' ? 'primary' : 'primary'} // For now simple, later can add danger button style
                    onClick={onConfirm}
                    isLoading={isLoading}
                    style={variant === 'danger' ? { backgroundColor: 'var(--color-error)' } : undefined}
                >
                    {confirmLabel}
                </Button>
            </div>
        </Modal>
    );
};
