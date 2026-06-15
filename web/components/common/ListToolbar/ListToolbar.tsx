import React, { useId } from 'react';
import './list-toolbar.scss';

export interface ListToolbarProps {
    title?: string;
    description?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    filters?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

export const ListToolbar: React.FC<ListToolbarProps> = ({
    title,
    description,
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Search...',
    filters,
    actions,
    children,
    className = '',
}) => {
    const searchId = useId();
    const hasSearch = typeof searchValue === 'string' && onSearchChange;

    return (
        <div className={`list-toolbar ${className}`.trim()}>
            {(title || description) && (
                <div className="list-toolbar__header">
                    {title && <h3>{title}</h3>}
                    {description && <p>{description}</p>}
                </div>
            )}
            <div className="list-toolbar__controls">
                {hasSearch && (
                    <label className="list-toolbar__search" htmlFor={searchId}>
                        <span className="material-symbols-outlined" aria-hidden="true">search</span>
                        <input
                            id={searchId}
                            value={searchValue}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder={searchPlaceholder}
                            type="search"
                        />
                    </label>
                )}
                {filters && <div className="list-toolbar__filters">{filters}</div>}
                {actions && <div className="list-toolbar__actions">{actions}</div>}
                {children}
            </div>
        </div>
    );
};
