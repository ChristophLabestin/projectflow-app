import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'team',
    category: 'collaboration',
    icon: 'groups',
    title: 'Team',
    summary: 'See who is in your workspace, invite people, set their access and group them by department.',
    keywords: ['team', 'members', 'invite', 'invitation', 'guest', 'admin', 'role', 'department', 'remove', 'access', 'people'],
    sections: [
        {
            id: 'find-team',
            title: 'Open the team page',
            keywords: ['members', 'people', 'who', 'directory'],
            blocks: [
                { type: 'text', text: 'Open the **Team** menu in the top bar and choose **View all**, or search for "Team". The [Team](/team) page lists everyone in the current workspace and shows how many people, departments and projects there are.' },
                { type: 'text', text: 'Use the views at the top to browse: **By department**, **By project**, **All** or **Invitations**. Click a person to open a detail panel on the side.' },
            ],
        },
        {
            id: 'invite',
            title: 'Invite people',
            keywords: ['invite', 'email', 'link', 'guest', 'client', 'freelancer', 'join'],
            blocks: [
                { type: 'text', text: 'Owners and Admins see the **Invite** button on the Team page.' },
                { type: 'steps', items: [
                    'Click **Invite**.',
                    'Choose **By email** or **Share link**.',
                    'Pick the **Access** level. For a guest, select at least one project they may see.',
                    'Click **Send invitation** (email) or **Create link**, then **Copy** the link if you want to share it yourself.',
                ] },
                { type: 'terms', items: [
                    { term: 'Member', text: 'Sees and works on all workspace projects.' },
                    { term: 'Admin', text: 'Like Member, plus managing people, invitations and settings.' },
                    { term: 'Guest', text: 'Only sees the projects selected in the invitation. Ideal for clients and freelancers.' },
                ] },
                { type: 'callout', tone: 'note', text: 'Invitation links expire after 14 days and can be revoked at any time.' },
            ],
        },
        {
            id: 'open-invitations',
            title: 'Manage open invitations',
            keywords: ['revoke', 'copy link', 'pending', 'invitations'],
            blocks: [
                { type: 'text', text: 'The **Invitations** view lists all open invitations with their access level and whether they cover the whole workspace or specific projects.' },
                { type: 'text', text: 'Use **Copy link** to share an invitation again, or **Revoke** to cancel it.' },
            ],
        },
        {
            id: 'access-roles',
            title: 'Change access and roles',
            keywords: ['role', 'permission', 'owner', 'admin', 'custom role', 'department', 'remove member'],
            blocks: [
                { type: 'text', text: 'Click a person and open **Workspace access**. Owners can switch people between Admin, Member and Guest. Admins can switch people between Member and Guest. The Owner and your own access cannot be changed here.' },
                { type: 'text', text: 'Under **Roles** you can assign the custom roles you created in settings. The panel also lists the person\'s project and **Assigned tasks**.' },
                { type: 'text', text: 'To remove someone, click **Remove from workspace** and confirm.' },
            ],
        },
        {
            id: 'departments',
            title: 'Group the team by department',
            keywords: ['department', 'custom roles', 'group', 'roles'],
            blocks: [
                { type: 'text', text: 'Departments are your workspace\'s custom roles. Create roles in **Settings** under **Roles** (click **Set up roles** on the Team page) and assign them to members. Each role then appears as a department in the **By department** view.' },
                { type: 'text', text: 'People without a custom role are listed under **No department**.' },
            ],
        },
    ],
};

export default article;
