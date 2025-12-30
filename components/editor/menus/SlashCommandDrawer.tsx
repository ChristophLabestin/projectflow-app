import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { X, Search, Grid, Star, Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SlashCommandDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    editor: Editor;
    commands: any[];
}

export const SlashCommandDrawer: React.FC<SlashCommandDrawerProps> = ({ isOpen, onClose, editor, commands }) => {
    const [filter, setFilter] = useState<'all' | 'general' | 'custom'>('all');
    const [search, setSearch] = useState('');

    const filteredCommands = commands.filter(cmd => {
        const matchesCategory = filter === 'all' || cmd.category === filter;
        const matchesSearch = cmd.title.toLowerCase().includes(search.toLowerCase()) ||
            (cmd.searchTerms && cmd.searchTerms.some((t: string) => t.includes(search.toLowerCase())));
        return matchesCategory && matchesSearch;
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[100000] bg-black/20 backdrop-blur-sm" onClick={onClose} />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed top-0 right-0 bottom-0 w-80 bg-[var(--color-surface-card)] border-l border-[var(--color-surface-border)] shadow-2xl z-[100001] flex flex-col"
                    >
                        <div className="p-4 border-b border-[var(--color-surface-border)] flex items-center justify-between">
                            <h3 className="font-semibold text-[var(--color-text-main)]">Commands</h3>
                            <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface-hover)] rounded-full text-[var(--color-text-muted)]">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search & Filter */}
                        <div className="p-4 border-b border-[var(--color-surface-border)] space-y-3">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                                <input
                                    type="text"
                                    placeholder="Search commands..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-primary)] text-[var(--color-text-main)]"
                                />
                            </div>

                            <div className="flex p-1 bg-[var(--color-surface-bg)] rounded-lg">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-[var(--color-surface-card)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilter('general')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === 'general' ? 'bg-[var(--color-surface-card)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    General
                                </button>
                                <button
                                    onClick={() => setFilter('custom')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === 'custom' ? 'bg-[var(--color-surface-card)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    Custom
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {filteredCommands.map((cmd, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        cmd.command({ editor, range: null });
                                        onClose();
                                    }}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-hover)] text-left group transition-colors"
                                >
                                    <div className={`p-2 rounded-md ${cmd.category === 'custom' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20' : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]'}`}>
                                        <span className="material-symbols-outlined text-[20px]">{cmd.icon}</span>
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm text-[var(--color-text-main)]">{cmd.title}</div>
                                        <div className="text-xs text-[var(--color-text-muted)]">{cmd.description}</div>
                                    </div>
                                </button>
                            ))}
                            {filteredCommands.length === 0 && (
                                <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
                                    No commands found.
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
