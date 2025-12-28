import React from 'react';
import { useLocation } from 'react-router-dom';
import { useHelpCenter } from '../../context/HelpCenterContext';
import { getHelpTargetForPath } from './helpCenterContent';

export const HelpCenterFloatingButton = () => {
    const location = useLocation();
    const { openHelpCenter } = useHelpCenter();

    const handleOpen = () => {
        openHelpCenter(getHelpTargetForPath(location.pathname));
    };

    return (
        <button
            type="button"
            onClick={handleOpen}
            className="
                fixed bottom-6 right-6 z-[80]
                flex items-center gap-2 px-4 py-2 rounded-full
                bg-[var(--color-primary)] text-[var(--color-primary-text)]
                shadow-lg hover:opacity-90 transition-opacity
            "
            aria-label="Open help center"
        >
            <span className="material-symbols-outlined text-[18px]">help</span>
            <span className="text-xs font-semibold tracking-wide">Help</span>
        </button>
    );
};
