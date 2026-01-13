import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, AlertCircle, AlertTriangle, ArrowDown, ArrowRight, Minus, ChevronUp, Check } from 'lucide-react';
import './priority-select.scss';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface PrioritySelectProps {
    value: Priority;
    onChange: (value: Priority) => void;
    disabled?: boolean;
    className?: string;
    variant?: 'dropdown' | 'group';
}

const priorities: { value: Priority; label: string; icon: React.ReactNode }[] = [
    { value: 'low', label: 'Low', icon: <ChevronDown size={18} /> },
    { value: 'medium', label: 'Medium', icon: <Minus size={18} /> },
    { value: 'high', label: 'High', icon: <ChevronUp size={18} /> },
    { value: 'urgent', label: 'Urgent', icon: <AlertCircle size={18} /> },
];

export const PrioritySelect: React.FC<PrioritySelectProps> = ({
    value,
    onChange,
    disabled,
    className = '',
    variant = 'dropdown'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedPriority = priorities.find(p => p.value === value) || priorities[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen && variant === 'dropdown') {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, variant]);

    const handleSelect = (p: Priority) => {
        onChange(p);
        setIsOpen(false);
    };

    if (variant === 'group') {
        return (
            <div className={`priority-select priority-select--group ${className}`}>
                {priorities.map((p) => (
                    <div
                        key={p.value}
                        className={`priority-select__option priority-select__option--${p.value} ${value === p.value ? 'priority-select__option--selected' : ''} ${disabled ? 'priority-select__option--disabled' : ''}`}
                        onClick={() => !disabled && handleSelect(p.value)}
                        style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
                    >
                        <div className="priority-select__option-content">
                            {p.icon}
                            <span>{p.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Dropdown Variant
    return (
        <div className={`priority-select ${className}`} ref={containerRef}>
            <button
                type="button"
                className={`priority-select__trigger priority-select__trigger--${value} ${disabled ? 'priority-select__trigger--disabled' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="priority-select__value">
                    <span style={{ display: 'flex' }}>
                        {selectedPriority.icon}
                    </span>
                    <span>{selectedPriority.label}</span>
                </div>
                <ChevronDown size={16} className={`priority-select__chevron ${isOpen ? 'priority-select__chevron--open' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="priority-select__popover">
                        {priorities.map((p) => (
                            <div
                                key={p.value}
                                className={`priority-select__option priority-select__option--${p.value} ${value === p.value ? 'priority-select__option--selected' : ''}`}
                                onClick={() => handleSelect(p.value)}
                            >
                                <div className="priority-select__option-content">
                                    {p.icon}
                                    <span>{p.label}</span>
                                </div>
                                {value === p.value && (
                                    <div className="priority-select__check">
                                        <Check size={16} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
