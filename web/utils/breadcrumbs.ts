// Breadcrumb trail for the top bar — the single source for every authenticated route.
//
// Rules (brain/reference/app/STYLING.md "Breadcrumbs"):
// 1. Crumbs show the hierarchy, not the browsing history.
// 2. Only pages with a parent get a trail. Top-level destinations (Dashboard, My Tasks, Calendar,
//    Team, Projects, Notifications, Media, Profile, admin areas, …) return [] —
//    the sidebar marks where you are and the page has its own heading.
// 3. Every crumb except the last links to its page; the back arrow goes one level up.
// 4. Labels are localized; entity titles (task, initiative, post) come from the page via
//    `setTaskTitle` and fall back to a generic label while loading.

type Translate = (key: string, fallback?: string) => string;

export type Crumb = { label: string; to?: string };

export interface BreadcrumbContext {
    t: Translate;
    projectTitle?: string | null;
    /** Parent company project when the current project belongs to one. */
    companyProject?: { id: string; title: string } | null;
    /** Title of the entity a detail page shows (task, initiative, blog post …). */
    entityTitle?: string | null;
}

/** Project sub-pages that are their own section (label key = sidebar label). */
const PROJECT_SECTIONS: Record<string, string> = {
    tasks: 'nav.tasks',
    initiatives: 'nav.initiatives',
    sprints: 'nav.sprints',
    milestones: 'nav.milestones',
    marketing: 'nav.marketing',
    accounting: 'nav.accounting',
    effort: 'nav.effort',
    invoices: 'nav.invoices',
    activity: 'nav.activity',
    details: 'breadcrumbs.details'
};

const projectTrail = (parts: string[], ctx: BreadcrumbContext): Crumb[] => {
    const { t, projectTitle, companyProject, entityTitle } = ctx;
    const [, projectId, section, item, subItem] = parts;
    if (!projectId) return [];
    const base = `/project/${projectId}`;
    const trail: Crumb[] = [{ label: t('breadcrumbs.projects'), to: '/projects' }];
    if (companyProject && companyProject.id !== projectId) {
        trail.push({ label: companyProject.title, to: `/project/${companyProject.id}` });
    }
    trail.push({ label: projectTitle || t('breadcrumbs.loading'), to: base });

    const sectionKey = section ? PROJECT_SECTIONS[section] : undefined;
    if (!sectionKey) return trail;

    if (section === 'marketing') {
        // The marketing module is the blog: its index redirects to the post list.
        trail.push({ label: t(sectionKey), to: `${base}/marketing/blog` });
        if (item === 'blog' && subItem) {
            trail.push({ label: subItem === 'create' ? t('breadcrumbs.newPost') : entityTitle || t('breadcrumbs.post') });
        } else if (item === 'settings') {
            trail.push({ label: t('breadcrumbs.marketingSettings') });
        }
        return trail;
    }

    trail.push({ label: t(sectionKey), to: `${base}/${section}` });
    if (item && section === 'tasks') trail.push({ label: entityTitle || t('breadcrumbs.taskDetails') });
    if (item && section === 'initiatives') trail.push({ label: entityTitle || t('breadcrumbs.initiativeDetails') });
    return trail;
};

const rawTrail = (parts: string[], ctx: BreadcrumbContext): Crumb[] => {
    const { t, entityTitle } = ctx;
    const [root, first] = parts;
    switch (root) {
        case 'project':
            return projectTrail(parts, ctx);
        case 'personal-tasks':
            return first
                ? [{ label: t('breadcrumbs.personalTasks'), to: '/personal-tasks' }, { label: entityTitle || t('breadcrumbs.taskDetails') }]
                : [];
        case 'admin':
            return first === 'crashes' && parts[2]
                ? [{ label: t('crashAdmin.title'), to: '/admin/crashes' }, { label: entityTitle || t('breadcrumbs.crashIssue') }]
                : [];
        default:
            return [];
    }
};

export const buildBreadcrumbs = (pathname: string, ctx: BreadcrumbContext): Crumb[] => {
    const parts = pathname.split('/').filter(Boolean);
    const trail = rawTrail(parts, ctx);
    if (trail.length < 2) return [];
    // The current page is plain text.
    return trail.map((crumb, index) => (index === trail.length - 1 ? { label: crumb.label } : crumb));
};
