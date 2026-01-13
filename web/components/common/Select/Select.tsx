import React, { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import './select.scss';

export interface SelectOption {
    label: string;
    value: string | number;
    disabled?: boolean;
}

export interface SelectProps {
    value: string | number | null;
    onChange: (value: string | number) => void;
    options: SelectOption[];
    placeholder?: string;
    label?: string;
    error?: string;
    disabled?: boolean;
    className?: string;
}

interface PopoverStyle {
    top: number;
    left: number;
    width: number;
}

export const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    label,
    error,
    disabled = false,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [popoverStyle, setPopoverStyle] = useState<PopoverStyle>({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const updatePosition = () => {
        if (!isOpen || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPopoverStyle({
            top: rect.bottom + window.scrollY, // Absolute position relative to doc
            left: rect.left + window.scrollX,
            width: rect.width
        });
    };

    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true); // Capture phase for nested scrolls
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    // Proper click outside handler for Portal
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (!isOpen) return;
            const target = e.target as Node;
            const isTrigger = triggerRef.current?.contains(target);
            const isPopover = popoverRef.current?.contains(target);

            if (!isTrigger && !isPopover) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            window.addEventListener('mousedown', handleClick);
        }
        return () => window.removeEventListener('mousedown', handleClick);
    }, [isOpen]);


    const handleSelect = (option: SelectOption) => {
        if (option.disabled) return;
        onChange(option.value);
        setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            } else {
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div className={`select-input ${isOpen ? 'select-input--open' : ''} ${className}`}>
            {label && <label className="select-input__label">{label}</label>}

            <button
                ref={triggerRef}
                type="button"
                className={`select-input__trigger ${disabled ? 'select-input__trigger--disabled' : ''} ${error ? 'select-input__trigger--error' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                data-placeholder={!selectedOption}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="select-input__trigger-content">
                    {selectedOption ? selectedOption.label : placeholder}
                </div>
                <ChevronDown
                    size={16}
                    className={`select-input__icon ${isOpen ? 'select-input__icon--open' : ''}`}
                />
            </button>

            {error && <span className="select-input__error-text">{error}</span>}

            {isOpen && createPortal(
                <div
                    ref={popoverRef}
                    className="select-input__popover"
                    style={{
                        position: 'absolute',
                        top: popoverStyle.top,
                        left: popoverStyle.left,
                        width: popoverStyle.width,
                        zIndex: 9999 // Ensure it's on top of everything
                    }}
                    role="listbox"
                >
                    {options.map((option) => (
                        <div
                            key={option.value}
                            className={`select-input__option ${value === option.value ? 'select-input__option--selected' : ''} ${option.disabled ? 'select-input__option--disabled' : ''}`}
                            onClick={() => handleSelect(option)}
                            role="option"
                            aria-selected={value === option.value}
                            aria-disabled={option.disabled}
                        >
                            <span>{option.label}</span>
                            {value === option.value && <Check size={16} className="select-input__check" />}
                        </div>
                    ))}
                    {options.length === 0 && (
                        <div className="select-input__option select-input__option--disabled">
                            No options
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};
