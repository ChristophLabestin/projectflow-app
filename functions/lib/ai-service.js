"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callGemini = exports.editImage = exports.generateImage = exports.askCora = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const openai_1 = require("openai");
const init_1 = require("./init");
const TEXT_MODEL = 'gpt-5-mini';
const IMAGE_MODEL = 'gpt-image-1-mini';
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
// Helper to track token usage securely on server
const trackUsage = async (uid, tokens) => {
    if (tokens <= 0)
        return;
    try {
        // Store aiUsage directly on the user document (top-level users collection)
        const userRef = init_1.db.collection('users').doc(uid);
        await userRef.set({
            aiUsage: {
                tokensUsed: admin.firestore.FieldValue.increment(tokens),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });
    }
    catch (error) {
        console.error('Failed to track token usage:', error);
    }
};
// Initialize with process.env for standard Cloud Functions config.
// Only the local emulator accepts a client-supplied key to keep local development flexible.
const getApiKey = (providedKey) => {
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
const getClient = (providedKey) => new openai_1.default({ apiKey: getApiKey(providedKey) });
const extractTextFromResponse = (response) => {
    if (typeof (response === null || response === void 0 ? void 0 : response.output_text) === 'string' && response.output_text.length > 0) {
        return response.output_text;
    }
    const output = response === null || response === void 0 ? void 0 : response.output;
    if (!Array.isArray(output)) {
        return '';
    }
    const chunks = [];
    for (const item of output) {
        if ((item === null || item === void 0 ? void 0 : item.type) !== 'message' || !Array.isArray(item.content)) {
            continue;
        }
        for (const part of item.content) {
            if ((part === null || part === void 0 ? void 0 : part.type) === 'output_text' && typeof part.text === 'string') {
                chunks.push(part.text);
            }
        }
    }
    return chunks.join('\n').trim();
};
const extractTokensUsed = (response) => {
    var _a, _b, _c;
    const total = (_a = response === null || response === void 0 ? void 0 : response.usage) === null || _a === void 0 ? void 0 : _a.total_tokens;
    if (typeof total === 'number') {
        return total;
    }
    const input = typeof ((_b = response === null || response === void 0 ? void 0 : response.usage) === null || _b === void 0 ? void 0 : _b.input_tokens) === 'number' ? response.usage.input_tokens : 0;
    const output = typeof ((_c = response === null || response === void 0 ? void 0 : response.usage) === null || _c === void 0 ? void 0 : _c.output_tokens) === 'number' ? response.usage.output_tokens : 0;
    return input + output;
};
const parseJsonText = (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
        return {};
    }
    try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    }
    catch (_a) {
        // Continue to fallback extraction.
    }
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced === null || fenced === void 0 ? void 0 : fenced[1]) {
        try {
            const parsed = JSON.parse(fenced[1].trim());
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        }
        catch (_b) {
            // Continue to fallback extraction.
        }
    }
    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
        try {
            const parsed = JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        }
        catch (_c) {
            // Fall through.
        }
    }
    return {};
};
const normalizeSchemaType = (typeValue) => {
    if (typeof typeValue === 'string') {
        return typeValue.toLowerCase();
    }
    if (Array.isArray(typeValue)) {
        return typeValue.map((entry) => typeof entry === 'string' ? entry.toLowerCase() : entry);
    }
    return typeValue;
};
const normalizeSchema = (schema) => {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }
    if (Array.isArray(schema)) {
        return schema.map((entry) => normalizeSchema(entry));
    }
    const normalized = {};
    for (const [key, value] of Object.entries(schema)) {
        normalized[key] = normalizeSchema(value);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'type')) {
        normalized.type = normalizeSchemaType(normalized.type);
    }
    return normalized;
};
const buildTextFormat = (jsonMode, responseSchema) => {
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
const normalizeTools = (tools) => {
    if (!Array.isArray(tools)) {
        return undefined;
    }
    const normalizedTools = [];
    for (const tool of tools) {
        if ((tool === null || tool === void 0 ? void 0 : tool.googleSearch) !== undefined) {
            normalizedTools.push({ type: 'web_search_preview' });
            continue;
        }
        if (typeof (tool === null || tool === void 0 ? void 0 : tool.type) === 'string') {
            normalizedTools.push(tool);
        }
    }
    return normalizedTools.length > 0 ? normalizedTools : undefined;
};
const urlToDataUrl = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch generated image from URL (status ${response.status}).`);
    }
    const mimeType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${mimeType};base64,${base64}`;
};
const imagePayloadToDataUrl = async (payload) => {
    if (typeof (payload === null || payload === void 0 ? void 0 : payload.b64_json) === 'string' && payload.b64_json.length > 0) {
        return `data:image/png;base64,${payload.b64_json}`;
    }
    if (typeof (payload === null || payload === void 0 ? void 0 : payload.url) === 'string' && payload.url.length > 0) {
        return urlToDataUrl(payload.url);
    }
    return null;
};
const mimeTypeToExtension = (mimeType) => {
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
exports.askCora = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
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
        const response = await client.responses.create({
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
        const confidence = ['Low', 'Medium', 'High'].includes(result.confidence)
            ? result.confidence
            : 'Low';
        return {
            answer: typeof result.answer === 'string' ? result.answer : '',
            relevantProjects: Array.isArray(result.relevantProjects) ? result.relevantProjects : [],
            relevantTasks: Array.isArray(result.relevantTasks) ? result.relevantTasks : [],
            confidence,
            tokensUsed
        };
    }
    catch (error) {
        console.error('AskCora Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'AI request failed');
    }
});
// --- Generate Image ---
exports.generateImage = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { prompt, apiKey: clientApiKey } = data;
    if (!prompt) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing prompt');
    }
    try {
        const client = getClient(clientApiKey);
        const response = await client.images.generate({
            model: IMAGE_MODEL,
            prompt,
            size: '1024x1024'
        });
        const images = (await Promise.all((response.data || []).map((payload) => imagePayloadToDataUrl(payload)))).filter((image) => Boolean(image));
        if (images.length === 0) {
            throw new functions.https.HttpsError('internal', 'No images generated');
        }
        return { images };
    }
    catch (error) {
        console.error('GenerateImage Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Image generation failed');
    }
});
// --- Edit Image ---
exports.editImage = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
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
        const imageFile = await (0, openai_1.toFile)(imageBuffer, `source.${mimeTypeToExtension(mimeType)}`, { type: mimeType });
        const response = await client.images.edit({
            model: IMAGE_MODEL,
            image: imageFile,
            prompt,
            size: '1024x1024'
        });
        const images = (await Promise.all((response.data || []).map((payload) => imagePayloadToDataUrl(payload)))).filter((value) => Boolean(value));
        if (images.length === 0) {
            throw new functions.https.HttpsError('internal', 'No images generated from rework');
        }
        return { images };
    }
    catch (error) {
        console.error('EditImage Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Image edit failed');
    }
});
// --- Generic ChatGPT Call ---
exports.callGemini = functions.region('europe-west3').runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { systemInstruction, prompt, image, mimeType = 'image/png', temperature = 0.7, jsonMode = false, apiKey: clientApiKey, responseSchema, tools } = data;
    if (!prompt) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing prompt');
    }
    try {
        const client = getClient(clientApiKey);
        const wantsJson = Boolean(jsonMode || responseSchema);
        const textFormat = buildTextFormat(Boolean(jsonMode), responseSchema);
        const normalizedTools = normalizeTools(tools);
        const instructionSegments = [];
        if (typeof systemInstruction === 'string' && systemInstruction.trim().length > 0) {
            instructionSegments.push(systemInstruction.trim());
        }
        if (wantsJson) {
            instructionSegments.push('Return valid JSON only.');
        }
        const request = {
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
        }
        else {
            request.input = prompt;
        }
        if (textFormat) {
            request.text = textFormat;
        }
        if (normalizedTools) {
            request.tools = normalizedTools;
        }
        const response = await client.responses.create(request);
        const text = extractTextFromResponse(response);
        const tokensUsed = extractTokensUsed(response);
        await trackUsage(context.auth.uid, tokensUsed);
        return {
            text,
            tokensUsed
        };
    }
    catch (error) {
        console.error('CallGemini Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'ChatGPT request failed');
    }
});
//# sourceMappingURL=ai-service.js.map