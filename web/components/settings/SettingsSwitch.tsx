import React from 'react';

interface SettingsSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** Accessible name (required: the switch itself has no visible text). */
    label: string;
    disabled?: boolean;
}

/** Accessible on/off switch (`role="switch"`) for settings rows. */
export const SettingsSwitch: React.FC<SettingsSwitchProps> = ({ checked, onChange, label, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`settings-switch ${checked ? 'is-on' : ''}`.trim()}
        onClick={() => onChange(!checked)}
    >
        <span className="settings-switch__thumb" aria-hidden="true" />
    </button>
);
