import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { db } from './init';

// Helper to track token usage securely on server
const trackUsage = async (uid: string, tokens: number) => {
    if (tokens <= 0) return;
    try {
        // Store aiUsage directly on the user document (top-level users collection)
        const userRef = db.collection('users').doc(uid);
        await userRef.set({
            aiUsage: {
                tokensUsed: admin.firestore.FieldValue.increment(tokens),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });
    } catch (error) {
        console.error("Failed to track token usage:", error);
    }
};


const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

// Initialize with process.env for standard Cloud Functions config.
// Only the local emulator accepts a client-supplied key to keep local development flexible.
const getApiKey = (providedKey?: string) => {
    if (isEmulator && providedKey) {
        return providedKey;
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        throw new Error('GEMINI_API_KEY is not set in environment variables.');
    }

    if (providedKey && !isEmulator) {
        console.warn('Ignoring client-provided Gemini API key for non-emulator execution.');
    }

    return key;
};

// --- Ask Cora ---

export const askCora = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { question, contextStr, instruction, apiKey: clientApiKey } = data;

    if (!question || !contextStr) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing question or context');
    }

    try {
        const apiKey = getApiKey(clientApiKey);
        const ai = new GoogleGenAI({ apiKey });

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                answer: { type: Type.STRING },
                relevantProjects: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                relevantTasks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                confidence: {
                    type: Type.STRING,
                    enum: ['Low', 'Medium', 'High']
                }
            },
            required: ['answer', 'relevantProjects', 'relevantTasks', 'confidence']
        };

        const prompt = `You are CORA, a project management assistant. Answer the following question based on the project context provided.
        
Context:
${contextStr}

Question: ${question}

Provide a helpful, concise answer (2-3 sentences max). Include IDs of relevant projects and tasks in your response.
If you reference specific projects or tasks, use their exact titles.
Rate your confidence in the answer as Low, Medium, or High.`;

        // Apply language instruction if provided (simple append for now, matching frontend logic roughly)
        // Ideally this logic is consistent with frontend utils/aiLanguage.ts
        let finalPrompt = prompt;
        if (instruction) {
            finalPrompt += `\n\n${instruction}`;
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: finalPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.4,
            }
        });

        const result = JSON.parse(response.text || '{}');
        const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
        await trackUsage(context.auth.uid, tokensUsed);

        return {
            ...result,
            tokensUsed
        };

    } catch (error: any) {
        console.error("AskCora Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'AI request failed');
    }
});


// --- Generate Image ---

export const generateImage = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { prompt, apiKey: clientApiKey } = data;
    if (!prompt) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing prompt');
    }

    try {
        const apiKey = getApiKey(clientApiKey);
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: "gemini-3-pro-image-preview",
            contents: prompt,
        });

        const images: string[] = [];
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    images.push(`data:${mimeType};base64,${part.inlineData.data}`);
                }
            }
        }

        if (images.length === 0) {
            throw new functions.https.HttpsError('internal', 'No images generated');
        }

        return { images };

    } catch (error: any) {
        console.error("GenerateImage Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Image generation failed');
    }
});


// --- Edit Image ---

export const editImage = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { prompt, image, mimeType = 'image/png', apiKey: clientApiKey } = data; // image expects base64 string (no header)

    if (!prompt || !image) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing prompt or image data');
    }

    try {
        const apiKey = getApiKey(clientApiKey);
        const ai = new GoogleGenAI({ apiKey });

        const parts: any[] = [
            { text: prompt },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: image
                }
            }
        ];

        const response = await ai.models.generateContent({
            model: "gemini-3-pro-image-preview",
            contents: [{
                role: 'user',
                parts: parts
            }],
        });

        const images: string[] = [];
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const resMimeType = part.inlineData.mimeType || 'image/png';
                    images.push(`data:${resMimeType};base64,${part.inlineData.data}`);
                }
            }
        }

        if (images.length === 0) {
            throw new functions.https.HttpsError('internal', 'No images generated from rework');
        }

        return { images };

    } catch (error: any) {
        console.error("EditImage Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Image edit failed');
    }
});

// --- Generic Gemini Call ---

export const callGemini = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { systemInstruction, prompt, image, mimeType = 'image/png', temperature = 0.7, jsonMode = false, apiKey: clientApiKey, responseSchema, tools } = data;

    if (!prompt) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing prompt');
    }

    try {
        const apiKey = getApiKey(clientApiKey);
        const ai = new GoogleGenAI({ apiKey });

        const config: any = {
            temperature: temperature,
        };

        if (jsonMode) {
            config.responseMimeType = "application/json";
        }

        if (responseSchema) {
            config.responseSchema = responseSchema;
            config.responseMimeType = "application/json"; // Schema implies JSON usually
        }
        if (tools) {
            config.tools = tools;
        }

        let contents: any;
        if (image) {
            contents = [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: image
                            }
                        }
                    ]
                }
            ];
        } else {
            contents = prompt;
        }

        const generateParams: any = {
            model: image ? "gemini-3-flash-preview" : "gemini-3-flash-preview", // Both support vision in 3.0
            contents: contents,
            config: config
        };

        if (systemInstruction) {
            generateParams.systemInstruction = systemInstruction;
        }

        const response = await ai.models.generateContent(generateParams);
        const text = response.text || "";
        const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

        await trackUsage(context.auth.uid, tokensUsed);

        return {
            text,
            tokensUsed
        };

    } catch (error: any) {
        console.error("CallGemini Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Gemini request failed');
    }
});
