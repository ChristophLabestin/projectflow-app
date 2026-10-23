import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'settings',
    category: 'workspace',
    icon: 'settings',
    title: 'Settings',
    summary: 'Personal settings and workspace settings: where to find them and what you can change.',
    keywords: ['settings', 'preferences', 'language', 'date format', 'password', 'security', '2fa', 'passkey', 'notifications', 'workspace settings', 'roles', 'members', 'api', 'mcp', 'danger zone', 'delete workspace'],
    sections: [
        {
            id: 'open-settings',
            title: 'Where do I find the settings?',
            keywords: ['open', 'modal', 'user menu', 'workspace settings'],
            blocks: [
                { type: 'text', text: 'Settings open as a window on top of the page, not as a separate page. There are two groups: your **personal** settings, and the settings of the **current workspace** (**Workspace settings**). Personal settings open from your **user menu**; **Workspace settings** is an entry in the workspace menu at the top of the sidebar.' },
                { type: 'text', text: 'Personal settings apply to your account in every workspace. Workspace settings apply to the workspace you are currently in.' },
            ],
        },
        {
            id: 'personal',
            title: 'What can I change for myself?',
            keywords: ['account', 'preferences', 'language', 'date format', 'password', 'email verification', 'connected accounts', 'pre-alpha', 'gemini'],
            blocks: [
                {
                    type: 'terms',
                    items: [
                        { term: 'Account', text: 'Profile, **Password** (change it, or set one to enable email and password sign-in), **Email Verification** and **Connected Accounts**.' },
                        { term: 'Preferences', text: 'The **Language** of the app and the **Date Format**.' },
                        { term: 'Notifications', text: 'What reaches you by push and email, plus your morning briefing and day close. See the Notifications article.' },
                        { term: 'Desktop app', text: 'Only visible in the desktop app. See the Desktop app article.' },
                        { term: 'Security', text: '**Two-Factor Authentication** and **Passkeys** (sign in with Face ID, Touch ID or Windows Hello).' },
                        { term: 'Pre-Alpha Config', text: 'Your personal Gemini API key and monthly token limit for CORA during the pre-alpha period.' },
                    ],
                },
            ],
        },
        {
            id: 'workspace-settings',
            title: 'What can I change for the workspace?',
            keywords: ['workspace', 'name', 'website', 'contact email', 'members', 'invite', 'roles', 'email', 'storage', 'smtp', 'ai', 'integrations'],
            blocks: [
                { type: 'text', text: 'Only owners and admins can change workspace settings. Everyone else sees at most some sections, without being able to change them.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Workspace', text: 'Name, website, contact email and description.' },
                        { term: 'Members', text: 'An overview of people, guests and open invitations, with **Manage members & invitations** and **Invite**.' },
                        { term: 'Roles', text: 'Custom roles and their permissions. Visible to owners and admins.' },
                        { term: 'Email & storage', text: 'Email delivery and file storage for the workspace, plus **Restart onboarding** for the dashboard tour. Visible to owners and admins.' },
                        { term: 'AI & integrations', text: 'AI settings and connected services for the workspace.' },
                        { term: 'API & MCP', text: 'API tokens and access for external tools. Visible to the workspace Owner only.' },
                        { term: 'Danger zone', text: '**Leave workspace**, **Transfer ownership** and **Delete workspace**.' },
                    ],
                },
            ],
        },
        {
            id: 'secure-account',
            title: 'How do I secure my account?',
            keywords: ['2fa', 'two-factor', 'passkey', 'face id', 'touch id', 'windows hello', 'password'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Open your user menu and choose the settings, then **Security**.',
                        'Under **Two-Factor Authentication** click **Enable** (or **Manage** if it is already on).',
                        'Under **Passkeys** click **Add Passkey** and confirm with your device. You can rename or remove a passkey later.',
                    ],
                },
                { type: 'callout', tone: 'tip', text: 'A passkey lets you sign in with your fingerprint, face or device PIN, with no password to remember.' },
            ],
        },
        {
            id: 'leave-or-delete',
            title: 'How do I leave, hand over or delete a workspace?',
            keywords: ['leave', 'transfer ownership', 'delete workspace', 'owner'],
            blocks: [
                { type: 'text', text: 'Open **Workspace settings** from the workspace menu in the sidebar and go to **Danger zone**. **Leave workspace** removes your access to all projects there; an admin can invite you again. **Transfer ownership** hands the workspace to another member or admin, and you stay on as admin.' },
                { type: 'callout', tone: 'warning', text: '**Delete workspace** permanently removes all projects, tasks, members and settings. You have to type the workspace name to confirm, and it cannot be undone.' },
            ],
        },
    ],
};

export default article;
