import { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, listAll } from 'firebase/storage';
import { storage } from '../services/firebase';
import type { Asset } from '../services/storage/types';

export const useStorage = () => {
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<Error | null>(null);
    const [url, setUrl] = useState<string | null>(null);

    const uploadFile = async (file: File, path: string) => {
        setError(null);
        setProgress(0);

        const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        return new Promise<string>((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const percentage = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(percentage);
                },
                (err) => {
                    setError(err);
                    reject(err);
                },
                async () => {
                    try {
                        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        setUrl(downloadUrl);
                        resolve(downloadUrl);
                    } catch (err) {
                        setError(err as Error);
                        reject(err);
                    }
                }
            );
        });
    };

    const listAssets = async (path: string): Promise<Asset[]> => {
        try {
            const listRef = ref(storage, path);
            const res = await listAll(listRef);

            const assets: Asset[] = await Promise.all(
                res.items.map(async (itemRef) => {
                    const url = await getDownloadURL(itemRef);
                    return {
                        id: itemRef.name, // Using name as ID for simplicity
                        name: itemRef.name,
                        url: url,
                        type: 'image', // Assuming images for now
                        size: 0, // Metadata fetching would require getMetadata
                        createdAt: new Date().toISOString() // Placeholder
                    };
                })
            );
            return assets;
        } catch (err) {
            setError(err as Error);
            throw err;
        }
    };

    return { uploadFile, listAssets, progress, url, error };
};
