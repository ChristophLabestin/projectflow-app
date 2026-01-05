import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { auth } from '../services/firebase';
import { getUserProjects, getSharedProjects, getUserTasks, getUserIdeas, getUserIssues, getUserGlobalActivities, getUserProfile, updateUserData, getProjectMembers } from '../services/dataService';
import { Project, Task, Idea, Issue, Activity, Member } from '../types';
import { toMillis, toDate } from '../utils/time';
import { Button } from '../components/common/Button/Button';
import { Card } from '../components/common/Card/Card';
import { Badge } from '../components/common/Badge/Badge';
import { Sparkline } from '../components/charts/Sparkline';
import { DonutChart } from '../components/charts/DonutChart';
import { ScheduledTasksCard } from '../components/dashboard/ScheduledTasksCard';
import { LatestMilestoneCard } from '../components/dashboard/LatestMilestoneCard';
import { calculateProjectHealth, calculateWorkspaceHealth, ProjectHealth } from '../services/healthService';
import { WorkspaceHealthCard } from '../components/dashboard/WorkspaceHealthCard';
import { HealthIndicator } from '../components/project/HealthIndicator';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { OnboardingWelcomeModal } from '../components/onboarding/OnboardingWelcomeModal';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { useLanguage } from '../context/LanguageContext';
import { checkPasskeyExists } from '../services/passkeyService';
import { PasskeySetupModal } from '../components/modals/PasskeySetupModal';
import './dashboard.scss';

const formatShortDate = (date: any, dateFormat: string, dateLocale: any) => {
    const d = toDate(date);
    if (!d) return '';
    return format(d, dateFormat, { locale: dateLocale });
};

const REVIEW_STAGES = new Set(['Review', 'Submit']);
const TASK_STATUS_ORDER = ['In Progress', 'Review', 'Blocked', 'Todo', 'Open', 'Backlog', 'On Hold'];
const TASK_STATUS_COLORS: Record<string, string> = {
    'In Progress': '#6366f1',
    'Review': '#f59e0b',
    'Blocked': '#ef4444',
    'Todo': '#0ea5e9',
    'Open': '#3b82f6',
    'Backlog': '#94a3b8',
    'On Hold': '#64748b',
    'Done': '#10b981'
};

const MemberAvatars: React.FC<{ projectId: string }> = ({ projectId }) => {
    const { t } = useLanguage();
    const [members, setMembers] = useState<Member[]>([]);

    useEffect(() => {
        const fetchMembers = async () => {
            // Fetch logic
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

    const avatarStyle = {
        width: '1.75rem',
        height: '1.75rem',
        borderRadius: '50%',
        border: '2px solid var(--color-surface-paper)',
        overflow: 'hidden',
        backgroundColor: 'var(--color-surface-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.625rem',
        fontWeight: 'bold',
        color: 'var(--color-text-muted)',
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '0.5rem' }}>
            {members.slice(0, 3).map((member, i) => (
                <div
                    key={member.uid || i}
                    style={{ ...avatarStyle, marginLeft: i > 0 ? '-0.5rem' : 0 }}
                    title={member.displayName || t('dashboard.members.member')}
                >
                    {member.photoURL ? (
                        <img src={member.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div>
                            {((member.displayName || member.email || t('dashboard.members.unknown')).charAt(0)).toUpperCase()}
                        </div>
                    )}
                </div>
            ))}
            {members.length > 3 && (
                <div style={{ ...avatarStyle, marginLeft: '-0.5rem' }}>
                    +{members.length - 3}
                </div>
            )}
        </div>
    );
};

export const Dashboard = () => {
    const { t, language, dateFormat, dateLocale } = useLanguage();
    const [userName, setUserName] = useState<string>('');
    const [greeting, setGreeting] = useState<string>(() => t('dashboard.greeting.default'));
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
        const saved = localStorage.getItem('dashboard_calendar_view');
        return (saved === 'week' || saved === 'month') ? saved : 'month';
    });
    const [trendRange, setTrendRange] = useState<'7d' | '30d' | 'all'>('7d');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [hoverTrendIndex, setHoverTrendIndex] = useState<number | null>(null);
    const trendRef = useRef<SVGSVGElement | null>(null);

    const hasIssuesModule = useMemo(() => projects.some(p => p.modules?.includes('issues')), [projects]);
    const hasMilestonesModule = useMemo(() => projects.some(p => p.modules?.includes('milestones')), [projects]);

    const onboardingSteps = useMemo<OnboardingStep[]>(() => {
        // ... preserved onboarding steps ...
        const steps: OnboardingStep[] = [
            { id: 'header', targetId: 'dashboard-header', title: t('onboarding.dashboard.steps.header.title'), description: t('onboarding.dashboard.steps.header.description') },
            { id: 'kpis', targetId: 'dashboard-kpis', title: t('onboarding.dashboard.steps.kpis.title'), description: t('onboarding.dashboard.steps.kpis.description') },
            { id: 'trends', targetId: 'dashboard-trends', title: t('onboarding.dashboard.steps.trends.title'), description: t('onboarding.dashboard.steps.trends.description'), placement: 'top' },
            { id: 'health', targetId: 'dashboard-health', title: t('onboarding.dashboard.steps.health.title'), description: t('onboarding.dashboard.steps.health.description'), placement: 'top' },
            { id: 'status', targetId: 'dashboard-status', title: t('onboarding.dashboard.steps.status.title'), description: t('onboarding.dashboard.steps.status.description'), placement: 'left' },
            { id: 'projects', targetId: 'dashboard-active-projects', title: t('onboarding.dashboard.steps.projects.title'), description: t('onboarding.dashboard.steps.projects.description') },
            { id: 'calendar', targetId: 'dashboard-calendar', title: t('onboarding.dashboard.steps.calendar.title'), description: t('onboarding.dashboard.steps.calendar.description'), placement: 'left' },
            { id: 'scheduled', targetId: 'dashboard-scheduled', title: t('onboarding.dashboard.steps.scheduled.title'), description: t('onboarding.dashboard.steps.scheduled.description'), placement: 'left' },
            { id: 'activity', targetId: 'dashboard-live-activity', title: t('onboarding.dashboard.steps.activity.title'), description: t('onboarding.dashboard.steps.activity.description'), placement: 'left' },
        ];
        return steps;
    }, [t]);

    const { showWelcome: showOnboardingWelcome, onboardingActive, stepIndex: onboardingStepIndex, setStepIndex: setOnboardingStepIndex, start: handleStartOnboarding, skip: handleSkipOnboarding, finish: handleFinishOnboarding } = useOnboardingTour('dashboard', { stepCount: onboardingSteps.length, enabled: !loading });

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting(t('dashboard.greeting.morning'));
        else if (hour < 18) setGreeting(t('dashboard.greeting.afternoon'));
        else setGreeting(t('dashboard.greeting.evening'));
    }, [t]);

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
                // ... data loading logic preserved ...
                const userProjects = await getUserProjects();
                const sharedProjects = await getSharedProjects().catch(e => []);
                const allProjects = [...userProjects];
                sharedProjects.forEach(sp => { if (!allProjects.find(p => p.id === sp.id)) allProjects.push(sp); });
                const tasks = await getUserTasks();
                const ideas = await getUserIdeas();
                const issues = await getUserIssues();
                setProjects(allProjects);
                setTasks(tasks);
                setIdeas(ideas);
                setIssues(issues);
                setActivities(await getUserGlobalActivities(auth.currentUser?.uid, 6));

                if (auth.currentUser?.uid) {
                    const profile = await getUserProfile(auth.currentUser.uid);
                    if (profile?.preferences?.dashboard?.calendarView) {
                        setCalendarView(profile.preferences.dashboard.calendarView);
                    }
                }

                setStats({
                    activeProjects: allProjects.filter(p => p.status === 'Active').length,
                    completedProjects: allProjects.filter(p => p.status === 'Completed').length,
                    openTasks: tasks.filter(t => !t.isCompleted).length,
                    ideas: ideas.length
                });

                const sortedProjects = [...allProjects].filter(p => p.status !== 'On Hold' && p.status !== 'Planning').sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
                setRecentProjects(sortedProjects.slice(0, 4));

                if (auth.currentUser?.displayName) setUserName(auth.currentUser.displayName.split(' ')[0]);

            } catch (error) { console.error('Dashboard load failed', error); } finally { setLoading(false); }
        };
        loadDashboard();
    }, []);

    const trendDays = trendRange === '7d' ? 7 : trendRange === '30d' ? 30 : 90; // Approx 90 for 'all'
    const taskTrend = useMemo(() => bucketByDay(tasks, trendDays), [tasks, trendDays]);
    const ideaTrend = useMemo(() => bucketByDay(ideas, trendDays), [ideas, trendDays]);
    const issueTrend = useMemo(() => bucketByDay(issues, trendDays), [issues, trendDays]);

    const weekdays = useMemo(() => t('dashboard.calendar.weekdays').split(','), [t]);
    const projectStatusLabels = useMemo(() => ({ Active: t('dashboard.projectStatus.active'), Completed: t('dashboard.projectStatus.completed'), Planning: t('dashboard.projectStatus.planning'), 'On Hold': t('dashboard.projectStatus.onHold'), Brainstorming: t('dashboard.projectStatus.brainstorming') }), [t]);

    // Distributions
    const projectStatusDistribution = useMemo(() => {
        const active = projects.filter(p => p.status === 'Active').length;
        const completed = projects.filter(p => p.status === 'Completed').length;
        const planning = projects.filter(p => p.status === 'Planning').length;
        const onHold = projects.filter(p => p.status === 'On Hold').length;
        return [{ name: projectStatusLabels.Active, value: active, color: '#6366f1' }, { name: projectStatusLabels.Completed, value: completed, color: '#10b981' }, { name: projectStatusLabels.Planning, value: planning, color: '#f59e0b' }, { name: projectStatusLabels['On Hold'], value: onHold, color: '#94a3b8' }].filter(d => d.value > 0);
    }, [projects, projectStatusLabels]);

    const taskStatusSummary = useMemo(() => {
        const openTasks = tasks.filter(task => !task.isCompleted && task.status !== 'Done');
        const counts: Record<string, number> = {};
        openTasks.forEach(task => { const status = task.status || 'Open'; counts[status] = (counts[status] || 0) + 1; });
        const remaining = Object.keys(counts).filter(status => !TASK_STATUS_ORDER.includes(status));
        const items = [...TASK_STATUS_ORDER, ...remaining].map(status => ({ status, count: counts[status] || 0 })).filter(item => item.count > 0);
        return { items, total: openTasks.length };
    }, [tasks]);

    // Data maps
    const tasksByProject = useMemo(() => { const map: Record<string, Task[]> = {}; tasks.forEach(task => { if (!map[task.projectId]) map[task.projectId] = []; map[task.projectId].push(task); }); return map; }, [tasks]);
    const issuesByProject = useMemo(() => { const map: Record<string, Issue[]> = {}; issues.forEach(issue => { if (!map[issue.projectId]) map[issue.projectId] = []; map[issue.projectId].push(issue); }); return map; }, [issues]);
    const projectHealthMap = useMemo(() => { const healthMap: Record<string, ProjectHealth> = {}; projects.forEach(project => { healthMap[project.id] = calculateProjectHealth(project, tasksByProject[project.id] || [], [], issuesByProject[project.id] || []); }); return healthMap; }, [projects, tasksByProject, issuesByProject]);
    const projectsAtRisk = useMemo(() => { return projects.filter(project => project.status !== 'Completed').map(project => ({ project, health: projectHealthMap[project.id] })).filter(entry => entry.health.status === 'warning' || entry.health.status === 'critical').sort((a, b) => a.health.score - b.health.score).slice(0, 3); }, [projects, projectHealthMap]);
    const workspaceHealth = useMemo(() => { return calculateWorkspaceHealth(projects.filter(p => p.status !== 'Completed'), projectHealthMap); }, [projects, projectHealthMap]);

    // Display stuff
    const displayActivities = useMemo(() => {
        // ... activity logic ...
        const synthetic: Activity[] = [];
        tasks.slice(0, 10).forEach(task => { if (task.createdAt) synthetic.push({ id: `syn-task-c-${task.id}`, type: 'task', action: t('dashboard.activity.actions.createdTask'), target: task.title, user: t('dashboard.activity.you'), userAvatar: auth.currentUser?.photoURL || '', createdAt: task.createdAt, projectId: task.projectId } as any); if (task.isCompleted) synthetic.push({ id: `syn-task-d-${task.id}`, type: 'task', action: t('dashboard.activity.actions.completedTask'), target: task.title, user: t('dashboard.activity.you'), userAvatar: auth.currentUser?.photoURL || '', createdAt: task.createdAt, projectId: task.projectId } as any); });
        ideas.slice(0, 10).forEach(idea => { if (idea.createdAt) synthetic.push({ id: `syn-idea-${idea.id}`, type: 'idea', action: t('dashboard.activity.actions.capturedFlow'), target: idea.title, user: t('dashboard.activity.you'), userAvatar: auth.currentUser?.photoURL || '', createdAt: idea.createdAt, projectId: idea.projectId } as any); });
        return [...activities, ...synthetic].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)).slice(0, 6);
    }, [activities, tasks, ideas, t]);

    const dueSoonCount = useMemo(() => { const now = Date.now(); const soonWindow = 3 * 24 * 60 * 60 * 1000; return tasks.filter(task => !task.isCompleted).filter((task) => { const due = toDate(task.dueDate); if (!due) return false; return due.getTime() <= now + soonWindow; }).length; }, [tasks]);
    const ideasThisWeek = useMemo(() => ideaTrend.reduce((sum, day) => sum + day.value, 0), [ideaTrend]);

    const focusMetrics = useMemo(() => {
        // ...
        const overdueTasks = tasks.filter(task => { if (task.isCompleted) return false; const due = toDate(task.dueDate); return due ? due.getTime() < new Date().setHours(0, 0, 0, 0) : false; });
        const dueTodayTasks = tasks.filter(task => { if (task.isCompleted) return false; const due = toDate(task.dueDate); if (!due) return false; const s = new Date(); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setDate(s.getDate() + 1); return due.getTime() >= s.getTime() && due.getTime() < e.getTime(); });
        const blockedTasks = tasks.filter(task => !task.isCompleted && task.status === 'Blocked');
        const myOpenTasks = auth.currentUser?.uid ? tasks.filter(task => !task.isCompleted && (task.assigneeId === auth.currentUser?.uid || task.assigneeIds?.includes(auth.currentUser?.uid))) : [];
        const reviewIdeas = ideas.filter(idea => REVIEW_STAGES.has(idea.stage));
        const urgentTasks = tasks.filter(task => !task.isCompleted && task.priority === 'Urgent');
        const urgentIssues = issues.filter(issue => issue.priority === 'Urgent' && issue.status !== 'Resolved');

        const items = [
            { key: 'overdue', label: t('dashboard.focus.overdue'), value: overdueTasks.length, icon: 'event_busy', color: 'text-rose-500' },
            { key: 'dueToday', label: t('dashboard.focus.dueToday'), value: dueTodayTasks.length, icon: 'today', color: 'text-amber-500' },
            { key: 'blocked', label: t('dashboard.focus.blocked'), value: blockedTasks.length, icon: 'block', color: 'text-orange-500' },
            { key: 'assigned', label: t('dashboard.focus.assignedToMe'), value: myOpenTasks.length, icon: 'person', color: 'text-indigo-500' },
            { key: 'review', label: t('dashboard.focus.reviewFlows'), value: reviewIdeas.length, icon: 'rate_review', color: 'text-blue-500' }
        ];
        if (hasIssuesModule) items.push({ key: 'urgentIssues', label: t('dashboard.focus.urgentIssues'), value: urgentIssues.length, icon: 'report', color: 'text-rose-500' });
        else items.push({ key: 'urgentTasks', label: t('dashboard.focus.urgentTasks'), value: urgentTasks.length, icon: 'priority_high', color: 'text-rose-500' });
        return items;
    }, [hasIssuesModule, ideas, issues, tasks, t]);

    // Chart helpers
    const chartOuterWidth = 720;
    const chartOuterHeight = 240;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerWidth = chartOuterWidth - margin.left - margin.right;
    const innerHeight = chartOuterHeight - margin.top - margin.bottom;
    const maxTrendValue = useMemo(() => Math.max(...taskTrend.map(v => v.value), ...ideaTrend.map(v => v.value), hasIssuesModule ? Math.max(...issueTrend.map(v => v.value)) : 0, 1), [taskTrend, ideaTrend, issueTrend, hasIssuesModule]);
    const getSmoothPath = (data: { value: number }[]) => {
        if (!data.length) return '';
        const max = maxTrendValue || 1;
        const step = innerWidth / (Math.max(data.length, trendDays) - 1 || 1);
        const points = data.map((d, i) => ({ x: margin.left + i * step, y: margin.top + innerHeight - (d.value / max) * innerHeight }));
        if (points.length < 2) return '';
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i]; const p1 = points[i + 1]; const cp1x = p0.x + (p1.x - p0.x) * 0.5; const cp1y = p0.y; const cp2x = p0.x + (p1.x - p0.x) * 0.5; const cp2y = p1.y; d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
        }
        return d;
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

    const toggleCalendarView = async () => {
        const newView = calendarView === 'month' ? 'week' : 'month';
        setCalendarView(newView);
        localStorage.setItem('dashboard_calendar_view', newView);
        setCurrentDate(new Date());
        if (auth.currentUser?.uid) await updateUserData(auth.currentUser.uid, { 'preferences.dashboard.calendarView': newView });
    };

    const handlePrevDate = () => { const newDate = new Date(currentDate); if (calendarView === 'month') newDate.setMonth(newDate.getMonth() - 1); else newDate.setDate(newDate.getDate() - 7); setCurrentDate(newDate); };
    const handleNextDate = () => { const newDate = new Date(currentDate); if (calendarView === 'month') newDate.setMonth(newDate.getMonth() + 1); else newDate.setDate(newDate.getDate() + 7); setCurrentDate(newDate); };

    // KPI Cards
    const kpiCards = [
        { key: 'active', label: t('dashboard.kpi.activeProjects'), value: stats.activeProjects, icon: 'folder_open', series: taskTrend, color: '#6366f1', caption: t('dashboard.kpi.caption.totalTracked').replace('{count}', String(projects.length)) },
        { key: 'completed', label: t('dashboard.kpi.completed'), value: stats.completedProjects, icon: 'check_circle', series: ideaTrend, color: '#10b981', caption: t('dashboard.kpi.caption.completionRate').replace('{rate}', String(Math.round((stats.completedProjects / (projects.length || 1)) * 100))) },
        { key: 'tasks', label: t('dashboard.kpi.openTasks'), value: stats.openTasks, icon: 'check_box', series: taskTrend, color: '#f59e0b', caption: t('dashboard.kpi.caption.dueSoon').replace('{count}', String(dueSoonCount)) },
        { key: 'ideas', label: t('dashboard.kpi.flowsCaptured'), value: stats.ideas, icon: 'lightbulb', series: ideaTrend, color: '#3b82f6', caption: t('dashboard.kpi.caption.thisWeek').replace('{count}', String(ideasThisWeek)) }
    ];

    if (loading) return <div className="flex items-center justify-center p-12"><span className="material-symbols-outlined animate-spin text-3xl text-subtle">rotate_right</span></div>;

    return (
        <div className="dashboard">
            <div data-onboarding-id="dashboard-header" className="dashboard__header">
                <div className="dashboard__header-info">
                    <div className="dashboard__header-date">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                        {format(new Date(), dateFormat, { locale: dateLocale })}
                    </div>
                    <h1 className="dashboard__header-title">{greeting}, {userName || t('dashboard.userFallback')}.</h1>
                    <p className="dashboard__header-subtitle">{t('dashboard.header.subtitle')}</p>
                </div>
                <div className="dashboard__header-stats">
                    <div className="dashboard__stat-box">
                        <div className="dashboard__stat-box-value dashboard__stat-box-value--default">{stats.activeProjects}</div>
                        <div className="dashboard__stat-box-label">{t('dashboard.header.stats.activeProjects')}</div>
                    </div>
                    <div className="dashboard__stat-box">
                        <div className="dashboard__stat-box-value dashboard__stat-box-value--amber">{dueSoonCount}</div>
                        <div className="dashboard__stat-box-label">{t('dashboard.header.stats.dueSoon')}</div>
                    </div>
                    <div className="dashboard__stat-box">
                        <div className="dashboard__stat-box-value dashboard__stat-box-value--emerald">{stats.completedProjects}</div>
                        <div className="dashboard__stat-box-label">{t('dashboard.header.stats.completed')}</div>
                    </div>
                </div>
            </div>

            <div className="dashboard__grid">
                <div className="dashboard__main">
                    <div data-onboarding-id="dashboard-kpis" className="dashboard__kpis">
                        {kpiCards.map((stat) => (
                            <Card key={stat.key} className="dashboard__kpi-card dashboard__card--padded" style={{ borderLeftColor: stat.color }}>
                                <div className="dashboard__kpi-card-content">
                                    <div className="dashboard__kpi-card-header">
                                        <div>
                                            <p className="dashboard__kpi-card-label">{stat.label}</p>
                                            <h3 className="dashboard__kpi-card-value">{stat.value}</h3>
                                        </div>
                                        <div className="dashboard__kpi-card-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                                            <span className="material-symbols-outlined">{stat.icon}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <Sparkline data={stat.series.map(s => s.value)} width={140} height={30} color={stat.color} fill={true} />
                                        <p className="dashboard__kpi-card-caption">{stat.caption}</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <div className="dashboard__section-grid dashboard__section-grid--2-1">
                        <Card className="dashboard__card dashboard__card--padded dashboard__card--col-span-2">
                            <div className="dashboard__h3" style={{ marginBottom: '1rem' }}>{t('dashboard.focus.title')}</div>
                            <div className="dashboard__focus-grid">
                                {focusMetrics.map(metric => (
                                    <div key={metric.key} className="dashboard__focus-item">
                                        <div className="dashboard__focus-item-header">
                                            <span className="dashboard__focus-item-label">{metric.label}</span>
                                            <span className={`material-symbols-outlined text-sm ${metric.color}`}>{metric.icon}</span>
                                        </div>
                                        <div className={`dashboard__focus-item-value ${metric.value > 0 ? 'dashboard__focus-item-value--active' : 'dashboard__focus-item-value--inactive'}`}>
                                            {metric.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <Card className="dashboard__card dashboard__card--padded">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 className="dashboard__h4">{t('dashboard.risk.title')}</h3>
                                    <Link to="/projects" className="dashboard__link">{t('dashboard.risk.viewAll')}</Link>
                                </div>
                                <div className="dashboard__risk-list">
                                    {projectsAtRisk.length === 0 ? (
                                        <div className="dashboard__empty-state">{t('dashboard.risk.empty')}</div>
                                    ) : (
                                        projectsAtRisk.map(({ project, health }) => (
                                            <Link key={project.id} to={`/project/${project.id}`} className="dashboard__risk-item">
                                                <HealthIndicator health={health} size="sm" showLabel={false} />
                                                <div className="dashboard__risk-item-content">
                                                    <div className="dashboard__risk-item-title">{project.title}</div>
                                                    <div className="dashboard__risk-item-meta">
                                                        <span>{t('dashboard.risk.openTasks').replace('{count}', String((tasksByProject[project.id]?.filter(t => !t.isCompleted).length || 0)))}</span>
                                                    </div>
                                                </div>
                                                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--color-text-subtle)' }}>chevron_right</span>
                                            </Link>
                                        ))
                                    )}
                                </div>
                            </Card>

                            {/* Task Status Snapshot Card - Restored */}
                            <Card className="dashboard__card dashboard__card--padded">
                                <div className="dashboard__h4" style={{ marginBottom: '1rem' }}>Task Status</div>
                                <div className="space-y-3">
                                    {taskStatusSummary.items.map(item => (
                                        <div key={item.status} className="flex flex-col gap-1">
                                            <div className="flex justify-between text-xs font-semibold uppercase text-subtle">
                                                <span>{item.status}</span>
                                                <span className="text-main">{item.count}</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ width: `${(item.count / taskStatusSummary.total) * 100}%`, backgroundColor: TASK_STATUS_COLORS[item.status] || '#94a3b8' }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {taskStatusSummary.items.length === 0 && <div className="text-subtle text-sm text-center py-2">No tasks found</div>}
                                </div>
                            </Card>
                        </div>
                    </div>

                    <Card data-onboarding-id="dashboard-trends" className="dashboard__card dashboard__card--no-padding" style={{ overflow: 'hidden' }}>
                        <div className="dashboard__chart-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>trending_up</span>
                                <h3 className="dashboard__h3">{t('dashboard.trends.title')}</h3>
                            </div>
                            <div style={{ display: 'flex', background: 'var(--color-surface-hover)', padding: '0.125rem', borderRadius: '0.5rem' }}>
                                {(['7d', '30d', 'all'] as const).map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setTrendRange(range)}
                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', borderRadius: '0.375rem', transition: 'all 0.2s', border: 'none', background: trendRange === range ? 'var(--color-surface-paper)' : 'transparent', color: trendRange === range ? 'var(--color-text-main)' : 'var(--color-text-subtle)', boxShadow: trendRange === range ? 'var(--shadow-sm)' : 'none', cursor: 'pointer' }}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="dashboard__chart-body" style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}><span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#f59e0b' }} /> {t('dashboard.trends.tasks')}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}><span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#3b82f6' }} /> {t('dashboard.trends.ideas')}</div>
                                    {hasIssuesModule && <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}><span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#f43f5e' }} /> {t('dashboard.trends.issues')}</div>}
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-subtle)' }}>
                                    PEAK: {maxTrendValue}
                                </div>
                            </div>
                            <div className="h-[200px] relative">
                                <svg ref={trendRef} viewBox={`0 0 ${chartOuterWidth} ${chartOuterHeight}`} className="w-full h-full select-none" onMouseMove={handleTrendMove} onMouseLeave={() => setHoverTrendIndex(null)} preserveAspectRatio="xMidYMid meet">
                                    <defs>
                                        <linearGradient id="area-tasks" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0" /></linearGradient>
                                        <linearGradient id="area-ideas" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
                                        <linearGradient id="area-issues" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" /><stop offset="100%" stopColor="#f43f5e" stopOpacity="0" /></linearGradient>
                                    </defs>
                                    <path d={`${getSmoothPath(taskTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#area-tasks)" />
                                    <path d={`${getSmoothPath(ideaTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#area-ideas)" />
                                    {hasIssuesModule && <path d={`${getSmoothPath(issueTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#area-issues)" />}
                                    <path d={getSmoothPath(ideaTrend)} stroke="#3b82f6" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    {hasIssuesModule && <path d={getSmoothPath(issueTrend)} stroke="#f43f5e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                                    <path d={getSmoothPath(taskTrend)} stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                    </Card>

                    <div data-onboarding-id="dashboard-active-projects">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3 className="dashboard__h3">{t('dashboard.projects.title')}</h3>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <Link to="/projects" className="dashboard__link">{t('dashboard.projects.viewAll')}</Link>
                                <Link to="/create"><Button size="sm" icon={<span className="material-symbols-outlined">add</span>}>{t('dashboard.projects.newProject')}</Button></Link>
                            </div>
                        </div>
                        <div className="dashboard__project-grid">
                            {recentProjects.length === 0 ? (
                                <div className="dashboard__card dashboard__card--padded dashboard__card--col-span-3 dashboard__empty-state"><span className="material-symbols-outlined dashboard__empty-state-icon">post_add</span><p>{t('dashboard.projects.empty.title')}</p></div>
                            ) : (
                                recentProjects.slice(0, 3).map((proj) => {
                                    const projTasks = tasks.filter((t) => t.projectId === proj.id);
                                    const completed = projTasks.filter((t) => t.isCompleted).length;
                                    const pct = projTasks.length > 0 ? Math.round((completed / projTasks.length) * 100) : (proj.progress || 0);
                                    return (
                                        <Link key={proj.id} to={`/project/${proj.id}`} style={{ display: 'block', height: '100%' }}>
                                            <Card className="dashboard__project-card dashboard__card--no-padding">
                                                <div className="dashboard__project-card-cover">
                                                    {proj.coverImage ? <img src={proj.coverImage} alt="" /> : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))' }} />}
                                                </div>
                                                <div className="dashboard__project-card-content">
                                                    <div className="dashboard__project-card-icon">{proj.squareIcon ? <img src={proj.squareIcon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="material-symbols-outlined">folder</span>}</div>
                                                    <h3 className="dashboard__h3" style={{ marginBottom: '0.5rem' }}>{proj.title}</h3>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem', flex: 1 }}>{proj.description}</p>
                                                    <div style={{ width: '100%', height: '4px', background: 'var(--color-surface-border)', borderRadius: '2px', marginBottom: '1rem' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '2px' }} /></div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><MemberAvatars projectId={proj.id} /><span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>arrow_forward</span></div>
                                                </div>
                                            </Card>
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="dashboard__sidebar">
                    <Card data-onboarding-id="dashboard-calendar" className="dashboard__card dashboard__card--padded">
                        <div className="dashboard__calendar-header">
                            <h3 className="dashboard__h3">{format(currentDate, 'MMMM yyyy', { locale: dateLocale })}</h3>
                            <div style={{ display: 'flex' }}>
                                <button onClick={handlePrevDate} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0.25rem' }}><span className="material-symbols-outlined">chevron_left</span></button>
                                <button onClick={handleNextDate} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0.25rem' }}><span className="material-symbols-outlined">chevron_right</span></button>
                            </div>
                        </div>
                        <div className="dashboard__calendar-grid">{weekdays.map((d, i) => (<div key={`${d}-${i}`} style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-text-subtle)' }}>{d}</div>))}</div>
                        <div className="dashboard__calendar-grid">
                            {(() => {
                                const todayFull = new Date(); let days = [];
                                if (calendarView === 'month') {
                                    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                                    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() || 7;
                                    const emptyDays = firstDay - 1;
                                    for (let i = 0; i < emptyDays; i++) days.push(<div key={`empty-${i}`} />);
                                    for (let i = 1; i <= daysInMonth; i++) { const thisDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i); const isToday = thisDate.toDateString() === todayFull.toDateString(); days.push(<div key={i} className={`dashboard__calendar-day ${isToday ? 'dashboard__calendar-day--today' : ''}`}>{i}</div>); }
                                } else {
                                    const currentDayOfWeek = currentDate.getDay() || 7; const mondayDate = new Date(currentDate); mondayDate.setDate(currentDate.getDate() - currentDayOfWeek + 1);
                                    for (let i = 0; i < 7; i++) { const d = new Date(mondayDate); d.setDate(mondayDate.getDate() + i); const dayNum = d.getDate(); const isToday = d.toDateString() === todayFull.toDateString(); days.push(<div key={`week-${i}`} className={`dashboard__calendar-day ${isToday ? 'dashboard__calendar-day--today' : ''}`}>{dayNum}</div>); }
                                }
                                return days;
                            })()}
                        </div>
                        <div className="flex p-0.5 bg-surface-hover rounded-md mt-4" style={{ display: 'flex', background: 'var(--color-surface-hover)', padding: '0.25rem', borderRadius: '0.5rem', marginTop: '1rem' }}>
                            <button onClick={() => calendarView !== 'month' && toggleCalendarView()} className={`flex-1 ${calendarView === 'month' ? 'bg-white shadow-sm' : ''}`} style={{ flex: 1, border: 'none', background: calendarView === 'month' ? 'var(--color-surface-paper)' : 'none', padding: '0.25rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', color: calendarView === 'month' ? 'var(--color-text-main)' : 'var(--color-text-subtle)' }}>{t('dashboard.calendar.month')}</button>
                            <button onClick={() => calendarView !== 'week' && toggleCalendarView()} className={`flex-1 ${calendarView === 'week' ? 'bg-white shadow-sm' : ''}`} style={{ flex: 1, border: 'none', background: calendarView === 'week' ? 'var(--color-surface-paper)' : 'none', padding: '0.25rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', color: calendarView === 'week' ? 'var(--color-text-main)' : 'var(--color-text-subtle)' }}>{t('dashboard.calendar.week')}</button>
                        </div>
                    </Card>

                    <div data-onboarding-id="dashboard-scheduled"><ScheduledTasksCard tasks={tasks} issues={issues} /></div>

                    {/* Moved Workspace Health to Sidebar */}
                    <div data-onboarding-id="dashboard-health"><WorkspaceHealthCard health={workspaceHealth} projectCount={projects.length} /></div>

                    {hasMilestonesModule && (<div data-onboarding-id="dashboard-milestones"><LatestMilestoneCard projects={projects} /></div>)}

                    <Card data-onboarding-id="dashboard-live-activity" className="dashboard__card dashboard__card--no-padding">
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="dashboard__h4">{t('dashboard.activity.title')}</h3>
                            <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: 'var(--color-success)' }} />
                        </div>
                        <div style={{ padding: '0.5rem' }}>
                            {displayActivities.length === 0 ? <div className="dashboard__empty-state">{t('dashboard.activity.empty')}</div> : displayActivities.map(item => (
                                <div key={item.id} className="dashboard__activity-item">
                                    {item.userAvatar ? <img src={item.userAvatar} alt="" className="dashboard__activity-item-avatar" /> : <div className="dashboard__activity-item-avatar" style={{ background: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>{(item.user || '?').charAt(0)}</div>}
                                    <div className="dashboard__activity-item-content">
                                        <span style={{ fontWeight: 600 }}>{item.user}</span> <span style={{ color: 'var(--color-text-muted)' }}>{item.action}</span>
                                        <div style={{ color: 'var(--color-text-main)', marginTop: '0.125rem' }}>{item.target}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>{item.createdAt ? format(new Date(toMillis(item.createdAt)), 'p', { locale: dateLocale }) : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            <OnboardingWelcomeModal isOpen={showOnboardingWelcome} title={t('onboarding.dashboard.welcome.title')} description={t('onboarding.dashboard.welcome.description')} onStart={handleStartOnboarding} onSkip={handleSkipOnboarding} />
            <OnboardingOverlay isOpen={onboardingActive} steps={onboardingSteps} stepIndex={onboardingStepIndex} onStepChange={setOnboardingStepIndex} onFinish={handleFinishOnboarding} onSkip={handleSkipOnboarding} />
            <PasskeySetupModal isOpen={false} onClose={() => { }} onSetupComplete={() => { }} />
        </div>
    );
};
