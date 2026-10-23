import * as functions from 'firebase-functions/v1';
import OpenAI, { toFile } from 'openai';
import { db } from './init';
import { FieldValue } from 'firebase-admin/firestore';
import {
    buildAskCoraPrompt, buildCapabilityRequest, CapabilityInputError, normalizeImageInput, normalizeImagePrompt
} from './ai-capabilities';

// GPT-6 Luna: OpenAI's efficient model for focused, high-volume tasks. Low reasoning keeps inline AI fast.
const TEXT_MODEL = 'gpt-6-luna';
const TEXT_REASONING = { effort: 'low' } as const;
const IMAGE_MODEL = 'gpt-image-1-mini';

// Server-side AI quota (the only one that is enforced): per user and day (requests) plus per user and
// month (tokens / images). Counter docs live in a server-only collection (no client rules match it).
const AI_QUOTA_COLLECTION = 'ai_usage_quotas';
const AI_DAILY_LIMITS = {
    text: Number(process.env.AI_DAILY_TEXT_LIMIT) || 200,
    image: Number(process.env.AI_DAILY_IMAGE_LIMIT) || 30
} as const;
const AI_MONTHLY_TOKEN_LIMIT = Number(process.env.AI_MONTHLY_TOKEN_LIMIT) || 1_000_000;
const AI_MONTHLY_IMAGE_LIMIT = Number(process.env.AI_MONTHLY_IMAGE_LIMIT) || 50;

type AiQuotaKind = keyof typeof AI_DAILY_LIMITS;

const quotaRefs = (uid: string) => {
    const now = new Date().toISOString();
    const day = now.slice(0, 10);
    const month = now.slice(0, 7);
    return {
        day,
        month,
        daily: db.collection(AI_QUOTA_COLLECTION).doc(`${uid}_${day}`),
        monthly: db.collection(AI_QUOTA_COLLECTION).doc(`${uid}_${month}`)
    };
};

export const consumeAiQuota = async (uid: string, kind: AiQuotaKind) => {
    const { day, month, daily, monthly } = quotaRefs(uid);
    const limit = AI_DAILY_LIMITS[kind];

    const denied = await db.runTransaction(async (tx) => {
        const [daySnap, monthSnap] = await Promise.all([tx.get(daily), tx.get(monthly)]);
        const used = Number(daySnap.data()?.[kind] || 0);
        if (used >= limit) return `Daily AI ${kind} limit of ${limit} requests reached. Try again tomorrow.`;
        if (kind === 'text' && Number(monthSnap.data()?.tokens || 0) >= AI_MONTHLY_TOKEN_LIMIT) {
            return `Monthly AI token limit of ${AI_MONTHLY_TOKEN_LIMIT.toLocaleString('en')} reached.`;
        }
        if (kind === 'image' && Number(monthSnap.data()?.images || 0) >= AI_MONTHLY_IMAGE_LIMIT) {
            return `Monthly AI image limit of ${AI_MONTHLY_IMAGE_LIMIT} reached.`;
        }
        tx.set(daily, { uid, day, [kind]: used + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (kind === 'image') {
            tx.set(monthly, { uid, month, images: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
        return null;
    });

    if (denied) {
        throw new functions.https.HttpsError('resource-exhausted', denied);
    }
};

const recordMonthlyTokens = async (uid: string, tokens: number) => {
    if (tokens <= 0) return;
    const { month, monthly } = quotaRefs(uid);
    await monthly.set({ uid, month, tokens: FieldValue.increment(tokens), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
};

const invalidInput = (error: unknown): never => {
    if (error instanceof CapabilityInputError) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
    throw error;
};

type Confidence = 'Low' | 'Medium' | 'High';

// Helper to track token usage securely on server
export const trackUsage = async (uid: string, tokens: number) => {
    if (tokens <= 0) return;
    try {
        await recordMonthlyTokens(uid, tokens);
        // Usage is owner-only data: users/{uid} itself is readable by every signed-in user.
        const userRef = db.collection('users').doc(uid).collection('private').doc('usage');
        await userRef.set({
            aiUsage: {
                tokensUsed: FieldValue.increment(tokens),
                lastUpdated: FieldValue.serverTimestamp()
            }
        }, { merge: true });
    } catch (error) {
        console.error('Failed to track token usage:', error);
    }
};

const getClient = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set in environment variables.');
    }
    return new OpenAI({ apiKey });
};

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

/**
 * Plain text generation for server features (e.g. the insights weekly report). Consumes the
 * caller's daily text quota and tracks token usage like the callables below.
 */
export const generateServerText = async (uid: string, instructions: string, input: string): Promise<string> => {
    await consumeAiQuota(uid, 'text');
    const client = getClient();
    const response: any = await client.responses.create({ model: TEXT_MODEL, reasoning: TEXT_REASONING, instructions, input });
    await trackUsage(uid, extractTokensUsed(response));
    return extractTextFromResponse(response).trim();
};

export const askCora = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    let finalPrompt = '';
    try {
        finalPrompt = buildAskCoraPrompt(data?.question, data?.contextStr, data?.language);
    } catch (error) {
        invalidInput(error);
    }
    await consumeAiQuota(context.auth.uid, 'text');

    try {
        const client = getClient();

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

        const response: any = await client.responses.create({
            model: TEXT_MODEL,
            reasoning: TEXT_REASONING,
            input: finalPrompt,
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
        throw error instanceof functions.https.HttpsError ? error : new functions.https.HttpsError('internal', 'AI request failed');
    }
});


// --- Generate Image ---

export const generateImage = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    let prompt = '';
    try {
        prompt = normalizeImagePrompt(data?.prompt);
    } catch (error) {
        invalidInput(error);
    }
    await consumeAiQuota(context.auth.uid, 'image');

    try {
        const client = getClient();

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
        throw error instanceof functions.https.HttpsError ? error : new functions.https.HttpsError('internal', 'Image generation failed');
    }
});


// --- Edit Image ---

export const editImage = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    // image expects a base64 string without data-URL header
    let prompt = '';
    let image = '';
    let mimeType = 'image/png';
    try {
        prompt = normalizeImagePrompt(data?.prompt);
        ({ image, mimeType } = normalizeImageInput(data?.image, data?.mimeType));
    } catch (error) {
        invalidInput(error);
    }
    await consumeAiQuota(context.auth.uid, 'image');

    try {
        const client = getClient();

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
        throw error instanceof functions.https.HttpsError ? error : new functions.https.HttpsError('internal', 'Image edit failed');
    }
});

// --- Fixed AI capabilities (replaces the former generic `callGemini` proxy) ---
export const runAiCapability = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    let spec: ReturnType<typeof buildCapabilityRequest> | null = null;
    try {
        spec = buildCapabilityRequest(data?.capability, data?.input, data?.language);
    } catch (error) {
        invalidInput(error);
    }
    if (!spec) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid AI capability request');
    }
    await consumeAiQuota(context.auth.uid, 'text');

    try {
        const request: any = {
            model: TEXT_MODEL,
            reasoning: TEXT_REASONING,
            input: spec.input
            // No `temperature`: reasoning models reject it (400). `spec.temperature` applies once a model supports it.
        };
        if (spec.instructions) {
            request.instructions = spec.instructions;
        }
        if (spec.schema) {
            request.instructions = [request.instructions, 'Return valid JSON only.'].filter(Boolean).join('\n\n');
            request.text = { format: { type: 'json_schema', name: 'structured_response', schema: spec.schema, strict: true } };
        }
        if (spec.webSearch) {
            request.tools = [{ type: 'web_search_preview' }];
        }

        const response: any = await getClient().responses.create(request);
        const text = extractTextFromResponse(response);
        const tokensUsed = extractTokensUsed(response);
        await trackUsage(context.auth.uid, tokensUsed);

        return { text, tokensUsed };
    } catch (error: any) {
        console.error('runAiCapability Error:', error);
        throw error instanceof functions.https.HttpsError ? error : new functions.https.HttpsError('internal', 'AI request failed');
    }
});
