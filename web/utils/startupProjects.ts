import type { CompanyProjectRole, Initiative, Milestone, Project, StartupReadiness, StartupTrackId, Task } from '../types';

type StartupReadinessKey = keyof StartupReadiness;
type StartupStage = NonNullable<Project['startupProfile']>['formationStatus'];

const STARTUP_READINESS_KEYS: StartupReadinessKey[] = [
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

// Each readiness item can be satisfied automatically when one of its mapped seed tasks
// (matched by `templateSeedId`) is completed. This keeps readiness in sync with the real
// work instead of being a parallel, dead source of truth. Manual overrides still win.
const READINESS_TASK_SEED_MAP: Partial<Record<StartupReadinessKey, string[]>> = {
    legalStructureDecided: ['legal-structure', 'de-choose-legal-form', 'us-entity-state-registration'],
    founderAgreementReady: ['legal-founder-agreement'],
    registrationSubmitted: ['legal-registration', 'de-register-business-and-tax', 'us-entity-state-registration'],
    taxSetupReady: ['finance-bank-tax', 'de-register-business-and-tax', 'us-ein-and-tax-setup'],
    bankAccountReady: ['finance-bank-tax'],
    bookkeepingReady: ['finance-bookkeeping'],
    privacyDocsReady: ['compliance-privacy'],
    requiredPermitsKnown: ['compliance-permits', 'de-authorities-and-permits', 'us-licenses-permits-insurance'],
    launchOfferReady: ['product-offer'],
    firstChannelReady: ['marketing-channel']
};

const STAGE_ORDER: StartupStage[] = ['idea', 'validating', 'preparing', 'filed', 'registered', 'operating'];

// Readiness items that are logically already complete once a company reaches a given stage.
// Lets a founder register an already-operating company without showing 0% readiness.
const STAGE_READINESS_DEFAULTS: Record<NonNullable<StartupStage>, StartupReadinessKey[]> = {
    idea: [],
    validating: [],
    preparing: ['legalStructureDecided'],
    filed: ['legalStructureDecided', 'founderAgreementReady', 'registrationSubmitted'],
    registered: [
        'legalStructureDecided',
        'founderAgreementReady',
        'registrationSubmitted',
        'registrationConfirmed',
        'taxSetupReady',
        'bankAccountReady'
    ],
    operating: [...STARTUP_READINESS_KEYS]
};

export type StartupStagePhase = 'discover' | 'form' | 'operate';

export const getStartupStagePhase = (stage?: StartupStage): StartupStagePhase => {
    switch (stage) {
        case 'operating':
            return 'operate';
        case 'preparing':
        case 'filed':
        case 'registered':
            return 'form';
        case 'idea':
        case 'validating':
        default:
            return 'discover';
    }
};

export const getStageReadinessDefaults = (stage?: StartupStage): StartupReadiness => {
    const keys = STAGE_READINESS_DEFAULTS[stage || 'idea'] || [];
    return keys.reduce<StartupReadiness>((acc, key) => {
        acc[key] = true;
        return acc;
    }, {});
};

// Effective readiness = stored override OR any mapped seed task completed.
export const resolveStartupReadiness = (
    project: Pick<Project, 'startupReadiness'>,
    tasks: Task[] = []
): StartupReadiness => {
    const stored = project.startupReadiness || {};
    const completedSeedIds = new Set(
        tasks
            .filter(task => (task.isCompleted || task.status === 'Done') && typeof task.templateSeedId === 'string')
            .map(task => task.templateSeedId as string)
    );
    return STARTUP_READINESS_KEYS.reduce<StartupReadiness>((acc, key) => {
        const seedIds = READINESS_TASK_SEED_MAP[key];
        const derivedComplete = Boolean(seedIds && seedIds.some(seedId => completedSeedIds.has(seedId)));
        acc[key] = stored[key] === true || derivedComplete;
        return acc;
    }, {});
};

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
    phase: StartupStagePhase;
    readiness: StartupReadiness;
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
    const readiness = resolveStartupReadiness(project, tasks);
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
    const stage = project.startupProfile?.formationStatus || 'idea';
    const phase = getStartupStagePhase(stage);
    const complianceReady = readiness.privacyDocsReady === true && readiness.requiredPermitsKnown === true;
    const launchReady = readiness.launchOfferReady === true && readiness.firstChannelReady === true;
    const launchGate = (blockedStartupTasks.length > 0 || overdueMilestones.length > 0)
        ? 'blocked'
        : (phase === 'operate' || launchReady || (productProgress >= 75 && marketingProgress >= 60 && complianceReady))
            ? 'ready'
            : 'watch';

    const progressByTrack = selectedTrackIds.reduce<Partial<Record<StartupTrackId, number>>>((acc, trackId) => {
        acc[trackId] = trackProgress(startupTasks, trackId);
        return acc;
    }, {});

    return {
        stage,
        phase,
        readiness,
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
