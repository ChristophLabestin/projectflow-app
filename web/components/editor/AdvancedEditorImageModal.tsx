import React from 'react';
import { Modal } from '../ui/Modal';
import { Button as UIButton } from '../ui/Button';
import { Input } from '../ui/Input';

interface AdvancedEditorImageModalProps {
    isOpen: boolean;
    value: string;
    title: string;
    cancelLabel: string;
    submitLabel: string;
    urlLabel: string;
    urlPlaceholder: string;
    onClose: () => void;
    onSubmit: () => void;
    onChange: (value: string) => void;
}

export const AdvancedEditorImageModal: React.FC<AdvancedEditorImageModalProps> = ({
    isOpen,
    value,
    title,
    cancelLabel,
    submitLabel,
    urlLabel,
    urlPlaceholder,
    onClose,
    onSubmit,
    onChange
}) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        footer={
            <>
                <UIButton variant="ghost" onClick={onClose}>{cancelLabel}</UIButton>
                <UIButton variant="primary" onClick={onSubmit} disabled={!value.trim()}>
                    {submitLabel}
                </UIButton>
            </>
        }
    >
        <div className="space-y-3">
            <label className="block text-sm font-medium text-main" htmlFor="advanced-editor-image-url">
                {urlLabel}
            </label>
            <Input
                id="advanced-editor-image-url"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        onSubmit();
                    }
                }}
                placeholder={urlPlaceholder}
                className="w-full"
                autoFocus
            />
        </div>
    </Modal>
);
