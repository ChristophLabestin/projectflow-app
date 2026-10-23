import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'desktop',
    category: 'workspace',
    icon: 'desktop_mac',
    title: 'Desktop app',
    summary: 'Install ProjectFlow on macOS or Windows and capture tasks, focus and plan your day from anywhere.',
    keywords: ['desktop', 'app', 'download', 'install', 'mac', 'macos', 'windows', 'tray', 'menu bar', 'quick capture', 'quick access', 'focus', 'spotlight', 'command palette', 'screenshot', 'shortcuts', 'update'],
    sections: [
        {
            id: 'install',
            title: 'How do I get the desktop app?',
            keywords: ['download', 'install', 'macos', 'windows', 'requirements', 'update', 'sign in'],
            blocks: [
                { type: 'text', text: 'Open the [download page](/download), pick your platform and sign in with your existing account. The app is available for macOS 12 or later (Apple Silicon and Intel) and Windows 10 or 11 (64-bit and ARM).' },
                {
                    type: 'steps',
                    items: [
                        'macOS: open the downloaded .dmg and drag ProjectFlow into the Applications folder.',
                        'Windows: run the downloaded installer; it sets up ProjectFlow and starts it right away.',
                        'Start ProjectFlow and sign in with your account.',
                    ],
                },
                { type: 'text', text: 'Updates install automatically.' },
            ],
        },
        {
            id: 'capture',
            title: 'How do I capture a task from any app?',
            keywords: ['quick capture', 'global shortcut', 'screenshot', 'quick access', 'floating window'],
            blocks: [
                { type: 'text', text: '**Quick Capture** lets you add a task without opening the main window. Set the global shortcut in the settings, **Desktop app** tab, under **Quick capture**. The same tab has a shortcut for the floating **Quick Access window**.' },
                { type: 'text', text: 'With **Screenshot to task** you select an area of the screen and Quick Capture opens with the image attached.' },
                { type: 'callout', tone: 'tip', text: 'If a shortcut is already used by another app, ProjectFlow keeps your previous one and tells you.' },
            ],
        },
        {
            id: 'focus-and-day',
            title: 'Focus, tray and daily rhythm',
            keywords: ['tray', 'menu bar', 'focus', 'pause', 'day start', 'day close', 'meetings', 'calendar', 'media key', 'touch bar'],
            blocks: [
                { type: 'text', text: 'The tray (menu bar on macOS) shows your tasks on the tabs **Today**, **Pinned** and **Inbox**, plus your current **Focus**. Pick a task to start a focus, and pause it for 30 minutes when you need a break.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Day start', text: 'Shows your plan for the day when you first unlock your computer in the morning.' },
                        { term: 'Day close', text: 'Offers to wrap up the day at a time you choose, only while you are at the computer.' },
                        { term: 'Calendar & meetings', text: 'Reads upcoming meetings from the calendars on your Mac to offer pausing your focus before a meeting and capturing notes afterwards. Nothing is uploaded.' },
                        { term: 'Focus shortcuts', text: 'Run a macOS Shortcut when a focus starts or ends, for example to switch a Focus mode on.' },
                    ],
                },
                { type: 'text', text: 'You can also let the Play/Pause media key pause and resume your focus. On Macs with a Touch Bar, the focus task and quick actions appear there automatically.' },
            ],
        },
        {
            id: 'search-and-settings',
            title: 'Spotlight, command palette and settings',
            keywords: ['spotlight', 'command palette', 'launch at login', 'settings', 'preferences'],
            blocks: [
                { type: 'text', text: 'On macOS you can find projects and your open tasks in **Spotlight** (stored only on your Mac). The **Command palette** searches projects and tasks from anywhere, and you can open, complete or focus them.' },
                { type: 'text', text: 'Turn these on or off, and set **Open at login**, in the settings under the **Desktop app** tab. That tab only appears inside the desktop app.' },
            ],
        },
        {
            id: 'shortcuts',
            title: 'Which keyboard shortcuts does the app add?',
            keywords: ['keyboard', 'shortcuts', 'menu', 'zoom', 'back', 'forward', 'new window'],
            blocks: [
                {
                    type: 'shortcuts',
                    items: [
                        { keys: ['⌘', 'N'], label: 'New task' },
                        { keys: ['⌘', '⇧', 'N'], label: 'New project' },
                        { keys: ['⌘', '⌥', 'N'], label: 'New window' },
                        { keys: ['⌘', '1'], label: 'Dashboard (⌘2 Projects, ⌘3 Tasks, ⌘4 Calendar, ⌘5 Notifications)' },
                        { keys: ['⌘', '['], label: 'Back (⌘ ] forward)' },
                        { keys: ['⌘', '0'], label: 'Actual size (⌘ + and ⌘ - zoom)' },
                    ],
                },
                { type: 'callout', tone: 'note', text: 'On Windows use Ctrl instead of ⌘ and Alt instead of ⌥. Back and forward are Alt+← and Alt+→ there.' },
            ],
        },
    ],
};

export default article;
