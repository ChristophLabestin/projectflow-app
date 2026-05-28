import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from '../Input/TextInput';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
    DAYS_OF_WEEK,
    MONTH_NAMES,
    getDaysInMonth,
    getFirstDayOfMonth,
    formatDate,
    isSameDay,
    isToday,
    formatDateDisplay
} from '../../../utils/dateUtils';
import './date-time.scss';

export interface DatePickerProps {
    value: Date | null;
    onChange: (date: Date | null) => void;
    label?: string;
    error?: string;
    placeholder?: string;
    minDate?: Date;
    maxDate?: Date;
    disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    label,
    error,
    placeholder = 'MMM. DD YYYY',
    minDate,
    maxDate,
    disabled
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
    const [horizontalPosition, setHorizontalPosition] = useState<'left' | 'right'>('left');
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 'auto',
        bottom: 'auto',
        zIndex: 10000
    });
    const triggerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // View state for the calendar
    const [viewDate, setViewDate] = useState(value || new Date());
    const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day');

    // Sync viewDate if external value changes (optional UX choice)
    useEffect(() => {
        if (value) {
            setViewDate(value);
        }
    }, [value]);

    useLayoutEffect(() => {
        if (!isOpen || !triggerRef.current) return;

        const updatePopoverPosition = () => {
            const triggerRect = triggerRef.current?.getBoundingClientRect();
            if (!triggerRect) return;

            const contentWidth = contentRef.current?.offsetWidth || 280;
            const contentHeight = contentRef.current?.offsetHeight || 320;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const buffer = 16;
            const gap = 4;
            const availableBelow = viewportHeight - triggerRect.bottom;
            const availableAbove = triggerRect.top;
            const nextPosition = availableBelow < contentHeight + buffer && availableAbove > contentHeight + buffer
                ? 'top'
                : 'bottom';
            const nextHorizontalPosition = triggerRect.left + contentWidth > viewportWidth - buffer
                ? 'right'
                : 'left';
            const rawLeft = nextHorizontalPosition === 'right'
                ? triggerRect.right - contentWidth
                : triggerRect.left;
            const maxLeft = Math.max(buffer, viewportWidth - contentWidth - buffer);
            const rawTop = nextPosition === 'top'
                ? triggerRect.top - contentHeight - gap
                : triggerRect.bottom + gap;
            const maxTop = Math.max(buffer, viewportHeight - contentHeight - buffer);

            setPosition(nextPosition);
            setHorizontalPosition(nextHorizontalPosition);
            setPopoverStyle({
                position: 'fixed',
                top: Math.max(buffer, Math.min(rawTop, maxTop)),
                left: Math.max(buffer, Math.min(rawLeft, maxLeft)),
                right: 'auto',
                bottom: 'auto',
                zIndex: 10000
            });
        };

        updatePopoverPosition();
        const frame = window.requestAnimationFrame(updatePopoverPosition);
        window.addEventListener('resize', updatePopoverPosition);
        window.addEventListener('scroll', updatePopoverPosition, true);

        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', updatePopoverPosition);
            window.removeEventListener('scroll', updatePopoverPosition, true);
        };
    }, [isOpen]);

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
            // Jump 12 years if in year view? or just 12 page
            setViewDate(new Date(viewDate.getFullYear() + 12, viewDate.getMonth(), 1));
        } else {
            setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1));
        }
    };

    const handleDayClick = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        onChange(newDate);
        setIsOpen(false);
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

    // Render Helpers
    const renderCalendarGrid = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(month, year);
        const firstDay = getFirstDayOfMonth(month, year); // 0 = Sunday

        const days = [];

        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="dt-picker__day dt-picker__day--empty" />);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day);
            const isSelected = value ? isSameDay(currentDayDate, value) : false;
            const isCurrentDay = isToday(currentDayDate);

            // Disable if out of range (basic implementation)
            let isDisabled = false;
            if (minDate && currentDayDate < minDate) isDisabled = true;
            if (maxDate && currentDayDate > maxDate) isDisabled = true;

            days.push(
                <div
                    key={day}
                    className={`dt-picker__day 
                        ${isSelected ? 'dt-picker__day--selected' : ''} 
                        ${isCurrentDay ? 'dt-picker__day--today' : ''}
                        ${isDisabled ? 'dt-picker__day--disabled' : ''}
                    `.trim()}
                    onClick={() => !isDisabled && handleDayClick(day)}
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

    return (
        <div className="dt-picker" ref={triggerRef}>
            <div onClick={() => !disabled && setIsOpen(!isOpen)}>
                <TextInput
                    label={label}
                    error={error}
                    placeholder={placeholder}
                    value={value ? formatDateDisplay(value) : ''}
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
                    {createPortal(
                        <div
                            ref={contentRef}
                            className={`dt-picker__popover dt-picker__popover--portal dt-picker__popover--visible dt-picker__popover--${position} dt-picker__popover--align-${horizontalPosition}`}
                            style={popoverStyle}
                        >
                            <div className="dt-picker__header">
                                {viewMode !== 'year' && (
                                    <button className="dt-picker__nav-btn" onClick={handlePrevMonth}>
                                        <ChevronLeft size={16} />
                                    </button>
                                )}

                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {/* Only show Month button if not in year view? or always allow jumping? */}
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
                                    {DAYS_OF_WEEK.map(day => (
                                        <div key={day} className="dt-picker__day-label">{day}</div>
                                    ))}
                                    {renderCalendarGrid()}
                                </div>
                            )}
                            {viewMode === 'month' && renderMonthGrid()}
                            {viewMode === 'year' && renderYearGrid()}
                        </div>,
                        document.body
                    )}
                </>
            )}
        </div>
    );
};
