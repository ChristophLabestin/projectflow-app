import React from 'react';
import { Link } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import { useActivePlan } from '../../hooks/useEntitlements';
import './plan-hint.scss';

interface PlanHintProps {
    message: string;
    title?: string;
    icon?: string;
    tone?: 'info' | 'warning';
    /** Smaller single-line variant for menus, forms and toolbars. */
    compact?: boolean;
    /** false: no upgrade path applies (e.g. invitations in a personal workspace). */
    cta?: boolean;
    className?: string;
}

/**
 * The one way to explain a plan limit: what is limited, and the way out — owners get a link to
 * Settings → Billing, everyone else is told to ask the owner (only owners can change the plan).
 */
export const PlanHint: React.FC<PlanHintProps> = ({ message, title, icon = 'workspace_premium', tone = 'info', compact = false, cta = true, className = '' }) => {
    const { t } = useLanguage();
    const { isOwner } = useActivePlan();
    return (
        <div className={`plan-hint plan-hint--${tone}${compact ? ' plan-hint--compact' : ''} ${className}`.trim()} role="note">
            <span className="material-symbols-outlined plan-hint__icon" aria-hidden="true">{icon}</span>
            <div className="plan-hint__body">
                {title && <strong className="plan-hint__title">{title}</strong>}
                <span className="plan-hint__message">{message}</span>
            </div>
            {cta && (isOwner ? (
                <Link to="?openSettings=billing" className="plan-hint__cta">{t('billing.hint.viewPlans')}</Link>
            ) : (
                <span className="plan-hint__note">{t('billing.hint.askOwner')}</span>
            ))}
        </div>
    );
};
