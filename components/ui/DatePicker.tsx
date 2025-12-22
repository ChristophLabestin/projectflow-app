import React, { useState, useRef, useEffect } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    parseISO,
    isValid
} from 'date-fns';

interface DatePickerProps {
    value: string | undefined;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
    align?: 'left' | 'right';
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, placeholder = "Select date", className = "", align = 'left' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize current month from value if valid
    useEffect(() => {
        if (value) {
            const date = parseISO(value);
            if (isValid(date)) {
                setCurrentMonth(date);
            }
        }
    }, [isOpen]);

    const selectedDate = value ? parseISO(value) : undefined;

    // Calendar generation
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentMonth(subMonths(currentMonth, 1));
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentMonth(addMonths(currentMonth, 1));
    };

    const handleDateClick = (day: Date) => {
        onChange(format(day, 'yyyy-MM-dd'));
        setIsOpen(false);
    };

    const clearDate = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setIsOpen(false);
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Input Trigger - Matched with Input.tsx styling */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full px-3 py-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-sm
                    bg-[var(--color-surface-bg)] text-[var(--color-text-main)]
                    focus:outline-none focus:ring-0 focus:ring-offset-0
                    ${isOpen ? 'border-[var(--color-surface-border)]' : 'border-[var(--color-surface-border)]'}
                `}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="material-symbols-outlined text-[20px] leading-none text-[var(--color-text-subtle)] flex-shrink-0">calendar_today</span>
                    {value && isValid(parseISO(value)) ? (
                        <span className="truncate">{format(parseISO(value), 'MMM d, yyyy')}</span>
                    ) : (
                        <span className="text-[var(--color-text-subtle)] truncate">{placeholder}</span>
                    )}
                </div>
                {value && (
                    <div
                        onClick={clearDate}
                        className="hover:bg-[var(--color-surface-hover)] p-0.5 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors flex-shrink-0 ml-1"
                    >
                        <span className="material-symbols-outlined text-[16px] block">close</span>
                    </div>
                )}
            </div>

            {/* Calendar Popover */}
            {isOpen && (
                <div
                    className={`
                        absolute top-full mt-2 z-50 p-4 bg-[var(--color-surface-card)] rounded-xl shadow-xl border border-[var(--color-surface-border)] min-w-[280px] animate-scale-up
                        ${align === 'right' ? 'right-0' : 'left-0'}
                    `}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={handlePrevMonth} className="p-1 hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors text-[var(--color-text-main)]">
                            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                        </button>
                        <span className="font-bold text-sm text-[var(--color-text-main)]">
                            {format(currentMonth, 'MMMM yyyy')}
                        </span>
                        <button onClick={handleNextMonth} className="p-1 hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors text-[var(--color-text-main)]">
                            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>
                    </div>

                    {/* Weekday Labels */}
                    <div className="grid grid-cols-7 mb-2">
                        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
                            <div key={day} className="text-center text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, idx) => {
                            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const isTodayDate = isToday(day);

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => handleDateClick(day)}
                                    className={`
                                        h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all relative
                                        ${!isCurrentMonth ? 'text-[var(--color-text-subtle)] opacity-40' : 'text-[var(--color-text-main)]'}
                                        ${isSelected ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] shadow-md font-medium' : 'hover:bg-[var(--color-surface-hover)]'}
                                        ${isTodayDate && !isSelected ? 'text-[var(--color-primary)] font-bold border border-[var(--color-primary-fade)]' : ''}
                                    `}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick Select Today */}
                    <div className="mt-3 pt-3 border-t border-[var(--color-surface-border)] flex justify-center">
                        <button
                            onClick={() => handleDateClick(new Date())}
                            className="text-xs font-bold text-[var(--color-primary)] hover:underline"
                        >
                            Today
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
