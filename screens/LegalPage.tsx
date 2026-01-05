import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowLeft, Menu } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { COMPANY_STREET, COMPANY_ZIP, COMPANY_CITY } from '../config/company';
import './legal-page.scss';

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
                    <div className="legal-page__body">
                        <h1 className="legal-page__title">{t("legal.titles.impressum")}</h1>

                        <div className="legal-page__section">
                            <p className="legal-page__note">{t("legal.impressum.intro")}</p>

                            <h2>{t("legal.impressum.providerTitle")}</h2>
                            <p>
                                <strong>Christoph Labestin</strong>
                                <br />
                                {COMPANY_STREET}
                                <br />
                                {COMPANY_ZIP} {COMPANY_CITY}
                                <br />
                                {t("legal.impressum.country")}
                            </p>

                            <h2>{t("legal.impressum.businessTitle")}</h2>
                            <p>{t("legal.impressum.businessName")}</p>

                            <h2>{t("legal.impressum.contactTitle")}</h2>
                            <p>
                                {t("legal.impressum.phone")}
                                <br />
                                {t("legal.impressum.email")}
                            </p>

                            <h2>{t("legal.impressum.vatTitle")}</h2>
                            <p>
                                {t("legal.impressum.vatIntro")}
                                <br />
                                {t("legal.impressum.noVat")}
                            </p>

                            <h2>{t("legal.impressum.responsibleTitle")}</h2>
                            <p>
                                {t("legal.impressum.responsibleIntro")}
                                <br />
                                Christoph Labestin, {COMPANY_STREET}, {COMPANY_ZIP} {COMPANY_CITY}, {t("legal.impressum.country")}
                            </p>

                            <h2>{t("legal.impressum.disputeTitle")}</h2>
                            <p>{t("legal.impressum.disputeText")}</p>

                            <h2>{t("legal.impressum.liabilityContentTitle")}</h2>
                            <p>{t("legal.impressum.liabilityContentText")}</p>

                            <h2>{t("legal.impressum.liabilityLinksTitle")}</h2>
                            <p>{t("legal.impressum.liabilityLinksText")}</p>

                            <h2>{t("legal.impressum.copyrightTitle")}</h2>
                            <p>{t("legal.impressum.copyrightText")}</p>
                        </div>
                    </div>
                );
            case 'privacy': {
                const txt = (key: string) => t(key).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                const lastUpdatedDate = new Date().toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                return (
                    <div className="legal-page__body">
                        <h1 className="legal-page__title">{t('legal.titles.appPrivacy')}</h1>
                        <div className="legal-page__sections">
                            <section className="legal-page__section">
                                <h2 id="app-intro">{t('legal.appPrivacy.intro.title')}</h2>
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.intro.text') }} />
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-controller">{t('legal.appPrivacy.controller.title')}</h2>
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.controller.text') }} />
                                <div className="legal-page__block">
                                    <h3>{t('legal.appPrivacy.controller.subtitle')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.controller.subtext') }} />
                                </div>
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-collected">{t('legal.appPrivacy.collectedData.title')}</h2>
                                <p>{t('legal.appPrivacy.collectedData.intro')}</p>
                                {['account', 'auth', 'profile', 'content', 'social', 'lists', 'integration', 'ai', 'preferences', 'logs'].map(key => (
                                    <div key={key} className="legal-page__block">
                                        <h3>{t(`legal.appPrivacy.collectedData.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.collectedData.${key}.text`) }} />
                                    </div>
                                ))}
                                <p className="legal-page__note" dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.collectedData.summary.text') }} />
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-usage">{t('legal.appPrivacy.usage.title')}</h2>
                                <p>{t('legal.appPrivacy.usage.intro')}</p>
                                {['maintenance', 'collaboration', 'ai', 'social', 'email', 'analytics', 'security', 'legal'].map(key => (
                                    <div key={key} className="legal-page__block">
                                        <h3>{t(`legal.appPrivacy.usage.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.usage.${key}.text`) }} />
                                    </div>
                                ))}
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.usage.decision.text') }} />
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-legal-basis">{t('legal.appPrivacy.legalBasis.title')}</h2>
                                <p>{t('legal.appPrivacy.legalBasis.intro')}</p>
                                {['contract', 'consent', 'interest', 'obligation'].map(key => (
                                    <div key={key} className="legal-page__block">
                                        <h3>{t(`legal.appPrivacy.legalBasis.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.legalBasis.${key}.text`) }} />
                                    </div>
                                ))}
                                <p>{t('legal.appPrivacy.legalBasis.summary.text')}</p>
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-cookies">{t('legal.appPrivacy.cookies.title')}</h2>
                                <p>{t('legal.appPrivacy.cookies.intro')}</p>
                                {['essential', 'noTracking', 'optional', 'control'].map(key => (
                                    <div key={key} className="legal-page__block">
                                        <h3>{t(`legal.appPrivacy.cookies.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.cookies.${key}.text`) }} />
                                    </div>
                                ))}
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-third-party">{t('legal.appPrivacy.thirdParty.title')}</h2>
                                <p>{t('legal.appPrivacy.thirdParty.intro')}</p>
                                {['firebase', 'gemini', 'smtp', 'github', 'meta', 'other', 'payment', 'dpa', 'team', 'regulatory', 'corporate', 'noSale'].map(key => (
                                    <div key={key} className="legal-page__block">
                                        <h3>{t(`legal.appPrivacy.thirdParty.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.thirdParty.${key}.text`) }} />
                                    </div>
                                ))}
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-storage">{t('legal.appPrivacy.storage.title')}</h2>
                                <p>{t('legal.appPrivacy.storage.intro')}</p>
                                {['primary', 'backup', 'transfers', 'noGlobal', 'hosting'].map(key => (
                                    <div key={key} className="legal-page__block">
                                        <h3>{t(`legal.appPrivacy.storage.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.storage.${key}.text`) }} />
                                    </div>
                                ))}
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-retention">{t('legal.appPrivacy.retention.title')}</h2>
                                <p>{t('legal.appPrivacy.retention.intro')}</p>
                                {['account', 'content', 'tokens', 'logs', 'ai', 'newsletter', 'closed', 'backups'].map(key => (
                                    <div key={key} className="legal-page__block">
                                        <h3>{t(`legal.appPrivacy.retention.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.retention.${key}.text`) }} />
                                    </div>
                                ))}
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-security">{t('legal.appPrivacy.security.title')}</h2>
                                <p>{t('legal.appPrivacy.security.intro')}</p>
                                {['encryption', 'access', 'auth', 'network', 'testing', 'team', 'prevention', 'isolation', 'backups'].map(key => (
                                    <div key={key} className="legal-page__block">
                                        <h3>{t(`legal.appPrivacy.security.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.security.${key}.text`) }} />
                                    </div>
                                ))}
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-rights">{t('legal.appPrivacy.rights.title')}</h2>
                                <p>{t('legal.appPrivacy.rights.intro')}</p>
                                {['access', 'rectification', 'erasure', 'restrict', 'portability', 'object', 'withdraw', 'automated'].map(key => (
                                    <div key={key} className="legal-page__block">
                                        <h3>{t(`legal.appPrivacy.rights.${key}.title`)}</h3>
                                        <p dangerouslySetInnerHTML={{ __html: txt(`legal.appPrivacy.rights.${key}.text`) }} />
                                    </div>
                                ))}
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.rights.contact.text') }} />
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.rights.complaint.text') }} />
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-children">{t('legal.appPrivacy.children.title')}</h2>
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.children.text') }} />
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-changes">{t('legal.appPrivacy.changes.title')}</h2>
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.changes.text') }} />
                            </section>

                            <section className="legal-page__section">
                                <h2 id="app-contact">{t('legal.appPrivacy.contactUs.title')}</h2>
                                <p>{t('legal.appPrivacy.contactUs.intro')}</p>
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.contactUs.address') }} />
                                <p dangerouslySetInnerHTML={{ __html: txt('legal.appPrivacy.contactUs.outro') }} />
                            </section>
                        </div>
                        <p className="legal-page__meta">{t('legal.appPrivacy.lastUpdatedLabel')} {lastUpdatedDate}</p>
                    </div>
                );
            }
            case 'terms': {

                // terms is already loaded at component level
                // Fallback if terms is just the string key (localization missing or failed)
                if (typeof terms !== 'object') {
                    return <div className="legal-page__note">{t('legal.errors.termsMissing')}</div>;
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
                                <div key={blockIndex} className="legal-page__block">
                                    <h4>{title}</h4>
                                    {rest && <p dangerouslySetInnerHTML={{ __html: formatBold(rest) }} />}
                                </div>
                            );
                        }

                        return (
                            <div key={blockIndex} className="legal-page__block">
                                <p dangerouslySetInnerHTML={{ __html: formatBold(text) }} />
                            </div>
                        );
                    }
                    if (block.type === 'ul') {
                        return (
                            <ul key={blockIndex} className="legal-page__list legal-page__list--unordered">
                                {(block.items ?? []).map((item, itemIndex) => (
                                    <li key={itemIndex} dangerouslySetInnerHTML={{ __html: formatBold(item) }} />
                                ))}
                            </ul>
                        );
                    }
                    if (block.type === 'ol') {
                        return (
                            <ol key={blockIndex} className="legal-page__list legal-page__list--ordered">
                                {(block.items ?? []).map((item, itemIndex) => (
                                    <li key={itemIndex} dangerouslySetInnerHTML={{ __html: formatBold(item) }} />
                                ))}
                            </ol>
                        );
                    }
                    return null;
                };

                return (
                    <div className="legal-page__body">
                        <h1 className="legal-page__title">{t('legal.titles.terms')}</h1>
                        <div className="legal-page__sections">
                            <section className="legal-page__section">
                                <h2>{terms.summary.title}</h2>
                                <p dangerouslySetInnerHTML={{ __html: formatBold(terms.summary.text) }} />
                            </section>

                            {terms.sections.map((section, sectionIndex) => (
                                <section key={sectionIndex} className="legal-page__section">
                                    <h2 id={slugify(section.title)}>{section.title}</h2>
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
            className="legal-page"
        >
            {/* Mobile Header */}
            <div className="legal-page__header">
                <button
                    onClick={onClose}
                    className="legal-page__back"
                >
                    <ArrowLeft size={20} />
                    {t('legal.back')}
                </button>
                <div className="legal-page__header-actions">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="legal-page__menu-button"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </div>

            <div className="legal-page__layout">
                {/* Sidebar / Nav */}
                <div className="legal-page__sidebar">

                    <div>
                        <button
                            onClick={onClose}
                            className="legal-page__back"
                        >
                            <ArrowLeft size={18} /> {t('legal.back')}
                        </button>

                        <nav className="legal-page__nav">
                            <button
                                onClick={() => onNavigate('impressum')}
                                className={`legal-page__nav-button ${page === 'impressum' ? 'is-active' : ''}`}
                            >
                                {t('legal.nav.impressum')}
                            </button>
                            <button
                                onClick={() => onNavigate('privacy')}
                                className={`legal-page__nav-button ${page === 'privacy' ? 'is-active' : ''}`}
                            >
                                {t('legal.nav.privacy')}
                            </button>
                            {page === 'privacy' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="legal-page__subnav"
                                >
                                    {appPrivacySections.map((section) => (
                                        <button
                                            key={section.id}
                                            onClick={() => scrollToSection(section.id)}
                                            className={`legal-page__subnav-button ${activeSection === section.id ? 'is-active' : ''}`}
                                        >
                                            {section.title}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                            <button
                                onClick={() => onNavigate('terms')}
                                className={`legal-page__nav-button ${page === 'terms' ? 'is-active' : ''}`}
                            >
                                {t('legal.nav.terms')}
                            </button>
                            {page === 'terms' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="legal-page__subnav"
                                >
                                    {termsSections.map((section) => (
                                        <button
                                            key={section.id}
                                            onClick={() => scrollToSection(section.id)}
                                            className={`legal-page__subnav-button ${activeSection === section.id ? 'is-active' : ''}`}
                                        >
                                            {section.title}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </nav>
                    </div>

                    <div className="legal-page__footer">
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
                            className="legal-page__mobile-menu"
                        >
                            <div className="legal-page__mobile-menu-top">
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="legal-page__mobile-close"
                                >
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="legal-page__mobile-nav">
                                <button
                                    onClick={() => onNavigate('impressum')}
                                    className={`legal-page__mobile-link ${page === 'impressum' ? 'is-active' : ''}`}
                                >
                                    {t('legal.nav.impressum')}
                                </button>
                                <button
                                    onClick={() => onNavigate('privacy')}
                                    className={`legal-page__mobile-link ${page === 'privacy' ? 'is-active' : ''}`}
                                >
                                    {t('legal.nav.privacy')}
                                </button>
                                <button
                                    onClick={() => onNavigate('terms')}
                                    className={`legal-page__mobile-link ${page === 'terms' ? 'is-active' : ''}`}
                                >
                                    {t('legal.nav.terms')}
                                </button>
                            </div>

                            <div className="legal-page__mobile-footer">
                                <button
                                    onClick={onClose}
                                    className="legal-page__back"
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
                    className="legal-page__content"
                >
                    {renderContent()}
                </div>
            </div>
        </motion.div >
    );
};

export default LegalPage;
