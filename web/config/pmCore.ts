import type { ProjectModule } from '../types';

/** Default modules for new projects in PM-core mode. */
export const PM_CORE_DEFAULT_MODULES: ProjectModule[] = [
    'tasks',
    'initiatives',
    'sprints',
    'milestones',
    'activity',
    'social',
    'marketing',
    'accounting',
];

/** Legacy module ids hidden from project nav and create wizard when PM core is active. */
export const PM_CORE_DEPRECATED_MODULES = ['ideas', 'flows', 'issues'] as const;

/** Project nav item ids shown by default in PM-core mode (order). */
export const PM_CORE_PROJECT_NAV_ORDER = [
    'overview',
    'tasks',
    'initiatives',
    'sprints',
    'milestones',
    'social',
    'marketing',
    'accounting',
    'activity',
    'codex',
] as const;

/** Workspace nav paths that move under Advanced when PM core is active. */
export const PM_CORE_ADVANCED_WORKSPACE_PATHS = ['/finance', '/brainstorm', '/team', '/media'] as const;

const readPmCoreEnv = (): boolean => {
    const raw = import.meta.env.VITE_PM_CORE_ONLY;
    if (raw === undefined || raw === '') return true;
    return raw !== 'false' && raw !== '0';
};

export const isPmCoreOnly = (): boolean => readPmCoreEnv();

export const normalizeModulesForPmCore = (modules: ProjectModule[]): ProjectModule[] => {
    if (!isPmCoreOnly()) return modules;
    const filtered = modules.filter((m) => !PM_CORE_DEPRECATED_MODULES.includes(m as any));
    return Array.from(new Set<ProjectModule>([...PM_CORE_DEFAULT_MODULES, ...filtered]));
};

export const filterModulesForWizardOptions = (modules: ProjectModule[]): ProjectModule[] => {
    if (!isPmCoreOnly()) return modules;
    return modules.filter((m) => !PM_CORE_DEPRECATED_MODULES.includes(m as any));
};

export const isDeprecatedProjectNavId = (navId: string): boolean => {
    if (!isPmCoreOnly()) return false;
    return PM_CORE_DEPRECATED_MODULES.includes(navId as any);
};

export const PM_CORE_DEPRECATED_ERROR = 'PM_CORE_DEPRECATED';
