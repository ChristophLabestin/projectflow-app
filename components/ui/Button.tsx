import React from 'react';
import { Button as CommonButton } from '../common/Button/Button';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
};

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    isLoading,
    loading,
    icon,
    disabled,
    ...props
}: ButtonProps) => {
    const isButtonLoading = !!(isLoading || loading);

    return (
        <CommonButton
            variant={variant}
            size={size}
            isLoading={isButtonLoading}
            icon={icon}
            className={className}
            disabled={disabled}
            {...props}
        >
            {children}
        </CommonButton>
    );
};
