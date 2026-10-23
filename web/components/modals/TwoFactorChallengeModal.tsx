import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import { TotpMultiFactorGenerator, MultiFactorResolver } from 'firebase/auth';

interface TwoFactorChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    resolver: MultiFactorResolver | null;
    onSuccess: (credential?: any) => void;
}

export const TwoFactorChallengeModal: React.FC<TwoFactorChallengeModalProps> = ({ isOpen, onClose, resolver, onSuccess }) => {
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { showError, showSuccess } = useToast();
    const { t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resolver || !verificationCode) return;

        setLoading(true);
        try {
            const hint = resolver.hints[0];
            const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, verificationCode);
            const result = await resolver.resolveSignIn(assertion);
            showSuccess(t('twoFactor.verifySuccess'));
            onSuccess(result as any);
            onClose();
        } catch (error: any) {
            console.error(error);
            showError(error.message || t('twoFactor.invalidCode'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('twoFactor.challenge.title')} size="sm">
            <div className="p-6">
                <div className="text-center mb-6">
                    <span className="material-symbols-outlined text-4xl text-primary mb-2">lock_clock</span>
                    <h3 className="font-bold text-main">{t('twoFactor.enterCode')}</h3>
                    <p className="text-sm text-muted">
                        {t('twoFactor.challenge.hint')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000 000"
                        className="text-center text-2xl tracking-[0.5em] font-mono"
                        autoFocus
                    />

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                        <Button
                            type="submit"
                            loading={loading}
                            disabled={verificationCode.length !== 6}
                        >
                            {t('twoFactor.verify')}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};
