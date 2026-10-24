import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    EmailAuthProvider, getMultiFactorResolver, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup,
    TotpMultiFactorGenerator, type MultiFactorResolver,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Fresh re-authentication incl. the TOTP second factor (admin MCP consent needs auth_time ≤ 5 min).
 * Resolves true once the new ID token is in place.
 */
export const ReauthDialog: React.FC<{ onDone: (ok: boolean) => void }> = ({ onDone }) => {
    const user = auth.currentUser;
    const providers = user?.providerData.map((p) => p.providerId) || [];
    const [password, setPassword] = useState('');
    const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const finish = async () => { await auth.currentUser?.getIdToken(true); onDone(true); };
    const run = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
            await finish();
        } catch (err: any) {
            if (err?.code === 'auth/multi-factor-auth-required') setResolver(getMultiFactorResolver(auth, err));
            else setError(err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' ? 'Passwort ist falsch.' : err?.code === 'auth/invalid-verification-code' ? 'Der Code stimmt nicht.' : err?.message || 'Fehlgeschlagen');
        } finally {
            setBusy(false);
        }
    };

    return createPortal(
        <>
            <div className="ac-overlay ac-overlay--dialog" />
            <div className="ac-dialog" role="dialog" aria-modal="true">
                <div className="ac-dialog__body">
                    <h3>Identität bestätigen</h3>
                    {!resolver ? (
                        <>
                            <p>Für die Admin-MCP-Freigabe ist eine frische Anmeldung mit zweitem Faktor nötig.</p>
                            {providers.includes('google.com') && <button className="ac-btn ac-btn--block" disabled={busy} onClick={() => run(() => reauthenticateWithPopup(user!, new GoogleAuthProvider()))}>Mit Google bestätigen</button>}
                            {providers.includes('password') && (
                                <form className="ac-stack" onSubmit={(e) => { e.preventDefault(); void run(() => reauthenticateWithCredential(user!, EmailAuthProvider.credential(user!.email!, password))); }}>
                                    <input className="ac-input ac-input--lg" type="password" autoFocus autoComplete="current-password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} />
                                    <button className="ac-btn ac-btn--primary ac-btn--block" disabled={busy || !password}>Weiter</button>
                                </form>
                            )}
                        </>
                    ) : (
                        <form className="ac-stack" onSubmit={(e) => {
                            e.preventDefault();
                            const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) ?? resolver.hints[0];
                            void run(() => resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim())));
                        }}>
                            <p>Code aus deiner Authenticator-App:</p>
                            <input className="ac-input ac-input--lg mono" autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                            <button className="ac-btn ac-btn--primary ac-btn--block" disabled={busy || code.length !== 6}>Bestätigen</button>
                        </form>
                    )}
                    {error && <div className="ac-alert ac-alert--error">{error}</div>}
                </div>
                <div className="ac-dialog__foot"><button className="ac-btn" onClick={() => onDone(false)}>Abbrechen</button></div>
            </div>
        </>,
        document.body
    );
};
