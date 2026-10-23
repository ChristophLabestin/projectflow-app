import React from 'react';
import { Link, Outlet, useOutletContext, useParams } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useEntitlements } from '../../hooks/useEntitlements';

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
    // Pass the AppLayout outlet context through (project pages read setTaskTitle etc. from it).
    const outletContext = useOutletContext();
    return (
        <>
            {locked && (
                <div className="plan-lock-banner" role="status">
                    <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                    <span>{t('billing.projectLocked')}</span>
                    <Link to="?openSettings=billing" className="plan-lock-banner__link">{t('billing.upgradeCta')}</Link>
                </div>
            )}
            <Outlet context={outletContext} />
        </>
    );
};
