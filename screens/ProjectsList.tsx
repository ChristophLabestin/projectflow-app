import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserProjects } from '../services/dataService';
import { Project } from '../types';

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
    // Generate some visual properties based on project ID or status if not present
    const isBrainstorming = project.status === 'Brainstorming' || project.status === 'Planning';
    const isCompleted = project.status === 'Completed';
    
    let icon = 'folder';
    let colorClass = 'text-primary';
    let bgClass = 'bg-gray-100 dark:bg-gray-800';
    let barColor = 'bg-primary';

    if (isBrainstorming) {
        icon = 'lightbulb';
        colorClass = 'text-purple-600 dark:text-purple-400';
        bgClass = 'bg-purple-100 dark:bg-purple-900/30';
        barColor = 'bg-purple-500';
    } else if (isCompleted) {
        icon = 'check_circle';
        colorClass = 'text-green-600 dark:text-green-400';
        bgClass = 'bg-green-100 dark:bg-green-900/30';
        barColor = 'bg-green-500';
    }

    return (
        <div className="group flex flex-col gap-4 rounded-xl p-5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-card-dark shadow-sm hover:shadow-md hover:border-primary/30 dark:hover:border-primary/30 transition-all cursor-pointer relative overflow-hidden h-full">
            {project.coverImage && (
                <div className="absolute top-0 left-0 w-full h-32 opacity-10 pointer-events-none">
                    <img src={project.coverImage} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white dark:to-card-dark"></div>
                </div>
            )}
            <div className="flex justify-between items-start relative z-10">
                {project.squareIcon ? (
                    <div className="size-12 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white">
                        <img src={project.squareIcon} alt="" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className={`size-12 rounded-xl flex items-center justify-center border border-transparent ${bgClass} ${colorClass}`}>
                        <span className="material-symbols-outlined">{icon}</span>
                    </div>
                )}
                <button className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><span className="material-symbols-outlined">more_horiz</span></button>
            </div>
            <div className="relative z-10 flex-1">
                <div className="flex items-center justify-between mb-2">
                    <Link to={`/project/${project.id}`} className="block w-full">
                         <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1">{project.title}</h3>
                    </Link>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed h-10">{project.description || "No description provided."}</p>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${project.progress || 0}%` }}></div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500 font-medium">
                <span>{project.progress || 0}% Complete</span>
                <span>{project.dueDate ? `Due ${new Date(project.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}` : 'No deadline'}</span>
            </div>
            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between relative z-10">
                 <div className="flex -space-x-2">
                    <div className="size-7 rounded-full ring-2 ring-white dark:ring-card-dark bg-gray-200 flex items-center justify-center text-[10px] font-bold">You</div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {project.status}
                </span>
            </div>
        </div>
    );
};

export const ProjectsList = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSuggestion, setShowSuggestion] = useState(true);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const data = await getUserProjects();
                setProjects(data);
            } catch (error) {
                console.error("Failed to fetch projects", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const filterCounts = {
        all: projects.length,
        active: projects.filter(p => p.status === 'Active').length,
        brainstorming: projects.filter(p => p.status === 'Brainstorming' || p.status === 'Planning').length,
        completed: projects.filter(p => p.status === 'Completed').length,
    };

    return (
        <div className="max-w-[1200px] mx-auto flex flex-col gap-6 md:gap-8 pb-10 p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-gray-900 dark:text-white text-3xl md:text-4xl font-extrabold leading-tight tracking-[-0.033em]">Projects</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-base font-medium">Overview of all active, brainstorming, and completed initiatives.</p>
                </div>
                <Link to="/create" className="flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-neutral-800 transition-colors shadow-lg shadow-black/20">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    <span>New Project</span>
                </Link>
            </div>

            {showSuggestion && (
                <div className="w-full">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 p-4">
                        <div className="size-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 text-primary">
                            <span className="material-symbols-outlined text-lg">auto_awesome</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-900 dark:text-white font-medium">
                                <span className="font-bold">Gemini Suggestion:</span> Review your 'Planning' phase projects.
                            </p>
                        </div>
                        <button onClick={() => setShowSuggestion(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center bg-white dark:bg-card-dark p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex p-1 bg-gray-50 dark:bg-gray-800 rounded-lg w-full sm:w-auto overflow-x-auto">
                    <button className="flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm whitespace-nowrap bg-white dark:bg-gray-700 shadow-sm font-bold text-gray-900 dark:text-white">
                        All Projects ({filterCounts.all})
                    </button>
                    <button className="flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm whitespace-nowrap font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
                        Active ({filterCounts.active})
                    </button>
                    <button className="flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm whitespace-nowrap font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
                        Planning ({filterCounts.brainstorming})
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span>
                </div>
            ) : projects.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <span className="material-symbols-outlined text-4xl text-gray-400 mb-4">folder_off</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No projects yet</h3>
                    <p className="text-gray-500 mb-4">Create your first project to get started.</p>
                    <Link to="/create" className="text-primary font-bold hover:underline">Create Project</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(p => <ProjectCard key={p.id} project={p} />)}
                </div>
            )}
        </div>
    );
};
