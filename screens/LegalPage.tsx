import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowLeft, Menu } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { COMPANY_STREET, COMPANY_ZIP, COMPANY_CITY } from '../config/company';

export type LegalPageType = 'impressum' | 'privacy' | 'terms';

const LegalPage: React.FC = () => {
    const { type } = useParams<{ type: string }>();
    const navigate = useNavigate();
    const { t, language } = useLanguage();



    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<string>('');
    const contentRef = React.useRef<HTMLDivElement>(null);

    const page: LegalPageType = (type === 'privacy' || type === 'terms' || type === 'impressum') ? type : 'impressum';

    const slugify = (text: string) => {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')        // Replace spaces with -
            .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
            .replace(/\-\-+/g, '-');     // Replace multiple - with single -
    };

    const terms = t('legal.terms') as {
        summary: { title: string; text: string };
        sections: Array<{
            title: string;
            blocks: Array<{ type: 'p' | 'ul' | 'ol'; text?: string; items?: string[] }>;
        }>;
    };

    const termsSections = React.useMemo(() => {
        if (typeof terms !== 'object' || !terms.sections) return [];
        return terms.sections.map(section => ({
            id: slugify(section.title),
            title: section.title
        }));
    }, [terms]);

    const onNavigate = (newPage: LegalPageType) => {
        navigate(`/legal/${newPage}`);
        setIsMobileMenuOpen(false);
    };

    const onClose = () => {
        if (window.history.length > 2) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const privacySections = [
        { id: 'scope', title: t("legal.privacy.scope.title") },
        { id: 'controller', title: t("legal.privacy.controller.title") },
        { id: 'categories', title: t("legal.privacy.categories.title") },
        // Note: legal-en.ts does not seem to have 'legal-bases' -> 'legalBases'? Check file content again if needed.
        // Assuming standard naming convention from file view: legal.privacy.legalBases probably exists?
        // Let's check legal-en.ts content from history. 
        // Showing lines 1 to 50 only. Need to assume keys exist based on existing code in LegalOverlay.tsx
        { id: 'legal-bases', title: t("legal.privacy.legalBases.title") }, // Assuming this key exists
        { id: 'cookies', title: t("legal.privacy.cookies.title") },
        { id: 'ga4-details', title: t("legal.privacy.ga4Details.title") },
        { id: 'email', title: t("legal.privacy.email.title") },
        { id: 'recipients', title: t("legal.privacy.recipients.title") },
        { id: 'transfers', title: t("legal.privacy.transfers.title") },
        { id: 'retention', title: t("legal.privacy.retention.title") },
        { id: 'rights', title: t("legal.privacy.rights.title") },
        { id: 'updates', title: t("legal.privacy.updates.title") },
    ];

    // Note: LegalOverlay had appPrivacySections but didn't seem to use them in the 'privacy' case view?
    // Wait, 'privacy' case in LegalOverlay (lines 167+) renders:
    // t('legal.titles.appPrivacy') (Line 173) -> "App Privacy Policy"
    // And iterates sections manually?
    // It renders sections with IDs: app-intro, app-controller, app-collected...
    // The previously defined privacySections (scope, controller...) seem to be for WEBSITE privacy?
    // But legal-en.ts has:
    // legal.titles.privacy: "Privacy Policy"
    // legal.titles.appPrivacy: "App Privacy Policy"
    // The code in LegalOverlay 'privacy' case renders "App Privacy Policy". 
    // Maybe the user wants the App Privacy Policy on the web app?
    // Or maybe there are two privacy policies?
    // The keys used in LegalOverlay 'privacy' case are 'legal.appPrivacy.*'.
    // The keys in `privacySections` array above are 'legal.privacy.*'.
    // If I look at the Sidebar code in LegalOverlay (lines 503+):
    // It maps `privacySections`. 
    // BUT the content rendered is `legal.appPrivacy`?
    // That's a mismatch. The sidebar links to 'scope', 'controller' (from `legal.privacy`)
    // But the content rendered has IDs 'app-intro', 'app-controller'.
    // So the sidebar links wouldn't work or would scroll to nothing.

    // DECISION:
    // Since this is the Web App (ProjectFlow App), "App Privacy Policy" seems appropriate.
    // However, the Sidebar should match the Content.
    // LegalOverlay seems to have mixed the two or I am misinterpreting.
    // Let's look at `legal-en.ts` again via history or just verify keys.
    // Line 173 in LegalOverlay uses `t('legal.titles.appPrivacy')`.
    // But line 27 in LegalOverlay defines privacySections using `t("legal.privacy.scope.title")`.

    // If I use the content from `legal.appPrivacy`, I should use `appPrivacySections` for the sidebar.
    // I will check `appPrivacySections` in LegalOverlay (lines 41-56).
    // They map to IDs like 'app-intro', 'app-controller'.
    // And the content uses these IDs.
    // So I should use `appPrivacySections` for the sidebar when page is 'privacy'.
    // Note: 'privacy' probably refers to App Privacy in this context.

    const appPrivacySections = React.useMemo(() => [
        { id: 'app-intro', title: t('legal.appPrivacy.intro.title') },
        { id: 'app-controller', title: t('legal.appPrivacy.controller.title') },
        { id: 'app-collected', title: t('legal.appPrivacy.collectedData.title') },
        { id: 'app-usage', title: t('legal.appPrivacy.usage.title') },
        { id: 'app-legal-basis', title: t('legal.appPrivacy.legalBasis.title') },
        { id: 'app-cookies', title: t('legal.appPrivacy.cookies.title') },
        { id: 'app-third-party', title: t('legal.appPrivacy.thirdParty.title') },
        { id: 'app-storage', title: t('legal.appPrivacy.storage.title') },
        { id: 'app-retention', title: t('legal.appPrivacy.retention.title') },
        { id: 'app-security', title: t('legal.appPrivacy.security.title') },
        { id: 'app-rights', title: t('legal.appPrivacy.rights.title') },
        { id: 'app-children', title: t('legal.appPrivacy.children.title') },
        { id: 'app-changes', title: t('legal.appPrivacy.changes.title') },
        { id: 'app-contact', title: t('legal.appPrivacy.contactUs.title') },
    ], [t]);

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                });
            },
            {
                root: contentRef.current,
                rootMargin: '-10% 0px -80% 0px', // Adjusted for better top-focused detection
                threshold: 0
            }
        );

        const sections = page === 'privacy' ? appPrivacySections : termsSections;

        // Small delay to ensure DOM is ready
        const timeoutId = setTimeout(() => {
            sections.forEach(section => {
                const element = document.getElementById(section.id);
                if (element) observer.observe(element);
            });
        }, 100);

        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, [page, appPrivacySections, termsSections]);

    const renderContent = () => {
        switch (page) {
            case 'impressum':
                return (
                    <div className="space-y-8">
                        <h1 className="text-4xl font-bold tracking-tight mb-8 text-[var(--color-text-main)]">
                            {t("legal.titles.impressum")}
                        </h1>

                        <div className="space-y-6 text-[var(--color-text-paragraph)] leading-relaxed max-w-none">
                            <p className="text-[var(--color-text-muted)] italic mb-6">{t("legal.impressum.intro")}</p>

                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{t("legal.impressum.providerTitle")}</h2>
                            <p className="mb-4">
                                <strong>Christoph Labestin</strong>
                                <br />
                                {COMPANY_STREET}
                                <br />
                                {COMPANY_ZIP} {COMPANY_CITY}
                                <br />
                                {t("legal.impressum.country")}
                            </p>

                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{t("legal.impressum.businessTitle")}</h2>
                            <p className="mb-4">
                                {t("legal.impressum.businessName")}
                            </p>

                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{t("legal.impressum.contactTitle")}</h2>
                            <p className="mb-4">
                                {t("legal.impressum.phone")}
                                <br />
                                {t("legal.impressum.email")}
                            </p>

                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{t("legal.impressum.vatTitle")}</h2>
                            <p className="mb-4">
                                {t("legal.impressum.vatIntro")}
                                <br />
                                {t("legal.impressum.noVat")}
                            </p>

                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{t("legal.impressum.responsibleTitle")}</h2>
                            <p className="mb-4">
                                {t("legal.impressum.responsibleIntro")}
                                <br />
                                Christoph Labestin, {COMPANY_STREET}, {COMPANY_ZIP} {COMPANY_CITY}, {t("legal.impressum.country")}
                            </p>

                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{t("legal.impressum.disputeTitle")}</h2>
                            <p className="mb-4">
                                {t("legal.impressum.disputeText")}
                            </p>

                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{t("legal.impressum.liabilityContentTitle")}</h2>
                            <p className="mb-4">
                                {t("legal.impressum.liabilityContentText")}
                            </p>

                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{t("legal.impressum.liabilityLinksTitle")}</h2>
                            <p className="mb-4">
                                {t("legal.impressum.liabilityLinksText")}
                            </p>

                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{t("legal.impressum.copyrightTitle")}</h2>
                            <p className="mb-4">
                                {t("legal.impressum.copyrightText")}
                            </p>
                        </div>
                    </div>
                );
            case 'privacy': {
                const txt = (key: string) => t(key).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                const lastUpdatedDate = new Date().toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                return (
                    <div className="space-y-8">
                        <h1 className="text-4xl font-bold tracking-tight mb-8 text-[var(--color-text-main)]">{t('legal.titles.appPrivacy')}</h1>
                        <div className="space-y-6 text-[var(--color-text-paragraph)] leading-relaxed font-sans text-base">
                            <section>
                                <h2 id="app-intro" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 scroll-mt-24">{t('legal.appPrivacy.intro.title')}</h2>
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.intro.text') }} />
                            </section>

                            <section>
                                <h2 id="app-controller" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.controller.title')}</h2>
                                <p className="mb-4" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.controller.text') }} />
                                <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.controller.subtitle')}</h3>
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.controller.subtext') }} />
                            </section>

                            <section>
                                <h2 id="app-collected" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.collectedData.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.collectedData.intro')}</p>
                                {['account', 'auth', 'profile', 'content', 'social', 'lists', 'integration', 'ai', 'preferences', 'logs'].map(key => (
                                    <div key={key} className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t(`legal.appPrivacy.collectedData.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.collectedData.${key}.text`) }} />
                                    </div>
                                ))}
                                <p className="mb-4 text-sm italic" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.collectedData.summary.text') }} />
                            </section>

                            <section>
                                <h2 id="app-usage" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.usage.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.usage.intro')}</p>
                                {['maintenance', 'collaboration', 'ai', 'social', 'email', 'analytics', 'security', 'legal'].map(key => (
                                    <div key={key} className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t(`legal.appPrivacy.usage.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.usage.${key}.text`) }} />
                                    </div>
                                ))}
                                <p className="mb-4" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.usage.decision.text') }} />
                            </section>

                            <section>
                                <h2 id="app-legal-basis" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.legalBasis.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.legalBasis.intro')}</p>
                                {['contract', 'consent', 'interest', 'obligation'].map(key => (
                                    <div key={key} className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t(`legal.appPrivacy.legalBasis.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.legalBasis.${key}.text`) }} />
                                    </div>
                                ))}
                                <p className="mb-4">{t('legal.appPrivacy.legalBasis.summary.text')}</p>
                            </section>

                            <section>
                                <h2 id="app-cookies" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.cookies.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.cookies.intro')}</p>
                                {['essential', 'noTracking', 'optional', 'control'].map(key => (
                                    <div key={key} className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t(`legal.appPrivacy.cookies.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.cookies.${key}.text`) }} />
                                    </div>
                                ))}
                            </section>

                            <section>
                                <h2 id="app-third-party" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.thirdParty.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.thirdParty.intro')}</p>
                                {['firebase', 'gemini', 'smtp', 'github'].map(key => (
                                    <div key={key} className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t(`legal.appPrivacy.thirdParty.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.thirdParty.${key}.text`) }} />
                                    </div>
                                ))}
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.thirdParty.meta.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.thirdParty.meta.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.thirdParty.other.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.thirdParty.other.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.thirdParty.payment.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.thirdParty.payment.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.thirdParty.dpa.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.thirdParty.dpa.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.thirdParty.team.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.thirdParty.team.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.thirdParty.regulatory.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.thirdParty.regulatory.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.thirdParty.corporate.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.thirdParty.corporate.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.thirdParty.noSale.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.thirdParty.noSale.text') }} />
                                </div>
                            </section>

                            <section>
                                <h2 id="app-storage" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.storage.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.storage.intro')}</p>
                                {['primary', 'backup', 'transfers'].map(key => (
                                    <div key={key} className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t(`legal.appPrivacy.storage.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.storage.${key}.text`) }} />
                                    </div>
                                ))}
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.storage.noGlobal.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.storage.noGlobal.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.storage.hosting.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.storage.hosting.text') }} />
                                </div>
                            </section>

                            <section>
                                <h2 id="app-retention" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.retention.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.retention.intro')}</p>
                                {['account', 'content', 'tokens', 'logs', 'ai', 'newsletter', 'closed'].map(key => (
                                    <div key={key} className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t(`legal.appPrivacy.retention.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.retention.${key}.text`) }} />
                                    </div>
                                ))}
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.retention.backups.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.retention.backups.text') }} />
                                </div>
                            </section>

                            <section>
                                <h2 id="app-security" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.security.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.security.intro')}</p>
                                {['encryption', 'access', 'auth', 'network'].map(key => (
                                    <div key={key} className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t(`legal.appPrivacy.security.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.security.${key}.text`) }} />
                                    </div>
                                ))}
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.security.testing.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.security.testing.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.security.team.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.security.team.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.security.prevention.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.security.prevention.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.security.isolation.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.security.isolation.text') }} />
                                </div>
                                <div className="mb-4">
                                    <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t('legal.appPrivacy.security.backups.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.security.backups.text') }} />
                                </div>
                            </section>

                            <section>
                                <h2 id="app-rights" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.rights.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.rights.intro')}</p>
                                {['access', 'rectification', 'erasure', 'restrict', 'portability', 'object', 'withdraw', 'automated'].map(key => (
                                    <div key={key} className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">{t(`legal.appPrivacy.rights.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.rights.${key}.text`) }} />
                                    </div>
                                ))}
                                <p className="mb-4" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.rights.contact.text') }} />
                                <p className="mb-4" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.rights.complaint.text') }} />
                            </section>

                            <section>
                                <h2 id="app-children" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.children.title')}</h2>
                                <p className="mb-4" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.children.text') }} />
                            </section>

                            <section>
                                <h2 id="app-changes" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.changes.title')}</h2>
                                <p className="mb-4" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.changes.text') }} />
                            </section>

                            <section>
                                <h2 id="app-contact" className="text-[var(--color-text-main)] font-bold text-2xl mb-4 mt-8 scroll-mt-24">{t('legal.appPrivacy.contactUs.title')}</h2>
                                <p className="mb-4">{t('legal.appPrivacy.contactUs.intro')}</p>
                                <p className="mb-4" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.contactUs.address') }} />
                                <p className="mb-4" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.contactUs.outro') }} />
                            </section>

                            <p className="text-sm text-[var(--color-text-muted)] mt-8">Last Updated: {lastUpdatedDate}</p>
                        </div>
                    </div>
                );
            }
            case 'terms': {
                // terms is already loaded at component level
                // Fallback if terms is just the string key (localization missing or failed)
                if (typeof terms !== 'object') {
                    return <div className="text-red-500">Error loading terms. Translation might be missing.</div>;
                }

                const formatBold = (value: string) => value.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                const renderBlock = (
                    block: { type: 'p' | 'ul' | 'ol'; text?: string; items?: string[] },
                    blockIndex: number
                ) => {
                    if (block.type === 'p') {
                        const text = block.text ?? '';
                        // Check if paragraph starts with bold text (e.g. "**1.1 Title.** Text...")
                        const match = text.match(/^\*\*(.*?)\*\*\s*(.*)/);

                        if (match) {
                            const [, title, rest] = match;
                            return (
                                <React.Fragment key={blockIndex}>
                                    <h4 className="font-bold text-[var(--color-text-main)] text-lg uppercase tracking-wide mb-2 mt-4">
                                        {title}
                                    </h4>
                                    {rest && <p dangerouslySetInnerHTML={{ __html: formatBold(rest) }} />}
                                </React.Fragment>
                            );
                        }

                        return <p key={blockIndex} dangerouslySetInnerHTML={{ __html: formatBold(text) }} />;
                    }
                    if (block.type === 'ul') {
                        return (
                            <ul key={blockIndex} className="list-disc pl-5 space-y-1">
                                {(block.items ?? []).map((item, itemIndex) => (
                                    <li key={itemIndex} dangerouslySetInnerHTML={{ __html: formatBold(item) }} />
                                ))}
                            </ul>
                        );
                    }
                    if (block.type === 'ol') {
                        return (
                            <ol key={blockIndex} className="list-decimal pl-5 space-y-1">
                                {(block.items ?? []).map((item, itemIndex) => (
                                    <li key={itemIndex} dangerouslySetInnerHTML={{ __html: formatBold(item) }} />
                                ))}
                            </ol>
                        );
                    }
                    return null;
                };

                return (
                    <div className="space-y-8">
                        <h1 className="text-4xl font-bold tracking-tight mb-8 text-[var(--color-text-main)]">{t('legal.titles.terms')}</h1>
                        <div className="space-y-6 text-[var(--color-text-paragraph)] leading-relaxed">
                            <section className="space-y-3">
                                <h2 className="text-[var(--color-text-main)] font-bold text-2xl">{terms.summary.title}</h2>
                                <p dangerouslySetInnerHTML={{ __html: formatBold(terms.summary.text) }} />
                            </section>

                            {terms.sections.map((section, sectionIndex) => (
                                <section key={sectionIndex} className="space-y-3">
                                    <h3 id={slugify(section.title)} className="text-[var(--color-text-main)] font-bold text-2xl scroll-mt-24">{section.title}</h3>
                                    {section.blocks.map((block, blockIndex) => renderBlock(block, blockIndex))}
                                </section>
                            ))}
                        </div>
                    </div>
                );
            }
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="h-full flex flex-col overflow-hidden bg-[var(--color-surface-bg)] bg-dots text-[var(--color-text-main)]"
        >
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-6 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] sticky top-0 z-40">
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 text-[var(--color-text-muted)] font-medium"
                >
                    <ArrowLeft size={20} />
                    {t('legal.back')}
                </button>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 -mr-2 text-neutral-600"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                {/* Sidebar / Nav */}
                <div className="hidden md:flex w-64 lg:w-80 bg-[var(--color-surface-card)] border-r border-[var(--color-surface-border)] p-10 shrink-0 h-full overflow-y-auto flex-col justify-between">

                    <div>
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors mb-12 font-medium"
                        >
                            <ArrowLeft size={18} /> {t('legal.back')}
                        </button>

                        <nav className="space-y-2">
                            <button
                                onClick={() => onNavigate('impressum')}
                                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${page === 'impressum' ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {t('legal.nav.impressum')}
                            </button>
                            <button
                                onClick={() => onNavigate('privacy')}
                                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${page === 'privacy' ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {t('legal.nav.privacy')}
                            </button>
                            {page === 'privacy' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="ml-4 mt-2 mb-4 space-y-1 border-l-2 border-neutral-200 pl-4 overflow-hidden"
                                >
                                    {appPrivacySections.map((section) => (
                                        <button
                                            key={section.id}
                                            onClick={() => scrollToSection(section.id)}
                                            className={`block w-full text-left text-xs py-1 transition-colors ${activeSection === section.id ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                        >
                                            {section.title}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                            <button
                                onClick={() => onNavigate('terms')}
                                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${page === 'terms' ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {t('legal.nav.terms')}
                            </button>
                            {page === 'terms' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="ml-4 mt-2 mb-4 space-y-1 border-l-2 border-neutral-200 pl-4 overflow-hidden"
                                >
                                    {termsSections.map((section) => (
                                        <button
                                            key={section.id}
                                            onClick={() => scrollToSection(section.id)}
                                            className={`block w-full text-left text-xs py-1 transition-colors ${activeSection === section.id ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                        >
                                            {section.title}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </nav>
                    </div>

                    <div className="text-xs text-[var(--color-text-subtle)] mt-12 md:mt-0">
                        {t('footer.rights')}
                    </div>
                </div>

                {/* Mobile Menu Overlay */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, x: '100%' }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-0 z-50 bg-[var(--color-surface-bg)] flex flex-col md:hidden"
                        >
                            <div className="flex justify-end p-6">
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors"
                                >
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center space-y-8 p-8">
                                <button
                                    onClick={() => onNavigate('impressum')}
                                    className={`text-3xl font-bold transition-colors ${page === 'impressum' ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}
                                >
                                    {t('legal.nav.impressum')}
                                </button>
                                <button
                                    onClick={() => onNavigate('privacy')}
                                    className={`text-3xl font-bold transition-colors ${page === 'privacy' ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}
                                >
                                    {t('legal.nav.privacy')}
                                </button>
                                <button
                                    onClick={() => onNavigate('terms')}
                                    className={`text-3xl font-bold transition-colors ${page === 'terms' ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}
                                >
                                    {t('legal.nav.terms')}
                                </button>
                            </div>

                            <div className="p-8 border-t border-[var(--color-surface-border)] flex flex-col items-center gap-6 bg-[var(--color-surface-card)] mb-0">
                                <button
                                    onClick={onClose}
                                    className="flex items-center gap-2 text-[var(--color-text-muted)] font-medium"
                                >
                                    <ArrowLeft size={20} />
                                    {t('legal.back')}
                                </button>
                            </div>
                        </motion.div>
                    )
                    }
                </AnimatePresence >

                {/* Content Area */}
                <div
                    ref={contentRef}
                    className="flex-1 p-6 md:p-16 lg:p-24 max-w-4xl relative overflow-y-auto h-full scroll-smooth"
                >
                    {renderContent()}
                </div>
            </div>
        </motion.div >
    );
};

export default LegalPage;
