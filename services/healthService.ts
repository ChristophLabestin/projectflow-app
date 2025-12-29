import { Project, Task, Milestone, Issue, Activity, Comment } from '../types';
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

export interface SpotlightScore {
    score: number;
    reason: string;
    reasonKey?: string;
    reasonMeta?: Record<string, number | string>;
}

export const calculateSpotlightScore = (
    project: Project,
    tasks: Task[] = [],
    milestones: Milestone[] = [],
    issues: Issue[] = []
): SpotlightScore => {
    let score = 0;
    const reasons: { key: string; text: string; meta?: Record<string, number | string> }[] = [];
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const addReason = (key: string, text: string, meta?: Record<string, number | string>) => {
        reasons.push({ key, text, meta });
    };

    // 1. Project Deadline Urgency
    if (project.dueDate) {
        const dueTime = new Date(project.dueDate).getTime();
        const daysUntilDue = (dueTime - now) / DAY;

        if (daysUntilDue < 0) {
            score += 100; // Immediate top priority
            addReason('health.spotlight.projectOverdue', 'Project is overdue');
        } else if (daysUntilDue <= 3) {
            score += 40;
            addReason('health.spotlight.projectDueSoon', 'Due in < 3 days');
        } else if (daysUntilDue <= 7) {
            score += 20;
            addReason('health.spotlight.projectDueThisWeek', 'Due this week');
        }
    }

    // 2. High Priority Project Boost
    if (project.priority === 'High' || project.priority === 'Urgent') {
        score += 20;
    }

    // 3. Task Urgency (Overdue, High Priority, Blocked)
    const incompleteTasks = tasks.filter(t => !t.isCompleted && t.status !== 'Done');
    let overduecritical = 0;
    let blockedCount = 0;
    let dueSoonCount = 0;

    incompleteTasks.forEach(t => {
        if (t.status === 'Blocked') {
            score += 15; // Inreased from 5
            blockedCount++;
        }

        if (!t.dueDate) return;

        const taskDate = new Date(t.dueDate);
        taskDate.setHours(0, 0, 0, 0);

        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        const diffTime = taskDate.getTime() - todayMidnight.getTime();
        const diffDays = diffTime / DAY; // -1, 0, 1, ...

        if (diffDays < 0) {
            // PAST DUE (Yesterday or earlier)
            if (t.priority === 'Urgent') {
                score += 80;
                overduecritical++;
            } else if (t.priority === 'High') {
                score += 50;
                overduecritical++;
            } else {
                score += 20;
            }
        } else if (diffDays === 1) { // TOMORROW
            // DUE TOMORROW (Massive Priority Boost)
            if (t.priority === 'Urgent') score += 70;
            else if (t.priority === 'High') score += 50;
            else score += 30;
            dueSoonCount++;
        } else if (diffDays <= 3 && diffDays >= 0) {
            // DUE IN < 3 DAYS (0=Today, 1=Tomorrow, 2, 3)
            if (t.priority === 'Urgent') score += 40;
            else if (t.priority === 'High') score += 30;
            else score += 15;
            dueSoonCount++;
        } else if (diffDays <= 7 && diffDays >= 0) {
            // DUE IN < 7 DAYS
            if (t.priority === 'Urgent') score += 20;
            else if (t.priority === 'High') score += 15;
            else score += 10;
        }
    });

    if (overduecritical > 0) {
        addReason(
            'health.spotlight.criticalOverdueTasks',
            `${overduecritical} critical overdue tasks`,
            { count: overduecritical }
        );
    }
    if (blockedCount > 0) {
        if (reasons.length === 0) {
            addReason(
                'health.spotlight.blockedTasks',
                `${blockedCount} blocked tasks`,
                { count: blockedCount }
            );
        }
    }

    // 4. Milestone Urgency
    const pendingMilestones = milestones.filter(m => m.status === 'Pending');
    let overdueMilestones = 0;
    let imminentMilestones = 0; // < 7 days

    pendingMilestones.forEach(m => {
        if (m.dueDate) {
            const dueTime = new Date(m.dueDate).getTime();
            const diffDays = (dueTime - now) / DAY;

            if (dueTime < now) {
                score += 100; // Missed milestone is a major failure
                overdueMilestones++;
            } else if (diffDays < 7) {
                score += 40; // Approaching milestone (< 7 days) gets significant points
                imminentMilestones++;
            }
        }
    });

    if (overdueMilestones > 0) {
        addReason(
            'health.spotlight.overdueMilestones',
            `${overdueMilestones} overdue milestones`,
            { count: overdueMilestones }
        );
    } else if (imminentMilestones > 0) {
        addReason(
            'health.spotlight.milestonesDueSoon',
            `${imminentMilestones} milestones due soon`,
            { count: imminentMilestones }
        );
    }

    // 5. Issue Pressure
    const urgentIssues = issues.filter(i => (i.priority === 'Urgent' || i.priority === 'High') && i.status !== 'Resolved' && i.status !== 'Closed').length;
    if (urgentIssues > 0) {
        score += (urgentIssues * 20);
        if (reasons.length === 0) {
            addReason(
                'health.spotlight.urgentIssues',
                `${urgentIssues} urgent issues`,
                { count: urgentIssues }
            );
        }
    }

    // 6. Status Weight (Active projects > Planning)
    if (project.status === 'Active') {
        score += 5;
    } else if (project.status === 'Brainstorming' || project.status === 'Planning') {
        score -= 1000; // strong penalty (filter out unless they have massive urgency)
    }

    const primaryReason = reasons[0] || { key: 'health.spotlight.generalUpdate', text: 'General Update' };

    return {
        score,
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
