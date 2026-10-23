import React, { useState } from 'react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import { auth } from '../../services/firebase';
import { isCrashReportingEnabled, setCrashReportingEnabled } from '../../services/errorReporting';
import { SettingsSwitch } from './SettingsSwitch';
import {
    AccountDeletionError,
    SharedWorkspaceBlocker,
    deleteMyAccount,
    exportMyData,
    getReauthMethod,
    reauthenticateCurrentUser,
    signOutAfterAccountDeletion,
} from '../../services/domain/accountDataService';

/** GDPR self-service: data export (Art. 20) and account erasure (Art. 17). */
export const AccountDataSection: React.FC = () => {
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const email = auth.currentUser?.email || '';

    const [crashReports, setCrashReports] = useState(isCrashReportingEnabled);
    const [exporting, setExporting] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [needsReauth, setNeedsReauth] = useState(false);
    const [password, setPassword] = useState('');
    const [blockers, setBlockers] = useState<SharedWorkspaceBlocker[]>([]);

    const reauthMethod = getReauthMethod();
    const emailMatches = email !== '' && confirmEmail.trim().toLowerCase() === email.toLowerCase();

    const handleExport = async () => {
        setExporting(true);
        try {
            await exportMyData();
            showSuccess(t('accountData.export.success'));
        } catch (error) {
            console.error('Data export failed', error);
            showError(t('accountData.export.error'));
        } finally {
            setExporting(false);
        }
    };

    const closeDialog = () => {
        if (deleting) return;
        setDialogOpen(false);
        setConfirmEmail('');
        setPassword('');
        setNeedsReauth(false);
        setBlockers([]);
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            if (needsReauth) {
                await reauthenticateCurrentUser(password);
                setNeedsReauth(false);
                setPassword('');
            }
            await deleteMyAccount();
            await signOutAfterAccountDeletion();
        } catch (error: any) {
            if (error instanceof AccountDeletionError && error.code === 'recent-login-required') {
                setNeedsReauth(true);
            } else if (error instanceof AccountDeletionError && error.code === 'owner-of-shared-workspaces') {
                setBlockers(error.workspaces);
            } else if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
                showError(t('accountData.delete.wrongPassword'));
            } else if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
                // User aborted the re-authentication prompt.
            } else {
                console.error('Account deletion failed', error);
                showError(t('accountData.delete.error'));
            }
        } finally {
            setDeleting(false);
        }
    };

    const toggleCrashReports = (enabled: boolean) => {
        setCrashReportingEnabled(enabled);
        setCrashReports(enabled);
    };

    return (
        <>
            <section className="p-6 rounded-2xl bg-surface-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-[14rem] flex-1">
                        <h3 className="font-bold text-main text-lg">{t('accountData.crash.title')}</h3>
                        <p className="text-sm text-muted mt-1">{t('accountData.crash.description')}</p>
                    </div>
                    <SettingsSwitch checked={crashReports} onChange={toggleCrashReports} label={t('accountData.crash.label')} />
                </div>
            </section>

            <section className="p-6 rounded-2xl bg-surface-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-[14rem] flex-1">
                        <h3 className="font-bold text-main text-lg">{t('accountData.export.title')}</h3>
                        <p className="text-sm text-muted mt-1">{t('accountData.export.description')}</p>
                    </div>
                    <Button variant="secondary" onClick={handleExport} loading={exporting}
                        icon={<span className="material-symbols-outlined text-[18px]">download</span>}>
                        {t('accountData.export.button')}
                    </Button>
                </div>
            </section>

            <section className="p-6 rounded-2xl bg-surface-card shadow-sm border border-error/30">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-[14rem] flex-1">
                        <h3 className="font-bold text-error text-lg">{t('accountData.delete.title')}</h3>
                        <p className="text-sm text-muted mt-1">{t('accountData.delete.description')}</p>
                    </div>
                    <Button variant="danger" onClick={() => setDialogOpen(true)}>
                        {t('accountData.delete.button')}
                    </Button>
                </div>
            </section>

            <Modal
                isOpen={dialogOpen}
                onClose={closeDialog}
                title={t('accountData.delete.dialogTitle')}
                size="md"
                footer={(
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={closeDialog} disabled={deleting}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            loading={deleting}
                            disabled={!emailMatches || blockers.length > 0 || (needsReauth && reauthMethod === 'password' && !password)}
                        >
                            {needsReauth ? t('accountData.delete.reauthButton') : t('accountData.delete.confirmButton')}
                        </Button>
                    </div>
                )}
            >
                <div className="space-y-4">
                    <p className="text-sm text-muted">{t('accountData.delete.warning')}</p>

                    {blockers.length > 0 && (
                        <div className="p-4 rounded-xl bg-error/10 text-sm text-main space-y-2">
                            <p className="font-medium">{t('accountData.delete.blockedIntro')}</p>
                            <ul className="list-disc pl-5">
                                {blockers.map((workspace) => (
                                    <li key={workspace.tenantId}>{workspace.name}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <Input
                        label={t('accountData.delete.typeEmail').replace('{email}', email)}
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        placeholder={email}
                        autoComplete="off"
                    />

                    {needsReauth && (
                        <div className="p-4 rounded-xl bg-warning/10 text-sm text-main space-y-3">
                            <p>{t('accountData.delete.reauthRequired')}</p>
                            {reauthMethod === 'password' && (
                                <Input
                                    label={t('accountData.delete.passwordLabel')}
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
};
