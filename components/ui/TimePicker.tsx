import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface TimePickerProps {
    value: string | undefined; // HH:mm format
    onChange: (time: string) => void;
    placeholder?: string;
    className?: string;
    align?: 'left' | 'right';
    label?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, placeholder = "Select time", className = "", align = 'left', label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Calculate popover position when opened
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const popoverWidth = 200;

            let left = align === 'right' ? rect.right - popoverWidth : rect.left;
            if (left + popoverWidth > window.innerWidth - 16) {
                left = window.innerWidth - popoverWidth - 16;
            }
            if (left < 16) left = 16;

            setPopoverPosition({
                top: rect.bottom + 8,
                left: left,
            });
        }
    }, [isOpen, align]);

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

    const times = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) { // Using 30 min intervals for compactness, or 15
            const hh = h.toString().padStart(2, '0');
            const mm = m.toString().padStart(2, '0');
            times.push(`${hh}:${mm}`);
        }
    }

    const popoverContent = isOpen ? (
        <div
            ref={popoverRef}
            style={{
                position: 'fixed',
                top: popoverPosition.top,
                left: popoverPosition.left,
                zIndex: 9999,
            }}
            className="p-2 bg-[var(--color-surface-card)] rounded-xl shadow-2xl border border-[var(--color-surface-border)] w-[200px] animate-scale-up"
        >
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 gap-1">
                    {times.map((t) => {
                        const isSelected = value === t;
                        return (
                            <button
                                key={t}
                                onClick={() => {
                                    onChange(t);
                                    setIsOpen(false);
                                }}
                                className={`
                                    w-full px-3 py-2 text-sm rounded-lg text-left transition-all
                                    ${isSelected
                                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] font-bold'
                                        : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                    }
                                `}
                            >
                                {t}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className={`relative flex flex-col gap-1.5 ${className}`} ref={containerRef}>
            {label && (
                <label className="text-sm font-medium text-[var(--color-text-muted)]">
                    {label}
                </label>
            )}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all text-sm
                    bg-[var(--color-surface-bg)] text-[var(--color-text-main)]
                    border border-[var(--color-surface-border)]
                `}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="material-symbols-outlined text-[20px] leading-none text-[var(--color-text-subtle)] flex-shrink-0">schedule</span>
                    <span className={!value ? 'text-[var(--color-text-subtle)] truncate' : 'truncate'}>
                        {value || placeholder}
                    </span>
                </div>
                {value && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
                        className="hover:bg-[var(--color-surface-hover)] p-0.5 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors flex-shrink-0 ml-1"
                    >
                        <span className="material-symbols-outlined text-[16px] block">close</span>
                    </div>
                )}
            </div>
            {ReactDOM.createPortal(popoverContent, document.body)}
        </div>
    );
};
