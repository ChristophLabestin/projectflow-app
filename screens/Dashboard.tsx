import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUserProjects, getUserTasks, getUserIdeas } from '../services/dataService';
import { Project, Task, Idea } from '../types';
import { toMillis } from '../utils/time';

export const Dashboard = () => {
    const [stats, setStats] = useState({
        activeProjects: 0,
        completedProjects: 0,
        openTasks: 0,
        ideas: 0
    });
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
                const projects = await getUserProjects();
                const tasks = await getUserTasks();
                const ideas = await getUserIdeas();

                setTasks(tasks);
                setIdeas(ideas);
                setStats({
                    activeProjects: projects.filter(p => p.status === 'Active').length,
                    completedProjects: projects.filter(p => p.status === 'Completed').length,
                    openTasks: tasks.filter(t => !t.isCompleted).length,
                    ideas: ideas.length
                });

                setRecentProjects(projects.slice(0, 5));
            } catch (error) {
                console.error("Dashboard load failed", error);
            } finally {
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
        const other = Math.max(0, recentProjects.length - active - completed);
        const total = active + completed + other || 1;
        return {
            activePct: Math.round((active / total) * 100),
            completedPct: Math.round((completed / total) * 100),
            otherPct: Math.max(0, 100 - Math.round((active / total) * 100) - Math.round((completed / total) * 100)),
        };
    }, [stats, recentProjects.length]);

    const activityFeed = useMemo(() => {
        const entries: { id: string; title: string; type: 'task' | 'idea'; timestamp: number; projectId?: string }[] = [];
        tasks.slice(0, 15).forEach((t) => entries.push({ id: `task-${t.id}`, title: t.title, type: 'task', timestamp: toMillis(t.createdAt) || 0, projectId: t.projectId }));
        ideas.slice(0, 15).forEach((i) => entries.push({ id: `idea-${i.id}`, title: i.title, type: 'idea', timestamp: toMillis(i.createdAt) || 0, projectId: i.projectId }));
        return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
    }, [tasks, ideas]);

    const sparkPath = (data: { value: number }[], width = 120, height = 40) => {
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

    const chartOuterWidth = 640;
    const chartOuterHeight = 260;
    const margin = { top: 12, right: 12, bottom: 36, left: 72 };
    const chartWidth = chartOuterWidth;
    const chartHeight = chartOuterHeight;
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
        const x = e.clientX - rect.left - margin.left;
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

    return (
        <div className="max-w-[1200px] mx-auto flex flex-col gap-6 md:gap-8 pb-12 p-4 md:p-8">
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl font-extrabold leading-tight tracking-[-0.033em]">Workspace pulse</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-base font-medium">Momentum across projects, tasks, and ideas.</p>
                </div>
                <div className="flex gap-3">
                    <Link to="/create" className="flex items-center gap-2 h-10 px-4 rounded-lg bg-black dark:bg-white text-white dark:text-black text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-lg shadow-black/20">
                        <span className="material-symbols-outlined text-[20px]">folder_open</span>
                        <span>New Project</span>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                    { label: "Active Projects", value: stats.activeProjects, icon: "folder_open", color: "#1d4ed8", fill: "#e8f1ff", series: taskTrend },
                    { label: "Completed", value: stats.completedProjects, icon: "check_circle", color: "#16a34a", fill: "#e8f8f2", series: ideaTrend },
                    { label: "Open Tasks", value: stats.openTasks, icon: "check_box", color: "#f97316", fill: "#feefe8", series: taskTrend },
                    { label: "Ideas", value: stats.ideas, icon: "lightbulb", color: "#a855f7", fill: "#f2eaff", series: ideaTrend }
                ].map((stat, i) => {
                    const w = 120;
                    const h = 40;
                    const max = Math.max(...stat.series.map(s => s.value), 1);
                    const step = stat.series.length > 1 ? w / (stat.series.length - 1) : w;
                    const areaPath = stat.series.length
                        ? `M0,${h} ` +
                          stat.series.map((d, idx) => {
                              const x = idx * step;
                              const y = h - (d.value / max) * h;
                              return `${idx === 0 ? 'L' : 'L'}${x},${y}`;
                          }).join(' ') +
                          ` L${w},${h} Z`
                        : `M0,${h} L${w},${h} Z`;
                    return (
                        <div key={i} className="relative overflow-hidden flex flex-col gap-4 rounded-2xl p-5 border border-gray-200 bg-white shadow-sm">
                            <div className="flex items-start justify-between">
                                <p className="text-gray-500 text-xs font-extrabold uppercase tracking-[0.16em] leading-tight">{stat.label}</p>
                                <span className="material-symbols-outlined" style={{ color: stat.color }}>{stat.icon}</span>
                            </div>
                            {loading ? (
                                <div className="h-8 w-12 bg-gray-200 rounded animate-pulse"></div>
                            ) : (
                                <p className="text-4xl font-black text-gray-900 leading-none">{stat.value}</p>
                            )}
                            <div className="w-full h-12 -mb-2">
                                <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
                                    <path d={areaPath} fill={stat.fill} stroke="none" />
                                </svg>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                <div className="xl:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.12em]">Weekly throughput</p>
                                <p className="text-base text-slate-800 dark:text-slate-200 font-semibold">Tasks vs ideas (last 7 days)</p>
                            </div>
                            {hoverTrendIndex !== null && (
                                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    {trendLabel(hoverTrendIndex)} · Tasks {taskTrend[hoverTrendIndex]?.value || 0} · Ideas {ideaTrend[hoverTrendIndex]?.value || 0}
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <svg
                                ref={trendRef}
                                width={chartWidth}
                                height={chartHeight}
                                className="w-full max-w-full"
                                onMouseMove={handleTrendMove}
                                onMouseLeave={() => setHoverTrendIndex(null)}
                            >
                                <defs>
                                    <linearGradient id="tasksArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                                    </linearGradient>
                                    <linearGradient id="ideasArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="transparent" />
                                <g stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3">
                                    {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                                        <line key={p} x1={margin.left} x2={margin.left + innerWidth} y1={margin.top + innerHeight * p} y2={margin.top + innerHeight * p} />
                                    ))}
                                    {Array.from({ length: Math.max(trendDays, 2) }).map((_, idx) => {
                                        const step = innerWidth / (Math.max(trendDays, 2) - 1);
                                        const x = margin.left + idx * step;
                                        return <line key={idx} x1={x} x2={x} y1={margin.top} y2={margin.top + innerHeight} />;
                                    })}
                                </g>
                                <g stroke="#0f172a" strokeWidth="1.6" strokeOpacity="0.4">
                                    <line x1={margin.left} x2={margin.left + innerWidth} y1={margin.top + innerHeight} y2={margin.top + innerHeight} />
                                    <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + innerHeight} />
                                </g>
                                <g fill="#64748b" fontSize="10" textAnchor="middle">
                                    {Array.from({ length: trendDays }).map((_, idx) => {
                                        const step = innerWidth / (Math.max(trendDays, 2) - 1);
                                        const x = margin.left + idx * step;
                                        return (
                                            <g key={idx}>
                                                <line x1={x} x2={x} y1={margin.top + innerHeight} y2={margin.top + innerHeight + 4} stroke="#0f172a" strokeOpacity="0.4" strokeWidth="1" />
                                                <text x={x} y={margin.top + innerHeight + 16}>{trendLabel(idx)}</text>
                                            </g>
                                        );
                                    })}
                                </g>
                                <g fill="#0f172a" fontSize="11" textAnchor="end">
                                    {[0, 0.25, 0.5, 0.75, 1].map((p) => {
                                        const value = Math.round(maxTrendValue * (1 - p));
                                        const y = margin.top + innerHeight * p;
                                        return (
                                            <g key={p}>
                                                <line x1={margin.left - 10} x2={margin.left} y1={y} y2={y} stroke="#0f172a" strokeOpacity="0.7" strokeWidth="1" />
                                                <text x={margin.left - 14} y={y + 4}>{value}</text>
                                            </g>
                                        );
                                    })}
                                </g>
                                <text x={margin.left + innerWidth / 2} y={margin.top + innerHeight + 34} fill="#0f172a" fontSize="12" textAnchor="middle" fontWeight={700}>Day</text>
                                <text x={margin.left - 52} y={margin.top + innerHeight / 2} fill="#0f172a" fontSize="12" textAnchor="middle" fontWeight={700} transform={`rotate(-90 ${margin.left - 52} ${margin.top + innerHeight / 2})`}>Count</text>
                                <path
                                    d={`${linePath(taskTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`}
                                    fill="url(#tasksArea)"
                                />
                                <path
                                    d={`${linePath(ideaTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`}
                                    fill="url(#ideasArea)"
                                />
                                <path d={linePath(ideaTrend)} stroke="#a855f7" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                <path d={linePath(taskTrend)} stroke="#f59e0b" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                {hoverTrendIndex !== null && (
                                    <g>
                                        {(() => {
                                            const step = innerWidth / (trendDays - 1 || 1);
                                            const x = margin.left + hoverTrendIndex * step;
                                            const taskVal = taskTrend[hoverTrendIndex]?.value ?? 0;
                                            const ideaVal = ideaTrend[hoverTrendIndex]?.value ?? 0;
                                            const yTask = margin.top + innerHeight - (taskVal / maxTrendValue) * innerHeight;
                                            const yIdea = margin.top + innerHeight - (ideaVal / maxTrendValue) * innerHeight;
                                            return (
                                                <>
                                                    <line x1={x} x2={x} y1={margin.top} y2={margin.top + innerHeight} stroke="#cbd5e1" strokeDasharray="4 4" />
                                                    <circle cx={x} cy={yIdea} r={5} fill="#a855f7" stroke="#fff" strokeWidth={1.5} />
                                                    <circle cx={x} cy={yTask} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
                                                </>
                                            );
                                        })()}
                                    </g>
                                )}
                            </svg>
                            <div className="flex items-center gap-4 mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-amber-500"></span>Tasks</div>
                                <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-purple-500"></span>Ideas</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-gray-900 dark:text-white text-lg font-bold">Recent Projects</h3>
                            <Link to="/projects" className="text-black dark:text-white text-sm font-bold hover:underline">View All</Link>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {loading ? (
                                <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
                            ) : recentProjects.length === 0 ? (
                                <div className="px-6 py-8 text-center text-gray-500">No projects found.</div>
                            ) : recentProjects.map((proj, i) => (
                                <Link
                                    to={`/project/${proj.id}`}
                                    key={i}
                                    className="group flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    <div className="size-11 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-black dark:text-white font-bold uppercase shrink-0 overflow-hidden">
                                        {proj.squareIcon ? (
                                            <img src={proj.squareIcon} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span>{proj.title.substring(0,2)}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900 dark:text-white line-clamp-1">{proj.title}</span>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                                {proj.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{proj.description || 'No description provided.'}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                                                <div className="h-2 rounded-full bg-black dark:bg-white transition-all" style={{ width: `${proj.progress || 0}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-10 text-right">{proj.progress || 0}%</span>
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-black dark:text-white px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 group-hover:border-black dark:group-hover:border-white shrink-0">
                                        Open
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.12em]">Project mix</p>
                            <span className="text-xs text-slate-500">{stats.activeProjects + stats.completedProjects} tracked</span>
                        </div>
                        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${statusBreakdown.activePct}%` }}></div>
                            <div className="h-full bg-emerald-500" style={{ width: `${statusBreakdown.completedPct}%` }}></div>
                            <div className="h-full bg-amber-400" style={{ width: `${statusBreakdown.otherPct}%` }}></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300 mt-3">
                            <div className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500"></span>Active {statusBreakdown.activePct}%</div>
                            <div className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500"></span>Completed {statusBreakdown.completedPct}%</div>
                            <div className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400"></span>Other {statusBreakdown.otherPct}%</div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.12em]">Activity feed</p>
                            <Link to="/projects" className="text-xs text-slate-500 hover:text-slate-800">View all</Link>
                        </div>
                        <div className="space-y-3">
                            {activityFeed.length === 0 && <div className="text-sm text-slate-500">No recent activity.</div>}
                            {activityFeed.map((item) => (
                                <Link
                                    to={item.projectId ? `/project/${item.projectId}` : '/projects'}
                                    key={item.id}
                                    className="flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl p-2 transition-colors"
                                >
                                    <div className={`size-8 rounded-xl flex items-center justify-center text-sm font-bold ${item.type === 'task' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                                        <span className="material-symbols-outlined text-base">{item.type === 'task' ? 'check_circle' : 'lightbulb'}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">{item.title}</p>
                                        <p className="text-xs text-slate-500">{item.type === 'task' ? 'Task updated' : 'Idea added'}</p>
                                    </div>
                                    <span className="text-[11px] text-slate-400">{new Date(item.timestamp || Date.now()).toLocaleDateString()}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
