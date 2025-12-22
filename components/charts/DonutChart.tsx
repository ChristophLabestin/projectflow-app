import React from 'react';

interface DonutChartProps {
    data: { name: string; value: number; color: string }[];
    size?: number;
    thickness?: number;
    showEmptyLabel?: boolean;
}

export const DonutChart = ({ data, size = 160, thickness = 20, showEmptyLabel = true }: DonutChartProps) => {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    const radius = (size - thickness) / 2;
    const center = size / 2;
    let startAngle = 0;

    if (total === 0) {
        return (
            <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
                <div className="w-full h-full rounded-full border-[10px] border-[var(--color-surface-border)] opacity-30"></div>
                {showEmptyLabel && <span className="absolute text-xs text-[var(--color-text-muted)]">No data</span>}
            </div>
        );
    }

    return (
        <svg wwidth={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            {data.map((item, index) => {
                const angle = (item.value / total) * 360;
                const endAngle = startAngle + angle;

                // Calculate paths math (simplified arc)
                // For a full circle sector we need more complex path commands, 
                // but for simple donut segments we can use stroke-dasharray trick on a circle
                const circumference = 2 * Math.PI * radius;
                const strokeDasharray = `${(angle / 360) * circumference} ${circumference}`;
                const strokeDashoffset = -((startAngle / 360) * circumference);

                const segment = (
                    <circle
                        key={index}
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke={item.color}
                        strokeWidth={thickness}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500 ease-out"
                    />
                );

                startAngle += angle;
                return segment;
            })}
        </svg>
    );
};
