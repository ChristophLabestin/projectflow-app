import { updateProfile } from 'firebase/auth';
import {
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { getActiveTenantId } from './authService';
import { getAIUsage as getPrivateAIUsage } from './userPrivateData';
import {
    extractFirebaseStoragePath,
    extractTenantIdFromStoragePath,
    getTenantFileDownloadUrl,
    refreshFirebaseStorageUrl,
    uploadTenantFile
} from '../fileStorageService';
import type { AIUsage, PrivacySettings, User } from '../../types';

const USERS = 'users';

const userDocRef = (userId: string) => doc(db, USERS, userId);

export const getUserProfile = async (userId: string, _tenantId?: string) => {
    const snap = await getDoc(userDocRef(userId));
    if (!snap.exists()) {
        return null;
    }

    const profile = snap.data() as User;
    const resolvedTenantId = _tenantId || getActiveTenantId();

    const photoFileTenantId = profile.photoFileTenantId || resolvedTenantId;
    const coverFileTenantId = profile.coverFileTenantId || resolvedTenantId;

    if (photoFileTenantId && profile.photoFileId) {
        try {
            const signed = await getTenantFileDownloadUrl({ tenantId: photoFileTenantId, fileId: profile.photoFileId });
            profile.photoURL = signed.downloadUrl;
        } catch (error) {
            console.warn('Failed to refresh managed profile photo URL', error);
        }
    } else if (profile.photoURL) {
        try {
            const storagePath = extractFirebaseStoragePath(profile.photoURL);
            const tenantId = storagePath ? extractTenantIdFromStoragePath(storagePath) : resolvedTenantId;
            if (tenantId) {
                profile.photoURL = await refreshFirebaseStorageUrl(tenantId, profile.photoURL);
            }
        } catch (error) {
            console.warn('Failed to recover profile photo URL', error);
        }
    }

    if (coverFileTenantId && profile.coverFileId) {
        try {
            const signed = await getTenantFileDownloadUrl({ tenantId: coverFileTenantId, fileId: profile.coverFileId });
            profile.coverURL = signed.downloadUrl;
        } catch (error) {
            console.warn('Failed to refresh managed profile cover URL', error);
        }
    } else if (profile.coverURL) {
        try {
            const storagePath = extractFirebaseStoragePath(profile.coverURL);
            const tenantId = storagePath ? extractTenantIdFromStoragePath(storagePath) : resolvedTenantId;
            if (tenantId) {
                profile.coverURL = await refreshFirebaseStorageUrl(tenantId, profile.coverURL);
            }
        } catch (error) {
            console.warn('Failed to recover profile cover URL', error);
        }
    }

    return profile;
};

export const updateUserData = async (userId: string, data: Partial<any>) => {
    await setDoc(userDocRef(userId), data, { merge: true });
};

// GitHub tokens live in an owner-only private subdoc, never on the
// world-readable users/{uid} profile or on project docs.
const githubTokenDocRef = (userId: string) => doc(db, USERS, userId, 'private', 'github');

export const getGithubToken = async (userId: string): Promise<string | null> => {
    const snap = await getDoc(githubTokenDocRef(userId));
    const token = snap.exists() ? snap.data()?.token : null;
    return typeof token === 'string' && token ? token : null;
};

export const setGithubToken = async (userId: string, token: string) => {
    await setDoc(githubTokenDocRef(userId), { token, updatedAt: serverTimestamp() });
};

export const clearGithubToken = async (userId: string) => {
    await deleteDoc(githubTokenDocRef(userId));
};

export const updateUserProfile = async (data: {
    displayName?: string;
    photoURL?: string;
    coverURL?: string;
    photoFileId?: string;
    photoFileTenantId?: string;
    coverFileId?: string;
    coverFileTenantId?: string;
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
    let photoFileId = data.photoFileId || '';
    let coverFileId = data.coverFileId || '';
    let photoFileTenantId = data.photoFileTenantId || '';
    let coverFileTenantId = data.coverFileTenantId || '';

    if (data.file) {
        const uploaded = await uploadTenantFile({
            tenantId,
            module: 'profile',
            entityType: 'avatar',
            entityId: user.uid,
            file: data.file,
        });
        photoURL = uploaded.downloadUrl;
        photoFileId = uploaded.id;
        photoFileTenantId = uploaded.tenantId;
    }

    if (data.coverFile) {
        const uploaded = await uploadTenantFile({
            tenantId,
            module: 'profile',
            entityType: 'cover',
            entityId: user.uid,
            file: data.coverFile,
        });
        coverURL = uploaded.downloadUrl;
        coverFileId = uploaded.id;
        coverFileTenantId = uploaded.tenantId;
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
    if (photoFileId) {
        updateData.photoFileId = photoFileId;
    }
    if (photoFileTenantId) {
        updateData.photoFileTenantId = photoFileTenantId;
    }
    if (coverFileId) {
        updateData.coverFileId = coverFileId;
    }
    if (coverFileTenantId) {
        updateData.coverFileTenantId = coverFileTenantId;
    }

    await setDoc(userDocRef(user.uid), updateData, { merge: true });

    return { photoURL, coverURL };
};

export const getAIUsage = (userId: string): Promise<AIUsage | null> => getPrivateAIUsage(userId);
