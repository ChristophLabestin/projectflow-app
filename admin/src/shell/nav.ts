import { Activity, BarChart3, Bot, Bug, Building2, FileText, Gauge, KeyRound, Mail, MailWarning, Newspaper, ScrollText, Settings2, Users } from 'lucide-react';

export type NavItem = { to: string; label: string; icon: typeof Gauge; key: string; group: string; keywords?: string };

/** Sidebar, ⌘K palette and the `g <key>` shortcuts all read this list. */
export const NAV: NavItem[] = [
    { to: '/', label: 'Übersicht', icon: Gauge, key: 'o', group: 'Plattform', keywords: 'dashboard kpi overview' },
    { to: '/users', label: 'Nutzer', icon: Users, key: 'u', group: 'Plattform', keywords: 'accounts konten support' },
    { to: '/workspaces', label: 'Workspaces', icon: Building2, key: 'w', group: 'Plattform', keywords: 'tenants arbeitsbereiche' },
    { to: '/onboarding', label: 'Onboarding', icon: BarChart3, key: 'b', group: 'Plattform', keywords: 'insights survey umfrage' },
    { to: '/crashes', label: 'Crashes', icon: Bug, key: 'c', group: 'Betrieb', keywords: 'errors fehler stacktrace' },
    { to: '/ai', label: 'KI & MCP', icon: Bot, key: 'k', group: 'Betrieb', keywords: 'ai usage kosten oauth mcp' },
    { to: '/email', label: 'E-Mail', icon: MailWarning, key: 'e', group: 'Betrieb', keywords: 'ses bounce suppression zustellung' },
    { to: '/system', label: 'System', icon: Settings2, key: 's', group: 'Betrieb', keywords: 'flags banner ankündigung scheduler' },
    { to: '/legal', label: 'Rechtsdokumente', icon: FileText, key: 'l', group: 'Inhalte', keywords: 'agb datenschutz impressum zustimmung' },
    { to: '/blog', label: 'Blog', icon: Newspaper, key: 'p', group: 'Inhalte', keywords: 'posts beiträge kategorien' },
    { to: '/newsletter', label: 'Leads & Newsletter', icon: Mail, key: 'n', group: 'Inhalte', keywords: 'abonnenten subscribers warteliste kontakt' },
    { to: '/audit', label: 'Audit-Log', icon: ScrollText, key: 'a', group: 'Sicherheit', keywords: 'protokoll log' },
    { to: '/mcp-access', label: 'Admin-MCP', icon: KeyRound, key: 'm', group: 'Sicherheit', keywords: 'mcp claude ki zugriff oauth' },
];

export const ActivityIcon = Activity;
