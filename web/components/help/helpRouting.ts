export type HelpContextTarget = { articleId: string; sectionId?: string };

/** Ordered: first match wins. Article/section ids must exist in `web/locales/help/articles/*`. */
const ROUTE_CONTEXT: { pattern: RegExp; target: HelpContextTarget }[] = [
    { pattern: /^\/project\/[^/]+\/initiatives/, target: { articleId: 'initiatives' } },
    { pattern: /^\/project\/[^/]+\/tasks/, target: { articleId: 'tasks' } },
    { pattern: /^\/project\/[^/]+\/milestones/, target: { articleId: 'milestones' } },
    { pattern: /^\/project\/[^/]+\/sprints/, target: { articleId: 'sprints' } },
    { pattern: /^\/project\/[^/]+\/marketing/, target: { articleId: 'marketing' } },
    { pattern: /^\/project\/[^/]+\/(effort|invoices)/, target: { articleId: 'projects', sectionId: 'client-projects' } },
    { pattern: /^\/project\//, target: { articleId: 'projects' } },
    { pattern: /^\/projects/, target: { articleId: 'projects' } },
    { pattern: /^\/(tasks|personal-tasks)/, target: { articleId: 'tasks' } },
    { pattern: /^\/calendar/, target: { articleId: 'calendar' } },
    { pattern: /^\/finance/, target: { articleId: 'finance' } },
    { pattern: /^\/media/, target: { articleId: 'media' } },
    { pattern: /^\/team/, target: { articleId: 'team' } },
    { pattern: /^\/notifications/, target: { articleId: 'notifications' } },
    { pattern: /^\/(profile|settings)/, target: { articleId: 'settings' } },
    { pattern: /^\/(download|desktop)/, target: { articleId: 'desktop' } },
    { pattern: /^\/$/, target: { articleId: 'dashboard' } }
];

/** Help article that fits the current screen; shown as "For this page" on the help home view. */
export const getHelpContextForPath = (pathname: string): HelpContextTarget => {
    const path = pathname.toLowerCase();
    return ROUTE_CONTEXT.find(entry => entry.pattern.test(path))?.target ?? { articleId: 'getting-started' };
};
