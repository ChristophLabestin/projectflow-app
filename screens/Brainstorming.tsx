import React, { useState, useEffect } from 'react';
import { generateBrainstormIdeas } from '../services/geminiService';
import { getUserIdeas, saveIdea } from '../services/dataService';
import { Idea } from '../types';

export const Brainstorming = () => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchIdeas = async () => {
            try {
                const data = await getUserIdeas();
                setIdeas(data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchIdeas();
    }, []);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setError(null);
        try {
            const newIdeas = await generateBrainstormIdeas(prompt);
            
            // Save to Firestore
            for (const idea of newIdeas) {
                await saveIdea(idea);
            }
            
            // Refresh list
            const updated = await getUserIdeas();
            setIdeas(updated);
            setPrompt('');
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to generate ideas.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-6 md:py-10">
             <nav className="flex flex-wrap gap-2 pb-6">
                <a className="text-gray-500 hover:text-primary dark:hover:text-white transition-colors text-sm font-medium leading-normal flex items-center gap-1" href="#">
                    <span className="material-symbols-outlined text-[18px]">dashboard</span> Dashboard
                </a>
                <span className="text-gray-500 text-sm font-medium leading-normal">/</span>
                <span className="text-neutral-900 dark:text-white text-sm font-medium leading-normal">Brainstorming</span>
            </nav>

            <div className="flex flex-col gap-8 mb-12">
                <div className="flex flex-col gap-3 max-w-3xl">
                    <h1 className="text-neutral-900 dark:text-white text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight tracking-[-0.033em]">Let's kick off your new project</h1>
                    <p className="text-gray-500 text-lg font-normal leading-relaxed">Describe your goal, and let AI help you brainstorm features, tasks, and user stories.</p>
                </div>

                <div className="w-full">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-900/10 to-gray-500/10 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="relative w-full resize-none rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-card-dark p-6 text-base md:text-lg text-neutral-900 dark:text-white placeholder:text-gray-400 focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/5 dark:focus:ring-white/20 focus:outline-none min-h-[160px] shadow-sm transition-all" 
                            placeholder="Describe your project idea in a few sentences... e.g., A mobile app for tracking local coffee shop loyalty cards that allows users to scan QR codes and redeem rewards."
                        ></textarea>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-4">
                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="flex items-center justify-center gap-2 h-12 px-6 bg-primary hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 text-white text-base font-bold rounded-lg shadow-lg shadow-gray-900/10 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <span className={`material-symbols-outlined text-[20px] ${isGenerating ? 'animate-spin' : ''}`}>{isGenerating ? 'autorenew' : 'auto_awesome'}</span>
                            <span>{isGenerating ? 'Dreaming...' : 'Generate AI Ideas'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full h-px bg-gray-200 dark:bg-neutral-800 mb-8"></div>

            {error && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                    {error}
                </div>
            )}

            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-neutral-900 dark:text-white text-xl font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary dark:text-white">lightbulb</span>
                        Brainstorming Board
                    </h3>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-10"><span className="material-symbols-outlined animate-spin">progress_activity</span></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {ideas.map((idea) => (
                            <div key={idea.id} className="group relative flex flex-col p-5 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-black/50 dark:hover:border-white/50 hover:shadow-md transition-all cursor-pointer">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 bg-gray-100 dark:bg-neutral-800 text-black dark:text-white text-xs font-bold uppercase tracking-wider rounded">{idea.type}</span>
                                        {idea.generated && <span className="material-symbols-outlined text-[16px] text-black dark:text-white" title="AI Generated">auto_awesome</span>}
                                    </div>
                                </div>
                                <h4 className="text-neutral-900 dark:text-white text-lg font-bold mb-2 leading-tight">{idea.title}</h4>
                                <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1">{idea.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
