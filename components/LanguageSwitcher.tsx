import React, { useEffect, useRef, useState } from 'react';
import { useLanguage, Language } from '../context/LanguageContext';

type LanguageOption = {
    value: Language;
    label: string;
    shortLabel: string;
};

export const LanguageSwitcher = () => {
    const { language, setLanguage, t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const options: LanguageOption[] = [
        { value: 'en', label: t('language.english'), shortLabel: 'EN' },
        { value: 'de', label: t('language.german'), shortLabel: 'DE' },
    ];

    const active = options.find(option => option.value === language) || options[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`
                    flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[var(--color-text-muted)]
                    ${isOpen
                        ? 'bg-[var(--color-surface-hover)] border-[var(--color-surface-border)] text-[var(--color-text-main)]'
                        : 'border-transparent hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'
                    }
                `}
                title={t('language.switch')}
                aria-label={t('language.switch')}
            >
                <span className="material-symbols-outlined text-[18px]">language</span>
                <span className="text-[11px] font-bold tracking-[0.08em]">{active.shortLabel}</span>
                <span className={`material-symbols-outlined text-[16px] transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </button>

            {isOpen && (
                <div
                    className="
                        absolute top-full right-0 mt-2 w-40 p-1
                        bg-[var(--color-surface-card)]
                        border border-[var(--color-surface-border)]
                        rounded-xl shadow-xl
                        z-50 animate-scale-up origin-top-right
                    "
                >
                    {options.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                setLanguage(option.value);
                                setIsOpen(false);
                            }}
                            className={`
                                w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-semibold
                                ${option.value === language
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                }
                            `}
                        >
                            <span>{option.label}</span>
                            {option.value === language && (
                                <span className="material-symbols-outlined text-[16px]">check</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
