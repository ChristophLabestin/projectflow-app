import React, { useState, createContext, useContext } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { EmailBlock } from '../../../types';
import { BlockRenderer } from './BlockRenderer';

// Context to track which block is currently being hovered
const HoverContext = createContext<{
    hoveredId: string | null;
    setHoveredId: (id: string | null) => void;
}>({ hoveredId: null, setHoveredId: () => { } });

// Provider component to wrap the canvas
export const HoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    return (
        <HoverContext.Provider value={{ hoveredId, setHoveredId }}>
            {children}
        </HoverContext.Provider>
    );
};

export type NestedBlockProps = {
    block: EmailBlock;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: () => void;
    depth?: number;
    variables?: any[];
};

const DroppableColumn = ({ id, children, span = 1 }: { id: string, children: React.ReactNode, span?: number }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col gap-0 border border-dashed transition-all duration-150 ${isOver
                ? 'border-[var(--color-primary)] bg-blue-50/50 dark:bg-blue-900/20'
                : 'border-zinc-200/60 dark:border-zinc-700/60'
                }`}
            style={{ gridColumn: `span ${span}` }}
        >
            {children}
            {!React.Children.count(children) && (
                <div className="flex-1 flex flex-col items-center justify-center text-[9px] font-bold uppercase tracking-widest text-zinc-300 dark:text-zinc-600 pointer-events-none gap-1 py-6">
                    <span className="material-symbols-outlined text-base opacity-60">add_circle</span>
                    Drop here
                </div>
            )}
        </div>
    );
};

const DroppableFlex = ({ id, block, children }: { id: string, block: EmailBlock, children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    const { styles } = block;

    return (
        <div
            ref={setNodeRef}
            className={`transition-all duration-150 ${isOver ? 'bg-[var(--color-primary)]/5 ring-2 ring-[var(--color-primary)]/50 ring-inset' : ''}`}
            style={{
                display: 'flex',
                flexDirection: styles.flexDirection || 'row',
                flexWrap: styles.flexWrap || 'wrap',
                justifyContent: styles.justifyContent || 'flex-start',
                alignItems: styles.alignItems || 'stretch',
                gap: `${styles.gap ?? 10}px`,
                paddingTop: styles.paddingTop,
                paddingBottom: styles.paddingBottom,
                paddingLeft: styles.paddingLeft,
                paddingRight: styles.paddingRight,
                backgroundColor: styles.backgroundColor,
                width: styles.width || '100%'
            }}
        >
            {children}
            {!React.Children.count(children) && (
                <div className="w-full flex-1 flex items-center justify-center p-6 border border-dashed border-zinc-200/60 dark:border-zinc-700/60 rounded text-[9px] font-bold uppercase tracking-widest text-zinc-300 dark:text-zinc-600 pointer-events-none">
                    <span className="material-symbols-outlined text-base mr-1.5 opacity-60">view_quilt</span>
                    Flex Container
                </div>
            )}
        </div>
    );
};

const DroppableDiv = ({ id, block, children }: { id: string, block: EmailBlock, children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    const { styles } = block;

    return (
        <div
            ref={setNodeRef}
            className={`transition-all duration-150 ${isOver ? 'bg-[var(--color-primary)]/5 ring-2 ring-[var(--color-primary)]/50 ring-inset' : ''} ${!React.Children.count(children) ? 'border border-dashed border-zinc-200/60 dark:border-zinc-700/60' : ''}`}
            style={{
                display: 'flex',
                flexDirection: styles.flexDirection || 'column',
                justifyContent: styles.justifyContent || 'flex-start',
                alignItems: styles.alignItems || 'stretch',
                gap: `${styles.gap ?? 0}px`,
                paddingTop: styles.paddingTop,
                paddingBottom: styles.paddingBottom,
                paddingLeft: styles.paddingLeft,
                paddingRight: styles.paddingRight,
                backgroundColor: styles.backgroundColor,
                width: styles.width || '100%',
                height: styles.height || 'auto'
            }}
        >
            {children}
            {!React.Children.count(children) && (
                <div className="flex-1 flex flex-col items-center justify-center text-[9px] font-bold uppercase tracking-widest text-zinc-300 dark:text-zinc-600 pointer-events-none gap-1 py-6">
                    <span className="material-symbols-outlined text-base opacity-60">check_box_outline_blank</span>
                    Div Container
                </div>
            )}
        </div>
    );
};

// Helper to check if a block contains a descendant with a given ID
const hasDescendant = (block: EmailBlock, targetId: string): boolean => {
    if (block.id === targetId) return true;

    // Check columns
    if (block.content.columns) {
        for (const col of block.content.columns) {
            for (const child of col) {
                if (hasDescendant(child, targetId)) return true;
            }
        }
    }

    // Check children (flex/div)
    if (block.content.children) {
        for (const child of block.content.children) {
            if (hasDescendant(child, targetId)) return true;
        }
    }

    return false;
};

export const NestedBlock: React.FC<NestedBlockProps> = ({ block, selectedId, onSelect, onDelete, onDuplicate, depth = 0, variables }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
    const isSelected = selectedId === block.id;
    const { hoveredId, setHoveredId } = useContext(HoverContext);

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : 'auto',
        width: block.styles.width || (['columns', 'flex', 'divider', 'div'].includes(block.type) ? '100%' : undefined),
        height: block.styles.height || 'auto',
    };

    // Handle mouse events - update global hover context
    const handleMouseEnter = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHoveredId(block.id);
    };

    const handleMouseLeave = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Only clear if we're the currently hovered element
        if (hoveredId === block.id) {
            setHoveredId(null);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(block.id);
    };

    // Determine if this block is directly hovered (not a descendant)
    const isDirectlyHovered = hoveredId === block.id;

    // Check if a descendant is being hovered (if so, hide our action bar)
    const descendantIsHovered = hoveredId !== null && hoveredId !== block.id && hasDescendant(block, hoveredId);

    // Show action bar only if: directly hovered, selected, or dragging - AND no descendant is hovered
    const showActionBar = (isDirectlyHovered || isSelected || isDragging) && !descendantIsHovered;
    const showHoverOutline = isDirectlyHovered && !isSelected && !descendantIsHovered;
    const showSelectedOutline = isSelected;

    const renderContent = () => {
        if (block.type === 'columns') {
            const columns = block.content.columns || [[], []];
            const gapValue = block.styles.gap ?? 0;
            return (
                <div
                    className="w-full flex-grow basis-full"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, 1fr)',
                        columnGap: `${gapValue}px`,
                        rowGap: `${gapValue}px`,
                        justifyContent: block.styles.justifyContent || 'flex-start',
                        alignItems: block.styles.alignItems || 'stretch',
                        paddingTop: block.styles.paddingTop,
                        paddingBottom: block.styles.paddingBottom,
                        paddingLeft: block.styles.paddingLeft,
                        paddingRight: block.styles.paddingRight,
                        backgroundColor: block.styles.backgroundColor,
                        width: block.styles.width || '100%',
                        height: block.styles.height || 'auto',
                        minHeight: '100%'
                    }}
                >
                    {columns.map((colBlocks, idx) => {
                        const defaultSpan = 12 / columns.length;
                        const colSpan = colBlocks.reduce((acc, b) => Math.max(acc, b.styles.gridSpan || defaultSpan), defaultSpan);
                        return (
                            <DroppableColumn key={idx} id={`${block.id}-col-${idx}`} span={colSpan}>
                                <SortableContext items={colBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                    {colBlocks.map(child => (
                                        <NestedBlock
                                            key={child.id}
                                            block={child}
                                            selectedId={selectedId}
                                            onSelect={onSelect}
                                            onDelete={onDelete}
                                            onDuplicate={onDuplicate}
                                            depth={depth + 1}
                                            variables={variables}
                                        />
                                    ))}
                                </SortableContext>
                            </DroppableColumn>
                        );
                    })}
                </div>
            );
        }
        if (block.type === 'flex') {
            const children = block.content.children || [];
            return (
                <DroppableFlex id={`${block.id}-flex`} block={block}>
                    <SortableContext items={children.map(b => b.id)} strategy={rectSortingStrategy}>
                        {children.map(child => (
                            <NestedBlock
                                key={child.id}
                                block={child}
                                selectedId={selectedId}
                                onSelect={onSelect}
                                onDelete={onDelete}
                                onDuplicate={onDuplicate}
                                depth={depth + 1}
                                variables={variables}
                            />
                        ))}
                    </SortableContext>
                </DroppableFlex>
            );
        }
        if (block.type === 'div') {
            const children = block.content.children || [];
            return (
                <DroppableDiv id={`${block.id}-div`} block={block}>
                    <SortableContext items={children.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        {children.map(child => (
                            <NestedBlock
                                key={child.id}
                                block={child}
                                selectedId={selectedId}
                                onSelect={onSelect}
                                onDelete={onDelete}
                                onDuplicate={onDuplicate}
                                depth={depth + 1}
                                variables={variables}
                            />
                        ))}
                    </SortableContext>
                </DroppableDiv>
            );
        }
        return <BlockRenderer block={block} variables={variables} />;
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative h-full"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Floating Action Bar - Only shows on direct hover or selection, hidden when descendant is hovered */}
            <div
                className={`absolute h-7 flex items-center gap-0.5 rounded-md px-1.5 shadow-lg transform transition-all duration-150 pointer-events-auto
                ${isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-white'
                    }
                ${showActionBar ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                style={{
                    top: -30,
                    left: 0,
                    zIndex: 1000
                }}
                onMouseEnter={(e) => e.stopPropagation()}
            >
                {/* Drag Handle - Click to select, drag to move */}
                <div
                    {...attributes}
                    {...listeners}
                    onClick={(e) => { e.stopPropagation(); onSelect(block.id); }}
                    className="cursor-grab active:cursor-grabbing flex items-center px-1.5 py-1 hover:bg-white/10 rounded transition-colors"
                >
                    <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider ml-1">{block.name || block.type}</span>
                </div>

                <div className="w-px h-4 bg-white/20 mx-0.5" />

                {/* Duplicate */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Duplicate"
                >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                </button>

                {/* Delete */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}
                    className="p-1 hover:bg-red-500/80 rounded transition-colors"
                    title="Delete"
                >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
            </div>

            {/* Content Wrapper with Outline States */}
            <div
                onClick={handleClick}
                className={`transition-all duration-150 cursor-pointer h-full rounded-sm ${showSelectedOutline
                    ? 'outline outline-2 outline-offset-1 outline-blue-600'
                    : showHoverOutline
                        ? 'outline outline-1 outline-zinc-400/60'
                        : ''
                    }`}
            >
                {renderContent()}
            </div>
        </div>
    );
};

