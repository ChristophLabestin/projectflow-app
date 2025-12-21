import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUserProjects, getSharedProjects, getUserTasks, getUserIdeas } from '../services/dataService';
import { Project, Task, Idea } from '../types';
import { toMillis } from '../utils/time';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Sparkline } from '../components/charts/Sparkline';

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number' || typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value.toDate === 'function') {
        const parsed = value.toDate();
        return parsed instanceof Date ? parsed : null;
    }
    return null;
};

const formatShortDate = (date: Date) =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const Dashboard = () => {
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
    const [loading, setLoading] = useState(true);
    const [hoverTrendIndex, setHoverTrendIndex] = useState<number | null>(null);
    const trendRef = useRef<SVGSVGElement | null>(null);

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

                    setProjects(allProjects);
                    setTasks(tasks);
                    setIdeas(ideas);
                    setStats({
                        activeProjects: allProjects.filter(p => p.status === 'Active').length,
                        completedProjects: allProjects.filter(p => p.status === 'Completed').length,
                        openTasks: tasks.filter(t => !t.isCompleted).length,
                        ideas: ideas.length
                    });

                    const sortedProjects = [...allProjects].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
                    setRecentProjects(sortedProjects.slice(0, 4));
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

    const activityFeed = useMemo(() => {
        const entries: { id: string; title: string; type: 'task' | 'idea'; timestamp: number; projectId?: string }[] = [];
        tasks.slice(0, 15).forEach((t) => entries.push({ id: `task-${t.id}`, title: t.title, type: 'task', timestamp: toMillis(t.createdAt) || 0, projectId: t.projectId }));
        ideas.slice(0, 15).forEach((i) => entries.push({ id: `idea-${i.id}`, title: i.title, type: 'idea', timestamp: toMillis(i.createdAt) || 0, projectId: i.projectId }));
        return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
    }, [tasks, ideas]);

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
    const trendDays = Math.max(taskTrend.length, ideaTrend.length);
    const maxTrendValue = useMemo(
        () => Math.max(...taskTrend.map(v => v.value), ...ideaTrend.map(v => v.value), 1),
        [taskTrend, ideaTrend]
    );

    const linePath = (data: { value: number }[]) => {
        if (!data.length) return '';
        const max = maxTrendValue || 1;
        const step = innerWidth / (Math.max(data.length, trendDays) - 1 || 1);
        return data.map((d, i) => {
            const x = margin.left + i * step;
            const y = margin.top + innerHeight - (d.value / max) * innerHeight;
            return `${i === 0 ? 'M' : 'L'}${x},${y}`;
        }).join(' ');
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="h2 text-[var(--color-text-main)]">Dashboard</h1>
                    <p className="text-[var(--color-text-muted)] text-sm">
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <Link to="/create">
                    <Button icon={<span className="material-symbols-outlined">add</span>}>
                        New Project
                    </Button>
                </Link>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {kpiCards.map((stat) => {
                    return (
                        <Card key={stat.key} padding="md" className="relative overflow-hidden group">
                            <div className="flex flex-col gap-3 relative z-10">
                                <div className="flex items-start justify-between">
                                    <div
                                        className="p-2 rounded-lg"
                                        style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                                    >
                                        <span className="material-symbols-outlined">{stat.icon}</span>
                                    </div>
                                    <span className="text-2xl font-bold">{stat.value}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-[var(--color-text-muted)]">{stat.label}</p>
                                    <p className="text-xs text-[var(--color-text-subtle)]">{stat.caption}</p>
                                </div>
                            </div>
                            {/* Sparkline Background */}
                            <div className="absolute bottom-0 right-0 left-0 h-16 opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none">
                                <Sparkline
                                    data={stat.series.map(s => s.value)}
                                    width={300}
                                    height={64}
                                    color={stat.color}
                                    fill
                                />
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Productivity Chart & Due Tasks */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Productivity Chart */}
                    <Card>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="h4">Productivity Trends</h3>
                            <div className="flex items-center gap-4 text-xs font-medium">
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-amber-500"></span> Tasks
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-blue-500"></span> Ideas
                                </span>
                            </div>
                        </div>
                        <div className="w-full relative aspect-[3/1] bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] overflow-hidden">
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
                                    {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                                        <line
                                            key={p}
                                            x1={margin.left}
                                            x2={margin.left + innerWidth}
                                            y1={margin.top + innerHeight * p}
                                            y2={margin.top + innerHeight * p}
                                            stroke="rgba(0,0,0,0.05)"
                                        />
                                    ))}
                                    {trendDays > 1 && Array.from({ length: trendDays }).map((_, i) => {
                                        if (i % 2 !== 0 && trendDays > 7) return null; // Skip labels if too many
                                        const step = innerWidth / (trendDays - 1 || 1);
                                        const x = margin.left + i * step;
                                        return (
                                            <text
                                                key={i}
                                                x={x}
                                                y={margin.top + innerHeight + 20}
                                                textAnchor="middle"
                                                fontSize="10"
                                                fill="#9ca3af"
                                            >
                                                {trendLabel(i)}
                                            </text>
                                        );
                                    })}
                                </g>
                                <path d={`${linePath(taskTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#tasksGradient)" />
                                <path d={`${linePath(ideaTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#ideasGradient)" />
                                <path d={linePath(ideaTrend)} stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                <path d={linePath(taskTrend)} stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

                                {hoverTrendIndex !== null && (() => {
                                    const step = innerWidth / (trendDays - 1 || 1);
                                    const x = margin.left + hoverTrendIndex * step;
                                    const taskVal = taskTrend[hoverTrendIndex]?.value ?? 0;
                                    const ideaVal = ideaTrend[hoverTrendIndex]?.value ?? 0;
                                    const yTask = margin.top + innerHeight - (taskVal / maxTrendValue) * innerHeight;
                                    const yIdea = margin.top + innerHeight - (ideaVal / maxTrendValue) * innerHeight;
                                    return (
                                        <g>
                                            <line x1={x} x2={x} y1={margin.top} y2={margin.top + innerHeight} stroke="currentColor" className="text-gray-400" strokeDasharray="4 4" />
                                            <circle cx={x} cy={yIdea} r={5} className="fill-blue-500 stroke-white" strokeWidth={2} />
                                            <circle cx={x} cy={yTask} r={5} className="fill-amber-500 stroke-white" strokeWidth={2} />
                                        </g>
                                    );
                                })()}
                            </svg>
                        </div>
                    </Card>

                    {/* Priority Tasks */}
                    <Card padding="none">
                        <div className="p-5 border-b border-[var(--color-surface-border)] flex items-center justify-between">
                            <h3 className="h4">Priority Tasks</h3>
                            <Link to="/tasks" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">View All</Link>
                        </div>
                        <div className="divide-y divide-[var(--color-surface-border)]">
                            {focusTasks.length === 0 ? (
                                <div className="p-8 text-center text-[var(--color-text-subtle)]">
                                    <p>No urgent tasks. Good job!</p>
                                </div>
                            ) : (
                                focusTasks.map((task) => {
                                    const dueDate = toDate(task.dueDate);
                                    const isOverdue = !!dueDate && dueDate.getTime() < Date.now();
                                    return (
                                        <Link
                                            key={task.id}
                                            to={task.projectId ? `/project/${task.projectId}/tasks/${task.id}` : '/tasks'}
                                            className="group block p-4 hover:bg-[var(--color-surface-hover)] transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`
                                                    size-5 rounded-full border-2 flex items-center justify-center
                                                    ${isOverdue ? 'border-rose-400' : 'border-[var(--color-text-subtle)]'}
                                                `}>
                                                    {isOverdue && <span className="size-2 rounded-full bg-rose-500" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${isOverdue ? 'text-rose-600' : 'text-[var(--color-text-main)]'}`}>
                                                        {task.title}
                                                    </p>
                                                    <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-2 mt-0.5">
                                                        <span className="truncate">{task.projectId ? projectById.get(task.projectId) : 'General'}</span>
                                                        {dueDate && (
                                                            <>
                                                                <span className="size-1 rounded-full bg-[var(--color-text-subtle)]" />
                                                                <span>{formatShortDate(dueDate)}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                                <span className="material-symbols-outlined text-[var(--color-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                    chevron_right
                                                </span>
                                            </div>
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right Column: Portfolio & Feed */}
                <div className="space-y-6">

                    {/* Recent Projects */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="h4">Recent Projects</h3>
                            <Link to="/projects" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">All Projects</Link>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {recentProjects.length === 0 ? (
                                <Card padding="lg" className="text-center text-[var(--color-text-subtle)]">
                                    No projects yet.
                                </Card>
                            ) : (
                                recentProjects.map((proj) => {
                                    const projTasks = tasks.filter((t) => t.projectId === proj.id);
                                    const completed = projTasks.filter((t) => t.isCompleted).length;
                                    const total = projTasks.length;
                                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                                    return (
                                        <Link key={proj.id} to={`/project/${proj.id}`}>
                                            <Card padding="md" hoverable className="flex flex-col gap-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="size-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                        {proj.title.substring(0, 1).toUpperCase()}
                                                    </div>
                                                    <Badge variant={proj.status === 'Completed' ? 'success' : 'primary'}>
                                                        {proj.status}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-[var(--color-text-main)] truncate">{proj.title}</h4>
                                                    <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mt-2">
                                                        <span>{completed}/{total} tasks</span>
                                                        <span>{pct}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-[var(--color-surface-bg)] rounded-full mt-1.5 overflow-hidden">
                                                        <div
                                                            className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </Card>
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Quick Ideas */}
                    <Card padding="md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold">Quick Ideas</h3>
                            <Link to="/brainstorm" className="material-symbols-outlined text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">add_circle</Link>
                        </div>
                        <div className="space-y-3">
                            {ideaSpotlight.map((idea) => (
                                <div key={idea.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <span className="material-symbols-outlined text-amber-500 text-[20px] mt-0.5">lightbulb</span>
                                    <span className="text-sm text-[var(--color-text-main)] line-clamp-2 leading-snug">{idea.title}</span>
                                </div>
                            ))}
                            {ideaSpotlight.length === 0 && <span className="text-xs text-[var(--color-text-subtle)]">No ideas captured recently.</span>}
                        </div>
                    </Card>

                    {/* Activity Feed Mini */}
                    <Card padding="none">
                        <div className="p-4 border-b border-[var(--color-surface-border)]">
                            <h3 className="text-base font-semibold">Activity</h3>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {activityFeed.length === 0 ? (
                                <div className="p-4 text-center text-xs text-[var(--color-text-subtle)]">No recent activity</div>
                            ) : (
                                activityFeed.map(item => (
                                    <div key={item.id} className="flex items-start gap-3 p-3 border-b border-[var(--color-surface-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors">
                                        <span className={`material-symbols-outlined text-[16px] mt-0.5 ${item.type === 'task' ? 'text-emerald-500' : 'text-blue-500'}`}>
                                            {item.type === 'task' ? 'check_circle' : 'auto_awesome'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{item.title}</p>
                                            <p className="text-[10px] text-[var(--color-text-subtle)]">
                                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                </div>
            </div>
        </div>
    );
};
