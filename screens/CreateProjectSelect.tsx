import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';

export const CreateProjectSelect = () => {
    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-10 p-8 animate-fade-up">
            <div className="text-center space-y-2">
                <h1 className="h2 text-[var(--color-text-main)]">Start a New Project</h1>
                <p className="text-[var(--color-text-muted)]">Choose how you want to begin your new initiative.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link to="/create/form" className="group">
                    <Card hoverable className="h-full flex flex-col items-center text-center p-8 gap-4 border-2 border-transparent hover:border-[var(--color-primary-light)]">
                        <div className="size-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-3xl">edit_document</span>
                        </div>
                        <div>
                            <h3 className="h3 mb-2 text-[var(--color-text-main)]">From Scratch</h3>
                            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                Define your project goals, timeline, and details manually. Best for specific, well-defined projects.
                            </p>
                        </div>
                    </Card>
                </Link>

                <Link to="/brainstorm" className="group">
                    <Card hoverable className="h-full flex flex-col items-center text-center p-8 gap-4 border-2 border-transparent hover:border-amber-300">
                        <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-3xl">lightbulb</span>
                        </div>
                        <div>
                            <h3 className="h3 mb-2 text-[var(--color-text-main)]">AI Brainstorm</h3>
                            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                Not sure where to start? Let Gemini AI help you structure your project idea and suggest tasks.
                            </p>
                        </div>
                    </Card>
                </Link>
            </div>

            <div className="text-center">
                <Link to="/projects" className="text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">Cancel</Link>
            </div>
        </div>
    );
};
