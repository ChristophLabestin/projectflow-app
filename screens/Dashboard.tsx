import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import { getUserProjects, getSharedProjects, getUserTasks, getUserIdeas, getUserIssues, saveIdea, getUserGlobalActivities, getUserProfile, updateUserData, getProjectMembers } from '../services/dataService';
import { Project, Task, Idea, Issue, Activity, Member } from '../types';
import { toMillis, toDate } from '../utils/time';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Sparkline } from '../components/charts/Sparkline';
import { DonutChart } from '../components/charts/DonutChart';
import { ScheduledTasksCard } from '../components/dashboard/ScheduledTasksCard';
import { LatestMilestoneCard } from '../components/dashboard/LatestMilestoneCard';


const formatShortDate = (date: any) => {
    const d = toDate(date);
    if (!d) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const MemberAvatars: React.FC<{ projectId: string }> = ({ projectId }) => {
    const [members, setMembers] = useState<Member[]>([]);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const memberIds = await getProjectMembers(projectId);
                const memberPromises = memberIds.map(id => getUserProfile(id));
                const memberProfiles = await Promise.all(memberPromises);
                setMembers(memberProfiles.filter((m): m is Member => !!m));
            } catch (err) {
                console.error("Failed to fetch project members", err);
            }
        };
        fetchMembers();
    }, [projectId]);

    if (members.length === 0) return null;

    return (
        <div className="flex items-center -space-x-2">
            {members.slice(0, 3).map((member, i) => (
                <div
                    key={member.uid || i}
                    className="size-7 rounded-full border-2 border-[var(--color-surface-paper)] overflow-hidden bg-[var(--color-surface-hover)] shadow-sm"
                    title={member.displayName || 'Member'}
                >
                    {member.photoURL ? (
                        <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">
                            {((member.displayName || member.email || '?').charAt(0)).toUpperCase()}
                        </div>
                    )}
                </div>
            ))}
            {members.length > 3 && (
                <div className="size-7 rounded-full border-2 border-[var(--color-surface-paper)] bg-[var(--color-surface-hover)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] shadow-sm">
                    +{members.length - 3}
                </div>
            )}
        </div>
    );
};

export const Dashboard = () => {
    const [userName, setUserName] = useState<string>('there');
    const [greeting, setGreeting] = useState<string>('Hello');
    const [stats, setStats] = useState({
        activeProjects: 0,
        completedProjects: 0,
        openTasks: 0,
        ideas: 0
    });
    const [projects, setProjects] = useState<Project[]>([]);
    const [recentProjects, setRecentProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [calendarView, setCalendarView] = useState<'month' | 'week'>(() => {
        // Init from localStorage if available
        const saved = localStorage.getItem('dashboard_calendar_view');
        return (saved === 'week' || saved === 'month') ? saved : 'month';
    });
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [hoverTrendIndex, setHoverTrendIndex] = useState<number | null>(null);
    const trendRef = useRef<SVGSVGElement | null>(null);

    // Quick Add State
    const [quickIdeaText, setQuickIdeaText] = useState('');
    const [addingIdea, setAddingIdea] = useState(false);

    const getWeekNumber = (d: Date) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    const bucketByDay = (items: { createdAt?: any }[], days = 7) => {
        const buckets = Array.from({ length: days }, (_, i) => ({ label: i, value: 0 }));
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        items.forEach((item) => {
            const ts = toMillis(item.createdAt) || now;
            const diff = Math.floor((now - ts) / dayMs);
            if (diff >= 0 && diff < days) {
                buckets[days - diff - 1].value += 1;
            }
        });
        return buckets;
    };

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                try {
                    const userProjects = await getUserProjects();
                    const sharedProjects = await getSharedProjects().catch(e => {
                        console.error("Shared projects load failed (likely missing index)", e);
                        return [];
                    });

                    // Deduplicate (just in case)
                    const allProjects = [...userProjects];
                    sharedProjects.forEach(sp => {
                        if (!allProjects.find(p => p.id === sp.id)) {
                            allProjects.push(sp);
                        }
                    });

                    const tasks = await getUserTasks();
                    const ideas = await getUserIdeas();
                    const issues = await getUserIssues();

                    setProjects(allProjects);
                    setTasks(tasks);
                    setIdeas(ideas);
                    setIssues(issues);

                    // Fetch global activities
                    const recentActivities = await getUserGlobalActivities(auth.currentUser?.uid, 6);
                    setActivities(recentActivities);

                    // Fetch user preference for calendar view
                    if (auth.currentUser?.uid) {
                        const profile = await getUserProfile(auth.currentUser.uid);
                        if (profile?.preferences?.dashboard?.calendarView) {
                            const view = profile.preferences.dashboard.calendarView;
                            setCalendarView(view);
                            localStorage.setItem('dashboard_calendar_view', view);
                        }
                    }
                    setStats({
                        activeProjects: allProjects.filter(p => p.status === 'Active').length,
                        completedProjects: allProjects.filter(p => p.status === 'Completed').length,
                        openTasks: tasks.filter(t => !t.isCompleted).length,
                        ideas: ideas.length
                    });

                    const sortedProjects = [...allProjects]
                        .filter(p => p.status !== 'On Hold' && p.status !== 'Planning')
                        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
                    setRecentProjects(sortedProjects.slice(0, 4));


                    // Set user info
                    if (auth.currentUser?.displayName) {
                        setUserName(auth.currentUser.displayName.split(' ')[0]);
                    }

                    const hour = new Date().getHours();
                    if (hour < 12) setGreeting('Good morning');
                    else if (hour < 18) setGreeting('Good afternoon');
                    else setGreeting('Good evening');
                } catch (error) {
                    console.error('Dashboard load failed', error);
                } finally {
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                setLoading(false);
            }
        };
        loadDashboard();
    }, []);

    const taskTrend = useMemo(() => bucketByDay(tasks), [tasks]);
    const ideaTrend = useMemo(() => bucketByDay(ideas), [ideas]);
    const issueTrend = useMemo(() => bucketByDay(issues), [issues]);

    const hasIssuesModule = useMemo(() => projects.some(p => p.modules?.includes('issues')), [projects]);

    // New Metrics for distribution
    const projectStatusDistribution = useMemo(() => {
        const active = projects.filter(p => p.status === 'Active').length;
        const completed = projects.filter(p => p.status === 'Completed').length;
        const planning = projects.filter(p => p.status === 'Planning').length;
        const onHold = projects.filter(p => p.status === 'On Hold').length;

        // Return structured for Donut
        return [
            { name: 'Active', value: active, color: '#6366f1' }, // Indigo
            { name: 'Completed', value: completed, color: '#10b981' }, // Emerald
            { name: 'Planning', value: planning, color: '#f59e0b' }, // Amber
            { name: 'On Hold', value: onHold, color: '#94a3b8' } // Slate
        ].filter(d => d.value > 0);
    }, [projects]);

    const taskPriorityDistribution = useMemo(() => {
        const urgent = tasks.filter(t => !t.isCompleted && t.priority === 'Urgent').length;
        const high = tasks.filter(t => !t.isCompleted && t.priority === 'High').length;
        const medium = tasks.filter(t => !t.isCompleted && t.priority === 'Medium').length;
        const low = tasks.filter(t => !t.isCompleted && t.priority === 'Low').length;

        return [
            { name: 'Urgent', value: urgent, color: '#ef4444' },
            { name: 'High', value: high, color: '#f97316' },
            { name: 'Medium', value: medium, color: '#3b82f6' },
            { name: 'Low', value: low, color: '#94a3b8' }
        ].filter(d => d.value > 0);
    }, [tasks]);

    const statusBreakdown = useMemo(() => {
        const active = stats.activeProjects;
        const completed = stats.completedProjects;
        const other = Math.max(0, projects.length - active - completed);
        const total = active + completed + other || 1;
        return {
            activePct: Math.round((active / total) * 100),
            completedPct: Math.round((completed / total) * 100),
            otherPct: Math.max(0, 100 - Math.round((active / total) * 100) - Math.round((completed / total) * 100))
        };
    }, [stats, projects.length]);

    // Hybrid Activity Feed: Combine real activities with synthetic ones from tasks/ideas
    const displayActivities = useMemo(() => {
        const synthetic: Activity[] = [];

        // Generate synthetic activities from recent tasks/ideas for immediate feedback
        tasks.slice(0, 10).forEach(t => {
            if (t.createdAt) {
                synthetic.push({
                    id: `syn-task-c-${t.id}`,
                    type: 'task',
                    action: 'created task',
                    target: t.title,
                    user: 'You', // In a real app we'd map ownerId to name, keeping simple for "My Dashboard"
                    userAvatar: auth.currentUser?.photoURL || '',
                    createdAt: t.createdAt,
                    projectId: t.projectId
                } as any);
            }
            if (t.isCompleted) {
                synthetic.push({
                    id: `syn-task-d-${t.id}`,
                    type: 'task',
                    action: 'completed task',
                    target: t.title,
                    user: 'You',
                    userAvatar: auth.currentUser?.photoURL || '',
                    createdAt: t.createdAt, // Ideally we'd have completedAt, but using createdAt as fallback or Date.now() if recently loaded... 
                    // Let's use createdAt for consistency or maybe just omit if old. For now, pushing.
                    projectId: t.projectId
                } as any);
            }
        });

        ideas.slice(0, 10).forEach(i => {
            if (i.createdAt) {
                synthetic.push({
                    id: `syn-idea-${i.id}`,
                    type: 'idea',
                    action: 'captured idea',
                    target: i.title,
                    user: 'You',
                    userAvatar: auth.currentUser?.photoURL || '',
                    createdAt: i.createdAt,
                    projectId: i.projectId
                } as any);
            }
        });

        // Merge and Sort
        const all = [...activities, ...synthetic];
        // Dedupe by vaguely matching content if needed, but IDs differ so it's okay. 
        // Real logic would filter out duplicates if 'activities' already captured the event.
        // For now, simple merge.
        return all
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
            .slice(0, 6);
    }, [activities, tasks, ideas]);

    const sparkPath = (data: { value: number }[], width = 120, height = 36) => {
        if (!data.length) return '';
        const max = Math.max(...data.map(d => d.value), 1);
        const step = width / (data.length - 1 || 1);
        return data
            .map((d, i) => {
                const x = i * step;
                const y = height - (d.value / max) * height;
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
    };

    const projectById = useMemo(() => {
        const map = new Map<string, string>();
        projects.forEach((project) => map.set(project.id, project.title));
        return map;
    }, [projects]);

    const focusTasks = useMemo(() => {
        const open = tasks.filter(task => !task.isCompleted);
        return open
            .sort((a, b) => {
                const aDue = toDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
                const bDue = toDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
                if (aDue !== bDue) return aDue - bDue;
                return toMillis(b.createdAt) - toMillis(a.createdAt);
            })
            .slice(0, 5);
    }, [tasks]);

    const dueSoonCount = useMemo(() => {
        const now = Date.now();
        const soonWindow = 3 * 24 * 60 * 60 * 1000;
        return tasks.filter(task => !task.isCompleted).filter((task) => {
            const due = toDate(task.dueDate);
            if (!due) return false;
            return due.getTime() <= now + soonWindow;
        }).length;
    }, [tasks]);

    const ideasThisWeek = useMemo(
        () => ideaTrend.reduce((sum, day) => sum + day.value, 0),
        [ideaTrend]
    );

    const ideaSpotlight = useMemo(() => ideas.slice(0, 3), [ideas]);

    const chartOuterWidth = 720;
    const chartOuterHeight = 240;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerWidth = chartOuterWidth - margin.left - margin.right;
    const innerHeight = chartOuterHeight - margin.top - margin.bottom;
    const trendDays = Math.max(taskTrend.length, ideaTrend.length, hasIssuesModule ? issueTrend.length : 0);
    const maxTrendValue = useMemo(
        () => Math.max(...taskTrend.map(v => v.value), ...ideaTrend.map(v => v.value), hasIssuesModule ? Math.max(...issueTrend.map(v => v.value)) : 0, 1),
        [taskTrend, ideaTrend, issueTrend, hasIssuesModule]
    );

    const getSmoothPath = (data: { value: number }[]) => {
        if (!data.length) return '';
        const max = maxTrendValue || 1;
        const step = innerWidth / (Math.max(data.length, trendDays) - 1 || 1);

        const points = data.map((d, i) => ({
            x: margin.left + i * step,
            y: margin.top + innerHeight - (d.value / max) * innerHeight
        }));

        if (points.length < 2) return '';

        let d = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const cp1x = p0.x + (p1.x - p0.x) * 0.5;
            const cp1y = p0.y;
            const cp2x = p0.x + (p1.x - p0.x) * 0.5;
            const cp2y = p1.y;
            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
        }

        return d;
    };

    const toggleCalendarView = async () => {
        const newView = calendarView === 'month' ? 'week' : 'month';
        setCalendarView(newView);
        localStorage.setItem('dashboard_calendar_view', newView);
        setCurrentDate(new Date()); // Reset to today when switching views
        if (auth.currentUser?.uid) {
            await updateUserData(auth.currentUser.uid, {
                'preferences.dashboard.calendarView': newView
            });
        }
    };

    const handlePrevDate = () => {
        const newDate = new Date(currentDate);
        if (calendarView === 'month') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setDate(newDate.getDate() - 7);
        }
        setCurrentDate(newDate);
    };

    const handleNextDate = () => {
        const newDate = new Date(currentDate);
        if (calendarView === 'month') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else {
            newDate.setDate(newDate.getDate() + 7);
        }
        setCurrentDate(newDate);
    };

    const handleTrendMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!trendRef.current || trendDays <= 1) return;
        const rect = trendRef.current.getBoundingClientRect();
        const scaleX = rect.width / chartOuterWidth;
        const x = (e.clientX - rect.left) / scaleX - margin.left;
        if (x < 0 || x > innerWidth) return;
        const step = innerWidth / (trendDays - 1);
        const idx = Math.max(0, Math.min(trendDays - 1, Math.round(x / step)));
        setHoverTrendIndex(idx);
    };

    const trendLabel = (idx: number) => {
        const daysAgo = trendDays - idx - 1;
        const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const kpiCards = [
        {
            key: 'active',
            label: 'Active Projects',
            value: stats.activeProjects,
            icon: 'folder_open',
            series: taskTrend,
            color: '#6366f1', // Indigo
            caption: `${projects.length} total tracked`
        },
        {
            key: 'completed',
            label: 'Completed',
            value: stats.completedProjects,
            icon: 'check_circle',
            series: ideaTrend,
            color: '#10b981', // Emerald
            caption: `${statusBreakdown.completedPct}% completion rate`
        },
        {
            key: 'tasks',
            label: 'Open Tasks',
            value: stats.openTasks,
            icon: 'check_box',
            series: taskTrend,
            color: '#f59e0b', // Amber
            caption: `${dueSoonCount} due soon`
        },
        {
            key: 'ideas',
            label: 'Ideas Captured',
            value: stats.ideas,
            icon: 'lightbulb',
            series: ideaTrend,
            color: '#3b82f6', // Blue
            caption: `${ideasThisWeek} this week`
        }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 fade-in">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-900 dark:to-violet-900 p-8 text-white shadow-xl mb-6">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-100 text-sm font-medium mb-2">
                            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
                            {greeting}, {userName}
                        </h1>
                        <p className="text-indigo-100 text-lg max-w-xl leading-relaxed">
                            You have <strong className="text-white font-semibold">{stats.activeProjects} active projects</strong> and <strong className="text-white font-semibold">{dueSoonCount} tasks</strong> due soon.
                        </p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <Link to="/create">
                            <Button
                                variant="secondary"
                                className="bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm shadow-lg"
                                icon={<span className="material-symbols-outlined">add</span>}
                            >
                                New Project
                            </Button>
                        </Link>
                    </div>
                </div>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 rounded-full bg-black/10 blur-2xl pointer-events-none"></div>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                {/* Left Column: Metrics & Charts (3 cols wide on large screens) */}
                <div className="xl:col-span-3 space-y-6">

                    {/* New Widget Cards Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {kpiCards.map((stat) => (
                            <Card key={stat.key} padding="md" className="relative overflow-hidden group hover:shadow-lg transition-all border-l-4" style={{ borderLeftColor: stat.color }}>
                                <div className="flex flex-col h-full justify-between">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide">{stat.label}</p>
                                            <h3 className="text-3xl font-bold mt-1 text-[var(--color-text-main)]">{stat.value}</h3>
                                        </div>
                                        <div className={`p-2 rounded-lg bg-opacity-10`} style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                                            <span className="material-symbols-outlined">{stat.icon}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <Sparkline
                                            data={stat.series.map(s => s.value)}
                                            width={140}
                                            height={30}
                                            color={stat.color}
                                            fill={true}
                                        />
                                        <p className="text-xs text-[var(--color-text-subtle)] mt-2 font-medium">{stat.caption}</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>


                    {/* Main Content Grid - 3 Columns */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* 1. Activity Trends (Span 2) */}
                        <Card className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="h4">Activity Trends</h3>
                                    <p className="text-xs text-[var(--color-text-muted)]">7-day performance</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium">
                                    <span className="flex items-center gap-1.5">
                                        <span className="size-2 rounded-full bg-amber-500"></span> Tasks
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="size-2 rounded-full bg-blue-500"></span> Ideas
                                    </span>
                                    {hasIssuesModule && (
                                        <span className="flex items-center gap-1.5">
                                            <span className="size-2 rounded-full bg-rose-500"></span> Issues
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="w-full relative aspect-[2/1] bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] overflow-hidden">
                                <svg
                                    ref={trendRef}
                                    viewBox={`0 0 ${chartOuterWidth} ${chartOuterHeight}`}
                                    className="w-full h-full"
                                    onMouseMove={handleTrendMove}
                                    onMouseLeave={() => setHoverTrendIndex(null)}
                                    preserveAspectRatio="none"
                                >
                                    <defs>
                                        <linearGradient id="tasksGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                                        </linearGradient>
                                        <linearGradient id="ideasGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <g>
                                        {/* Horizontal Grid & Y-Axis Labels */}
                                        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
                                            const y = margin.top + innerHeight * p;
                                            const val = Math.round(maxTrendValue * (1 - p));
                                            return (
                                                <g key={p}>
                                                    <line
                                                        x1={margin.left}
                                                        x2={margin.left + innerWidth}
                                                        y1={y}
                                                        y2={y}
                                                        stroke="rgba(0,0,0,0.05)"
                                                    />
                                                    <text
                                                        x={margin.left - 8}
                                                        y={y + 3}
                                                        textAnchor="end"
                                                        fontSize="10"
                                                        fill="var(--color-text-subtle)"
                                                    >
                                                        {val}
                                                    </text>
                                                </g>
                                            );
                                        })}

                                        {/* Vertical Grid & X-Axis Labels */}
                                        {trendDays > 1 && Array.from({ length: trendDays }).map((_, i) => {
                                            // Show fewer labels if too many
                                            if (trendDays > 7 && i % 2 !== 0) return null;
                                            const step = innerWidth / (trendDays - 1 || 1);
                                            const x = margin.left + i * step;
                                            return (
                                                <g key={i}>
                                                    <line
                                                        x1={x}
                                                        x2={x}
                                                        y1={margin.top}
                                                        y2={margin.top + innerHeight}
                                                        stroke="rgba(0,0,0,0.03)"
                                                    />
                                                    <text
                                                        x={x}
                                                        y={margin.top + innerHeight + 20}
                                                        textAnchor="middle"
                                                        fontSize="10"
                                                        fill="#9ca3af"
                                                    >
                                                        {trendLabel(i)}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </g>
                                    <path d={`${getSmoothPath(taskTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#tasksGradient)" />
                                    <path d={`${getSmoothPath(ideaTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#ideasGradient)" />

                                    <path d={getSmoothPath(ideaTrend)} stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    {hasIssuesModule && <path d={getSmoothPath(issueTrend)} stroke="#f43f5e" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                                    <path d={getSmoothPath(taskTrend)} stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

                                    {hoverTrendIndex !== null && (() => {
                                        const step = innerWidth / (trendDays - 1 || 1);
                                        const x = margin.left + hoverTrendIndex * step;
                                        const taskVal = taskTrend[hoverTrendIndex]?.value ?? 0;
                                        const ideaVal = ideaTrend[hoverTrendIndex]?.value ?? 0;
                                        const issueVal = hasIssuesModule ? (issueTrend[hoverTrendIndex]?.value ?? 0) : 0;

                                        const yTask = margin.top + innerHeight - (taskVal / maxTrendValue) * innerHeight;
                                        const yIdea = margin.top + innerHeight - (ideaVal / maxTrendValue) * innerHeight;
                                        const yIssue = margin.top + innerHeight - (issueVal / maxTrendValue) * innerHeight;
                                        return (
                                            <g>
                                                <line x1={x} x2={x} y1={margin.top} y2={margin.top + innerHeight} stroke="currentColor" className="text-gray-400" strokeDasharray="4 4" />
                                                <circle cx={x} cy={yIdea} r={5} className="fill-blue-500 stroke-white" strokeWidth={2} />
                                                {hasIssuesModule && <circle cx={x} cy={yIssue} r={5} className="fill-rose-500 stroke-white" strokeWidth={2} />}
                                                <circle cx={x} cy={yTask} r={5} className="fill-amber-500 stroke-white" strokeWidth={2} />
                                                {/* Tooltipish */}
                                                <rect x={x + 10} y={margin.top} width="100" height={hasIssuesModule ? "65" : "50"} rx="4" fill="var(--color-surface-paper)" stroke="var(--color-surface-border)" />
                                                <text x={x + 20} y={margin.top + 15} fontSize="10" fill="var(--color-text-main)">Tasks: {taskVal}</text>
                                                <text x={x + 20} y={margin.top + 30} fontSize="10" fill="var(--color-text-main)">Ideas: {ideaVal}</text>
                                                {hasIssuesModule && <text x={x + 20} y={margin.top + 45} fontSize="10" fill="var(--color-text-main)">Issues: {issueVal}</text>}
                                            </g>
                                        );
                                    })()}
                                </svg>
                            </div>
                        </Card>

                        {/* 2. Project Status (Span 1) */}
                        <Card padding="md" className="flex flex-col items-center justify-center lg:col-span-1">
                            <div className="relative flex items-center justify-center mb-6">
                                <DonutChart data={projectStatusDistribution} size={140} thickness={12} />
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-bold text-[var(--color-text-main)]">{projects.length}</span>
                                    <span className="text-xs text-[var(--color-text-muted)] uppercase">Projects</span>
                                </div>
                            </div>
                            <div className="w-full space-y-2">
                                <h3 className="h4 text-center mb-4">Status</h3>
                                {projectStatusDistribution.map((item) => (
                                    <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="font-medium text-[var(--color-text-main)]">{item.name}</span>
                                        </div>
                                        <span className="font-bold text-[var(--color-text-main)]">{item.value}</span>
                                    </div>
                                ))}
                                {projectStatusDistribution.length === 0 && <p className="text-sm text-[var(--color-text-muted)] text-center">No active projects.</p>}
                            </div>
                        </Card>



                        {/* 3. Row 3: Workload, Deadlines (2 Columns) - Attention moved to Sidebar */}
                        <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4">

                            {/* 3a. Workload (1 Col) */}
                            <Card padding="md" className="flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="h4">Workload</h3>
                                    <span className="text-xs text-[var(--color-text-muted)]">{tasks.filter(t => !t.isCompleted).length} pending</span>
                                </div>
                                <div className="space-y-4">
                                    {taskPriorityDistribution.map(item => (
                                        <div key={item.name} className="space-y-1">
                                            <div className="flex justify-between text-xs font-semibold">
                                                <span style={{ color: item.color }}>{item.name}</span>
                                                <span className="text-[var(--color-text-subtle)]">{item.value}</span>
                                            </div>
                                            <div className="h-2 w-full bg-[var(--color-surface-bg)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                                    style={{ width: `${(item.value / (tasks.filter(t => !t.isCompleted).length || 1)) * 100}%`, backgroundColor: item.color }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {taskPriorityDistribution.length === 0 && <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No pending tasks.</p>}
                                </div>
                                <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)] flex justify-end">
                                    <Link to="/tasks" className="text-sm font-bold text-[var(--color-primary)] hover:text-indigo-700 transition-colors flex items-center gap-1 group">
                                        Manage Tasks <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                    </Link>
                                </div>
                            </Card>

                            {/* 3b. Upcoming Deadlines (1 Col) */}
                            <Card padding="md" className="flex flex-col">
                                <h3 className="h4 mb-4">Upcoming Deadlines</h3>
                                <div className="flex-1 space-y-0 divide-y divide-[var(--color-surface-border)] -mx-2 px-2">
                                    {focusTasks.slice(0, 4).map(task => { // Showing top 4
                                        const priorityColor = task.priority === 'Urgent' ? 'text-red-500' : task.priority === 'High' ? 'text-orange-500' : 'text-blue-500';
                                        const due = toDate(task.dueDate);
                                        const isOverdue = due && due.getTime() < Date.now();

                                        return (
                                            <Link key={task.id} to={`/project/${task.projectId}/tasks/${task.id}`} className="block py-3 first:pt-2 last:pb-2 hover:bg-[var(--color-surface-hover)] -mx-2 px-4 rounded-lg transition-colors group">
                                                <div className="flex items-center justify-between">
                                                    <div className="min-w-0 flex-1 pr-3">
                                                        <p className="text-sm font-medium text-[var(--color-text-main)] truncate group-hover:text-[var(--color-primary)] transition-colors">{task.title}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${priorityColor}`}>{task.priority}</span>
                                                            {due && (
                                                                <span className={`text-[10px] ${isOverdue ? 'text-red-500 font-bold' : 'text-[var(--color-text-muted)]'}`}>
                                                                    {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">chevron_right</span>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                    {focusTasks.length === 0 && (
                                        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                                            No upcoming tasks.
                                        </div>
                                    )}
                                </div>
                            </Card>

                        </div>

                        {/* 4. Recent Projects (Full Row - Span 3) */}
                        <div className="lg:col-span-3">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                        <span className="material-symbols-outlined">folder_open</span>
                                    </div>
                                    <h3 className="h3">Active Projects</h3>
                                </div>
                                <Link to="/projects" className="text-sm font-bold text-[var(--color-primary)] hover:text-indigo-700 transition-colors flex items-center gap-1 group">
                                    View All <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {recentProjects.length === 0 ? (
                                    <div className="col-span-3 p-12 text-center text-[var(--color-text-subtle)] border-2 border-dashed border-[var(--color-surface-border)] rounded-2xl bg-[var(--color-surface-bg)]/50">
                                        <div className="mb-4 inline-flex p-4 rounded-full bg-[var(--color-surface-hover)]">
                                            <span className="material-symbols-outlined text-4xl opacity-50">post_add</span>
                                        </div>
                                        <p className="text-lg font-medium">No projects yet</p>
                                        <p className="text-sm mt-1">Create your first project to get started.</p>
                                    </div>
                                ) : (
                                    recentProjects.slice(0, 3).map((proj) => {
                                        const projTasks = tasks.filter((t) => t.projectId === proj.id);
                                        const completed = projTasks.filter((t) => t.isCompleted).length;
                                        const total = projTasks.length;
                                        const pct = total > 0 ? Math.round((completed / total) * 100) : (proj.progress || 0);

                                        const isBrainstorming = proj.status === 'Brainstorming' || proj.status === 'Planning';
                                        const isCompleted = proj.status === 'Completed';

                                        let icon = 'folder';
                                        let iconClass = 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20';
                                        let progressColor = 'bg-indigo-500';

                                        if (isBrainstorming) {
                                            icon = 'lightbulb';
                                            iconClass = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20';
                                            progressColor = 'bg-amber-500';
                                        } else if (isCompleted) {
                                            icon = 'check_circle';
                                            iconClass = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20';
                                            progressColor = 'bg-emerald-500';
                                        }

                                        return (
                                            <Link key={proj.id} to={`/project/${proj.id}`} className="group block h-full">
                                                <Card padding="none" hoverable className="h-full flex flex-col relative overflow-hidden transition-all duration-300 group-hover:shadow-2xl border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50 bg-[var(--color-surface-paper)]">

                                                    {/* Cover Image Area - Tall for impact */}
                                                    <div className="h-28 w-full relative overflow-hidden bg-gray-100 dark:bg-gray-800">
                                                        {proj.coverImage ? (
                                                            <>
                                                                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface-paper)]/90 via-transparent to-transparent z-10" />
                                                                <img src={proj.coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />
                                                            </>
                                                        ) : (
                                                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />
                                                        )}

                                                        <div className="absolute top-3 right-3 z-20">
                                                            <Badge variant={isCompleted ? 'success' : isBrainstorming ? 'secondary' : 'primary'} className="backdrop-blur-md bg-white/90 dark:bg-black/50 shadow-sm border-0">
                                                                {proj.status}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="px-5 pb-5 flex flex-col flex-1 relative z-20">
                                                        {/* Floating Icon */}
                                                        <div className="-mt-8 mb-3">
                                                            {proj.squareIcon ? (
                                                                <div className="size-14 rounded-2xl overflow-hidden border-4 border-[var(--color-surface-paper)] bg-white shadow-md">
                                                                    <img src={proj.squareIcon} alt="" className="w-full h-full object-cover" />
                                                                </div>
                                                            ) : (
                                                                <div className={`size-14 rounded-2xl flex items-center justify-center border-4 border-[var(--color-surface-paper)] shadow-md ${iconClass} bg-[var(--color-surface-paper)]`}>
                                                                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 space-y-1 mb-4">
                                                            <h3 className="text-lg font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">
                                                                {proj.title}
                                                            </h3>
                                                            {proj.description && (
                                                                <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                                                                    {proj.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Progress */}
                                                        <div className="space-y-2 mb-4">
                                                            <div className="flex items-center justify-between text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">
                                                                <span>Progress</span>
                                                                <span>{pct}%</span>
                                                            </div>
                                                            <div className="w-full bg-[var(--color-surface-border)] rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Footer members */}
                                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--color-surface-border)]">
                                                            <MemberAvatars projectId={proj.id} />
                                                            <span className="material-symbols-outlined text-[var(--color-text-subtle)] group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all">arrow_forward</span>
                                                        </div>
                                                    </div>
                                                </Card>
                                            </Link>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                    </div>

                </div>


                {/* Right Column: Sidebar Widgets */}
                <div className="space-y-6">

                    {/* 1. Mini Calendar with View Toggle */}
                    <Card padding="md">
                        <div className="flex flex-col gap-3 mb-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-base text-[var(--color-text-main)]">
                                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                    <span className="ml-2 text-[10px] text-[var(--color-text-subtle)] font-normal bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded-full">
                                        {calendarView === 'month' ? (
                                            <>
                                                W{getWeekNumber(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))}
                                                -
                                                {getWeekNumber(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0))}
                                            </>
                                        ) : (
                                            <>W{getWeekNumber(currentDate)}</>
                                        )}
                                    </span>
                                </h3>
                                <div className="flex gap-1">
                                    <button
                                        onClick={handlePrevDate}
                                        className="p-1 hover:bg-[var(--color-surface-hover)] rounded-md text-[var(--color-text-subtle)]"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                                    </button>
                                    <button
                                        onClick={handleNextDate}
                                        className="p-1 hover:bg-[var(--color-surface-hover)] rounded-md text-[var(--color-text-subtle)]"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                    </button>
                                </div>
                            </div>

                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                                <div key={`${d}-${i}`} className="text-[10px] font-semibold text-[var(--color-text-subtle)] uppercase">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center">
                            {(() => {
                                const todayFull = new Date();
                                const currentDay = currentDate.getDate();

                                let days = [];

                                if (calendarView === 'month') {
                                    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                                    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() || 7; // Mon=1
                                    const emptyDays = firstDay - 1;

                                    for (let i = 0; i < emptyDays; i++) days.push(<div key={`empty-${i}`} />);
                                    for (let i = 1; i <= daysInMonth; i++) {
                                        // Check if this specific day is *actually* today
                                        const thisDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
                                        const isToday = thisDate.toDateString() === todayFull.toDateString();

                                        days.push(
                                            <div key={i} className={`size-8 mx-auto flex items-center justify-center text-xs rounded-full cursor-pointer transition-colors ${isToday ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}`}>
                                                {i}
                                            </div>
                                        );
                                    }
                                } else {
                                    // Week view: Show week surrounding currentDate
                                    const currentDayOfWeek = currentDate.getDay() || 7; // Mon=1
                                    const mondayDate = new Date(currentDate);
                                    mondayDate.setDate(currentDate.getDate() - currentDayOfWeek + 1);

                                    for (let i = 0; i < 7; i++) {
                                        const d = new Date(mondayDate);
                                        d.setDate(mondayDate.getDate() + i);
                                        const dayNum = d.getDate();
                                        const isToday = d.toDateString() === todayFull.toDateString();

                                        days.push(
                                            <div key={`week-${i}`} className={`size-8 mx-auto flex items-center justify-center text-xs rounded-full cursor-pointer transition-colors ${isToday ? 'bg-emerald-500 text-white font-bold shadow-md' : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}`}>
                                                {dayNum}
                                            </div>
                                        );
                                    }
                                }
                                return days;
                            })()}
                        </div>

                        {/* Segmented Control for View Switch - Moved Bottom & Taller */}
                        <div className="flex p-0.5 bg-[var(--color-surface-hover)] rounded-md mt-2">
                            <button
                                onClick={() => calendarView !== 'month' && toggleCalendarView()}
                                className={`flex-1 py-[5px] text-[9px] font-bold uppercase tracking-wider rounded transition-all ${calendarView === 'month' ? 'bg-[var(--color-surface-paper)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-subtle)] hover:text-[var(--color-text-main)]'}`}
                            >
                                Month
                            </button>
                            <button
                                onClick={() => calendarView !== 'week' && toggleCalendarView()}
                                className={`flex-1 py-[5px] text-[9px] font-bold uppercase tracking-wider rounded transition-all ${calendarView === 'week' ? 'bg-[var(--color-surface-paper)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-subtle)] hover:text-[var(--color-text-main)]'}`}
                            >
                                Week
                            </button>
                        </div>
                    </Card>

                    <ScheduledTasksCard tasks={tasks} issues={issues} />

                    {/* Latest Milestone (if any project has milestones module) */}
                    <LatestMilestoneCard projects={projects} />

                    {/* 2. Enhanced Live Activity (Hybrid Data) */}
                    <Card padding="none" className="max-h-[400px] flex flex-col">
                        <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
                            <h3 className="h5">Live Activity</h3>
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        </div>
                        <div className="overflow-y-auto p-2 space-y-1">
                            {displayActivities.length === 0 ? (
                                <div className="p-8 text-center text-sm text-[var(--color-text-subtle)]">No recent activity</div>
                            ) : (
                                displayActivities.map(item => (
                                    <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors group">
                                        <div className="mt-0.5">
                                            {item.userAvatar ? (
                                                <img src={item.userAvatar} alt="" className="size-8 rounded-full border border-[var(--color-surface-border)] object-cover" />
                                            ) : (
                                                <div className="size-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                                    {(item.user || 'U').charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-[var(--color-text-main)] leading-snug">
                                                <span className="font-semibold">{item.user}</span> <span className="text-[var(--color-text-muted)]">
                                                    {item.action || 'performed action on'}
                                                </span> <br />
                                                <span className="font-medium text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">{item.target}</span>
                                            </p>
                                            <p className="text-[10px] text-[var(--color-text-subtle)] mt-1">
                                                {item.createdAt ? new Date(toMillis(item.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* 3. Attention Needed (Moved Here) */}
                    <Card padding="md" className="flex flex-col border-l-4 border-l-rose-500">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="h5 text-rose-600 dark:text-rose-400">Attention Needed</h3>
                            <span className="material-symbols-outlined text-rose-500 text-[20px]">warning</span>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                            {(() => {
                                const blockedTasks = tasks.filter(t => t.status === 'Blocked');
                                const urgentTasks = tasks.filter(t => t.priority === 'Urgent' && !t.isCompleted);
                                const attentionItems = [...blockedTasks, ...urgentTasks].slice(0, 5);

                                if (attentionItems.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center text-center py-4 opacity-70">
                                            <span className="material-symbols-outlined text-3xl text-emerald-500 mb-2">check_circle</span>
                                            <p className="text-xs text-[var(--color-text-muted)]">All clear!</p>
                                        </div>
                                    );
                                }

                                return attentionItems.map(item => (
                                    <Link key={item.id} to={`/project/${item.projectId}/tasks/${item.id}`} className="block p-3 rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 hover:shadow-sm transition-shadow">
                                        <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 mb-0.5 uppercase">{item.status === 'Blocked' ? 'BLOCKED' : 'URGENT'}</p>
                                        <p className="text-sm font-medium text-[var(--color-text-main)] line-clamp-2">{item.title}</p>
                                    </Link>
                                ));
                            })()}
                        </div>
                    </Card>

                    {/* 4. Recently Added Tasks (Restored) */}
                    <Card padding="md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="h5">Recently Added</h3>
                            <Link to="/tasks" className="text-xs font-bold text-[var(--color-primary)] hover:underline">View All</Link>
                        </div>
                        <div className="space-y-3">
                            {tasks
                                .sort((a, b) => (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0))
                                .slice(0, 5)
                                .map(task => (
                                    <Link key={task.id} to={`/project/${task.projectId}/tasks/${task.id}`} className="flex items-start gap-3 group">
                                        <div className={`mt-1 size-2 rounded-full flex-shrink-0 ${task.priority === 'Urgent' ? 'bg-red-500' : task.priority === 'High' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-[var(--color-text-main)] line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">{task.title}</p>
                                            <p className="text-xs text-[var(--color-text-muted)]">
                                                {formatShortDate(new Date(toMillis(task.createdAt)))}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            {tasks.length === 0 && <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No recent tasks.</p>}
                        </div>
                    </Card>

                    {/* Recent Issues (Conditional) */}
                    {hasIssuesModule && issues.length > 0 && (
                        <Card padding="none">
                            <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
                                <h3 className="h5">Recent Issues</h3>
                            </div>
                            <div className="divide-y divide-[var(--color-surface-border)]">
                                {issues.slice(0, 4).map((issue) => (
                                    <div key={issue.id} className="p-3">
                                        <div className="flex items-start gap-2">
                                            <span className={`material-symbols-outlined text-[18px] ${issue.status === 'Resolved' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {issue.status === 'Resolved' ? 'check_circle' : 'error'}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate text-[var(--color-text-main)]">{issue.title}</p>
                                                <p className="text-xs text-[var(--color-text-muted)] truncate">{projectById.get(issue.projectId) || 'Unknown Project'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                </div>
            </div>
        </div>
    );
};
