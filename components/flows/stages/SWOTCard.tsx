import React, { useState } from 'react';
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
    const tone = {
        emerald: 'success',
        rose: 'danger',
        indigo: 'primary',
        amber: 'warning',
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
        <div className="swot-card" data-tone={tone}>
            <div className="swot-card__header">
                <div className="swot-card__title">
                    <span className="material-symbols-outlined">{icon}</span>
                    {title}
                </div>
                <div className="swot-card__count">{items.length}</div>
            </div>

            <div className="swot-card__body">
                <div className="swot-card__input">
                    <span className="material-symbols-outlined swot-card__input-icon">add</span>
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                        className="swot-card__input-field"
                        placeholder={t('flowStages.refinement.swot.addPlaceholder')}
                    />
                </div>

                {items.map((item, index) => {
                    const isHighlighted = highlightedItems.includes(item);
                    return (
                        <div
                            key={index}
                            className={`swot-card__item ${isHighlighted ? 'is-highlighted' : ''}`}
                        >
                            {isHighlighted && (
                                <span className="swot-card__ai-badge">
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
                                    className="swot-card__edit-input"
                                />
                            ) : (
                                <span
                                    onClick={() => startEditing(index, item)}
                                    className="swot-card__text"
                                >
                                    {item}
                                </span>
                            )}

                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDelete(index); }}
                                className="swot-card__delete"
                                aria-label={t('common.delete')}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
