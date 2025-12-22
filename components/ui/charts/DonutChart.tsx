
import React from 'react';

interface DonutChartProps {
    data: { label: string; value: number; color: string }[];
    size?: number;
    thickness?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, size = 160, thickness = 20 }) => {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    let currentAngle = 0;

    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-4 text-[var(--color-text-muted)] text-sm">
                <div
                    style={{ width: size, height: size }}
                    className="rounded-full border-4 border-[var(--color-surface-border)] flex items-center justify-center mb-2"
                >
                    No Data
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-6">
            <div className="relative">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                    {data.map((item, index) => {
                        const percentage = item.value / total;
                        const angle = percentage * 360;
                        const radius = (size - thickness) / 2;
                        const circumference = 2 * Math.PI * radius;
                        const strokeDasharray = `${(angle / 360) * circumference} ${circumference}`;
                        const offset = -1 * (currentAngle / 360) * circumference;

                        // Store current angle for next iteration

                        const circle = (
                            <circle
                                key={index}
                                r={radius}
                                cx={size / 2}
                                cy={size / 2}
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth={thickness}
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={offset} // Note: offset is normally positive in standard calc but standard SVG coords might need neg. Let's try standard.
                            // Actually, for multiple segments, we accumulate the rotation. 
                            // A simpler Way for SVG donuts is usinig stroke-dashoffset.
                            />
                        );

                        // Re-calculation for stroke-dashoffset method
                        // https://heyoka.medium.com/scratch-made-svg-donut-pie-charts-in-html5-2c587e935d72

                        currentAngle += angle;
                        return (
                            <circle
                                key={index}
                                r={radius}
                                cx={size / 2}
                                cy={size / 2}
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth={thickness}
                                strokeDasharray={`${(percentage * circumference)} ${circumference}`}
                                strokeDashoffset={-1 * (currentAngle - angle) / 360 * circumference}
                                className="transition-all duration-500 ease-out hover:opacity-80"
                            />
                        );
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-[var(--color-text-main)]">{total}</span>
                    <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Posts</span>
                </div>
            </div>

            <div className="space-y-2">
                {data.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-[var(--color-text-main)]">{item.label}</span>
                        <span className="text-[var(--color-text-muted)]">({Math.round((item.value / total) * 100)}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
