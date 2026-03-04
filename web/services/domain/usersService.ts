import { updateProfile } from 'firebase/auth';
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { auth, db, storage } from '../firebase';
import { getActiveTenantId } from './authService';
import type { AIUsage, PrivacySettings, User } from '../../types';

const USERS = 'users';

const userDocRef = (userId: string) => doc(db, USERS, userId);

export const getUserProfile = async (userId: string, _tenantId?: string) => {
    const snap = await getDoc(userDocRef(userId));
    return snap.exists() ? snap.data() : null;
};

export const updateUserData = async (userId: string, data: Partial<any>) => {
    await setDoc(userDocRef(userId), data, { merge: true });
};

export const updateUserProfile = async (data: {
    displayName?: string;
    photoURL?: string;
    coverURL?: string;
    title?: string;
    bio?: string;
    address?: string;
    skills?: string[];
    privacySettings?: PrivacySettings;
    file?: File;
    coverFile?: File;
}) => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('No user');
    }

    let photoURL = data.photoURL || user.photoURL;
    let coverURL = data.coverURL;
    const tenantId = getActiveTenantId();

    if (data.file) {
        const path = tenantId
            ? `tenants/${tenantId}/users/${user.uid}/avatar_${Date.now()}`
            : `users/${user.uid}/avatar_${Date.now()}`;

        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, data.file);
        photoURL = await getDownloadURL(storageRef);
    }

    if (data.coverFile) {
        const path = tenantId
            ? `tenants/${tenantId}/users/${user.uid}/cover_${Date.now()}`
            : `users/${user.uid}/cover_${Date.now()}`;

        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, data.coverFile);
        coverURL = await getDownloadURL(storageRef);
    }

    if (data.displayName || photoURL) {
        await updateProfile(user, {
            displayName: data.displayName || user.displayName,
            photoURL
        });
    }

    const updateData: Record<string, unknown> = {
        displayName: data.displayName || user.displayName,
        photoURL,
        title: data.title ?? '',
        bio: data.bio ?? '',
        email: user.email,
        address: data.address ?? '',
        skills: data.skills ?? [],
        privacySettings: data.privacySettings || {},
        updatedAt: serverTimestamp()
    };

    if (coverURL) {
        updateData.coverURL = coverURL;
    }

    await setDoc(userDocRef(user.uid), updateData, { merge: true });

    return { photoURL, coverURL };
};

export const getAIUsage = async (userId: string): Promise<AIUsage | null> => {
    try {
        const snap = await getDoc(userDocRef(userId));
        if (!snap.exists()) {
            return null;
        }

        const data = snap.data() as User;
        if (!data.aiUsage) {
            return null;
        }

        const lastReset = data.aiUsage.lastReset?.toDate?.() || new Date(data.aiUsage.lastReset);
        const now = new Date();

        if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
            const resetUsage = {
                ...data.aiUsage,
                tokensUsed: 0,
                imagesUsed: 0,
                lastReset: serverTimestamp()
            };
            await updateDoc(userDocRef(userId), { aiUsage: resetUsage });
            return resetUsage;
        }

        return data.aiUsage;
    } catch (error) {
        console.warn('Failed to get CORA usage', error);
        return null;
    }
};
