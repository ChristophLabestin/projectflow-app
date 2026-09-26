import React, { useMemo, useRef, useState } from 'react';
import { addMonths, endOfMonth, endOfQuarter, format, startOfMonth } from 'date-fns';

import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { createInitiative, createMilestone, updateInitiative, updateMilestone } from '../../services/dataService';
import type { Initiative, Milestone, Project, Task } from '../../types';
import { addDaysFromToday, isDateOverdue, toIsoDate } from '../../utils/taskDates';
import { toDate as toTimestampDate } from '../../utils/time';
import { InlineMenu } from '../work/InlineMenu';
import { addDays, buildRangeScale, dayDiff, toDate, useBarDrag, useElementWidth } from './timeScale';
import { estimateLabelWidth, staggerLabels } from './stagger';

const LABEL_WIDTH = 240;
const MIN_DAY_WIDTH = 5;

interface RoadmapViewProps {
    project: Project;
    initiatives: Initiative[];
    tasks: Task[];
    milestones: Milestone[];
    canManage: boolean;
    onOpenInitiative: (initiativeId: string) => void;
}

type DraftKind = 'feature' | 'milestone';
type Phase = 'active' | 'planned' | 'done';
type Tone = 'active' | 'planned' | 'risk' | 'late' | 'done';

const PHASES: Phase[] = ['active', 'planned', 'done'];

/**
 * Roadmap: features/goals (initiatives) grouped into Now → Planned → Done on a
 * month scale that fits the card. Milestones and the project target sit in the
 * header band with guide lines through the chart. Bars show progress and the
 * target date; targets can be dragged or set from a quick menu.
 */
export const RoadmapView = ({ project, initiatives, tasks, milestones, canManage, onOpenInitiative }: RoadmapViewProps) => {
    const { t, dateLocale } = useLanguage();
    const { showError } = useToast();
    const { ref: chartRef, width: chartWidth } = useElementWidth<HTMLDivElement>();
    const [draft, setDraft] = useState<{ kind: DraftKind; title: string; start: string; target: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [showDone, setShowDone] = useState(false);
    const guidesRef = useRef<HTMLDivElement>(null);
    const syncGuidesClip = (event: React.UIEvent<HTMLDivElement>) => {
        if (guidesRef.current) guidesRef.current.style.clipPath = `inset(0 0 0 ${event.currentTarget.scrollLeft}px)`;
    };
    const shortDate = dateLocale?.code?.startsWith('de') ? 'd. MMM' : 'MMM d';
    const fmt = (date: Date) => format(date, shortDate, { locale: dateLocale });
    const today = toDate(toIsoDate(new Date()))!;

    const items = useMemo(() => initiatives.map((initiative) => {
        const linked = tasks.filter((task) => task.initiativeId === initiative.id);
        const done = linked.filter((task) => task.isCompleted || task.status === 'Done').length;
        const created = toTimestampDate(initiative.createdAt);
        const start = toDate(initiative.startDate)
            || (created ? toDate(toIsoDate(created)) : null)
            || toDate(project.startDate)
            || today;
        const target = toDate(initiative.dueDate);
        const isDone = initiative.status === 'Done';
        const late = !isDone && !!target && target < today;
        const phase: Phase = isDone ? 'done' : (start > today || initiative.status === 'Planning' || initiative.status === 'Backlog') ? 'planned' : 'active';
        const tone: Tone = isDone ? 'done' : late || initiative.health === 'Off Track' ? 'late'
            : initiative.health === 'At Risk' ? 'risk' : phase === 'planned' ? 'planned' : 'active';
        return { initiative, start, target, done, total: linked.length, isDone, late, phase, tone };
    }).sort((a, b) => a.start.getTime() - b.start.getTime() || (a.target?.getTime() || 0) - (b.target?.getTime() || 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initiatives, tasks, project.startDate]);

    const datedMilestones = useMemo(
        () => milestones.filter((milestone) => milestone.dueDate).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
        [milestones]
    );
    const projectTarget = toDate(project.dueDate);

    // Range covering every item, milestone, the project target and today (+ padding).
    const scale = useMemo(() => {
        const dates = [
            today,
            addDaysFromToday(30),
            ...items.flatMap((item) => [item.start, item.target]),
            ...datedMilestones.map((milestone) => toDate(milestone.dueDate)),
            projectTarget
        ].filter((date): date is Date => !!date);
        const min = dates.reduce((a, b) => (a < b ? a : b));
        const max = dates.reduce((a, b) => (a > b ? a : b));
        const start = addDays(min, -7);
        const end = addDays(max, 21);
        const days = dayDiff(start, end) + 1;
        const available = Math.max(0, chartWidth - LABEL_WIDTH - 2);
        const dayWidth = Math.max(MIN_DAY_WIDTH, available ? available / days : 8);
        return buildRangeScale(start, end, dayWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, datedMilestones, projectTarget, chartWidth]);

    const months = useMemo(() => {
        const list: { key: string; label: string; left: number; width: number }[] = [];
        let cursor = startOfMonth(scale.start);
        const end = addDays(scale.start, scale.days - 1);
        while (cursor <= end) {
            const monthEnd = endOfMonth(cursor);
            // Clip partial months at both ends so nothing overflows the chart.
            const left = Math.max(0, scale.x(cursor));
            const right = Math.min(scale.width, scale.x(addDays(monthEnd, 1)));
            const width = right - left;
            if (width > 0) {
                const label = width < 40 ? '' : format(cursor, width < 110 ? 'MMM' : 'MMMM yyyy', { locale: dateLocale });
                list.push({ key: cursor.toISOString(), label, left, width });
            }
            cursor = addMonths(cursor, 1);
        }
        return list;
    }, [scale, dateLocale]);

    // Header band markers: milestones + project target, staggered so labels never overlap.
    const markers = useMemo(() => {
        const list = datedMilestones.map((milestone) => {
            const date = toDate(milestone.dueDate)!;
            const missed = milestone.status === 'Missed' || (milestone.status === 'Pending' && isDateOverdue(milestone.dueDate));
            return { key: milestone.id, kind: 'milestone' as const, milestone, date, label: `${milestone.title} · ${fmt(date)}`, tone: milestone.status === 'Achieved' ? 'done' : missed ? 'late' : 'open' };
        });
        const all = projectTarget
            ? [...list, { key: 'project-target', kind: 'target' as const, milestone: null, date: projectTarget, label: `${t('planning.roadmap.projectTarget')} · ${fmt(projectTarget)}`, tone: 'target' }]
            : list;
        const sorted = [...all].sort((a, b) => a.date.getTime() - b.date.getTime());
        const layout = staggerLabels(sorted.map((marker) => ({ x: scale.x(marker.date), width: 24 + estimateLabelWidth(marker.label) })));
        return { list: sorted.map((marker, index) => ({ ...marker, row: layout.rows[index] })), rows: layout.rowCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datedMilestones, projectTarget, scale, t]);

    const featureDrag = useBarDrag(scale.dayWidth, (id, dates) => {
        void updateInitiative(id, dates, project.id, project.tenantId).catch(() => showError(t('work.update.error')));
    });
    const milestoneDrag = useBarDrag(scale.dayWidth, (id, dates) => {
        void updateMilestone(project.id, id, { dueDate: dates.dueDate }, project.tenantId).catch(() => showError(t('work.update.error')));
    });

    const targetOptions = [
        { value: toIsoDate(addDaysFromToday(14)), label: t('planning.roadmap.inTwoWeeks'), hint: fmt(addDaysFromToday(14)) },
        { value: toIsoDate(endOfMonth(new Date())), label: t('planning.roadmap.endOfMonth'), hint: fmt(endOfMonth(new Date())) },
        { value: toIsoDate(endOfQuarter(new Date())), label: t('planning.roadmap.endOfQuarter'), hint: fmt(endOfQuarter(new Date())) },
        ...(projectTarget ? [{ value: toIsoDate(projectTarget), label: t('planning.roadmap.projectTarget'), hint: fmt(projectTarget) }] : [])
    ];

    const atRisk = items.filter((item) => item.tone === 'risk' || item.tone === 'late').length;
    const nextMilestone = datedMilestones.find((milestone) => milestone.status === 'Pending' && !isDateOverdue(milestone.dueDate));
    const bandHeight = 12 + markers.rows * 26;
    const todayX = scale.x(today) + scale.dayWidth / 2;

    const setTarget = (initiative: Initiative, start: Date, dueDate: string) => {
        void updateInitiative(initiative.id, { dueDate, startDate: initiative.startDate || toIsoDate(start) }, project.id, project.tenantId)
            .catch(() => showError(t('work.update.error')));
    };

    const submitDraft = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!draft || !draft.title.trim() || !draft.target || saving) return;
        setSaving(true);
        try {
            if (draft.kind === 'feature') {
                await createInitiative(project.id, draft.title.trim(), {
                    status: 'Planning',
                    priority: 'Medium',
                    startDate: draft.start || toIsoDate(new Date()),
                    dueDate: draft.target
                }, project.tenantId);
            } else {
                await createMilestone(project.id, {
                    title: draft.title.trim(),
                    description: '',
                    dueDate: draft.target,
                    status: 'Pending'
                } as Omit<Milestone, 'id' | 'createdAt' | 'createdBy' | 'tenantId' | 'projectId'>, project.tenantId);
            }
            setDraft(null);
        } catch (error) {
            console.error(error);
            showError(t('planning.roadmap.createError'));
        } finally {
            setSaving(false);
        }
    };

    const renderRow = (item: typeof items[number]) => {
        const { initiative, start, target, done, total, late, tone } = item;
        const active = featureDrag.preview?.id === initiative.id ? featureDrag.preview : null;
        const barStart = active ? active.start : start;
        const barEnd = active ? active.end : (target || addDays(start, 20));
        const { left, width } = scale.span(barStart, barEnd);
        const progress = total ? Math.round((done / total) * 100) : 0;
        const customColor = initiative.color && /^#[0-9a-f]{6}$/i.test(initiative.color) ? initiative.color : undefined;
        const meta = [
            total ? t('planning.roadmap.progress').replace('{done}', String(done)).replace('{total}', String(total)) : t('planning.roadmap.noTasks'),
            target ? (late ? t('planning.roadmap.lateSince').replace('{date}', fmt(target)) : t('planning.roadmap.targetOn').replace('{date}', fmt(target))) : t('planning.roadmap.noTarget')
        ].join(' · ');
        return (
            <div key={initiative.id} className="rm__row">
                <button type="button" className="rm__label" onClick={() => onOpenInitiative(initiative.id)}>
                    <span className="rm__label-title">{initiative.title}</span>
                    <span className={`rm__label-meta ${late ? 'is-late' : ''}`}>{meta}</span>
                </button>
                <div className="rm__track">
                    <div
                        className={`rm__bar rm__bar--${tone} ${target ? '' : 'is-open'} ${active ? 'is-dragging' : ''} ${canManage && target ? 'is-draggable' : ''}`}
                        style={{ left, width, ...(customColor && target ? { ['--rm-bar' as string]: customColor } : {}) }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${initiative.title}: ${fmt(barStart)} – ${target ? fmt(barEnd) : t('planning.roadmap.noTarget')}`}
                        onPointerDown={canManage && target ? (event) => featureDrag.onPointerDown(event, initiative.id, 'move', start, target) : undefined}
                        onClick={() => { if (!featureDrag.wasDragRef.current) onOpenInitiative(initiative.id); featureDrag.wasDragRef.current = false; }}
                        onKeyDown={(event) => { if (event.key === 'Enter') onOpenInitiative(initiative.id); }}
                    >
                        {canManage && target && (
                            <span className="rm__handle rm__handle--start" onPointerDown={(event) => featureDrag.onPointerDown(event, initiative.id, 'start', start, target)} aria-hidden="true" />
                        )}
                        <span className="rm__bar-title">{width >= 90 ? initiative.title : ''}</span>
                        {total > 0 && target && (
                            <span className="rm__bar-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
                        )}
                        {canManage && target && (
                            <span className="rm__handle rm__handle--end" onPointerDown={(event) => featureDrag.onPointerDown(event, initiative.id, 'end', start, target)} aria-hidden="true" />
                        )}
                    </div>
                    <span className="rm__bar-after" style={{ left: left + width + 8 }}>
                        {active ? (
                            <span className="rm__drag-tip">{fmt(barStart)} – {fmt(barEnd)}</span>
                        ) : target ? (
                            <span className={`rm__date ${late ? 'is-late' : ''}`}>
                                <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                                {fmt(target)}
                            </span>
                        ) : canManage ? (
                            <InlineMenu
                                label={`${t('planning.roadmap.setTarget')}: ${initiative.title}`}
                                triggerClassName="rm__set-target"
                                trigger={<><span className="material-symbols-outlined">flag</span>{t('planning.roadmap.setTarget')}</>}
                                options={targetOptions}
                                onSelect={(dueDate) => setTarget(initiative, start, dueDate)}
                                width={240}
                                footer={(close) => (
                                    <label className="inline-menu__date">
                                        <span>{t('work.due.pick')}</span>
                                        <input type="date" onChange={(event) => {
                                            if (!event.target.value) return;
                                            setTarget(initiative, start, event.target.value);
                                            close();
                                        }} />
                                    </label>
                                )}
                            />
                        ) : null}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="roadmap">
            <div className="roadmap__toolbar">
                <p className="roadmap__summary">
                    <span>{t('planning.roadmap.summary.features').replace('{count}', String(items.length))}</span>
                    {atRisk > 0 && <span className="roadmap__summary-risk">{t('planning.roadmap.summary.atRisk').replace('{count}', String(atRisk))}</span>}
                    {nextMilestone && (
                        <span>
                            {t('planning.roadmap.summary.nextMilestone')
                                .replace('{title}', nextMilestone.title)
                                .replace('{date}', fmt(toDate(nextMilestone.dueDate)!))}
                        </span>
                    )}
                </p>
                {canManage && (
                    <div className="roadmap__actions">
                        <button type="button" className="work-chip" onClick={() => setDraft({ kind: 'milestone', title: '', start: '', target: '' })}>
                            <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                            {t('planning.roadmap.addMilestone')}
                        </button>
                        <button type="button" className="work-chip is-active" onClick={() => setDraft({ kind: 'feature', title: '', start: toIsoDate(new Date()), target: '' })}>
                            <span className="material-symbols-outlined" aria-hidden="true">add</span>
                            {t('planning.roadmap.addFeature')}
                        </button>
                    </div>
                )}
            </div>

            {draft && (
                <form className="roadmap__draft" onSubmit={submitDraft}>
                    <input
                        autoFocus
                        className="roadmap__draft-title"
                        value={draft.title}
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                        placeholder={t(draft.kind === 'feature' ? 'planning.roadmap.featurePlaceholder' : 'planning.roadmap.milestonePlaceholder')}
                        aria-label={t('planning.roadmap.title')}
                    />
                    {draft.kind === 'feature' && (
                        <label className="roadmap__draft-date">
                            <span>{t('planning.roadmap.start')}</span>
                            <input type="date" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} />
                        </label>
                    )}
                    <label className="roadmap__draft-date">
                        <span>{t('planning.roadmap.target')}</span>
                        <input type="date" required value={draft.target} min={draft.start || undefined} onChange={(event) => setDraft({ ...draft, target: event.target.value })} />
                    </label>
                    <button type="submit" className="work-chip is-active" disabled={!draft.title.trim() || !draft.target || saving}>
                        {t('planning.roadmap.save')}
                    </button>
                    <button type="button" className="work-toolbar__view" onClick={() => setDraft(null)} aria-label={t('common.cancel')} title={t('common.cancel')}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </form>
            )}

            <div
                className="rm"
                ref={chartRef}
                onPointerMove={(event) => { featureDrag.handlers.onPointerMove(event); milestoneDrag.handlers.onPointerMove(event); }}
                onPointerUp={() => { featureDrag.handlers.onPointerUp(); milestoneDrag.handlers.onPointerUp(); }}
                onPointerCancel={() => { featureDrag.handlers.onPointerCancel(); milestoneDrag.handlers.onPointerCancel(); }}
            >
                <div className="rm__scroller" onScroll={syncGuidesClip}>
                    <div className="rm__grid" style={{ width: LABEL_WIDTH + scale.width }}>
                        {/* Guides: month separators, today, milestones and project target run through the chart. */}
                        <div className="rm__guides" ref={guidesRef} style={{ left: LABEL_WIDTH, width: scale.width }} aria-hidden="true">
                            {months.map((month) => <span key={month.key} className="rm__guide rm__guide--month" style={{ left: month.left }} />)}
                            {markers.list.map((marker) => {
                                const date = marker.kind === 'milestone' && milestoneDrag.preview?.id === marker.key ? milestoneDrag.preview.end : marker.date;
                                return <span key={marker.key} className={`rm__guide rm__guide--${marker.kind}`} style={{ left: scale.x(date) + scale.dayWidth / 2 }} />;
                            })}
                            <span className="rm__guide rm__guide--today" style={{ left: todayX }} />
                        </div>

                        <div className="rm__head">
                            <div className="rm__corner">
                                <span>{t('planning.tabs.roadmap')}</span>
                            </div>
                            <div className="rm__months" style={{ width: scale.width }}>
                                {months.map((month) => (
                                    <span key={month.key} className="rm__month" style={{ left: month.left, width: month.width }}>{month.label}</span>
                                ))}
                                <span className="rm__today-chip" style={{ left: todayX }}>{t('work.due.today')}</span>
                            </div>
                        </div>

                        {markers.list.length > 0 && (
                            <div className="rm__band" style={{ height: bandHeight }}>
                                <div className="rm__band-label">
                                    <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                                    {t('planning.milestones')}
                                </div>
                                <div className="rm__band-track">
                                    {markers.list.map((marker) => {
                                        const isMilestone = marker.kind === 'milestone' && marker.milestone;
                                        const date = isMilestone && milestoneDrag.preview?.id === marker.key ? milestoneDrag.preview.end : marker.date;
                                        return (
                                            <span
                                                key={marker.key}
                                                className={`rm__marker rm__marker--${marker.tone} ${isMilestone && canManage ? 'is-draggable' : ''}`}
                                                style={{ left: scale.x(date) + scale.dayWidth / 2, top: 6 + marker.row * 26 }}
                                                title={marker.label}
                                                onPointerDown={isMilestone && canManage ? (event) => milestoneDrag.onPointerDown(event, marker.key, 'end', marker.date, marker.date) : undefined}
                                            >
                                                <span className="rm__marker-icon" aria-hidden="true" />
                                                <span className="rm__marker-label">
                                                    {isMilestone && milestoneDrag.preview?.id === marker.key ? `${marker.milestone!.title} · ${fmt(date)}` : marker.label}
                                                </span>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {items.length === 0 && (
                            <div className="rm__empty">
                                <span className="material-symbols-outlined" aria-hidden="true">route</span>
                                <p>{t('planning.roadmap.empty')}</p>
                            </div>
                        )}

                        {PHASES.map((phase) => {
                            const phaseItems = items.filter((item) => item.phase === phase);
                            if (!phaseItems.length) return null;
                            const collapsed = phase === 'done' && !showDone;
                            return (
                                <section key={phase} className={`rm__section rm__section--${phase}`}>
                                    <div className="rm__section-head">
                                        <button
                                            type="button"
                                            className="rm__section-toggle"
                                            onClick={phase === 'done' ? () => setShowDone((value) => !value) : undefined}
                                            aria-expanded={phase === 'done' ? !collapsed : undefined}
                                            disabled={phase !== 'done'}
                                        >
                                            {phase === 'done' && (
                                                <span className={`material-symbols-outlined rm__chevron ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true">expand_more</span>
                                            )}
                                            <span>{t(`planning.roadmap.phase.${phase}`)}</span>
                                            <span className="work-group__count">{phaseItems.length}</span>
                                        </button>
                                    </div>
                                    {!collapsed && phaseItems.map(renderRow)}
                                </section>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
