import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

interface BreadcrumbsProps {
    items?: { label: string; to?: string }[];
}

/**
 * Top bar breadcrumb trail: a back arrow to the direct parent, then the path
 * segments (muted) and the current page. Pages do not render their own
 * breadcrumbs — this is the single trail, built by utils/breadcrumbs.ts.
 */
export const Breadcrumbs = ({ items = [] }: BreadcrumbsProps) => {
    const { t } = useLanguage();

    // Top-level pages have no trail (see utils/breadcrumbs.ts): render nothing rather than a lone home icon.
    if (items.length < 2) return null;

    const parents = items.slice(0, -1);
    const current = items[items.length - 1];
    const backTarget = [...parents].reverse().find((item) => item.to)?.to || '/';
    const backLabel = [...parents].reverse().find((item) => item.to)?.label || t('nav.dashboard');

    return (
        <nav className="crumbs" aria-label={t('breadcrumbs.label')}>
            <Link to={backTarget} className="crumbs__back" aria-label={t('breadcrumbs.back').replace('{page}', backLabel)} title={t('breadcrumbs.back').replace('{page}', backLabel)}>
                <span className="material-symbols-outlined" aria-hidden="true">west</span>
            </Link>
            <ol className="crumbs__list">
                {parents.map((item, index) => (
                    <li key={`${item.label}-${index}`} className="crumbs__item">
                        {item.to ? (
                            <Link to={item.to} className="crumbs__link">{item.label}</Link>
                        ) : (
                            <span className="crumbs__link">{item.label}</span>
                        )}
                    </li>
                ))}
                <li className="crumbs__item crumbs__item--current" aria-current="page">
                    <span className="crumbs__current" title={current.label}>{current.label}</span>
                </li>
            </ol>
        </nav>
    );
};
