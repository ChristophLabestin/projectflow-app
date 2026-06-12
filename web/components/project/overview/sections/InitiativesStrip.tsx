import React, { useEffect, useRef, useState } from 'react';
import type { Initiative, Task } from '../../../../types';

const PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#6366f1', '#ef4444', '#64748b'];

const isDone = (task: Task) => task.isCompleted || task.status === 'Done';

type InitiativesStripProps = {
    initiatives: Initiative[];
    tasks: Task[];
    activeInitiativeId: string | null;
    canManage: boolean;
    statusLabels: Record<string, string>;
    onSelect: (id: string) => void;
    onOpenInitiative: (id: string) => void;
    onSetColor: (id: string, color: string | null) => void;
    onCreate: () => void;
    t: (key: string, fallback?: string) => string;
};

const ColorPicker: React.FC<{ current?: string; onPick: (color: string | null) => void; t: InitiativesStripProps['t'] }> = ({ current, onPick, t }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);
    return (
        <div className="po-inits__color" ref={ref}>
            <button
                type="button"
                className="po-inits__icon-btn"
                onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                title={t('projectOverview.v2.initiatives.setColor', 'Accent color')}
                aria-label={t('projectOverview.v2.initiatives.setColor', 'Accent color')}
            >
                {current
                    ? <span className="po-inits__color-dot" style={{ background: current }} />
                    : <span className="material-symbols-outlined">palette</span>}
            </button>
            {open && (
                <div className="po-inits__swatches" onClick={(e) => e.stopPropagation()}>
                    {PALETTE.map((color) => (
                        <button
                            key={color}
                            type="button"
                            className={`po-inits__swatch ${current === color ? 'is-active' : ''}`.trim()}
                            style={{ background: color }}
                            onClick={() => { onPick(color); setOpen(false); }}
                            aria-label={color}
                        />
                    ))}
                    <button
                        type="button"
                        className="po-inits__swatch po-inits__swatch--clear"
                        onClick={() => { onPick(null); setOpen(false); }}
                        title={t('projectOverview.v2.initiatives.clearColor', 'No color')}
                        aria-label={t('projectOverview.v2.initiatives.clearColor', 'No color')}
                    >
                        <span className="material-symbols-outlined">format_color_reset</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export const InitiativesStrip: React.FC<InitiativesStripProps> = ({
    initiatives, tasks, activeInitiativeId, canManage, statusLabels, onSelect, onOpenInitiative, onSetColor, onCreate, t
}) => {
    const [collapsed, setCollapsed] = useState(false);
    if (!initiatives.length) return null;

    return (
        <section className="po-inits" aria-label={t('projectOverview.v2.group.initiative', 'Initiatives')}>
            <header className="po-inits__head">
                <button type="button" className="po-inits__head-main" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
                    <span className={`material-symbols-outlined po-inits__chevron ${collapsed ? 'is-collapsed' : ''}`.trim()}>expand_more</span>
                    <span className="material-symbols-outlined po-inits__head-icon">rocket_launch</span>
                    <span className="po-inits__title">{t('projectOverview.v2.group.initiative', 'Initiatives')}</span>
                    <span className="po-inits__count">{initiatives.length}</span>
                </button>
                <div className="po-inits__head-actions">
                    {activeInitiativeId && (
                        <button type="button" className="po-inits__clear" onClick={() => onSelect(activeInitiativeId)}>
                            <span className="material-symbols-outlined">filter_alt_off</span>
                            {t('projectOverview.v2.initiatives.clearFilter', 'Clear filter')}
                        </button>
                    )}
                    {canManage && (
                        <button type="button" className="po-inits__new" onClick={onCreate}>
                            <span className="material-symbols-outlined">add</span>
                            {t('projectOverview.actions.newInitiative', 'New initiative')}
                        </button>
                    )}
                </div>
            </header>

            {!collapsed && (
                <div className="po-inits__list">
                    {initiatives.map((initiative) => {
                        const initTasks = tasks.filter((task) => task.initiativeId === initiative.id);
                        const total = initTasks.length;
                        const done = initTasks.filter(isDone).length;
                        const pct = total ? Math.round((done / total) * 100) : 0;
                        const active = activeInitiativeId === initiative.id;
                        const color = initiative.color;
                        const health = initiative.health;
                        return (
                            <div
                                key={initiative.id}
                                className={`po-inits__row ${active ? 'is-active' : ''}`.trim()}
                                style={color ? { ['--init-color' as any]: color } : undefined}
                                role="button"
                                tabIndex={0}
                                onClick={() => onOpenInitiative(initiative.id)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpenInitiative(initiative.id); } }}
                                title={t('projectOverview.v2.initiatives.open', 'Open initiative')}
                            >
                                <span className="po-inits__bar" />
                                <div className="po-inits__main">
                                    <span className="po-inits__name">{initiative.title}</span>
                                    {initiative.status && (
                                        <span className="po-inits__status" data-status={initiative.status}>{statusLabels[initiative.status] || initiative.status}</span>
                                    )}
                                    {health && health !== 'On Track' && (
                                        <span className={`po-inits__health ${health === 'Off Track' ? 'is-off' : 'is-risk'}`.trim()}>
                                            <span className="material-symbols-outlined">warning</span>
                                            {t(`projectOverview.attention.health.${health.replace(' ', '')}`, health)}
                                        </span>
                                    )}
                                </div>
                                <div className="po-inits__metrics">
                                    <div className="po-inits__progress">
                                        <div className="po-inits__progress-track"><div className="po-inits__progress-fill" style={{ width: `${pct}%` }} /></div>
                                        <span className="po-inits__progress-label">{done}/{total}</span>
                                    </div>
                                    <div className="po-inits__row-actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            className={`po-inits__icon-btn ${active ? 'is-active' : ''}`.trim()}
                                            onClick={() => onSelect(initiative.id)}
                                            title={active ? t('projectOverview.v2.initiatives.clearFilter', 'Clear filter') : t('projectOverview.v2.initiatives.filter', 'Filter tasks')}
                                            aria-label={t('projectOverview.v2.initiatives.filter', 'Filter tasks')}
                                            aria-pressed={active}
                                        >
                                            <span className="material-symbols-outlined">filter_alt</span>
                                        </button>
                                        {canManage && <ColorPicker current={color} onPick={(c) => onSetColor(initiative.id, c)} t={t} />}
                                        <span className="po-inits__open material-symbols-outlined">chevron_right</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};
