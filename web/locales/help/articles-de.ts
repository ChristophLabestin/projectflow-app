/**
 * Help center content (DE), lazy-loaded by `useHelpContent` as its own chunk.
 * One file per article in `./articles/`; the order here is the order on the help home view.
 */
import type { HelpContent } from '../../components/help/helpTypes';
import gettingStarted from './articles/getting-started-de';
import dashboard from './articles/dashboard-de';
import searchShortcuts from './articles/search-shortcuts-de';
import tasks from './articles/tasks-de';
import projects from './articles/projects-de';
import initiatives from './articles/initiatives-de';
import milestones from './articles/milestones-de';
import sprints from './articles/sprints-de';
import calendar from './articles/calendar-de';
import team from './articles/team-de';
import notifications from './articles/notifications-de';
import cora from './articles/cora-de';
import media from './articles/media-de';
import marketing from './articles/marketing-de';
import finance from './articles/finance-de';
import settings from './articles/settings-de';
import desktop from './articles/desktop-de';

const content: HelpContent = {
    categories: {
        basics: 'Grundlagen',
        work: 'Arbeiten',
        planning: 'Planen',
        collaboration: 'Zusammenarbeit',
        cora: 'CORA & Inhalte',
        workspace: 'Workspace & Apps',
    },
    articles: [
        gettingStarted,
        dashboard,
        searchShortcuts,
        tasks,
        projects,
        initiatives,
        milestones,
        sprints,
        calendar,
        team,
        notifications,
        cora,
        media,
        marketing,
        finance,
        settings,
        desktop,
    ]
};

export default content;
