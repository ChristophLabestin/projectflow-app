import React, { useEffect, useState } from 'react';

import { Button } from '../common/Button/Button';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { getTenant } from '../../services/domain/workspaceService';
import { saveTenantLegal } from '../../services/domain/formsService';
import type { TenantLegal } from '../../types/forms';

type LegalForm = Required<Pick<TenantLegal, 'controllerName' | 'privacyPolicyUrl' | 'imprintUrl'>>;
const EMPTY: LegalForm = { controllerName: '', privacyPolicyUrl: '', imprintUrl: '' };
const isHttpsOrEmpty = (value: string) => !value.trim() || /^https:\/\/\S+$/.test(value.trim());

/**
 * Workspace legal details (controller, privacy policy, imprint). Public forms show them in their
 * footer and cannot be published without controller + privacy policy (brain/plans/forms-concept.md §10).
 */
export const WorkspaceLegalCard: React.FC<{ tenantId: string; isAdmin: boolean }> = ({ tenantId, isAdmin }) => {
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const [legal, setLegal] = useState<LegalForm>(EMPTY);
    const [saved, setSaved] = useState<LegalForm | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) return;
        getTenant(tenantId).then((tenant: any) => {
            const next = { ...EMPTY, ...(tenant?.legal || {}) } as LegalForm;
            const picked = { controllerName: next.controllerName || '', privacyPolicyUrl: next.privacyPolicyUrl || '', imprintUrl: next.imprintUrl || '' };
            setLegal(picked);
            setSaved(picked);
        }).catch((error) => console.error('Failed to load workspace legal details', error));
    }, [tenantId]);

    const dirty = saved !== null && JSON.stringify(legal) !== JSON.stringify(saved);
    const invalidUrl = !isHttpsOrEmpty(legal.privacyPolicyUrl) || !isHttpsOrEmpty(legal.imprintUrl);

    const save = async () => {
        if (invalidUrl) {
            showError(t('workspaceSettings.legal.httpsRequired'));
            return;
        }
        setSaving(true);
        try {
            await saveTenantLegal(tenantId, legal);
            const next = {
                controllerName: legal.controllerName.trim(),
                privacyPolicyUrl: legal.privacyPolicyUrl.trim(),
                imprintUrl: legal.imprintUrl.trim()
            };
            setLegal(next);
            setSaved(next);
            showSuccess(t('workspaceSettings.legal.saved'));
        } catch (error) {
            console.error(error);
            showError(t('workspaceSettings.errors.generic'));
        } finally {
            setSaving(false);
        }
    };

    const field = (key: keyof LegalForm, type: 'text' | 'url') => (
        <label className="ws-settings__field">
            <span>{t(`workspaceSettings.legal.${key}`)}</span>
            <input
                className="ws-settings__input"
                type={type}
                value={legal[key]}
                placeholder={type === 'url' ? 'https://' : undefined}
                onChange={(event) => setLegal((current) => ({ ...current, [key]: event.target.value }))}
                disabled={!isAdmin}
                maxLength={type === 'url' ? 500 : 200}
            />
        </label>
    );

    return (
        <section className="ws-card">
            <header className="ws-card__head">
                <h2>{t('workspaceSettings.legal.title')}</h2>
                {!isAdmin && <span className="ws-card__note">{t('workspaceSettings.readOnly')}</span>}
            </header>
            <p className="ws-card__note">{t('workspaceSettings.legal.hint')}</p>
            {field('controllerName', 'text')}
            <div className="ws-settings__grid">
                {field('privacyPolicyUrl', 'url')}
                {field('imprintUrl', 'url')}
            </div>
            {isAdmin && (
                <footer className="ws-card__foot">
                    {dirty && <button type="button" className="ws-link" onClick={() => saved && setLegal(saved)}>{t('common.cancel')}</button>}
                    <Button variant="primary" isLoading={saving} disabled={!dirty} onClick={() => void save()}>
                        {t('workspaceSettings.general.save')}
                    </Button>
                </footer>
            )}
        </section>
    );
};
