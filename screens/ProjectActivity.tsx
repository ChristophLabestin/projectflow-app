import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { getProjectActivity } from '../services/dataService';
import { Activity } from '../types';
import { toMillis } from '../utils/time';
import { activityIcon, filterActivities, groupActivitiesByDate } from '../utils/activityHelpers';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';

const cleanText = (value?: string | null) => (value || '').replace(/\*\*/g, '');

const FilterTab = ({
    label,
    active,
    onClick,
    icon,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
    icon?: string;
}) => (
    <Button
        type="button"
        size="sm"
        variant="secondary"
        className={`activity-filter__button ${active ? 'is-active' : ''}`.trim()}
        onClick={onClick}
        icon={icon ? <span className="material-symbols-outlined activity-filter__icon">{icon}</span> : undefined}
        aria-pressed={active}
    >
        {label}
    </Button>
);

export const ProjectActivity = () => {
    const { t, dateFormat, dateLocale } = useLanguage();
    const { id } = useParams<{ id: string }>();
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

    const filterOptions = useMemo(() => ([
        { value: 'all', label: t('projectActivity.filters.all', 'All') },
        { value: 'task', label: t('projectActivity.filters.tasks', 'Tasks'), icon: 'task_alt' },
        { value: 'issue', label: t('projectActivity.filters.issues', 'Issues'), icon: 'bug_report' },
        { value: 'comment', label: t('projectActivity.filters.comments', 'Comments'), icon: 'chat_bubble' },
        { value: 'report', label: t('projectActivity.filters.reports', 'Reports'), icon: 'auto_awesome' },
        { value: 'member', label: t('projectActivity.filters.members', 'Members'), icon: 'group' },
    ]), [t]);

    const filteredActivities = useMemo(() =>
        filterActivities(activity, filter, searchTerm),
        [activity, filter, searchTerm]);

    const groupedActivities = useMemo(() =>
        groupActivitiesByDate(filteredActivities, dateFormat, dateLocale, {
            today: t('projectActivity.group.today', 'Today'),
            yesterday: t('projectActivity.group.yesterday', 'Yesterday'),
        }),
        [filteredActivities, dateFormat, dateLocale, t]);

    if (loading) {
        return (
            <div className="project-activity__loading">
                <span className="material-symbols-outlined project-activity__loading-icon animate-spin">rotate_right</span>
            </div>
        );
    }

    return (
        <div className="project-activity custom-scrollbar">
            <div className="project-activity__content">
                <div className="project-activity__header">
                    <div className="project-activity__title-block">
                        <Link
                            to={`/project/${id}`}
                            className="project-activity__back"
                            aria-label={t('projectActivity.back', 'Back to project')}
                        >
                            <span className="material-symbols-outlined project-activity__back-icon">arrow_back</span>
                        </Link>
                        <div>
                            <h1 className="project-activity__title">{t('projectActivity.title', 'Activity Log')}</h1>
                            <p className="project-activity__subtitle">{t('projectActivity.subtitle', 'Track progress and changes in real-time.')}</p>
                        </div>
                    </div>

                    <TextInput
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={t('projectActivity.search.placeholder', 'Search logs...')}
                        aria-label={t('projectActivity.search.label', 'Search activity logs')}
                        leftElement={<span className="material-symbols-outlined">search</span>}
                        className="project-activity__search"
                    />
                </div>

                <div className="project-activity__filters">
                    {filterOptions.map(option => (
                        <FilterTab
                            key={option.value}
                            label={option.label}
                            icon={option.icon}
                            active={filter === option.value}
                            onClick={() => setFilter(option.value)}
                        />
                    ))}
                </div>

                <div className="project-activity__timeline">
                    {Object.keys(groupedActivities).length === 0 ? (
                        <div className="project-activity__empty">
                            <div className="project-activity__empty-icon">
                                <span className="material-symbols-outlined">history_toggle_off</span>
                            </div>
                            <h3 className="project-activity__empty-title">
                                {t('projectActivity.empty.title', 'No activity recorded')}
                            </h3>
                            <p className="project-activity__empty-text">
                                {t('projectActivity.empty.description', "We couldn't find any activities matching your current filters.")}
                            </p>
                        </div>
                    ) : (
                        Object.entries(groupedActivities).map(([date, items]) => (
                            <div key={date} className="project-activity__group">
                                <div className="project-activity__group-header">
                                    <h3 className="project-activity__group-title">
                                        <span>{date}</span>
                                        <span className="project-activity__group-rule" />
                                    </h3>
                                </div>

                                <div className="project-activity__items">
                                    {items.map((item) => {
                                        const { icon, color, bg } = activityIcon(item.type, item.action);
                                        const hasDetails = item.details && cleanText(item.details).toLowerCase() !== cleanText(item.target).toLowerCase();

                                        return (
                                            <div key={item.id} className="project-activity__item">
                                                <div className="project-activity__icon" style={{ backgroundColor: bg, color }}>
                                                    <span className="material-symbols-outlined project-activity__icon-symbol">{icon}</span>
                                                </div>

                                                <div className="project-activity__item-body">
                                                    <div className="project-activity__item-header">
                                                        <div className="project-activity__item-text">
                                                            <div className="project-activity__user">
                                                                {item.userAvatar ? (
                                                                    <img src={item.userAvatar} alt={item.user} className="project-activity__avatar" />
                                                                ) : (
                                                                    <div className="project-activity__avatar-placeholder">
                                                                        <span className="material-symbols-outlined">person</span>
                                                                    </div>
                                                                )}
                                                                <span className="project-activity__user-name">{item.user}</span>
                                                            </div>
                                                            <span className="project-activity__action">{item.action}</span>
                                                            <span className="project-activity__target">{cleanText(item.target)}</span>
                                                        </div>
                                                        <span className="project-activity__time">
                                                            {format(new Date(toMillis(item.createdAt)), 'p', { locale: dateLocale })}
                                                        </span>
                                                    </div>

                                                    {hasDetails && (
                                                        <div className="project-activity__details">
                                                            <p className="project-activity__details-text">
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
