import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import type { HelpCenterPageProps, HelpCenterSectionsBuilder } from '../helpCenterTypes';
import { splitHelpKeywords } from '../helpCenterContent';

const SECTION_IDS = ['blog-connection', 'blog-posts'] as const;

export const getMarketingSections: HelpCenterSectionsBuilder = t =>
    SECTION_IDS.map(id => ({
        id,
        title: t(`help.marketing.sections.${id}.title`),
        summary: t(`help.marketing.sections.${id}.summary`),
        content: t(`help.marketing.sections.${id}.content`),
        keywords: splitHelpKeywords(t(`help.marketing.sections.${id}.keywords`))
    }));

const StepBlock = ({ step, title, children }: { step: string; title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-surface bg-card p-5">
        <div className="flex items-center justify-between mb-3"><span className="text-sm font-bold text-main">{title}</span><span className="px-2 py-0.5 rounded-full bg-surface-hover text-[10px] font-bold text-muted">{step}</span></div>
        <p className="text-sm text-muted leading-relaxed">{children}</p>
    </div>
);

export const MarketingPage = (_props: HelpCenterPageProps) => {
    const { t } = useLanguage();
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.marketing.hero.eyebrow')}</div>
                <h2 className="text-3xl font-bold text-main mt-3">{t('help.marketing.hero.title')}</h2>
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">{t('help.marketing.hero.description')}</p>
            </div>

            <section data-section-id="blog-connection" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.marketing.connection.eyebrow')}</div><h3 className="text-xl font-bold text-main mt-2">{t('help.marketing.connection.title')}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StepBlock step={t('help.marketing.connection.step1.badge')} title={t('help.marketing.connection.step1.title')}>{t('help.marketing.connection.step1.description')}</StepBlock>
                    <StepBlock step={t('help.marketing.connection.step2.badge')} title={t('help.marketing.connection.step2.title')}>{t('help.marketing.connection.step2.description')}</StepBlock>
                </div>
            </section>

            <section data-section-id="blog-posts" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.marketing.posts.eyebrow')}</div><h3 className="text-xl font-bold text-main mt-2">{t('help.marketing.posts.title')}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StepBlock step={t('help.marketing.posts.write.badge')} title={t('help.marketing.posts.write.title')}>{t('help.marketing.posts.write.description')}</StepBlock>
                    <StepBlock step={t('help.marketing.posts.categorize.badge')} title={t('help.marketing.posts.categorize.title')}>{t('help.marketing.posts.categorize.description')}</StepBlock>
                    <StepBlock step={t('help.marketing.posts.publish.badge')} title={t('help.marketing.posts.publish.title')}>{t('help.marketing.posts.publish.description')}</StepBlock>
                </div>
            </section>
        </div>
    );
};
