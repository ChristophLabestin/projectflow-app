import React from 'react';
import { Link } from 'react-router-dom';

export const CreateProjectSelect = () => {
    return (
        <div className="max-w-[1000px] mx-auto w-full flex flex-col h-full gap-6 p-4 md:p-8">
            <div>
                <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Back to Projects
                </Link>
            </div>
            <div className="flex flex-col items-center justify-center flex-1 min-h-[60vh] pb-10">
                <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
                    <div className="size-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                        <span className="material-symbols-outlined text-4xl">folder_open</span>
                    </div>
                    <h1 className="text-black dark:text-white text-3xl md:text-4xl font-extrabold tracking-[-0.02em] mb-4">Create a new project</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Choose how you want to get started. You can skip AI generation and add details manually later.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-[900px]">
                    <Link to="/create/form" className="group flex flex-col items-start gap-5 p-6 md:p-8 rounded-2xl bg-white dark:bg-card-dark border-2 border-black/10 hover:border-black transition-all shadow-sm hover:shadow-xl hover:shadow-black/5 relative overflow-hidden text-left h-full">
                        <div className="absolute top-0 right-0 p-4">
                             <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-black/10 text-primary">Beta</span>
                        </div>
                        <div className="size-14 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-black dark:text-white mb-2 group-hover:text-primary transition-colors">Generate with AI</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                                Describe your goals and let <span className="font-medium text-black dark:text-gray-200">Gemini</span> generate tasks, milestones, and timelines automatically.
                            </p>
                        </div>
                    </Link>

                    <Link to="/create/form" className="group flex flex-col items-start gap-5 p-6 md:p-8 rounded-2xl bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-700 hover:border-primary hover:border-opacity-100 transition-all shadow-sm hover:shadow-lg text-left h-full">
                        <div className="size-14 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <span className="material-symbols-outlined text-gray-500 dark:text-gray-300 text-3xl">check_box_outline_blank</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-black dark:text-white mb-2 group-hover:text-primary transition-colors">Blank Project</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Start from scratch with a clean slate. Perfect if you already have a specific workflow structure in mind.</p>
                        </div>
                    </Link>

                    <Link to="/create/form" className="group flex flex-col items-start gap-5 p-6 md:p-8 rounded-2xl bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-700 hover:border-primary hover:border-opacity-100 transition-all shadow-sm hover:shadow-lg text-left h-full">
                        <div className="size-14 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                             <span className="material-symbols-outlined text-gray-500 dark:text-gray-300 text-3xl">grid_view</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-black dark:text-white mb-2 group-hover:text-primary transition-colors">Use a Template</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Choose from our gallery of best-practice templates for Marketing, Agile Engineering, and Design.</p>
                        </div>
                    </Link>

                    <Link to="/create/form" className="group flex flex-col items-start gap-5 p-6 md:p-8 rounded-2xl bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-700 hover:border-primary hover:border-opacity-100 transition-all shadow-sm hover:shadow-lg text-left h-full">
                        <div className="size-14 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                             <span className="material-symbols-outlined text-gray-500 dark:text-gray-300 text-3xl">upload_file</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-black dark:text-white mb-2 group-hover:text-primary transition-colors">Import Data</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Bring your existing projects from other tools via CSV, Excel, or Trello JSON export.</p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
};
