import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllWorkspaceProjects } from '../services/dataService';
import { auth } from '../services/firebase';
import { Project, Member } from '../types';
import { toMillis } from '../utils/time';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { getProjectMembers, subscribeProjectTasks } from '../services/dataService';

const MemberAvatars: React.FC<{ projectId: string }> = ({ projectId }) => {
    const [members, setMembers] = useState<Member[]>([]);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const projectMembers = await getProjectMembers(projectId);
                setMembers(projectMembers);
            } catch (err) {
                console.error("Failed to fetch project members", err);
            }
        };
        fetchMembers();
    }, [projectId]);

    if (members.length === 0) return null;

    return (
        <div className="flex items-center -space-x-2">
            {members.slice(0, 3).map((member, i) => (
                <div
                    key={member.id}
                    className="size-7 rounded-full border-2 border-[var(--color-surface-paper)] overflow-hidden bg-[var(--color-surface-hover)] shadow-sm"
                    title={member.displayName || 'Member'}
                >
                    {member.photoURL ? (
                        <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">
                            {(member.displayName || '?').charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            ))}
            {members.length > 3 && (
                <div className="size-7 rounded-full border-2 border-[var(--color-surface-paper)] bg-[var(--color-surface-hover)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] shadow-sm">
                    +{members.length - 3}
                </div>
            )}
        </div>
    );
};

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const isBrainstorming = project.status === 'Brainstorming' || project.status === 'Planning';
    const isCompleted = project.status === 'Completed';

    useEffect(() => {
        return subscribeProjectTasks(project.id, setTasks, project.tenantId);
    }, [project.id, project.tenantId]);

    const progress = useMemo(() => {
        if (tasks.length === 0) return project.progress || 0;
        const completedCount = tasks.filter(t => t.isCompleted || t.status === 'Done').length;
        return Math.round((completedCount / tasks.length) * 100);
    }, [tasks, project.progress]);

    let icon = 'folder';
    let iconClass = 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20';
    let progressColor = 'bg-indigo-500';

    if (isBrainstorming) {
        icon = 'lightbulb';
        iconClass = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20';
        progressColor = 'bg-amber-500';
    } else if (isCompleted) {
        icon = 'check_circle';
        iconClass = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20';
        progressColor = 'bg-emerald-500';
    }

    return (
        <div onClick={() => navigate(`/project/${project.id}`)} className="cursor-pointer h-full group">
            <Card padding="none" hoverable className="h-full flex flex-col relative overflow-hidden transition-all duration-300 group-hover:shadow-2xl border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50">
                {project.coverImage && (
                    <div className="h-32 w-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface-paper)] via-[var(--color-surface-paper)]/20 to-transparent z-10" />
                        <img src={project.coverImage} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                    </div>
                )}

                <div className={`p-5 flex flex-col flex-1 gap-4 ${project.coverImage ? '-mt-10 relative z-20' : ''}`}>
                    <div className="flex justify-between items-start">
                        {project.squareIcon ? (
                            <div className="size-12 rounded-2xl overflow-hidden border-2 border-[var(--color-surface-paper)] bg-white shadow-lg">
                                <img src={project.squareIcon} alt="" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className={`size-12 rounded-2xl flex items-center justify-center border-2 border-[var(--color-surface-paper)] shadow-lg ${iconClass}`}>
                                <span className="material-symbols-outlined text-2xl">{icon}</span>
                            </div>
                        )}
                        <div className="pt-1">
                            <Badge variant={isCompleted ? 'success' : isBrainstorming ? 'secondary' : 'primary'} className="backdrop-blur-md bg-opacity-80">
                                {project.status}
                            </Badge>
                        </div>
                    </div>

                    <div className="flex-1 space-y-2">
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1 leading-tight">
                            {project.title}
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 leading-relaxed min-h-[2.8rem]">
                            {project.description || 'No description provided.'}
                        </p>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">
                            <span>{progress}% PROGRESS</span>
                            {project.dueDate && (
                                <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">calendar_today</span>
                                    {new Date(project.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                            )}
                        </div>
                        <div className="w-full bg-[var(--color-surface-border)] rounded-full h-2 overflow-hidden shadow-inner">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ease-out relative ${progressColor}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]/50 backdrop-blur-sm flex items-center justify-between mt-auto">
                    <MemberAvatars projectId={project.id} />
                    <div className="text-sm font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] flex items-center gap-2 transition-all group-hover:gap-3">
                        View <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </div>
                </div>
            </Card>
        </div>
    );
};

const FeaturedProject: React.FC<{ project: Project }> = ({ project }) => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const isBrainstorming = project.status === 'Brainstorming' || project.status === 'Planning';
    const isCompleted = project.status === 'Completed';

    useEffect(() => {
        return subscribeProjectTasks(project.id, setTasks, project.tenantId);
    }, [project.id, project.tenantId]);

    const progress = useMemo(() => {
        if (tasks.length === 0) return project.progress || 0;
        const completedCount = tasks.filter(t => t.isCompleted || t.status === 'Done').length;
        return Math.round((completedCount / tasks.length) * 100);
    }, [tasks, project.progress]);

    let progressColor = 'from-indigo-500 to-indigo-600';
    if (isBrainstorming) progressColor = 'from-amber-400 to-amber-600';
    else if (isCompleted) progressColor = 'from-emerald-400 to-emerald-600';

    return (
        <Card
            onClick={() => navigate(`/project/${project.id}`)}
            className="relative overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-500 border-none p-0 bg-transparent"
        >
            <div className="relative h-64 md:h-80 w-full rounded-3xl overflow-hidden shadow-2xl">
                {project.coverImage ? (
                    <img src={project.coverImage} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 blur-[2px]" alt="" />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 animate-gradient-xy" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40 backdrop-blur-[2px]" />

                <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full space-y-4">
                    <div className="flex items-center gap-3">
                        <Badge variant="primary" className="bg-white/20 backdrop-blur-xl border-white/30 text-white uppercase tracking-widest text-[10px] font-black">
                            Featured Project
                        </Badge>
                        <Badge variant={isCompleted ? 'success' : isBrainstorming ? 'secondary' : 'primary'} className="bg-white/10 backdrop-blur-md border-white/20 text-white">
                            {project.status}
                        </Badge>
                    </div>

                    <div className="max-w-2xl space-y-2">
                        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight drop-shadow-lg">
                            {project.title}
                        </h2>
                        <p className="text-white/80 text-sm md:text-base line-clamp-2 md:line-clamp-3 leading-relaxed font-medium">
                            {project.description || 'No description provided.'}
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-6 pt-2">
                        <div className="flex-1 space-y-2 max-w-xs">
                            <div className="flex justify-between text-xs font-black text-white/70 uppercase tracking-widest">
                                <span>Completion</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2.5 w-full bg-white/20 rounded-full overflow-hidden backdrop-blur-md">
                                <div
                                    className={`h-full bg-gradient-to-r ${progressColor} transition-all duration-1000 ease-out`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <MemberAvatars projectId={project.id} />
                            <div className="h-10 px-6 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2 transition-all hover:bg-white/90 active:scale-95 shadow-lg">
                                Open Project <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">arrow_right_alt</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export const ProjectsList = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSuggestion, setShowSuggestion] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('all');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<'recent' | 'due' | 'progress'>('recent');

    const currentUser = auth.currentUser;
    const { can } = useWorkspacePermissions();

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                // Fetch ALL projects in the tenant
                const allProjects = await getAllWorkspaceProjects();
                setProjects(allProjects);
            } catch (error) {
                console.error('Failed to fetch projects', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    // Split projects into "My Projects" and "Other Projects"
    const { myProjects, otherProjects } = useMemo(() => {
        if (!currentUser) return { myProjects: [], otherProjects: [] };

        const my: Project[] = [];
        const other: Project[] = [];

        projects.forEach(p => {
            const isMember = p.ownerId === currentUser.uid || (p.memberIds || []).includes(currentUser.uid);
            if (isMember) {
                my.push(p);
            } else {
                other.push(p);
            }
        });

        return { myProjects: my, otherProjects: other };
    }, [projects, currentUser]);

    // Filtering logic for My Projects
    const filteredMyProjects = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        const matchesFilter = (project: Project) => {
            if (filter === 'active') return project.status === 'Active';
            if (filter === 'planning') return project.status === 'Brainstorming' || project.status === 'Planning';
            if (filter === 'completed') return project.status === 'Completed';
            return true;
        };

        const matchesSearch = (project: Project) => {
            if (!normalizedSearch) return true;
            return [project.title, project.description].some((value) => (value || '').toLowerCase().includes(normalizedSearch));
        };

        return [...myProjects]
            .filter((project) => matchesFilter(project) && matchesSearch(project))
            .sort((a, b) => {
                if (sort === 'progress') return (b.progress || 0) - (a.progress || 0);
                if (sort === 'due') {
                    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
                    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
                    return aDue - bDue;
                }
                return toMillis(b.createdAt) - toMillis(a.createdAt);
            });
    }, [myProjects, filter, search, sort]);

    // Featured Project logic (from My Projects)
    const featuredProject = useMemo(() => {
        if (myProjects.length === 0) return null;
        const active = myProjects.filter(p => p.status === 'Active');
        if (active.length > 0) {
            return active.sort((a, b) => (b.progress || 0) - (a.progress || 0))[0];
        }
        return myProjects[0];
    }, [myProjects]);

    const filterCounts = {
        all: myProjects.length,
        active: myProjects.filter((p) => p.status === 'Active').length,
        planning: myProjects.filter((p) => p.status === 'Brainstorming' || p.status === 'Planning').length,
        completed: myProjects.filter((p) => p.status === 'Completed').length
    };

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-10 pb-20 p-4 md:p-8 animate-fade-in">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-500 font-black tracking-widest text-xs uppercase">
                        <span className="h-px w-8 bg-indigo-500/30" />
                        Workspace
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-[var(--color-text-main)] tracking-tight">
                        Your Initiatives
                    </h1>
                    <p className="text-[var(--color-text-muted)] text-base font-medium max-w-lg">
                        You have <span className="text-[var(--color-text-main)] font-bold">{filterCounts.active} active</span> projects in progress. Keep up the great work!
                    </p>
                </div>
                {can('canCreateProjects') && (
                    <Link to="/create">
                        <Button
                            size="lg"
                            className="h-14 px-8 rounded-2xl shadow-xl shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white border-none font-bold text-lg group transition-all"
                            icon={<span className="material-symbols-outlined group-hover:rotate-90 transition-transform">add</span>}
                        >
                            Create Project
                        </Button>
                    </Link>
                )}
            </div>

            {/* Featured Section */}
            {featuredProject && filter === 'all' && !search && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Focus of the day</h3>
                    </div>
                    <FeaturedProject project={featuredProject} />
                </div>
            )}

            {showSuggestion && featuredProject && (
                <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/10 rounded-2xl p-5 flex items-start gap-4 relative overflow-hidden backdrop-blur-sm group">
                    <div className="absolute top-0 right-0 p-8 transform translate-x-1/2 -translate-y-1/2 bg-indigo-500/10 blur-3xl rounded-full" />
                    <div className="size-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-600 flex-shrink-0">
                        <span className="material-symbols-outlined animate-pulse">auto_awesome</span>
                    </div>
                    <div className="flex-1 pr-10">
                        <p className="text-sm text-indigo-900 dark:text-indigo-100 leading-relaxed">
                            <span className="font-black text-indigo-600 dark:text-indigo-400 mr-1 uppercase text-xs tracking-wider">Gemini:</span>
                            Based on your activity, we suggest reviewing milestones for <span className="font-bold underline decoration-indigo-300">"{featuredProject.title}"</span> today.
                        </p>
                    </div>
                    <button onClick={() => setShowSuggestion(false)} className="absolute top-4 right-4 text-indigo-400 hover:text-indigo-700 transition-colors">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}

            <div className="flex flex-col gap-8">
                {/* My Projects Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-[var(--color-surface-border)]/50">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        {(['all', 'active', 'planning', 'completed'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`
                                    px-6 py-2.5 rounded-xl text-sm font-black transition-all capitalize whitespace-nowrap flex items-center gap-2
                                    ${filter === f
                                        ? 'bg-[var(--color-text-main)] text-[var(--color-surface-paper)] shadow-lg shadow-black/5 transform scale-105'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}
                                `}
                            >
                                {f}
                                <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold ${filter === f ? 'bg-white/20' : 'bg-[var(--color-surface-border)]'}`}>
                                    {f === 'planning' ? filterCounts.planning : (filterCounts as any)[f]}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search your projects..."
                            className="w-full"
                            icon="search"
                        />
                        <Select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as any)}
                            className="w-full lg:w-40"
                        >
                            <option value="recent">RECENT</option>
                            <option value="due">DUE DATE</option>
                            <option value="progress">PROGRESS</option>
                        </Select>
                    </div>
                </div>

                {/* My Projects Grid */}
                {filteredMyProjects.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-[var(--color-surface-border)] rounded-xl">
                        <span className="material-symbols-outlined text-4xl text-[var(--color-text-subtle)] mb-4">folder_off</span>
                        <h3 className="text-lg font-bold text-[var(--color-text-main)]">No projects found</h3>
                        <p className="text-[var(--color-text-muted)] mb-4">Create your first project to get started.</p>
                        {can('canCreateProjects') && (
                            <Link to="/create">
                                <Button variant="outline">Create Project</Button>
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMyProjects.map((p) => (
                            <ProjectCard key={p.id} project={p} />
                        ))}
                    </div>
                )}
            </div>

            {/* Other Projects List View */}
            {otherProjects.length > 0 && (
                <div className="pt-10 space-y-6">
                    <div className="flex items-center justify-between border-b border-[var(--color-surface-border)] pb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--color-text-main)]">Other Workspace Projects</h2>
                            <p className="text-sm text-[var(--color-text-muted)]">Projects in this workspace that you are not a member of.</p>
                        </div>
                    </div>

                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-subtle)] uppercase tracking-wider font-semibold border-b border-[var(--color-surface-border)]">
                                <tr>
                                    <th className="px-6 py-4">Project</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Members</th>
                                    <th className="px-6 py-4">Created</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-surface-border)]">
                                {otherProjects.map(project => (
                                    <tr key={project.id} className="hover:bg-[var(--color-surface-hover)] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                                    {project.squareIcon ? (
                                                        <img src={project.squareIcon} alt="" className="w-full h-full object-cover rounded-lg" />
                                                    ) : (
                                                        <span className="material-symbols-outlined">folder</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[var(--color-text-main)]">{project.title}</div>
                                                    <div className="text-xs text-[var(--color-text-muted)] line-clamp-1 max-w-xs">{project.description}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={project.status === 'Active' ? 'success' : 'secondary'} size="sm">
                                                {project.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <MemberAvatars projectId={project.id} />
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">
                                            {new Date(toMillis(project.createdAt)).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.location.href = `/project/${project.id}`}
                                                icon={<span className="material-symbols-outlined">visibility</span>}
                                            >
                                                View
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div >
    );
};
