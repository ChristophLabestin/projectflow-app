import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import { useActivePlan } from '../../hooks/useEntitlements';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { planCopyKey } from '../../utils/billingPlans';
import './plan-hint.scss';

interface PlanLimitDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** Which limit stopped the action. */
    kind: 'projects' | 'invites' | 'members';
}

/**
 * Shown instead of a create/invite flow the current plan does not allow, so the user learns why and how to go on
 * before filling in a form the rules would reject anyway.
 */
export const PlanLimitDialog: React.FC<PlanLimitDialogProps> = ({ isOpen, onClose, kind }) => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { plan, isOwner } = useActivePlan();
    const limit = kind === 'members' ? plan?.limits.members : plan?.limits.projects;
    const body = t(planCopyKey(plan, `billing.limit.${kind}.body`))
        .replace('{limit}', String(limit ?? ''))
        .replace('{count}', String(plan?.usage.projects ?? ''));

    const openBilling = () => {
        onClose();
        navigate({ search: '?openSettings=billing' });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            title={t(`billing.limit.${kind}.title`)}
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
                    {isOwner && <Button onClick={openBilling}>{t('billing.hint.viewPlans')}</Button>}
                </>
            )}
        >
            <div className="plan-limit-dialog">
                <span className="material-symbols-outlined plan-limit-dialog__icon" aria-hidden="true">
                    workspace_premium
                </span>
                <p className="plan-limit-dialog__body">{body}</p>
                {kind === 'projects' && <p className="plan-limit-dialog__tip">{t('billing.limit.projects.tip')}</p>}
                {!isOwner && <p className="plan-limit-dialog__tip">{t('billing.hint.askOwner')}</p>}
            </div>
        </Modal>
    );
};
