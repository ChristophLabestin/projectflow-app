import { describe, expect, it } from 'vitest';
import { buildBreadcrumbs } from '../breadcrumbs';

const t = (key: string) => ({
    'breadcrumbs.projects': 'Projects',
    'breadcrumbs.loading': 'Loading...',
    'breadcrumbs.taskDetails': 'Task details',
    'breadcrumbs.initiativeDetails': 'Initiative details',
    'breadcrumbs.details': 'Project details',
    'breadcrumbs.newPost': 'New post',
    'breadcrumbs.post': 'Post',
    'breadcrumbs.marketingSettings': 'Blog settings',
    'breadcrumbs.personalTasks': 'Personal tasks',
    'breadcrumbs.crashIssue': 'Issue',
    'crashAdmin.title': 'Crash reports',
    'nav.tasks': 'Tasks',
    'nav.initiatives': 'Initiatives',
    'nav.marketing': 'Marketing',
    'nav.sprints': 'Sprints',
    'nav.finance': 'Finance',
    'finance.v2.nav.bookings': 'Bookings'
} as Record<string, string>)[key] ?? key;

const build = (path: string, extra: Record<string, unknown> = {}) => buildBreadcrumbs(path, { t, projectTitle: 'Website', ...extra });

describe('buildBreadcrumbs', () => {
    it('shows no trail on top-level destinations', () => {
        for (const path of ['/', '/tasks', '/calendar', '/team', '/projects', '/notifications', '/media', '/profile',
            '/personal-tasks', '/finance', '/finance/cockpit', '/admin/crashes', '/admin/legal', '/unknown']) {
            expect(build(path), path).toEqual([]);
        }
    });

    it('builds the project trail and links every crumb but the last', () => {
        expect(build('/project/p1')).toEqual([{ label: 'Projects', to: '/projects' }, { label: 'Website' }]);
        expect(build('/project/p1/sprints')).toEqual([
            { label: 'Projects', to: '/projects' },
            { label: 'Website', to: '/project/p1' },
            { label: 'Sprints' }
        ]);
    });

    it('uses the entity title on detail pages and a generic label while loading', () => {
        expect(build('/project/p1/tasks/t1', { entityTitle: 'Hero copy' }).map((crumb) => crumb.label))
            .toEqual(['Projects', 'Website', 'Tasks', 'Hero copy']);
        expect(build('/project/p1/initiatives/i1').at(-1)).toEqual({ label: 'Initiative details' });
        expect(build('/project/p1', { projectTitle: null }).at(-1)).toEqual({ label: 'Loading...' });
    });

    it('nests a client project under its company project', () => {
        expect(build('/project/p2/tasks', { companyProject: { id: 'c1', title: 'ACME' } }).map((crumb) => crumb.to))
            .toEqual(['/projects', '/project/c1', '/project/p2', undefined]);
    });

    it('treats marketing as the blog', () => {
        expect(build('/project/p1/marketing/blog').map((crumb) => crumb.label)).toEqual(['Projects', 'Website', 'Marketing']);
        expect(build('/project/p1/marketing/blog/create').at(-1)).toEqual({ label: 'New post' });
        expect(build('/project/p1/marketing/settings')[2]).toEqual({ label: 'Marketing', to: '/project/p1/marketing/blog' });
    });

    it('covers personal task detail, finance sections and crash issues', () => {
        expect(build('/personal-tasks/x', { entityTitle: 'Renew passport' })).toEqual([
            { label: 'Personal tasks', to: '/personal-tasks' }, { label: 'Renew passport' }
        ]);
        expect(build('/finance/bookings')).toEqual([{ label: 'Finance', to: '/finance/cockpit' }, { label: 'Bookings' }]);
        expect(build('/finance/unknown-section')).toEqual([]);
        expect(build('/admin/crashes/abc').map((crumb) => crumb.label)).toEqual(['Crash reports', 'Issue']);
    });
});
