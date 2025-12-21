import React from 'react';

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    fill?: boolean;
}

export const Sparkline = ({ data, width = 200, height = 60, color = 'var(--color-primary)', fill = false }: SparklineProps) => {
    if (data.length < 2) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1; // avoid divide by zero

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d - min) / range) * height; // Invert Y
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
            {fill && (
                <path
                    d={`M 0,${height} L ${points} L ${width},${height} Z`}
                    fill={color}
                    fillOpacity="0.1"
                    stroke="none"
                />
            )}
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
};
