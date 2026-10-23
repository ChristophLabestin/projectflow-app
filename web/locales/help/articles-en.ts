/**
 * Help center content (EN), lazy-loaded by `useHelpContent` as its own chunk.
 * One file per article in `./articles/`; the order here is the order on the help home view.
 */
import type { HelpContent } from '../../components/help/helpTypes';
import gettingStarted from './articles/getting-started-en';
import dashboard from './articles/dashboard-en';
import searchShortcuts from './articles/search-shortcuts-en';
import tasks from './articles/tasks-en';
import projects from './articles/projects-en';
import initiatives from './articles/initiatives-en';
import milestones from './articles/milestones-en';
import sprints from './articles/sprints-en';
import calendar from './articles/calendar-en';
import team from './articles/team-en';
import notifications from './articles/notifications-en';
import media from './articles/media-en';
import marketing from './articles/marketing-en';
import finance from './articles/finance-en';
import settings from './articles/settings-en';
import desktop from './articles/desktop-en';

const content: HelpContent = {
    categories: {
        basics: 'Basics',
        work: 'Work',
        planning: 'Planning',
        collaboration: 'Collaboration',
        ai: 'AI & content',
        workspace: 'Workspace & apps',
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
        media,
        marketing,
        finance,
        settings,
        desktop,
    ]
};

export default content;
