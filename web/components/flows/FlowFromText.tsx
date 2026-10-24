// "Flow aus Satz": one sentence → validated draft (Structured Outputs) → editor (never auto-enabled).
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../common/Button/Button';
import { TextArea } from '../common/Input/TextArea';
import { planErrorMessage } from '../../services/billingService';
import { draftFlowFromText, flowErrorMessage } from '../../services/domain/automationsService';

const EXAMPLES = ['blocker', 'overdue', 'review'] as const;

interface FlowFromTextProps {
    t: (key: string) => string;
    tenantId: string;
    projectId: string | null;
    autoFocus?: boolean;
}

export const FlowFromText: React.FC<FlowFromTextProps> = ({ t, tenantId, projectId, autoFocus }) => {
    const navigate = useNavigate();
    const [sentence, setSentence] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (sentence.trim().length < 8) {
            setError(t('flows.fromText.tooShort'));
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const result = await draftFlowFromText(tenantId, sentence.trim(), projectId);
            navigate('/flows/new/edit', { state: { draft: { ...result.draft, enabled: false }, warnings: result.warnings } });
        } catch (err) {
            setError(planErrorMessage(err, t) || flowErrorMessage(err) || t('flows.fromText.failed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flow-from-text">
            <div className="flow-from-text__head">
                <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                <div>
                    <h3>{t('flows.fromText.title')}</h3>
                    <p>{t('flows.fromText.hint')}</p>
                </div>
            </div>
            <TextArea rows={2} value={sentence} autoFocus={autoFocus} placeholder={t('flows.fromText.placeholder')} aria-label={t('flows.fromText.title')}
                onChange={(e) => setSentence(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(); }} />
            <div className="flow-from-text__examples">
                <span>{t('flows.fromText.examples')}</span>
                {EXAMPLES.map((key) => (
                    <button key={key} type="button" className="flow-chip flow-chip--ghost" onClick={() => setSentence(t(`flows.fromText.example.${key}`))}>
                        {t(`flows.fromText.exampleLabel.${key}`)}
                    </button>
                ))}
            </div>
            {error && <p className="flow-panel__error" role="alert">{error}</p>}
            <div className="flow-from-text__actions">
                <span className="flow-hint">{t('flows.fromText.shortcut')}</span>
                <Button onClick={() => void submit()} isLoading={busy} disabled={sentence.trim().length < 8}
                    icon={<span className="material-symbols-outlined">auto_awesome</span>}>
                    {t('flows.fromText.create')}
                </Button>
            </div>
        </div>
    );
};
