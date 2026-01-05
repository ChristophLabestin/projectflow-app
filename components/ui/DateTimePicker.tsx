import React from 'react';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';

interface DateTimePickerProps {
    dateValue: string | undefined;
    timeValue: string | undefined;
    onDateChange: (date: string) => void;
    onTimeChange: (time: string) => void;
    className?: string;
    label?: string;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
    dateValue,
    timeValue,
    onDateChange,
    onTimeChange,
    className = "",
    label
}) => {
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && (
                <label className="text-sm font-medium text-muted">
                    {label}
                </label>
            )}
            <div className="flex gap-2">
                <DatePicker
                    value={dateValue}
                    onChange={onDateChange}
                    className="flex-1"
                    placeholder="Select Date"
                />
                <TimePicker
                    value={timeValue}
                    onChange={onTimeChange}
                    className="w-32"
                    placeholder="Time"
                />
            </div>
        </div>
    );
};
