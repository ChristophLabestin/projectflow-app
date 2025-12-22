
import React from 'react';

interface BarChartProps {
    data: { label: string; value: number }[];
    height?: number;
    color?: string;
}

export const BarChart: React.FC<BarChartProps> = ({ data, height = 160, color = 'var(--color-primary)' }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1); // Prevent div by zero

    if (data.length === 0) {
        return <div className="text-center text-[var(--color-text-muted)] py-10">No activity data</div>;
    }

    return (
        <div className="w-full flex items-end justify-between gap-1" style={{ height }}>
            {data.map((item, index) => {
                const percentage = (item.value / maxValue) * 100;

                return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="relative w-full flex items-end justify-center h-full">
                            <div
                                className="w-full max-w-[12px] rounded-t-sm transition-all duration-500 ease-out hover:opacity-80 min-h-[2px]"
                                style={{
                                    height: `${percentage}%`,
                                    backgroundColor: item.value > 0 ? color : 'var(--color-surface-border)'
                                }}
                            >
                                {item.value > 0 && (
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[var(--color-surface-card)] shadow-lg border border-[var(--color-surface-border)] px-2 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                                        {item.value} posts
                                        <div className="text-[10px] text-[var(--color-text-muted)] font-normal">{item.label}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
