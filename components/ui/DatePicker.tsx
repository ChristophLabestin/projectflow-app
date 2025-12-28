import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
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
    disabled?: boolean;
    label?: string;
}

import { useLanguage } from '../../context/LanguageContext';

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, placeholder = "Select date", className = "", align = 'left', disabled = false, label }) => {
    const { dateFormat, dateLocale } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Initialize current month from value if valid
    useEffect(() => {
        if (value) {
            const date = parseISO(value);
            if (isValid(date)) {
                setCurrentMonth(date);
            }
        }
    }, [isOpen]);

    // Calculate popover position when opened
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const popoverWidth = 296; // min-w-[280px] + padding

            let left = align === 'right' ? rect.right - popoverWidth : rect.left;

            // Ensure it doesn't go off-screen
            if (left + popoverWidth > window.innerWidth - 16) {
                left = window.innerWidth - popoverWidth - 16;
            }
            if (left < 16) {
                left = 16;
            }

            setPopoverPosition({
                top: rect.bottom + 8,
                left: left,
            });
        }
    }, [isOpen, align]);

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
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node)
            ) {
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

    // Close on scroll
    useEffect(() => {
        const handleScroll = () => {
            if (isOpen) setIsOpen(false);
        };

        if (isOpen) {
            window.addEventListener('scroll', handleScroll, true);
        }
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    const popoverContent = isOpen ? (
        <div
            ref={popoverRef}
            style={{
                position: 'fixed',
                top: popoverPosition.top,
                left: popoverPosition.left,
                zIndex: 9999,
            }}
            className="p-4 bg-[var(--color-surface-card)] rounded-xl shadow-2xl border border-[var(--color-surface-border)] min-w-[280px] animate-scale-up"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors text-[var(--color-text-main)]">
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <span className="font-bold text-sm text-[var(--color-text-main)]">
                    {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
                </span>
                <button onClick={handleNextMonth} className="p-1 hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors text-[var(--color-text-main)]">
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 mb-2">
                {eachDayOfInterval({
                    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
                    end: endOfWeek(new Date(), { weekStartsOn: 1 })
                }).map(day => (
                    <div key={day.toString()} className="text-center text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        {format(day, 'EEEEEE', { locale: dateLocale })}
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
                                ${isTodayDate && !isSelected ? 'text-[var(--color-primary)] font-bold' : ''}
                            `}
                        >
                            {format(day, 'd')}
                            {isTodayDate && !isSelected && (
                                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-primary)]" />
                            )}
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
    ) : null;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2 block">{label}</label>
            )}
            {/* Input Trigger */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    w-full px-3 py-2.5 rounded-xl flex items-center justify-between transition-all text-sm
                    bg-[var(--color-surface-bg)] text-[var(--color-text-main)]
                    focus:outline-none focus:ring-0 focus:ring-offset-0
                    ${className.includes('border-0') ? 'border-0' : 'border border-[var(--color-surface-border)]'}
                    ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="material-symbols-outlined text-[20px] leading-none text-[var(--color-text-subtle)] flex-shrink-0">calendar_today</span>
                    {value && isValid(parseISO(value)) ? (
                        <span className="truncate">{format(parseISO(value), dateFormat, { locale: dateLocale })}</span>
                    ) : (
                        <span className="text-[var(--color-text-subtle)] truncate">{placeholder}</span>
                    )}
                </div>
                {value && !disabled && (
                    <div
                        onClick={clearDate}
                        className="hover:bg-[var(--color-surface-hover)] p-0.5 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors flex-shrink-0 ml-1"
                    >
                        <span className="material-symbols-outlined text-[16px] block">close</span>
                    </div>
                )}
            </div>

            {/* Portal the popover to body */}
            {ReactDOM.createPortal(popoverContent, document.body)}
        </div>
    );
};

