// /forms/fill/:token and /forms/:formId/fill — members fill in a workspace-only form inside the app
// (getFormForMember / submitFormAsMember). Public forms with a link land on /f/:token instead.
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '../../components/common/Button/Button';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { Skeleton } from '../../components/common/Skeleton/Skeleton';
import { formErrorText } from '../../components/forms/builder/formErrors';
import { FormRenderer } from '../../components/forms/renderer/FormRenderer';
import { resolveFormTheme } from '../../components/forms/theme/formThemes';
import { useLanguage } from '../../context/LanguageContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
    formErrorCode,
    getFormForMember,
    submitFormAsMember,
    type MemberFormLoad
} from '../../services/domain/formsService';
import { formAssetUrl } from '../../services/forms/publicFormsApi';
import './forms.scss';

export const FormFillScreen: React.FC = () => {
    const { token, formId } = useParams<{ token?: string; formId?: string }>();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const workspace = useWorkspace();
    const tenantId = workspace.activeWorkspaceId || '';
    const [load, setLoad] = useState<MemberFormLoad | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoad(null);
        setError(null);
        const input = token ? { token } : { tenantId, formId: formId || '' };
        if (!token && (!tenantId || !formId)) return;
        getFormForMember(input).then(setLoad).catch((err) => setError(formErrorCode(err) === 'form-already-answered' ? 'form-already-answered' : formErrorText(t, err)));
    }, [token, formId, tenantId, t]);

    if (error) {
        return (
            <EmptyState
                title={error === 'form-already-answered' ? t('forms.fill.alreadyAnswered') : t('forms.fill.unavailable')}
                message={error === 'form-already-answered' ? undefined : error}
                icon={<span className="material-symbols-outlined">assignment_late</span>}
                actions={<Button variant="secondary" onClick={() => navigate('/')}>{t('forms.fill.home')}</Button>}
            />
        );
    }
    if (!load) return <Skeleton className="forms-page__skeleton" />;

    const { form, session } = load;
    return (
        <div className="form-fill">
            <FormRenderer
                title={form.title}
                description={form.description}
                schema={form.schema}
                theme={resolveFormTheme(form.theme)}
                language={form.language}
                assetUrl={formAssetUrl}
                uploadsEnabled={false}
                hideBranding
                inApp
                onSubmit={async (answers, durationMs) => {
                    try {
                        const result = await submitFormAsMember({ tenantId: load.tenantId, formId: load.formId, session, answers, durationMs });
                        return { ok: true, confirmation: result.confirmation || form.settings.confirmation };
                    } catch (err) {
                        const details = (err as { details?: { fieldErrors?: { fieldId: string; code: string }[] } })?.details;
                        return { ok: false, fieldErrors: details?.fieldErrors as never, message: formErrorText(t, err) };
                    }
                }}
            />
        </div>
    );
};

export default FormFillScreen;
