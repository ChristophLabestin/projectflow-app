
import React from 'react';

interface TimePickerProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({ label, value, onChange, className = '' }) => {
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && (
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    type="time"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-4 py-2 bg-[var(--color-surface-input)] border border-[var(--color-surface-border)] rounded-lg text-[var(--color-text-main)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
                    <span className="material-symbols-outlined text-[20px]">schedule</span>
                </span>
            </div>
        </div>
    );
};
