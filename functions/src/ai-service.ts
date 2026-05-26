import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import OpenAI, { toFile } from 'openai';
import { db } from './init';

const TEXT_MODEL = 'gpt-5-mini';
const IMAGE_MODEL = 'gpt-image-1-mini';
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

type Confidence = 'Low' | 'Medium' | 'High';

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
        console.error('Failed to track token usage:', error);
    }
};

// Initialize with process.env for standard Cloud Functions config.
// Only the local emulator accepts a client-supplied key to keep local development flexible.
const getApiKey = (providedKey?: string) => {
    if (isEmulator && providedKey) {
        return providedKey;
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        throw new Error('OPENAI_API_KEY is not set in environment variables.');
    }

    if (providedKey && !isEmulator) {
        console.warn('Ignoring client-provided API key for non-emulator execution.');
    }

    return key;
};

const getClient = (providedKey?: string) => new OpenAI({ apiKey: getApiKey(providedKey) });

const extractTextFromResponse = (response: any): string => {
    if (typeof response?.output_text === 'string' && response.output_text.length > 0) {
        return response.output_text;
    }

    const output = response?.output;
    if (!Array.isArray(output)) {
        return '';
    }

    const chunks: string[] = [];
    for (const item of output) {
        if (item?.type !== 'message' || !Array.isArray(item.content)) {
            continue;
        }
        for (const part of item.content) {
            if (part?.type === 'output_text' && typeof part.text === 'string') {
                chunks.push(part.text);
            }
        }
    }

    return chunks.join('\n').trim();
};

const extractTokensUsed = (response: any): number => {
    const total = response?.usage?.total_tokens;
    if (typeof total === 'number') {
        return total;
    }

    const input = typeof response?.usage?.input_tokens === 'number' ? response.usage.input_tokens : 0;
    const output = typeof response?.usage?.output_tokens === 'number' ? response.usage.output_tokens : 0;
    return input + output;
};

const parseJsonText = (text: string): Record<string, any> => {
    const trimmed = text.trim();
    if (!trimmed) {
        return {};
    }

    try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        // Continue to fallback extraction.
    }

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        try {
            const parsed = JSON.parse(fenced[1].trim());
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            // Continue to fallback extraction.
        }
    }

    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
        try {
            const parsed = JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            // Fall through.
        }
    }

    return {};
};

const normalizeSchemaType = (typeValue: unknown) => {
    if (typeof typeValue === 'string') {
        return typeValue.toLowerCase();
    }
    if (Array.isArray(typeValue)) {
        return typeValue.map((entry) => typeof entry === 'string' ? entry.toLowerCase() : entry);
    }
    return typeValue;
};

const normalizeSchema = (schema: any): any => {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }

    if (Array.isArray(schema)) {
        return schema.map((entry) => normalizeSchema(entry));
    }

    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(schema)) {
        normalized[key] = normalizeSchema(value);
    }

    if (Object.prototype.hasOwnProperty.call(normalized, 'type')) {
        normalized.type = normalizeSchemaType(normalized.type);
    }

    return normalized;
};

const buildTextFormat = (jsonMode: boolean, responseSchema?: any) => {
    if (responseSchema) {
        return {
            format: {
                type: 'json_schema',
                name: 'structured_response',
                schema: normalizeSchema(responseSchema),
                strict: true
            }
        };
    }

    if (jsonMode) {
        return {
            format: {
                type: 'json_object'
            }
        };
    }

    return undefined;
};

const normalizeTools = (tools: any) => {
    if (!Array.isArray(tools)) {
        return undefined;
    }

    const normalizedTools: any[] = [];

    for (const tool of tools) {
        if (tool?.googleSearch !== undefined) {
            normalizedTools.push({ type: 'web_search_preview' });
            continue;
        }

        if (typeof tool?.type === 'string') {
            normalizedTools.push(tool);
        }
    }

    return normalizedTools.length > 0 ? normalizedTools : undefined;
};

const urlToDataUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch generated image from URL (status ${response.status}).`);
    }

    const mimeType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${mimeType};base64,${base64}`;
};

const imagePayloadToDataUrl = async (payload: any) => {
    if (typeof payload?.b64_json === 'string' && payload.b64_json.length > 0) {
        return `data:image/png;base64,${payload.b64_json}`;
    }

    if (typeof payload?.url === 'string' && payload.url.length > 0) {
        return urlToDataUrl(payload.url);
    }

    return null;
};

const mimeTypeToExtension = (mimeType: string) => {
    switch (mimeType) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        default:
            return 'png';
    }
};

// --- Ask Cora ---

export const askCora = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { question, contextStr, instruction, apiKey: clientApiKey } = data;

    if (!question || !contextStr) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing question or context');
    }

    try {
        const client = getClient(clientApiKey);

        const responseSchema = {
            type: 'object',
            additionalProperties: false,
            properties: {
                answer: { type: 'string' },
                relevantProjects: {
                    type: 'array',
                    items: { type: 'string' }
                },
                relevantTasks: {
                    type: 'array',
                    items: { type: 'string' }
                },
                confidence: {
                    type: 'string',
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

        let finalPrompt = prompt;
        if (instruction) {
            finalPrompt += `\n\n${instruction}`;
        }

        const response: any = await client.responses.create({
            model: TEXT_MODEL,
            input: finalPrompt,
            temperature: 0.4,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'ask_cora_response',
                    schema: responseSchema,
                    strict: true
                }
            }
        });

        const result = parseJsonText(extractTextFromResponse(response));
        const tokensUsed = extractTokensUsed(response);

        await trackUsage(context.auth.uid, tokensUsed);

        const confidence: Confidence = ['Low', 'Medium', 'High'].includes(result.confidence)
            ? result.confidence
            : 'Low';

        return {
            answer: typeof result.answer === 'string' ? result.answer : '',
            relevantProjects: Array.isArray(result.relevantProjects) ? result.relevantProjects : [],
            relevantTasks: Array.isArray(result.relevantTasks) ? result.relevantTasks : [],
            confidence,
            tokensUsed
        };

    } catch (error: any) {
        console.error('AskCora Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'AI request failed');
    }
});


// --- Generate Image ---

export const generateImage = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { prompt, apiKey: clientApiKey } = data;
    if (!prompt) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing prompt');
    }

    try {
        const client = getClient(clientApiKey);

        const response: any = await client.images.generate({
            model: IMAGE_MODEL,
            prompt,
            size: '1024x1024'
        });

        const images = (await Promise.all(
            (response.data || []).map((payload: any) => imagePayloadToDataUrl(payload))
        )).filter((image: string | null): image is string => Boolean(image));

        if (images.length === 0) {
            throw new functions.https.HttpsError('internal', 'No images generated');
        }

        return { images };

    } catch (error: any) {
        console.error('GenerateImage Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Image generation failed');
    }
});


// --- Edit Image ---

export const editImage = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { prompt, image, mimeType = 'image/png', apiKey: clientApiKey } = data; // image expects base64 string (no header)

    if (!prompt || !image) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing prompt or image data');
    }

    try {
        const client = getClient(clientApiKey);

        const imageBuffer = Buffer.from(image, 'base64');
        const imageFile = await toFile(imageBuffer, `source.${mimeTypeToExtension(mimeType)}`, { type: mimeType });

        const response: any = await client.images.edit({
            model: IMAGE_MODEL,
            image: imageFile,
            prompt,
            size: '1024x1024'
        });

        const images = (await Promise.all(
            (response.data || []).map((payload: any) => imagePayloadToDataUrl(payload))
        )).filter((value: string | null): value is string => Boolean(value));

        if (images.length === 0) {
            throw new functions.https.HttpsError('internal', 'No images generated from rework');
        }

        return { images };

    } catch (error: any) {
        console.error('EditImage Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Image edit failed');
    }
});

// --- Generic ChatGPT Call ---

export const callGemini = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const {
        systemInstruction,
        prompt,
        image,
        mimeType = 'image/png',
        temperature = 0.7,
        jsonMode = false,
        apiKey: clientApiKey,
        responseSchema,
        tools
    } = data;

    if (!prompt) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing prompt');
    }

    try {
        const client = getClient(clientApiKey);

        const wantsJson = Boolean(jsonMode || responseSchema);
        const textFormat = buildTextFormat(Boolean(jsonMode), responseSchema);
        const normalizedTools = normalizeTools(tools);

        const instructionSegments: string[] = [];
        if (typeof systemInstruction === 'string' && systemInstruction.trim().length > 0) {
            instructionSegments.push(systemInstruction.trim());
        }
        if (wantsJson) {
            instructionSegments.push('Return valid JSON only.');
        }

        const request: any = {
            model: TEXT_MODEL,
            temperature
        };

        if (instructionSegments.length > 0) {
            request.instructions = instructionSegments.join('\n\n');
        }

        if (image) {
            request.input = [
                {
                    role: 'user',
                    content: [
                        { type: 'input_text', text: prompt },
                        { type: 'input_image', image_url: `data:${mimeType};base64,${image}` }
                    ]
                }
            ];
        } else {
            request.input = prompt;
        }

        if (textFormat) {
            request.text = textFormat;
        }

        if (normalizedTools) {
            request.tools = normalizedTools;
        }

        const response: any = await client.responses.create(request);
        const text = extractTextFromResponse(response);
        const tokensUsed = extractTokensUsed(response);

        await trackUsage(context.auth.uid, tokensUsed);

        return {
            text,
            tokensUsed
        };

    } catch (error: any) {
        console.error('CallGemini Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'ChatGPT request failed');
    }
});
