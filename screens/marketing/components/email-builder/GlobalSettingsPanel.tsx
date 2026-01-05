import React from 'react';
import {
    SettingsGroup,
    SliderInput,
    ColorPicker,
    ControlRow,
    SegmentedControl,
} from './StyleControls';

interface GlobalSettings {
    canvasWidth: number;
    backgroundColor: string;
    fontFamily: string;
    primaryColor: string;
}

interface GlobalSettingsPanelProps {
    settings: GlobalSettings;
    onChange: (settings: GlobalSettings) => void;
    viewMode: 'desktop' | 'mobile';
    onViewModeChange: (mode: 'desktop' | 'mobile') => void;
}

export const GlobalSettingsPanel = ({ settings, onChange, viewMode, onViewModeChange }: GlobalSettingsPanelProps) => {
    const handleChange = (key: keyof GlobalSettings, value: any) => {
        onChange({ ...settings, [key]: value });
    };

    return (
        <div className="h-full bg-surface-paper border-l border-surface shadow-xl overflow-y-auto custom-scrollbar w-[320px]">

            {/* Header */}
            <header className="px-5 py-4 border-b border-surface bg-card">
                <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/5 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-xl">settings</span>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-main">Global Settings</h2>
                        <p className="text-[10px] text-muted uppercase tracking-wider">Canvas & Theme Defaults</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main>
                <SettingsGroup title="Canvas" defaultOpen={true}>
                    <SegmentedControl
                        label="View Mode"
                        value={viewMode}
                        onChange={onViewModeChange}
                        options={[
                            { value: 'desktop', icon: 'desktop_windows', ariaLabel: 'Desktop View', text: 'Desktop' },
                            { value: 'mobile', icon: 'smartphone', ariaLabel: 'Mobile View', text: 'Mobile' }
                        ]}
                    />
                    <SliderInput
                        label="Width"
                        value={settings.canvasWidth}
                        onChange={(v) => handleChange('canvasWidth', v)}
                        min={320}
                        max={900}
                        step={10}
                    />
                    <div className="flex justify-between text-[10px] text-zinc-400 font-mono -mt-2">
                        <span>Mobile (320)</span>
                        <span>Desktop (900)</span>
                    </div>
                    <ColorPicker
                        label="Background"
                        value={settings.backgroundColor}
                        onChange={(v) => handleChange('backgroundColor', v)}
                    />
                </SettingsGroup>

                <SettingsGroup title="Typography" defaultOpen={true}>
                    <ControlRow label="Font Family" htmlFor="global-font">
                        <select
                            id="global-font"
                            value={settings.fontFamily}
                            onChange={(e) => handleChange('fontFamily', e.target.value)}
                            className="w-full max-w-[180px] px-2.5 py-2 text-xs rounded-lg bg-surface-sunken border border-surface focus:border-primary outline-none"
                        >
                            <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">System UI</option>
                            <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="'Courier New', monospace">Courier</option>
                            <option value="'Inter', sans-serif">Inter</option>
                            <option value="'Roboto', sans-serif">Roboto</option>
                        </select>
                    </ControlRow>
                </SettingsGroup>

                <SettingsGroup title="Theme Colors" defaultOpen={true}>
                    <ColorPicker
                        label="Primary Color"
                        value={settings.primaryColor}
                        onChange={(v) => handleChange('primaryColor', v)}
                    />
                    <div className="p-3 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                        <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                            The primary color is used for buttons, links, and highlights throughout your email.
                        </p>
                    </div>
                </SettingsGroup>
            </main>
        </div>
    );
};
