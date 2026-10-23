import React from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import { auth } from '../../services/firebase';
import { getAllWorkspaceProjects, getAllWorkspaceTasks } from '../../services/dataService';
import { getWorkspaceInitiatives } from '../../services/domain/initiativesService';
import { isContainerProject } from '../../config/projectTemplates';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useHelpCenter } from '../../context/HelpCenterContext';
import { useUIState, useToast } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useHelpContent } from '../help/useHelpContent';
import { blockToText } from '../help/helpSearch';
import { DESKTOP_OPEN_SEARCH_EVENT } from '../../services/desktop';
import type { Initiative, Project, Task } from '../../types';
import {
    highlightRanges,
    parseQuery,
    scoreCandidate,
    todayIso,
    type ParsedQuery,
    type SearchScope,
} from '../../utils/globalSearch';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

type ItemKind = 'project' | 'task' | 'initiative' | 'page' | 'action' | 'help';
type Tone = 'primary' | 'success' | 'warning' | 'error' | 'muted';

interface SearchItem {
    key: string;
    kind: ItemKind;
    title: string;
    subtitle?: string;
    /** Extra text that can match but is not shown (descriptions, synonyms). */
    keywords?: string[];
    icon: string;
    tone: Tone;
    href?: string;
    helpTarget?: { pageId: string; sectionId?: string };
    run?: () => void;
    projectId?: string;
    image?: string;
    // Task metadata (rendered as chips, used by is:/prio: filters)
    status?: string;
    priority?: string;
    dueDate?: string;
    isDone?: boolean;
    isMine?: boolean;
}

/** What we persist for "recently opened" — everything needed to re-open it. */
type RecentItem = Pick<SearchItem, 'key' | 'kind' | 'title' | 'subtitle' | 'icon' | 'tone' | 'href' | 'helpTarget' | 'image'>;

interface WorkspaceIndex {
    projects: Project[];
    tasks: Task[];
    initiatives: Initiative[];
}

type SectionId = 'recent' | 'queries' | 'actions' | 'pages' | 'projects' | 'tasks' | 'initiatives' | 'help';

interface Section {
    id: SectionId;
    title: string;
    items: SearchItem[];
    total: number;
    /** Scope that shows the full list ("Show all"). */
    scope?: SearchScope;
}

// ----------------------------------------------------------------------
// Index cache — loaded once per open, shared across mounts
// ----------------------------------------------------------------------

const INDEX_TTL_MS = 60_000;
let indexCache: { key: string; at: number; promise: Promise<WorkspaceIndex> } | null = null;

const loadIndex = (tenantId?: string, force = false): Promise<WorkspaceIndex> => {
    const key = `${auth.currentUser?.uid || 'anon'}:${tenantId || ''}`;
    if (!force && indexCache && indexCache.key === key && Date.now() - indexCache.at < INDEX_TTL_MS) {
        return indexCache.promise;
    }
    const promise = Promise.all([
        getAllWorkspaceProjects(tenantId).catch(() => [] as Project[]),
        getAllWorkspaceTasks(tenantId).catch(() => [] as Task[]),
        getWorkspaceInitiatives(tenantId).catch(() => [] as Initiative[]),
    ]).then(([projects, tasks, initiatives]) => ({ projects, tasks, initiatives }));
    indexCache = { key, at: Date.now(), promise };
    return promise;
};

// ----------------------------------------------------------------------
// Recents (per user, localStorage)
// ----------------------------------------------------------------------

const MAX_RECENT_ITEMS = 6;
const MAX_RECENT_QUERIES = 5;
const recentKey = () => `projectflow.search.recent.${auth.currentUser?.uid || 'anonymous'}`;

const readRecents = (): { items: RecentItem[]; queries: string[] } => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(recentKey()) || '{}');
        return {
            items: Array.isArray(parsed.items) ? parsed.items : [],
            queries: Array.isArray(parsed.queries) ? parsed.queries : [],
        };
    } catch {
        return { items: [], queries: [] };
    }
};

const writeRecents = (next: { items: RecentItem[]; queries: string[] }) => {
    try { window.localStorage.setItem(recentKey(), JSON.stringify(next)); } catch { /* ignore */ }
};

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

const SCOPES: SearchScope[] = ['all', 'projects', 'tasks', 'initiatives', 'commands', 'help'];
const ALL_SCOPE_LIMIT = 5;
const SCOPED_LIMIT = 50;
const PRIORITY_RANK: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

const withTenant = (path: string, tenantId?: string) =>
    (tenantId ? `${path}?tenant=${encodeURIComponent(tenantId)}` : path);

const projectTone = (status?: string): Tone => {
    const value = (status || '').toLowerCase();
    if (/cancel|blocked/.test(value)) return 'error';
    if (/hold|review/.test(value)) return 'warning';
    if (/active|progress|testing/.test(value)) return 'success';
    return 'muted';
};

const isEditableTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};

const Highlight: React.FC<{ text: string; terms: string[] }> = ({ text, terms }) => {
    const ranges = highlightRanges(text, terms);
    if (ranges.length === 0) return <>{text}</>;
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    ranges.forEach(([start, end], i) => {
        if (start > cursor) parts.push(text.slice(cursor, start));
        parts.push(<mark key={i}>{text.slice(start, end)}</mark>);
        cursor = end;
    });
    if (cursor < text.length) parts.push(text.slice(cursor));
    return <>{parts}</>;
};

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

type GlobalSearchProps = { tenantId?: string };

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ tenantId }) => {
    const { t, dateLocale, language } = useLanguage();
    const { theme, setTheme } = useTheme();
    const { openHelpCenter } = useHelpCenter();
    const { openTaskCreateModal, openProjectCreateModal } = useUIState();
    const { showSuccess } = useToast();
    const { activeWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const location = useLocation();

    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [scope, setScope] = React.useState<SearchScope>('all');
    const [selected, setSelected] = React.useState(0);
    const [index, setIndex] = React.useState<WorkspaceIndex | null>(null);
    const [indexLoading, setIndexLoading] = React.useState(false);
    const [recents, setRecents] = React.useState(readRecents);

    const inputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);

    const uid = auth.currentUser?.uid;
    const currentProjectId = React.useMemo(() => location.pathname.match(/^\/project\/([^/]+)/)?.[1], [location.pathname]);

    // ---- Open / close ---------------------------------------------------------

    const prefetch = React.useCallback(() => { void loadIndex(tenantId); }, [tenantId]);

    const openSearch = React.useCallback(() => {
        setRecents(readRecents());
        setOpen(true);
    }, []);

    const closeSearch = React.useCallback(() => {
        setOpen(false);
        setQuery('');
        setScope('all');
        setSelected(0);
    }, []);

    // ⌘K / Ctrl+K toggles; "/" opens when not typing somewhere.
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (open) closeSearch(); else openSearch();
                return;
            }
            if (!open && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditableTarget(e.target)) {
                e.preventDefault();
                openSearch();
            }
        };
        const onOpenRequest = () => { if (!open) openSearch(); };
        document.addEventListener('keydown', onKey);
        window.addEventListener(DESKTOP_OPEN_SEARCH_EVENT, onOpenRequest);
        return () => {
            document.removeEventListener('keydown', onKey);
            window.removeEventListener(DESKTOP_OPEN_SEARCH_EVENT, onOpenRequest);
        };
    }, [open, openSearch, closeSearch]);

    // Load the workspace index when opening.
    React.useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setIndexLoading(true);
        loadIndex(tenantId)
            .then((data) => { if (!cancelled) setIndex(data); })
            .finally(() => { if (!cancelled) setIndexLoading(false); });
        return () => { cancelled = true; };
    }, [open, tenantId]);

    React.useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => inputRef.current?.focus());
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            cancelAnimationFrame(frame);
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    // Close on navigation.
    React.useEffect(() => { closeSearch(); }, [location.pathname, closeSearch]);

    // ---- Static items: pages + actions ----------------------------------------

    const pageItems = React.useMemo<SearchItem[]>(() => {
        const pages: SearchItem[] = [
            { key: 'page:dashboard', kind: 'page', title: t('nav.dashboard'), icon: 'space_dashboard', tone: 'muted', href: '/', keywords: ['home', 'start'] },
            { key: 'page:tasks', kind: 'page', title: t('nav.myTasks'), icon: 'task_alt', tone: 'muted', href: '/tasks', keywords: ['todo', 'aufgaben'] },
            { key: 'page:calendar', kind: 'page', title: t('nav.calendar'), icon: 'calendar_today', tone: 'muted', href: '/calendar', keywords: ['kalender', 'termine'] },
            { key: 'page:projects', kind: 'page', title: t('nav.projects'), icon: 'layers', tone: 'muted', href: '/projects', keywords: ['projekte'] },
            { key: 'page:notifications', kind: 'page', title: t('search.page.notifications'), icon: 'notifications', tone: 'muted', href: '/notifications' },
            { key: 'page:team', kind: 'page', title: t('nav.team'), icon: 'group', tone: 'muted', href: '/team', keywords: ['members', 'mitglieder'] },
            { key: 'page:profile', kind: 'page', title: t('search.page.profile'), icon: 'account_circle', tone: 'muted', href: '/profile', keywords: ['account', 'settings', 'einstellungen'] },
        ];
        if (activeWorkspace?.role !== 'Guest') {
            pages.push({ key: 'page:media', kind: 'page', title: t('nav.media'), icon: 'perm_media', tone: 'muted', href: '/media', keywords: ['files', 'dateien', 'bilder'] });
        }
        if (currentProjectId) {
            const base = `/project/${currentProjectId}`;
            const projectTitle = index?.projects.find((p) => p.id === currentProjectId)?.title;
            const sub = projectTitle ? t('search.inProject').replace('{project}', projectTitle) : undefined;
            pages.push(
                { key: 'page:p-overview', kind: 'page', title: t('nav.overview'), subtitle: sub, icon: 'dashboard', tone: 'primary', href: base },
                { key: 'page:p-tasks', kind: 'page', title: t('nav.tasks'), subtitle: sub, icon: 'checklist', tone: 'primary', href: `${base}/tasks` },
                { key: 'page:p-initiatives', kind: 'page', title: t('nav.initiatives'), subtitle: sub, icon: 'rocket_launch', tone: 'primary', href: `${base}/initiatives` },
                { key: 'page:p-milestones', kind: 'page', title: t('nav.milestones'), subtitle: sub, icon: 'flag', tone: 'primary', href: `${base}/milestones` },
                { key: 'page:p-activity', kind: 'page', title: t('nav.activity'), subtitle: sub, icon: 'history', tone: 'primary', href: `${base}/activity` },
                { key: 'page:p-details', kind: 'page', title: t('search.page.projectSettings'), subtitle: sub, icon: 'tune', tone: 'primary', href: `${base}/details` },
            );
        }
        return pages;
    }, [t, activeWorkspace?.role, currentProjectId, index]);

    const actionItems = React.useMemo<SearchItem[]>(() => {
        const actions: SearchItem[] = [];
        if (currentProjectId) {
            actions.push({
                key: 'action:task-here', kind: 'action', title: t('search.action.newTaskHere'), icon: 'add_task', tone: 'primary',
                keywords: ['create', 'new', 'neu', 'task', 'aufgabe'],
                run: () => openTaskCreateModal(currentProjectId),
            });
        }
        actions.push(
            {
                key: 'action:task', kind: 'action', title: t('search.action.newTask'), icon: 'add_task', tone: 'primary',
                keywords: ['create', 'new', 'neu', 'task', 'aufgabe'],
                run: () => openTaskCreateModal(undefined, { allowProjectSelect: true }),
            },
            {
                key: 'action:project', kind: 'action', title: t('search.action.newProject'), icon: 'create_new_folder', tone: 'primary',
                keywords: ['create', 'new', 'neu', 'project', 'projekt'],
                run: () => openProjectCreateModal(),
            },
            {
                key: 'action:theme', kind: 'action',
                title: theme === 'dark' ? t('search.action.lightMode') : t('search.action.darkMode'),
                icon: theme === 'dark' ? 'light_mode' : 'dark_mode', tone: 'muted',
                keywords: ['theme', 'dark', 'light', 'hell', 'dunkel', 'design'],
                run: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
            },
            {
                key: 'action:copy-link', kind: 'action', title: t('search.action.copyLink'), icon: 'link', tone: 'muted',
                keywords: ['share', 'url', 'teilen', 'kopieren'],
                run: () => {
                    void navigator.clipboard?.writeText(window.location.href).then(() => showSuccess(t('search.action.copyLinkDone')));
                },
            },
            {
                key: 'action:help', kind: 'action', title: t('search.action.openHelp'), icon: 'help', tone: 'muted',
                keywords: ['help', 'hilfe', 'docs', 'support'],
                run: () => openHelpCenter(),
            },
        );
        return actions;
    }, [t, theme, setTheme, currentProjectId, openTaskCreateModal, openProjectCreateModal, openHelpCenter, showSuccess]);

    // Help articles are a lazy chunk per language; load them once the palette opens.
    const helpContent = useHelpContent(open);

    const helpItems = React.useMemo<SearchItem[]>(() => (helpContent?.articles ?? []).flatMap((article) => [
        {
            key: `help:${article.id}`, kind: 'help' as const, title: article.title, subtitle: article.summary,
            keywords: article.keywords, icon: article.icon, tone: 'muted' as const,
            helpTarget: { pageId: article.id },
        },
        ...article.sections.map((section) => ({
            key: `help:${article.id}:${section.id}`, kind: 'help' as const, title: section.title,
            subtitle: t('search.helpSectionIn').replace('{page}', article.title),
            keywords: [...(section.keywords || []), ...section.blocks.map(blockToText)],
            icon: 'description', tone: 'muted' as const,
            helpTarget: { pageId: article.id, sectionId: section.id },
        })),
    ]), [helpContent, t]);

    // ---- Data items ------------------------------------------------------------

    const dataItems = React.useMemo(() => {
        if (!index) return { projects: [] as SearchItem[], tasks: [] as SearchItem[], initiatives: [] as SearchItem[] };
        const projectsById = new Map(index.projects.map((p) => [p.id, p]));
        const projectLabel = (projectId?: string) => {
            const project = projectId ? projectsById.get(projectId) : undefined;
            if (!project) return undefined;
            const parent = project.companyProjectId ? projectsById.get(project.companyProjectId) : undefined;
            return parent ? `${parent.title} / ${project.title}` : project.title;
        };

        const projects: SearchItem[] = index.projects.map((project) => {
            const parent = project.companyProjectId ? projectsById.get(project.companyProjectId) : undefined;
            return {
                key: `project:${project.id}`,
                kind: 'project',
                title: project.title,
                subtitle: parent ? t('search.companyProjectContext').replace('{company}', parent.title) : project.status,
                keywords: [project.description || '', parent?.title || ''],
                icon: isContainerProject(project) ? 'domain' : 'folder',
                tone: projectTone(project.status),
                image: project.squareIcon,
                href: withTenant(`/project/${project.id}`, project.tenantId || tenantId),
                projectId: project.id,
                status: project.status,
            };
        });

        const tasks: SearchItem[] = index.tasks
            .filter((task) => task.projectId)
            .map((task) => {
                const isDone = task.isCompleted || task.status === 'Done';
                return {
                    key: `task:${task.id}`,
                    kind: 'task',
                    title: task.title,
                    subtitle: projectLabel(task.projectId),
                    keywords: [(task as Task & { description?: string }).description || ''],
                    icon: isDone ? 'check_circle' : 'radio_button_unchecked',
                    tone: isDone ? 'success' : 'muted',
                    href: withTenant(`/project/${task.projectId}/tasks/${task.id}`, task.tenantId || projectsById.get(task.projectId)?.tenantId || tenantId),
                    projectId: task.projectId,
                    status: task.status || (isDone ? 'Done' : 'Open'),
                    priority: task.priority,
                    dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : undefined,
                    isDone,
                    isMine: Boolean(uid && (task.assigneeId === uid || task.assigneeIds?.includes(uid))),
                };
            });

        const initiatives: SearchItem[] = index.initiatives.map((initiative) => ({
            key: `initiative:${initiative.id}`,
            kind: 'initiative',
            title: initiative.title,
            subtitle: projectLabel(initiative.projectId),
            keywords: [initiative.description || '', initiative.outcome || '', initiative.successMetric || ''],
            icon: 'rocket_launch',
            tone: 'primary',
            href: withTenant(`/project/${initiative.projectId}/initiatives/${initiative.id}`, initiative.tenantId || projectsById.get(initiative.projectId)?.tenantId || tenantId),
            projectId: initiative.projectId,
            status: initiative.status,
        }));

        return { projects, tasks, initiatives };
    }, [index, t, tenantId, uid]);

    // ---- Matching ---------------------------------------------------------------

    const parsed: ParsedQuery = React.useMemo(() => parseQuery(query), [query]);
    const effectiveScope: SearchScope = parsed.prefixScope || (parsed.hasTaskFilters ? 'tasks' : scope);
    const hasInput = parsed.terms.length > 0 || parsed.hasTaskFilters || Boolean(parsed.prefixScope);

    const rank = React.useCallback((items: SearchItem[], opts: { boostCurrentProject?: boolean } = {}) => {
        const scored: Array<{ item: SearchItem; score: number }> = [];
        items.forEach((item) => {
            let score = scoreCandidate(parsed.terms, item.title, [item.subtitle || '', ...(item.keywords || [])]);
            if (score <= 0) return;
            if (opts.boostCurrentProject && currentProjectId && item.projectId === currentProjectId) score += 1.5;
            if (item.isDone) score -= 0.5;
            scored.push({ item, score });
        });
        return scored.sort((a, b) => b.score - a.score).map((entry) => entry.item);
    }, [parsed.terms, currentProjectId]);

    const filterTasks = React.useCallback((items: SearchItem[]) => {
        const today = todayIso();
        return items.filter((item) => parsed.taskFilters.every((filter) => {
            switch (filter) {
                case 'open': return !item.isDone;
                case 'done': return Boolean(item.isDone);
                case 'overdue': return !item.isDone && Boolean(item.dueDate) && (item.dueDate as string) < today;
                case 'today': return item.dueDate === today;
                case 'mine': return Boolean(item.isMine);
                default: return true;
            }
        }) && (!parsed.priority || (item.priority || '').toLowerCase() === parsed.priority));
    }, [parsed.taskFilters, parsed.priority]);

    const sections = React.useMemo<Section[]>(() => {
        // Empty input on a specific tab: browse everything in that area.
        if (!hasInput && effectiveScope !== 'all') {
            const inCurrentProjectFirst = (a: SearchItem, b: SearchItem) =>
                Number(b.projectId === currentProjectId) - Number(a.projectId === currentProjectId);
            const byTitle = (a: SearchItem, b: SearchItem) => a.title.localeCompare(b.title);
            const browse = (id: SectionId, title: string, items: SearchItem[]) =>
                [{ id, title, items: items.slice(0, SCOPED_LIMIT), total: items.length }];
            switch (effectiveScope) {
                case 'projects':
                    return browse('projects', t('nav.projects'), [...dataItems.projects].sort((a, b) =>
                        inCurrentProjectFirst(a, b)
                        || Number(/complet|cancel/i.test(a.status || '')) - Number(/complet|cancel/i.test(b.status || ''))
                        || byTitle(a, b)));
                case 'tasks':
                    return browse('tasks', t('nav.tasks'), dataItems.tasks.filter((item) => !item.isDone).sort((a, b) =>
                        Number(Boolean(b.isMine)) - Number(Boolean(a.isMine))
                        || inCurrentProjectFirst(a, b)
                        || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')));
                case 'initiatives':
                    return browse('initiatives', t('nav.initiatives'), [...dataItems.initiatives].sort((a, b) => inCurrentProjectFirst(a, b) || byTitle(a, b)));
                case 'commands':
                    return [
                        { id: 'actions', title: t('search.section.actions'), items: actionItems, total: actionItems.length },
                        { id: 'pages', title: t('search.section.pages'), items: pageItems, total: pageItems.length },
                    ];
                case 'help':
                    return browse('help', t('topbar.helpCenter'), helpItems.filter((item) => !item.helpTarget?.sectionId));
                default:
                    break;
            }
        }

        // Empty state: recents + quick actions + pages.
        if (!hasInput) {
            const list: Section[] = [];
            if (recents.items.length > 0) list.push({ id: 'recent', title: t('search.section.recent'), items: recents.items as SearchItem[], total: recents.items.length });
            if (recents.queries.length > 0) {
                list.push({
                    id: 'queries', title: t('search.section.recentQueries'), total: recents.queries.length,
                    items: recents.queries.map((q) => ({ key: `query:${q}`, kind: 'action' as const, title: q, icon: 'history', tone: 'muted' as const, run: () => setQuery(q) })),
                });
            }
            list.push({ id: 'actions', title: t('search.section.actions'), items: actionItems.slice(0, 4), total: actionItems.length, scope: 'commands' });
            list.push({ id: 'pages', title: t('search.section.pages'), items: pageItems, total: pageItems.length, scope: 'commands' });
            return list;
        }

        const limit = effectiveScope === 'all' ? ALL_SCOPE_LIMIT : SCOPED_LIMIT;
        const include = (s: SearchScope) => effectiveScope === 'all' || effectiveScope === s;
        const list: Section[] = [];
        const push = (id: SectionId, title: string, ranked: SearchItem[], scopeForAll: SearchScope) => {
            if (ranked.length === 0) return;
            list.push({ id, title, items: ranked.slice(0, limit), total: ranked.length, scope: scopeForAll });
        };

        if (include('commands') && !parsed.hasTaskFilters) {
            push('actions', t('search.section.actions'), rank(actionItems), 'commands');
            push('pages', t('search.section.pages'), rank(pageItems), 'commands');
        }
        if (include('projects') && !parsed.hasTaskFilters) push('projects', t('nav.projects'), rank(dataItems.projects), 'projects');
        if (include('tasks')) {
            let tasks = filterTasks(dataItems.tasks);
            if (parsed.terms.length > 0) {
                tasks = rank(tasks, { boostCurrentProject: true });
            } else {
                // Filter-only query ("is:overdue"): most urgent first.
                tasks = [...tasks].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
                    || (PRIORITY_RANK[b.priority || ''] || 0) - (PRIORITY_RANK[a.priority || ''] || 0));
            }
            push('tasks', t('nav.tasks'), tasks, 'tasks');
        }
        if (include('initiatives') && !parsed.hasTaskFilters) push('initiatives', t('nav.initiatives'), rank(dataItems.initiatives, { boostCurrentProject: true }), 'initiatives');
        if (include('help') && !parsed.hasTaskFilters) push('help', t('topbar.helpCenter'), rank(helpItems), 'help');
        return list;
    }, [hasInput, recents, t, actionItems, pageItems, effectiveScope, parsed, rank, dataItems, filterTasks, helpItems, currentProjectId]);

    const flatItems = React.useMemo(() => sections.flatMap((section) => section.items), [sections]);

    React.useEffect(() => { setSelected(0); }, [query, effectiveScope]);

    // Keep the keyboard selection in view.
    React.useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [selected]);

    // ---- Activation -------------------------------------------------------------

    // Record the query and the opened item in one update so neither overwrites the other.
    const remember = (item: SearchItem) => {
        const q = query.trim();
        const queries = q.length >= 2
            ? [q, ...recents.queries.filter((x) => x !== q)].slice(0, MAX_RECENT_QUERIES)
            : recents.queries;
        const items = item.href || item.helpTarget
            ? [{
                key: item.key, kind: item.kind, title: item.title, subtitle: item.subtitle,
                icon: item.icon, tone: item.tone, href: item.href, helpTarget: item.helpTarget, image: item.image,
            } as RecentItem, ...recents.items.filter((r) => r.key !== item.key)].slice(0, MAX_RECENT_ITEMS)
            : recents.items;
        const next = { items, queries };
        setRecents(next);
        writeRecents(next);
    };

    const activate = (item: SearchItem | undefined, opts: { newTab?: boolean } = {}) => {
        if (!item) return;
        // Recent queries just refill the input.
        if (item.key.startsWith('query:')) { item.run?.(); inputRef.current?.focus(); return; }

        remember(item);

        if (item.href && opts.newTab) {
            window.open(item.href, '_blank', 'noopener');
            return;
        }
        closeSearch();
        if (item.run) item.run();
        else if (item.helpTarget) openHelpCenter(item.helpTarget);
        else if (item.href) navigate(item.href);
    };

    const removeRecent = (item: SearchItem) => {
        const next = item.key.startsWith('query:')
            ? { ...recents, queries: recents.queries.filter((q) => `query:${q}` !== item.key) }
            : { ...recents, items: recents.items.filter((r) => r.key !== item.key) };
        setRecents(next);
        writeRecents(next);
    };

    const clearRecents = () => {
        const next = { items: [], queries: [] };
        setRecents(next);
        writeRecents(next);
    };

    const cycleScope = (direction: 1 | -1) => {
        const i = SCOPES.indexOf(scope);
        setScope(SCOPES[(i + direction + SCOPES.length) % SCOPES.length]);
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const count = flatItems.length;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (count) setSelected((s) => (s + 1) % count);
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (count) setSelected((s) => (s - 1 + count) % count);
                break;
            case 'Home':
                if (count && !query) { e.preventDefault(); setSelected(0); }
                break;
            case 'End':
                if (count && !query) { e.preventDefault(); setSelected(count - 1); }
                break;
            case 'Enter':
                e.preventDefault();
                activate(flatItems[selected], { newTab: e.metaKey || e.ctrlKey });
                break;
            case 'Tab':
                e.preventDefault();
                cycleScope(e.shiftKey ? -1 : 1);
                break;
            case 'Escape':
                e.preventDefault();
                if (query) setQuery('');
                else if (scope !== 'all') setScope('all');
                else closeSearch();
                break;
            case 'Backspace':
                // Backspace on an empty input drops the active filter chip.
                if (!query && scope !== 'all') setScope('all');
                break;
            default:
                break;
        }
    };

    // ---- Rendering ---------------------------------------------------------------

    const today = todayIso();
    const formatDue = (iso: string) => {
        const date = parseISO(iso);
        return isValid(date) ? format(date, language === 'de' ? 'd. MMM' : 'MMM d', { locale: dateLocale }) : iso;
    };
    const statusLabel = (status?: string) => {
        if (!status) return '';
        const key = status.replace(/\s+(\w)/g, (_, c: string) => c.toUpperCase()).replace(/^\w/, (c) => c.toLowerCase());
        return t(`tasks.status.${key}`, status);
    };

    const scopeLabels: Record<SearchScope, string> = {
        all: t('search.scope.all'),
        projects: t('nav.projects'),
        tasks: t('nav.tasks'),
        initiatives: t('nav.initiatives'),
        commands: t('search.scope.commands'),
        help: t('topbar.helpCenter'),
    };

    const renderItem = (item: SearchItem, flatIndex: number, sectionId: SectionId) => {
        const isSelected = flatIndex === selected;
        const removable = sectionId === 'recent' || sectionId === 'queries';
        const overdue = item.kind === 'task' && !item.isDone && item.dueDate && item.dueDate < today;
        return (
            <div
                key={`${sectionId}:${item.key}`}
                id={`gsearch-item-${flatIndex}`}
                role="option"
                aria-selected={isSelected}
                data-index={flatIndex}
                className={`gsearch__item ${isSelected ? 'is-selected' : ''} ${item.isDone ? 'is-done' : ''}`}
                // mousemove, not mouseenter: scrolling under a resting pointer must not steal the keyboard selection.
                onMouseMove={() => { if (!isSelected) setSelected(flatIndex); }}
                onClick={(e) => activate(item, { newTab: e.metaKey || e.ctrlKey })}
            >
                <span className={`gsearch__icon gsearch__icon--${item.tone}`}>
                    {item.image
                        ? <img src={item.image} alt="" />
                        : <span className="material-symbols-outlined">{item.icon}</span>}
                </span>
                <span className="gsearch__copy">
                    <span className="gsearch__title"><Highlight text={item.title} terms={parsed.terms} /></span>
                    {item.subtitle && <span className="gsearch__subtitle"><Highlight text={item.subtitle} terms={parsed.terms} /></span>}
                </span>
                {item.kind === 'task' && (
                    <span className="gsearch__meta">
                        {item.priority && (item.priority === 'High' || item.priority === 'Urgent') && (
                            <span className={`gsearch__chip gsearch__chip--${item.priority === 'Urgent' ? 'error' : 'warning'}`}>
                                {t(`tasks.priority.${item.priority.toLowerCase()}`, item.priority)}
                            </span>
                        )}
                        {item.dueDate && (
                            <span className={`gsearch__chip ${overdue ? 'gsearch__chip--error' : ''}`}>
                                <span className="material-symbols-outlined">event</span>
                                {item.dueDate === today ? t('search.due.today') : formatDue(item.dueDate)}
                            </span>
                        )}
                        {item.status && !item.isDone && <span className="gsearch__chip">{statusLabel(item.status)}</span>}
                    </span>
                )}
                {item.kind === 'initiative' && item.status && (
                    <span className="gsearch__meta"><span className="gsearch__chip">{statusLabel(item.status)}</span></span>
                )}
                {removable ? (
                    <button
                        type="button"
                        className="gsearch__remove"
                        aria-label={t('search.removeRecent')}
                        onClick={(e) => { e.stopPropagation(); removeRecent(item); }}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                ) : (
                    <span className="gsearch__enter" aria-hidden="true">
                        <span className="material-symbols-outlined">{item.kind === 'action' ? 'bolt' : 'keyboard_return'}</span>
                    </span>
                )}
            </div>
        );
    };

    let runningIndex = 0;
    const browsingData = !hasInput && ['projects', 'tasks', 'initiatives'].includes(effectiveScope);
    const showLoading = indexLoading && !index && (hasInput || browsingData);
    const showEmpty = (hasInput || browsingData) && !showLoading && flatItems.length === 0;

    return (
        <div className="gsearch-bar">
            <button
                type="button"
                className={`gsearch-trigger ${open ? 'is-active' : ''}`}
                onClick={openSearch}
                onMouseEnter={prefetch}
                onFocus={prefetch}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={t('search.open')}
            >
                <span className="material-symbols-outlined gsearch-trigger__icon">search</span>
                <span className="gsearch-trigger__shortcut" aria-hidden="true">
                    <span>⌘</span>
                    <span>K</span>
                </span>
            </button>

            {open && createPortal(
                <div className="gsearch" onMouseDown={(e) => { if (e.target === e.currentTarget) closeSearch(); }}>
                    <section className="gsearch__panel" role="dialog" aria-modal="true" aria-label={t('search.modalLabel')}>
                        <div className="gsearch__input-row">
                            <span className="material-symbols-outlined gsearch__search-icon">search</span>
                            <input
                                ref={inputRef}
                                className="gsearch__input"
                                placeholder={t('search.placeholder')}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={onInputKeyDown}
                                role="combobox"
                                aria-expanded="true"
                                aria-controls="gsearch-list"
                                aria-activedescendant={flatItems.length ? `gsearch-item-${selected}` : undefined}
                                spellCheck={false}
                                autoComplete="off"
                            />
                            {indexLoading && <span className="material-symbols-outlined gsearch__spinner">progress_activity</span>}
                            {query && (
                                <button type="button" className="gsearch__clear" aria-label={t('search.clear')} onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            )}
                        </div>

                        <div className="gsearch__scopes" role="tablist" aria-label={t('search.scope.label')}>
                            {SCOPES.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    role="tab"
                                    aria-selected={effectiveScope === s}
                                    className={`gsearch__scope ${effectiveScope === s ? 'is-active' : ''}`}
                                    onClick={() => { setScope(s); inputRef.current?.focus(); }}
                                    disabled={Boolean(parsed.prefixScope) || parsed.hasTaskFilters}
                                >
                                    {scopeLabels[s]}
                                </button>
                            ))}
                        </div>

                        <div className="gsearch__list" id="gsearch-list" role="listbox" ref={listRef}>
                            {showLoading && (
                                <div className="gsearch__state">
                                    <span className="material-symbols-outlined gsearch__spinner">progress_activity</span>
                                    <span>{t('search.loading')}</span>
                                </div>
                            )}
                            {showEmpty && (
                                <div className="gsearch__state">
                                    <span className="material-symbols-outlined">search_off</span>
                                    <span>{hasInput ? t('search.noResults').replace('{query}', query.trim()) : t('search.emptyScope')}</span>
                                    {hasInput && <span className="gsearch__state-hint">{t('search.noResultsHint')}</span>}
                                </div>
                            )}
                            {sections.map((section) => (
                                <div key={section.id} className="gsearch__section" role="group" aria-label={section.title}>
                                    <div className="gsearch__section-head">
                                        <span>{section.title}</span>
                                        {hasInput && section.total > 1 && <span className="gsearch__count">{section.total}</span>}
                                        {!hasInput && section.id === 'recent' && (
                                            <button type="button" className="gsearch__section-action" onClick={clearRecents}>{t('search.clearRecent')}</button>
                                        )}
                                        {hasInput && effectiveScope === 'all' && section.scope && section.total > section.items.length && (
                                            <button type="button" className="gsearch__section-action" onClick={() => { setScope(section.scope as SearchScope); inputRef.current?.focus(); }}>
                                                {t('search.showAll').replace('{count}', String(section.total))}
                                            </button>
                                        )}
                                    </div>
                                    {section.items.map((item) => {
                                        runningIndex += 1;
                                        return renderItem(item, runningIndex - 1, section.id);
                                    })}
                                </div>
                            ))}
                            {!hasInput && effectiveScope === 'all' && (
                                <div className="gsearch__tips">
                                    <span className="gsearch__tips-title">{t('search.tips.title')}</span>
                                    <div className="gsearch__tips-row">
                                        {[
                                            { token: '>', label: t('search.tips.commands') },
                                            { token: '#', label: t('search.tips.projects') },
                                            { token: '!', label: t('search.tips.tasks') },
                                            { token: '?', label: t('search.tips.help') },
                                            { token: 'is:overdue', label: t('search.tips.overdue') },
                                            { token: 'is:mine', label: t('search.tips.mine') },
                                            { token: 'prio:high', label: t('search.tips.priority') },
                                        ].map((tip) => (
                                            <button
                                                key={tip.token}
                                                type="button"
                                                className="gsearch__tip"
                                                onClick={() => { setQuery(tip.token.length === 1 ? tip.token : `${tip.token} `); inputRef.current?.focus(); }}
                                            >
                                                <kbd>{tip.token}</kbd>
                                                <span>{tip.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <footer className="gsearch__footer">
                            <span><kbd>↑</kbd><kbd>↓</kbd>{t('search.footer.navigate')}</span>
                            <span><kbd>↵</kbd>{t('search.footer.open')}</span>
                            <span><kbd>⌘</kbd><kbd>↵</kbd>{t('search.footer.newTab')}</span>
                            <span><kbd>Tab</kbd>{t('search.footer.filter')}</span>
                            <span className="gsearch__footer-end"><kbd>Esc</kbd>{t('search.footer.close')}</span>
                        </footer>
                    </section>
                </div>,
                document.body,
            )}
        </div>
    );
};

export default GlobalSearch;
