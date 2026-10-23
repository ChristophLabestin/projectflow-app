import { httpsCallable } from "firebase/functions";
import { functions, auth } from "./firebase";
import { incrementImageUsage } from "./dataService";
import { getAIUsage } from './domain/usersService';

/**
 * Generate an image using OpenAI image model via Cloud Functions
 */
export const generateAIImage = async (prompt: string): Promise<string[]> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Check image usage limit
    const usage = await getAIUsage(user.uid);
    if (usage && (usage.imagesUsed || 0) >= (usage.imageLimit || 50)) {
        throw new Error(`AI image generation limit reached. Limit resets monthly.`);
    }

    try {
        const generateImageFn = httpsCallable<{ prompt: string }, { images: string[] }>(functions, 'generateImage');
        const { data } = await generateImageFn({ prompt });

        if (!data.images || data.images.length === 0) {
            throw new Error("No images generated");
        }

        // Track usage (count images)
        await incrementImageUsage(user.uid, data.images.length);

        return data.images;

    } catch (error) {
        console.error("Image Generation Error:", error);
        throw error;
    }
};

/**
 * Edit/rework an existing image using OpenAI image model via Cloud Functions
 */
export const editAIImage = async (
    prompt: string,
    imageUrl: string,
    editMode: 'default' | 'style' = 'default'
): Promise<string[]> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Check image usage limit
    const usage = await getAIUsage(user.uid);
    if (usage && (usage.imagesUsed || 0) >= (usage.imageLimit || 50)) {
        throw new Error(`AI image generation limit reached. Limit resets monthly.`);
    }

    try {
        // Fetch image and convert to base64 if it's a URL
        let base64Data: string;
        let mimeType = 'image/jpeg';

        if (imageUrl.startsWith('data:')) {
            // Already a data URL
            const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            } else {
                throw new Error("Invalid data URL format");
            }
        } else {
            // Fetch from URL and convert to base64 using FileReader
            // IMPORTANT: If this is a cross-origin URL, this might fail without proper CORS headers on the source
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            mimeType = blob.type || 'image/jpeg';

            // Convert blob to base64 safely
            base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    // Extract base64 data from data URL
                    const base64 = result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        const editImageFn = httpsCallable<{
            prompt: string;
            image: string;
            mimeType: string;
            editMode: string;
        }, { images: string[] }>(functions, 'editImage');

        const { data } = await editImageFn({
            prompt,
            image: base64Data,
            mimeType,
            editMode
        });

        if (!data.images || data.images.length === 0) {
            throw new Error("No images generated from rework.");
        }

        // Track usage
        await incrementImageUsage(user.uid, data.images.length);

        return data.images;

    } catch (error) {
        console.error("Image Edit Error:", error);
        throw error;
    }
};
