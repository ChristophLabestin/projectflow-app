import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProjectActivity } from '../services/dataService';
import { Activity } from '../types';
import { toMillis } from '../utils/time';
import { activityIcon, groupActivitiesByDate, filterActivities } from '../utils/activityHelpers';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';

const cleanText = (value?: string | null) => (value || '').replace(/\*\*/g, '');

const FilterTab = ({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void, icon?: string }) => (
    <button
        onClick={onClick}
        className={`
            flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all
            ${active
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] shadow-lg shadow-[var(--color-primary)]/20'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-border)] hover:text-[var(--color-text-main)]'}
        `}
    >
        {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
        {label}
    </button>
);

export const ProjectActivity = () => {
    const { id } = useParams<{ id: string }>();
    const { dateFormat, dateLocale } = useLanguage();
    const [activity, setActivity] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!id) return;
        (async () => {
            const data = await getProjectActivity(id);
            setActivity(data);
            setLoading(false);
        })();
    }, [id]);

    const filteredActivities = useMemo(() =>
        filterActivities(activity, filter, searchTerm),
        [activity, filter, searchTerm]);

    const groupedActivities = useMemo(() =>
        groupActivitiesByDate(filteredActivities, dateFormat, dateLocale),
        [filteredActivities, dateFormat, dateLocale]);

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto px-4 pb-20 custom-scrollbar">
            <div className="max-w-4xl mx-auto flex flex-col gap-10">
                {/* Header section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-10">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <Link to={`/project/${id}`} className="group flex items-center justify-center size-9 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] hover:border-[var(--color-primary)] transition-all">
                                <span className="material-symbols-outlined text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] text-[20px]">arrow_back</span>
                            </Link>
                            <div>
                                <h1 className="h2 text-[var(--color-text-main)] leading-none mb-1">Activity Log</h1>
                                <p className="text-[var(--color-text-muted)] text-sm">Track progress and changes in real-time.</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[var(--color-text-subtle)] group-focus-within:text-[var(--color-primary)] transition-colors">search</span>
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] rounded-xl text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]/50 transition-all font-medium text-[var(--color-text-main)]"
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 -mt-2">
                    <FilterTab label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
                    <FilterTab label="Tasks" icon="task_alt" active={filter === 'task'} onClick={() => setFilter('task')} />
                    <FilterTab label="Issues" icon="bug_report" active={filter === 'issue'} onClick={() => setFilter('issue')} />
                    <FilterTab label="Comments" icon="chat_bubble" active={filter === 'comment'} onClick={() => setFilter('comment')} />
                    <FilterTab label="Reports" icon="auto_awesome" active={filter === 'report'} onClick={() => setFilter('report')} />
                    <FilterTab label="Members" icon="group" active={filter === 'member'} onClick={() => setFilter('member')} />
                </div>

                {/* Timeline */}
                <div className="space-y-12">
                    {Object.keys(groupedActivities).length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-24 opacity-60">
                            <div className="size-20 rounded-3xl bg-[var(--color-surface-hover)] border-2 border-dashed border-[var(--color-surface-border)] flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-4xl text-[var(--color-text-subtle)]">history_toggle_off</span>
                            </div>
                            <h3 className="h3 text-[var(--color-text-main)] mb-2">No activity recorded</h3>
                            <p className="text-[var(--color-text-muted)] max-w-xs text-sm">We couldn't find any activities matching your current filters.</p>
                        </div>
                    ) : (
                        Object.entries(groupedActivities).map(([date, items]) => (
                            <div key={date} className="relative">
                                {/* Sticky header with better blend */}
                                <div className="sticky top-0 z-20 bg-[var(--color-background)]/80 backdrop-blur-md py-4 mb-4 border-b border-[var(--color-surface-border)]/10">
                                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-subtle)] flex items-center gap-4">
                                        <span className="relative z-10">{date}</span>
                                        <div className="h-px flex-1 bg-[var(--color-surface-border)]/50" />
                                    </h3>
                                </div>

                                <div className="space-y-10 ml-6 relative border-l border-[var(--color-surface-border)] pb-4">
                                    {items.map((item) => {
                                        const { icon, color, bg } = activityIcon(item.type, item.action);
                                        const hasDetails = item.details && cleanText(item.details).toLowerCase() !== cleanText(item.target).toLowerCase();

                                        return (
                                            <div key={item.id} className="relative pl-10 group">
                                                {/* Icon Indicator */}
                                                <div className={`
                                                    absolute -left-[14px] top-0 size-7 rounded-full border-2 border-[var(--color-surface-paper)] 
                                                    flex items-center justify-center shadow-sm z-10 ${bg} ${color}
                                                    transition-all group-hover:scale-110 group-hover:shadow-md
                                                 `}>
                                                    <span className="material-symbols-outlined text-[15px]">{icon}</span>
                                                </div>

                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            <div className="flex items-center gap-2">
                                                                {item.userAvatar ? (
                                                                    <img src={item.userAvatar} alt={item.user} className="size-6 rounded-full object-cover ring-1 ring-[var(--color-surface-border)] shadow-sm" />
                                                                ) : (
                                                                    <div className="size-6 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] flex items-center justify-center">
                                                                        <span className="material-symbols-outlined text-[14px] text-[var(--color-text-subtle)]">person</span>
                                                                    </div>
                                                                )}
                                                                <span className="font-bold text-[var(--color-text-main)] text-sm">{item.user}</span>
                                                            </div>
                                                            <span className="text-sm text-[var(--color-text-muted)]">{item.action}</span>
                                                            <span className="text-sm font-semibold text-[var(--color-text-main)] transition-colors group-hover:text-[var(--color-primary)]">
                                                                {cleanText(item.target)}
                                                            </span>
                                                        </div>
                                                        <span className="text-[11px] font-bold text-[var(--color-text-subtle)] whitespace-nowrap pt-0.5">
                                                            {format(new Date(toMillis(item.createdAt)), 'p', { locale: dateLocale })}
                                                        </span>
                                                    </div>

                                                    {hasDetails && (
                                                        <div className="p-3.5 rounded-xl bg-[var(--color-surface-hover)]/40 border border-[var(--color-surface-border)] group-hover:bg-[var(--color-surface-hover)] group-hover:border-[var(--color-primary)]/20 transition-all">
                                                            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                                                {cleanText(item.details)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
