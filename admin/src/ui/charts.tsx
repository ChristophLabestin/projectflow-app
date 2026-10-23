import React, { useLayoutEffect, useRef, useState } from 'react';
import { compact, day, num } from '../lib/format';

/** Small SVG charts without a chart library (CSP-friendly, token colours). */

const useWidth = <T extends HTMLElement>() => {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        if (!ref.current) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
};

export const Sparkline: React.FC<{ values: number[]; color?: string; height?: number }> = ({ values, color = 'var(--ac-chart-1)', height = 34 }) => {
    const [ref, width] = useWidth<HTMLDivElement>();
    const max = Math.max(1, ...values);
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
    return (
        <div ref={ref} style={{ height }}>
            {width > 0 && (
                <svg className="ac-chart" width={width} height={height} aria-hidden="true">
                    <path className="area" fill={color} d={`M0,${height} L${points.join(' L')} L${width},${height} Z`} />
                    <path className="line" stroke={color} d={`M${points.join(' L')}`} />
                </svg>
            )}
        </div>
    );
};

export type Series = { label: string; values: number[]; color?: string };
const COLORS = ['var(--ac-chart-1)', 'var(--ac-chart-2)', 'var(--ac-chart-3)', 'var(--ac-chart-4)'];

/** Line/area chart over day keys (YYYY-MM-DD) with hover readout. */
export const AreaChart: React.FC<{ days: string[]; series: Series[]; height?: number; format?: (v: number) => string; bars?: boolean }> = ({ days, series, height = 200, format = num, bars }) => {
    const [ref, width] = useWidth<HTMLDivElement>();
    const [hover, setHover] = useState<number | null>(null);
    const pad = { l: 36, r: 8, t: 8, b: 20 };
    const w = Math.max(0, width - pad.l - pad.r);
    const h = height - pad.t - pad.b;
    const max = Math.max(1, ...series.flatMap((s) => s.values));
    const n = days.length;
    const x = (i: number) => pad.l + (n > 1 ? (i * w) / (n - 1) : w / 2);
    const y = (v: number) => pad.t + h - (v / max) * h;
    const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
    const labelEvery = Math.max(1, Math.ceil(n / 7));
    const barW = Math.max(2, (w / Math.max(1, n)) * 0.7 / Math.max(1, series.length));

    const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const rel = event.clientX - rect.left - pad.l;
        setHover(Math.max(0, Math.min(n - 1, Math.round((rel / Math.max(1, w)) * (n - 1)))));
    };

    return (
        <div ref={ref} style={{ position: 'relative', height }}>
            {width > 0 && n > 0 && (
                <svg className="ac-chart" width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
                    {ticks.map((t) => (
                        <g key={t}>
                            <line className="grid" x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
                            <text className="axis" x={pad.l - 6} y={y(t) + 3} textAnchor="end">{compact(t)}</text>
                        </g>
                    ))}
                    {days.map((d, i) => (i % labelEvery === 0 || i === n - 1) && (
                        <text key={d} className="axis" x={x(i)} y={height - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{day(d)}</text>
                    ))}
                    {series.map((s, si) => {
                        const color = s.color || COLORS[si % COLORS.length];
                        if (bars) {
                            return s.values.map((v, i) => (
                                <rect key={`${si}-${i}`} className="bar" fill={color} opacity={hover == null || hover === i ? 0.9 : 0.45}
                                    x={x(i) - (barW * series.length) / 2 + si * barW} width={barW} y={y(v)} height={Math.max(0, pad.t + h - y(v))} />
                            ));
                        }
                        const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
                        return (
                            <g key={s.label}>
                                {si === 0 && <path className="area" fill={color} d={`M${x(0)},${pad.t + h} L${pts.join(' L')} L${x(n - 1)},${pad.t + h} Z`} />}
                                <path className="line" stroke={color} d={`M${pts.join(' L')}`} />
                                {hover != null && <circle cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={3} fill={color} />}
                            </g>
                        );
                    })}
                    {hover != null && !bars && <line className="cursor" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} />}
                </svg>
            )}
            {hover != null && width > 0 && (
                <div className="ac-chart-tip" style={{ left: Math.min(width - 150, Math.max(0, x(hover) + 10)), top: 4 }}>
                    <div className="ac-muted">{day(days[hover])}</div>
                    {series.map((s, si) => (
                        <div key={s.label}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 6, background: s.color || COLORS[si % COLORS.length] }} />{s.label}: <b>{format(s.values[hover] ?? 0)}</b></div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const Legend: React.FC<{ series: Series[] }> = ({ series }) => (
    <div className="ac-legend">{series.map((s, i) => <span key={s.label}><i style={{ background: s.color || COLORS[i % COLORS.length] }} />{s.label}</span>)}</div>
);

export const BarList: React.FC<{ items: { label: React.ReactNode; value: number; key?: string }[]; format?: (v: number) => string; limit?: number }> = ({ items, format = num, limit = 8 }) => {
    const max = Math.max(1, ...items.map((item) => item.value));
    return (
        <ul className="ac-barlist">
            {items.slice(0, limit).map((item, i) => (
                <li key={item.key || i}>
                    <span className="fill" style={{ width: `${(item.value / max) * 100}%` }} />
                    <span>{item.label}</span>
                    <b>{format(item.value)}</b>
                </li>
            ))}
        </ul>
    );
};

export const Meter: React.FC<{ value: number; color?: string }> = ({ value, color }) => (
    <div className="ac-meter"><span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} /></div>
);
