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

    useEffect(() => {
        console.log('AuthAction Component Mounted', { mode, oobCode, pathname: window.location.pathname });
    }, [mode, oobCode]);
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
                        setMessage(email ? `The email address ${email} has been verified successfully.` : 'Your email address has been verified successfully.');
                        showSuccess('Email verified successfully!');
                        break;
                    case 'resetPassword':
                        setStatus('reset-password');
                        setMessage(email ? `Updating password for ${email}` : 'Update your password below.');
                        break;
                    case 'recoverEmail':
                        console.log('Applying recoverEmail...');
                        await applyActionCode(auth, oobCode!);
                        setStatus('success');
                        setMessage(email ? `The email address ${email} has been recovered successfully.` : 'Your email address has been recovered successfully.');
                        break;
                    default:
                        setStatus('error');
                        setMessage('This action is not supported or the link has expired.');
                }
            } catch (error: any) {
                console.error('Final Auth Action Error:', error);
                setStatus('error');

                if (error.code === 'auth/invalid-action-code') {
                    setMessage('This link has already been used or is invalid. Please check if your email is already verified in your settings.');
                } else if (error.code === 'auth/action-code-expired') {
                    setMessage('This link has expired. Please request a new verification email from your settings.');
                } else if (error.code === 'auth/user-not-found') {
                    setMessage('The user associated with this link could not be found.');
                } else {
                    setMessage(error.message || 'An error occurred while processing your request.');
                }
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
        <div className="auth-action-page">
            <Card className="auth-action-card">
                {/* Background Decor */}
                <div className="auth-bg-decor top-right" />
                <div className="auth-bg-decor bottom-left" />

                <div className="auth-content">
                    <div className="auth-status-icon">
                        <div className="icon-wrapper">
                            {status === 'loading' && <span className="material-symbols-outlined loading animate-spin">progress_activity</span>}
                            {status === 'success' && <span className="material-symbols-outlined success">check_circle</span>}
                            {status === 'error' && <span className="material-symbols-outlined error">error</span>}
                            {status === 'reset-password' && <span className="material-symbols-outlined reset">lock_reset</span>}
                        </div>
                    </div>

                    <div className="auth-text">
                        <h1>
                            {status === 'loading' && 'Processing...'}
                            {status === 'success' && 'Success!'}
                            {status === 'error' && 'Action Failed'}
                            {status === 'reset-password' && 'Reset Password'}
                        </h1>
                        <p>
                            {message}
                        </p>
                    </div>

                    {status === 'reset-password' && (
                        <form onSubmit={handleConfirmReset} className="auth-form">
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
                            <Button type="submit" className="btn-update" loading={processing}>
                                Update Password
                            </Button>
                        </form>
                    )}

                    {(status === 'success' || status === 'error') && (
                        <div className="auth-actions">
                            <Button
                                className="btn-back"
                                variant={status === 'error' ? 'outline' : 'primary'}
                                onClick={() => navigate('/login')}
                            >
                                Back to Login
                            </Button>
                        </div>
                    )}

                    {status === 'success' && !auth.currentUser && (
                        <p className="auth-footer">
                            Verification complete. Please sign in to continue.
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
};
