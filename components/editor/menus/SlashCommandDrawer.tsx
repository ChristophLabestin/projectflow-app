import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { X, Search, Grid, Star, Layout, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../../../context/UIContext';
import { useConfirm } from '../../../context/UIContext';

interface SlashCommandDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    editor: Editor;
    commands: any[];
}

export const SlashCommandDrawer: React.FC<SlashCommandDrawerProps> = ({ isOpen, onClose, editor, commands }) => {
    const [filter, setFilter] = useState<'all' | 'general' | 'custom'>('all');
    const [search, setSearch] = useState('');
    const { showSuccess } = useUI();
    const confirm = useConfirm();

    const handleDeletePreset = async (e: React.MouseEvent, title: string) => {
        e.stopPropagation();
        if (await confirm('Delete Preset', `Are you sure you want to delete "${title}"?`)) {
            const stored = localStorage.getItem('card_presets');
            if (stored) {
                const presets = JSON.parse(stored);
                // Filter out by title
                const updated = presets.filter((p: any) => p.title !== title);
                localStorage.setItem('card_presets', JSON.stringify(updated));
                window.dispatchEvent(new Event('storage'));
                showSuccess(`Deleted preset "${title}"`);
            }
        }
    };

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
                        className="fixed top-0 right-0 bottom-0 w-80 bg-card border-l border-surface shadow-2xl z-[100001] flex flex-col"
                    >
                        <div className="p-4 border-b border-surface flex items-center justify-between">
                            <h3 className="font-semibold text-main">Commands</h3>
                            <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-full text-muted">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search & Filter */}
                        <div className="p-4 border-b border-surface space-y-3">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-2.5 text-muted" />
                                <input
                                    type="text"
                                    placeholder="Search commands..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-surface text-sm focus:outline-none focus:border-primary text-main"
                                />
                            </div>

                            <div className="flex p-1 bg-surface rounded-lg">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-card shadow-sm text-primary' : 'text-muted hover:text-main'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilter('general')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === 'general' ? 'bg-card shadow-sm text-primary' : 'text-muted hover:text-main'}`}
                                >
                                    General
                                </button>
                                <button
                                    onClick={() => setFilter('custom')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === 'custom' ? 'bg-card shadow-sm text-primary' : 'text-muted hover:text-main'}`}
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
                                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover text-left group transition-colors"
                                >
                                    <div className={`p-2 rounded-md ${cmd.category === 'custom' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20' : 'bg-surface text-muted group-hover:text-primary'}`}>
                                        <span className="material-symbols-outlined text-[20px]">{cmd.icon}</span>
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm text-main">{cmd.title}</div>
                                        <div className="text-xs text-muted">{cmd.description}</div>
                                    </div>
                                    {cmd.category === 'custom' && (
                                        <button
                                            onClick={(e) => handleDeletePreset(e, cmd.title)}
                                            className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                            title="Delete Preset"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </button>
                            ))}
                            {filteredCommands.length === 0 && (
                                <div className="text-center py-8 text-muted text-sm">
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
