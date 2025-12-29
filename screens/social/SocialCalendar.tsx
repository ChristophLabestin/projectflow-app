import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SocialPost } from '../../types';
import { subscribeSocialPosts, updateSocialPost } from '../../services/dataService';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, getHours } from 'date-fns';
import { useLanguage } from '../../context/LanguageContext';

type CalendarView = 'month' | 'week';

export const SocialCalendar = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [view, setView] = useState<CalendarView>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const { t, dateLocale } = useLanguage();

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeSocialPosts(projectId, (data) => setPosts(data));
        return () => unsub();
    }, [projectId]);

    const handlePrev = () => {
        setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
    };

    const handleNext = () => {
        setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
    };

    const handleDayClick = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        navigate(`/project/${projectId}/social/create?date=${dateStr}`);
    };

    const handlePostClick = (e: React.MouseEvent, post: SocialPost) => {
        e.stopPropagation();
        navigate(`/project/${projectId}/social/edit/${post.id}`);
    };

    // --- Drag and Drop Logic ---

    const handleDragStart = (e: React.DragEvent, postId: string) => {
        e.dataTransfer.setData('text/plain', postId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const postId = e.dataTransfer.getData('text/plain');
        if (!projectId || !postId) return;

        const newDate = new Date(date);

        // If in Month view and dropped on a day, default to noon logic or preserve time if possible (simplified to noon)
        // If in Week view, the date passed INCLUDES the hour, so we don't overwrite it.
        // We can check if hours are 0 to guess it's a "midnight" date object from Month view.
        if (view === 'month') {
            newDate.setHours(12, 0, 0, 0);
        }

        await updateSocialPost(projectId, postId, {
            scheduledFor: newDate.toISOString(),
            status: 'Scheduled'
        });
    };

    // --- Render Logic ---

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const days = eachDayOfInterval({ start: startDate, end: endDate });

        return (
            <div className="grid grid-cols-7 gap-px bg-[var(--color-surface-border)] rounded-lg overflow-hidden border border-[var(--color-surface-border)]">
                {[
                    t('social.calendar.weekdays.sun'),
                    t('social.calendar.weekdays.mon'),
                    t('social.calendar.weekdays.tue'),
                    t('social.calendar.weekdays.wed'),
                    t('social.calendar.weekdays.thu'),
                    t('social.calendar.weekdays.fri'),
                    t('social.calendar.weekdays.sat')
                ].map(day => (
                    <div key={day} className="bg-[var(--color-surface-card)] p-2 text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase">
                        {day}
                    </div>
                ))}
                {days.map(day => {
                    const dayPosts = posts.filter(p => {
                        const d = p.scheduledFor ? new Date(p.scheduledFor) : p.publishedAt ? new Date(p.publishedAt) : null;
                        return d && isSameDay(d, day);
                    });

                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <div
                            key={day.toISOString()}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, day)}
                            onClick={() => handleDayClick(day)}
                            className={`min-h-[140px] bg-[var(--color-surface-card)] p-2 transition-colors hover:bg-[var(--color-surface-hover)] cursor-pointer ${!isCurrentMonth ? 'opacity-50' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-[var(--color-text-main)]'}`}>
                                    {format(day, 'd', { locale: dateLocale })}
                                </span>
                            </div>
                            <div className="space-y-1">
                                {dayPosts.map(post => (
                                    <div
                                        key={post.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, post.id)}
                                        onClick={(e) => handlePostClick(e, post)}
                                        className={`text-xs p-1.5 rounded border border-l-4 truncate cursor-pointer shadow-sm ${post.platform === 'Instagram' ? 'border-l-pink-500 bg-pink-50 dark:bg-pink-500/10' :
                                            post.platform === 'LinkedIn' ? 'border-l-blue-600 bg-blue-50 dark:bg-blue-600/10' :
                                                'border-l-gray-500 bg-gray-50 dark:bg-gray-500/10'
                                            }`}
                                    >
                                        <div className="font-semibold text-[10px] opacity-75">
                                            {format(new Date(post.scheduledFor!), 'p', { locale: dateLocale })}
                                        </div>
                                        {post.content.caption || t('social.calendar.noCaption')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderWeekView = () => {
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
        const hours = Array.from({ length: 24 }, (_, i) => i);

        return (
            <div className="flex flex-col h-[calc(100vh-180px)] overflow-hidden bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-lg">
                {/* Week Header */}
                <div className="grid grid-cols-8 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-hover)]">
                    <div className="p-2 border-r border-[var(--color-surface-border)]"></div>
                    {days.map(day => {
                        const isToday = isSameDay(day, new Date());
                        return (
                            <div key={day.toISOString()} className={`p-2 text-center border-r border-[var(--color-surface-border)] last:border-0 ${isToday ? 'bg-[var(--color-surface-hover)]' : ''}`}>
                                <div className={`text-xs font-semibold uppercase mb-1 ${isToday ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                                    {format(day, 'EEE', { locale: dateLocale })}
                                </div>
                                <div className="flex justify-center">
                                    <span className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-[var(--color-text-main)]'}`}>
                                        {format(day, 'd', { locale: dateLocale })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Time Grid with Scroll */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    {hours.map(hour => (
                        <div key={hour} className="grid grid-cols-8 h-20 border-b border-[var(--color-surface-border)]/50">
                            {/* Time Label */}
                            <div className="border-r border-[var(--color-surface-border)] text-xs text-[var(--color-text-muted)] p-2 text-right">
                                {format(new Date().setHours(hour, 0), 'p', { locale: dateLocale })}
                            </div>

                            {/* Day Cells */}
                            {days.map(day => {
                                // Find posts for this day AND this hour
                                const postsInSlot = posts.filter(p => {
                                    if (!p.scheduledFor) return false;
                                    const d = new Date(p.scheduledFor);
                                    return isSameDay(d, day) && getHours(d) === hour;
                                });

                                return (
                                    <div
                                        key={day.toISOString() + hour}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => {
                                            const dropDate = new Date(day);
                                            dropDate.setHours(hour);
                                            handleDrop(e, dropDate);
                                        }}
                                        onClick={() => {
                                            const clickedDate = new Date(day);
                                            clickedDate.setHours(hour);
                                            const dateStr = format(clickedDate, 'yyyy-MM-dd');
                                            navigate(`/project/${projectId}/social/create?date=${dateStr}`);
                                        }}
                                        className="border-r border-[var(--color-surface-border)] last:border-0 relative hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group"
                                    >
                                        {/* Add Button on Hover */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                                            <span className="material-symbols-outlined text-[var(--color-text-muted)]">add</span>
                                        </div>

                                        {postsInSlot.map(post => (
                                            <div
                                                key={post.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, post.id)}
                                                onClick={(e) => handlePostClick(e, post)}
                                                className={`absolute inset-x-1 top-1 z-10 text-[10px] p-1 rounded border overflow-hidden shadow-sm cursor-pointer ${post.platform === 'Instagram' ? 'bg-pink-100 border-pink-300 text-pink-800' :
                                                    post.platform === 'LinkedIn' ? 'bg-blue-100 border-blue-300 text-blue-800' :
                                                        'bg-gray-100 border-gray-300 text-gray-800'
                                                    }`}
                                                style={{ height: 'calc(100% - 8px)' }}
                                            >
                                                <div className="font-bold truncate">{post.platform}</div>
                                                <div className="truncate">{post.content.caption}</div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-surface-border)] p-1">
                        <button
                            onClick={handlePrev}
                            className="p-1 hover:bg-[var(--color-surface-hover)] rounded"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <button
                            onClick={handleNext}
                            className="p-1 hover:bg-[var(--color-surface-hover)] rounded"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                    <h2 className="h3 min-w-[200px]">
                        {view === 'month'
                            ? format(currentDate, 'MMMM yyyy', { locale: dateLocale })
                            : t('social.calendar.weekOf').replace('{date}', format(currentDate, 'MMM d, yyyy', { locale: dateLocale }))
                        }
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-1.5 text-sm font-medium bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                        {t('social.calendar.today')}
                    </button>

                    <div className="flex bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-surface-border)] p-1">
                        <button
                            onClick={() => setView('month')}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${view === 'month' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}`}
                        >
                            {t('social.calendar.month')}
                        </button>
                        <button
                            onClick={() => setView('week')}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${view === 'week' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}`}
                        >
                            {t('social.calendar.week')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {view === 'month' ? renderMonthView() : renderWeekView()}
            </div>
        </div>
    );
};
