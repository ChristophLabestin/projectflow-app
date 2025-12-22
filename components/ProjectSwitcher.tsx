import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Project } from '../types';
import { getUserProjects, getSharedProjects } from '../services/dataService';
import logo from '../assets/logo.svg';

interface ProjectSwitcherProps {
    currentProjectId?: string;
    currentProjectTitle?: string;
    onClose?: () => void;
}

export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ currentProjectId, currentProjectTitle, onClose }) => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch projects on mount to ensure we have icons for the active state
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const [myProjects, sharedProjects] = await Promise.all([
                    getUserProjects(),
                    getSharedProjects()
                ]);
                const combined = [...myProjects, ...sharedProjects];
                const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());

                unique.sort((a, b) => {
                    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                    return dateB - dateA;
                });

                setProjects(unique);
            } catch (error) {
                console.error("Failed to load projects", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const activeProject = projects.find(p => p.id === currentProjectId);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredProjects = projects.filter(p =>
        p.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSwitch = (projectId: string) => {
        navigate(`/project/${projectId}`);
        setIsOpen(false);
        if (onClose) onClose();
    };

    const handleWorkspaceClick = () => {
        navigate('/');
        setIsOpen(false);
        if (onClose) onClose();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl 
                    transition-all duration-200 border border-transparent
                    ${isOpen
                        ? 'bg-[var(--color-surface-hover)]'
                        : 'bg-transparent hover:bg-[var(--color-surface-hover)]'}
                    focus:outline-none focus:ring-0 focus-visible:outline-none focus:border-transparent
                    outline-none active:bg-[var(--color-surface-hover)] active:outline-none
                    select-none
                `}
                style={{ WebkitTapHighlightColor: 'transparent', outline: 'none' }}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`
                        size-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden
                        ${activeProject?.squareIcon ? 'bg-transparent' : currentProjectId ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-[var(--color-surface-hover)]'}
                        shadow-sm text-white font-bold
                    `}>
                        {activeProject?.squareIcon ? (
                            <img src={activeProject.squareIcon} alt={activeProject.title} className="w-full h-full object-cover" />
                        ) : currentProjectId ? (
                            <span className="material-symbols-outlined text-[20px]">folder</span>
                        ) : (
                            <img src={logo} alt="PF" className="size-6 object-contain" />
                        )}
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                        <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                            {currentProjectId ? 'Project' : 'Workspace'}
                        </span>
                        <span className="text-sm font-bold text-[var(--color-text-main)] truncate max-w-[140px]">
                            {currentProjectTitle || 'ProjectFlow'}
                        </span>
                    </div>
                </div>
                <span className="material-symbols-outlined text-[var(--color-text-muted)]">unfold_more</span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-[280px] z-50 origin-top-left animate-fade-in-down">
                    <div className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10">

                        {/* Search */}
                        <div className="p-2 border-b border-[var(--color-surface-border)] sticky top-0 bg-[var(--color-surface-card)]">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[18px] text-[var(--color-text-muted)]">search</span>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Find project..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-[var(--color-surface-bg)] text-[var(--color-text-main)] rounded-lg border border-[var(--color-surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent placeholder-[var(--color-text-muted)]"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-[300px] overflow-y-auto py-1">

                            {/* Workspace (Home) */}
                            <button
                                onClick={handleWorkspaceClick}
                                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] transition-colors group"
                            >
                                <div className="size-6 bg-[var(--color-surface-hover)] rounded-md flex items-center justify-center group-hover:bg-[var(--color-surface-card)] transition-colors">
                                    <span className="material-symbols-outlined text-[16px] text-[var(--color-text-main)]">grid_view</span>
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-[var(--color-text-main)]">Dashboard</div>
                                </div>
                                {!currentProjectId && (
                                    <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>
                                )}
                            </button>

                            <div className="h-px bg-[var(--color-surface-border)] my-1 mx-3" />

                            <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Projects</div>

                            {loading && filteredProjects.length === 0 ? (
                                <div className="px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">
                                    Loading...
                                </div>
                            ) : filteredProjects.length > 0 ? (
                                filteredProjects.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSwitch(p.id)}
                                        className={`
                                            w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                                            ${currentProjectId === p.id ? 'bg-[var(--color-surface-hover)]' : 'hover:bg-[var(--color-surface-hover)]'}
                                        `}
                                    >
                                        <div className={`
                                            size-6 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden
                                            ${p.squareIcon ? 'bg-transparent' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}
                                        `}>
                                            {p.squareIcon ? (
                                                <img src={p.squareIcon} alt={p.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{p.title ? p.title.substring(0, 1).toUpperCase() : 'P'}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-[var(--color-text-main)] truncate">{p.title}</div>
                                            <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                                                {p.ownerId === p.id ? 'Owner' : 'Member'}
                                            </div>
                                        </div>
                                        {currentProjectId === p.id && (
                                            <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">
                                    No projects found
                                </div>
                            )}
                        </div>

                        <div className="p-2 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] text-center">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/create');
                                    if (onClose) onClose();
                                }}
                                className="w-full py-1.5 flex items-center justify-center gap-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined text-[14px]">add</span>
                                Create New Project
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
