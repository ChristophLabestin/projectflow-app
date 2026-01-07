import { Project, Task, Milestone, Issue, Activity, Comment, Sprint } from '../types';
import { toMillis } from '../utils/time';

export type HealthStatus = 'excellent' | 'healthy' | 'normal' | 'warning' | 'critical' | 'stalemate';

export interface HealthFactor {
    id: string;
    label: string;
    description: string;
    impact: number; // Positive or negative
    type: 'positive' | 'negative' | 'neutral';
    labelKey?: string;
    descriptionKey?: string;
    meta?: Record<string, number | string>;
}

export interface ProjectHealth {
    score: number; // 0-100
    status: HealthStatus;
    factors: HealthFactor[];
    recommendations: string[];
    recommendationKeys?: string[];
    trend: 'improving' | 'declining' | 'stable';
    lastUpdated: number;
}

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

export const calculateProjectHealth = (
    project: Project,
    tasks: Task[] = [],
    milestones: Milestone[] = [],
    issues: Issue[] = [],
    sprints: Sprint[] = [],
    activities: Activity[] = [],
    comments: Comment[] = []
): ProjectHealth => {
    let score = 70; // Start with a base neutral-positive score
    const factors: HealthFactor[] = [];
    const recommendationEntries: { key: string; text: string }[] = [];
    const now = Date.now();
    const addRecommendation = (key: string, text: string) => {
        recommendationEntries.push({ key, text });
    };

    // 1. DEADLINE URGENCY
    if (project.dueDate) {
        const dueTime = new Date(project.dueDate).getTime();
        const daysUntilDue = (dueTime - now) / DAY;

        if (daysUntilDue < 0) {
            const overdueDays = Math.abs(Math.floor(daysUntilDue));
            const urgency = Math.min(40, Math.abs(Math.floor(daysUntilDue)) * 3);
            score -= (30 + urgency);
            factors.push({
                id: 'deadline_overdue',
                label: 'Deadline Overdue',
                labelKey: 'health.factors.deadline_overdue.label',
                description: `The project passed its deadline ${overdueDays} days ago.`,
                descriptionKey: 'health.factors.deadline_overdue.description',
                meta: { days: overdueDays },
                impact: -(30 + urgency),
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.updateDeadline',
                'Update project deadline or complete outstanding core milestones.'
            );
        } else if (daysUntilDue <= 3) {
            score -= 25;
            factors.push({
                id: 'deadline_imminent',
                label: 'Deadline Imminent',
                labelKey: 'health.factors.deadline_imminent.label',
                description: 'The project deadline is less than 3 days away.',
                descriptionKey: 'health.factors.deadline_imminent.description',
                impact: -25,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.prioritizeTasks',
                'Prioritize remaining high-priority tasks to meet the deadline.'
            );
        } else if (daysUntilDue <= 14) {
            score -= 5;
            factors.push({
                id: 'deadline_approaching',
                label: 'Deadline Approaching',
                labelKey: 'health.factors.deadline_approaching.label',
                description: 'The project is due within 2 weeks.',
                descriptionKey: 'health.factors.deadline_approaching.description',
                impact: -5,
                type: 'neutral'
            });
        }
    }

    // 2. TASK VELOCITY & PROGRESS
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.isCompleted || t.status === 'Done').length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : project.progress || 0;
    let recentCompletions = 0;

    if (totalTasks > 0) {
        // Momentum: Tasks completed in last 7 days
        recentCompletions = tasks.filter(t => {
            if (!(t.isCompleted || t.status === 'Done')) return false;
            const created = t.createdAt ? (typeof t.createdAt === 'object' && 'toMillis' in t.createdAt ? t.createdAt.toMillis() : toMillis(t.createdAt)) : 0;
            // Note: Ideally we'd have a 'completedAt' timestamp. Falling back to createdAt is suboptimal but works for new work.
            return (now - created) < WEEK;
        }).length;

        if (recentCompletions >= 5) {
            score += 15;
            factors.push({
                id: 'high_velocity',
                label: 'High Velocity',
                labelKey: 'health.factors.high_velocity.label',
                description: `${recentCompletions} tasks completed in the last week. Great momentum!`,
                descriptionKey: 'health.factors.high_velocity.description',
                meta: { count: recentCompletions },
                impact: 15,
                type: 'positive'
            });
        } else if (recentCompletions > 0) {
            score += 5;
            factors.push({
                id: 'steady_progress',
                label: 'Steady Progress',
                labelKey: 'health.factors.steady_progress.label',
                description: 'Active progress is being made on project tasks.',
                descriptionKey: 'health.factors.steady_progress.description',
                impact: 5,
                type: 'positive'
            });
        } else if (totalTasks > 5 && progress < 90) {
            score -= 10;
            factors.push({
                id: 'stalled_velocity',
                label: 'Stalled Velocity',
                labelKey: 'health.factors.stalled_velocity.label',
                description: 'No tasks completed in the last 7 days.',
                descriptionKey: 'health.factors.stalled_velocity.description',
                impact: -10,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.breakdownTasks',
                'Consider breaking down large tasks to regain momentum.'
            );
        }

        // Scope Creep: New tasks added in last 7 days vs completions
        const newTasks = tasks.filter(t => {
            const created = t.createdAt ? (typeof t.createdAt === 'object' && 'toMillis' in t.createdAt ? t.createdAt.toMillis() : toMillis(t.createdAt)) : 0;
            return (now - created) < WEEK;
        }).length;

        if (newTasks > recentCompletions + 5 && totalTasks > 10) {
            score -= 10;
            factors.push({
                id: 'scope_creep',
                label: 'Scope Creep',
                labelKey: 'health.factors.scope_creep.label',
                description: 'Tasks are being added faster than they are being completed.',
                descriptionKey: 'health.factors.scope_creep.description',
                impact: -10,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.reviewScope',
                'Review project scope and prioritize essential features.'
            );
        }

        // --- NEW: TASK-LEVEL DEADLINES ---
        const incompleteTasks = tasks.filter(t => !t.isCompleted && t.status !== 'Done');
        const tasksWithDueDate = incompleteTasks.filter(t => t.dueDate);

        let taskDeadlineImpact = 0;
        let overdueCount = 0;
        let dueSoonCount = 0;
        let hasUrgentDeadline = false;

        tasksWithDueDate.forEach(t => {
            const taskDate = new Date(t.dueDate!);
            // Normalize to midnight for calendar comparison
            taskDate.setHours(0, 0, 0, 0);

            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);

            const diffTime = taskDate.getTime() - todayMidnight.getTime();
            const diffDays = diffTime / (24 * 60 * 60 * 1000);

            if (diffDays < 0) {
                // OVERDUE (Yesterday or earlier)
                overdueCount++;
                // Penalty based on priority
                const pBase = t.priority === 'Urgent' ? 12 : t.priority === 'High' ? 8 : 4;
                taskDeadlineImpact -= pBase;
            } else if (diffDays === 0 || diffDays === 1) { // TODAY OR TOMORROW
                hasUrgentDeadline = true;
                dueSoonCount++;
                // Strong impact for orange state
                const pBase = t.priority === 'Urgent' ? 35 : t.priority === 'High' ? 25 : 15;
                taskDeadlineImpact -= pBase;
            } else if (diffDays <= 3 && diffDays >= 0) {
                dueSoonCount++;
                const pBase = t.priority === 'Urgent' ? 10 : t.priority === 'High' ? 8 : 4;
                taskDeadlineImpact -= pBase;
            }
        });

        if (overdueCount > 0) {
            const impact = Math.min(60, Math.abs(taskDeadlineImpact * 2)); // Double impact
            score -= impact;
            factors.push({
                id: 'tasks_overdue',
                label: 'Overdue Tasks',
                labelKey: 'health.factors.tasks_overdue.label',
                description: `${overdueCount} tasks are past their deadline.`,
                descriptionKey: 'health.factors.tasks_overdue.description',
                meta: { count: overdueCount },
                impact: -impact,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.rescheduleOverdue',
                'Complete or reschedule overdue tasks immediately.'
            );
        } else if (dueSoonCount > 0) {
            // Cap the impact to ensure we land in "Warning" (30-49) and not "Critical" (<30)
            // Base 70 - 25 = 45 (Solid Orange)
            const impact = Math.min(25, Math.abs(taskDeadlineImpact * 1.5));
            score -= impact;
            factors.push({
                id: 'tasks_due_soon',
                label: 'Tasks Due Soon',
                labelKey: 'health.factors.tasks_due_soon.label',
                description: `${dueSoonCount} tasks are due within 72 hours.`,
                descriptionKey: 'health.factors.tasks_due_soon.description',
                meta: { count: dueSoonCount },
                impact: -impact,
                type: 'negative'
            });
        }
    }

    // 3. BLOCKERS & ISSUES
    const blockedTasks = tasks.filter(t => t.status === 'Blocked').length;
    if (blockedTasks > 0) {
        const impact = Math.min(25, blockedTasks * 5);
        score -= impact;
        factors.push({
            id: 'blocked_tasks',
            label: 'Task Blockers',
            labelKey: 'health.factors.blocked_tasks.label',
            description: `${blockedTasks} task(s) are currently blocked.`,
            descriptionKey: 'health.factors.blocked_tasks.description',
            meta: { count: blockedTasks },
            impact: -impact,
            type: 'negative'
        });
        addRecommendation(
            'health.recommendations.resolveBlockers',
            'Resolve dependencies or clear blockers for the restricted tasks.'
        );
    }

    const urgentIssues = issues.filter(i => (i.priority === 'Urgent' || i.priority === 'High') && i.status !== 'Resolved' && i.status !== 'Closed').length;
    if (urgentIssues > 0) {
        const impact = Math.min(20, urgentIssues * 4);
        score -= impact;
        factors.push({
            id: 'unresolved_issues',
            label: 'Critical Issues',
            labelKey: 'health.factors.unresolved_issues.label',
            description: `${urgentIssues} high-priority issue(s) remain unresolved.`,
            descriptionKey: 'health.factors.unresolved_issues.description',
            meta: { count: urgentIssues },
            impact: -impact,
            type: 'negative'
        });
        addRecommendation(
            'health.recommendations.addressIssues',
            'Address critical issues to stabilize project health.'
        );
    }

    // 4. ENGAGEMENT & STALENESS
    const lastActivity = activities.length > 0
        ? Math.max(...activities.map(a => a.createdAt ? (typeof a.createdAt === 'object' && 'toMillis' in a.createdAt ? a.createdAt.toMillis() : toMillis(a.createdAt)) : 0))
        : (project.updatedAt ? (typeof project.updatedAt === 'object' && 'toMillis' in project.updatedAt ? project.updatedAt.toMillis() : toMillis(project.updatedAt)) : toMillis(project.createdAt));

    const idleDays = (now - lastActivity) / DAY;

    if (idleDays > 14) {
        score -= 25;
        factors.push({
            id: 'stale_project',
            label: 'Stale Project',
            labelKey: 'health.factors.stale_project.label',
            description: `No activity recorded for over ${Math.floor(idleDays)} days.`,
            descriptionKey: 'health.factors.stale_project.description',
            meta: { days: Math.floor(idleDays) },
            impact: -25,
            type: 'negative'
        });
        addRecommendation(
            'health.recommendations.reactivateProject',
            'Reactivate the project with a status update or team meeting.'
        );
    } else if (idleDays > 7) {
        score -= 10;
        factors.push({
            id: 'inactive_recent',
            label: 'Recent Inactivity',
            labelKey: 'health.factors.inactive_recent.label',
            description: 'No activity in the last 7 days.',
            descriptionKey: 'health.factors.inactive_recent.description',
            impact: -10,
            type: 'neutral'
        });
    } else {
        score += 2;
        factors.push({
            id: 'active_engagement',
            label: 'Highly Engaged',
            labelKey: 'health.factors.active_engagement.label',
            description: 'The project has seen recent activity and team engagement.',
            descriptionKey: 'health.factors.active_engagement.description',
            impact: 2,
            type: 'positive'
        });
    }

    // 5. MILESTONE HEALTH
    const missedMilestones = milestones.filter(m => m.status === 'Missed' || (m.status === 'Pending' && m.dueDate && new Date(m.dueDate).getTime() < now)).length;
    if (missedMilestones > 0) {
        const impact = Math.min(30, missedMilestones * 12);
        score -= impact;
        factors.push({
            id: 'missed_milestones',
            label: 'Milestone Delays',
            labelKey: 'health.factors.missed_milestones.label',
            description: `${missedMilestones} milestone(s) have been missed or are overdue.`,
            descriptionKey: 'health.factors.missed_milestones.description',
            meta: { count: missedMilestones },
            impact: -impact,
            type: 'negative'
        });
        addRecommendation(
            'health.recommendations.replanMilestones',
            'Replan missed milestones to provide a realistic project timeline.'
        );
    }

    // Normalize score
    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status: HealthStatus = 'normal';
    if (score >= 90) status = 'excellent';
    else if (score >= 75) status = 'healthy';
    else if (score >= 50) status = 'normal';
    else if (score >= 30) status = 'warning';
    else status = 'critical';

    // Edge Case: Empty projects shouldn't be "Excellent" or "Healthy"
    if (totalTasks === 0 && (status === 'excellent' || status === 'healthy')) {
        status = 'normal';
        score = Math.min(score, 74);
    }

    // Check for "Stalemate" (Active but no progress for long time)
    if (progress < 100 && idleDays > 30 && status !== 'critical') {
        status = 'stalemate';
    }

    // Simple trend detection (would be better with historical data)
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (score > 80 && recentCompletions > 2) trend = 'improving';
    if (score < 50 && (blockedTasks > 0 || urgentIssues > 0)) trend = 'declining';

    // Force "Warning" (Orange) state if there are urgent deadlines (Today/Tomorrow)
    const hasUrgentDeadline = factors.some(f => f.id === 'tasks_due_soon' || f.id === 'deadline_imminent');
    if (hasUrgentDeadline && status !== 'critical') {
        status = 'warning';
        // Visually sync the score if it's too high for 'warning'
        if (score > 48) score = 48;
    }

    // Sort factors by impact magnitude logic:
    // 1. If status is critical/warning, prioritize negative factors
    // 2. Otherwise sort by absolute impact
    factors.sort((a, b) => {
        if (status === 'critical' || status === 'warning') {
            if (a.type === 'negative' && b.type !== 'negative') return -1;
            if (b.type === 'negative' && a.type !== 'negative') return 1;
        }
        return Math.abs(b.impact) - Math.abs(a.impact);
    });

    const uniqueRecommendations: { key: string; text: string }[] = [];
    const seenRecommendations = new Set<string>();
    recommendationEntries.forEach(recommendation => {
        if (seenRecommendations.has(recommendation.key)) return;
        seenRecommendations.add(recommendation.key);
        uniqueRecommendations.push(recommendation);
    });

    return {
        score,
        status,
        factors,
        recommendations: uniqueRecommendations.map(recommendation => recommendation.text),
        recommendationKeys: uniqueRecommendations.map(recommendation => recommendation.key),
        trend,
        lastUpdated: now
    };
};

export interface SpotlightReason {
    key: string;
    text: string;
    weight: number;
    meta?: Record<string, number | string>;
}

export interface SpotlightScore {
    score: number;
    reasons: SpotlightReason[];  // All contributing reasons with weights
    primaryReason: string;       // Main reason text for display
    primaryReasonKey?: string;   // i18n key for primary reason
    primaryReasonMeta?: Record<string, number | string>;
    // Legacy fields for backwards compatibility
    reason: string;
    reasonKey?: string;
    reasonMeta?: Record<string, number | string>;
}

export const calculateSpotlightScore = (
    project: Project,
    tasks: Task[] = [],
    milestones: Milestone[] = [],
    issues: Issue[] = [],
    sprints: Sprint[] = [],
    activities: Activity[] = []
): SpotlightScore => {
    let score = 0;
    const reasons: SpotlightReason[] = [];
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const WEEK = 7 * DAY;

    const addReason = (key: string, text: string, weight: number, meta?: Record<string, number | string>) => {
        reasons.push({ key, text, weight, meta });
        score += weight;
    };

    // 1. PROJECT DEADLINE URGENCY (Highest Priority Factor)
    if (project.dueDate) {
        const dueTime = new Date(project.dueDate).getTime();
        const daysUntilDue = (dueTime - now) / DAY;

        if (daysUntilDue < 0) {
            const overdueDays = Math.abs(Math.floor(daysUntilDue));
            addReason(
                'health.spotlight.projectOverdue',
                `Project is ${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`,
                100,
                { days: overdueDays }
            );
        } else if (daysUntilDue <= 1) {
            addReason('health.spotlight.projectDueToday', 'Project due today/tomorrow', 60);
        } else if (daysUntilDue <= 3) {
            addReason('health.spotlight.projectDueSoon', `Due in ${Math.ceil(daysUntilDue)} days`, 40, { days: Math.ceil(daysUntilDue) });
        } else if (daysUntilDue <= 7) {
            addReason('health.spotlight.projectDueThisWeek', 'Due this week', 20);
        }
    }

    // 2. HIGH PRIORITY PROJECT BOOST
    if (project.priority === 'Urgent') {
        addReason('health.spotlight.urgentPriority', 'Marked as urgent priority', 30);
    } else if (project.priority === 'High') {
        addReason('health.spotlight.highPriority', 'High priority project', 15);
    }

    // 3. TASK URGENCY ANALYSIS
    const incompleteTasks = tasks.filter(t => !t.isCompleted && t.status !== 'Done');
    let overdueTaskCount = 0;
    let overdueCriticalCount = 0;
    let blockedCount = 0;
    let dueTodayCount = 0;
    let dueSoonCount = 0; // Within 3 days
    let dueThisWeekCount = 0;

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    incompleteTasks.forEach(t => {
        // Count blocked tasks
        if (t.status === 'Blocked') {
            blockedCount++;
        }

        if (!t.dueDate) return;

        const taskDate = new Date(t.dueDate);
        taskDate.setHours(0, 0, 0, 0);
        const diffTime = taskDate.getTime() - todayMidnight.getTime();
        const diffDays = diffTime / DAY;

        if (diffDays < 0) {
            // OVERDUE
            overdueTaskCount++;
            if (t.priority === 'Urgent' || t.priority === 'High') {
                overdueCriticalCount++;
            }
        } else if (diffDays === 0) {
            // DUE TODAY
            dueTodayCount++;
        } else if (diffDays <= 3) {
            // DUE SOON (1-3 days)
            dueSoonCount++;
        } else if (diffDays <= 7) {
            // DUE THIS WEEK
            dueThisWeekCount++;
        }
    });

    // Add task-based reasons with weights
    if (overdueCriticalCount > 0) {
        addReason(
            'health.spotlight.criticalOverdueTasks',
            `${overdueCriticalCount} critical overdue task${overdueCriticalCount !== 1 ? 's' : ''}`,
            overdueCriticalCount * 50,
            { count: overdueCriticalCount }
        );
    } else if (overdueTaskCount > 0) {
        addReason(
            'health.spotlight.overdueTasks',
            `${overdueTaskCount} overdue task${overdueTaskCount !== 1 ? 's' : ''}`,
            overdueTaskCount * 25,
            { count: overdueTaskCount }
        );
    }

    if (dueTodayCount > 0) {
        addReason(
            'health.spotlight.tasksDueToday',
            `${dueTodayCount} task${dueTodayCount !== 1 ? 's' : ''} due today`,
            dueTodayCount * 35,
            { count: dueTodayCount }
        );
    }

    if (dueSoonCount > 0) {
        addReason(
            'health.spotlight.tasksDueSoon',
            `${dueSoonCount} task${dueSoonCount !== 1 ? 's' : ''} due in next 3 days`,
            dueSoonCount * 15,
            { count: dueSoonCount }
        );
    }

    if (blockedCount > 0) {
        addReason(
            'health.spotlight.blockedTasks',
            `${blockedCount} blocked task${blockedCount !== 1 ? 's' : ''} need attention`,
            blockedCount * 20,
            { count: blockedCount }
        );
    }

    // 4. MILESTONE URGENCY
    const pendingMilestones = milestones.filter(m => m.status === 'Pending');
    let overdueMilestones = 0;
    let imminentMilestones = 0;

    pendingMilestones.forEach(m => {
        if (m.dueDate) {
            const dueTime = new Date(m.dueDate).getTime();
            const diffDays = (dueTime - now) / DAY;

            if (dueTime < now) {
                overdueMilestones++;
            } else if (diffDays < 7) {
                imminentMilestones++;
            }
        }
    });

    if (overdueMilestones > 0) {
        addReason(
            'health.spotlight.overdueMilestones',
            `${overdueMilestones} overdue milestone${overdueMilestones !== 1 ? 's' : ''}`,
            overdueMilestones * 60,
            { count: overdueMilestones }
        );
    } else if (imminentMilestones > 0) {
        addReason(
            'health.spotlight.milestonesDueSoon',
            `${imminentMilestones} milestone${imminentMilestones !== 1 ? 's' : ''} due this week`,
            imminentMilestones * 30,
            { count: imminentMilestones }
        );
    }

    // 5. ISSUE PRESSURE
    const openIssues = issues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed');
    const urgentIssues = openIssues.filter(i => i.priority === 'Urgent').length;
    const highPriorityIssues = openIssues.filter(i => i.priority === 'High').length;
    const criticalIssues = urgentIssues + highPriorityIssues;

    if (urgentIssues > 0) {
        addReason(
            'health.spotlight.urgentIssues',
            `${urgentIssues} urgent issue${urgentIssues !== 1 ? 's' : ''} open`,
            urgentIssues * 40,
            { count: urgentIssues }
        );
    } else if (highPriorityIssues > 0) {
        addReason(
            'health.spotlight.highPriorityIssues',
            `${highPriorityIssues} high-priority issue${highPriorityIssues !== 1 ? 's' : ''} open`,
            highPriorityIssues * 20,
            { count: highPriorityIssues }
        );
    }

    // 6. ACTIVITY & ENGAGEMENT (Recent activity indicates active work)
    if (activities.length > 0) {
        const recentActivityCount = activities.filter(a => {
            const createdAt = a.createdAt ? (typeof a.createdAt === 'object' && 'toMillis' in a.createdAt ? a.createdAt.toMillis() : toMillis(a.createdAt)) : 0;
            return (now - createdAt) < WEEK;
        }).length;

        if (recentActivityCount > 10) {
            addReason(
                'health.spotlight.highlyActive',
                'Highly active with recent updates',
                15,
                { activityCount: recentActivityCount }
            );
        } else if (recentActivityCount > 0) {
            addReason(
                'health.spotlight.recentActivity',
                'Recent project activity',
                5,
                { activityCount: recentActivityCount }
            );
        }
    }

    // 7. PROGRESS VS DEADLINE TRACKING
    if (project.dueDate && project.startDate) {
        const startTime = new Date(project.startDate).getTime();
        const dueTime = new Date(project.dueDate).getTime();
        const totalDuration = dueTime - startTime;
        const elapsed = now - startTime;

        if (totalDuration > 0 && elapsed > 0) {
            const expectedProgress = Math.min(100, (elapsed / totalDuration) * 100);
            const actualProgress = project.progress || 0;
            const progressGap = expectedProgress - actualProgress;

            if (progressGap > 30 && actualProgress < 80) {
                addReason(
                    'health.spotlight.behindSchedule',
                    `${Math.round(progressGap)}% behind expected progress`,
                    Math.min(40, progressGap),
                    { gap: Math.round(progressGap), expected: Math.round(expectedProgress), actual: actualProgress }
                );
            }
        }
    }

    // --- SPRINT ANALYSIS ---
    const activeSprints = sprints.filter(s => s.status === 'Active');
    const overdueSprints = sprints.filter(s => s.status === 'Active' && s.endDate && new Date(s.endDate).getTime() < now);

    if (overdueSprints.length > 0) {
        addReason(
            'health.spotlight.overdueSprints',
            `${overdueSprints.length} overdue sprint${overdueSprints.length !== 1 ? 's' : ''}`,
            70,
            { count: overdueSprints.length }
        );
    } else if (activeSprints.length > 0) {
        addReason(
            'health.spotlight.activeSprint',
            'Active sprint in progress',
            10,
            { count: activeSprints.length }
        );
    }

    // 8. LOW PROGRESS WARNING
    if (project.status === 'Active' && (project.progress || 0) < 20) {
        const progress = project.progress || 0;
        if (!reasons.some(r => r.key === 'health.spotlight.behindSchedule')) {
            addReason(
                'health.spotlight.lowProgress',
                `Only ${progress}% complete`,
                20,
                { progress }
            );
        }
    }

    // 9. STATUS WEIGHT
    if (project.status === 'Active') {
        score += 10; // Baseline boost for active projects
    } else if (project.status === 'Brainstorming' || project.status === 'Planning') {
        score -= 500; // Strong penalty for non-active projects
    } else if (project.status === 'On Hold') {
        score -= 200; // Moderate penalty for on-hold
    }

    // Sort reasons by weight (highest first)
    reasons.sort((a, b) => b.weight - a.weight);

    // Build the primary reason - if no urgency reasons, use a fallback
    const primaryReason = reasons[0] || {
        key: 'health.spotlight.recentlyUpdated',
        text: 'Recently updated',
        weight: 0
    };

    // Ensure reasons array has at least the primary reason
    if (reasons.length === 0) {
        reasons.push({
            key: primaryReason.key,
            text: primaryReason.text,
            weight: primaryReason.weight,
        });
    }

    return {
        score,
        reasons,
        primaryReason: primaryReason.text,
        primaryReasonKey: primaryReason.key,
        primaryReasonMeta: primaryReason.meta,
        // Legacy fields
        reason: primaryReason.text,
        reasonKey: primaryReason.key,
        reasonMeta: primaryReason.meta
    };
};

// --- WORKSPACE HEALTH ---

export interface WorkspaceHealth {
    score: number;
    status: HealthStatus;
    breakdown: {
        critical: number;
        warning: number;
        healthy: number;
        excellent: number;
        normal: number;
        total: number;
    };
    trend: 'improving' | 'declining' | 'stable';
}

export const calculateWorkspaceHealth = (projects: Project[], healthMap: Record<string, ProjectHealth>): WorkspaceHealth => {
    if (projects.length === 0) {
        return {
            score: 0,
            status: 'normal',
            breakdown: { critical: 0, warning: 0, healthy: 0, excellent: 0, normal: 0, total: 0 },
            trend: 'stable'
        };
    }

    let totalScore = 0;
    let totalWeight = 0;
    const breakdown = { critical: 0, warning: 0, healthy: 0, excellent: 0, normal: 0, total: 0 };
    let decliningProjects = 0;
    let improvingProjects = 0;

    projects.forEach(p => {
        const health = healthMap[p.id];
        if (!health) return;

        breakdown.total++;
        if (health.status === 'critical') breakdown.critical++;
        else if (health.status === 'warning') breakdown.warning++;
        else if (health.status === 'excellent') breakdown.excellent++;
        else if (health.status === 'healthy') breakdown.healthy++;
        else breakdown.normal++;

        if (health.trend === 'declining') decliningProjects++;
        if (health.trend === 'improving') improvingProjects++;

        // Weighting Logic
        let weight = 1;

        // Critical projects pull the score harder (risk awareness)
        if (health.status === 'critical') weight = 3;
        else if (health.status === 'warning') weight = 2;

        // Planning/Brainstorming projects have less impact
        if (p.status === 'Brainstorming' || p.status === 'Planning') weight = 0.5;

        // Urgent priority projects matter more
        if (p.priority === 'Urgent') weight *= 1.5;

        totalScore += (health.score * weight);
        totalWeight += weight;
    });

    const avgScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    let status: HealthStatus = 'normal';
    if (avgScore >= 90) status = 'excellent';
    else if (avgScore >= 75) status = 'healthy';
    else if (avgScore >= 50) status = 'normal';
    else if (avgScore >= 30) status = 'warning';
    else status = 'critical';

    // Override: If > 20% of projects are critical, workspace cannot be healthy
    if (breakdown.total > 0 && (breakdown.critical / breakdown.total) > 0.2) {
        if (avgScore > 49) status = 'warning';
    }

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (decliningProjects > improvingProjects) trend = 'declining';
    else if (improvingProjects > decliningProjects) trend = 'improving';

    return {
        score: avgScore,
        status,
        breakdown,
        trend
    };
};
