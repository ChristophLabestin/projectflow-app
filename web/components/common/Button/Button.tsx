import React from 'react';
import './button.scss';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    icon,
    iconPosition = 'left',
    className = '',
    disabled,
    ...props
}) => {
    const baseClass = 'btn';
    const variantClass = `btn--${variant}`;
    const sizeClass = `btn--${size}`;
    const loadingClass = isLoading ? 'btn--loading' : '';

    return (
        <button
            className={`${baseClass} ${variantClass} ${sizeClass} ${loadingClass} ${className}`.trim()}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <span className="btn__spinner" />}
            {!isLoading && icon && iconPosition === 'left' && <span className="btn__icon btn__icon--left">{icon}</span>}
            {children}
            {!isLoading && icon && iconPosition === 'right' && <span className="btn__icon btn__icon--right">{icon}</span>}
        </button>
    );
};
