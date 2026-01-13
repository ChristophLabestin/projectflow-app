import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Wand2, Search } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';
import { generateBlogPostAI, suggestBlogTopicsAI } from '../../../../services/geminiService';
import { getProjectById } from '../../../../services/dataService';
import { useToast } from '../../../../context/UIContext';
import { Button } from '../../../../components/ui/Button';

interface BlogAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (data: { title: string; excerpt: string; content: string }) => void;
    projectId?: string;
}

export const BlogAIModal: React.FC<BlogAIModalProps> = ({ isOpen, onClose, onGenerate, projectId }) => {
    const { language, t } = useLanguage();
    const { showError } = useToast();

    // Local state for the form
    const [prompt, setPrompt] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState(language);
    const [useSearch, setUseSearch] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestedTopics, setSuggestedTopics] = useState<{ title: string; rationale: string }[]>([]);
    const [isSuggestingTopics, setIsSuggestingTopics] = useState(false);

    // Sync selected language with app language when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedLanguage(language);
            setPrompt('');
            setUseSearch(false);
            setSuggestedTopics([]);
        }
    }, [isOpen, language]);

    const handleSuggestTopics = async () => {
        if (!projectId) return;
        setIsSuggestingTopics(true);
        try {
            const project = await getProjectById(projectId);
            if (!project) throw new Error('Project not found');

            const topics = await suggestBlogTopicsAI(project);
            setSuggestedTopics(topics);
        } catch (error) {
            console.error(error);
            showError('Failed to suggest topics.');
        } finally {
            setIsSuggestingTopics(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        try {
            const result = await generateBlogPostAI(prompt, selectedLanguage, useSearch);
            onGenerate(result);
            onClose();
        } catch (error: any) {
            console.error(error);
            showError('Failed to generate blog post. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-card w-full max-w-2xl rounded-xl shadow-2xl border border-surface overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 border-b border-surface flex items-center justify-between bg-surface">
                    <div className="flex items-center gap-2 text-primary">
                        <Sparkles size={20} className="fill-current" />
                        <h3 className="font-semibold text-lg">CORA Blog Assistant</h3>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-main transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-main">What should the blog post be about?</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="E.g. The future of remote work in 2025 and why async communication is key..."
                            className="w-full h-32 p-3 rounded-lg border border-surface bg-surface text-main placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSuggestTopics}
                                disabled={isSuggestingTopics || !projectId}
                                className="text-xs text-primary font-medium hover:underline flex items-center gap-1 disabled:opacity-50"
                            >
                                {isSuggestingTopics ? (
                                    <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                                ) : (
                                    <Sparkles size={12} />
                                )}
                                Suggest Topics
                            </button>
                        </div>
                    </div>

                    {suggestedTopics.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted uppercase tracking-wider">Suggested Topics</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {suggestedTopics.map((topic, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setPrompt(topic.title)}
                                        className="text-left p-3 rounded-lg border border-surface hover:border-primary hover:bg-primary/5 transition-all group"
                                    >
                                        <div className="font-medium text-sm text-main group-hover:text-primary">{topic.title}</div>
                                        <div className="text-xs text-muted mt-1">{topic.rationale}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium text-main">Language</label>
                            <select
                                value={selectedLanguage}
                                onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'de')}
                                className="w-full p-2.5 rounded-lg border border-surface bg-surface text-main focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
                            >
                                <option value="en">English (English)</option>
                                <option value="de">German (Deutsch)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-main">Web Search</label>
                            <button
                                onClick={() => setUseSearch(!useSearch)}
                                className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${useSearch
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-surface border-surface text-muted'
                                    }`}
                                title="Enable Google Search for sources"
                            >
                                <Search size={18} />
                                <span className="text-sm font-medium">{useSearch ? 'Enabled' : 'Disabled'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="w-full py-3 rounded-lg font-medium hover:bg-[var(--color-primary-active)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                    <span>Generating Draft...</span>
                                </>
                            ) : (
                                <>
                                    <Wand2 size={18} />
                                    <span>Generate Full Post</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
