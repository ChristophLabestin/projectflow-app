import React, { useState } from 'react';
import { EmailBlock } from '../../../types';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

type LayerTreeProps = {
    blocks: EmailBlock[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    depth?: number;
};

const getBlockIcon = (type: string) => {
    switch (type) {
        case 'text': return 'title';
        case 'image': return 'image';
        case 'button': return 'smart_button';
        case 'columns': return 'view_column';
        case 'divider': return 'horizontal_rule';
        case 'header': return 'format_h1';
        case 'html': return 'code';
        case 'list': return 'format_list_bulleted';
        case 'menu': return 'menu';
        case 'quote': return 'format_quote';
        case 'social': return 'share';
        case 'spacer': return 'space_bar';
        case 'video': return 'play_circle';
        case 'flex': return 'view_quilt';
        default: return 'widgets';
    }
};

const ColumnDroppable = ({ id, children, label, onSelect, isSelected }: { id: string, children: React.ReactNode, label: string, onSelect: () => void, isSelected: boolean }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className={`flex flex-col ml-1 ${isOver ? 'bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/50' : ''}`}>
            <div
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                className={`flex items-center gap-1.5 py-1.5 px-2 text-[10px] uppercase font-bold select-none cursor-pointer transition-colors border-l-2
                    ${isSelected
                        ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'
                    }`}
            >
                <div className="w-4 flex justify-center"><span className="material-symbols-outlined text-[14px] opacity-70">splitscreen_left</span></div>
                {label}
            </div>
            {children}
            {React.Children.count(children) === 0 && (
                <div className="pl-6 py-1 text-[10px] italic text-zinc-300">Empty</div>
            )}
        </div>
    )
};

const FlexDroppable = ({ id, children }: { id: string, children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className={`flex flex-col ml-1 ${isOver ? 'bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/50' : ''}`}>
            {children}
            {React.Children.count(children) === 0 && (
                <div className="pl-6 py-1 text-[10px] italic text-zinc-300">Empty Container</div>
            )}
        </div>
    )
}

const LayerNode: React.FC<{ block: EmailBlock; selectedId: string | null; onSelect: (id: string) => void; depth: number }> = ({ block, selectedId, onSelect, depth }) => {
    const isSelected = selectedId === block.id;
    const [isExpanded, setIsExpanded] = useState(true);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: `layer-${block.id}` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        paddingLeft: `${(depth * 8) + 4}px`
    };

    // Structural blocks should always have "children" capability (drop zones) even if empty
    const isStructural = block.type === 'columns' || block.type === 'flex' || block.type === 'div';
    const hasChildrenContent = (block.type === 'columns' && block.content.columns?.some(col => col.length > 0)) ||
        ((block.type === 'flex' || block.type === 'div') && block.content.children && block.content.children.length > 0);

    // Always show expand toggle if it's structural (to show drop zones) OR if it has actual children
    const showExpandToggle = isStructural || hasChildrenContent;

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="flex flex-col">
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`flex items-center gap-1.5 py-1.5 px-2 cursor-pointer text-xs font-medium transition-colors border-l-2 select-none group
                    ${isSelected ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'}
                `}
                onClick={() => onSelect(block.id)}
            >
                <div
                    className="flex items-center justify-center w-4 h-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 rounded cursor-pointer"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={showExpandToggle ? toggleExpand : undefined}
                >
                    {showExpandToggle && (
                        <span className="material-symbols-outlined text-[14px] transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                            chevron_right
                        </span>
                    )}
                </div>

                <span className="material-symbols-outlined text-[16px] opacity-70">{getBlockIcon(block.type)}</span>
                <span className="truncate">{block.type.charAt(0).toUpperCase() + block.type.slice(1)}</span>
            </div>

            {isExpanded && showExpandToggle && (
                <div className={`flex flex-col border-l border-zinc-100 dark:border-zinc-800 ${block.type === 'columns' ? 'ml-6' : 'ml-2'}`}>
                    {block.type === 'columns' && block.content.columns?.map((col, idx) => (
                        <ColumnDroppable
                            key={`${block.id}-col-${idx}`}
                            id={`layer-${block.id}-col-${idx}`}
                            label={`Col ${idx + 1}`}
                            onSelect={() => onSelect(`${block.id}::col::${idx}`)}
                            isSelected={selectedId === `${block.id}::col::${idx}`}
                        >
                            <SortableContext items={col.map(c => `layer-${c.id}`)} strategy={verticalListSortingStrategy}>
                                {col.map(child => (
                                    <LayerNode key={child.id} block={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
                                ))}
                            </SortableContext>
                        </ColumnDroppable>
                    ))}

                    {(block.type === 'flex' || block.type === 'div') && (
                        <FlexDroppable id={`layer-${block.id}-${block.type}`}>
                            <SortableContext items={block.content.children?.map(c => `layer-${c.id}`) || []} strategy={verticalListSortingStrategy}>
                                {block.content.children?.map(child => (
                                    <LayerNode key={child.id} block={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
                                ))}
                            </SortableContext>
                        </FlexDroppable>
                    )}
                </div>
            )}
        </div>
    );
};

export const LayerTree: React.FC<LayerTreeProps> = ({ blocks, selectedId, onSelect, onDelete }) => {
    // Check if selection is a sub-element (e.g. column) which cannot be deleted directly via this ID
    const isSubSelection = selectedId?.includes('::');
    const canDelete = selectedId && !isSubSelection;

    return (
        <div className="flex flex-col pb-4">
            {/* Toolbar */}
            <div className="px-4 py-2 flex items-center gap-1 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex-1">Layers</div>
                <button
                    onClick={() => canDelete && onDelete(selectedId!)}
                    disabled={!canDelete}
                    className={`p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${!canDelete ? 'opacity-30 cursor-not-allowed' : 'text-red-500 cursor-pointer pointer-events-auto'}`}
                    title="Delete Selected"
                >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
            </div>

            <SortableContext items={blocks.map(b => `layer-${b.id}`)} strategy={verticalListSortingStrategy}>
                {blocks.map(block => (
                    <LayerNode key={block.id} block={block} selectedId={selectedId} onSelect={onSelect} depth={0} />
                ))}
            </SortableContext>
            {blocks.length === 0 && (
                <div className="p-4 text-center text-xs text-zinc-400 italic">
                    No blocks added yet. Start by dragging from the Blocks tab.
                </div>
            )}
        </div>
    );
};
