import React, { useEffect, useMemo, useRef, useState } from 'react';
import { endOfMonth, endOfQuarter, format } from 'date-fns';

import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { createInitiative, createMilestone, updateInitiative, updateMilestone } from '../../services/dataService';
import type { Initiative, Milestone, Project, Task } from '../../types';
import { addDaysFromToday, isDateOverdue, toIsoDate } from '../../utils/taskDates';
import { toDate as toTimestampDate } from '../../utils/time';
import { InlineMenu } from '../work/InlineMenu';
import { addDays, buildTimeScale, toDate, useBarDrag } from './timeScale';
import { TimeScaleBackdrop, TimeScaleHeader } from './TimeScaleHeader';
import { estimateLabelWidth, staggerLabels } from './stagger';

const DAY_WIDTH = 7;
const LABEL_WIDTH = 300;

interface RoadmapViewProps {
    project: Project;
    initiatives: Initiative[];
    tasks: Task[];
    milestones: Milestone[];
    canManage: boolean;
    onOpenInitiative: (initiativeId: string) => void;
}

type DraftKind = 'feature' | 'milestone';

const HEALTH_TONE: Record<string, string> = { 'On Track': 'ok', 'At Risk': 'warning', 'Off Track': 'danger' };

/**
 * Roadmap: features (initiatives) as bars with progress and health, milestones
 * as diamonds and the project target as a line — all on one week scale.
 * Target dates are set by dragging or from a quick menu.
 */
export const RoadmapView = ({ project, initiatives, tasks, milestones, canManage, onOpenInitiative }: RoadmapViewProps) => {
    const { t, dateLocale } = useLanguage();
    const { showError } = useToast();
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [draft, setDraft] = useState<{ kind: DraftKind; title: string; start: string; target: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const shortDate = dateLocale?.code?.startsWith('de') ? 'd. MMM' : 'MMM d';
    const fmt = (date: Date) => format(date, shortDate, { locale: dateLocale });

    const rows = useMemo(() => initiatives
        .map((initiative) => {
            const linked = tasks.filter((task) => task.initiativeId === initiative.id);
            const done = linked.filter((task) => task.isCompleted || task.status === 'Done').length;
            const start = toDate(initiative.startDate)
                || (toTimestampDate(initiative.createdAt) ? toDate(toIsoDate(toTimestampDate(initiative.createdAt)!)) : null)
                || toDate(project.startDate)
                || toDate(toIsoDate(new Date()))!;
            const target = toDate(initiative.dueDate);
            return {
                initiative,
                start,
                target,
                done,
                total: linked.length,
                isDone: initiative.status === 'Done'
            };
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime()), [initiatives, tasks, project.startDate]);

    const datedMilestones = useMemo(
        () => milestones.filter((milestone) => milestone.dueDate).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
        [milestones]
    );

    const scale = useMemo(() => buildTimeScale([
        ...rows.flatMap((row) => [row.start, row.target]),
        ...datedMilestones.map((milestone) => toDate(milestone.dueDate)),
        toDate(project.dueDate),
        toDate(project.startDate)
    ], { dayWidth: DAY_WIDTH, padBefore: 14, padAfter: 42, minDays: 120 }), [rows, datedMilestones, project.dueDate, project.startDate]);

    const milestoneLayout = useMemo(() => staggerLabels(datedMilestones.map((milestone) => ({
        x: scale.x(toDate(milestone.dueDate)!),
        width: 20 + estimateLabelWidth(`${milestone.title} · ${fmt(toDate(milestone.dueDate)!)}`)
    }))), [datedMilestones, scale]);

    const featureDrag = useBarDrag(DAY_WIDTH, (id, dates) => {
        void updateInitiative(id, dates, project.id, project.tenantId).catch(() => showError(t('work.update.error')));
    });
    const milestoneDrag = useBarDrag(DAY_WIDTH, (id, dates) => {
        void updateMilestone(project.id, id, { dueDate: dates.dueDate }, project.tenantId).catch(() => showError(t('work.update.error')));
    });

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (scroller) scroller.scrollLeft = Math.max(0, scale.x(new Date()) - DAY_WIDTH * 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const targetOptions = [
        { value: toIsoDate(addDaysFromToday(14)), label: t('planning.roadmap.inTwoWeeks'), hint: fmt(addDaysFromToday(14)) },
        { value: toIsoDate(endOfMonth(new Date())), label: t('planning.roadmap.endOfMonth'), hint: fmt(endOfMonth(new Date())) },
        { value: toIsoDate(endOfQuarter(new Date())), label: t('planning.roadmap.endOfQuarter'), hint: fmt(endOfQuarter(new Date())) },
        ...(project.dueDate ? [{ value: project.dueDate.slice(0, 10), label: t('planning.roadmap.projectTarget'), hint: fmt(toDate(project.dueDate)!) }] : [])
    ];

    const atRisk = rows.filter((row) => !row.isDone && (row.initiative.health === 'At Risk' || row.initiative.health === 'Off Track' || (row.target && isDateOverdue(toIsoDate(row.target))))).length;
    const nextMilestone = datedMilestones.find((milestone) => milestone.status === 'Pending' && !isDateOverdue(milestone.dueDate));
    const projectTarget = toDate(project.dueDate);

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

    return (
        <div className="roadmap">
            <div className="roadmap__toolbar">
                <p className="roadmap__summary">
                    <span>{t('planning.roadmap.summary.features').replace('{count}', String(rows.length))}</span>
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

            <div className="tl roadmap__chart" onPointerMove={(event) => { featureDrag.handlers.onPointerMove(event); milestoneDrag.handlers.onPointerMove(event); }}
                onPointerUp={() => { featureDrag.handlers.onPointerUp(); milestoneDrag.handlers.onPointerUp(); }}
                onPointerCancel={() => { featureDrag.handlers.onPointerCancel(); milestoneDrag.handlers.onPointerCancel(); }}>
                <div className="tl__scroller" ref={scrollerRef}>
                    <div className="tl__grid" style={{ width: LABEL_WIDTH + scale.width }}>
                        <div className="tl__head">
                            <div className="tl__corner" style={{ width: LABEL_WIDTH }}>{t('planning.roadmap.features')}</div>
                            <TimeScaleHeader scale={scale} granularity="week" />
                        </div>
                        <div className="tl__body">
                            <div className="tl__backdrop" style={{ left: LABEL_WIDTH }}>
                                <TimeScaleBackdrop scale={scale} granularity="week" />
                                {projectTarget && (
                                    <span className="roadmap__target-line" style={{ left: scale.x(projectTarget) + DAY_WIDTH / 2 }}>
                                        <span>{t('planning.roadmap.projectTarget')} · {fmt(projectTarget)}</span>
                                    </span>
                                )}
                            </div>

                            <div className="tl__row tl__row--milestones roadmap__row" style={{ minHeight: 16 + milestoneLayout.rowCount * 28 }}>
                                <div className="tl__label tl__label--muted" style={{ width: LABEL_WIDTH }}>
                                    <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                                    {t('planning.milestones')}
                                </div>
                                <div className="tl__track">
                                    {datedMilestones.map((milestone) => {
                                        const base = toDate(milestone.dueDate)!;
                                        const active = milestoneDrag.preview?.id === milestone.id ? milestoneDrag.preview.end : null;
                                        const date = active || base;
                                        const missed = milestone.status === 'Missed' || (milestone.status === 'Pending' && isDateOverdue(milestone.dueDate));
                                        return (
                                            <span
                                                key={milestone.id}
                                                className={`tl__milestone ${milestone.status === 'Achieved' ? 'is-done' : ''} ${missed ? 'is-missed' : ''} ${canManage ? 'is-draggable' : ''}`}
                                                style={{ left: scale.x(date) + DAY_WIDTH / 2, top: 8 + (milestoneLayout.rows[datedMilestones.indexOf(milestone)] || 0) * 28 }}
                                                title={`${milestone.title} · ${fmt(date)}`}
                                                onPointerDown={canManage ? (event) => milestoneDrag.onPointerDown(event, milestone.id, 'end', base, base) : undefined}
                                            >
                                                <span className="tl__diamond" aria-hidden="true" />
                                                <span className="tl__milestone-label">{milestone.title} · {fmt(date)}</span>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>

                            {rows.length === 0 && (
                                <div className="roadmap__empty">
                                    <span className="material-symbols-outlined" aria-hidden="true">route</span>
                                    <p>{t('planning.roadmap.empty')}</p>
                                </div>
                            )}

                            {rows.map(({ initiative, start, target, done, total, isDone }) => {
                                const active = featureDrag.preview?.id === initiative.id ? featureDrag.preview : null;
                                const barStart = active ? active.start : start;
                                const barEnd = active ? active.end : (target || addDays(start, 13));
                                const { left, width } = scale.span(barStart, barEnd);
                                const progress = total ? Math.round((done / total) * 100) : 0;
                                const late = !isDone && !!target && isDateOverdue(toIsoDate(target));
                                const tone = isDone ? 'done' : late ? 'danger' : HEALTH_TONE[initiative.health || ''] || 'neutral';
                                return (
                                    <div key={initiative.id} className="tl__row roadmap__row">
                                        <button type="button" className="tl__label roadmap__label" style={{ width: LABEL_WIDTH }} onClick={() => onOpenInitiative(initiative.id)}>
                                            <span className={`roadmap__dot roadmap__dot--${tone}`} aria-hidden="true" />
                                            <span className="roadmap__label-copy">
                                                <span className="tl__title">{initiative.title}</span>
                                                <span className="roadmap__label-meta">
                                                    {total ? t('planning.roadmap.progress').replace('{done}', String(done)).replace('{total}', String(total)) : t('planning.roadmap.noTasks')}
                                                    {' · '}
                                                    {target ? t('planning.roadmap.targetOn').replace('{date}', fmt(target)) : t('planning.roadmap.noTarget')}
                                                </span>
                                            </span>
                                        </button>
                                        <div className="tl__track">
                                            <div
                                                className={`tl__bar roadmap__bar roadmap__bar--${tone} ${target ? '' : 'is-open'} ${active ? 'is-dragging' : ''}`}
                                                style={{ left, width }}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`${initiative.title}: ${fmt(barStart)} – ${target ? fmt(barEnd) : t('planning.roadmap.noTarget')}`}
                                                onPointerDown={canManage && target ? (event) => featureDrag.onPointerDown(event, initiative.id, 'move', start, target) : undefined}
                                                onClick={() => { if (!featureDrag.wasDragRef.current) onOpenInitiative(initiative.id); featureDrag.wasDragRef.current = false; }}
                                                onKeyDown={(event) => { if (event.key === 'Enter') onOpenInitiative(initiative.id); }}
                                            >
                                                <span className="roadmap__bar-fill" style={{ width: `${progress}%` }} />
                                                {canManage && target && (
                                                    <span className="tl__handle tl__handle--start" onPointerDown={(event) => featureDrag.onPointerDown(event, initiative.id, 'start', start, target)} aria-hidden="true" />
                                                )}
                                                {width >= 120 && <span className="tl__bar-label">{initiative.title}</span>}
                                                {canManage && target && (
                                                    <span className="tl__handle tl__handle--end" onPointerDown={(event) => featureDrag.onPointerDown(event, initiative.id, 'end', start, target)} aria-hidden="true" />
                                                )}
                                            </div>
                                            {!target && canManage && (
                                                <span className="roadmap__set-target" style={{ left: left + width + 8 }}>
                                                    <InlineMenu
                                                        label={`${t('planning.roadmap.setTarget')}: ${initiative.title}`}
                                                        triggerClassName="work-chip"
                                                        trigger={<><span className="material-symbols-outlined">flag</span>{t('planning.roadmap.setTarget')}</>}
                                                        options={targetOptions}
                                                        onSelect={(dueDate) => void updateInitiative(initiative.id, { dueDate, startDate: initiative.startDate || toIsoDate(start) }, project.id, project.tenantId)}
                                                        width={240}
                                                        footer={(close) => (
                                                            <label className="inline-menu__date">
                                                                <span>{t('work.due.pick')}</span>
                                                                <input type="date" onChange={(event) => {
                                                                    if (!event.target.value) return;
                                                                    void updateInitiative(initiative.id, { dueDate: event.target.value, startDate: initiative.startDate || toIsoDate(start) }, project.id, project.tenantId);
                                                                    close();
                                                                }} />
                                                            </label>
                                                        )}
                                                    />
                                                </span>
                                            )}
                                            {active && (
                                                <span className="tl__drag-tip" style={{ left }}>{fmt(barStart)} – {fmt(barEnd)}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
