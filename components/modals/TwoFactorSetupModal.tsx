import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/UIContext';
import { auth } from '../../services/firebase';
import {
    multiFactor,
    TotpMultiFactorGenerator,
    TotpSecret,
    EmailAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    GoogleAuthProvider,
    GithubAuthProvider,
    sendEmailVerification
} from 'firebase/auth';
import QRCode from 'qrcode';

interface TwoFactorSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'intro' | 'reauth' | 'verify-email' | 'scan' | 'verify' | 'success';

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState<Step>('intro');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [secret, setSecret] = useState<TotpSecret | null>(null);
    const [loading, setLoading] = useState(false);
    const [sendingVerification, setSendingVerification] = useState(false);
    const { showSuccess, showError } = useToast();

    const [reauthProvider, setReauthProvider] = useState<string>('password');
    const [availableProviders, setAvailableProviders] = useState<string[]>([]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen && auth.currentUser) {
            setStep('intro');
            setPassword('');
            setVerificationCode('');
            setQrCodeUrl('');
            setSecret(null);
            setLoading(false);

            // Determine available providers
            const providers = auth.currentUser.providerData.map(p => p.providerId);
            // Also include 'password' if the user has a password (it's not always in providerData if set via linkWithCredential sometimes)
            // But usually 'password' matches the email provider. 
            // Let's check for 'password' provider specifically.
            const hasPassword = providers.includes('password');
            const allProviders = [...new Set([...providers])];

            setAvailableProviders(allProviders);

            if (allProviders.includes('github.com')) setReauthProvider('github.com');
            else if (allProviders.includes('google.com')) setReauthProvider('google.com');
            else if (allProviders.includes('password')) setReauthProvider('password');
            else setReauthProvider('password'); // Fallback
        }
    }, [isOpen]);

    const handleReauth = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        try {
            // Check if email is verified BEFORE re-auth if possible, but Firebase often requires re-auth for some actions anyway.
            // Actually, the error happens when calling getSession/generateSecret if email is unverified.

            if (reauthProvider === 'password') {
                if (!password) {
                    showError('Please enter your password');
                    setLoading(false);
                    return;
                }
                const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);
                await reauthenticateWithCredential(auth.currentUser, credential);
            } else {
                const provider = reauthProvider === 'github.com'
                    ? new GithubAuthProvider()
                    : new GoogleAuthProvider();
                await reauthenticateWithPopup(auth.currentUser, provider);
            }

            // After successful re-auth, check if email is verified
            await auth.currentUser.reload();
            if (!auth.currentUser.emailVerified) {
                setStep('verify-email');
                setLoading(false);
                return;
            }

            // Generate TOTP Secret
            const session = await multiFactor(auth.currentUser).getSession();
            const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);

            setSecret(totpSecret);

            const url = await QRCode.toDataURL(totpSecret.generateQrCodeUrl(
                auth.currentUser.email!,
                'ProjectFlow'
            ));
            setQrCodeUrl(url);
            setStep('scan');
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/unverified-email') {
                setStep('verify-email');
            } else {
                showError('Authentication failed: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendVerificationEmail = async () => {
        if (!auth.currentUser) return;
        setSendingVerification(true);
        try {
            await sendEmailVerification(auth.currentUser);
            showSuccess('Verification email sent! Please check your inbox.');
        } catch (error: any) {
            console.error(error);
            showError('Failed to send verification email: ' + error.message);
        } finally {
            setSendingVerification(false);
        }
    };

    const handleCheckVerification = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        try {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
                // If verified, proceed to generate secret
                await handleReauth();
            } else {
                showError('Email not verified. Please check your inbox and click the link.');
            }
        } catch (error: any) {
            console.error(error);
            showError('Failed to check verification status: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!auth.currentUser || !secret || !verificationCode) return;
        setLoading(true);
        try {
            const multiFactorAssertion = TotpMultiFactorGenerator.assertionForEnrollment(
                secret,
                verificationCode
            );
            await multiFactor(auth.currentUser).enroll(multiFactorAssertion, "Authenticator App");
            setStep('success');
            showSuccess('Two-factor authentication enabled successfully!');
        } catch (error: any) {
            console.error(error);
            showError('Verification failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderContent = () => {
        switch (step) {
            case 'intro':
                return (
                    <div className="space-y-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl flex items-start gap-4">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-lg text-indigo-600 dark:text-indigo-300">
                                <span className="material-symbols-outlined">security</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-main">Secure your account</h3>
                                <p className="text-sm text-muted mt-1">
                                    Two-factor authentication adds an extra layer of security to your account.
                                    Once enabled, you'll need to enter a code from your authenticator app when you sign in.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button onClick={() => setStep('reauth')}>Get Started</Button>
                        </div>
                    </div>
                );
            case 'reauth':
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-muted">
                            Confirm your identity to continue.
                        </p>

                        {availableProviders.length > 1 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {availableProviders.map(provider => (
                                    <button
                                        key={provider}
                                        onClick={() => setReauthProvider(provider)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${reauthProvider === provider
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-surface border-surface hover:bg-surface-hover text-muted'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">
                                            {provider === 'password' ? 'lock' : 'link'}
                                        </span>
                                        {provider === 'password' ? 'Password' : (provider.includes('github') ? 'GitHub' : 'Google')}
                                    </button>
                                ))}
                            </div>
                        )}

                        {reauthProvider === 'password' ? (
                            <Input
                                type="password"
                                placeholder="Current Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleReauth()}
                                autoFocus
                            />
                        ) : (
                            <div className="py-4 flex justify-center">
                                <Button
                                    onClick={handleReauth}
                                    loading={loading}
                                    variant="outline"
                                    className="flex items-center gap-2"
                                >
                                    <img
                                        src={reauthProvider === 'github.com'
                                            ? "https://www.svgrepo.com/show/512317/github-142.svg"
                                            : "https://www.svgrepo.com/show/475656/google-color.svg"
                                        }
                                        className={`w-5 h-5 ${reauthProvider === 'github.com' ? 'dark:invert' : ''}`}
                                        alt={reauthProvider}
                                    />
                                    Verify with {reauthProvider === 'github.com' ? 'GitHub' : 'Google'}
                                </Button>
                            </div>
                        )}

                        <div className="flex justify-between pt-4">
                            <Button variant="ghost" onClick={() => setStep('intro')}>Back</Button>
                            {reauthProvider === 'password' && (
                                <Button onClick={handleReauth} loading={loading}>Confirm Password</Button>
                            )}
                        </div>
                    </div>
                );
            case 'verify-email':
                return (
                    <div className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl flex items-start gap-4">
                            <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300">
                                <span className="material-symbols-outlined">mark_email_unread</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-main">Verify your email</h3>
                                <p className="text-sm text-muted mt-1">
                                    Firebase requires a verified email address before you can enable two-factor authentication.
                                </p>
                            </div>
                        </div>

                        <div className="py-4 space-y-3">
                            <Button
                                className="w-full"
                                variant="outline"
                                onClick={handleSendVerificationEmail}
                                loading={sendingVerification}
                            >
                                Send Verification Email
                            </Button>
                            <p className="text-[10px] text-center text-muted">
                                Once you've clicked the link in your email, click the button below.
                            </p>
                        </div>

                        <div className="flex justify-between pt-4 border-t border-surface">
                            <Button variant="ghost" onClick={() => setStep('reauth')}>Back</Button>
                            <Button onClick={handleCheckVerification} loading={loading}>
                                I've Verified My Email
                            </Button>
                        </div>
                    </div>
                );
            case 'scan':
                return (
                    <div className="space-y-6 text-center">
                        <div>
                            <h3 className="font-bold text-main mb-2">Scan QR Code</h3>
                            <p className="text-sm text-muted">
                                Open your authenticator app (like Google Authenticator or Authy) and scan this code.
                            </p>
                        </div>

                        <div className="flex justify-center my-6">
                            {qrCodeUrl ? (
                                <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                                    <img src={qrCodeUrl} alt="QR Code" className="w-[200px] h-[200px]" />
                                </div>
                            ) : (
                                <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded-xl">
                                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                </div>
                            )}
                        </div>

                        {secret && (
                            <div className="text-xs text-muted">
                                <p>Can't scan?</p>
                                <p className="font-mono mt-1 select-all bg-gray-100 dark:bg-gray-800 p-2 rounded inline-block">
                                    {secret.secretKey}
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button onClick={() => setStep('verify')}>Next</Button>
                        </div>
                    </div>
                );
            case 'verify':
                return (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <span className="material-symbols-outlined text-4xl text-primary mb-2">lock_clock</span>
                            <h3 className="font-bold text-main">Enter Verification Code</h3>
                            <p className="text-sm text-muted">
                                Enter the 6-digit code generated by your authenticator app.
                            </p>
                        </div>

                        <Input
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000 000"
                            className="text-center text-2xl tracking-[0.2em] font-mono"
                            autoFocus
                        />

                        <div className="flex justify-between pt-4">
                            <Button variant="ghost" onClick={() => setStep('scan')}>Back</Button>
                            <Button
                                onClick={handleVerifyCode}
                                loading={loading}
                                disabled={verificationCode.length !== 6}
                            >
                                Verify & Enable
                            </Button>
                        </div>
                    </div>
                );
            case 'success':
                return (
                    <div className="text-center space-y-4 py-8">
                        <div className="size-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">check_circle</span>
                        </div>
                        <h3 className="text-xl font-bold text-main">Two-Factor Authentication Enabled</h3>
                        <p className="text-muted max-w-xs mx-auto">
                            Your account is now more secure. You will be asked for a code when you sign in from a new device.
                        </p>
                        <div className="pt-6">
                            <Button onClick={onClose} className="w-full">Done</Button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Setup Two-Factor Authentication" size="md">
            <div className="p-6">
                {renderContent()}
            </div>
        </Modal>
    );
};
