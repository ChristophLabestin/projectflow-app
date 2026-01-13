import { useState, useCallback } from 'react';
import { EmailBlock, EmailBlockType } from '../../../types';
import { arrayMove } from '@dnd-kit/sortable';

// Find the container array (could be root or a column inner array) that contains the block id
export function findContainer(id: string, blocks: EmailBlock[], parentBlock?: EmailBlock): { container: EmailBlock[], parentBlock?: EmailBlock, columnIndex?: number } | null {
    if (!Array.isArray(blocks)) return null;

    // Check direct children at this level
    if (blocks.find(b => b.id === id)) {
        return { container: blocks, parentBlock };
    }

    // Check deeper levels
    for (const block of blocks) {
        if (block.type === 'columns' && block.content.columns) {
            for (let i = 0; i < block.content.columns.length; i++) {
                const found = findContainer(id, block.content.columns[i], block);
                if (found) {
                    // Inject columnIndex if the parent matches the current block
                    if (found.parentBlock === block) found.columnIndex = i;
                    return found;
                }
            }
        }
        if ((block.type === 'flex' || block.type === 'div') && block.content.children) {
            const found = findContainer(id, block.content.children, block);
            if (found) return found;
        }
    }
    return null;
}

// Flat list of all container IDs (root + every column definition) for DnD context
export function getAllContainerIds(blocks: EmailBlock[]): string[] {
    let ids: string[] = ['root'];

    const traverse = (items: EmailBlock[]) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
            if (item.type === 'columns' && item.content.columns) {
                item.content.columns.forEach((col, idx) => {
                    ids.push(`${item.id}-col-${idx}`); // Virtual ID for the column container
                    traverse(col);
                });
            }
            if (item.type === 'flex' && item.content.children) {
                ids.push(`${item.id}-flex`);
                traverse(item.content.children);
            }
        }
    };
    traverse(blocks);
    return ids;
}

export const useHistory = (initialState: EmailBlock[]) => {
    const [state, setStateInternal] = useState({
        history: [initialState],
        index: 0
    });

    const setState = useCallback((value: EmailBlock[] | ((prev: EmailBlock[]) => EmailBlock[])) => {
        setStateInternal(prev => {
            const currentBlocks = prev.history[prev.index];
            const nextBlocks = typeof value === 'function' ? value(currentBlocks) : value;

            const newHistory = prev.history.slice(0, prev.index + 1);
            return {
                history: [...newHistory, nextBlocks],
                index: prev.index + 1
            };
        });
    }, []);

    const undo = useCallback(() => {
        setStateInternal(prev => ({
            ...prev,
            index: Math.max(0, prev.index - 1)
        }));
    }, []);

    const redo = useCallback(() => {
        setStateInternal(prev => ({
            ...prev,
            index: Math.min(prev.history.length - 1, prev.index + 1)
        }));
    }, []);

    return {
        state: state.history[state.index],
        setState,
        undo,
        redo,
        canUndo: state.index > 0,
        canRedo: state.index < state.history.length - 1
    };
};

export function createBlock(type: EmailBlockType): EmailBlock {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const base = { id, type, styles: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 } };
    const layoutStyles = { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };

    if (type === 'columns') return {
        ...base,
        content: { columns: [[], []] }, // Start with 2 empty columns
        styles: { ...layoutStyles, width: '100%', paddingTop: 30, paddingBottom: 30 }
    };
    if (type === 'spacer') return { ...base, content: {}, styles: { ...layoutStyles, height: 48, width: '100%' } };
    if (type === 'divider') return { ...base, content: {}, styles: { ...layoutStyles, paddingTop: 10, paddingBottom: 10 } };
    if (type === 'text') return { ...base, content: { text: 'Enter your text here...' } };
    if (type === 'richtext') return {
        ...base,
        content: {
            text: '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>'
        }
    };
    // Header init moved down
    if (type === 'list') return { ...base, content: {} };
    if (type === 'image') return { ...base, content: { src: 'https://placehold.co/600x300', alt: 'Image' } };
    if (type === 'menu') return {
        ...base,
        content: {
            menuLinks: [
                { label: 'Home', url: '#' },
                { label: 'About', url: '#' },
                { label: 'Contact', url: '#' }
            ]
        }
    };
    if (type === 'social') return {
        ...base,
        content: {
            socialLinks: [
                { platform: 'twitter', url: 'https://twitter.com' },
                { platform: 'facebook', url: 'https://facebook.com' },
                { platform: 'linkedin', url: 'https://linkedin.com' },
                { platform: 'instagram', url: 'https://instagram.com' }
            ]
        }
    };
    if (type === 'video') return {
        ...base,
        content: {
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            src: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg' // Default thumbnail
        }
    };
    if (type === 'button') return {
        ...base,
        content: { text: 'Click Here', url: 'https://example.com' },
        styles: {
            ...base.styles,
            backgroundColor: '#3b82f6', // Primary Blue
            color: '#ffffff',
            borderRadius: 8,
            paddingTop: 12,
            paddingBottom: 12,
            paddingLeft: 24,
            paddingRight: 24,
            fontSize: 16,
            fontWeight: '600',
            textAlign: 'center',
            width: 'auto'
        }
    };
    if (type === 'header') return { ...base, content: { text: 'Header' }, styles: { ...base.styles, fontSize: 48, fontWeight: 'bold' } };
    if (type === 'solid') return {
        ...base,
        styles: {
            ...base.styles,
            backgroundColor: '#e4e4e7', // zinc-200
            width: '100%',
            height: 100, // Default height
            borderRadius: 4
        }
    };
    if (type === 'flex') return {
        ...base,
        content: { children: [] },
        styles: {
            ...layoutStyles,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            width: '100%',
            paddingTop: 30,
            paddingBottom: 30
        }
    };
    if (type === 'div') return {
        ...base,
        content: { children: [] },
        styles: {
            ...layoutStyles,
            width: '100%',
            paddingTop: 30,
            paddingBottom: 30,
            paddingLeft: 0,
            paddingRight: 0
        }
    };
    return { ...base, content: {} };
}

export function deepCloneBlock(block: EmailBlock): EmailBlock {
    const newId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const cloned = { ...block, id: newId };
    if (cloned.content.columns) {
        cloned.content = {
            ...cloned.content,
            columns: cloned.content.columns.map(col => col.map(child => deepCloneBlock(child)))
        };
    }
    if (cloned.content.children) {
        cloned.content = {
            ...cloned.content,
            children: cloned.content.children.map(child => deepCloneBlock(child))
        };
    }
    return cloned;
}
export function insertBlockAfter(blocks: EmailBlock[], targetId: string, newBlock: EmailBlock): EmailBlock[] {
    const index = blocks.findIndex(b => b.id === targetId);
    if (index !== -1) {
        const nextBlocks = [...blocks];
        nextBlocks.splice(index + 1, 0, newBlock);
        return nextBlocks;
    }

    return blocks.map(block => {
        if (block.type === 'columns' && block.content.columns) {
            return {
                ...block,
                content: {
                    ...block.content,
                    columns: block.content.columns.map(col => insertBlockAfter(col, targetId, newBlock))
                }
            };
        }
        if ((block.type === 'flex' || block.type === 'div') && block.content.children) {
            return {
                ...block,
                content: {
                    ...block.content,
                    children: insertBlockAfter(block.content.children, targetId, newBlock)
                }
            };
        }
        return block;
    });
}
