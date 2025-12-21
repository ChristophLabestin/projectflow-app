import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUserProjects, getSharedProjects } from '../services/dataService';
import { Project } from '../types';
import { toMillis } from '../utils/time';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
    const navigate = useNavigate();
    const isBrainstorming = project.status === 'Brainstorming' || project.status === 'Planning';
    const isCompleted = project.status === 'Completed';

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
        <div onClick={() => navigate(`/project/${project.id}`)} className="cursor-pointer h-full">
            <Card padding="none" hoverable className="h-full flex flex-col group relative overflow-hidden transition-all hover:shadow-md">
                {project.coverImage && (
                    <div className="h-32 w-full relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface-paper)] to-transparent z-10" />
                        <img src={project.coverImage} className="w-full h-full object-cover opacity-80" alt="" />
                    </div>
                )}

                <div className={`p-5 flex flex-col flex-1 gap-4 ${project.coverImage ? '-mt-12 relative z-20' : ''}`}>
                    <div className="flex justify-between items-start">
                        {project.squareIcon ? (
                            <div className="size-12 rounded-xl overflow-hidden border border-[var(--color-surface-border)] bg-white shadow-sm">
                                <img src={project.squareIcon} alt="" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className={`size-12 rounded-xl flex items-center justify-center border shadow-sm ${iconClass}`}>
                                <span className="material-symbols-outlined">{icon}</span>
                            </div>
                        )}
                        <Badge variant={isCompleted ? 'success' : isBrainstorming ? 'secondary' : 'primary'}>{project.status}</Badge>
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="block">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">
                                {project.title}
                            </h3>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                            {project.description || 'No description provided.'}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-subtle)]">
                            <span>{project.progress || 0}% Complete</span>
                            {project.dueDate && <span>Due {new Date(project.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                        </div>
                        <div className="w-full bg-[var(--color-surface-border)] rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${project.progress || 0}%` }}></div>
                        </div>
                    </div>
                </div>
                <div className="px-5 py-4 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] flex items-center justify-between">
                    <div className="flex items-center -space-x-2">
                        <div className="size-6 rounded-full bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">ME</div>
                    </div>
                    <div className="text-xs font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors">
                        Open Project <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export const ProjectsList = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
    const [sharedError, setSharedError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSuggestion, setShowSuggestion] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('all');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<'recent' | 'due' | 'progress'>('recent');

    useEffect(() => {

        const fetchProjects = async () => {
            let userProjects: Project[] = [];

            // Fetch User Projects (Critical)
            try {
                userProjects = await getUserProjects();
                setProjects(userProjects);
            } catch (error) {
                console.error('Failed to fetch user projects', error);
            }

            // Fetch Shared Projects (Optional - might fail without index)
            try {
                const shared = await getSharedProjects();

                // Merge and deduplicate
                const allProjects = [...userProjects];
                shared.forEach(p => {
                    if (!allProjects.find(existing => existing.id === p.id)) {
                        allProjects.push(p);
                    }
                });
                setProjects(allProjects);
                setSharedError(null);
            } catch (error: any) {
                console.error('Failed to fetch shared projects', error);
                if (error?.message?.includes('index')) {
                    setSharedError("Missing Index: Shared projects cannot be loaded. Check console for the Firestore Index creation link.");
                }
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const filterCounts = {
        all: projects.length,
        active: projects.filter((p) => p.status === 'Active').length,
        brainstorming: projects.filter((p) => p.status === 'Brainstorming' || p.status === 'Planning').length,
        completed: projects.filter((p) => p.status === 'Completed').length
    };

    const filteredProjects = useMemo(() => {
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
        const sorted = [...projects]
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
        return sorted;
    }, [projects, filter, search, sort]);

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto flex flex-col gap-8 pb-10 p-4 md:p-8 fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <h1 className="h2 text-[var(--color-text-main)]">Projects</h1>
                    <p className="text-[var(--color-text-muted)] text-sm font-medium">Manage your initiatives and track progress.</p>
                </div>
                <Link to="/create">
                    <Button icon={<span className="material-symbols-outlined">add</span>}>New Project</Button>
                </Link>
            </div>

            {showSuggestion && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 relative">
                    <span className="material-symbols-outlined text-indigo-500 mt-0.5">auto_awesome</span>
                    <div className="flex-1 pr-8">
                        <p className="text-sm text-indigo-900 font-medium">
                            <span className="font-bold">Gemini Suggestion:</span> Review your 'Planning' phase projects and pick next milestones.
                        </p>
                    </div>
                    <button onClick={() => setShowSuggestion(false)} className="absolute top-3 right-3 text-indigo-400 hover:text-indigo-700">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            )}

            {/* Shared Error Banner */}
            {sharedError && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-4 rounded-xl mb-6 flex items-start gap-3">
                    <span className="material-symbols-outlined mt-0.5">warning</span>
                    <div className="flex-1">
                        <p className="font-bold">Setup Required</p>
                        <p className="text-sm">{sharedError}</p>
                        <p className="text-xs mt-1 opacity-80">Right-click anywhere &rarr; Inspect &rarr; Console &rarr; Click the link from Firebase.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex bg-[var(--color-surface-hover)] rounded-lg p-1 w-full md:w-auto overflow-x-auto">
                        {(['all', 'active', 'planning', 'completed'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`
                                    px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize whitespace-nowrap flex disabled:opacity-50
                                    ${filter === f ? 'bg-[var(--color-surface-paper)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                                `}
                            >
                                {f}
                                <span className={`ml-2 text-xs py-0.5 px-1.5 rounded-full ${filter === f ? 'bg-[var(--color-surface-bg)]' : 'bg-transparent'}`}>
                                    {f === 'planning' ? filterCounts.brainstorming : filterCounts[f]}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search projects..."
                                icon={<span className="material-symbols-outlined">search</span>}
                                className="w-full"
                            />
                        </div>
                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as any)}
                            className="h-10 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text-main)]"
                        >
                            <option value="recent">Sort: Recent</option>
                            <option value="due">Sort: Due date</option>
                            <option value="progress">Sort: Progress</option>
                        </select>
                    </div>
                </div>

                {filteredProjects.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-[var(--color-surface-border)] rounded-xl">
                        <span className="material-symbols-outlined text-4xl text-[var(--color-text-subtle)] mb-4">folder_off</span>
                        <h3 className="text-lg font-bold text-[var(--color-text-main)]">No projects found</h3>
                        <p className="text-[var(--color-text-muted)] mb-4">Create your first project to get started.</p>
                        <Link to="/create">
                            <Button variant="outline">Create Project</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map((p) => (
                            <ProjectCard key={p.id} project={p} />
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
};
