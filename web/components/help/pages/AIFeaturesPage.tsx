import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import type { HelpCenterPageProps, HelpCenterSectionsBuilder } from '../helpCenterTypes';
import { splitHelpKeywords } from '../helpCenterContent';

const SECTION_IDS = ['ai-capabilities', 'ai-locations', 'prompt-engineering', 'image-generation', 'token-usage', 'quality-validation'] as const;

export const getAiFeaturesSections: HelpCenterSectionsBuilder = t =>
    SECTION_IDS.map(id => ({
        id,
        title: t(`help.aiFeatures.sections.${id}.title`),
        summary: t(`help.aiFeatures.sections.${id}.summary`),
        content: t(`help.aiFeatures.sections.${id}.content`),
        keywords: splitHelpKeywords(t(`help.aiFeatures.sections.${id}.keywords`))
    }));

const CapabilityCard = ({ icon, name, description, location }: { icon: string; name: string; description: string; location: string }) => (
    <div className="rounded-2xl border border-surface bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-violet)] to-[var(--brand-blue)] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-on-primary">{icon}</span>
            </div>
            <div><div className="text-sm font-bold text-main">{name}</div><div className="text-[10px] text-muted">{location}</div></div>
        </div>
        <p className="text-sm text-muted leading-relaxed">{description}</p>
    </div>
);

const ModuleAICard = ({ icon, module, features, color }: { icon: string; module: string; features: string[]; color: string }) => (
    <div className="rounded-2xl border border-surface bg-card p-5">
        <div className="flex items-center gap-3 mb-3"><div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}><span className="material-symbols-outlined text-[20px] text-on-primary">{icon}</span></div><span className="text-base font-bold text-main">{module}</span></div>
        <div className="space-y-2">{features.map((f, i) => <div key={i} className="text-sm text-muted flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" />{f}</div>)}</div>
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = {
        tip: 'border-[rgba(var(--brand-amber-rgb),0.3)] bg-[rgba(var(--brand-amber-rgb),0.1)] text-[var(--brand-amber-text)]',
        warning: 'border-[rgba(var(--status-blocked-rgb),0.3)] bg-[rgba(var(--status-blocked-rgb),0.1)] text-[var(--color-status-blocked-text)]',
        info: 'border-[rgba(var(--brand-blue-rgb),0.3)] bg-[rgba(var(--brand-blue-rgb),0.1)] text-[var(--brand-blue-text)]'
    };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}><div className="flex items-start gap-2"><span className="material-symbols-outlined text-[18px]">{icons[type]}</span><div>{children}</div></div></div>;
};

const CAPABILITIES = [
    { id: 'swot', icon: 'analytics', locationKey: 'help.aiFeatures.capabilities.locationFlowsStudio' },
    { id: 'blueprint', icon: 'architecture', locationKey: 'help.aiFeatures.capabilities.locationFlowsStudio' },
    { id: 'risk', icon: 'warning', locationKey: 'help.aiFeatures.capabilities.locationStudio' },
    { id: 'search', icon: 'search', locationKey: 'help.aiFeatures.capabilities.locationSearch' },
    { id: 'image', icon: 'image', locationKey: 'help.aiFeatures.capabilities.locationMedia' }
];

const MODULES = [
    { id: 'flows', icon: 'flow_chart', color: 'bg-[var(--brand-blue)]', features: ['swot', 'blueprint', 'risk', 'discovery'] },
    { id: 'media', icon: 'photo_library', color: 'bg-[var(--brand-violet)]', features: ['image', 'style', 'variations'] },
    { id: 'search', icon: 'search', color: 'bg-[var(--brand-green)]', features: ['answers', 'context'] }
];

const DO_ITEMS = ['specific', 'format', 'examples', 'iterate'];
const AVOID_ITEMS = ['vague', 'context', 'perfect', 'review'];
const PROMPT_PARTS = ['subject', 'style', 'mood', 'details'];
const SIZES = [
    { id: 'square', dims: '1024×1024' },
    { id: 'landscape', dims: '1792×1024' },
    { id: 'portrait', dims: '1024×1792' }
];
const CONSUMPTION = [
    { id: 'swot', amount: '~2K' },
    { id: 'blueprint', amount: '~3K' },
    { id: 'caption', amount: '~500' },
    { id: 'search', amount: '~1K' },
    { id: 'image', amount: null }
];
const QUOTA_ITEMS = [
    { id: 'reset', icon: 'refresh' },
    { id: 'view', icon: 'settings' },
    { id: 'warnings', icon: 'warning' }
];
const VALIDATION_STEPS = ['accuracy', 'crossReference', 'tone', 'teamInput', 'iterate'];

export const AIFeaturesPage = (_props: HelpCenterPageProps) => {
    const { t } = useLanguage();
    const p = 'help.aiFeatures.';
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[rgba(var(--brand-violet-rgb),0.1)] via-[var(--color-surface-card)] to-[rgba(var(--brand-blue-rgb),0.1)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}hero.eyebrow`)}</div>
                <h2 className="text-3xl font-bold text-main mt-3">{t(`${p}hero.title`)}</h2>
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">{t(`${p}hero.description`)}</p>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-xl bg-card border border-surface p-3 text-center"><div className="text-2xl font-bold text-primary">12+</div><div className="text-xs text-muted">{t(`${p}hero.statTools`)}</div></div>
                    <div className="rounded-xl bg-card border border-surface p-3 text-center"><div className="text-2xl font-bold text-[var(--brand-violet-text)]">6</div><div className="text-xs text-muted">{t(`${p}hero.statModules`)}</div></div>
                    <div className="rounded-xl bg-card border border-surface p-3 text-center"><div className="text-2xl font-bold text-[var(--brand-blue-text)]">∞</div><div className="text-xs text-muted">{t(`${p}hero.statStyles`)}</div></div>
                    <div className="rounded-xl bg-card border border-surface p-3 text-center"><div className="text-2xl font-bold text-[var(--brand-amber-text)]">24/7</div><div className="text-xs text-muted">{t(`${p}hero.statAvailability`)}</div></div>
                </div>
            </div>

            <section data-section-id="ai-capabilities" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}capabilities.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}capabilities.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {CAPABILITIES.map(c => (
                        <CapabilityCard key={c.id} icon={c.icon} name={t(`${p}capabilities.${c.id}.name`)} description={t(`${p}capabilities.${c.id}.description`)} location={t(c.locationKey)} />
                    ))}
                </div>
            </section>

            <section data-section-id="ai-locations" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}modules.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}modules.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {MODULES.map(m => (
                        <ModuleAICard key={m.id} icon={m.icon} module={t(`${p}modules.${m.id}.name`)} color={m.color} features={m.features.map(f => t(`${p}modules.${m.id}.features.${f}`))} />
                    ))}
                </div>
            </section>

            <section data-section-id="prompt-engineering" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}prompts.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}prompts.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[rgba(var(--brand-green-rgb),0.3)] bg-[rgba(var(--brand-green-rgb),0.1)] p-4"><div className="text-xs font-bold text-[var(--brand-green-text)] mb-2">{t(`${p}prompts.doTitle`)}</div><ul className="space-y-2 text-sm text-[var(--brand-green-text)]">{DO_ITEMS.map(i => <li key={i}>{t(`${p}prompts.do.${i}`)}</li>)}</ul></div>
                    <div className="rounded-2xl border border-[rgba(var(--status-blocked-rgb),0.3)] bg-[rgba(var(--status-blocked-rgb),0.1)] p-4"><div className="text-xs font-bold text-[var(--color-status-blocked-text)] mb-2">{t(`${p}prompts.avoidTitle`)}</div><ul className="space-y-2 text-sm text-[var(--color-status-blocked-text)]">{AVOID_ITEMS.map(i => <li key={i}>{t(`${p}prompts.avoid.${i}`)}</li>)}</ul></div>
                </div>
                <Callout type="tip">{t(`${p}prompts.tip`)}</Callout>
            </section>

            <section data-section-id="image-generation" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}images.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}images.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-surface bg-surface p-5"><div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}images.structureTitle`)}</div><div className="space-y-2 text-sm text-muted">{PROMPT_PARTS.map(part => <div key={part}><span className="font-semibold text-main">{t(`${p}images.structure.${part}.label`)}</span> {t(`${p}images.structure.${part}.description`)}</div>)}</div></div>
                    <div className="rounded-2xl border border-surface bg-surface p-5"><div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}images.sizesTitle`)}</div><div className="space-y-2 text-sm">{SIZES.map(s => <div key={s.id} className="flex justify-between"><span className="text-main">{t(`${p}images.sizes.${s.id}`)}</span><span className="text-muted">{s.dims}</span></div>)}</div></div>
                </div>
            </section>

            <section data-section-id="token-usage" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}tokens.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}tokens.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-surface bg-card p-5"><div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}tokens.consumptionTitle`)}</div><div className="space-y-2 text-sm">{CONSUMPTION.map(c => <div key={c.id} className="flex justify-between"><span className="text-main">{t(`${p}tokens.consumption.${c.id}`)}</span><span className="px-2 py-0.5 rounded-full bg-[rgba(var(--brand-violet-rgb),0.1)] text-[var(--brand-violet-text)] text-xs font-bold">{c.amount ?? t(`${p}tokens.consumption.imageCost`)}</span></div>)}</div></div>
                    <div className="rounded-2xl border border-surface bg-card p-5"><div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}tokens.quotaTitle`)}</div><div className="space-y-3 text-sm text-muted">{QUOTA_ITEMS.map(q => <div key={q.id} className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-primary">{q.icon}</span>{t(`${p}tokens.quota.${q.id}`)}</div>)}</div></div>
                </div>
            </section>

            <section data-section-id="quality-validation" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}quality.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}quality.title`)}</h3></div>
                <div className="space-y-3">{VALIDATION_STEPS.map((s, i) => <div key={s} className="flex items-start gap-3"><div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-bold flex-shrink-0">{i + 1}</div><div className="rounded-xl border border-surface bg-surface p-3 flex-1"><div className="text-sm font-semibold text-main">{t(`${p}quality.steps.${s}.title`)}</div><div className="text-xs text-muted mt-1">{t(`${p}quality.steps.${s}.description`)}</div></div></div>)}</div>
                <Callout type="warning">{t(`${p}quality.warning`)}</Callout>
            </section>
        </div>
    );
};
