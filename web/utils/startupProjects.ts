import type { CompanyProjectRole, Initiative, Milestone, Project, StartupTrackId, Task } from '../types';

const STARTUP_READINESS_KEYS: Array<keyof NonNullable<Project['startupReadiness']>> = [
    'legalStructureDecided',
    'founderAgreementReady',
    'ipAssignmentReady',
    'registrationSubmitted',
    'registrationConfirmed',
    'taxSetupReady',
    'bankAccountReady',
    'bookkeepingReady',
    'privacyDocsReady',
    'requiredPermitsKnown',
    'launchOfferReady',
    'firstChannelReady'
];

const isDone = (task: Task) => task.isCompleted || task.status === 'Done';

const isOverdue = (date?: string) => {
    if (!date) return false;
    const target = new Date(date);
    if (Number.isNaN(target.getTime())) return false;
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return target.getTime() < today.getTime();
};

const trackProgress = (tasks: Task[], trackId: StartupTrackId) => {
    const trackTasks = tasks.filter(task => task.templateTrack === trackId);
    if (trackTasks.length === 0) return 0;
    return Math.round((trackTasks.filter(isDone).length / trackTasks.length) * 100);
};

export type StartupReadinessSnapshot = {
    stage: NonNullable<Project['startupProfile']>['formationStatus'];
    formationPercent: number;
    launchGate: 'blocked' | 'watch' | 'ready';
    financePercent: number;
    marketingPercent: number;
    compliancePercent: number;
    selectedTrackCount: number;
    nextFounderAction?: Task;
    blockerCount: number;
    trackProgress: Partial<Record<StartupTrackId, number>>;
    activeInitiativeCount: number;
};

export type CompanyLinkedProjectRollup = {
    total: number;
    activeCount: number;
    completedCount: number;
    overdueCount: number;
    atRiskCount: number;
    averageProgress: number;
    averageHealthScore?: number;
    roles: Partial<Record<CompanyProjectRole, number>>;
    projectsAtRisk: Project[];
};

export const getStartupStageKey = (stage?: NonNullable<Project['startupProfile']>['formationStatus']) => (
    `projectOverview.startup.stage.${stage || 'idea'}`
);

export const calculateStartupReadinessSnapshot = (
    project: Project,
    tasks: Task[] = [],
    milestones: Milestone[] = [],
    initiatives: Initiative[] = []
): StartupReadinessSnapshot => {
    const readiness = project.startupReadiness || {};
    const readyCount = STARTUP_READINESS_KEYS.filter(key => readiness[key] === true).length;
    const formationPercent = Math.round((readyCount / STARTUP_READINESS_KEYS.length) * 100);
    const selectedTrackIds = project.startupProfile?.selectedTrackIds || [];
    const startupTasks = tasks.filter(task => (
        task.templateId === 'startup_company_formation'
        || typeof task.templateTrack === 'string'
        || (Array.isArray(task.category) && task.category.includes('Startup' as any))
    ));
    const openStartupTasks = startupTasks.filter(task => !isDone(task));
    const blockedStartupTasks = openStartupTasks.filter(task => task.status === 'Blocked');
    const overdueStartupTasks = openStartupTasks.filter(task => isOverdue(task.dueDate));
    const overdueMilestones = milestones.filter(milestone => milestone.status === 'Pending' && isOverdue(milestone.dueDate));
    const nextFounderAction = [
        ...blockedStartupTasks,
        ...overdueStartupTasks,
        ...openStartupTasks.filter(task => task.priority === 'Urgent' || task.priority === 'High'),
        ...openStartupTasks
    ][0];
    const productProgress = trackProgress(startupTasks, 'product_delivery');
    const marketingProgress = trackProgress(startupTasks, 'marketing_sales');
    const complianceProgress = trackProgress(startupTasks, 'compliance');
    const complianceReady = readiness.privacyDocsReady === true && readiness.requiredPermitsKnown === true;
    const launchReady = readiness.launchOfferReady === true && readiness.firstChannelReady === true;
    const launchGate = (blockedStartupTasks.length > 0 || overdueMilestones.length > 0)
        ? 'blocked'
        : (launchReady || (productProgress >= 75 && marketingProgress >= 60 && complianceReady))
            ? 'ready'
            : 'watch';

    const progressByTrack = selectedTrackIds.reduce<Partial<Record<StartupTrackId, number>>>((acc, trackId) => {
        acc[trackId] = trackProgress(startupTasks, trackId);
        return acc;
    }, {});

    return {
        stage: project.startupProfile?.formationStatus || 'idea',
        formationPercent,
        launchGate,
        financePercent: Math.round(([
            readiness.taxSetupReady,
            readiness.bankAccountReady,
            readiness.bookkeepingReady
        ].filter(Boolean).length / 3) * 100),
        marketingPercent: Math.max(marketingProgress, readiness.firstChannelReady ? 100 : 0),
        compliancePercent: Math.max(complianceProgress, complianceReady ? 100 : 0),
        selectedTrackCount: selectedTrackIds.length,
        nextFounderAction,
        blockerCount: blockedStartupTasks.length + overdueStartupTasks.length + overdueMilestones.length,
        trackProgress: progressByTrack,
        activeInitiativeCount: initiatives.filter(initiative => (
            initiative.templateId === 'startup_company_formation'
            && initiative.status !== 'Done'
        )).length
    };
};

export const calculateCompanyLinkedProjectRollup = (
    linkedProjects: Project[] = []
): CompanyLinkedProjectRollup => {
    const projects = linkedProjects.filter(project => project.companyProjectId);
    const activeProjects = projects.filter(project => (
        project.status === 'Active'
        || project.status === 'In Testing'
        || project.status === 'Review'
        || project.status === 'Planning'
    ));
    const completedProjects = projects.filter(project => project.status === 'Completed');
    const overdueProjects = projects.filter(project => (
        project.status !== 'Completed'
        && project.status !== 'Canceled'
        && isOverdue(project.dueDate)
    ));
    const atRiskProjects = projects.filter(project => (
        project.healthSnapshot?.status === 'critical'
        || project.healthSnapshot?.status === 'warning'
        || project.healthSnapshot?.status === 'stalemate'
        || project.status === 'On Hold'
        || overdueProjects.some(overdueProject => overdueProject.id === project.id)
    ));
    const healthScores = projects
        .map(project => project.healthSnapshot?.score)
        .filter((score): score is number => typeof score === 'number');

    return {
        total: projects.length,
        activeCount: activeProjects.length,
        completedCount: completedProjects.length,
        overdueCount: overdueProjects.length,
        atRiskCount: atRiskProjects.length,
        averageProgress: projects.length > 0
            ? Math.round(projects.reduce((sum, project) => sum + (project.progress || 0), 0) / projects.length)
            : 0,
        averageHealthScore: healthScores.length > 0
            ? Math.round(healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length)
            : undefined,
        roles: projects.reduce<Partial<Record<CompanyProjectRole, number>>>((acc, project) => {
            const role = project.companyProjectRole || 'other';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {}),
        projectsAtRisk: atRiskProjects
    };
};
