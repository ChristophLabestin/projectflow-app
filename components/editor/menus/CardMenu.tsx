import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Check, Save, Settings2, BoxSelect, Maximize, Minimize, Columns, LayoutGrid } from 'lucide-react';

interface CardMenuProps {
    editor: Editor;
}

// Helper to parse "10px 20px 30px 40px" or "10px" into object
const parseFourValues = (value: string | undefined) => {
    if (!value) return { t: '', r: '', b: '', l: '' }; // default empty
    const parts = value.split(' ');

    // CSS Order: Top, Right, Bottom, Left
    if (parts.length === 1) return { t: parts[0], r: parts[0], b: parts[0], l: parts[0] };
    if (parts.length === 2) return { t: parts[0], r: parts[1], b: parts[0], l: parts[1] };
    if (parts.length === 3) return { t: parts[0], r: parts[1], b: parts[2], l: parts[1] };
    if (parts.length === 4) return { t: parts[0], r: parts[1], b: parts[2], l: parts[3] };
    return { t: '', r: '', b: '', l: '' };
};

const formatFourValues = (vals: { t: string, r: string, b: string, l: string }) => {
    // Basic optimization: if all same, return one value
    if (vals.t === vals.r && vals.t === vals.b && vals.t === vals.l) return vals.t;
    // If TB and RL same: "10px 20px"
    if (vals.t === vals.b && vals.r === vals.l) return `${vals.t} ${vals.r}`;
    return `${vals.t} ${vals.r} ${vals.b} ${vals.l}`;
};

// Check if all values are basically the same
const areValuesUnified = (vals: { t: string, r: string, b: string, l: string }) => {
    return vals.t === vals.r && vals.t === vals.b && vals.t === vals.l;
};

export const CardMenu: React.FC<CardMenuProps> = ({ editor }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    // Form states
    const [presetName, setPresetName] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);

    // Attributes
    const [localPadding, setLocalPadding] = useState({ t: '', r: '', b: '', l: '' });
    const [localRadius, setLocalRadius] = useState({ t: '', r: '', b: '', l: '' });

    // UI Toggles
    const [isUnifiedPadding, setIsUnifiedPadding] = useState(true);
    const [isUnifiedRadius, setIsUnifiedRadius] = useState(true);

    const updateMenu = () => {
        if (!editor) return;

        // If menu inputs are focused, we skip updates to prevent overwriting user input
        // This effectively 'pauses' the menu syncing while the user types
        if (menuRef.current?.contains(document.activeElement)) {
            return;
        }

        if (!editor.isActive('card')) {
            if (isVisible) setIsVisible(false);
            return;
        }

        const { state, view } = editor;
        const { selection } = state;
        const { $from } = selection;

        // Find card node position
        let cardPos = -1;
        for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'card') {
                cardPos = $from.before(d);
                break;
            }
        }

        if (cardPos !== -1) {
            // Found a card, and we are not focused in the menu.
            // Sync state from editor to local forms.
            const { padding, borderRadius } = editor.getAttributes('card');

            // Padding
            const pVals = parseFourValues(padding || '16px');
            setLocalPadding(pVals);
            setIsUnifiedPadding(areValuesUnified(pVals));

            // BorderRadius
            const rVals = parseFourValues(borderRadius || '8px');
            setLocalRadius(rVals);
            setIsUnifiedRadius(areValuesUnified(rVals));

            // Position
            const nodeDOM = view.nodeDOM(cardPos) as HTMLElement;
            if (nodeDOM) {
                const rect = nodeDOM.getBoundingClientRect();
                setPosition({
                    top: rect.top - 10,
                    left: rect.left
                });
                if (!isVisible) setIsVisible(true);
            }
        } else {
            if (isVisible) setIsVisible(false);
        }
    };

    useEffect(() => {
        editor.on('selectionUpdate', updateMenu);
        editor.on('update', updateMenu);
        // Removing 'focus' listener as it causes unnecessary re-syncs when focusing back from inputs
        editor.on('blur', updateMenu);
        // We also want to listen to scrolling to update position if needed,
        // though Tiptap usually handles this via 'update' or we might need specific scroll listener.
        // For now standard events are enough.

        return () => {
            editor.off('selectionUpdate', updateMenu);
            editor.off('update', updateMenu);
            // editor.off('focus', updateMenu);
            editor.off('blur', updateMenu);
        };
    }, [editor, isVisible]); // isVisible dependency ensures we can toggle visibility state correctly

    // if (!isVisible) return null; // Removed to prevent unmounting/remounting which kills focus

    const attrs = editor.getAttributes('card');
    const { backgroundColor, textColor, borderColor } = attrs;

    // ... (rest of logic)

    return (
        <div
            ref={menuRef}
            className={`fixed z-[100000] flex flex-col gap-2 p-3 rounded-lg bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-xl w-96 transition-opacity duration-100 ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            style={{
                top: position.top,
                left: position.left,
                transform: 'translateY(-100%)',
            }}
        >
            style={{
                top: position.top,
                left: position.left,
                transform: 'translateY(-100%)',
            }}
        >
            <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1">Card Style</div>

            {/* Colors Row */}
            <div className="flex gap-2 mb-2">
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Background</div>
                    <div className="flex flex-wrap gap-1.5">
                        {colors.slice(0, 5).map(color => (
                            <button
                                key={color}
                                onClick={() => updateAttribute('backgroundColor', color)}
                                className={`w-5 h-5 shrink-0 rounded-full border border-black/10 hover:scale-110 transition-transform ${backgroundColor === color ? 'ring-1 ring-[var(--color-primary)]' : ''}`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                        <div className="relative w-5 h-5 shrink-0 rounded-full overflow-hidden border border-[var(--color-surface-border)]">
                            <input
                                type="color"
                                value={backgroundColor || '#f3f4f6'}
                                onChange={(e) => updateAttribute('backgroundColor', e.target.value)}
                                className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <div className="w-px bg-[var(--color-surface-border)] shrink-0" />

                <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Border</div>
                    <div className="flex flex-wrap gap-1.5">
                        {colors.slice(0, 5).map(color => (
                            <button
                                key={color}
                                onClick={() => updateAttribute('borderColor', color)}
                                className={`w-5 h-5 shrink-0 rounded-full border-2 hover:scale-110 transition-transform ${borderColor === color ? 'ring-1 ring-[var(--color-primary)]' : 'border-black/10'}`}
                                style={{ borderColor: color, backgroundColor: 'transparent' }}
                            />
                        ))}
                        <div className="relative w-5 h-5 shrink-0 rounded-full overflow-hidden border-2 border-[var(--color-surface-border)]">
                            <input
                                type="color"
                                value={borderColor || '#e5e7eb'}
                                onChange={(e) => updateAttribute('borderColor', e.target.value)}
                                className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <div className="w-px bg-[var(--color-surface-border)] shrink-0" />

                <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Text</div>
                    <div className="flex flex-wrap gap-1.5">
                        {textColors.slice(0, 5).map(color => (
                            <button
                                key={color}
                                onClick={() => updateAttribute('textColor', color)}
                                className={`w-5 h-5 shrink-0 rounded-full border border-black/10 hover:scale-110 transition-transform flex items-center justify-center ${textColor === color ? 'ring-1 ring-[var(--color-primary)]' : ''}`}
                                style={{ backgroundColor: color === 'inherit' ? 'transparent' : color }}
                            >
                                {color === 'inherit' && <span className="text-[8px] font-bold text-[var(--color-text-muted)]">A</span>}
                            </button>
                        ))}
                        <div className="relative w-5 h-5 shrink-0 rounded-full overflow-hidden border border-[var(--color-surface-border)]">
                            <input
                                type="color"
                                value={textColor && textColor !== 'inherit' ? textColor : '#000000'}
                                onChange={(e) => updateAttribute('textColor', e.target.value)}
                                className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-px bg-[var(--color-surface-border)] my-1" />

            {/* Radius Control */}
            <div className="mb-2">
                <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-1">
                    <div className="flex items-center gap-1">
                        <Maximize size={10} />
                        <span className="text-[10px]">Corner Radius</span>
                    </div>
                    <button
                        onClick={() => setIsUnifiedRadius(!isUnifiedRadius)}
                        className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-muted)]"
                        title={isUnifiedRadius ? "Enter individual corners" : "Unified corners"}
                    >
                        {isUnifiedRadius ? <Columns size={10} /> : <LayoutGrid size={10} />}
                    </button>
                </div>

                {isUnifiedRadius ? (
                    <input
                        type="text"
                        value={localRadius.t}
                        onChange={(e) => handleUnifiedChange('radius', e.target.value)}
                        onBlur={commitRadius}
                        onKeyDown={(e) => e.key === 'Enter' && commitRadius()}
                        className="w-full p-1 text-[10px] rounded border border-[var(--color-surface-border)] bg-transparent text-center focus:border-[var(--color-primary)] outline-none"
                        placeholder="e.g. 8px"
                    />
                ) : (
                    <div className="grid grid-cols-4 gap-1">
                        {['t', 'r', 'b', 'l'].map((key) => (
                            <div key={`radius-${key}`} className="flex flex-col items-center">
                                <span className="text-[8px] text-[var(--color-text-muted)] uppercase mb-0.5">{key === 't' ? 'TL' : key === 'r' ? 'TR' : key === 'b' ? 'BR' : 'BL'}</span>
                                <input
                                    type="text"
                                    value={(localRadius as any)[key]}
                                    onChange={(e) => setLocalRadius({ ...localRadius, [key]: e.target.value })}
                                    onBlur={commitRadius}
                                    onKeyDown={(e) => e.key === 'Enter' && commitRadius()}
                                    className="w-full p-1 text-[10px] rounded border border-[var(--color-surface-border)] bg-transparent text-center focus:border-[var(--color-primary)] outline-none"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Padding Control */}
            <div className="mb-2">
                <div className="flex items-center justify-between text-[var(--color-text-muted)] mb-1">
                    <div className="flex items-center gap-1">
                        <BoxSelect size={10} />
                        <span className="text-[10px]">Padding</span>
                    </div>
                    <button
                        onClick={() => setIsUnifiedPadding(!isUnifiedPadding)}
                        className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-muted)]"
                        title={isUnifiedPadding ? "Enter individual sides" : "Unified padding"}
                    >
                        {isUnifiedPadding ? <Columns size={10} /> : <LayoutGrid size={10} />}
                    </button>
                </div>

                {isUnifiedPadding ? (
                    <input
                        type="text"
                        value={localPadding.t}
                        onChange={(e) => handleUnifiedChange('padding', e.target.value)}
                        onBlur={commitPadding}
                        onKeyDown={(e) => e.key === 'Enter' && commitPadding()}
                        className="w-full p-1 text-[10px] rounded border border-[var(--color-surface-border)] bg-transparent text-center focus:border-[var(--color-primary)] outline-none"
                        placeholder="e.g. 16px"
                    />
                ) : (
                    <div className="grid grid-cols-4 gap-1">
                        {['t', 'r', 'b', 'l'].map((key) => (
                            <div key={`padding-${key}`} className="flex flex-col items-center">
                                <span className="text-[8px] text-[var(--color-text-muted)] uppercase mb-0.5">{key.toUpperCase()}</span>
                                <input
                                    type="text"
                                    value={(localPadding as any)[key]}
                                    onChange={(e) => setLocalPadding({ ...localPadding, [key]: e.target.value })}
                                    onBlur={commitPadding}
                                    onKeyDown={(e) => e.key === 'Enter' && commitPadding()}
                                    className="w-full p-1 text-[10px] rounded border border-[var(--color-surface-border)] bg-transparent text-center focus:border-[var(--color-primary)] outline-none"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>


            {/* Presets */}
            {!showSaveInput ? (
                <button
                    onClick={() => setShowSaveInput(true)}
                    className="flex items-center gap-2 text-xs text-[var(--color-primary)] font-medium hover:bg-[var(--color-surface-hover)] p-1 rounded w-full justify-center mt-1"
                >
                    <Save size={14} />
                    <span>Save Preset</span>
                </button>
            ) : (
                <div className="flex gap-2 mt-1">
                    <input
                        type="text"
                        placeholder="Name..."
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        className="flex-1 text-xs p-1 rounded border border-[var(--color-surface-border)] text-[var(--color-text-main)] bg-transparent"
                    />
                    <button
                        onClick={handleSavePreset}
                        className="p-1.5 text-white bg-[var(--color-primary)] rounded hover:bg-[var(--color-primary-light)]"
                    >
                        <Check size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};
