import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbsProps {
    items?: { label: string; to?: string }[];
}

export const Breadcrumbs = ({ items = [] }: BreadcrumbsProps) => {
    const location = useLocation();

    // Default: Home icon
    const parts = [
        <Link key="home" to="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors flex items-center">
            <span className="material-symbols-outlined text-[20px]">home</span>
        </Link>
    ];

    if (items.length > 0) {
        items.forEach((item, index) => {
            parts.push(
                <span key={`sep-${index}`} className="text-[var(--color-text-subtle)] mx-1">/</span>
            );
            if (item.to) {
                parts.push(
                    <Link key={index} to={item.to} className="text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                        {item.label}
                    </Link>
                );
            } else {
                parts.push(
                    <span key={index} className="text-sm font-semibold text-[var(--color-text-main)]">
                        {item.label}
                    </span>
                );
            }
        });
    }

    return (
        <div className="flex items-center">
            {parts}
        </div>
    );
};
