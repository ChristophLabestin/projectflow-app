import React from 'react';
import { useHelpCenter } from '../../context/HelpCenterContext';
import { useLanguage } from '../../context/LanguageContext';
import './help-center.scss';

/** Help entry point on public routes (no top bar there). */
export const HelpCenterFloatingButton = () => {
    const { openHelpCenter } = useHelpCenter();
    const { t } = useLanguage();

    return (
        <button type="button" onClick={() => openHelpCenter()} className="help-fab" aria-label={t('help.openAria')}>
            <span className="material-symbols-outlined" aria-hidden="true">help</span>
            <span>{t('help.open')}</span>
        </button>
    );
};
