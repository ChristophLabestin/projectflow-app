import React, { useEffect, useId, useState } from 'react';
import './inline-edit-cell.scss';

export interface InlineEditCellProps {
    value: string;
    onSave: (value: string) => void | Promise<void>;
    label?: string;
    placeholder?: string;
    emptyLabel?: string;
    saveLabel?: string;
    cancelLabel?: string;
    disabled?: boolean;
    className?: string;
}

export const InlineEditCell: React.FC<InlineEditCellProps> = ({
    value,
    onSave,
    label,
    placeholder,
    emptyLabel = 'Not set',
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
    disabled = false,
    className = '',
}) => {
    const inputId = useId();
    const [draft, setDraft] = useState(value);
    const [isEditing, setEditing] = useState(false);
    // Brief success flash on the saved value (optimistic confirmation).
    const [justSaved, setJustSaved] = useState(false);
    useEffect(() => {
        if (!justSaved) return undefined;
        const timer = window.setTimeout(() => setJustSaved(false), 800);
        return () => window.clearTimeout(timer);
    }, [justSaved]);
    const [isSaving, setSaving] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setDraft(value);
        }
    }, [isEditing, value]);

    const cancel = () => {
        setDraft(value);
        setEditing(false);
    };

    const save = async () => {
        setSaving(true);
        try {
            await onSave(draft.trim());
            setEditing(false);
            setJustSaved(true);
        } finally {
            setSaving(false);
        }
    };

    if (isEditing) {
        return (
            <div className={`inline-edit-cell inline-edit-cell--editing ${className}`.trim()}>
                {label && <label htmlFor={inputId}>{label}</label>}
                <div className="inline-edit-cell__editor">
                    <input
                        id={inputId}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') cancel();
                            if (event.key === 'Enter') void save();
                        }}
                        placeholder={placeholder}
                        autoFocus
                    />
                    <button type="button" onClick={save} disabled={isSaving} aria-label={saveLabel}>
                        <span className="material-symbols-outlined" aria-hidden="true">check</span>
                    </button>
                    <button type="button" onClick={cancel} disabled={isSaving} aria-label={cancelLabel}>
                        <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <button
            type="button"
            className={`inline-edit-cell ${justSaved ? 'motion-confirm' : ''} ${className}`.trim()}
            onClick={() => !disabled && setEditing(true)}
            disabled={disabled}
        >
            {label && <span className="inline-edit-cell__label">{label}</span>}
            <span className={`inline-edit-cell__value ${value ? '' : 'is-empty'}`.trim()}>
                {value || emptyLabel}
            </span>
            <span className="material-symbols-outlined inline-edit-cell__icon" aria-hidden="true">edit_square</span>
        </button>
    );
};
