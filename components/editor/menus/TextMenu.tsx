import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
    Bold, Italic, Underline, Strikethrough, Code, Link as LinkIcon,
    Heading1, Heading2, Quote, Check
} from 'lucide-react';

interface TextMenuProps {
    editor: Editor;
}

export const TextMenu: React.FC<TextMenuProps> = ({ editor }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    // Sub-menus
    const [linkUrl, setLinkUrl] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showColorMenu, setShowColorMenu] = useState(false);

    const updateMenu = () => {
        if (!editor) return;

        const { selection } = editor.state;

        // Hide if empty selection or if slash command is active or if image/card selected
        if (selection.empty || editor.isActive('slashCommand') || editor.isActive('card')) {
            setIsVisible(false);
            setShowLinkInput(false);
            setShowColorMenu(false);
            return;
        }

        // Get selection coordinates
        const from = selection.from;
        const to = selection.to;
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);

        // Center the menu above the selection
        const left = (start.left + end.left) / 2;
        const top = start.top - 10; // 10px spacing

        setIsVisible(true);
        setPosition({ top, left });
    };

    useEffect(() => {
        editor.on('selectionUpdate', updateMenu);
        editor.on('blur', () => {
            // Delay hiding to allow clicks on menu
            setTimeout(() => {
                // simple delay
            }, 200);
        });

        return () => {
            editor.off('selectionUpdate', updateMenu);
        };
    }, [editor]);

    if (!isVisible) return null;

    const toggleLink = () => {
        if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
            return;
        }
        setShowLinkInput(true);
        setShowColorMenu(false);
        setLinkUrl('');
    };

    const toggleColorMenu = () => {
        setShowColorMenu(!showColorMenu);
        setShowLinkInput(false);
    }

    const setTextColor = (color: string) => {
        editor.chain().focus().setColor(color).run();
        setShowColorMenu(false);
    }

    const setLink = () => {
        if (linkUrl) {
            editor.chain().focus().setLink({ href: linkUrl }).run();
            setShowLinkInput(false);
        }
    };

    const colors = ['#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

    return (
        <div
            className="fixed z-[100000] flex items-center gap-1 p-1 rounded-lg bg-card border border-surface shadow-xl pointer-events-auto transform -translate-x-1/2 -translate-y-full mb-2"
            style={{ top: position.top, left: position.left }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            {showLinkInput ? (
                <div className="flex items-center gap-1 p-1">
                    <input
                        type="text"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="text-sm p-1 rounded border border-surface bg-transparent text-main w-40"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && setLink()}
                    />
                    <button onClick={setLink} className="p-1 hover:bg-surface-hover rounded text-success">
                        <check size={14} />
                    </button>
                    <button onClick={() => setShowLinkInput(false)} className="p-1 hover:bg-surface-hover rounded text-muted">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                </div>
            ) : showColorMenu ? (
                <div className="flex items-center gap-1 p-1">
                    <button
                        onClick={() => editor.chain().focus().unsetColor().run()}
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded hover:bg-surface-hover text-main border border-black/10"
                        title="Reset Color"
                    >
                        Auto
                    </button>
                    {colors.map(color => (
                        <button
                            key={color}
                            onClick={() => setTextColor(color)}
                            className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                        />
                    ))}
                    <div className="relative w-5 h-5 rounded-full overflow-hidden border border-surface">
                        <input
                            type="color"
                            onChange={(e) => setTextColor(e.target.value)}
                            className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer"
                        />
                    </div>
                    <button onClick={() => setShowColorMenu(false)} className="p-1 hover:bg-surface-hover rounded text-muted ml-1">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                </div>
            ) : (
                <>
                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('bold') ? 'text-primary' : 'text-muted'}`}
                    >
                        <Bold size={16} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('italic') ? 'text-primary' : 'text-muted'}`}
                    >
                        <Italic size={16} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('underline') ? 'text-primary' : 'text-muted'}`}
                    >
                        <Underline size={16} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('strike') ? 'text-primary' : 'text-muted'}`}
                    >
                        <Strikethrough size={16} />
                    </button>

                    <div className="w-px h-4 bg-surface-border mx-1" />

                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('heading', { level: 2 }) ? 'text-primary' : 'text-muted'}`}
                    >
                        <Heading2 size={16} />
                    </button>

                    <button
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('code') ? 'text-primary' : 'text-muted'}`}
                    >
                        <Code size={16} />
                    </button>

                    <button
                        onClick={toggleColorMenu}
                        className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.getAttributes('textStyle').color ? 'text-primary' : 'text-muted'}`}
                    >
                        <span className="font-serif font-bold text-lg" style={{ color: editor.getAttributes('textStyle').color }}>A</span>
                    </button>

                    <button
                        onClick={toggleLink}
                        className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${editor.isActive('link') ? 'text-primary' : 'text-muted'}`}
                    >
                        <LinkIcon size={16} />
                    </button>
                </>
            )}
        </div>
    );
};
