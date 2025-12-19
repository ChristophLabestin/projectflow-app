import React from 'react';
import { useLocation, Link, useNavigate, useParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

type NavItemProps = { to: string; icon: string; label: string; filled?: boolean; badge?: string; exact?: boolean };

const NavItem = ({ to, icon, label, filled = false, badge, exact = false }: NavItemProps) => {
    const location = useLocation();
    const isActive = exact
        ? location.pathname === to
        : (to === '/' ? location.pathname === '/' : (location.pathname === to || location.pathname.startsWith(`${to}/`)));

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

export const ProjectSidebar = ({ projectTitle, tasksCount = 0, ideasCount = 0 }: { projectTitle: string; tasksCount?: number; ideasCount?: number }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const user = auth.currentUser;

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
                    <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                        <path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fillRule="evenodd"></path>
                    </svg>
                </div>
                <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">ProjectFlow</h2>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
                <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 pb-1">General</div>
                <NavItem to="/" icon="dashboard" label="Dashboard" />
                <NavItem to="/projects" icon="folder_open" label="Projects" />
                <NavItem to="/tasks" icon="check_circle" label="Tasks" />
                <NavItem to="/brainstorm" icon="lightbulb" label="Brainstorm" />
                <NavItem to="/team" icon="group" label="Team" />

                <div className="pt-5 pb-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">Workspace</div>
                <NavItem to={`/project/${id || ''}`} icon="space_dashboard" label="Overview" filled exact />
                <NavItem to={`/project/${id || ''}/tasks`} icon="checklist" label="Tasks" badge={tasksCount ? String(tasksCount) : undefined} />
                <NavItem to={`/project/${id || ''}/ideas`} icon="lightbulb" label="Ideas" badge={ideasCount ? String(ideasCount) : undefined} />
                <NavItem to={`/project/${id || ''}/mindmap`} icon="hub" label="Mindmap" />
                <NavItem to={`/project/${id || ''}/activity`} icon="history" label="Activity" />
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
