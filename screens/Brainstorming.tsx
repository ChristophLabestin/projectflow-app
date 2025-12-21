import React, { useState, useEffect } from 'react';
import { generateBrainstormIdeas } from '../services/geminiService';
import { getUserIdeas, saveIdea } from '../services/dataService';
import { Idea } from '../types';

const promptSuggestions = [
    'A mobile app for local fitness challenges and community rewards.',
    'A dashboard that helps remote teams run async retrospectives.',
    'A SaaS for tracking sustainability goals across departments.',
    'An AI assistant for planning cross-team product launches.'
];

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
            for (const idea of newIdeas) {
                await saveIdea(idea);
            }
            const updated = await getUserIdeas();
            setIdeas(updated);
            setPrompt('');
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Failed to generate ideas.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-6 md:py-10 animate-fade-up">
            <div className="flex flex-col gap-8 mb-10">
                <div className="flex flex-col gap-3 max-w-3xl">
                    <span className="app-pill w-fit">AI Studio</span>
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold leading-tight text-ink">
                        Shape a project with a single prompt
                    </h1>
                    <p className="text-muted text-lg leading-relaxed">
                        Describe your goal and let Gemini draft features, tasks, and storylines to get you moving.
                    </p>
                </div>

                <div className="w-full app-panel p-6 space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="textarea-field w-full min-h-[160px] p-4 text-base"
                        placeholder="Describe your project idea in a few sentences..."
                    ></textarea>
                    <div className="flex flex-wrap gap-2">
                        {promptSuggestions.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => setPrompt(suggestion)}
                                className="app-tag hover:border-black"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 btn-primary text-sm font-bold disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <span className={`material-symbols-outlined text-[20px] ${isGenerating ? 'animate-spin' : ''}`}>
                                {isGenerating ? 'autorenew' : 'auto_awesome'}
                            </span>
                            <span>{isGenerating ? 'Dreaming...' : 'Generate AI Ideas'}</span>
                        </button>
                        <span className="text-xs text-muted">Tip: Keep it to 2-3 sentences for sharper results.</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">{error}</div>
            )}

            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-display font-bold flex items-center gap-2 text-ink">
                        <span className="material-symbols-outlined text-primary">lightbulb</span>
                        Brainstorming Board
                    </h3>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {ideas.map((idea) => (
                            <div key={idea.id} className="app-card group relative flex flex-col p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="app-tag">{idea.type}</span>
                                        {idea.generated && (
                                            <span className="material-symbols-outlined text-[16px] text-ink" title="AI Generated">
                                                auto_awesome
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <h4 className="text-ink text-lg font-display font-bold mb-2 leading-tight">{idea.title}</h4>
                                <p className="text-muted text-sm leading-relaxed mb-4 flex-1">{idea.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
