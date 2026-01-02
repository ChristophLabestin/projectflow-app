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
    const [popoverPosition, setPopoverPosition] = useState<{ top?: number; bottom?: number; left: number; transformOrigin?: string }>({ top: 0, left: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Calculate popover position when opened
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const popoverWidth = 200;
            const popoverHeight = 320; // Approximate height

            let left = align === 'right' ? rect.right - popoverWidth : rect.left;
            if (left + popoverWidth > window.innerWidth - 16) {
                left = window.innerWidth - popoverWidth - 16;
            }
            if (left < 16) left = 16;

            const spaceBelow = window.innerHeight - rect.bottom;
            const showAbove = spaceBelow < popoverHeight;

            if (showAbove) {
                setPopoverPosition({
                    bottom: window.innerHeight - rect.top + 8,
                    left: left,
                    transformOrigin: 'bottom left'
                });
            } else {
                setPopoverPosition({
                    top: rect.bottom + 8,
                    left: left,
                    transformOrigin: 'top left'
                });
            }
        }
    }, [isOpen, align]);

    const selectedRef = useRef<HTMLButtonElement>(null);

    // Scroll to selected time on open
    useEffect(() => {
        if (isOpen && selectedRef.current) {
            selectedRef.current.scrollIntoView({ block: "center", behavior: "auto" });
        } else if (isOpen) {
            // If no value, scroll to roughly current time?
            // Implementation in next step if tricky to get ref to exact current time without value
        }
    }, [isOpen]);

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

    // Close on scroll (except when scrolling inside the popover)
    useEffect(() => {
        const handleScroll = (event: Event) => {
            if (isOpen && popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
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
                bottom: popoverPosition.bottom,
                left: popoverPosition.left,
                transformOrigin: popoverPosition.transformOrigin,
                zIndex: 9999,
            }}
            className="p-2 bg-[var(--color-surface-card)] rounded-xl shadow-2xl border border-[var(--color-surface-border)] w-[200px] animate-scale-up"
        >
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                <div className="mb-2 px-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1 block">Custom</label>
                    <input
                        type="time"
                        className="w-full bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all text-[var(--color-text-main)]"
                        value={value || ''}
                        onChange={(e) => {
                            onChange(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setIsOpen(false);
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <div className="h-px bg-[var(--color-surface-border)] my-1 mx-1" />
                <div className="grid grid-cols-1 gap-1">
                    {times.map((t) => {
                        const isSelected = value === t;
                        return (
                            <button
                                key={t}
                                id={`time-option-${t}`}
                                ref={isSelected ? selectedRef : null}
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
