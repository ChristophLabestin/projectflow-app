import React, { memo, useState } from 'react';
import { useMindmap, LayoutType } from './hooks/useMindmapStore';

// ============================================================================
// Layout Options
// ============================================================================

const LAYOUT_OPTIONS: { value: LayoutType; label: string; icon: string }[] = [
    { value: 'radial', label: 'Radial', icon: 'blur_circular' },
    { value: 'force', label: 'Force', icon: 'grain' },
    { value: 'tree-vertical', label: 'Tree (V)', icon: 'account_tree' },
    { value: 'tree-horizontal', label: 'Tree (H)', icon: 'format_indent_increase' },
    { value: 'grid', label: 'Grid', icon: 'grid_view' },
];

// ============================================================================
// Toolbar Button Component
// ============================================================================

interface ToolbarButtonProps {
    icon: string;
    label?: string;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
    tooltip?: string;
    variant?: 'default' | 'danger';
}

const ToolbarButton = memo(function ToolbarButton({
    icon, label, onClick, active, disabled, tooltip, variant = 'default'
}: ToolbarButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={tooltip}
            className={`
                flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all
                ${active
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : variant === 'danger'
                        ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                        : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                }
                ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
        >
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            {label && <span className="hidden sm:inline">{label}</span>}
        </button>
    );
});

// ============================================================================
// Toolbar Divider
// ============================================================================

const ToolbarDivider = () => (
    <div className="w-px h-6 bg-[var(--color-surface-border)] mx-1" />
);

// ============================================================================
// Layout Dropdown
// ============================================================================

interface LayoutDropdownProps {
    value: LayoutType;
    onChange: (layout: LayoutType) => void;
}

const LayoutDropdown = memo(function LayoutDropdown({ value, onChange }: LayoutDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const current = LAYOUT_OPTIONS.find(o => o.value === value) || LAYOUT_OPTIONS[0];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all
                    text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]"
            >
                <span className="material-symbols-outlined text-[18px] text-indigo-500">{current.icon}</span>
                <span className="hidden sm:inline">{current.label}</span>
                <span className="material-symbols-outlined text-[14px] text-[var(--color-text-muted)]">expand_more</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 py-1.5 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-xl z-50 min-w-[160px]">
                        {LAYOUT_OPTIONS.map(option => (
                            <button
                                key={option.value}
                                onClick={() => { onChange(option.value); setIsOpen(false); }}
                                className={`
                                    w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                                    ${option.value === value
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                        : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                    }
                                `}
                            >
                                <span className="material-symbols-outlined text-[16px]">{option.icon}</span>
                                {option.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
});

// ============================================================================
// Main Toolbar Component
// ============================================================================

interface MindmapToolbarProps {
    onAutoGroup?: () => void;
    onFitView?: () => void;
    onLayoutChange?: (layout: LayoutType) => void;
    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
    isAiLoading?: boolean;
}

export const MindmapToolbar = memo(function MindmapToolbar({
    onAutoGroup,
    onFitView,
    onLayoutChange,
    onToggleFullscreen,
    isFullscreen,
    isAiLoading,
}: MindmapToolbarProps) {
    const {
        state,
        setZoom,
        toggleMinimap,
        toggleGrid,
        setLayout,
        undo,
        redo,
        canUndo,
        canRedo,
        deleteSelectedNodes,
    } = useMindmap();

    const hasSelection = state.selectedNodeIds.size > 0;

    return (
        <div className="absolute top-4 left-4 z-30 flex flex-wrap gap-2">
            {/* Navigation Group */}
            <div className="flex items-center gap-0.5 p-1.5 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-md">
                <ToolbarButton
                    icon="remove"
                    onClick={() => setZoom(state.zoom - 0.15)}
                    tooltip="Zoom Out (-)"
                />
                <span className="px-2 text-xs font-mono text-[var(--color-text-muted)] min-w-[40px] text-center">
                    {Math.round(state.zoom * 100)}%
                </span>
                <ToolbarButton
                    icon="add"
                    onClick={() => setZoom(state.zoom + 0.15)}
                    tooltip="Zoom In (+)"
                />
                <ToolbarDivider />
                <ToolbarButton
                    icon="fit_screen"
                    onClick={onFitView}
                    tooltip="Fit View (0)"
                />
                <ToolbarDivider />
                <ToolbarButton
                    icon={isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                    onClick={onToggleFullscreen}
                    active={isFullscreen}
                    tooltip={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen (F)'}
                />
            </div>

            {/* Layout Group */}
            <div className="flex items-center gap-0.5 p-1.5 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-md">
                <LayoutDropdown
                    value={state.activeLayout}
                    onChange={onLayoutChange || setLayout}
                />
            </div>

            {/* AI Group */}
            <div className="flex items-center gap-0.5 p-1.5 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-md">
                <ToolbarButton
                    icon={isAiLoading ? 'progress_activity' : 'auto_awesome'}
                    label="Auto-group"
                    onClick={onAutoGroup || (() => { })}
                    disabled={isAiLoading}
                    tooltip="CORA Auto-group"
                />
            </div>

            {/* History Group */}
            <div className="flex items-center gap-0.5 p-1.5 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-md">
                <ToolbarButton
                    icon="undo"
                    onClick={undo}
                    disabled={!canUndo}
                    tooltip="Undo (⌘Z)"
                />
                <ToolbarButton
                    icon="redo"
                    onClick={redo}
                    disabled={!canRedo}
                    tooltip="Redo (⌘⇧Z)"
                />
            </div>

            {/* View Toggles */}
            <div className="flex items-center gap-0.5 p-1.5 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-md">
                <ToolbarButton
                    icon="grid_4x4"
                    onClick={toggleGrid}
                    active={state.isGridVisible}
                    tooltip="Toggle Grid"
                />
                <ToolbarButton
                    icon="map"
                    onClick={toggleMinimap}
                    active={state.isMinimapVisible}
                    tooltip="Toggle Navigator"
                />
            </div>

            {/* Selection Actions */}
            {hasSelection && (
                <div className="flex items-center gap-0.5 p-1.5 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 shadow-md">
                    <span className="px-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        {state.selectedNodeIds.size} selected
                    </span>
                    <ToolbarButton
                        icon="delete"
                        onClick={deleteSelectedNodes}
                        tooltip="Delete Selected (Del)"
                        variant="danger"
                    />
                </div>
            )}
        </div>
    );
});

export default MindmapToolbar;
