import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { applyActionCode, confirmPasswordReset, checkActionCode } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Card, CardBody } from '../components/common/Card/Card';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';
import { useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import './auth-action.scss';

type Status = 'loading' | 'success' | 'error' | 'reset-password';

export const AuthAction = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showError, showSuccess } = useToast();
    const { t } = useLanguage();

    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    const [status, setStatus] = useState<Status>('loading');
    const [message, setMessage] = useState(() => t('authAction.message.processing'));

    useEffect(() => {
        console.log('AuthAction Component Mounted', { mode, oobCode, pathname: window.location.pathname });
    }, [mode, oobCode]);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!mode || !oobCode) {
            setStatus('error');
            setMessage(t('authAction.message.invalidLink'));
            return;
        }

        const handleAction = async () => {
            console.log('Starting auth action:', { mode, oobCode });
            try {
                let email = '';
                let finalMode = mode;

                try {
                    // First check what this code is for
                    const info = await checkActionCode(auth, oobCode!);
                    const operation = info.operation;
                    email = info.data.email || '';
                    console.log('Action code info:', info);

                    // If the URL mode is generic, use the operation from Firebase
                    if (mode === 'action' || !mode) {
                        finalMode = operation === 'VERIFY_EMAIL' ? 'verifyEmail' :
                            operation === 'PASSWORD_RESET' ? 'resetPassword' :
                                operation === 'RECOVER_EMAIL' ? 'recoverEmail' : mode;
                    }
                } catch (checkError: any) {
                    console.error('checkActionCode failed:', checkError);
                    // If checkActionCode fails, we might still want to try applyActionCode if mode is verifyEmail
                    if (mode !== 'verifyEmail') throw checkError;
                }

                switch (finalMode) {
                    case 'verifyEmail':
                        console.log('Applying verifyEmail...');
                        await applyActionCode(auth, oobCode!);
                        setStatus('success');
                        setMessage(
                            email
                                ? t('authAction.message.verifySuccessWithEmail').replace('{email}', email)
                                : t('authAction.message.verifySuccess')
                        );
                        showSuccess(t('authAction.toast.verifySuccess'));
                        break;
                    case 'resetPassword':
                        setStatus('reset-password');
                        setMessage(
                            email
                                ? t('authAction.message.resetPromptWithEmail').replace('{email}', email)
                                : t('authAction.message.resetPrompt')
                        );
                        break;
                    case 'recoverEmail':
                        console.log('Applying recoverEmail...');
                        await applyActionCode(auth, oobCode!);
                        setStatus('success');
                        setMessage(
                            email
                                ? t('authAction.message.recoverSuccessWithEmail').replace('{email}', email)
                                : t('authAction.message.recoverSuccess')
                        );
                        break;
                    default:
                        setStatus('error');
                        setMessage(t('authAction.message.unsupported'));
                }
            } catch (error: any) {
                console.error('Final Auth Action Error:', error);
                setStatus('error');

                if (error.code === 'auth/invalid-action-code') {
                    setMessage(t('authAction.error.usedOrInvalid'));
                } else if (error.code === 'auth/action-code-expired') {
                    setMessage(t('authAction.error.expired'));
                } else if (error.code === 'auth/user-not-found') {
                    setMessage(t('authAction.error.userNotFound'));
                } else {
                    setMessage(error.message || t('authAction.error.generic'));
                }
            }
        };

        handleAction();
    }, [mode, oobCode, showSuccess, t]);

    const handleConfirmReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showError(t('authAction.error.passwordsMismatch'));
            return;
        }
        if (newPassword.length < 6) {
            showError(t('authAction.error.passwordTooShort'));
            return;
        }

        setProcessing(true);
        try {
            await confirmPasswordReset(auth, oobCode!, newPassword);
            showSuccess(t('authAction.toast.passwordReset'));
            setStatus('success');
            setMessage(t('authAction.message.passwordUpdated'));
        } catch (error: any) {
            showError(error.message);
        } finally {
            setProcessing(false);
        }
    };

    const statusTitle = useMemo(() => ({
        loading: t('authAction.status.processing'),
        success: t('authAction.status.success'),
        error: t('authAction.status.error'),
        'reset-password': t('authAction.status.resetPassword'),
    }[status]), [status, t]);

    const statusIconClass = [
        'auth-action__status-icon',
        status === 'loading' ? 'auth-action__status-icon--loading' : '',
        status === 'success' ? 'auth-action__status-icon--success' : '',
        status === 'error' ? 'auth-action__status-icon--error' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className="auth-action">
            <Card className="auth-action__card">
                <div className="auth-action__decor auth-action__decor--top" />
                <div className="auth-action__decor auth-action__decor--bottom" />

                <CardBody className="auth-action__body">
                    <div className="auth-action__status">
                        <div className={statusIconClass}>
                            {status === 'loading' && <span className="material-symbols-outlined">progress_activity</span>}
                            {status === 'success' && <span className="material-symbols-outlined">check_circle</span>}
                            {status === 'error' && <span className="material-symbols-outlined">error</span>}
                            {status === 'reset-password' && <span className="material-symbols-outlined">lock_reset</span>}
                        </div>
                    </div>

                    <div>
                        <h1 className="auth-action__title">{statusTitle}</h1>
                        <p className="auth-action__message">{message}</p>
                    </div>

                    {status === 'reset-password' && (
                        <form onSubmit={handleConfirmReset} className="auth-action__form">
                            <TextInput
                                type="password"
                                label={t('authAction.form.newPassword.label')}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder={t('authAction.form.newPassword.placeholder')}
                                required
                                autoFocus
                            />
                            <TextInput
                                type="password"
                                label={t('authAction.form.confirmPassword.label')}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder={t('authAction.form.confirmPassword.placeholder')}
                                required
                            />
                            <Button type="submit" className="auth-action__action" isLoading={processing}>
                                {t('authAction.form.submit')}
                            </Button>
                        </form>
                    )}

                    {(status === 'success' || status === 'error') && (
                        <div className="auth-action__actions">
                            <Button
                                className="auth-action__action"
                                variant={status === 'error' ? 'secondary' : 'primary'}
                                onClick={() => navigate('/login')}
                            >
                                {t('authAction.actions.backToLogin')}
                            </Button>
                        </div>
                    )}

                    {status === 'success' && !auth.currentUser && (
                        <p className="auth-action__footer">
                            {t('authAction.footer.verificationComplete')}
                        </p>
                    )}
                </CardBody>
            </Card>
        </div>
    );
};
