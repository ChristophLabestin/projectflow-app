import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'search-shortcuts',
    category: 'basics',
    icon: 'keyboard',
    title: 'Search and shortcuts',
    summary: 'Jump anywhere with search, narrow results with prefixes and filters, and work faster with keyboard shortcuts.',
    keywords: ['search', 'find', 'command palette', 'keyboard', 'shortcuts', 'hotkeys', 'keys', 'filter', 'is:overdue', 'prio:high', 'quick access'],
    sections: [
        {
            id: 'open-search',
            title: 'How do I open search?',
            keywords: ['cmd k', 'ctrl k', 'slash', 'global search'],
            blocks: [
                { type: 'text', text: 'Click the search field in the top bar, or use a shortcut. Search finds projects, tasks, pages, actions and Help Center topics.' },
                {
                    type: 'shortcuts',
                    items: [
                        { keys: ['⌘', 'K'], label: 'Open or close search (Ctrl + K on Windows and Linux)' },
                        { keys: ['/'], label: 'Open search when you are not typing in a field' },
                    ],
                },
                { type: 'text', text: 'Empty search shows recently opened items and recent searches. Click **Clear** to remove your history.' },
            ],
        },
        {
            id: 'narrow-results',
            title: 'How do I narrow down results?',
            keywords: ['prefix', 'filter', 'overdue', 'mine', 'priority', 'scope', 'commands', 'actions'],
            blocks: [
                { type: 'text', text: 'Start your search with a prefix to limit the result type.' },
                {
                    type: 'terms',
                    items: [
                        { term: '>', text: 'Actions, for example **Create task** or **Create project**.' },
                        { term: '#', text: 'Projects only.' },
                        { term: '!', text: 'Tasks only.' },
                        { term: '?', text: 'Help topics only.' },
                    ],
                },
                { type: 'text', text: 'For tasks you can add filters: `is:overdue` for overdue tasks, `is:mine` for tasks assigned to you and `prio:high` for high priority. Combine them with words, for example `is:mine prio:high launch`.' },
                { type: 'callout', tone: 'tip', text: 'Press Tab to cycle through the result filters, such as **All** and **Pages & actions**.' },
            ],
        },
        {
            id: 'navigate-results',
            title: 'How do I move through results?',
            keywords: ['arrow keys', 'enter', 'new tab', 'escape'],
            blocks: [
                {
                    type: 'shortcuts',
                    items: [
                        { keys: ['↑', '↓'], label: 'Move through results' },
                        { keys: ['Home'], label: 'Jump to the first result (with an empty search field)' },
                        { keys: ['End'], label: 'Jump to the last result (with an empty search field)' },
                        { keys: ['Enter'], label: 'Open the selected result' },
                        { keys: ['⌘', 'Enter'], label: 'Open it in a new tab (Ctrl + Enter on Windows and Linux)' },
                        { keys: ['Esc'], label: 'Clear the text, then the filter, then close search' },
                    ],
                },
            ],
        },
        {
            id: 'shortcuts',
            title: 'Which keyboard shortcuts are there?',
            keywords: ['hotkeys', 'new task', 'select', 'pinned tasks', 'quick access', 'help'],
            blocks: [
                { type: 'text', text: 'These shortcuts work in the web app. On Windows and Linux, use Ctrl instead of ⌘ and Alt instead of Option.' },
                {
                    type: 'shortcuts',
                    items: [
                        { keys: ['?'], label: 'Open or close the Help Center' },
                        { keys: ['⌥', 'T'], label: 'Create a task in your pinned project (needs a pinned project)' },
                        { keys: ['⌘', '⇧', 'F'], label: 'Open quick access to your pinned tasks' },
                        { keys: ['N'], label: 'Focus the quick add field on **My Tasks** and on a project\'s **Tasks**' },
                        { keys: ['X'], label: 'Select the focused task row' },
                        { keys: ['⇧', 'X'], label: 'Select a range of rows' },
                        { keys: ['Esc'], label: 'Clear the selection or close an open panel' },
                    ],
                },
                { type: 'callout', tone: 'note', text: 'Single-key shortcuts such as `N`, `X` and `?` do not work while you are typing in a text field.' },
            ],
        },
    ],
};

export default article;
