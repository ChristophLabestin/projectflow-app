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
                color: '#f43f5e' // rose-500
            },
            {
                key: 'dueToday',
                label: t('dashboard.focus.dueToday'),
                value: dueTodayTasks.length,
                icon: 'today',
                color: '#f59e0b' // amber-500
            },
            {
                key: 'blocked',
                label: t('dashboard.focus.blocked'),
                value: blockedTasks.length,
                icon: 'block',
                color: '#f97316' // orange-500
            },
            {
                key: 'assigned',
                label: t('dashboard.focus.assignedToMe'),
                value: myOpenTasks.length,
                icon: 'person',
                color: '#6366f1' // indigo-500
            },
            {
                key: 'review',
                label: t('dashboard.focus.reviewFlows'),
                value: reviewIdeas.length,
                icon: 'rate_review',
                color: '#3b82f6' // blue-500
            }
        ];

        if (hasIssuesModule) {
            items.push({
                key: 'urgentIssues',
                label: t('dashboard.focus.urgentIssues'),
                value: urgentIssues.length,
                icon: 'report',
                color: '#f43f5e' // rose-500
            });
        } else {
            items.push({
                key: 'urgentTasks',
                label: t('dashboard.focus.urgentTasks'),
                value: urgentTasks.length,
                icon: 'priority_high',
                color: '#f43f5e' // rose-500
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
            <div className="dashboard-container">
                {/* Header - Greeting & Quick Stats */}
                <div data-onboarding-id="dashboard-header" className="dashboard-header">
                    <div className="space-y-2">
                        <div className="dashboard-date-label">
                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                            {format(new Date(), dateFormat, { locale: dateLocale })}
                        </div>
                        <h1 className="dashboard-title">
                            {greeting}, {userName || t('dashboard.userFallback')}.
                        </h1>
                        <p className="dashboard-subtitle">
                            {t('dashboard.header.subtitle')}
                        </p>
                    </div>

                    <div className="dashboard-header-stats">
                        <div className="header-stat-card">
                            <div className="stat-value">{stats.activeProjects}</div>
                            <div className="stat-label">{t('dashboard.header.stats.activeProjects')}</div>
                        </div>
                        <div className="header-stat-card">
                            <div className="stat-value amber">{dueSoonCount}</div>
                            <div className="stat-label">{t('dashboard.header.stats.dueSoon')}</div>
                        </div>
                        <div className="header-stat-card">
                            <div className="stat-value emerald">{stats.completedProjects}</div>
                            <div className="stat-label">{t('dashboard.header.stats.completed')}</div>
                        </div>
                    </div>
                </div>

                {/* Main Dashboard Grid */}
                <div className="dashboard-grid">

                    {/* Left Column: Metrics & Charts (3 cols wide on large screens) */}
                    <div className="dashboard-main-col">

                        {/* New Widget Cards Row */}
                        <div data-onboarding-id="dashboard-kpis" className="kpi-grid">
                            {kpiCards.map((stat) => (
                                <Card key={stat.key} padding="md" className="kpi-card" style={{ borderLeftColor: stat.color }}>
                                    <div className="kpi-content">
                                        <div className="kpi-header">
                                            <div>
                                                <p className="kpi-label">{stat.label}</p>
                                                <h3 className="kpi-value">{stat.value}</h3>
                                            </div>
                                            <div className="kpi-icon-wrapper" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                                                <span className="material-symbols-outlined">{stat.icon}</span>
                                            </div>
                                        </div>

                                        <div className="kpi-sparkline-area">
                                            <Sparkline
                                                data={stat.series.map(s => s.value)}
                                                width={140}
                                                height={30}
                                                color={stat.color}
                                                fill={true}
                                            />
                                            <p className="kpi-caption">{stat.caption}</p>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Priority Snapshot & Risk Section (Explicit 50/50) */}
                        <div className="section-grid-equal">
                            <Card padding="md" className="grid-col-span-1">
                                <div className="section-header-row">
                                    <div className="title-group">
                                        <h3 className="h4">{t('dashboard.focus.title')}</h3>
                                        <p className="subtitle">{t('dashboard.focus.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="focus-grid">
                                    {focusMetrics.map(metric => (
                                        <div
                                            key={metric.key}
                                            className="focus-metric-card"
                                        >
                                            <div className="header">
                                                <span className="label">
                                                    {metric.label}
                                                </span>
                                                <span className="material-symbols-outlined text-sm" style={{ color: metric.color }}>{metric.icon}</span>
                                            </div>
                                            <div className={`value ${metric.value === 0 ? 'zero' : ''}`}>
                                                {metric.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card padding="md" className="attention-card grid-col-span-1">
                                <div className="section-header-row">
                                    <div className="title-group">
                                        <h3 className="h4">{t('dashboard.risk.title')}</h3>
                                        <p className="subtitle">{t('dashboard.risk.subtitle')}</p>
                                    </div>
                                    <Link to="/projects" className="action-link">
                                        {t('dashboard.risk.viewAll')}
                                    </Link>
                                </div>
                                <div className="risk-list">
                                    {projectsAtRisk.length === 0 ? (
                                        <div className="empty-state-simple">
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
                                                    className="risk-item"
                                                >
                                                    <HealthIndicator health={health} size="sm" showLabel={false} />
                                                    <div className="risk-content">
                                                        <div className="title-row">
                                                            <p>
                                                                {project.title}
                                                            </p>
                                                            <Badge variant="outline" size="sm" className="text-[8px]">
                                                                {projectStatusLabels[project.status as keyof typeof projectStatusLabels] || project.status}
                                                            </Badge>
                                                        </div>
                                                        <div className="meta-row">
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

                        {/* Consolidated Metrics Area: Trends/Tasks (2/3) vs Health/Donut/Spotlight (1/3) */}
                        <div className="section-grid-2-1">
                            {/* Left Column: Metrics & Velocity (2/3) */}
                            <div className="grid-col-span-2 card-stack-gap">
                                <Card data-onboarding-id="dashboard-trends" padding="none" className="chart-card">
                                    {/* Card Header Section */}
                                    <div className="chart-header">
                                        <div className="chart-title-group">
                                            <div className="chart-title-row">
                                                <div className="icon-box">
                                                    <span className="material-symbols-outlined text-sm">trending_up</span>
                                                </div>
                                                <h3>{t('dashboard.trends.title')}</h3>
                                            </div>
                                            <p className="subtitle">{t('dashboard.trends.subtitle')}</p>
                                        </div>
                                        <div className="chart-controls">
                                            <div className="control-btn active">{t('dashboard.trends.range.sevenDays')}</div>
                                            <div className="control-btn disabled">{t('dashboard.trends.range.thirtyDays')}</div>
                                            <div className="control-btn disabled">{t('dashboard.trends.range.all')}</div>
                                        </div>
                                    </div>

                                    {/* Chart Body Section */}
                                    <div className="chart-body">
                                        {/* Decorative Mesh Background */}
                                        <div className="chart-mesh-bg">
                                            <div className="blob-1"></div>
                                            <div className="blob-2"></div>
                                        </div>

                                        {/* Legend Row */}
                                        <div className="chart-legend">
                                            <div className="legend-group">
                                                <div className="legend-item">
                                                    <div className="dot" style={{ backgroundColor: '#f59e0b' }}></div>
                                                    <span>{t('nav.tasks')}</span>
                                                </div>
                                                <div className="legend-item">
                                                    <div className="dot" style={{ backgroundColor: '#3b82f6' }}></div>
                                                    <span>{t('nav.flows')}</span>
                                                </div>
                                                {hasIssuesModule && (
                                                    <div className="legend-item">
                                                        <div className="dot" style={{ backgroundColor: '#f43f5e' }}></div>
                                                        <span>{t('nav.issues')}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="chart-peak">
                                                <span className="label">{t('dashboard.trends.peakLabel')}</span>
                                                <span className="value">{maxTrendValue}</span>
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
                                    <div className="chart-footer">
                                        <div className="footer-stat">
                                            <div className="stat-header">
                                                <span className="stat-label">{t('nav.tasks')}</span>
                                                <span className="material-symbols-outlined text-[10px] text-amber-500 font-bold">check_circle</span>
                                            </div>
                                            <div className="stat-main">
                                                <span className="val">{taskTrend.reduce((a, b) => a + b.value, 0)}</span>
                                                <span className="delta text-emerald-500">+12%</span>
                                            </div>
                                        </div>
                                        <div className="footer-stat">
                                            <div className="stat-header">
                                                <span className="stat-label">{t('nav.flows')}</span>
                                                <span className="material-symbols-outlined text-[10px] text-blue-500 font-bold">lightbulb</span>
                                            </div>
                                            <div className="stat-main">
                                                <span className="val">{ideaTrend.reduce((a, b) => a + b.value, 0)}</span>
                                                <span className="delta text-emerald-500">+5%</span>
                                            </div>
                                        </div>
                                        {hasIssuesModule && (
                                            <div className="footer-stat">
                                                <div className="stat-header">
                                                    <span className="stat-label">{t('nav.issues')}</span>
                                                    <span className="material-symbols-outlined text-[10px] text-rose-500 font-bold">bug_report</span>
                                                </div>
                                                <div className="stat-main">
                                                    <span className="val">{issueTrend.reduce((a, b) => a + b.value, 0)}</span>
                                                    <span className="delta text-[var(--color-text-subtle)]">0%</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                <Card padding="md" className="card-stack">
                                    <div className="section-header-row">
                                        <div className="title-group">
                                            <h3 className="h4">{t('dashboard.taskStatus.title')}</h3>
                                            <p className="subtitle">{t('dashboard.taskStatus.subtitle')}</p>
                                        </div>
                                        <div className="meta-text">
                                            {t('dashboard.taskStatus.total').replace('{count}', String(taskStatusSummary.total))}
                                        </div>
                                    </div>
                                    <div className="status-list">
                                        {taskStatusSummary.items.length === 0 ? (
                                            <div className="empty-state-simple">
                                                {t('dashboard.taskStatus.empty')}
                                            </div>
                                        ) : (
                                            taskStatusSummary.items.map(item => {
                                                const color = TASK_STATUS_COLORS[item.status] || 'var(--color-primary)';
                                                const label = taskStatusLabels[item.status as keyof typeof taskStatusLabels] || item.status;
                                                const total = taskStatusSummary.total || 1;
                                                return (
                                                    <div key={item.status} className="status-item">
                                                        <div className="header">
                                                            <span style={{ color }}>{label}</span>
                                                            <span className="count">{item.count}</span>
                                                        </div>
                                                        <div className="bar-bg">
                                                            <div
                                                                className="bar-fill"
                                                                style={{ width: `${(item.count / total) * 100}%`, backgroundColor: color }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="card-bottom-action">
                                        <Link to="/tasks" className="view-all-link">
                                            {t('dashboard.taskStatus.manage')} <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                        </Link>
                                    </div>
                                </Card>
                            </div>

                            {/* Right Column: Health & Spotlight (1/3) */}
                            <div className="grid-col-span-1 card-stack-gap">
                                <div data-onboarding-id="dashboard-health">
                                    <WorkspaceHealthCard health={workspaceHealth} projectCount={projects.length} />
                                </div>

                                <Card data-onboarding-id="dashboard-status" padding="md" className="donut-container">
                                    <div className="donut-wrapper">
                                        <DonutChart data={projectStatusDistribution} size={140} thickness={12} />
                                        <div className="center-text">
                                            <span className="val">{projects.length}</span>
                                            <span className="lbl">{t('nav.projects')}</span>
                                        </div>
                                    </div>
                                    <div className="donut-legend">
                                        <h3 className="h4 donut-legend-header">{t('dashboard.status.title')}</h3>
                                        {projectStatusDistribution.map((item) => (
                                            <div key={item.name} className="legend-row">
                                                <div className="info">
                                                    <span className="dot" style={{ backgroundColor: item.color }} />
                                                    <span className="name">{item.name}</span>
                                                </div>
                                                <span className="val">{item.value}</span>
                                            </div>
                                        ))}
                                        {projectStatusDistribution.length === 0 && <p className="empty-state-simple">{t('dashboard.status.empty')}</p>}
                                    </div>
                                </Card>

                                <Card padding="md" className="card-stack">
                                    <div className="section-header-row">
                                        <div className="title-group">
                                            <h3 className="h4">{t('dashboard.flowSpotlight.title')}</h3>
                                            <p className="subtitle">{t('dashboard.flowSpotlight.subtitle')}</p>
                                        </div>
                                        <Badge variant="secondary" size="sm">
                                            {t('nav.flows')}
                                        </Badge>
                                    </div>
                                    <div className="flow-list">
                                        {ideaSpotlight.length === 0 ? (
                                            <div className="empty-state-simple">
                                                {t('dashboard.flowSpotlight.empty')}
                                            </div>
                                        ) : (
                                            ideaSpotlight.map((idea) => {
                                                const projectTitle = idea.projectId ? projectById.get(idea.projectId) : undefined;
                                                const projectLabel = projectTitle || t('dashboard.issues.unknownProject');
                                                const content = (
                                                    <div className="flow-item">
                                                        <div className="content">
                                                            <p className="title">
                                                                {idea.title}
                                                            </p>
                                                            <div className="meta">
                                                                <span className="stage">{idea.stage}</span>
                                                                <span className="project">{projectLabel}</span>
                                                            </div>
                                                        </div>
                                                        <div className="votes">
                                                            <span className="material-symbols-outlined text-[16px] text-amber-500">star</span>
                                                            <span className="count">{idea.votes || 0}</span>
                                                        </div>
                                                    </div>
                                                );

                                                return idea.projectId ? (
                                                    <Link key={idea.id} to={`/project/${idea.projectId}/flows/${idea.id}`} className="flow-item">
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
                        </div>


                        {/* 3. Row 3: Workload, Deadlines (2 Columns) - Attention moved to Sidebar */}
                        <div className="grid-col-span-full">
                            <div className="grid-cols-responsive">

                                {/* 3a. Workload (1 Col) */}
                                <Card data-onboarding-id="dashboard-workload" padding="md" className="card-stack">
                                    <div className="section-header-row">
                                        <h3 className="h4">{t('dashboard.workload.title')}</h3>
                                        <span className="meta-text">
                                            {t('dashboard.workload.pending').replace('{count}', String(tasks.filter(t => !t.isCompleted).length))}
                                        </span>
                                    </div>
                                    <div className="status-list">
                                        {taskPriorityDistribution.map(item => (
                                            <div key={item.name} className="status-item">
                                                <div className="header">
                                                    <span style={{ color: item.color }}>{item.name}</span>
                                                    <span className="count">{item.value}</span>
                                                </div>
                                                <div className="bar-bg">
                                                    <div
                                                        className="bar-fill"
                                                        style={{ width: `${(item.value / (tasks.filter(t => !t.isCompleted).length || 1)) * 100}%`, backgroundColor: item.color }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        {taskPriorityDistribution.length === 0 && <p className="empty-state-simple">{t('dashboard.workload.empty')}</p>}
                                    </div>
                                    <div className="card-bottom-action mt-auto">
                                        <Link to="/tasks" className="view-all-link">
                                            {t('dashboard.workload.manage')} <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                        </Link>
                                    </div>
                                </Card>

                                {/* 3b. Upcoming Deadlines (1 Col) */}
                                <Card data-onboarding-id="dashboard-deadlines" padding="md" className="card-stack">
                                    <h3 className="h4 mb-4">{t('dashboard.deadlines.title')}</h3>
                                    <div className="recent-tasks-list-nested">
                                        {focusTasks.slice(0, 4).map(task => { // Showing top 4
                                            const priorityColor = task.priority === 'Urgent' ? 'text-rose-500' : task.priority === 'High' ? 'text-orange-500' : 'text-blue-500';
                                            const due = toDate(task.dueDate);
                                            const isOverdue = due && due.getTime() < Date.now();

                                            return (
                                                <Link key={task.id} to={`/project/${task.projectId}/tasks/${task.id}`} className="recent-task-item">
                                                    <div className="content">
                                                        <div className="flex-between-center">
                                                            <div>
                                                                <p className="title">{task.title}</p>
                                                                <div className="task-item-meta">
                                                                    <span className={`priority-tag ${priorityColor}`}>
                                                                        {(task.priority && taskPriorityLabels[task.priority]) || task.priority || t('tasks.priority.medium')}
                                                                    </span>
                                                                    {due && (
                                                                        <span className={`date-tag ${isOverdue ? 'overdue' : ''}`}>
                                                                            {format(due, 'MMM d', { locale: dateLocale })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">chevron_right</span>
                                                        </div>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                        {focusTasks.length === 0 && (
                                            <div className="empty-state-simple">
                                                {t('dashboard.deadlines.empty')}
                                            </div>
                                        )}
                                    </div>
                                </Card>

                            </div>
                        </div>

                        {/* 4. Recent Projects (Full Row) */}
                        <div data-onboarding-id="dashboard-active-projects" className="grid-col-span-full">
                            <div className="title-group flex-center-gap">
                                <div className="project-header-icon">
                                    <span className="material-symbols-outlined">folder_open</span>
                                </div>
                                <h3 className="h3">{t('dashboard.projects.title')}</h3>
                            </div>
                            <div className="flex-center-gap">
                                <Link to="/projects" className="view-all-link">
                                    {t('dashboard.projects.viewAll')} <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </Link>
                                <Link to="/create">
                                    <Button
                                        size="md"
                                        className="rounded-xl px-6 font-bold shadow-lg bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90 border-none"
                                        icon={<span className="material-symbols-outlined">add</span>}
                                    >
                                        {t('dashboard.projects.newProject')}
                                    </Button>
                                </Link>
                            </div>
                        </div>
                        <div className="grid-cols-3">
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
                                            <Card padding="none" hoverable className="project-card">

                                                {/* Cover Image Area */}
                                                <div className="cover-area">
                                                    {proj.coverImage ? (
                                                        <>
                                                            <div className="overlay" />
                                                            <img src={proj.coverImage} className="cover-image" alt="" />
                                                        </>
                                                    ) : (
                                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />
                                                    )}

                                                    <div className="status-badge">
                                                        <Badge variant={isCompleted ? 'success' : isBrainstorming ? 'secondary' : 'primary'} className="backdrop-blur-md bg-white/90 dark:bg-black/50 shadow-sm border-0">
                                                            {projectStatusLabels[proj.status as keyof typeof projectStatusLabels] || proj.status}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="content-area">
                                                    {/* Floating Icon */}
                                                    <div className="icon-wrapper">
                                                        {proj.squareIcon ? (
                                                            <div className="icon-box">
                                                                <img src={proj.squareIcon} alt="" />
                                                            </div>
                                                        ) : (
                                                            <div className={`icon-box ${iconClass}`}>
                                                                <span className="material-symbols-outlined text-2xl">{icon}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="project-info">
                                                        <h3 className="project-title">
                                                            {proj.title}
                                                        </h3>
                                                        {proj.description && (
                                                            <p className="project-desc">
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

                    {/* Right Column: Sidebar Widgets */}
                    <div className="dashboard-sidebar-col">

                        <Card data-onboarding-id="dashboard-calendar" padding="md" className="calendar-widget">
                            <div className="calendar-header">
                                <div className="top-row">
                                    <h3>
                                        {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
                                        <span className="badge">
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
                                    <div className="nav-controls">
                                        <button onClick={handlePrevDate}>
                                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                                        </button>
                                        <button onClick={handleNextDate}>
                                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="calendar-grid-header">
                                {weekdays.map((d, i) => (
                                    <div key={`${d}-${i}`} className="day-label">{d}</div>
                                ))}
                            </div>
                            <div className="calendar-grid-days">
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
                                                <div key={i} className={`day-cell ${isToday ? 'today' : ''}`}>
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
                                                <div key={`week-${i}`} className={`day-cell ${isToday ? 'today' : ''}`}>
                                                    {dayNum}
                                                </div>
                                            );
                                        }
                                    }
                                    return days;
                                })()}
                            </div>

                            {/* Segmented Control for View Switch */}
                            <div className="view-toggle">
                                <button
                                    onClick={() => calendarView !== 'month' && toggleCalendarView()}
                                    className={calendarView === 'month' ? 'active' : ''}
                                >
                                    {t('dashboard.calendar.month')}
                                </button>
                                <button
                                    onClick={() => calendarView !== 'week' && toggleCalendarView()}
                                    className={calendarView === 'week' ? 'active' : ''}
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
                        <Card data-onboarding-id="dashboard-live-activity" padding="none" className="activity-feed-card">
                            <div className="header">
                                <h3 className="h5">{t('dashboard.activity.title')}</h3>
                                <div className="status-ping">
                                    <div className="ping-circle" />
                                    <div className="status-dot" />
                                </div>
                            </div>
                            <div className="feed-container">
                                {displayActivities.length === 0 ? (
                                    <div className="empty-state-simple">{t('dashboard.activity.empty')}</div>
                                ) : (
                                    displayActivities.map(item => (
                                        <div key={item.id} className="activity-item">
                                            <div className="avatar">
                                                {item.userAvatar ? (
                                                    <img src={item.userAvatar} alt="" />
                                                ) : (
                                                    <div className="placeholder bg-indigo-100 text-indigo-600">
                                                        {(item.user || t('dashboard.activity.userFallback')).charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="content">
                                                <p>
                                                    <span className="user">{item.user}</span> <span className="action">
                                                        {item.action || t('dashboard.activity.fallbackAction')}
                                                    </span> <br />
                                                    <span className="target">{item.target}</span>
                                                </p>
                                                <p className="time">
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
                        <Card data-onboarding-id="dashboard-attention" padding="md" className="attention-card">
                            <div className="section-header-row">
                                <h3 className="h5 text-rose-600 dark:text-rose-400">{t('dashboard.attention.title')}</h3>
                                <span className="material-symbols-outlined text-rose-500 text-[20px]">warning</span>
                            </div>
                            <div className="attention-list">
                                {(() => {
                                    const blockedTasks = tasks.filter(t => t.status === 'Blocked');
                                    const urgentTasks = tasks.filter(t => t.priority === 'Urgent' && !t.isCompleted);
                                    const attentionItems = [...blockedTasks, ...urgentTasks].slice(0, 5);

                                    if (attentionItems.length === 0) {
                                        return (
                                            <div className="empty-state-simple">
                                                <span className="material-symbols-outlined text-3xl text-emerald-500 mb-2">check_circle</span>
                                                <p>{t('dashboard.attention.allClear')}</p>
                                            </div>
                                        );
                                    }

                                    return attentionItems.map(item => (
                                        <Link key={item.id} to={`/project/${item.projectId}/tasks/${item.id}`} className="attention-item">
                                            <p className="type">
                                                {item.status === 'Blocked' ? t('dashboard.attention.blocked') : t('dashboard.attention.urgent')}
                                            </p>
                                            <p className="title">{item.title}</p>
                                        </Link>
                                    ));
                                })()}
                            </div>
                        </Card>

                        {/* 4. Recently Added Tasks (Restored) */}
                        <Card data-onboarding-id="dashboard-recent-tasks" padding="md">
                            <div className="section-header-row">
                                <h3 className="h5">{t('dashboard.recent.title')}</h3>
                                <Link to="/tasks" className="view-all-link">{t('dashboard.recent.viewAll')}</Link>
                            </div>
                            <div className="recent-tasks-list">
                                {tasks
                                    .sort((a, b) => (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0))
                                    .slice(0, 5)
                                    .map(task => (
                                        <Link key={task.id} to={`/project/${task.projectId}/tasks/${task.id}`} className="recent-task-item">
                                            <div className={`priority-dot ${task.priority === 'Urgent' ? 'bg-red-500' : task.priority === 'High' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                                            <div className="content">
                                                <p className="title">{task.title}</p>
                                                <p className="date">
                                                    {formatShortDate(new Date(toMillis(task.createdAt)), dateFormat, dateLocale)}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                {tasks.length === 0 && <p className="empty-state-simple">{t('dashboard.recent.empty')}</p>}
                            </div>
                        </Card>

                        {/* Recent Issues (Conditional) */}
                        {hasIssuesModule && issues.length > 0 && (
                            <Card data-onboarding-id="dashboard-recent-issues" padding="none">
                                <div className="section-header-row">
                                    <h3 className="h5">{t('dashboard.issues.title')}</h3>
                                </div>
                                <div className="status-list">
                                    {issues.slice(0, 4).map((issue) => (
                                        <div key={issue.id} className="status-item">
                                            <div className="flex-center-gap">
                                                <span className={`material-symbols-outlined text-[18px] ${issue.status === 'Resolved' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {issue.status === 'Resolved' ? 'check_circle' : 'error'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="title">{issue.title}</p>
                                                    <p className="subtitle">{projectById.get(issue.projectId) || t('dashboard.issues.unknownProject')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                    </div>
                </div>
            </div >
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
