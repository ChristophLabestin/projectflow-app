import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Wand2 } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';
import { generateBlogPostAI } from '../../../../services/geminiService';
import { useToast } from '../../../../context/UIContext';

interface BlogAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (data: { title: string; excerpt: string; content: string }) => void;
}

export const BlogAIModal: React.FC<BlogAIModalProps> = ({ isOpen, onClose, onGenerate }) => {
    const { language, t } = useLanguage();
    const { showError } = useToast();

    // Local state for the form
    const [prompt, setPrompt] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState(language);
    const [isGenerating, setIsGenerating] = useState(false);

    // Sync selected language with app language when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedLanguage(language);
            setPrompt('');
        }
    }, [isOpen, language]);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        try {
            const result = await generateBlogPostAI(prompt, selectedLanguage);
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
                className="relative bg-[var(--color-surface-card)] w-full max-w-lg rounded-xl shadow-2xl border border-[var(--color-surface-border)] overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 border-b border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-bg)]">
                    <div className="flex items-center gap-2 text-[var(--color-primary)]">
                        <Sparkles size={20} className="fill-current" />
                        <h3 className="font-semibold text-lg">AI Blog Assistant</h3>
                    </div>
                    <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--color-text-main)]">What should the blog post be about?</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="E.g. The future of remote work in 2025 and why async communication is key..."
                            className="w-full h-32 p-3 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--color-text-main)]">Language</label>
                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'de')}
                            className="w-full p-2.5 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] appearance-none"
                        >
                            <option value="en">English (English)</option>
                            <option value="de">German (Deutsch)</option>
                        </select>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="w-full py-3 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-active)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
