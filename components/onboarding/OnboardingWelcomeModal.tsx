import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';

type OnboardingWelcomeModalProps = {
    isOpen: boolean;
    title: string;
    description: string;
    onStart: () => void;
    onSkip: () => void;
};

export const OnboardingWelcomeModal = ({
    isOpen,
    title,
    description,
    onStart,
    onSkip
}: OnboardingWelcomeModalProps) => {
    const { t } = useLanguage();

    const summaryCards = [
        {
            title: t('onboarding.summary.momentum.title'),
            detail: t('onboarding.summary.momentum.detail')
        },
        {
            title: t('onboarding.summary.risks.title'),
            detail: t('onboarding.summary.risks.detail')
        },
        {
            title: t('onboarding.summary.action.title'),
            detail: t('onboarding.summary.action.detail')
        }
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onSkip}
            size="xl"
            hideHeader
            noPadding
        >
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,_#fff1e8_0%,_#fef3c7_35%,_#e0f2fe_70%,_#ffffff_100%)] dark:bg-[radial-gradient(circle_at_20%_10%,_#0b1220_0%,_#0f172a_40%,_#0b3b3a_100%)]" />
                <div className="absolute inset-0 opacity-70 bg-[linear-gradient(120deg,_rgba(15,23,42,0.05)_0%,_transparent_35%,_rgba(15,23,42,0.08)_70%,_transparent_100%)] dark:bg-[linear-gradient(120deg,_rgba(255,255,255,0.05)_0%,_transparent_40%,_rgba(255,255,255,0.06)_75%,_transparent_100%)]" />
                <div className="absolute -top-24 -right-28 size-96 rounded-full bg-amber-200/45 blur-3xl dark:bg-emerald-500/20" />
                <div className="absolute -bottom-40 -left-36 size-[520px] rounded-full bg-sky-200/35 blur-3xl dark:bg-cyan-500/15" />
                <div className="absolute top-8 right-16 h-10 w-24 rotate-[-18deg] rounded-full bg-white/70 shadow-sm dark:bg-slate-800/60" />
                <div className="absolute bottom-10 left-12 h-8 w-20 rotate-[12deg] rounded-full bg-white/70 shadow-sm dark:bg-slate-800/60" />

                <div className="relative grid lg:grid-cols-[1.25fr_0.75fr]">
                    <section className="px-6 py-8 sm:px-10 sm:py-12 space-y-8">
                        <div className="flex items-center justify-between gap-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.34em] text-slate-700 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100">
                                {t('onboarding.welcomePack')}
                            </div>
                            <button
                                type="button"
                                onClick={onSkip}
                                className="p-1 rounded-full bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
                                aria-label={t('onboarding.closeAria')}
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>

                        <div className="flex items-start gap-5">
                            <div className="size-16 rounded-[26px] bg-white shadow-xl flex items-center justify-center text-orange-500 dark:bg-slate-900/80 dark:text-amber-300">
                                <span className="material-symbols-outlined text-[28px]">celebration</span>
                            </div>
                            <div className="space-y-3">
                                <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                                    {t('onboarding.headerLabel')}
                                </div>
                                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight dark:text-white">
                                    {title}
                                </h2>
                                <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-xl dark:text-slate-200">
                                    {description}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            {summaryCards.map(item => (
                                <div key={item.title} className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.title}</div>
                                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">{item.detail}</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Button
                                size="lg"
                                onClick={onStart}
                                className="bg-gradient-to-r from-orange-400 via-amber-400 to-lime-400 text-slate-900 border-transparent shadow-lg shadow-orange-200/70 hover:opacity-90 dark:shadow-amber-500/20"
                                icon={<span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
                            >
                                {t('onboarding.start')}
                            </Button>
                            <Button variant="ghost" onClick={onSkip} className="border border-white/70 bg-white/80 dark:border-slate-700/70 dark:bg-slate-900/70">
                                {t('onboarding.skip')}
                            </Button>
                        </div>
                    </section>

                    <aside className="relative px-6 py-8 sm:px-10 sm:py-12 border-t border-[var(--color-surface-border)] bg-white/80 backdrop-blur-sm lg:border-t-0 lg:border-l dark:border-slate-700/70 dark:bg-slate-900/70">
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                            {t('onboarding.tourPreview')}
                        </div>
                        <div className="relative mt-6 h-[260px]">
                            <div className="absolute inset-x-0 top-0 rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4 shadow-md dark:border-slate-700/70 dark:bg-slate-900/60">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('onboarding.preview.kpi.title')}</div>
                                <div className="mt-2 flex items-center gap-3">
                                    <div className="h-2 w-16 rounded-full bg-emerald-400/70" />
                                    <div className="h-2 w-10 rounded-full bg-amber-400/80" />
                                    <div className="h-2 w-6 rounded-full bg-sky-400/80" />
                                </div>
                                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-300">
                                    {t('onboarding.preview.kpi.detail')}
                                </div>
                            </div>
                            <div className="absolute inset-x-4 top-20 -rotate-2 rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4 shadow-lg dark:border-slate-700/70 dark:bg-slate-900/60">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('onboarding.preview.focus.title')}</div>
                                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                                    <div className="rounded-lg bg-rose-100/80 p-2 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">{t('onboarding.preview.focus.urgent')}</div>
                                    <div className="rounded-lg bg-amber-100/80 p-2 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">{t('onboarding.preview.focus.soon')}</div>
                                    <div className="rounded-lg bg-emerald-100/80 p-2 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">{t('onboarding.preview.focus.onTrack')}</div>
                                </div>
                            </div>
                            <div className="absolute inset-x-8 top-[150px] rotate-2 rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4 shadow-md dark:border-slate-700/70 dark:bg-slate-900/60">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('onboarding.preview.projects.title')}</div>
                                <div className="mt-2 space-y-1 text-[11px] text-slate-500 dark:text-slate-300">
                                    <div>{t('onboarding.preview.projects.line1')}</div>
                                    <div>{t('onboarding.preview.projects.line2')}</div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4 text-xs text-[var(--color-text-muted)] leading-relaxed dark:border-slate-700/70 dark:bg-slate-900/60">
                            {t('onboarding.tip')}
                        </div>
                    </aside>
                </div>
            </div>
        </Modal>
    );
};
