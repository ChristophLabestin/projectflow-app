import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export const AIStudioHero = () => {
    const { t } = useLanguage();

    return (
        <div className="ai-studio-hero">
            <div className="ai-studio-hero__orb ai-studio-hero__orb--primary" />
            <div className="ai-studio-hero__orb ai-studio-hero__orb--soft" />

            <div className="ai-studio-hero__content">
                <div className="ai-studio-hero__badge">
                    <span className="material-symbols-outlined">auto_awesome</span>
                    {t('aiStudio.hero.badge')}
                </div>

                <h1 className="ai-studio-hero__title">
                    {t('aiStudio.hero.titlePrefix')}{' '}
                    <span className="ai-studio-hero__title-highlight animate-gradient-xy">{t('aiStudio.hero.titleHighlight')}</span>.
                </h1>

                <p className="ai-studio-hero__subtitle">
                    {t('aiStudio.hero.subtitle')}
                </p>
            </div>

            <div className="ai-studio-hero__icon">
                <span className="material-symbols-outlined">architecture</span>
            </div>
        </div>
    );
};
