import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
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
import { calculateProjectHealth, calculateWorkspaceHealth, ProjectHealth } from '../services/healthService';
import { WorkspaceHealthCard } from '../components/dashboard/WorkspaceHealthCard';
import { HealthIndicator } from '../components/project/HealthIndicator';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { OnboardingWelcomeModal } from '../components/onboarding/OnboardingWelcomeModal';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { useLanguage } from '../context/LanguageContext';
import { checkPasskeyExists } from '../services/passkeyService';
import { PasskeySetupModal } from '../components/modals/PasskeySetupModal';


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
                    title={member.displayName || t('dashboard.members.member')}
                >
                    {member.photoURL ? (
                        <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">
                            {((member.displayName || member.email || t('dashboard.members.unknown')).charAt(0)).toUpperCase()}
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
    const { t, language, dateFormat, dateLocale } = useLanguage();
    const locale = language === 'de' ? 'de-DE' : 'en-US';
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
        // Init from localStorage if available
        const saved = localStorage.getItem('dashboard_calendar_view');
        return (saved === 'week' || saved === 'month') ? saved : 'month';
    });
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [hoverTrendIndex, setHoverTrendIndex] = useState<number | null>(null);
    const trendRef = useRef<SVGSVGElement | null>(null);

    const hasIssuesModule = useMemo(() => projects.some(p => p.modules?.includes('issues')), [projects]);
    const hasMilestonesModule = useMemo(() => projects.some(p => p.modules?.includes('milestones')), [projects]);

    const onboardingSteps = useMemo<OnboardingStep[]>(() => {
        const steps: OnboardingStep[] = [
            {
                id: 'header',
                targetId: 'dashboard-header',
                title: t('onboarding.dashboard.steps.header.title'),
                description: t('onboarding.dashboard.steps.header.description')
            },
            {
                id: 'kpis',
                targetId: 'dashboard-kpis',
                title: t('onboarding.dashboard.steps.kpis.title'),
                description: t('onboarding.dashboard.steps.kpis.description')
            },
            {
                id: 'trends',
                targetId: 'dashboard-trends',
                title: t('onboarding.dashboard.steps.trends.title'),
                description: t('onboarding.dashboard.steps.trends.description'),
                placement: 'top'
            },
            {
                id: 'health',
                targetId: 'dashboard-health',
                title: t('onboarding.dashboard.steps.health.title'),
                description: t('onboarding.dashboard.steps.health.description'),
                placement: 'top'
            },
            {
                id: 'status',
                targetId: 'dashboard-status',
                title: t('onboarding.dashboard.steps.status.title'),
                description: t('onboarding.dashboard.steps.status.description'),
                placement: 'left'
            },
            {
                id: 'workload',
                targetId: 'dashboard-workload',
                title: t('onboarding.dashboard.steps.workload.title'),
                description: t('onboarding.dashboard.steps.workload.description'),
                placement: 'top'
            },
            {
                id: 'deadlines',
                targetId: 'dashboard-deadlines',
                title: t('onboarding.dashboard.steps.deadlines.title'),
                description: t('onboarding.dashboard.steps.deadlines.description'),
                placement: 'top'
            },
            {
                id: 'projects',
                targetId: 'dashboard-active-projects',
                title: t('onboarding.dashboard.steps.projects.title'),
                description: t('onboarding.dashboard.steps.projects.description')
            },
            {
                id: 'calendar',
                targetId: 'dashboard-calendar',
                title: t('onboarding.dashboard.steps.calendar.title'),
                description: t('onboarding.dashboard.steps.calendar.description'),
                placement: 'left'
            },
            {
                id: 'scheduled',
                targetId: 'dashboard-scheduled',
                title: t('onboarding.dashboard.steps.scheduled.title'),
                description: t('onboarding.dashboard.steps.scheduled.description'),
                placement: 'left'
            }
        ];

        if (hasMilestonesModule) {
            steps.push({
                id: 'milestones',
                targetId: 'dashboard-milestones',
                title: t('onboarding.dashboard.steps.milestones.title'),
                description: t('onboarding.dashboard.steps.milestones.description'),
                placement: 'left'
            });
        }

        steps.push(
            {
                id: 'activity',
                targetId: 'dashboard-live-activity',
                title: t('onboarding.dashboard.steps.activity.title'),
                description: t('onboarding.dashboard.steps.activity.description'),
                placement: 'left'
            },
            {
                id: 'attention',
                targetId: 'dashboard-attention',
                title: t('onboarding.dashboard.steps.attention.title'),
                description: t('onboarding.dashboard.steps.attention.description'),
                placement: 'left'
            },
            {
                id: 'recent',
                targetId: 'dashboard-recent-tasks',
                title: t('onboarding.dashboard.steps.recent.title'),
                description: t('onboarding.dashboard.steps.recent.description'),
                placement: 'left'
            }
        );

        if (hasIssuesModule && issues.length > 0) {
            steps.push({
                id: 'issues',
                targetId: 'dashboard-recent-issues',
                title: t('onboarding.dashboard.steps.issues.title'),
                description: t('onboarding.dashboard.steps.issues.description'),
                placement: 'left'
            });
        }

        return steps;
    }, [hasIssuesModule, hasMilestonesModule, issues.length, t]);

    const {
        showWelcome: showOnboardingWelcome,
        onboardingActive,
        stepIndex: onboardingStepIndex,
        setStepIndex: setOnboardingStepIndex,
        start: handleStartOnboarding,
        skip: handleSkipOnboarding,
        finish: handleFinishOnboarding
    } = useOnboardingTour('dashboard', {
        stepCount: onboardingSteps.length,
        enabled: !loading // Only init tour when data is loaded
    });

    // Quick Add State
    const [quickIdeaText, setQuickIdeaText] = useState('');
    const [addingIdea, setAddingIdea] = useState(false);

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) {
            setGreeting(t('dashboard.greeting.morning'));
        } else if (hour < 18) {
            setGreeting(t('dashboard.greeting.afternoon'));
        } else {
            setGreeting(t('dashboard.greeting.evening'));
        }
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


    const weekdays = useMemo(() => t('dashboard.calendar.weekdays').split(','), [t]);
    const projectStatusLabels = useMemo(() => ({
        Active: t('dashboard.projectStatus.active'),
        Completed: t('dashboard.projectStatus.completed'),
        Planning: t('dashboard.projectStatus.planning'),
        'On Hold': t('dashboard.projectStatus.onHold'),
        Brainstorming: t('dashboard.projectStatus.brainstorming')
    }), [t]);
    const taskStatusLabels = useMemo(() => ({
        Backlog: t('tasks.status.backlog'),
        Todo: t('tasks.status.todo'),
        Open: t('tasks.status.open'),
        'In Progress': t('tasks.status.inProgress'),
        Review: t('tasks.status.review'),
        'On Hold': t('tasks.status.onHold'),
        Blocked: t('tasks.status.blocked'),
        Done: t('tasks.status.done')
    }), [t]);
    const taskPriorityLabels = useMemo(() => ({
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    }), [t]);

    // New Metrics for distribution
    const projectStatusDistribution = useMemo(() => {
        const active = projects.filter(p => p.status === 'Active').length;
        const completed = projects.filter(p => p.status === 'Completed').length;
        const planning = projects.filter(p => p.status === 'Planning').length;
        const onHold = projects.filter(p => p.status === 'On Hold').length;

        // Return structured for Donut
        return [
            { name: projectStatusLabels.Active, value: active, color: '#6366f1' }, // Indigo
            { name: projectStatusLabels.Completed, value: completed, color: '#10b981' }, // Emerald
            { name: projectStatusLabels.Planning, value: planning, color: '#f59e0b' }, // Amber
            { name: projectStatusLabels['On Hold'], value: onHold, color: '#94a3b8' } // Slate
        ].filter(d => d.value > 0);
    }, [projects, projectStatusLabels]);

    const taskPriorityDistribution = useMemo(() => {
        const urgent = tasks.filter(t => !t.isCompleted && t.priority === 'Urgent').length;
        const high = tasks.filter(t => !t.isCompleted && t.priority === 'High').length;
        const medium = tasks.filter(t => !t.isCompleted && t.priority === 'Medium').length;
        const low = tasks.filter(t => !t.isCompleted && t.priority === 'Low').length;

        return [
            { name: taskPriorityLabels.Urgent, value: urgent, color: '#ef4444' },
            { name: taskPriorityLabels.High, value: high, color: '#f97316' },
            { name: taskPriorityLabels.Medium, value: medium, color: '#3b82f6' },
            { name: taskPriorityLabels.Low, value: low, color: '#94a3b8' }
        ].filter(d => d.value > 0);
    }, [tasks, taskPriorityLabels]);

    const taskStatusSummary = useMemo(() => {
        const openTasks = tasks.filter(task => !task.isCompleted && task.status !== 'Done');
        const counts: Record<string, number> = {};
        openTasks.forEach(task => {
            const status = task.status || 'Open';
            counts[status] = (counts[status] || 0) + 1;
        });
        const remaining = Object.keys(counts).filter(status => !TASK_STATUS_ORDER.includes(status));
        const items = [...TASK_STATUS_ORDER, ...remaining]
            .map(status => ({ status, count: counts[status] || 0 }))
            .filter(item => item.count > 0);
        return { items, total: openTasks.length };
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

    const tasksByProject = useMemo(() => {
        const map: Record<string, Task[]> = {};
        tasks.forEach(task => {
            if (!map[task.projectId]) map[task.projectId] = [];
            map[task.projectId].push(task);
        });
        return map;
    }, [tasks]);

    const issuesByProject = useMemo(() => {
        const map: Record<string, Issue[]> = {};
        issues.forEach(issue => {
            if (!map[issue.projectId]) map[issue.projectId] = [];
            map[issue.projectId].push(issue);
        });
        return map;
    }, [issues]);

    const projectHealthMap = useMemo(() => {
        const healthMap: Record<string, ProjectHealth> = {};
        projects.forEach(project => {
            healthMap[project.id] = calculateProjectHealth(
                project,
                tasksByProject[project.id] || [],
                [], // Milestones not available in dashboard view currently
                issuesByProject[project.id] || []
            );
        });
        return healthMap;
    }, [projects, tasksByProject, issuesByProject]);

    const projectsAtRisk = useMemo(() => {
        return projects
            .filter(project => project.status !== 'Completed')
            .map(project => ({ project, health: projectHealthMap[project.id] }))
            .filter(entry => entry.health.status === 'warning' || entry.health.status === 'critical')
            .sort((a, b) => a.health.score - b.health.score)
            .slice(0, 3);
    }, [projects, projectHealthMap]);

    // Calculate Workspace Health
    const workspaceHealth = useMemo(() => {
        return calculateWorkspaceHealth(projects.filter(p => p.status !== 'Completed'), projectHealthMap);
    }, [projects, projectHealthMap]);

    // Hybrid Activity Feed: Combine real activities with synthetic ones from tasks/flows
    const displayActivities = useMemo(() => {
        const synthetic: Activity[] = [];

        // Generate synthetic activities from recent tasks/flows for immediate feedback
        tasks.slice(0, 10).forEach(task => {
            if (task.createdAt) {
                synthetic.push({
                    id: `syn-task-c-${task.id}`,
                    type: 'task',
                    action: t('dashboard.activity.actions.createdTask'),
                    target: task.title,
                    user: t('dashboard.activity.you'),
                    userAvatar: auth.currentUser?.photoURL || '',
                    createdAt: task.createdAt,
                    projectId: task.projectId
                } as any);
            }
            if (task.isCompleted) {
                synthetic.push({
                    id: `syn-task-d-${task.id}`,
                    type: 'task',
                    action: t('dashboard.activity.actions.completedTask'),
                    target: task.title,
                    user: t('dashboard.activity.you'),
                    userAvatar: auth.currentUser?.photoURL || '',
                    createdAt: task.createdAt, // Ideally we'd have completedAt, but using createdAt as fallback or Date.now() if recently loaded... 
                    // Let's use createdAt for consistency or maybe just omit if old. For now, pushing.
                    projectId: task.projectId
                } as any);
            }
        });

        ideas.slice(0, 10).forEach(idea => {
            if (idea.createdAt) {
                synthetic.push({
                    id: `syn-idea-${idea.id}`,
                    type: 'idea',
                    action: t('dashboard.activity.actions.capturedFlow'),
                    target: idea.title,
                    user: t('dashboard.activity.you'),
                    userAvatar: auth.currentUser?.photoURL || '',
                    createdAt: idea.createdAt,
                    projectId: idea.projectId
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
    }, [activities, tasks, ideas, t]);

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

    const currentUserId = auth.currentUser?.uid;

    const overdueTasks = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return tasks.filter(task => {
            if (task.isCompleted) return false;
            const due = toDate(task.dueDate);
            return due ? due.getTime() < startOfToday.getTime() : false;
        });
    }, [tasks]);

    const dueTodayTasks = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(startOfToday.getDate() + 1);
        return tasks.filter(task => {
            if (task.isCompleted) return false;
            const due = toDate(task.dueDate);
            if (!due) return false;
            const dueTime = due.getTime();
            return dueTime >= startOfToday.getTime() && dueTime < endOfToday.getTime();
        });
    }, [tasks]);

    const blockedTasks = useMemo(
        () => tasks.filter(task => !task.isCompleted && task.status === 'Blocked'),
        [tasks]
    );

    const urgentTasks = useMemo(
        () => tasks.filter(task => !task.isCompleted && task.priority === 'Urgent'),
        [tasks]
    );

    const myOpenTasks = useMemo(() => {
        if (!currentUserId) return [];
        return tasks.filter(task => !task.isCompleted && (
            task.assigneeId === currentUserId || (task.assigneeIds && task.assigneeIds.includes(currentUserId))
        ));
    }, [tasks, currentUserId]);

    const urgentIssues = useMemo(
        () => issues.filter(issue => issue.priority === 'Urgent' && issue.status !== 'Resolved' && issue.status !== 'Closed'),
        [issues]
    );

    const reviewIdeas = useMemo(
        () => ideas.filter(idea => REVIEW_STAGES.has(idea.stage)),
        [ideas]
    );

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

    const ideaSpotlight = useMemo(() => {
        const sorted = [...ideas].sort((a, b) => {
            const voteDiff = (b.votes || 0) - (a.votes || 0);
            if (voteDiff !== 0) return voteDiff;
            return toMillis(b.createdAt) - toMillis(a.createdAt);
        });
        const reviewFirst = sorted.filter(idea => REVIEW_STAGES.has(idea.stage));
        return (reviewFirst.length > 0 ? reviewFirst : sorted).slice(0, 3);
    }, [ideas]);

    const focusMetrics = useMemo(() => {
        const items = [
            {
                key: 'overdue',
                label: t('dashboard.focus.overdue'),
                value: overdueTasks.length,
                icon: 'event_busy',
                color: 'text-rose-500'
            },
            {
                key: 'dueToday',
                label: t('dashboard.focus.dueToday'),
                value: dueTodayTasks.length,
                icon: 'today',
                color: 'text-amber-500'
            },
            {
                key: 'blocked',
                label: t('dashboard.focus.blocked'),
                value: blockedTasks.length,
                icon: 'block',
                color: 'text-orange-500'
            },
            {
                key: 'assigned',
                label: t('dashboard.focus.assignedToMe'),
                value: myOpenTasks.length,
                icon: 'person',
                color: 'text-indigo-500'
            },
            {
                key: 'review',
                label: t('dashboard.focus.reviewFlows'),
                value: reviewIdeas.length,
                icon: 'rate_review',
                color: 'text-blue-500'
            }
        ];

        if (hasIssuesModule) {
            items.push({
                key: 'urgentIssues',
                label: t('dashboard.focus.urgentIssues'),
                value: urgentIssues.length,
                icon: 'report',
                color: 'text-rose-500'
            });
        } else {
            items.push({
                key: 'urgentTasks',
                label: t('dashboard.focus.urgentTasks'),
                value: urgentTasks.length,
                icon: 'priority_high',
                color: 'text-rose-500'
            });
        }

        return items;
    }, [
        blockedTasks.length,
        dueTodayTasks.length,
        hasIssuesModule,
        myOpenTasks.length,
        overdueTasks.length,
        reviewIdeas.length,
        t,
        urgentIssues.length,
        urgentTasks.length
    ]);

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
        return format(d, dateFormat, { locale: dateLocale });
    };

    const kpiCards = [
        {
            key: 'active',
            label: t('dashboard.kpi.activeProjects'),
            value: stats.activeProjects,
            icon: 'folder_open',
            series: taskTrend,
            color: '#6366f1', // Indigo
            caption: t('dashboard.kpi.caption.totalTracked').replace('{count}', String(projects.length))
        },
        {
            key: 'completed',
            label: t('dashboard.kpi.completed'),
            value: stats.completedProjects,
            icon: 'check_circle',
            series: ideaTrend,
            color: '#10b981', // Emerald
            caption: t('dashboard.kpi.caption.completionRate').replace('{rate}', String(statusBreakdown.completedPct))
        },
        {
            key: 'tasks',
            label: t('dashboard.kpi.openTasks'),
            value: stats.openTasks,
            icon: 'check_box',
            series: taskTrend,
            color: '#f59e0b', // Amber
            caption: t('dashboard.kpi.caption.dueSoon').replace('{count}', String(dueSoonCount))
        },
        {
            key: 'ideas',
            label: t('dashboard.kpi.flowsCaptured'),
            value: stats.ideas,
            icon: 'lightbulb',
            series: ideaTrend,
            color: '#3b82f6', // Blue
            caption: t('dashboard.kpi.caption.thisWeek').replace('{count}', String(ideasThisWeek))
        }
    ];





    const [showPasskeyUpsell, setShowPasskeyUpsell] = useState(false);

    useEffect(() => {
        const checkPasskeyStatus = async () => {
            // Check if user is logged in
            if (!auth.currentUser) return;

            // Check if snoozed
            const snoozeUntil = localStorage.getItem('projectflow_passkey_reminder_snooze');
            if (snoozeUntil && parseInt(snoozeUntil) > Date.now()) {
                return;
            }

            // Check if user already has passkeys
            const hasPasskeys = await checkPasskeyExists(auth.currentUser.uid);
            if (!hasPasskeys) {
                // Short delay so it doesn't pop up INSTANTLY on load
                setTimeout(() => setShowPasskeyUpsell(true), 1000);
            }
        };

        checkPasskeyStatus();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
            </div>
        );
    }

    return (
        <>
            <PasskeySetupModal
                isOpen={showPasskeyUpsell}
                onClose={() => setShowPasskeyUpsell(false)}
                onSetupComplete={() => setShowPasskeyUpsell(false)}
            />
            <div className="space-y-6 pb-12 fade-in">
                {/* Header - Greeting & Quick Stats */}
                <div data-onboarding-id="dashboard-header" className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-8 animate-fade-in">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[var(--color-primary)] font-bold uppercase tracking-wider text-xs">
                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                            {format(new Date(), dateFormat, { locale: dateLocale })}
                        </div>
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--color-text-main)] tracking-tight">
                            {greeting}, {userName || t('dashboard.userFallback')}.
                        </h1>
                        <p className="text-[var(--color-text-muted)] font-medium">
                            {t('dashboard.header.subtitle')}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1 min-w-[100px] p-4 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-[var(--color-text-main)]">{stats.activeProjects}</div>
                            <div className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mt-1">{t('dashboard.header.stats.activeProjects')}</div>
                        </div>
                        <div className="flex-1 min-w-[100px] p-4 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-amber-500">{dueSoonCount}</div>
                            <div className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mt-1">{t('dashboard.header.stats.dueSoon')}</div>
                        </div>
                        <div className="flex-1 min-w-[100px] p-4 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-emerald-500">{stats.completedProjects}</div>
                            <div className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mt-1">{t('dashboard.header.stats.completed')}</div>
                        </div>
                    </div>
                </div>

                {/* Main Dashboard Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                    {/* Left Column: Metrics & Charts (3 cols wide on large screens) */}
                    <div className="xl:col-span-3 space-y-6">

                        {/* New Widget Cards Row */}
                        <div data-onboarding-id="dashboard-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

                        {/* Priority Snapshot + Risk Watch */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card padding="md" className="lg:col-span-2">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="h4">{t('dashboard.focus.title')}</h3>
                                        <p className="text-xs text-[var(--color-text-subtle)]">{t('dashboard.focus.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {focusMetrics.map(metric => (
                                        <div
                                            key={metric.key}
                                            className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3 hover:shadow-sm transition-shadow"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
                                                    {metric.label}
                                                </span>
                                                <span className={`material-symbols-outlined text-sm ${metric.color}`}>{metric.icon}</span>
                                            </div>
                                            <div className={`text-2xl font-black ${metric.value > 0 ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-subtle)]'}`}>
                                                {metric.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card padding="md" className="lg:col-span-1">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="h4">{t('dashboard.risk.title')}</h3>
                                        <p className="text-xs text-[var(--color-text-subtle)]">{t('dashboard.risk.subtitle')}</p>
                                    </div>
                                    <Link to="/projects" className="text-xs font-bold text-[var(--color-primary)] hover:underline">
                                        {t('dashboard.risk.viewAll')}
                                    </Link>
                                </div>
                                <div className="space-y-3">
                                    {projectsAtRisk.length === 0 ? (
                                        <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                                            {t('dashboard.risk.empty')}
                                        </div>
                                    ) : (
                                        projectsAtRisk.map(({ project, health }) => {
                                            const openTasks = (tasksByProject[project.id] || []).filter(task => !task.isCompleted).length;
                                            const dueLabel = project.dueDate ? formatShortDate(project.dueDate, dateFormat, dateLocale) : '';
                                            const dueText = dueLabel
                                                ? t('dashboard.risk.due').replace('{date}', dueLabel)
                                                : t('dashboard.risk.noDeadline');

                                            return (
                                                <Link
                                                    key={project.id}
                                                    to={`/project/${project.id}`}
                                                    className="flex items-center gap-3 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-hover)] transition-colors"
                                                >
                                                    <HealthIndicator health={health} size="sm" showLabel={false} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="text-sm font-semibold text-[var(--color-text-main)] line-clamp-1">
                                                                {project.title}
                                                            </p>
                                                            <Badge variant="outline" size="sm" className="text-[8px]">
                                                                {projectStatusLabels[project.status as keyof typeof projectStatusLabels] || project.status}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-subtle)]">
                                                            <span>{t('dashboard.risk.openTasks').replace('{count}', String(openTasks))}</span>
                                                            <span>•</span>
                                                            <span>{dueText}</span>
                                                        </div>
                                                    </div>
                                                    <span className="material-symbols-outlined text-[16px] text-[var(--color-text-subtle)]">chevron_right</span>
                                                </Link>
                                            );
                                        })
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* Main Content Grid - 3 Columns */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            <div className="lg:col-span-2 space-y-6">
                                <Card data-onboarding-id="dashboard-trends" padding="none" className="overflow-hidden bg-[var(--color-surface-card)] border-[var(--color-surface-border)] shadow-2xl flex flex-col min-h-[420px] group/chart-card">
                                    {/* Card Header Section */}
                                    <div className="p-6 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-paper)]/30 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="p-1.5 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                                                    <span className="material-symbols-outlined text-sm">trending_up</span>
                                                </div>
                                                <h3 className="text-xl font-black tracking-tight text-[var(--color-text-main)]">{t('dashboard.trends.title')}</h3>
                                            </div>
                                            <p className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-[0.2em]">{t('dashboard.trends.subtitle')}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)]">
                                            <div className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-main)] text-[10px] font-bold shadow-sm border border-[var(--color-surface-border)]">{t('dashboard.trends.range.sevenDays')}</div>
                                            <div className="px-3 py-1.5 rounded-lg text-[var(--color-text-subtle)] text-[10px] font-bold hover:bg-[var(--color-surface-hover)] cursor-not-allowed transition-colors">{t('dashboard.trends.range.thirtyDays')}</div>
                                            <div className="px-3 py-1.5 rounded-lg text-[var(--color-text-subtle)] text-[10px] font-bold hover:bg-[var(--color-surface-hover)] cursor-not-allowed transition-colors">{t('dashboard.trends.range.all')}</div>
                                        </div>
                                    </div>

                                    {/* Chart Body Section */}
                                    <div className="flex-1 relative bg-[var(--color-surface-paper)]/10 p-4">
                                        {/* Decorative Mesh Background */}
                                        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                                            <div className="absolute -top-1/2 -left-1/4 w-full h-full bg-blue-500/20 blur-[120px] rounded-full"></div>
                                            <div className="absolute -bottom-1/2 -right-1/4 w-full h-full bg-amber-500/20 blur-[120px] rounded-full"></div>
                                        </div>

                                        {/* Legend Row */}
                                        <div className="flex items-center justify-between mb-3 relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="size-2.5 rounded-full bg-amber-500"></div>
                                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('nav.tasks')}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="size-2.5 rounded-full bg-blue-500"></div>
                                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('nav.flows')}</span>
                                                </div>
                                                {hasIssuesModule && (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="size-2.5 rounded-full bg-rose-500"></div>
                                                        <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('nav.issues')}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wide">{t('dashboard.trends.peakLabel')}</span>
                                                <span className="text-sm font-black text-[var(--color-text-main)]">{maxTrendValue}</span>
                                            </div>
                                        </div>

                                        <div className="h-[200px] relative">
                                            <svg
                                                ref={trendRef}
                                                viewBox={`0 0 ${chartOuterWidth} ${chartOuterHeight}`}
                                                className="w-full h-full select-none"
                                                onMouseMove={handleTrendMove}
                                                onMouseLeave={() => setHoverTrendIndex(null)}
                                                preserveAspectRatio="xMidYMid meet"
                                            >
                                                <defs>
                                                    <linearGradient id="area-tasks" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                                                    </linearGradient>
                                                    <linearGradient id="area-ideas" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                    </linearGradient>
                                                    <linearGradient id="area-issues" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                                                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                                                    </linearGradient>
                                                </defs>

                                                {/* Subtle Radial Polka Grid */}
                                                <pattern id="dot-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                                    <circle cx="2" cy="2" r="0.8" fill="var(--color-surface-border)" opacity="0.4" />
                                                </pattern>
                                                <rect width="100%" height="100%" fill="url(#dot-pattern)" />

                                                {/* Light Horizontal Grid */}
                                                {[0, 0.25, 0.5, 0.75, 1].map((p) => {
                                                    const y = margin.top + innerHeight * p;
                                                    return (
                                                        <line
                                                            key={p}
                                                            x1={margin.left}
                                                            x2={margin.left + innerWidth}
                                                            y1={y}
                                                            y2={y}
                                                            stroke="var(--color-surface-border)"
                                                            strokeWidth="0.5"
                                                            strokeDasharray="4 4"
                                                            opacity="0.5"
                                                        />
                                                    );
                                                })}

                                                {/* Axis Lines */}
                                                <line x1={margin.left} x2={margin.left + innerWidth} y1={margin.top + innerHeight} y2={margin.top + innerHeight} stroke="var(--color-surface-border)" strokeWidth="1" />

                                                {/* Area Fills */}
                                                <path d={`${getSmoothPath(taskTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#area-tasks)" />
                                                <path d={`${getSmoothPath(ideaTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#area-ideas)" />
                                                {hasIssuesModule && <path d={`${getSmoothPath(issueTrend)} L${margin.left + innerWidth},${margin.top + innerHeight} L${margin.left},${margin.top + innerHeight} Z`} fill="url(#area-issues)" />}

                                                {/* Main Trend Lines */}
                                                <path d={getSmoothPath(ideaTrend)} stroke="#3b82f6" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                                {hasIssuesModule && <path d={getSmoothPath(issueTrend)} stroke="#f43f5e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                                                <path d={getSmoothPath(taskTrend)} stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

                                                {/* Interaction Elements */}
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
                                                            <line x1={x} x2={x} y1={margin.top} y2={margin.top + innerHeight} stroke="var(--color-primary)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                                                            <circle cx={x} cy={yIdea} r={5} fill="#3b82f6" stroke="white" strokeWidth="2" />
                                                            <circle cx={x} cy={yTask} r={5} fill="#f59e0b" stroke="white" strokeWidth="2" />
                                                            {hasIssuesModule && <circle cx={x} cy={yIssue} r={5} fill="#f43f5e" stroke="white" strokeWidth={2} />}
                                                        </g>
                                                    );
                                                })()}
                                            </svg>

                                            {/* HTML Tooltip - positioned outside SVG for proper rendering */}
                                            {hoverTrendIndex !== null && (() => {
                                                const step = innerWidth / (trendDays - 1 || 1);
                                                const xPct = (hoverTrendIndex / (trendDays - 1)) * 100;
                                                const taskVal = taskTrend[hoverTrendIndex]?.value ?? 0;
                                                const ideaVal = ideaTrend[hoverTrendIndex]?.value ?? 0;
                                                const issueVal = hasIssuesModule ? (issueTrend[hoverTrendIndex]?.value ?? 0) : 0;
                                                const isRight = xPct > 65;

                                                return (
                                                    <div
                                                        className="absolute top-2 z-20 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-3 shadow-xl backdrop-blur-md min-w-[120px] pointer-events-none"
                                                        style={{ left: isRight ? 'auto' : `calc(${xPct}% + 20px)`, right: isRight ? `calc(${100 - xPct}% + 20px)` : 'auto' }}
                                                    >
                                                        <div className="text-[9px] font-black text-[var(--color-text-subtle)] uppercase tracking-widest mb-2 border-b border-[var(--color-surface-border)] pb-1.5">
                                                            {trendLabel(hoverTrendIndex)}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="size-2 rounded-full bg-amber-500"></div>
                                                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('nav.tasks')}</span>
                                                                </div>
                                                                <span className="text-xs font-black text-[var(--color-text-main)]">{taskVal}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="size-2 rounded-full bg-blue-500"></div>
                                                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('nav.flows')}</span>
                                                                </div>
                                                                <span className="text-xs font-black text-[var(--color-text-main)]">{ideaVal}</span>
                                                            </div>
                                                            {hasIssuesModule && (
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="size-2 rounded-full bg-rose-500"></div>
                                                                        <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('nav.issues')}</span>
                                                                    </div>
                                                                    <span className="text-xs font-black text-[var(--color-text-main)]">{issueVal}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Card Footer Section: Integrated Stats */}
                                    <div className="p-4 grid grid-cols-3 gap-2 bg-[var(--color-surface-bg)]/50 border-t border-[var(--color-surface-border)] rounded-b-2xl">
                                        <div className="p-3 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] hover:border-amber-500/30 transition-all group/stat">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">{t('nav.tasks')}</span>
                                                <span className="material-symbols-outlined text-[10px] text-amber-500 font-bold">check_circle</span>
                                            </div>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-lg font-black text-[var(--color-text-main)] tracking-tight">{taskTrend.reduce((a, b) => a + b.value, 0)}</span>
                                                <span className="text-[9px] font-bold text-emerald-500 font-mono">+12%</span>
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] hover:border-blue-500/30 transition-all group/stat">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">{t('nav.flows')}</span>
                                                <span className="material-symbols-outlined text-[10px] text-blue-500 font-bold">lightbulb</span>
                                            </div>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-lg font-black text-[var(--color-text-main)] tracking-tight">{ideaTrend.reduce((a, b) => a + b.value, 0)}</span>
                                                <span className="text-[9px] font-bold text-emerald-500 font-mono">+5%</span>
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] hover:border-rose-500/30 transition-all group/stat">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">{t('nav.issues')}</span>
                                                <span className="material-symbols-outlined text-[10px] text-rose-500 font-bold">bug_report</span>
                                            </div>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-lg font-black text-[var(--color-text-main)] tracking-tight">{hasIssuesModule ? issueTrend.reduce((a, b) => a + b.value, 0) : 0}</span>
                                                <span className="text-[9px] font-bold text-[var(--color-text-subtle)] font-mono">0%</span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card padding="md" className="flex flex-col">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="h4">{t('dashboard.taskStatus.title')}</h3>
                                            <p className="text-xs text-[var(--color-text-subtle)]">{t('dashboard.taskStatus.subtitle')}</p>
                                        </div>
                                        <div className="text-xs font-semibold text-[var(--color-text-subtle)]">
                                            {t('dashboard.taskStatus.total').replace('{count}', String(taskStatusSummary.total))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {taskStatusSummary.items.length === 0 ? (
                                            <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                                                {t('dashboard.taskStatus.empty')}
                                            </div>
                                        ) : (
                                            taskStatusSummary.items.map(item => {
                                                const color = TASK_STATUS_COLORS[item.status] || 'var(--color-primary)';
                                                const label = taskStatusLabels[item.status as keyof typeof taskStatusLabels] || item.status;
                                                const total = taskStatusSummary.total || 1;
                                                return (
                                                    <div key={item.status} className="space-y-1">
                                                        <div className="flex justify-between text-xs font-semibold">
                                                            <span style={{ color }}>{label}</span>
                                                            <span className="text-[var(--color-text-subtle)]">{item.count}</span>
                                                        </div>
                                                        <div className="h-2 w-full bg-[var(--color-surface-bg)] rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-700 ease-out"
                                                                style={{ width: `${(item.count / total) * 100}%`, backgroundColor: color }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)] flex justify-end">
                                        <Link to="/tasks" className="text-sm font-bold text-[var(--color-primary)] hover:text-indigo-700 transition-colors flex items-center gap-1 group">
                                            {t('dashboard.taskStatus.manage')} <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                        </Link>
                                    </div>
                                </Card>
                            </div>

                            {/* 2. Workspace Health & Project Status (Span 1, Stacked) */}
                            <div className="lg:col-span-1 space-y-6">

                                <div data-onboarding-id="dashboard-health">
                                    <WorkspaceHealthCard health={workspaceHealth} projectCount={projects.length} />
                                </div>

                                <Card data-onboarding-id="dashboard-status" padding="md" className="flex flex-col items-center justify-center">
                                    <div className="relative flex items-center justify-center mb-6">
                                        <DonutChart data={projectStatusDistribution} size={140} thickness={12} />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-2xl font-bold text-[var(--color-text-main)]">{projects.length}</span>
                                            <span className="text-xs text-[var(--color-text-muted)] uppercase">{t('nav.projects')}</span>
                                        </div>
                                    </div>
                                    <div className="w-full space-y-2">
                                        <h3 className="h4 text-center mb-4">{t('dashboard.status.title')}</h3>
                                        {projectStatusDistribution.map((item) => (
                                            <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                                    <span className="font-medium text-[var(--color-text-main)]">{item.name}</span>
                                                </div>
                                                <span className="font-bold text-[var(--color-text-main)]">{item.value}</span>
                                            </div>
                                        ))}
                                        {projectStatusDistribution.length === 0 && <p className="text-sm text-[var(--color-text-muted)] text-center">{t('dashboard.status.empty')}</p>}
                                    </div>
                                </Card>

                                <Card padding="md" className="flex flex-col">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="h4">{t('dashboard.flowSpotlight.title')}</h3>
                                            <p className="text-xs text-[var(--color-text-subtle)]">{t('dashboard.flowSpotlight.subtitle')}</p>
                                        </div>
                                        <Badge variant="secondary" size="sm">
                                            {t('nav.flows')}
                                        </Badge>
                                    </div>
                                    <div className="space-y-3">
                                        {ideaSpotlight.length === 0 ? (
                                            <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                                                {t('dashboard.flowSpotlight.empty')}
                                            </div>
                                        ) : (
                                            ideaSpotlight.map((idea) => {
                                                const projectTitle = idea.projectId ? projectById.get(idea.projectId) : undefined;
                                                const projectLabel = projectTitle || t('dashboard.issues.unknownProject');
                                                const content = (
                                                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3 hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)]/40 transition-colors">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-[var(--color-text-main)] line-clamp-1">
                                                                {idea.title}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--color-text-subtle)]">
                                                                <span className="uppercase tracking-wider">{idea.stage}</span>
                                                                <span className="truncate">{projectLabel}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[16px] text-amber-500">star</span>
                                                            <span className="text-xs font-bold text-[var(--color-text-main)]">{idea.votes || 0}</span>
                                                        </div>
                                                    </div>
                                                );

                                                return idea.projectId ? (
                                                    <Link key={idea.id} to={`/project/${idea.projectId}/flows/${idea.id}`}>
                                                        {content}
                                                    </Link>
                                                ) : (
                                                    <div key={idea.id}>{content}</div>
                                                );
                                            })
                                        )}
                                    </div>
                                </Card>
                            </div>



                            {/* 3. Row 3: Workload, Deadlines (2 Columns) - Attention moved to Sidebar */}
                            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-4">

                                {/* 3a. Workload (1 Col) */}
                                <Card data-onboarding-id="dashboard-workload" padding="md" className="flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="h4">{t('dashboard.workload.title')}</h3>
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                            {t('dashboard.workload.pending').replace('{count}', String(tasks.filter(t => !t.isCompleted).length))}
                                        </span>
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
                                        {taskPriorityDistribution.length === 0 && <p className="text-sm text-[var(--color-text-muted)] text-center py-4">{t('dashboard.workload.empty')}</p>}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)] flex justify-end">
                                        <Link to="/tasks" className="text-sm font-bold text-[var(--color-primary)] hover:text-indigo-700 transition-colors flex items-center gap-1 group">
                                            {t('dashboard.workload.manage')} <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                        </Link>
                                    </div>
                                </Card>

                                {/* 3b. Upcoming Deadlines (1 Col) */}
                                <Card data-onboarding-id="dashboard-deadlines" padding="md" className="flex flex-col">
                                    <h3 className="h4 mb-4">{t('dashboard.deadlines.title')}</h3>
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
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${priorityColor}`}>
                                                                    {(task.priority && taskPriorityLabels[task.priority]) || task.priority || t('tasks.priority.medium')}
                                                                </span>
                                                                {due && (
                                                                    <span className={`text-[10px] ${isOverdue ? 'text-red-500 font-bold' : 'text-[var(--color-text-muted)]'}`}>
                                                                        {format(due, 'MMM d', { locale: dateLocale })}
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
                                                {t('dashboard.deadlines.empty')}
                                            </div>
                                        )}
                                    </div>
                                </Card>

                            </div>

                            {/* 4. Recent Projects (Full Row - Span 3) */}
                            <div data-onboarding-id="dashboard-active-projects" className="lg:col-span-3">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                            <span className="material-symbols-outlined">folder_open</span>
                                        </div>
                                        <h3 className="h3">{t('dashboard.projects.title')}</h3>
                                    </div>
                                    <div className="flex justify-end gap-4">
                                        <Link to="/projects" className="text-sm font-bold text-[var(--color-primary)] hover:text-indigo-700 transition-colors flex items-center gap-1 group">
                                            {t('dashboard.projects.viewAll')} <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                        </Link>
                                        <Link to="/create">
                                            <Button
                                                size="md"
                                                className="rounded-xl px-6 font-bold shadow-lg shadow-indigo-500/20 bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90 border-none"
                                                icon={<span className="material-symbols-outlined">add</span>}
                                            >
                                                {t('dashboard.projects.newProject')}
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {recentProjects.length === 0 ? (
                                        <div className="col-span-3 p-12 text-center text-[var(--color-text-subtle)] border-2 border-dashed border-[var(--color-surface-border)] rounded-2xl bg-[var(--color-surface-bg)]/50">
                                            <div className="mb-4 inline-flex p-4 rounded-full bg-[var(--color-surface-hover)]">
                                                <span className="material-symbols-outlined text-4xl opacity-50">post_add</span>
                                            </div>
                                            <p className="text-lg font-medium">{t('dashboard.projects.empty.title')}</p>
                                            <p className="text-sm mt-1">{t('dashboard.projects.empty.description')}</p>
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
                                                                    {projectStatusLabels[proj.status as keyof typeof projectStatusLabels] || proj.status}
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
                                                                    <span>{t('dashboard.projects.progress')}</span>
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
                        <Card data-onboarding-id="dashboard-calendar" padding="md">
                            <div className="flex flex-col gap-3 mb-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-base text-[var(--color-text-main)]">
                                        {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
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
                                {weekdays.map((d, i) => (
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
                                    {t('dashboard.calendar.month')}
                                </button>
                                <button
                                    onClick={() => calendarView !== 'week' && toggleCalendarView()}
                                    className={`flex-1 py-[5px] text-[9px] font-bold uppercase tracking-wider rounded transition-all ${calendarView === 'week' ? 'bg-[var(--color-surface-paper)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-subtle)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {t('dashboard.calendar.week')}
                                </button>
                            </div>
                        </Card>

                        <div data-onboarding-id="dashboard-scheduled">
                            <ScheduledTasksCard tasks={tasks} issues={issues} />
                        </div>

                        {/* Latest Milestone (if any project has milestones module) */}
                        {hasMilestonesModule && (
                            <div data-onboarding-id="dashboard-milestones">
                                <LatestMilestoneCard projects={projects} />
                            </div>
                        )}

                        {/* 2. Enhanced Live Activity (Hybrid Data) */}
                        <Card data-onboarding-id="dashboard-live-activity" padding="none" className="max-h-[400px] flex flex-col">
                            <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
                                <h3 className="h5">{t('dashboard.activity.title')}</h3>
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            </div>
                            <div className="overflow-y-auto p-2 space-y-1">
                                {displayActivities.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-[var(--color-text-subtle)]">{t('dashboard.activity.empty')}</div>
                                ) : (
                                    displayActivities.map(item => (
                                        <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors group">
                                            <div className="mt-0.5">
                                                {item.userAvatar ? (
                                                    <img src={item.userAvatar} alt="" className="size-8 rounded-full border border-[var(--color-surface-border)] object-cover" />
                                                ) : (
                                                    <div className="size-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                                        {(item.user || t('dashboard.activity.userFallback')).charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-[var(--color-text-main)] leading-snug">
                                                    <span className="font-semibold">{item.user}</span> <span className="text-[var(--color-text-muted)]">
                                                        {item.action || t('dashboard.activity.fallbackAction')}
                                                    </span> <br />
                                                    <span className="font-medium text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">{item.target}</span>
                                                </p>
                                                <p className="text-[10px] text-[var(--color-text-subtle)] mt-1">
                                                    {item.createdAt
                                                        ? format(new Date(toMillis(item.createdAt)), 'p', { locale: dateLocale })
                                                        : t('dashboard.activity.justNow')}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        {/* 3. Attention Needed (Moved Here) */}
                        <Card data-onboarding-id="dashboard-attention" padding="md" className="flex flex-col border-l-4 border-l-rose-500">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="h5 text-rose-600 dark:text-rose-400">{t('dashboard.attention.title')}</h3>
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
                                                <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.attention.allClear')}</p>
                                            </div>
                                        );
                                    }

                                    return attentionItems.map(item => (
                                        <Link key={item.id} to={`/project/${item.projectId}/tasks/${item.id}`} className="block p-3 rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 hover:shadow-sm transition-shadow">
                                            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 mb-0.5 uppercase">
                                                {item.status === 'Blocked' ? t('dashboard.attention.blocked') : t('dashboard.attention.urgent')}
                                            </p>
                                            <p className="text-sm font-medium text-[var(--color-text-main)] line-clamp-2">{item.title}</p>
                                        </Link>
                                    ));
                                })()}
                            </div>
                        </Card>

                        {/* 4. Recently Added Tasks (Restored) */}
                        <Card data-onboarding-id="dashboard-recent-tasks" padding="md">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="h5">{t('dashboard.recent.title')}</h3>
                                <Link to="/tasks" className="text-xs font-bold text-[var(--color-primary)] hover:underline">{t('dashboard.recent.viewAll')}</Link>
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
                                                    {formatShortDate(new Date(toMillis(task.createdAt)), dateFormat, dateLocale)}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                {tasks.length === 0 && <p className="text-sm text-[var(--color-text-muted)] text-center py-4">{t('dashboard.recent.empty')}</p>}
                            </div>
                        </Card>

                        {/* Recent Issues (Conditional) */}
                        {hasIssuesModule && issues.length > 0 && (
                            <Card data-onboarding-id="dashboard-recent-issues" padding="none">
                                <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
                                    <h3 className="h5">{t('dashboard.issues.title')}</h3>
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
                                                    <p className="text-xs text-[var(--color-text-muted)] truncate">{projectById.get(issue.projectId) || t('dashboard.issues.unknownProject')}</p>
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
            <OnboardingWelcomeModal
                isOpen={showOnboardingWelcome}
                title={t('onboarding.dashboard.welcome.title')}
                description={t('onboarding.dashboard.welcome.description')}
                onStart={handleStartOnboarding}
                onSkip={handleSkipOnboarding}
            />
            <OnboardingOverlay
                isOpen={onboardingActive}
                steps={onboardingSteps}
                stepIndex={onboardingStepIndex}
                onStepChange={setOnboardingStepIndex}
                onFinish={handleFinishOnboarding}
                onSkip={handleSkipOnboarding}
            />
        </>
    );
};
