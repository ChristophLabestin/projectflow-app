import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';

interface SlashCommandListProps {
    items: any[];
    command: any;
    editor: Editor;
}

export const SlashCommandList = React.forwardRef((props: SlashCommandListProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback((index) => {
        const item = props.items[index];

        if (item) {
            props.command(item);
        }
    }, [props]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [props.items]);

    React.useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
                return true;
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % props.items.length);
                return true;
            }
            if (event.key === 'Enter') {
                selectItem(selectedIndex);
                return true;
            }
            return false;
        },
    }));

    return (
        <div className="flex flex-col p-1 w-60 bg-card rounded-lg shadow-xl border border-surface overflow-hidden max-h-[300px] overflow-y-auto z-[100000]">
            <div className="px-2 py-1 text-xs font-semibold text-muted uppercase tracking-wider">
                Basic Blocks
            </div>
            {props.items.map((item, index) => (
                <button
                    key={index}
                    className={`flex items-center gap-2 p-2 rounded-md text-sm text-left transition-colors ${index === selectedIndex
                        ? 'bg-surface-hover text-main'
                        : 'text-muted hover:bg-surface-hover hover:text-main'
                        }`}
                    onClick={() => selectItem(index)}
                >
                    {item.icon && <span className="material-symbols-outlined text-[18px]">{item.icon}</span>}
                    <div className="flex flex-col text-left">
                        <span className="font-medium text-main">{item.title}</span>
                        {item.description && <span className="text-[10px] text-muted opacity-70">{item.description}</span>}
                    </div>
                </button>
            ))}
        </div>
    );
});

SlashCommandList.displayName = 'SlashCommandList';
