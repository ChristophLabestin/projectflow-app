import React from 'react';
import { Inbox } from 'lucide-react';
import { Sparkline } from './charts';
import { pct } from '../lib/format';

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'violet' | 'red';

export const Badge: React.FC<{ tone?: Tone; plain?: boolean; children: React.ReactNode; title?: string }> = ({ tone = 'neutral', plain, children, title }) => (
    <span title={title} className={`ac-badge ${tone !== 'neutral' ? `ac-badge--${tone}` : ''} ${plain ? 'ac-badge--plain' : ''}`}>{children}</span>
);

export const Card: React.FC<{ title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; flush?: boolean; className?: string; children: React.ReactNode }> = ({ title, subtitle, actions, flush, className, children }) => (
    <section className={`ac-card ${className || ''}`}>
        {(title || actions) && (
            <header className="ac-card__head">
                <div>
                    {title && <h3>{title}</h3>}
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actions && <div className="ac-row">{actions}</div>}
            </header>
        )}
        <div className={`ac-card__body ${flush ? 'ac-card__body--flush' : ''}`}>{children}</div>
    </section>
);

export const Stat: React.FC<{ label: React.ReactNode; value: React.ReactNode; meta?: React.ReactNode; change?: number | null; invert?: boolean; series?: number[]; color?: string; icon?: React.ReactNode }> = ({ label, value, meta, change, invert, series, color, icon }) => {
    const good = change == null ? null : invert ? change < 0 : change > 0;
    return (
        <div className="ac-card ac-stat">
            <span className="ac-stat__label">{icon}{label}</span>
            <span className="ac-stat__value">{value}</span>
            <span className="ac-stat__meta">
                {change != null && change !== 0 && <span className={`ac-stat__delta ${good ? 'is-up' : 'is-down'}`}>{change > 0 ? '▲' : '▼'} {pct(Math.abs(change), 0)}</span>}
                {meta}
            </span>
            {series && series.length > 1 && <div className="ac-stat__spark"><Sparkline values={series} color={color} /></div>}
        </div>
    );
};

export const Empty: React.FC<{ title: string; hint?: React.ReactNode; icon?: React.ReactNode }> = ({ title, hint, icon }) => (
    <div className="ac-empty">{icon || <Inbox size={22} />}<strong>{title}</strong>{hint && <span>{hint}</span>}</div>
);

export const Skeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
    <div className="ac-stack" style={{ padding: 14 }}>
        {Array.from({ length: rows }, (_, i) => <div key={i} className="ac-skeleton" style={{ width: `${90 - ((i * 17) % 40)}%` }} />)}
    </div>
);

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (value: T) => void }) {
    return (
        <div className="ac-seg" role="tablist">
            {options.map((option) => (
                <button key={option.value} type="button" role="tab" aria-selected={value === option.value} className={value === option.value ? 'is-active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>
            ))}
        </div>
    );
}

export const Tabs: React.FC<{ value: string; tabs: { value: string; label: React.ReactNode }[]; onChange: (value: string) => void }> = ({ value, tabs, onChange }) => (
    <div className="ac-tabs" role="tablist">
        {tabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value} className={value === tab.value ? 'is-active' : ''} onClick={() => onChange(tab.value)}>{tab.label}</button>)}
    </div>
);

export const ErrorNote: React.FC<{ error: Error | null; onRetry?: () => void }> = ({ error, onRetry }) => error ? (
    <div className="ac-alert ac-alert--error"><span style={{ flex: 1 }}>{error.message}</span>{onRetry && <button className="ac-btn ac-btn--sm" onClick={onRetry}>Erneut laden</button>}</div>
) : null;

export const PageHead: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
    <div className="ac-page__head">
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        {actions && <div className="ac-page__actions">{actions}</div>}
    </div>
);
