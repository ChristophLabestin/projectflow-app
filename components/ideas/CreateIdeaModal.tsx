import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Idea } from '../../types';
import { saveIdea } from '../../services/dataService';

interface CreateIdeaModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    onCreated: () => void;
}

import { PIPELINE_CONFIGS } from './constants';

const IDEA_TYPES = [
    { id: 'Feature', label: 'Feature', icon: 'stars', bg: 'from-slate-900 via-indigo-950 to-slate-900' },
    { id: 'Product', label: 'Product', icon: 'inventory_2', bg: 'from-slate-900 via-rose-950 to-slate-900' },
    { id: 'Moonshot', label: 'Moonshot', icon: 'rocket_launch', bg: 'from-slate-900 via-purple-950 to-slate-900' },
    { id: 'Optimization', label: 'Optimization', icon: 'speed', bg: 'from-slate-900 via-emerald-950 to-slate-900' },
    { id: 'Marketing', label: 'Marketing', icon: 'campaign', bg: 'from-slate-900 via-orange-950 to-slate-900' },
    { id: 'Social', label: 'Social Media', icon: 'share', bg: 'from-slate-900 via-pink-950 to-slate-900' },
];

export const CreateIdeaModal: React.FC<CreateIdeaModalProps> = ({ isOpen, onClose, projectId, onCreated }) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState('Feature');
    const [loading, setLoading] = useState(false);

    const selectedType = IDEA_TYPES.find(t => t.id === type) || IDEA_TYPES[0];

    // ... inside component ...
    const handleSave = async () => {
        if (!title.trim()) return;
        setLoading(true);
        try {
            // Get initial stage for the selected type
            const initialStage = PIPELINE_CONFIGS[type]?.[0]?.id || 'Brainstorm';

            await saveIdea({
                title,
                description: '',
                type: type as any,
                projectId,
                stage: initialStage as any,
                generated: false,
                votes: 0,
                comments: 0,
            });
            onCreated();
            handleClose();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setTitle('');
        setType('Feature');
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && title.trim()) {
            e.preventDefault();
            handleSave();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="" size="md" hideHeader noPadding>
            <div className="relative overflow-hidden bg-slate-900 transition-all duration-700 rounded-2xl">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {/* Gradient Background */}
                    <div
                        className="absolute inset-0 transition-all duration-700"
                        style={{
                            background: type === 'Feature'
                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, transparent 40%), linear-gradient(315deg, rgba(59, 130, 246, 0.08) 0%, transparent 40%)'
                                : type === 'Product'
                                    ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, transparent 40%), linear-gradient(315deg, rgba(251, 113, 133, 0.08) 0%, transparent 40%)'
                                    : type === 'Moonshot'
                                        ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, transparent 40%), linear-gradient(315deg, rgba(139, 92, 246, 0.08) 0%, transparent 40%)'
                                        : type === 'Optimization'
                                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, transparent 40%), linear-gradient(315deg, rgba(20, 184, 166, 0.08) 0%, transparent 40%)'
                                            : type === 'Social'
                                                ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, transparent 40%), linear-gradient(315deg, rgba(236, 72, 153, 0.08) 0%, transparent 40%)'
                                                : 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, transparent 40%), linear-gradient(315deg, rgba(245, 158, 11, 0.08) 0%, transparent 40%)'
                        }}
                    />

                    {/* Animated Glow Orbs */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 animate-pulse" style={{ animationDelay: '1s' }} />

                    {/* Moving Particles with CSS animations */}
                    <style>{`
                        @keyframes wander-1 {
                            0% { transform: translate(0, 0); }
                            50% { transform: translate(120px, -80px); }
                            100% { transform: translate(0, 0); }
                        }
                        @keyframes wander-2 {
                            0% { transform: translate(0, 0); }
                            50% { transform: translate(-100px, -60px); }
                            100% { transform: translate(0, 0); }
                        }
                        @keyframes wander-3 {
                            0% { transform: translate(0, 0); }
                            33% { transform: translate(60px, -40px); }
                            66% { transform: translate(-80px, -90px); }
                            100% { transform: translate(0, 0); }
                        }
                    `}</style>

                    {/* Slowly Wandering Particles */}
                    <div className="absolute bottom-[20%] left-[10%] size-2 bg-white/25 rounded-full" style={{ animation: 'wander-1 20s ease-in-out infinite' }} />
                    <div className="absolute bottom-[35%] left-[25%] size-1.5 bg-white/20 rounded-full" style={{ animation: 'wander-2 25s ease-in-out infinite', animationDelay: '5s' }} />
                    <div className="absolute bottom-[15%] right-[15%] size-2.5 bg-white/15 rounded-full" style={{ animation: 'wander-3 30s ease-in-out infinite', animationDelay: '2s' }} />
                    <div className="absolute bottom-[45%] right-[25%] size-1 bg-white/30 rounded-full" style={{ animation: 'wander-1 22s ease-in-out infinite', animationDelay: '8s' }} />
                    <div className="absolute bottom-[25%] left-[50%] size-2 bg-white/20 rounded-full" style={{ animation: 'wander-2 28s ease-in-out infinite', animationDelay: '12s' }} />
                    <div className="absolute bottom-[40%] right-[40%] size-1.5 bg-white/25 rounded-full" style={{ animation: 'wander-3 24s ease-in-out infinite', animationDelay: '15s' }} />

                    {/* Subtle Grid */}
                    <div
                        className="absolute inset-0 opacity-[0.02]"
                        style={{
                            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                            backgroundSize: '32px 32px'
                        }}
                    />
                </div>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                </button>

                {/* Content */}
                <div className="relative p-8 space-y-8 min-h-[400px] flex flex-col justify-center">
                    {/* Icon */}
                    <div className="flex justify-center">
                        <div className="size-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white shadow-2xl border border-white/20">
                            <span className="material-symbols-outlined text-4xl">{selectedType.icon}</span>
                        </div>
                    </div>

                    {/* Title Input - Above Chips */}
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="What's your big idea?"
                            autoFocus
                            className="w-full text-3xl font-bold bg-transparent border-none outline-none text-white placeholder:text-white/40 text-center"
                        />
                        <p className="text-sm text-white/50 text-center">
                            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs">Enter</kbd> to create
                        </p>
                    </div>

                    {/* Type Selector - Pills */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        {IDEA_TYPES.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setType(t.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300
                                    ${type === t.id
                                        ? 'bg-white text-slate-800 shadow-xl scale-105'
                                        : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white border border-white/10'
                                    }
                                `}
                            >
                                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-4 pt-4">
                        <button
                            onClick={handleClose}
                            className="px-6 py-2.5 text-sm text-white/60 hover:text-white transition-colors rounded-xl hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <Button
                            onClick={handleSave}
                            isLoading={loading}
                            disabled={!title.trim()}
                            className="bg-white hover:bg-white/90 text-slate-800 border-0 shadow-xl px-8 font-semibold"
                            icon={<span className="material-symbols-outlined">lightbulb</span>}
                        >
                            Create Idea
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
