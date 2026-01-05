import React, { useState, useRef } from 'react';
import { TextInput } from '../Input/TextInput';
import { formatTime } from '../../../utils/dateUtils';
import { usePopoverPosition } from '../../../hooks/usePopoverPosition';
import { X } from 'lucide-react';
import './date-time.scss';

export interface TimePickerProps {
    value: Date | null;
    onChange: (date: Date | null) => void;
    label?: string;
    error?: string;
    disabled?: boolean;
}

export const TimePicker: React.FC<TimePickerProps> = ({
    value,
    onChange,
    label,
    error,
    disabled
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const position = usePopoverPosition(triggerRef, contentRef, isOpen);

    // Generate hours and minutes
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10...

    const handleTimeChange = (type: 'hour' | 'minute', val: number) => {
        const newDate = value ? new Date(value) : new Date();
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);

        if (type === 'hour') {
            newDate.setHours(val);
        } else {
            newDate.setMinutes(val);
        }
        onChange(newDate);
    };

    const currentHour = value ? value.getHours() : new Date().getHours();
    const currentMinute = value ? value.getMinutes() : new Date().getMinutes();

    // Round minute to nearest 5 for highlight logic if needed, 
    // but we just check exact match or close match for UX

    const handleManualChange = (type: 'hour' | 'minute', valStr: string) => {
        let val = parseInt(valStr, 10);
        if (isNaN(val)) return;

        if (type === 'hour') {
            if (val < 0) val = 0;
            if (val > 23) val = 23;
        } else {
            if (val < 0) val = 0;
            if (val > 59) val = 59;
        }

        const newDate = value ? new Date(value) : new Date();
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);

        if (type === 'hour') newDate.setHours(val);
        else newDate.setMinutes(val);

        onChange(newDate);
    };

    return (
        <div className="dt-picker" ref={triggerRef}>
            <div onClick={() => !disabled && setIsOpen(!isOpen)}>
                <TextInput
                    label={label}
                    error={error}
                    placeholder="HH:mm"
                    value={value ? formatTime(value) : ''}
                    readOnly
                    disabled={disabled}
                    style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                    rightElement={
                        value && !disabled ? (
                            <button
                                type="button"
                                className="dt-picker__clear-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(null);
                                }}
                            >
                                <X size={14} />
                            </button>
                        ) : null
                    }
                />
            </div>

            {isOpen && (
                <>
                    <div className="dt-picker__backdrop" onClick={() => setIsOpen(false)} />
                    <div
                        ref={contentRef}
                        className={`dt-picker__popover dt-picker__popover--time-only dt-picker__popover--visible dt-picker__popover--${position}`}
                        style={{ flexDirection: 'column' }}
                    >
                        <div className="dt-picker__manual-time">
                            <input
                                type="number"
                                className="dt-picker__time-input"
                                placeholder="HH"
                                value={currentHour.toString().padStart(2, '0')}
                                onChange={(e) => handleManualChange('hour', e.target.value)}
                            />
                            <span>:</span>
                            <input
                                type="number"
                                className="dt-picker__time-input"
                                placeholder="MM"
                                value={currentMinute.toString().padStart(2, '0')}
                                onChange={(e) => handleManualChange('minute', e.target.value)}
                            />
                        </div>
                        <div className="dt-picker__time-container">
                            <div className="dt-picker__time-col">
                                {hours.map(h => (
                                    <div
                                        key={h}
                                        className={`dt-picker__time-option ${h === currentHour ? 'dt-picker__time-option--selected' : ''}`}
                                        onClick={() => handleTimeChange('hour', h)}
                                    >
                                        {h.toString().padStart(2, '0')}
                                    </div>
                                ))}
                            </div>
                            <div className="dt-picker__time-col">
                                {minutes.map(m => (
                                    <div
                                        key={m}
                                        className={`dt-picker__time-option ${Math.abs(m - currentMinute) < 5 ? 'dt-picker__time-option--selected' : ''}`}
                                        onClick={() => {
                                            handleTimeChange('minute', m);
                                            // Optional: Close on minute select? leaving open for now.
                                        }}
                                    >
                                        {m.toString().padStart(2, '0')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
