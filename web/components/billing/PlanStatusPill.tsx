import React from 'react';
import { Link } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import { useActivePlan } from '../../hooks/useEntitlements';
import { daysLeft } from '../../utils/billingPlans';
import './plan-hint.scss';

const GRACE_NOTICE_DAYS = 30;
const URGENT_DAYS = 3;

/**
 * Top-bar plan status — only when something needs attention: trial countdown, the end of the beta
 * grace, a failed payment, or read-only projects after falling back to Free. Opens Settings → Billing.
 */
export const PlanStatusPill: React.FC = () => {
    const { t } = useLanguage();
    const { plan } = useActivePlan();
    if (!plan) return null;

    let icon = 'hourglass_top';
    let tone: 'neutral' | 'urgent' | 'warning' | 'danger' = 'neutral';
    let label = '';
    let title = '';

    if (plan.status === 'past_due') {
        icon = 'credit_card_off';
        tone = 'danger';
        label = t('billing.pill.pastDue');
        title = t('billing.pastDueBanner');
    } else if (plan.lockedProjectIds.length > 0) {
        icon = 'lock';
        tone = 'warning';
        label = t('billing.pill.readOnly').replace('{count}', String(plan.lockedProjectIds.length));
        title = t('billing.lockedBanner').replace('{count}', String(plan.lockedProjectIds.length));
    } else if (plan.status === 'trialing' && !plan.hasSubscription) {
        const days = daysLeft(plan.trialEndsAt) ?? 0;
        tone = days <= URGENT_DAYS ? 'urgent' : 'neutral';
        label = days === 0 ? t('billing.pill.trialToday') : t(days === 1 ? 'billing.pill.trialOne' : 'billing.pill.trial').replace('{days}', String(days));
        title = t('billing.status.trialing').replace('{days}', String(days));
    } else if (plan.status === 'grace' && plan.graceEndsAt) {
        const days = daysLeft(plan.graceEndsAt) ?? 0;
        if (days > GRACE_NOTICE_DAYS) return null;
        tone = days <= URGENT_DAYS ? 'urgent' : 'neutral';
        label = t('billing.pill.grace').replace('{days}', String(days));
        title = t('billing.status.graceUntil').replace('{date}', plan.graceEndsAt.toLocaleDateString());
    } else {
        return null;
    }

    return (
        <Link to="?openSettings=billing" className={`plan-pill plan-pill--${tone}`} title={title} aria-label={`${label}. ${title}`}>
            <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
            <span className="plan-pill__label">{label}</span>
        </Link>
    );
};
