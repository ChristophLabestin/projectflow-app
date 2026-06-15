import React, { useState } from 'react';
import { TextInput, type TextInputProps } from './TextInput';

/**
 * Keeps a free-text draft while the field is being edited so the user can fully
 * clear it (delete the "0") or type partial values like "0." / "1," without the
 * controlled numeric value snapping the input back. Emits the parsed number on
 * every change and resyncs to the canonical value on blur.
 */
const useNumberDraft = (value: number, onValueChange: (n: number) => void, emptyValue: number) => {
    const [draft, setDraft] = useState<string | null>(null);
    const display = draft ?? (Number.isFinite(value) ? String(value) : '');

    const handleChange = (raw: string) => {
        setDraft(raw);
        const trimmed = raw.trim();
        if (trimmed === '' || trimmed === '-' || trimmed === ',' || trimmed === '.') {
            onValueChange(emptyValue);
            return;
        }
        const n = Number(trimmed.replace(',', '.'));
        if (Number.isFinite(n)) onValueChange(n);
    };

    const reset = () => setDraft(null);
    return { display, handleChange, reset };
};

export interface NumberInputProps extends Omit<TextInputProps, 'value' | 'onChange' | 'type'> {
    value: number;
    onValueChange: (n: number) => void;
    emptyValue?: number;
}

/** Numeric field built on the shared TextInput (label, styling, etc.). */
export const NumberInput: React.FC<NumberInputProps> = ({ value, onValueChange, emptyValue = 0, onBlur, inputMode = 'decimal', ...rest }) => {
    const { display, handleChange, reset } = useNumberDraft(value, onValueChange, emptyValue);
    return (
        <TextInput
            {...rest}
            type="text"
            inputMode={inputMode}
            value={display}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={(e) => { reset(); onBlur?.(e); }}
        />
    );
};

export interface BareNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
    value: number;
    onValueChange: (n: number) => void;
    emptyValue?: number;
}

/** Numeric field as a plain <input> for custom layouts (no TextInput chrome). */
export const BareNumberInput: React.FC<BareNumberInputProps> = ({ value, onValueChange, emptyValue = 0, onBlur, inputMode = 'decimal', ...rest }) => {
    const { display, handleChange, reset } = useNumberDraft(value, onValueChange, emptyValue);
    return (
        <input
            {...rest}
            type="text"
            inputMode={inputMode}
            value={display}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={(e) => { reset(); onBlur?.(e); }}
        />
    );
};
