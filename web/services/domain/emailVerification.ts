import { sendEmailVerification } from 'firebase/auth';

import { auth } from '../firebase';

/** True for accounts that signed up with email + password and have not confirmed their address yet. */
export const needsEmailVerification = () => {
    const user = auth.currentUser;
    if (!user || user.emailVerified || !user.email) return false;
    return user.providerData.some((provider) => provider.providerId === 'password');
};

/** Send the confirmation mail; the link brings the user back to `returnPath`. */
export const sendVerificationEmail = async (returnPath = '/') => {
    const user = auth.currentUser;
    if (!user) return;
    await sendEmailVerification(user, { url: `${window.location.origin}${returnPath}` });
};

/**
 * Re-read the account after the user clicked the link in another tab. The ID
 * token is refreshed too, so rules that check `email_verified` see the change.
 */
export const refreshEmailVerification = async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    await user.reload();
    if (user.emailVerified) await user.getIdToken(true);
    return user.emailVerified;
};
