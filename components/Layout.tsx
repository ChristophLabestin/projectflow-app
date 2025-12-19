import React from 'react';
import { Sidebar } from './Sidebar';
import { useLocation, Link } from 'react-router-dom';

export const Layout = ({ children }: { children?: React.ReactNode }) => {
    const location = useLocation();
    const isBrainstorm = location.pathname.startsWith('/brainstorm');

    return (
        <div className="flex h-screen w-full bg-background-light dark:bg-background-dark">
            <Sidebar />
            
            <div className="flex flex-col flex-1 h-full overflow-hidden relative">
                {/* Header */}
                <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-gray-200 dark:border-gray-800 bg-card-light dark:bg-card-dark px-6 py-3 shrink-0 z-20">
                    <div className="flex items-center gap-4 flex-1">
                        <button className="md:hidden p-2 text-gray-500">
                            <span className="material-symbols-outlined">menu</span>
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
                            {/* Profile Circle for Mobile if needed */}
                            <div className="md:hidden bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border border-gray-200" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAUDnuDd21ZOybk43aAFZMF8BuZPooFbf615qSB3FofT8gp9e1995VjvW8jb9otnKFfzKlRUh60cKlpKWO3PvuhE5SmZa8nS03FSRIcFLcXxBiGJtYkrxjsmdGVHcgXXCySiQs7nDjqbvc0w8WmGBVGn6T-oQ43k7QWEmuuRT63iGTXNcnzfTKZ9eU-yYSgTWcRFORG_HHCxTuCFSUWxbu8OjYbx5-4qd8bOwHJCBM2tr-e5Ml5LlAUucWxYA4xRF_69RInugzbiW0")' }}></div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark scroll-smooth">
                    {children}
                </main>

                {/* Mobile Bottom Nav */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-card-dark border-t border-gray-200 dark:border-gray-800 flex justify-between px-6 py-3 z-50">
                    <Link to="/" className="flex flex-col items-center gap-1 text-gray-500">
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="text-[10px] font-medium">Home</span>
                    </Link>
                    <Link to="/projects" className="flex flex-col items-center gap-1 text-gray-500">
                        <span className="material-symbols-outlined">folder</span>
                        <span className="text-[10px] font-medium">Projects</span>
                    </Link>
                    <Link to="/create" className="flex flex-col items-center gap-1">
                         <div className="size-10 -mt-8 bg-black dark:bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-card-dark text-white dark:text-black">
                            <span className="material-symbols-outlined">add</span>
                        </div>
                    </Link>
                    <Link to="/tasks" className="flex flex-col items-center gap-1 text-gray-500">
                        <span className="material-symbols-outlined">check_circle</span>
                        <span className="text-[10px] font-medium">Tasks</span>
                    </Link>
                     <Link to="/settings" className="flex flex-col items-center gap-1 text-gray-500">
                        <span className="material-symbols-outlined">settings</span>
                        <span className="text-[10px] font-medium">Settings</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};