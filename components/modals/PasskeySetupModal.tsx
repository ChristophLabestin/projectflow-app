import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { registerPasskey } from '../../services/passkeyService';
import { useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';

interface PasskeySetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSetupComplete: () => void;
}

export const PasskeySetupModal: React.FC<PasskeySetupModalProps> = ({ isOpen, onClose, onSetupComplete }) => {
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [deviceName, setDeviceName] = useState('');

    const handleSetup = async () => {
        setLoading(true);
        try {
            await registerPasskey(deviceName);
            showSuccess(t('passkey.setup.success'));
            onSetupComplete();
            onClose();
        } catch (error: any) {
            console.error('Passkey setup failed:', error);
            // Don't show error if user cancelled
            if (error.name !== 'NotAllowedError' && !error.message.includes('canceled')) {
                showError(t('passkey.setup.error'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDoLater = () => {
        // Save timestamp to localStorage to remind later (e.g., 7 days)
        const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem('projectflow_passkey_reminder_snooze', (Date.now() + ONE_WEEK).toString());
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => !loading && onClose()}
            title={t('passkey.setup.title')}
            size="sm"
        >
            <div className="flex flex-col items-center text-center">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-3xl">fingerprint</span>
                </div>

                <p className="text-[var(--color-text-muted)] mb-6">
                    {t('passkey.setup.description')}
                </p>



                <div className="w-full mb-4">
                    <Input
                        label={t('passkey.setup.device_name_label') || "Device Name (Optional)"}
                        placeholder={t('passkey.setup.device_name_placeholder') || "e.g. MacBook Pro"}
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        disabled={loading}
                    />
                </div>

                <div className="w-full flex flex-col gap-3">
                    <Button
                        onClick={handleSetup}
                        isLoading={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white justify-center"
                    >
                        <span className="material-symbols-outlined mr-2 text-[18px]">fingerprint</span>
                        {t('passkey.setup.action.setup')}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={handleDoLater}
                        className="w-full text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] justify-center"
                        disabled={loading}
                    >
                        {t('passkey.setup.action.later')}
                    </Button>
                </div>
            </div>
        </Modal >
    );
};
