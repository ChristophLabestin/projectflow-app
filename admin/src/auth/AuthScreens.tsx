import React, { useEffect, useState } from 'react';
import {
    GoogleAuthProvider, getMultiFactorResolver, multiFactor, signInWithEmailAndPassword, signInWithPopup,
    TotpMultiFactorGenerator, type MultiFactorResolver, type TotpSecret,
} from 'firebase/auth';
import QRCode from 'qrcode';
import { KeyRound, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { BrandMark, FlowField } from '@pf/brand';
import { auth } from '../lib/firebase';
import { REASON_TEXT, useSession } from './session';

const AUTH_ERRORS: Record<string, string> = {
    'auth/invalid-credential': 'E-Mail oder Passwort ist falsch.',
    'auth/invalid-verification-code': 'Der Code stimmt nicht.',
    'auth/popup-closed-by-user': 'Das Anmeldefenster wurde geschlossen.',
    'auth/too-many-requests': 'Zu viele Versuche. Bitte warte einen Moment.',
    'auth/requires-recent-login': 'Bitte melde dich erneut an und versuche es dann noch einmal.',
    'auth/unverified-email': 'Bestätige zuerst deine E-Mail-Adresse.',
};
const message = (error: any) => AUTH_ERRORS[error?.code] || error?.message || 'Anmeldung fehlgeschlagen.';

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="ac-auth">
        <div className="ac-auth__art">
            <FlowField className="ac-auth__field" tone="onDark" originX={0.3} originY={0.6} />
            <BrandMark size="lg" />
            <h2>ProjectFlow Admin</h2>
            <p>Plattform-Konsole für Betrieb, Support und Recht. Zugang nur für Plattform-Admins mit zweitem Faktor. Jede Aktion wird protokolliert.</p>
        </div>
        <div className="ac-auth__panel">{children}</div>
    </div>
);

export const LoginScreen: React.FC = () => {
    const { reason } = useSession();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
    const [code, setCode] = useState('');

    const handle = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
        } catch (err: any) {
            if (err?.code === 'auth/multi-factor-auth-required') setResolver(getMultiFactorResolver(auth, err));
            else setError(message(err));
        } finally {
            setBusy(false);
        }
    };

    const verifyTotp = (event: React.FormEvent) => {
        event.preventDefault();
        if (!resolver) return;
        const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) ?? resolver.hints[0];
        void handle(() => resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim())));
    };

    if (resolver) {
        return (
            <Frame>
                <h1>Zweiter Faktor</h1>
                <p className="lead">Gib den 6-stelligen Code aus deiner Authenticator-App ein.</p>
                <form className="ac-auth__form" onSubmit={verifyTotp}>
                    <input className="ac-input ac-input--lg mono" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                    <button className="ac-btn ac-btn--primary ac-btn--block" disabled={busy || code.length !== 6}>Bestätigen</button>
                    <button type="button" className="ac-btn ac-btn--ghost" onClick={() => { setResolver(null); setCode(''); }}>Zurück</button>
                </form>
                {error && <div className="ac-alert ac-alert--error">{error}</div>}
            </Frame>
        );
    }

    return (
        <Frame>
            <h1>Anmelden</h1>
            <p className="lead">Melde dich mit deinem ProjectFlow-Konto an.</p>
            {reason && REASON_TEXT[reason] && <div className="ac-alert ac-alert--info">{REASON_TEXT[reason]}</div>}
            <button className="ac-btn ac-btn--block" disabled={busy} onClick={() => handle(() => signInWithPopup(auth, new GoogleAuthProvider()))}>
                <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
                Mit Google anmelden
            </button>
            <div className="ac-auth__divider">oder</div>
            <form className="ac-auth__form" onSubmit={(e) => { e.preventDefault(); void handle(() => signInWithEmailAndPassword(auth, email.trim(), password)); }}>
                <input className="ac-input ac-input--lg" type="email" autoComplete="username" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="ac-input ac-input--lg" type="password" autoComplete="current-password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="ac-btn ac-btn--primary ac-btn--block" disabled={busy || !email || !password}>Anmelden</button>
            </form>
            {error && <div className="ac-alert ac-alert--error">{error}</div>}
            <p className="ac-auth__note"><ShieldCheck size={14} /> Zweiter Faktor (TOTP) ist Pflicht. Die Sitzung endet nach 15 Minuten Inaktivität und mit dem Schließen des Tabs.</p>
        </Frame>
    );
};

export const NoAccessScreen: React.FC = () => {
    const { email, logout, reason } = useSession();
    return (
        <Frame>
            <ShieldAlert size={28} />
            <h1>Kein Zugang</h1>
            <p className="lead">{email ? <><b>{email}</b> ist </> : 'Dieses Konto ist '}nicht für die Admin-Konsole freigeschaltet.{reason === 'not-allowlisted' ? ' Der Eintrag auf der serverseitigen Allowlist fehlt.' : ''}</p>
            <button className="ac-btn ac-btn--block" onClick={() => logout('signed-out')}><LogOut size={14} />Abmelden</button>
        </Frame>
    );
};

/** First sign-in without a second factor: enrol TOTP, then sign in again (the new token carries the factor). */
export const EnrollMfaScreen: React.FC = () => {
    const { email, logout } = useSession();
    const [secret, setSecret] = useState<TotpSecret | null>(null);
    const [qr, setQr] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const user = auth.currentUser;
    const enrolled = user ? multiFactor(user).enrolledFactors.length > 0 : false;

    useEffect(() => {
        if (!secret) return;
        QRCode.toDataURL(secret.generateQrCodeUrl(email, 'ProjectFlow Admin'), { margin: 0, width: 280 }).then(setQr).catch(() => setQr(''));
    }, [secret, email]);

    const start = async () => {
        if (!user) return;
        setBusy(true);
        setError(null);
        try {
            const mfaSession = await multiFactor(user).getSession();
            setSecret(await TotpMultiFactorGenerator.generateSecret(mfaSession));
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };

    const finish = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user || !secret) return;
        setBusy(true);
        setError(null);
        try {
            await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim()), 'ProjectFlow Admin');
            await logout('login-not-fresh');
        } catch (err) {
            setError(message(err));
            setBusy(false);
        }
    };

    return (
        <Frame>
            <KeyRound size={28} />
            <h1>Zweiten Faktor einrichten</h1>
            {enrolled ? (
                <p className="lead">Für dieses Konto ist ein zweiter Faktor eingerichtet, aber die Anmeldung lief ohne ihn. Melde dich erneut an.</p>
            ) : !secret ? (
                <>
                    <p className="lead">Die Admin-Konsole verlangt TOTP. Richte jetzt eine Authenticator-App ein (1Password, Google Authenticator, …). Der Faktor gilt danach für dein ganzes ProjectFlow-Konto.</p>
                    <button className="ac-btn ac-btn--primary ac-btn--block" disabled={busy} onClick={start}>Einrichtung starten</button>
                </>
            ) : (
                <form className="ac-auth__form" onSubmit={finish}>
                    <div className="ac-auth__qr">
                        {qr && <img src={qr} alt="TOTP-QR-Code" />}
                        <div>
                            <p className="lead">QR-Code scannen oder Schlüssel eingeben:</p>
                            <code style={{ wordBreak: 'break-all' }}>{secret.secretKey}</code>
                        </div>
                    </div>
                    <input className="ac-input ac-input--lg mono" autoFocus inputMode="numeric" maxLength={6} placeholder="Code aus der App" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                    <button className="ac-btn ac-btn--primary ac-btn--block" disabled={busy || code.length !== 6}>Aktivieren und neu anmelden</button>
                </form>
            )}
            {error && <div className="ac-alert ac-alert--error">{error}</div>}
            <button className="ac-btn ac-btn--ghost" onClick={() => logout('signed-out')}><LogOut size={14} />Abmelden</button>
        </Frame>
    );
};
