import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { getProjectIdeas, getUserTasks } from '../services/dataService';

const NavItem = ({ to, icon, label, filled = false, badge }: { to: string, icon: string, label: string, filled?: boolean, badge?: number }) => {
    const location = useLocation();
    // Simple check: active if path starts with 'to', handling root exact match
    const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

    return (
        <Link 
            to={to} 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive 
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
        >
            <span className={`material-symbols-outlined ${filled || isActive ? 'fill' : ''}`}>{icon}</span>
            <span className={`text-sm font-medium leading-normal ${isActive ? '' : 'text-gray-900 dark:text-gray-300'}`}>
                {label}
            </span>
            {badge !== undefined && (
                <span className="ml-auto bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">{badge}</span>
            )}
        </Link>
    );
};

export const Sidebar = () => {
    const navigate = useNavigate();
    const user = auth.currentUser;
    const [taskCount, setTaskCount] = React.useState<number>(0);
    const [ideaCount, setIdeaCount] = React.useState<number>(0);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [tasks, ideas] = await Promise.all([
                    getUserTasks(),
                    getProjectIdeas('').catch(() => []) // fallback if no project id
                ]);
                if (mounted) {
                    setTaskCount(Array.isArray(tasks) ? tasks.length : 0);
                    setIdeaCount(Array.isArray(ideas) ? ideas.length : 0);
                }
            } catch (e) {
                console.warn('Failed to load counts', e);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <aside className="hidden md:flex flex-col w-64 h-full bg-card-light dark:bg-card-dark border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex-shrink-0 z-50">
            <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <div className="size-8 text-primary dark:text-white">
                    <img src="/assets/logo.svg" alt="ProjectFlow logo" className="w-8 h-8" />
                </div>
                <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">ProjectFlow</h2>
            </div>
            
            <nav className="flex flex-col gap-2 p-4 flex-1">
                <NavItem to="/" icon="dashboard" label="Dashboard" />
                <NavItem to="/projects" icon="folder" label="Projects" />
                <NavItem to="/tasks" icon="check_circle" label="Tasks" badge={taskCount} />
                <NavItem to="/brainstorm" icon="lightbulb" label="Ideas" badge={ideaCount} />
                <NavItem to="/team" icon="group" label="Team" />
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                <Link to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-4">
                    <span className="material-symbols-outlined">settings</span>
                    <span className="text-sm font-medium leading-normal text-gray-900 dark:text-gray-300">Settings</span>
                </Link>
                
                <div className="flex items-center gap-3 px-3 relative group">
                    <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border border-gray-200" style={{ backgroundImage: user?.photoURL ? `url("${user.photoURL}")` : 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAUDnuDd21ZOybk43aAFZMF8BuZPooFbf615qSB3FofT8gp9e1995VjvW8jb9otnKFfzKlRUh60cKlpKWO3PvuhE5SmZa8nS03FSRIcFLcXxBiGJtYkrxjsmdGVHcgXXCySiQs7nDjqbvc0w8WmGBVGn6T-oQ43k7QWEmuuRT63iGTXNcnzfTKZ9eU-yYSgTWcRFORG_HHCxTuCFSUWxbu8OjYbx5-4qd8bOwHJCBM2tr-e5Ml5LlAUucWxYA4xRF_69RInugzbiW0")' }}></div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{user?.displayName || 'Alex Morgan'}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-500 truncate">{user?.email || 'Pro Plan'}</span>
                    </div>
                    <button onClick={handleSignOut} className="absolute right-0 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors" title="Sign Out">
                         <span className="material-symbols-outlined text-lg">logout</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};
