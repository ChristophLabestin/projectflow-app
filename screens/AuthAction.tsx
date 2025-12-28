import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset, checkActionCode } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';

type Status = 'loading' | 'success' | 'error' | 'reset-password';

export const AuthAction = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showError, showSuccess } = useToast();
    const { t } = useLanguage();

    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    const [status, setStatus] = useState<Status>('loading');
    const [message, setMessage] = useState('Processing your request...');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!mode || !oobCode) {
            setStatus('error');
            setMessage('The action link is invalid or has expired.');
            return;
        }

        const handleAction = async () => {
            try {
                switch (mode) {
                    case 'verifyEmail':
                        await applyActionCode(auth, oobCode);
                        setStatus('success');
                        setMessage('Your email address has been verified. You can now access all features of ProjectFlow.');
                        showSuccess('Email verified successfully!');
                        break;
                    case 'resetPassword':
                        await verifyPasswordResetCode(auth, oobCode);
                        setStatus('reset-password');
                        break;
                    case 'recoverEmail':
                        await applyActionCode(auth, oobCode);
                        setStatus('success');
                        setMessage('Your email address has been recovered successfully.');
                        break;
                    default:
                        setStatus('error');
                        setMessage('This action is not supported.');
                }
            } catch (error: any) {
                console.error('Auth Action Error:', error);
                setStatus('error');
                setMessage(error.message || 'An error occurred while processing your request.');
            }
        };

        handleAction();
    }, [mode, oobCode, showSuccess]);

    const handleConfirmReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            showError('Password should be at least 6 characters');
            return;
        }

        setProcessing(true);
        try {
            await confirmPasswordReset(auth, oobCode!, newPassword);
            showSuccess('Password has been reset successfully!');
            setStatus('success');
            setMessage('Your password has been updated. You can now sign in with your new password.');
        } catch (error: any) {
            showError(error.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-surface-bg)] p-4">
            <Card className="max-w-md w-full p-8 shadow-2xl border-[var(--color-surface-border)] overflow-hidden relative">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full -ml-16 -mb-16 blur-3xl" />

                <div className="relative z-10 space-y-6">
                    <div className="flex justify-center">
                        <div className="size-16 rounded-2xl bg-[var(--color-surface-hover)] flex items-center justify-center shadow-inner">
                            {status === 'loading' && <span className="material-symbols-outlined text-4xl text-[var(--color-primary)] animate-spin">progress_activity</span>}
                            {status === 'success' && <span className="material-symbols-outlined text-4xl text-emerald-500">check_circle</span>}
                            {status === 'error' && <span className="material-symbols-outlined text-4xl text-rose-500">error</span>}
                            {status === 'reset-password' && <span className="material-symbols-outlined text-4xl text-[var(--color-primary)]">lock_reset</span>}
                        </div>
                    </div>

                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-display font-bold text-[var(--color-text-main)]">
                            {status === 'loading' && 'Processing...'}
                            {status === 'success' && 'Success!'}
                            {status === 'error' && 'Action Failed'}
                            {status === 'reset-password' && 'Reset Password'}
                        </h1>
                        <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
                            {message}
                        </p>
                    </div>

                    {status === 'reset-password' && (
                        <form onSubmit={handleConfirmReset} className="space-y-4 pt-4">
                            <Input
                                type="password"
                                label="New Password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min. 6 characters"
                                required
                                autoFocus
                            />
                            <Input
                                type="password"
                                label="Confirm New Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat new password"
                                required
                            />
                            <Button type="submit" className="w-full h-11" loading={processing}>
                                Update Password
                            </Button>
                        </form>
                    )}

                    {(status === 'success' || status === 'error') && (
                        <div className="pt-6">
                            <Button
                                className="w-full h-11"
                                variant={status === 'error' ? 'outline' : 'primary'}
                                onClick={() => navigate('/login')}
                            >
                                Back to Login
                            </Button>
                        </div>
                    )}

                    {status === 'success' && !auth.currentUser && (
                        <p className="text-center text-xs text-[var(--color-text-muted)] pt-4">
                            Verification complete. Please sign in to continue.
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
};
