import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../Button/Button';
import './filter-menu.scss';

export interface FilterMenuProps {
    label: string;
    title?: string;
    activeCount?: number;
    onReset?: () => void;
    resetLabel?: string;
    children: React.ReactNode;
    className?: string;
}

export const FilterMenu: React.FC<FilterMenuProps> = ({
    label,
    title,
    activeCount = 0,
    onReset,
    resetLabel = 'Reset filters',
    children,
    className = '',
}) => {
    const menuId = useId();
    const [isOpen, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        window.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div className={`filter-menu ${className}`.trim()} ref={rootRef}>
            <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={isOpen}
                aria-controls={menuId}
                icon={<span className="material-symbols-outlined">filter_alt</span>}
            >
                {label}
                {activeCount > 0 && <span className="filter-menu__count">{activeCount}</span>}
            </Button>
            {isOpen && (
                <div className="filter-menu__panel" id={menuId}>
                    {(title || onReset) && (
                        <div className="filter-menu__header">
                            {title && <h4>{title}</h4>}
                            {onReset && (
                                <button type="button" onClick={onReset}>
                                    {resetLabel}
                                </button>
                            )}
                        </div>
                    )}
                    <div className="filter-menu__body">{children}</div>
                </div>
            )}
        </div>
    );
};
