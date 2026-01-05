import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import { useLanguage } from '../../../context/LanguageContext';

interface SWOTCardProps {
    title: string;
    icon: string;
    items: string[];
    colorClass: 'emerald' | 'rose' | 'indigo' | 'amber';
    onAdd: (text: string) => void;
    onEdit: (index: number, text: string) => void;
    onDelete: (index: number) => void;
    highlightedItems?: string[];
}

export const SWOTCard: React.FC<SWOTCardProps> = ({ title, icon, items, colorClass, onAdd, onEdit, onDelete, highlightedItems = [] }) => {
    const { t } = useLanguage();
    const [newItem, setNewItem] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    const colors = {
        emerald: {
            border: 'border-emerald-200 dark:border-emerald-800',
            bg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
            headerBg: 'bg-emerald-100/50 dark:bg-emerald-900/20',
            headerBorder: 'border-emerald-100 dark:border-emerald-900/50',
            text: 'text-emerald-800 dark:text-emerald-300',
            inputPlaceholder: 'placeholder-emerald-400/60',
            itemBorder: 'border-emerald-500',
            icon: 'text-emerald-600 dark:text-emerald-400'
        },
        rose: {
            border: 'border-rose-200 dark:border-rose-800',
            bg: 'bg-rose-50/50 dark:bg-rose-900/10',
            headerBg: 'bg-rose-100/50 dark:bg-rose-900/20',
            headerBorder: 'border-rose-100 dark:border-rose-900/50',
            text: 'text-rose-800 dark:text-rose-300',
            inputPlaceholder: 'placeholder-rose-400/60',
            itemBorder: 'border-rose-500',
            icon: 'text-rose-600 dark:text-rose-400'
        },
        indigo: {
            border: 'border-indigo-200 dark:border-indigo-800',
            bg: 'bg-indigo-50/50 dark:bg-indigo-900/10',
            headerBg: 'bg-indigo-100/50 dark:bg-indigo-900/20',
            headerBorder: 'border-indigo-100 dark:border-indigo-900/50',
            text: 'text-indigo-800 dark:text-indigo-300',
            inputPlaceholder: 'placeholder-indigo-400/60',
            itemBorder: 'border-indigo-500',
            icon: 'text-indigo-600 dark:text-indigo-400'
        },
        amber: {
            border: 'border-amber-200 dark:border-amber-800',
            bg: 'bg-amber-50/50 dark:bg-amber-900/10',
            headerBg: 'bg-amber-100/50 dark:bg-amber-900/20',
            headerBorder: 'border-amber-100 dark:border-amber-900/50',
            text: 'text-amber-800 dark:text-amber-300',
            inputPlaceholder: 'placeholder-amber-400/60',
            itemBorder: 'border-amber-500',
            icon: 'text-amber-600 dark:text-amber-400'
        }
    }[colorClass];

    const handleAddItem = () => {
        if (newItem.trim()) {
            onAdd(newItem.trim());
            setNewItem('');
        }
    };

    const startEditing = (index: number, val: string) => {
        setEditingIndex(index);
        setEditValue(val);
    };

    const saveEdit = () => {
        if (editingIndex !== null) {
            if (editValue.trim()) {
                onEdit(editingIndex, editValue.trim());
            } else {
                onDelete(editingIndex);
            }
            setEditingIndex(null);
        }
    };

    return (
        <div className={`flex flex-col rounded-xl border ${colors.border} ${colors.bg} h-full min-h-[220px] transition-all hover:shadow-sm`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b ${colors.headerBorder} ${colors.headerBg} flex items-center justify-between`}>
                <div className={`font-bold ${colors.text} flex items-center gap-2`}>
                    <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    {title}
                </div>
                <div className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 ${colors.text}`}>
                    {items.length}
                </div>
            </div>

            {/* Content List */}
            <div className="p-3 space-y-1 flex-1 overflow-y-auto max-h-[300px]">
                {/* Add New Input */}
                <div className="flex items-center gap-2 p-2 mb-1 rounded-lg border border-transparent focus-within:bg-white/40 dark:focus-within:bg-black/10 focus-within:border-surface transition-all">
                    <span className={`material-symbols-outlined text-[18px] ${colors.icon} opacity-60`}>add</span>
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                        className={`flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm ${colors.inputPlaceholder} text-main w-full`}
                        placeholder={t('flowStages.refinement.swot.addPlaceholder')}
                    />
                </div>

                {items.map((item, index) => {
                    const isHighlighted = highlightedItems.includes(item);
                    return (
                        <div
                            key={index}
                            className={`group flex items-start gap-2 p-2 rounded-lg transition-all cursor-text relative ${isHighlighted
                                ? 'bg-indigo-50/50 dark:bg-indigo-900/20 ring-1 ring-indigo-500/30'
                                : 'hover:bg-white/60 dark:hover:bg-black/20'
                                }`}
                        >
                            {/* AI Indicator */}
                            {isHighlighted && (
                                <span className="absolute -left-1 -top-1 bg-indigo-500 text-white text-[8px] px-1 rounded-full shadow-sm z-10 font-bold scale-75 animate-bounce-short">
                                    {t('flowStages.refinement.swot.aiBadge')}
                                </span>
                            )}

                            {editingIndex === index ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={saveEdit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEdit();
                                        if (e.key === 'Escape') setEditingIndex(null);
                                    }}
                                    className={`flex-1 bg-transparent p-0 text-sm ${colors.text} border-0 border-b ${colors.itemBorder} focus:ring-0`}
                                />
                            ) : (
                                <span
                                    onClick={() => startEditing(index, item)}
                                    className={`flex-1 text-sm ${colors.text} leading-relaxed ${isHighlighted ? 'font-medium' : ''}`}
                                >
                                    {item}
                                </span>
                            )}

                            {/* Actions */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(index); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shrink-0"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
