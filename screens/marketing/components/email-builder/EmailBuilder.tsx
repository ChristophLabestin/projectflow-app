import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    DragOverEvent,
    closestCorners,
    rectIntersection,
    useDraggable,
    useDroppable
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { EmailBlock, EmailBlockType, EmailComponent, TemplateVariable, EmailTemplate } from '../../../types';
import { saveEmailComponent, getEmailComponents, deleteEmailComponent } from '../../../../services/dataService';
import { useToast, useConfirm } from '../../../../context/UIContext';
import { format } from 'date-fns';
import { dateLocale } from '../../../../utils/activityHelpers';

// Imported Components
import { BlockRenderer } from './BlockRenderer';
import { PropertiesPanel } from './PropertiesPanel';
import { NestedBlock, HoverProvider } from './NestedBlock';
import { LayerTree } from './LayerTree';
import { GlobalSettingsPanel } from './GlobalSettingsPanel';
import { createBlock, deepCloneBlock, findContainer, useHistory, insertBlockAfter } from './emailBuilderUtils';
import { VariableManager } from './VariableManager';

interface GlobalSettings {
    canvasWidth: number;
    backgroundColor: string;
    fontFamily: string;
    primaryColor: string;
}

const defaultGlobalSettings: GlobalSettings = {
    canvasWidth: 640,
    backgroundColor: '#ffffff',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    primaryColor: '#3b82f6',
};

interface EmailBuilderProps {
    initialBlocks?: EmailBlock[];
    initialVariables?: TemplateVariable[];
    onSave: (blocks: EmailBlock[], variables: TemplateVariable[], name?: string) => void;
    onSaveDraft?: (blocks: EmailBlock[], variables: TemplateVariable[], name?: string) => void;
    onFetchDrafts?: () => Promise<EmailTemplate[]>;
    onCancel: () => void;
    saving?: boolean;
    projectId: string; // Required for saved components
    initialName?: string;
    initialName?: string;
    readOnly?: boolean;
    tenantId?: string;
}

// --- Local Components ---

const getBlockIcon = (type: string) => {
    switch (type) {
        case 'text': return 'title';
        case 'richtext': return 'article';
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
        case 'solid': return 'rectangle';
        case 'div': return 'check_box_outline_blank';
        default: return 'widgets';
    }
};

const LayerDragPreview = ({ block }: { block: EmailBlock }) => {
    return (
        <div className="flex items-center gap-1.5 py-1.5 px-3 bg-white dark:bg-zinc-800 rounded shadow-lg border border-[var(--color-primary)] opacity-90 w-48">
            <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">{getBlockIcon(block.type)}</span>
            <span className="text-xs font-medium truncate">{block.type.charAt(0).toUpperCase() + block.type.slice(1)}</span>
        </div>
    );
};

const BlockCategory = ({ title, children }: any) => (
    <div className="space-y-3 w-full">
        <div className="flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-[var(--color-surface-border)] opacity-50" />
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap">
                {title}
            </h4>
            <div className="h-px flex-1 bg-[var(--color-surface-border)] opacity-50" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 w-full">
            {children}
        </div>
    </div>
);

const ToolButton = ({ icon, label, onClick }: any) => (
    <button
        onClick={onClick}
        className="w-full flex flex-col items-center justify-center p-3.5 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] transition-all duration-200 gap-2 group text-[var(--color-text-subtle)] hover:shadow-md hover:-translate-y-0.5"
    >
        <div className="size-9 flex items-center justify-center rounded-lg bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] group-hover:border-[var(--color-primary)]/30 group-hover:bg-white/50 dark:group-hover:bg-black/20 transition-colors">
            <span className="material-symbols-outlined text-[22px] text-[var(--color-text-muted)] group-hover:text-inherit">
                {icon}
            </span>
        </div>
        <span className="text-[11px] font-semibold tracking-tight">{label}</span>
    </button>
);

const DraggableSidebarItem = ({ type, icon, label, onClick, savedBlock }: { type: EmailBlockType, icon: string, label: string, onClick: () => void, savedBlock?: EmailBlock }) => {
    const { attributes, listeners, setNodeRef } = useDraggable({
        id: `sidebar-${type}-${savedBlock ? savedBlock.id : 'new'}`,
        data: {
            isSidebar: true,
            type,
            savedBlock // Pass full block data if it's a saved component
        }
    });

    return (
        <div ref={setNodeRef} {...listeners} {...attributes} className="touch-none">
            <ToolButton icon={icon} label={label} onClick={onClick} />
        </div>
    );
};

const DroppableCanvas = ({ id, children, viewMode, canvasWidth = 640 }: { id: string, children: React.ReactNode, viewMode: string, canvasWidth?: number }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    const width = viewMode === 'mobile' ? 'w-[375px]' : '';
    return (
        <div
            ref={setNodeRef}
            style={{
                ...(viewMode !== 'mobile' ? { width: `${canvasWidth}px` } : {}),
                colorScheme: 'light', // Force light mode for emails
            }}
            className={`bg-white text-black shadow-xl rounded-sm transition-all duration-300 relative ${isOver ? 'ring-4 ring-[var(--color-primary)]/20' : ''
                } ${width}`}
        >
            <div className="min-h-[600px]">
                {children}
            </div>
        </div>
    );
};


export const EmailBuilder: React.FC<EmailBuilderProps> = ({ initialBlocks = [], initialVariables = [], onSave, onSaveDraft, onFetchDrafts, onCancel, saving, projectId, tenantId, initialName = 'Unnamed Template', readOnly = false }) => {
    const { state: blocks, setState: setBlocks, undo, redo, canUndo, canRedo } = useHistory(initialBlocks);
    const [variables, setVariables] = useState<TemplateVariable[]>(initialVariables);
    const [templateName, setTemplateName] = useState<string>(initialName);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isNamingModalOpen, setIsNamingModalOpen] = useState(false);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [activeDragItem, setActiveDragItem] = useState<EmailBlock | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [activeSidebarItem, setActiveSidebarItem] = useState<{ type: string, label?: string } | null>(null);

    // Draft History State
    const [draftHistory, setDraftHistory] = useState<EmailTemplate[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Custom Components State
    const [savedComponents, setSavedComponents] = useState<EmailComponent[]>([]);
    const [isLoadingComponents, setIsLoadingComponents] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'blocks' | 'variables' | 'layers'>('blocks');
    const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(defaultGlobalSettings);

    // Style inheritance: track last-used styles per block type
    const [blockTypeDefaults, setBlockTypeDefaults] = useState<Record<string, { styles: any; content: any }>>({});

    // Autosave state
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const { showError } = useToast();
    const confirm = useConfirm();

    const loadDraft = (draft: EmailTemplate) => {
        setBlocks(draft.blocks || []);
        setVariables(draft.variables || []);
        setTemplateName(draft.name || 'Unnamed Template');
        setLastSaved(draft.updatedAt?.toDate ? draft.updatedAt.toDate() : new Date());
        setIsHistoryOpen(false);
    };

    const handleHistoryToggle = async () => {
        if (!isHistoryOpen && onFetchDrafts) {
            setIsLoadingHistory(true);
            try {
                const drafts = await onFetchDrafts();
                setDraftHistory(drafts);
            } catch (e) {
                console.error("Failed to fetch draft history", e);
            } finally {
                setIsLoadingHistory(false);
            }
        }
        setIsHistoryOpen(!isHistoryOpen);
    };

    // Keyboard shortcuts: Cmd+Z = undo, Cmd+Shift+Z = redo
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Cmd (Mac) or Ctrl (Windows)
            if (e.metaKey || e.ctrlKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    if (canUndo) undo();
                } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                    e.preventDefault();
                    if (canRedo) redo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, undo, redo]);

    // Autosave effect - debounced, saves 3 seconds after last change
    React.useEffect(() => {
        if (!onSaveDraft || blocks.length === 0) return;

        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        // Set new timeout for autosave
        autoSaveTimeoutRef.current = setTimeout(async () => {
            setIsSavingDraft(true);
            try {
                await onSaveDraft(blocks, variables, templateName);
                setLastSaved(new Date());
            } catch (e) {
                console.error('Autosave failed:', e);
            } finally {
                setIsSavingDraft(false);
            }
        }, 3000);

        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [blocks, variables, onSaveDraft]);

    // Fetch components on mount
    React.useEffect(() => {
        if (!projectId) return;
        const fetchComponents = async () => {
            setIsLoadingComponents(true);
            try {
                const comps = await getEmailComponents(projectId);
                setSavedComponents(comps);
            } catch (e) {
                console.error("Failed to load components", e);
            } finally {
                setIsLoadingComponents(false);
            }
        };
        fetchComponents();
    }, [projectId]);

    // ReadOnly Banner
    if (readOnly) {
        return (
            <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800 p-3 text-center text-sm text-yellow-800 dark:text-yellow-200 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                    <span>This template is currently used in a scheduled or sent campaign and cannot be edited.</span>
                    <button
                        onClick={() => onSave(blocks, variables, `${templateName} (Copy)`)}
                        className="underline font-bold hover:text-yellow-900 ml-2"
                    >
                        Duplicate to Edit
                    </button>
                    <button onClick={onCancel} className="ml-4 hover:underline">Close</button>
                </div>

                <div className="flex-1 flex overflow-hidden pointer-events-none opacity-75">
                    {/* Render simplified read-only canvas */}
                    <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-gray-100/50">
                        <DroppableCanvas id="root" viewMode={viewMode} canvasWidth={globalSettings.canvasWidth}>
                            <div className="flex flex-col min-h-[600px] h-full" style={{ backgroundColor: globalSettings.backgroundColor, fontFamily: globalSettings.fontFamily }}>
                                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                    {blocks.map((block) => (
                                        <BlockRenderer
                                            key={block.id}
                                            block={block}
                                            isSelected={false}
                                            onClick={(e) => { }}
                                            onUpdate={(id, updates) => { }}
                                            onDelete={(id) => { }}
                                            viewMode={viewMode}
                                            variables={variables}
                                        />
                                    ))}
                                </SortableContext>
                            </div>
                        </DroppableCanvas>
                    </div>
                </div>
            </div>
        );
    }

    const handleSaveComponent = async (block: EmailBlock, name: string) => {
        try {
            await saveEmailComponent(projectId, name, block);
            // Refresh
            const comps = await getEmailComponents(projectId);
            setSavedComponents(comps);
        } catch (e) {
            console.error("Failed to save component", e);
            showError("Failed to save component");
        }
    };

    const handleDeleteComponent = async (componentId: string) => {
        if (await confirm("Delete Component", "Are you sure you want to delete this saved component?")) {
            await deleteEmailComponent(projectId, componentId);
            const comps = await getEmailComponents(projectId);
            setSavedComponents(comps);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
            disabled: readOnly
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
            keyboardCodes: {
                start: [], cancel: [], end: [] // Disable keyboard sort if readOnly
            }
        })
    );

    // --- Actions ---



    const deleteBlockRecursive = (blocks: EmailBlock[], id: string): EmailBlock[] => {
        return blocks.filter(b => b.id !== id).map(b => {
            if (b.type === 'columns' && b.content.columns) {
                return {
                    ...b,
                    content: {
                        ...b.content,
                        columns: b.content.columns.map(col => deleteBlockRecursive(col, id))
                    }
                };
            }
            if ((b.type === 'flex' || b.type === 'div') && b.content.children) {
                return {
                    ...b,
                    content: {
                        ...b.content,
                        children: deleteBlockRecursive(b.content.children, id)
                    }
                };
            }
            return b;
        });
    };

    const deleteBlock = (id: string) => {
        if (readOnly) return;
        setBlocks(prev => deleteBlockRecursive(prev, id));
        if (selectedBlockId === id) setSelectedBlockId(null);
    };

    const updateBlockRecursive = (blocks: EmailBlock[], id: string, updates: Partial<EmailBlock>): EmailBlock[] => {
        return blocks.map(b => {
            if (b.id === id) {
                // Merge styles and content instead of replacing
                const nextStyles = updates.styles ? { ...b.styles, ...updates.styles } : b.styles;
                const nextContent = updates.content ? { ...b.content, ...updates.content } : b.content;
                return { ...b, ...updates, styles: nextStyles, content: nextContent };
            }

            if (b.type === 'columns' && b.content.columns) {
                return {
                    ...b,
                    content: {
                        ...b.content,
                        columns: b.content.columns.map(col => updateBlockRecursive(col, id, updates))
                    }
                };
            }
            if ((b.type === 'flex' || b.type === 'div') && b.content.children) {
                return {
                    ...b,
                    content: {
                        ...b.content,
                        children: updateBlockRecursive(b.content.children, id, updates)
                    }
                };
            }
            return b;
        });
    };

    const addBlockToDiv = (items: EmailBlock[], parentId: string, newBlock: EmailBlock): EmailBlock[] => {
        return items.map(b => {
            if (b.id === parentId && b.type === 'div') {
                return { ...b, content: { ...b.content, children: [...(b.content.children || []), newBlock] } };
            }
            if (b.type === 'columns' && b.content.columns) {
                return { ...b, content: { ...b.content, columns: b.content.columns.map(col => addBlockToDiv(col, parentId, newBlock)) } };
            }
            if (b.type === 'flex' && b.content.children) {
                return { ...b, content: { ...b.content, children: addBlockToDiv(b.content.children, parentId, newBlock) } };
            }
            if (b.type === 'div' && b.content.children) {
                return { ...b, content: { ...b.content, children: addBlockToDiv(b.content.children, parentId, newBlock) } };
            }
            return b;
        });
    };

    // Recursively adds a block to a specific column anywhere in the tree
    const addBlockToColumn = (items: EmailBlock[], parentId: string, colIdx: number, newBlock: EmailBlock): EmailBlock[] => {
        return items.map(b => {
            if (b.id === parentId && b.type === 'columns') {
                const newCols = [...(b.content.columns || [])];
                newCols[colIdx] = [...newCols[colIdx], newBlock];
                return { ...b, content: { ...b.content, columns: newCols } };
            }
            if (b.type === 'columns' && b.content.columns) {
                return {
                    ...b,
                    content: {
                        ...b.content,
                        columns: b.content.columns.map(col => addBlockToColumn(col, parentId, colIdx, newBlock))
                    }
                };
            }
            if (b.type === 'div' && b.content.children) {
                return {
                    ...b,
                    content: {
                        ...b.content,
                        children: addBlockToColumn(b.content.children, parentId, colIdx, newBlock)
                    }
                };
            }
            if (b.type === 'flex' && b.content.children) {
                return {
                    ...b,
                    content: {
                        ...b.content,
                        children: addBlockToColumn(b.content.children, parentId, colIdx, newBlock)
                    }
                };
            }
            return b;
        });
    };

    const addBlockToFlex = (items: EmailBlock[], parentId: string, newBlock: EmailBlock): EmailBlock[] => {
        return items.map(b => {
            if (b.id === parentId && b.type === 'flex') {
                return { ...b, content: { ...b.content, children: [...(b.content.children || []), newBlock] } };
            }
            if (b.type === 'columns' && b.content.columns) {
                return { ...b, content: { ...b.content, columns: b.content.columns.map(col => addBlockToFlex(col, parentId, newBlock)) } };
            }
            if (b.type === 'flex' && b.content.children) {
                return { ...b, content: { ...b.content, children: addBlockToFlex(b.content.children, parentId, newBlock) } };
            }
            if (b.type === 'div' && b.content.children) {
                return { ...b, content: { ...b.content, children: addBlockToFlex(b.content.children, parentId, newBlock) } };
            }
            return b;
        });
    };

    const updateBlock = (id: string, updates: Partial<EmailBlock>) => {
        setBlocks(prev => updateBlockRecursive(prev, id, updates));

        // Save styles as new default for this block type (style inheritance)
        if (updates.styles) {
            const findBlock = (list: EmailBlock[]): EmailBlock | undefined => {
                if (!Array.isArray(list)) return undefined;
                for (const b of list) {
                    if (b.id === id) return b;
                    if (b.type === 'columns' && b.content.columns) {
                        for (const col of b.content.columns) {
                            const found = findBlock(col);
                            if (found) return found;
                        }
                    }
                    if (b.type === 'flex' && b.content.children) {
                        const found = findBlock(b.content.children);
                        if (found) return found;
                    }
                    if (b.type === 'div' && b.content.children) {
                        const found = findBlock(b.content.children);
                        if (found) return found;
                    }
                }
                return undefined;
            };

            // Use current blocks for finding the type
            const block = findBlock(blocks);
            if (block) {
                setBlockTypeDefaults(prev => ({
                    ...prev,
                    [block.type]: {
                        styles: { ...(prev[block.type]?.styles || {}), ...updates.styles },
                        content: prev[block.type]?.content || {}
                    }
                }));
            }
        }
    };

    // --- Drag & Drop Handlers ---

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;

        // Check if it's a sidebar item
        if (active.data.current?.isSidebar) {
            setActiveSidebarItem({
                type: active.data.current.type,
            });
            const type = active.data.current.type as EmailBlockType;
            const saved = active.data.current.savedBlock;
            const previewBlock = saved ? deepCloneBlock(saved) : createBlock(type);
            // Ensure preview has temp ID
            setActiveDragItem(previewBlock);
            return;
        }

        // Handle Layer Tree or Canvas Drag
        const rawActiveId = active.id as string;
        const isLayerDrag = rawActiveId.startsWith('layer-');
        const activeId = isLayerDrag ? rawActiveId.replace('layer-', '') : rawActiveId;

        // Normal Block Drag
        const findBlock = (items: EmailBlock[]): EmailBlock | undefined => {
            for (const item of items) {
                if (item.id === activeId) return item;
                if (item.type === 'columns' && item.content.columns) {
                    for (const col of item.content.columns) {
                        const found = findBlock(col);
                        if (found) return found;
                    }
                }
                if (item.type === 'flex' && item.content.children) {
                    const found = findBlock(item.content.children);
                    if (found) return found;
                }
            }
        };
        const found = findBlock(blocks);
        // Tag the drag item with source info so we know how to render the overlay
        if (found) {
            setActiveDragItem({ ...found, _dragSource: isLayerDrag ? 'layer' : 'canvas' } as any);
        } else {
            setActiveDragItem(null);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragItem(null);
        setActiveSidebarItem(null);

        if (!over) return;

        const rawOverId = over.id as string;
        // Normalize IDs (strip layer- prefix)
        const overId = rawOverId.startsWith('layer-') ? rawOverId.replace('layer-', '') : rawOverId;
        const rawActiveId = active.id as string;
        const activeId = rawActiveId.startsWith('layer-') ? rawActiveId.replace('layer-', '') : rawActiveId;

        // Handle Sidebar Drop
        if (active.data.current?.isSidebar) {
            const type = active.data.current.type as EmailBlockType;
            const savedBlock = active.data.current.savedBlock as EmailBlock | undefined;
            let newBlock = savedBlock ? deepCloneBlock(savedBlock) : createBlock(type);

            // Apply default styles if available
            if (!savedBlock && blockTypeDefaults[type]) {
                const defaults = blockTypeDefaults[type];
                // Exclude padding from defaults for structural blocks to prevent overwriting the 30px default
                const isStructural = ['columns', 'flex', 'div'].includes(type);

                let mergedStyles = { ...newBlock.styles, ...defaults.styles };

                if (isStructural) {
                    // Restore original TOP/BOTTOM padding from createBlock (30px)
                    // But allow Left/Right padding to be inherited from previous settings
                    mergedStyles = {
                        ...mergedStyles,
                        paddingTop: 30, // Force 30px default
                        paddingBottom: 30, // Force 30px default
                        // explicitly remove shorthand padding to ensure specific values take precedence
                        padding: undefined
                    };
                }

                newBlock = {
                    ...newBlock,
                    styles: mergedStyles,
                    content: { ...newBlock.content, ...defaults.content }
                };
            }

            // 1. Drop onto root canvas background
            if (overId === 'root') {
                setBlocks(prev => [...prev, newBlock]);
                setSelectedBlockId(newBlock.id);
                return;
            }

            // 2. Drop onto a specific column container (virtual ID: {blockId}-col-{index})
            const colMatch = overId.match(/^(.+)-col-(\d+)$/);
            if (colMatch) {
                const parentId = colMatch[1];
                const colIdx = parseInt(colMatch[2]);
                setBlocks(prev => addBlockToColumn(prev, parentId, colIdx, newBlock));
                setSelectedBlockId(newBlock.id);
                return;
            }

            // 3. Drop onto Flex Container
            const flexMatch = overId.match(/^(.+)-flex$/);
            if (flexMatch) {
                const parentId = flexMatch[1];
                setBlocks(prev => addBlockToFlex(prev, parentId, newBlock));
                setSelectedBlockId(newBlock.id);
                return;
            }

            // 4. Drop onto Div Container
            const divMatch = overId.match(/^(.+)-div$/);
            if (divMatch) {
                const parentId = divMatch[1];
                setBlocks(prev => addBlockToDiv(prev, parentId, newBlock));
                setSelectedBlockId(newBlock.id);
                return;
            }

            // 5. Drop onto another block (sibling)
            // If dropping onto a block, insert AFTER it
            // Need to find where this block is
            const result = moveBlockInTree(blocks, 'new-placeholder', overId);
            // Wait, moveBlockInTree expects an existing ID. 
            // We need a specialized "insert at" function or reuse logic.
            // Simplified: If dropping on a sibling, find it and insert after.
            // BUT: moveBlockInTree removes the old one. We don't have an old one.

            // Re-implement basic sibling insert for sidebar:
            const insertNewAfter = (list: EmailBlock[]): EmailBlock[] => {
                const newList: EmailBlock[] = [];
                for (const b of list) {
                    newList.push(b);
                    if (b.id === overId) {
                        newList.push(newBlock);
                    }
                    if (b.type === 'columns' && b.content.columns) {
                        newList[newList.length - 1] = {
                            ...b, content: { ...b.content, columns: b.content.columns.map(insertNewAfter) }
                        }
                    }
                    if ((b.type === 'flex' || b.type === 'div') && b.content.children) {
                        newList[newList.length - 1] = {
                            ...b, content: { ...b.content, children: insertNewAfter(b.content.children) }
                        }
                    }
                }
                return newList;
            };
            // Check if root has it
            const rootIndex = blocks.findIndex(b => b.id === overId);
            if (rootIndex !== -1) {
                setBlocks(prev => {
                    const next = [...prev];
                    next.splice(rootIndex + 1, 0, newBlock);
                    return next;
                });
                setSelectedBlockId(newBlock.id);
                return;
            }

            setBlocks(prev => insertNewAfter(prev));
            setSelectedBlockId(newBlock.id);
            return;
        }

        if (activeId !== overId) {
            setBlocks(prev => {
                const activeIndex = prev.findIndex(b => b.id === activeId);
                const overIndex = prev.findIndex(b => b.id === overId);

                if (activeIndex !== -1 && overIndex !== -1) {
                    return arrayMove(prev, activeIndex, overIndex);
                } else {
                    return moveBlockInTree(prev, activeId, overId);
                }
            });
        }
    };

    // Deep move helper
    // Deep move helper
    const moveBlockInTree = (items: EmailBlock[], activeId: string, overId: string): EmailBlock[] => {
        // 1. Find the block to move
        // We must clone it because 'deleteBlockRecursive' might remove it from the reference tree if we are not careful,
        // although here we are operating on immutable state style.
        let blockToMove: EmailBlock | undefined;
        const find = (list: EmailBlock[]) => {
            for (const item of list) {
                if (item.id === activeId) { blockToMove = item; return; }
                if (item.type === 'columns' && item.content.columns) item.content.columns.forEach(find);
                if ((item.type === 'flex' || item.type === 'div') && item.content.children) find(item.content.children);
            }
        };
        find(items);
        if (!blockToMove) return items;

        // 2. Remove from old location
        // IMPORTANT: We must ensure we return a NEW array reference
        const scrubbed = deleteBlockRecursive(items, activeId);

        // 3. Drop into targets
        if (overId === 'root') {
            return [...scrubbed, blockToMove];
        }

        const colMatch = overId.match(/^(.+)-col-(\d+)$/);
        if (colMatch) return addBlockToColumn(scrubbed, colMatch[1], parseInt(colMatch[2]), blockToMove);

        const flexMatch = overId.match(/^(.+)-flex$/);
        if (flexMatch) return addBlockToFlex(scrubbed, flexMatch[1], blockToMove);

        const divMatch = overId.match(/^(.+)-div$/);
        if (divMatch) return addBlockToDiv(scrubbed, divMatch[1], blockToMove);

        // 4. Sibling Insert (Insert After)
        const insertAfter = (list: EmailBlock[]): EmailBlock[] => {
            const newList: EmailBlock[] = [];
            let inserted = false;
            for (const b of list) {
                if (b.id === overId) {
                    newList.push(b);
                    newList.push(blockToMove!);
                    inserted = true;
                } else {
                    newList.push(b);
                }

                // Traverse children to update them if they changed (not mutated, but we map properly)
                const last = newList[newList.length - 1];
                if (last.type === 'columns' && last.content.columns) {
                    newList[newList.length - 1] = {
                        ...last,
                        content: { ...last.content, columns: last.content.columns.map(insertAfter) }
                    };
                }
                if ((last.type === 'flex' || last.type === 'div') && last.content.children) {
                    newList[newList.length - 1] = {
                        ...last,
                        content: { ...last.content, children: insertAfter(last.content.children) }
                    };
                }
            }
            return newList;
        };

        return insertAfter(scrubbed);
    };


    const selectedBlock = useMemo(() => {
        // Handle composite IDs (e.g. "blockId::col::0")
        const actualId = selectedBlockId?.includes('::col::')
            ? selectedBlockId.split('::col::')[0]
            : selectedBlockId;

        // Find deep
        const find = (list: EmailBlock[]): EmailBlock | undefined => {
            if (!Array.isArray(list)) return undefined;
            for (const item of list) {
                if (item.id === actualId) return item;
                if (item.type === 'columns' && item.content.columns) {
                    for (const col of item.content.columns) {
                        const found = find(col);
                        if (found) return found;
                    }
                }
                if (item.type === 'flex' && item.content.children) {
                    const found = find(item.content.children);
                    if (found) return found;
                }
                if (item.type === 'div' && item.content.children) {
                    const found = find(item.content.children);
                    if (found) return found;
                }
            }
        };
        return find(blocks);
    }, [blocks, selectedBlockId]);

    const containerResult = useMemo(() => {
        if (!selectedBlockId) return null;
        const actualId = selectedBlockId.includes('::col::') ? selectedBlockId.split('::col::')[0] : selectedBlockId;
        return findContainer(actualId, blocks);
    }, [blocks, selectedBlockId]);

    const parentBlock = containerResult?.parentBlock || null;

    const addBlock = (type: EmailBlockType, customBlock?: EmailBlock) => {
        let newBlock = customBlock ? deepCloneBlock(customBlock) : createBlock(type);
        const defaults = blockTypeDefaults[type];
        if (defaults && !customBlock) {
            newBlock = { ...newBlock, styles: { ...newBlock.styles, ...defaults.styles } };
        }

        // Context-aware add: append to selected container if applicable
        if (selectedBlock) {
            if (selectedBlock.type === 'flex') {
                setBlocks(prev => addBlockToFlex(prev, selectedBlock.id, newBlock));
                setSelectedBlockId(newBlock.id);
                return;
            }
            if (selectedBlock.type === 'div') {
                setBlocks(prev => addBlockToDiv(prev, selectedBlock.id, newBlock));
                setSelectedBlockId(newBlock.id);
                return;
            }
            if (selectedBlock.type === 'columns') {
                // If a specific column is selected via composite ID (e.g. "id::col::1"), use that index
                let targetColIdx = 0;
                if (selectedBlockId?.includes('::col::')) {
                    const parts = selectedBlockId.split('::col::');
                    if (parts[1]) targetColIdx = parseInt(parts[1], 10) || 0;
                }

                setBlocks(prev => addBlockToColumn(prev, selectedBlock.id, targetColIdx, newBlock));
                setSelectedBlockId(newBlock.id);
                return;
            }

            // DEFAULT INSERTION BEHAVIOR (Improved):
            // If any other block is selected, insert the new block right below it on the same level
            setBlocks(prev => insertBlockAfter(prev, selectedBlock.id, newBlock));
            setSelectedBlockId(newBlock.id);
            return;
        }

        setBlocks(prev => {
            const next = [...prev, newBlock];
            return next;
        });
        setSelectedBlockId(newBlock.id);
    };




    const builderContent = (
        <div
            id="email-builder-container"
            className={`flex overflow-hidden bg-[var(--color-surface-bg)] font-sans ${isMaximized
                ? 'fixed inset-0 z-[9999] h-screen w-screen'
                : 'border border-[var(--color-surface-border)] rounded-xl shadow-sm relative h-[calc(100vh-80px)]'
                }`}
        >
            {/* Left Sidebar */}
            <div className="w-72 border-r border-[var(--color-surface-border)] bg-[var(--color-surface-paper)] flex flex-col z-10">
                {/* Template Name Header */}
                <div className="px-4 h-[41px] flex items-center border-b border-[var(--color-surface-border)] bg-[var(--color-surface-card)]">
                    <div className="flex items-center justify-between gap-2 w-full">
                        {isEditingName ? (
                            <input
                                autoFocus
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                onBlur={() => {
                                    setIsEditingName(false);
                                    if (!templateName.trim()) setTemplateName('Unnamed Template');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') setIsEditingName(false);
                                }}
                                className="flex-1 bg-transparent text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-primary)] outline-none"
                                style={{ padding: 0, margin: 0, border: 'none', height: '100%', lineHeight: '1' }}
                            />
                        ) : (
                            <div
                                onClick={() => setIsEditingName(true)}
                                className="flex-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-main)] truncate cursor-pointer hover:text-[var(--color-primary)] transition-colors group/name flex items-center gap-2"
                                style={{ lineHeight: '1' }}
                            >
                                <span className="truncate">{templateName}</span>
                                <span className="material-symbols-outlined text-[12px] opacity-0 group-hover/name:opacity-40 transition-opacity">edit</span>
                            </div>
                        )}
                        <span className="material-symbols-outlined text-[14px] text-[var(--color-text-muted)] opacity-20">inventory_2</span>
                    </div>
                </div>

                <div className="flex border-b border-[var(--color-surface-border)]">
                    <button
                        onClick={() => setSidebarTab('layers')}
                        className={`flex-1 p-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${sidebarTab === 'layers' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-[var(--color-surface-card)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">layers</span>
                        Layers
                    </button>
                    <button
                        onClick={() => setSidebarTab('blocks')}
                        className={`flex-1 p-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${sidebarTab === 'blocks' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-[var(--color-surface-card)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">widgets</span>
                        Blocks
                    </button>
                    <button
                        onClick={() => setSidebarTab('variables')}
                        className={`flex-1 p-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${sidebarTab === 'variables' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-[var(--color-surface-card)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">data_object</span>
                        Vars
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {sidebarTab === 'layers' && (
                        <div className="py-2">
                            <LayerTree blocks={blocks} selectedId={selectedBlockId} onSelect={setSelectedBlockId} onDelete={deleteBlock} />
                        </div>
                    )}
                    {sidebarTab === 'blocks' && (
                        <div className="p-4 space-y-6">
                            <BlockCategory title="Typography">
                                <DraggableSidebarItem type="text" icon="title" label="Text" onClick={() => addBlock('text')} />
                                <DraggableSidebarItem type="richtext" icon="article" label="Rich Text" onClick={() => addBlock('richtext')} />
                                <DraggableSidebarItem type="header" icon="format_h1" label="Header" onClick={() => addBlock('header')} />
                                <DraggableSidebarItem type="list" icon="format_list_bulleted" label="List" onClick={() => addBlock('list')} />
                                <DraggableSidebarItem type="quote" icon="format_quote" label="Quote" onClick={() => addBlock('quote')} />
                                <DraggableSidebarItem type="html" icon="code" label="HTML" onClick={() => addBlock('html')} />
                            </BlockCategory>
                            <BlockCategory title="Layout">
                                <DraggableSidebarItem type="columns" icon="view_column" label="Columns" onClick={() => addBlock('columns')} />
                                <DraggableSidebarItem type="flex" icon="view_quilt" label="Flex" onClick={() => addBlock('flex')} />
                                <DraggableSidebarItem type="div" icon="check_box_outline_blank" label="Div" onClick={() => addBlock('div')} />
                                <DraggableSidebarItem type="divider" icon="horizontal_rule" label="Divider" onClick={() => addBlock('divider')} />
                                <DraggableSidebarItem type="spacer" icon="height" label="Spacer" onClick={() => addBlock('spacer')} />
                                <DraggableSidebarItem type="solid" icon="rectangle" label="Solid" onClick={() => addBlock('solid')} />
                                <DraggableSidebarItem type="button" icon="smart_button" label="Button" onClick={() => addBlock('button')} />
                            </BlockCategory>
                            <BlockCategory title="Media">
                                <DraggableSidebarItem type="image" icon="image" label="Image" onClick={() => addBlock('image')} />
                            </BlockCategory>
                            <BlockCategory title="Marketing">
                                <DraggableSidebarItem type="menu" icon="menu" label="Menu" onClick={() => addBlock('menu')} />
                                <DraggableSidebarItem type="social" icon="share" label="Social" onClick={() => addBlock('social')} />
                                <DraggableSidebarItem type="video" icon="play_circle" label="Video" onClick={() => addBlock('video')} />
                            </BlockCategory>
                            {savedComponents.length > 0 && (
                                <BlockCategory title="Saved">
                                    {savedComponents.map(comp => (
                                        <div key={comp.id} className="relative group">
                                            <DraggableSidebarItem
                                                type={comp.block.type as EmailBlockType}
                                                icon="extension"
                                                label={comp.name}
                                                onClick={() => addBlock(comp.block.type as EmailBlockType, comp.block)}
                                                savedBlock={comp.block}
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteComponent(comp.id); }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete Component"
                                            >
                                                <span className="material-symbols-outlined text-[10px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </BlockCategory>
                            )}
                        </div>
                    )}
                    {sidebarTab === 'variables' && (
                        <VariableManager variables={variables} onChange={setVariables} />
                    )}
                </div>
            </div>

            {/* Center Canvas */}
            <div className="flex-1 flex flex-col bg-zinc-100 dark:bg-zinc-900/50 relative">
                {/* Toolbar */}
                <div className="h-14 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-card)] grid grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 shadow-sm z-10 gap-4">
                    {/* Left: View Controls & History */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-0.5">
                            <button onClick={undo} disabled={!canUndo} className={`p-1.5 rounded-lg transition-colors ${!canUndo ? 'opacity-20 cursor-not-allowed' : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)]'}`} title="Undo">
                                <span className="material-symbols-outlined text-[18px]">undo</span>
                            </button>
                            <button onClick={redo} disabled={!canRedo} className={`p-1.5 rounded-lg transition-colors ${!canRedo ? 'opacity-20 cursor-not-allowed' : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)]'}`} title="Redo">
                                <span className="material-symbols-outlined text-[18px]">redo</span>
                            </button>
                        </div>
                    </div>

                    {/* Center: Status Indicator */}
                    <div className="flex justify-center relative">
                        <div
                            className="px-3 py-1.5 bg-[var(--color-surface-sunken)]/50 border border-[var(--color-surface-border)] rounded-full flex items-center gap-2 transition-all min-w-[200px] justify-center cursor-pointer hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)]/30 group/status shadow-inner"
                            onClick={handleHistoryToggle}
                        >
                            {isSavingDraft ? (
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined animate-spin text-[14px] text-[var(--color-primary)]">sync</span>
                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Cloud Saving...</span>
                                </div>
                            ) : lastSaved ? (
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-green-500 text-[14px]">check_circle</span>
                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap">
                                        Synced <span className="opacity-40 font-mono ml-1">{lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </span>
                                    <span className="material-symbols-outlined text-[14px] text-[var(--color-text-muted)] group-hover/status:text-[var(--color-primary)] transition-colors ml-1">history</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 opacity-50">
                                    <span className="material-symbols-outlined text-[14px]">cloud_off</span>
                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Unsaved Changes</span>
                                    <span className="material-symbols-outlined text-[14px] ml-1">history</span>
                                </div>
                            )}
                        </div>

                        {/* History Dropdown */}
                        {isHistoryOpen && (
                            <div className="absolute top-full mt-2 w-80 bg-white dark:bg-zinc-900 border border-[var(--color-surface-border)] rounded-2xl shadow-2xl z-[100] overflow-hidden flex flex-col max-h-[500px] animate-in slide-in-from-top-2 duration-200">
                                <div className="px-5 py-4 border-b border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-card)]">
                                    <div className="flex flex-col gap-0.5">
                                        <h3 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Version History</h3>
                                        <p className="text-[9px] text-[var(--color-text-muted)] opacity-50 uppercase font-bold tracking-tighter">Recent snapshots</p>
                                    </div>
                                    <button onClick={() => setIsHistoryOpen(false)} className="size-8 rounded-full hover:bg-[var(--color-surface-sunken)] flex items-center justify-center transition-colors group/close">
                                        <span className="material-symbols-outlined text-[18px] opacity-40 group-hover/close:opacity-100 transition-all group-hover/close:rotate-90">close</span>
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1 custom-scrollbar">
                                    {isLoadingHistory ? (
                                        <div className="p-16 flex flex-col items-center gap-4">
                                            <div className="relative">
                                                <span className="material-symbols-outlined text-[40px] text-[var(--color-primary)]/20 animate-pulse">history</span>
                                                <span className="material-symbols-outlined animate-spin text-[24px] text-[var(--color-primary)] absolute inset-0 flex items-center justify-center">sync</span>
                                            </div>
                                            <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] animate-pulse">Syncing Archive</span>
                                        </div>
                                    ) : draftHistory.length > 0 ? (
                                        <div className="divide-y divide-[var(--color-surface-border)]/10 dark:divide-zinc-800/40">
                                            {draftHistory.slice(0, 5).map((draft, idx) => (
                                                <button
                                                    key={draft.id}
                                                    onClick={() => loadDraft(draft)}
                                                    className="w-full px-5 py-4 text-left hover:bg-[var(--color-primary)]/[0.03] flex items-center justify-between group transition-all"
                                                >
                                                    <div className="flex flex-col gap-1 min-w-0 pr-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors uppercase tracking-tight truncate">
                                                                {draft.name || 'Unnamed Template'}
                                                            </span>
                                                            {idx === 0 && (
                                                                <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[8px] font-black uppercase tracking-tighter rounded-sm">Latest</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1 text-[var(--color-text-muted)] opacity-60">
                                                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                                                <span className="text-[9px] font-bold uppercase tracking-tight">
                                                                    {draft.updatedAt?.toDate ? draft.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[var(--color-text-muted)] opacity-60">
                                                                <span className="material-symbols-outlined text-[11px]">calendar_today</span>
                                                                <span className="text-[9px] font-bold uppercase tracking-tight">
                                                                    {draft.updatedAt?.toDate ? format(draft.updatedAt.toDate(), 'MMM d', { locale: dateLocale }) : 'Today'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-9 rounded-full bg-zinc-100 dark:bg-zinc-100 flex items-center justify-center group-hover:bg-[var(--color-primary)] transition-all shadow-sm border border-[var(--color-surface-border)]/30 dark:border-white/10">
                                                            <span className="material-symbols-outlined text-[18px] !text-zinc-900 group-hover:!text-white group-hover:rotate-[-45deg] transition-all">history_toggle_off</span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-16 text-center">
                                            <div className="size-20 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center mx-auto mb-6 border border-[var(--color-surface-border)]/40 shadow-inner">
                                                <span className="material-symbols-outlined text-[32px] text-[var(--color-text-muted)] opacity-20">history_edu</span>
                                            </div>
                                            <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">History Empty</p>
                                            <p className="text-[9px] text-[var(--color-text-muted)] opacity-40 uppercase font-bold tracking-tight mt-1">Changes will appear here</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            title={isMaximized ? 'Exit Focus Mode' : 'Focus Mode'}
                            className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors flex items-center"
                        >
                            <span className="material-symbols-outlined text-[20px]">{isMaximized ? 'close_fullscreen' : 'open_in_full'}</span>
                        </button>

                        <div className="h-6 w-px bg-[var(--color-surface-border)] mx-1" />

                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                        >
                            Cancel
                        </button>

                        <div className="flex items-center gap-2 border-l border-[var(--color-surface-border)] pl-3 ml-1">
                            {onSaveDraft && (
                                <button
                                    onClick={() => {
                                        if (templateName === 'Unnamed Template' || !templateName.trim()) {
                                            setIsNamingModalOpen(true);
                                        } else {
                                            onSaveDraft(blocks, variables, templateName);
                                        }
                                    }}
                                    disabled={isSavingDraft}
                                    className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider border border-[var(--color-surface-border)] dark:border-zinc-700 text-[var(--color-text-main)] dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:!text-zinc-100 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
                                >
                                    {isSavingDraft ? <span className="material-symbols-outlined animate-spin text-[14px]">sync</span> : null}
                                    Save Draft
                                </button>
                            )}
                            <button
                                onClick={() => onSave(blocks, variables, templateName)}
                                className={`flex items-center gap-2 px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-text)] rounded-lg text-[11px] font-black uppercase tracking-widest shadow-lg shadow-[var(--color-primary)]/20 transition-all ${saving ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                            >
                                {saving ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">rocket_launch</span>}
                                Publish
                            </button>
                        </div>
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 overflow-y-auto flex flex-col items-center bg-dot-pattern py-12" onClick={() => setSelectedBlockId(null)}>
                    <HoverProvider>
                        <DroppableCanvas id="root" viewMode={viewMode} canvasWidth={globalSettings.canvasWidth}>
                            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                {blocks.map(block => (
                                    <NestedBlock
                                        key={block.id}
                                        block={block}
                                        selectedId={selectedBlockId}
                                        onSelect={setSelectedBlockId}
                                        onDelete={deleteBlock}
                                        depth={0}
                                        onDuplicate={() => addBlock(block.type)}
                                        variables={variables}
                                    />
                                ))}
                            </SortableContext>
                            {blocks.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 pointer-events-none">
                                    <span className="material-symbols-outlined text-4xl mb-2">drag_indicator</span>
                                    <p className="text-sm font-medium">Drag blocks here</p>
                                </div>
                            )}
                        </DroppableCanvas>
                    </HoverProvider>
                    <DragOverlay>
                        {activeDragItem ? (
                            (activeDragItem as any)._dragSource === 'layer' ? (
                                <LayerDragPreview block={activeDragItem} />
                            ) : (
                                <div className="p-4 bg-white/90 shadow-xl rounded ring-2 ring-[var(--color-primary)]"><BlockRenderer block={activeDragItem} variables={variables} /></div>
                            )
                        ) : null}
                    </DragOverlay>
                </div>

                {/* Naming Modal */}
                {isNamingModalOpen && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-[var(--color-surface-border)] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6">
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-[var(--color-text-main)] uppercase tracking-tight">Name Template</h3>
                                <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-widest opacity-60">Give this draft a clear title to recognize it later.</p>
                            </div>

                            <div className="space-y-4">
                                <input
                                    autoFocus
                                    value={templateName === 'Unnamed Template' ? '' : templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="e.g. Monthly Newsletter"
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-sunken)] border border-[var(--color-surface-border)] rounded-xl text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && templateName.trim()) {
                                            setIsNamingModalOpen(false);
                                            onSaveDraft?.(blocks, variables, templateName);
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <button
                                    onClick={() => setIsNamingModalOpen(false)}
                                    className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={!templateName.trim() || templateName === 'Unnamed Template'}
                                    onClick={() => {
                                        setIsNamingModalOpen(false);
                                        onSaveDraft?.(blocks, variables, templateName);
                                    }}
                                    className="px-6 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] text-[11px] font-black uppercase tracking-widest rounded-lg shadow-lg hover:shadow-[var(--color-primary)]/40 transition-all disabled:opacity-50 disabled:grayscale"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Sidebar: Properties */}
            <div className="w-80 border-l border-[var(--color-surface-border)] bg-[var(--color-surface-paper)] overflow-y-auto z-10">
                {selectedBlock ? (
                    <PropertiesPanel
                        block={selectedBlock}
                        parentType={parentBlock?.type}
                        columnCount={parentBlock?.type === 'columns' ? parentBlock?.content?.columns?.length : undefined}
                        variables={variables}
                        onChange={(updates) => updateBlock(selectedBlock.id, updates)}
                        onSaveAsComponent={(name) => handleSaveComponent(selectedBlock, name)}
                        projectId={projectId}
                        tenantId={tenantId}
                    />
                ) : (
                    <GlobalSettingsPanel
                        settings={globalSettings}
                        onChange={setGlobalSettings}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                    />
                )}
            </div>
        </div>
    );

    const collisionDetectionStrategy = (args: any) => {
        // If it's a sidebar item, use rectIntersection for strict dropping
        if (args.active.data.current?.isSidebar) {
            return rectIntersection(args);
        }
        // For existing blocks, use closestCorners for easier sorting
        return closestCorners(args);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
        >
            {isMaximized ? createPortal(builderContent, document.body) : builderContent}
        </DndContext>
    );
};
