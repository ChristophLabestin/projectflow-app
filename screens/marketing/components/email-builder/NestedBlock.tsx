import React from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { EmailBlock } from '../../../types';
import { BlockRenderer } from './BlockRenderer';

export type NestedBlockProps = {
    block: EmailBlock;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: () => void;
    depth?: number;
};

const DroppableColumn = ({ id, children, span = 1, isOverContainer }: { id: string, children: React.ReactNode, span?: number, isOverContainer?: boolean }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col gap-0 min-h-[60px] border border-dashed transition-all duration-300 ${isOver
                ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-900/20'
                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
            style={{ gridColumn: `span ${span}` }}
        >
            {children}
            {!React.Children.count(children) && (
                <div className="flex-1 flex flex-col items-center justify-center text-[10px] font-bold uppercase tracking-widest text-zinc-300 pointer-events-none gap-1 py-4">
                    <span className="material-symbols-outlined text-lg">add_circle</span>
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
            className={`min-h-[60px] transition-all duration-300 ${isOver ? 'bg-[var(--color-primary)]/5 ring-2 ring-[var(--color-primary)] ring-inset' : ''}`}
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
                <div className="w-full flex-1 flex items-center justify-center p-4 border border-dashed border-zinc-200 dark:border-zinc-700 rounded text-[10px] font-bold uppercase tracking-widest text-zinc-400 pointer-events-none">
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
            className={`min-h-[40px] transition-all duration-300 ${isOver ? 'bg-[var(--color-primary)]/5 ring-2 ring-[var(--color-primary)] ring-inset' : ''} ${!React.Children.count(children) ? 'border border-dashed border-zinc-200 dark:border-zinc-700' : ''}`}
            style={{
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
                <div className="flex-1 flex flex-col items-center justify-center text-[10px] font-bold uppercase tracking-widest text-zinc-300 pointer-events-none gap-1 py-4">
                    <span className="material-symbols-outlined text-lg opacity-50">check_box_outline_blank</span>
                    Div Container
                </div>
            )}
        </div>
    );
};


export const NestedBlock: React.FC<NestedBlockProps> = ({ block, selectedId, onSelect, onDelete, onDuplicate, depth = 0 }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
    const isSelected = selectedId === block.id;

    const style = {
        transform: CSS.Transform.toString(transform), // We don't need 'Translate' for sortable list items usually, Transform is safer
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 50 : (isSelected ? 10 : 1),
        width: block.styles.width || (['columns', 'flex', 'divider', 'div'].includes(block.type) ? '100%' : undefined), // Default structural blocks to 100%
        height: block.styles.height || 'auto',
    };

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
                            />
                        ))}
                    </SortableContext>
                </DroppableDiv>
            );
        }
        return <BlockRenderer block={block} />;
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group/block h-full">
            {/* Hover Actions Bar */}
            <div
                className={`absolute h-7 flex items-center gap-1 rounded-t-lg px-2 shadow-sm transform transition-all duration-200 origin-bottom-left 
                bg-[var(--color-primary)] text-white dark:bg-blue-600 dark:text-white
                ${isSelected || isDragging ? 'opacity-100 scale-100 z-[100]' : 'opacity-0 scale-90 group-hover/block:opacity-100 group-hover/block:scale-100 z-50'
                    }`}
                style={{
                    top: `-${28}px`, // Fixed offset, no stacking based on depth to avoid runaway values
                    left: 0,
                    zIndex: 100 + depth
                }}
            >
                {/* Drag Handle */}
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex items-center pr-2 border-r border-white/20 mr-1 py-1 hover:bg-white/10 rounded">
                    <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider ml-1">{block.type}</span>
                </div>

                {/* Duplicate */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                    className="p-0.5 hover:bg-white/20 rounded transition-colors"
                    title="Duplicate"
                >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                </button>

                {/* Delete */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}
                    className="p-0.5 hover:bg-white/20 rounded transition-colors text-white/90 hover:text-red-100"
                    title="Delete"
                >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
            </div>

            <div
                onClick={(e) => { e.stopPropagation(); onSelect(block.id); }}
                className={`transition-all duration-200 cursor-pointer h-full ${isSelected
                    ? 'outline outline-2 outline-[var(--color-primary)] outline-offset-0'
                    : 'hover:outline hover:outline-1 hover:outline-[var(--color-primary)]/40 dark:hover:outline-[var(--color-primary)]/60'
                    }`}
            >
                {renderContent()}
            </div>
        </div>
    );
};
