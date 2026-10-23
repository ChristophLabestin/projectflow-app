import React from 'react';
import { Outlet, useParams } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useEntitlements } from '../../hooks/useEntitlements';
import { PlanHint } from './PlanHint';

/**
 * Wraps `/project/:id/*`: projects over the Free limit are read-only (Firestore rules enforce it);
 * this only explains why edits fail and links to the billing tab.
 */
export const ProjectPlanGate: React.FC = () => {
    const { id } = useParams();
    const { t } = useLanguage();
    const { activeWorkspaceId } = useWorkspace();
    const ent = useEntitlements(activeWorkspaceId);
    const locked = Boolean(id && ent?.lockedProjectIds.includes(id));
    return (
        <>
            {locked && (
                <div className="plan-lock-gate">
                    <PlanHint
                        tone="warning"
                        icon="lock"
                        title={t('billing.locked.title')}
                        message={t('billing.locked.body').replace('{limit}', String(ent?.limits.projects ?? 3))}
                    />
                </div>
            )}
            <Outlet />
        </>
    );
};
