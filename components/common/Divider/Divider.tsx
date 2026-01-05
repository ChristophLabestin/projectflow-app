import React from 'react';
import './divider.scss';

interface DividerProps {
    className?: string;
}

export const Divider: React.FC<DividerProps> = ({ className = '' }) => {
    return <hr className={`divider ${className}`.trim()} />;
};
