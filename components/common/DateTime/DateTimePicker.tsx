import React, { useState, useEffect, useRef } from 'react';
import { TextInput } from '../Input/TextInput';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
    DAYS_OF_WEEK,
    MONTH_NAMES,
    getDaysInMonth,
    getFirstDayOfMonth,
    formatDateTimeDisplay,
    isSameDay,
    isToday
} from '../../../utils/dateUtils';
import { usePopoverPosition } from '../../../hooks/usePopoverPosition';
import './date-time.scss';

export interface DateTimePickerProps {
    value: Date | null;
    onChange: (date: Date | null) => void;
    label?: string;
    error?: string;
    minDate?: Date;
    maxDate?: Date;
    disabled?: boolean;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
    value,
    onChange,
    label,
    error,
    // minDate,
    // maxDate,
    disabled
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const position = usePopoverPosition(triggerRef, contentRef, isOpen);

    // View state for the calendar
    const [viewDate, setViewDate] = useState(value || new Date());
    const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day');

    useEffect(() => {
        if (value) {
            setViewDate(value);
        }
    }, [value]);

    // Calendar Navigation
    const handlePrevMonth = () => {
        if (viewMode === 'day') {
            setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
        } else if (viewMode === 'year') {
            setViewDate(new Date(viewDate.getFullYear() - 12, viewDate.getMonth(), 1));
        } else {
            setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1));
        }
    };

    const handleNextMonth = () => {
        if (viewMode === 'day') {
            setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
        } else if (viewMode === 'year') {
            setViewDate(new Date(viewDate.getFullYear() + 12, viewDate.getMonth(), 1));
        } else {
            setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1));
        }
    };

    // Date Selection
    const handleDayClick = (day: number) => {
        const currentRef = value || new Date();
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, currentRef.getHours(), currentRef.getMinutes());
        onChange(newDate);
    };

    const handleMonthClick = (monthIndex: number) => {
        const newDate = new Date(viewDate.getFullYear(), monthIndex, 1);
        setViewDate(newDate);
        setViewMode('day');
    };

    const handleYearClick = (year: number) => {
        const newDate = new Date(year, viewDate.getMonth(), 1);
        setViewDate(newDate);
        setViewMode('month');
    };

    // Time Selection
    const handleTimeChange = (type: 'hour' | 'minute', val: number) => {
        const baseDate = value || new Date(); // If null, start from now
        const newDate = new Date(baseDate);
        // If we were null, we need to ensure we set the viewDate's year/month/day too or stick to today?
        // Let's assume if value is null, picking time sets it to Today at that time.

        if (!value) {
            // If no date selected yet, default to today's date + selected time
            newDate.setFullYear(viewDate.getFullYear());
            newDate.setMonth(viewDate.getMonth());
            newDate.setDate(viewDate.getDate());
        }

        if (type === 'hour') newDate.setHours(val);
        else newDate.setMinutes(val);

        onChange(newDate);
    };

    // Render Logic (Duplicate from DatePicker - Refactoring would be ideal but keeping independent for now)
    const renderCalendarGrid = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(month, year);
        const firstDay = getFirstDayOfMonth(month, year);

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="dt-picker__day dt-picker__day--empty" />);
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day);
            const isSelected = value ? isSameDay(currentDayDate, value) : false;
            const isCurrentDay = isToday(currentDayDate);
            days.push(
                <div
                    key={day}
                    className={`dt-picker__day ${isSelected ? 'dt-picker__day--selected' : ''} ${isCurrentDay ? 'dt-picker__day--today' : ''}`.trim()}
                    onClick={() => handleDayClick(day)}
                >
                    {day}
                </div>
            );
        }
        return days;
    };

    const renderMonthGrid = () => {
        return (
            <div className="dt-picker__selection-grid">
                {MONTH_NAMES.map((m, i) => (
                    <div
                        key={m}
                        className={`dt-picker__selection-item ${viewDate.getMonth() === i ? 'dt-picker__selection-item--selected' : ''}`}
                        onClick={() => handleMonthClick(i)}
                    >
                        {m.substring(0, 3)}
                    </div>
                ))}
            </div>
        );
    };

    const renderYearGrid = () => {
        const currentYear = viewDate.getFullYear();
        const startYear = currentYear - 6;
        const endYear = currentYear + 5;
        const years = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y);
        }

        return (
            <div className="dt-picker__selection-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {years.map(y => (
                    <div
                        key={y}
                        className={`dt-picker__selection-item ${viewDate.getFullYear() === y ? 'dt-picker__selection-item--selected' : ''}`}
                        onClick={() => handleYearClick(y)}
                    >
                        {y}
                    </div>
                ))}
            </div>
        );
    };

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
    const currentHour = value ? value.getHours() : 0;
    const currentMinute = value ? value.getMinutes() : 0;

    // Manual Time Input Handler
    const handleManualTimeChange = (type: 'hour' | 'minute', valStr: string) => {
        let val = parseInt(valStr, 10);
        if (isNaN(val)) return;

        if (type === 'hour') {
            if (val < 0) val = 0;
            if (val > 23) val = 23;
        } else {
            if (val < 0) val = 0;
            if (val > 59) val = 59;
        }

        const baseDate = value || new Date();
        const newDate = new Date(baseDate);

        if (!value) {
            newDate.setFullYear(viewDate.getFullYear());
            newDate.setMonth(viewDate.getMonth());
            newDate.setDate(viewDate.getDate());
        }

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
                    placeholder="YYYY-MM-DD HH:mm"
                    value={value ? formatDateTimeDisplay(value) : ''}
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
                        className={`dt-picker__popover dt-picker__popover--visible dt-picker__popover--${position}`}
                    >
                        <div className="dt-picker__dual-pane">
                            {/* Left Side: Calendar */}
                            <div style={{ flex: 1 }}>
                                <div className="dt-picker__header">
                                    {viewMode !== 'year' && (
                                        <button className="dt-picker__nav-btn" onClick={handlePrevMonth}>
                                            <ChevronLeft size={16} />
                                        </button>
                                    )}

                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {viewMode === 'day' && (
                                            <button className="dt-picker__title-btn" onClick={() => setViewMode('month')}>
                                                {MONTH_NAMES[viewDate.getMonth()]}
                                            </button>
                                        )}
                                        <button className="dt-picker__title-btn" onClick={() => setViewMode('year')}>
                                            {viewDate.getFullYear()}
                                        </button>
                                    </div>

                                    {viewMode !== 'year' && (
                                        <button className="dt-picker__nav-btn" onClick={handleNextMonth}>
                                            <ChevronRight size={16} />
                                        </button>
                                    )}
                                </div>
                                {viewMode === 'day' && (
                                    <div className="dt-picker__grid">
                                        {DAYS_OF_WEEK.map(day => <div key={day} className="dt-picker__day-label">{day}</div>)}
                                        {renderCalendarGrid()}
                                    </div>
                                )}
                                {viewMode === 'month' && renderMonthGrid()}
                                {viewMode === 'year' && renderYearGrid()}
                            </div>

                            {/* Right Side: Time */}
                            <div className="dt-picker__dual-time-col" style={{ flexDirection: 'column' }}>
                                <div className="dt-picker__manual-time" style={{ padding: '8px 4px', borderRadius: 0, borderBottom: '1px solid var(--color-surface-border)' }}>
                                    <input
                                        type="number"
                                        className="dt-picker__time-input"
                                        style={{ width: '36px', padding: '2px' }}
                                        placeholder="HH"
                                        value={currentHour.toString().padStart(2, '0')}
                                        onChange={(e) => handleManualTimeChange('hour', e.target.value)}
                                    />
                                    <span style={{ margin: '0 2px' }}>:</span>
                                    <input
                                        type="number"
                                        className="dt-picker__time-input"
                                        style={{ width: '36px', padding: '2px' }}
                                        placeholder="MM"
                                        value={currentMinute.toString().padStart(2, '0')}
                                        onChange={(e) => handleManualTimeChange('minute', e.target.value)}
                                    />
                                </div>
                                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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
                                                onClick={() => handleTimeChange('minute', m)}
                                            >
                                                {m.toString().padStart(2, '0')}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
