import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useParams, Link } from 'react-router-dom';
import { ProjectSidebar } from './ProjectSidebar';
import { getProjectById, getProjectIdeas, getProjectTasks, getTaskById } from '../services/dataService';
import { Task } from '../types';
import { auth } from '../services/firebase';

export const ProjectLayout = () => {
    const { id, taskId } = useParams<{ id: string; taskId?: string }>();
    const location = useLocation();
    const isMindmapPage = location.pathname.includes('/mindmap');
    const [projectTitle, setProjectTitle] = useState('Loading...');
    const [taskTitle, setTaskTitle] = useState<string>('');
    const [tasksCount, setTasksCount] = useState(0);
    const [ideasCount, setIdeasCount] = useState(0);
    const user = auth?.currentUser;

    useEffect(() => {
        if (id) {
            (async () => {
                const p = await getProjectById(id);
                if (p) setProjectTitle(p.title);
                const [tasks, ideas] = await Promise.all([
                    getProjectTasks(id),
                    getProjectIdeas(id)
                ]);
                setTasksCount(tasks.length);
                setIdeasCount(ideas.length);
            })();
        }
    }, [id]);

    useEffect(() => {
        if (taskId) {
            (async () => {
                try {
                    const t = await getTaskById(taskId);
                    if (t?.title) setTaskTitle(t.title);
                } catch (err) {
                    console.warn('Failed to load task title for breadcrumb', err);
                }
            })();
        } else {
            setTaskTitle('');
        }
    }, [taskId]);

    const breadcrumbSegments = () => {
        const segments = location.pathname.split('/').filter(Boolean);
        const crumbs: { label: string; to?: string }[] = [{ label: 'Projects', to: '/projects' }];
        if (id) {
            crumbs.push({ label: projectTitle || 'Project', to: `/project/${id}` });
        }

        // For task detail route: /project/:id/tasks/:taskId
        const isTaskDetail = segments[2] === 'tasks' && taskId;

        if (isTaskDetail) {
            crumbs.push({ label: 'Tasks', to: `/project/${id}/tasks` });
            crumbs.push({ label: taskTitle || 'Task' });
        } else {
            const last = segments[segments.length - 1];
            const mapping: Record<string, string> = {
                tasks: 'Tasks',
                ideas: 'Ideas',
                mindmap: 'Mindmap',
                activity: 'Activity',
                details: 'Details'
            };
            if (mapping[last]) {
                crumbs.push({ label: mapping[last] });
            }
        }
        return crumbs;
    };

    return (
        <div className="flex h-screen w-full bg-background-light dark:bg-background-dark font-display">
            <ProjectSidebar projectTitle={projectTitle} tasksCount={tasksCount} ideasCount={ideasCount} />
            
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-gray-200 dark:border-gray-800 bg-card-light dark:bg-card-dark px-6 py-3 shrink-0 z-20">
                    <div className="flex items-center gap-4 flex-1">
                        <button className="md:hidden p-2 text-gray-500">
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <button className="hidden sm:flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 shadow-sm hover:border-black dark:hover:border-gray-600 hover:shadow-md transition-all text-left min-w-[220px]">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="size-8 rounded-lg bg-black dark:bg-white flex items-center justify-center text-white dark:text-black text-sm font-bold shadow-sm flex-shrink-0">
                                    {projectTitle ? projectTitle.substring(0,1).toUpperCase() : 'P'}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{projectTitle || 'Loading...'}</span>
                                    <span className="text-[10px] text-gray-500 font-medium truncate">Switch project</span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-gray-400 text-[20px]">unfold_more</span>
                        </button>
                        <label className="hidden sm:flex flex-col min-w-40 !h-11 max-w-[480px] w-full group">
                            <div className="flex w-full flex-1 items-stretch rounded-lg h-full border border-gray-100 dark:border-gray-800 focus-within:border-black/50 focus-within:ring-2 focus-within:ring-black/10 transition-all bg-gray-50 dark:bg-gray-900">
                                <div className="text-gray-500 flex items-center justify-center pl-4 rounded-l-lg border-r-0">
                                    <span className="material-symbols-outlined text-black dark:text-white">auto_awesome</span>
                                </div>
                                <input className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg rounded-l-none text-gray-900 dark:text-white focus:outline-0 focus:ring-0 border-none bg-transparent focus:border-none h-full placeholder:text-gray-400 px-4 pl-2 text-base font-normal leading-normal" placeholder="Ask AI about projects, tasks, or search..." />
                            </div>
                        </label>
                    </div>
                    
                    <div className="flex flex-1 justify-end gap-4 items-center">
                        <div className="flex gap-2">
                            <button className="flex items-center justify-center overflow-hidden rounded-lg size-10 bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 transition-colors relative">
                                <span className="material-symbols-outlined">notifications</span>
                                <span className="absolute top-2.5 right-2.5 size-2 bg-black dark:bg-white rounded-full border-2 border-white dark:border-gray-800"></span>
                            </button>
                            <button className="hidden sm:flex items-center justify-center overflow-hidden rounded-lg size-10 bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 transition-colors">
                                <span className="material-symbols-outlined">help</span>
                            </button>
                            <div className="md:hidden bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border border-gray-200" style={{ backgroundImage: user?.photoURL ? `url("${user.photoURL}")` : 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAUDnuDd21ZOybk43aAFZMF8BuZPooFbf615qSB3FofT8gp9e1995VjvW8jb9otnKFfzKlRUh60cKlpKWO3PvuhE5SmZa8nS03FSRIcFLcXxBiGJtYkrxjsmdGVHcgXXCySiQs7nDjqbvc0w8WmGBVGn6T-oQ43k7QWEmuuRT63iGTXNcnzfTKZ9eU-yYSgTWcRFORG_HHCxTuCFSUWxbu8OjYbx5-4qd8bOwHJCBM2tr-e5Ml5LlAUucWxYA4xRF_69RInugzbiW0")' }}></div>
                        </div>
                    </div>
                </header>

                <main className={`flex-1 overflow-y-auto w-full ${isMindmapPage ? 'px-0 pb-0 pt-6' : 'px-4 sm:px-6 lg:px-8 py-6'} relative bg-background-light dark:bg-background-dark`}>
                    <nav className={`flex items-center gap-2 text-sm text-slate-500 mb-4 ${isMindmapPage ? 'pl-8' : ''}`}>
                        {breadcrumbSegments().map((crumb, idx, arr) => (
                            <React.Fragment key={`${crumb.label}-${idx}`}>
                                {crumb.to ? (
                                    <Link to={crumb.to} className="font-semibold text-slate-600 dark:text-slate-200 hover:underline truncate">{crumb.label}</Link>
                                ) : (
                                    <span className="font-semibold text-slate-900 dark:text-white truncate">{crumb.label}</span>
                                )}
                                {idx < arr.length - 1 && <span className="text-slate-300">/</span>}
                            </React.Fragment>
                        ))}
                    </nav>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
