import React from 'react';

import { useLanguage } from '../../context/LanguageContext';
import type { AiAccessStatus } from '../../hooks/useAiAccess';
import { PlanHint } from './PlanHint';

/**
 * Why AI is unavailable for this user and how to get it — for AI entry points gated with useAiAccess().
 * Renders nothing while loading or when AI is available.
 */
export const AiPlanHint: React.FC<{ status: AiAccessStatus; compact?: boolean; className?: string }> = ({ status, compact = false, className }) => {
    const { t } = useLanguage();
    if (status !== 'addon-required' && status !== 'plan-required') return null;
    return (
        <PlanHint
            compact={compact}
            className={className}
            icon="auto_awesome"
            title={compact ? undefined : t('billing.aiGate.title')}
            message={t(status === 'addon-required' ? 'billing.aiGate.addon' : 'billing.aiGate.free')}
        />
    );
};
