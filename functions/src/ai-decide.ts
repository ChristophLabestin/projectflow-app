/**
 * Shared AI building blocks next to ai-models.ts:
 * - `aiDecide`: OpenAI Decisions API (`POST /v1/decisions`, gpt-6-luna) for routing, classification and
 *   yes/no checks with calibrated probabilities instead of parsing free text.
 * - `aiGenerate`: Structured Outputs (`text.format` json_schema, `strict: true`) for anything that
 *   produces content; the result is parsed JSON in the given schema, never free text.
 * Quotas/credits stay with the caller.
 */
import OpenAI from 'openai';

import { ModelError, ModelTier, ModelUsage, getClient, tierModel, toModelError } from './ai-models';

/** Server client, or a client for the caller's own OpenAI key (BYOK). */
const clientFor = (apiKey?: string) => (apiKey ? new OpenAI({ apiKey }) : getClient());

export const DECISIONS_MODEL = 'gpt-6-luna';

export interface DecisionChoice { value: string; description?: string }
export interface DecisionLevel { label: string; description?: string }

export interface DecisionQuestion {
    type: 'predicate' | 'choice' | 'score';
    /** Unique per request; answers echo it. */
    name: string;
    instructions: string;
    choices?: DecisionChoice[];
    /** 2–10 levels, lowest first (indices start at 0). */
    levels?: DecisionLevel[];
}

export type DecisionAnswer =
    | { type: 'predicate'; name: string; probability: number }
    | { type: 'choice'; name: string; choice: string; confidence: number; probabilities: { value: string; probability: number }[] }
    | { type: 'score'; name: string; score: number; confidence: number; probabilities: { value: number; label: string; probability: number }[] }
    | { type: 'refusal'; name: string };

export interface DecideResult { answers: DecisionAnswer[]; usage: ModelUsage }

export const aiDecide = async (request: { input: string; questions: DecisionQuestion[]; apiKey?: string }): Promise<DecideResult> => {
    if (request.questions.length === 0) return { answers: [], usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 } };
    const questions = request.questions.map((question) => ({
        type: question.type,
        name: question.name,
        instructions: question.instructions,
        ...(question.type === 'choice' ? { choices: (question.choices || []).map((c) => ({ value: c.value, description: c.description || c.value })) } : {}),
        ...(question.type === 'score' ? { levels: (question.levels || []).map((l) => ({ label: l.label, description: l.description || l.label })) } : {})
    }));
    let response: any;
    try {
        // The openai SDK has no `decisions` resource yet; the generic post keeps auth, retries and errors.
        response = await clientFor(request.apiKey).post('/decisions', { body: { model: DECISIONS_MODEL, input: request.input, questions } });
    } catch (error) {
        throw toModelError(error);
    }
    const usage = response?.usage || {};
    return {
        answers: Array.isArray(response?.answers) ? response.answers : [],
        usage: {
            inputTokens: Number(usage.input_tokens) || 0,
            outputTokens: 0,
            cachedTokens: Number(usage.input_tokens_details?.cached_tokens) || 0
        }
    };
};

export interface GenerateRequest {
    tier: ModelTier;
    instructions: string;
    input: string;
    /** JSON schema (strict: every property required, additionalProperties false). */
    schema: { name: string; schema: Record<string, unknown> };
    maxOutputTokens?: number;
    /** Own OpenAI key of the caller (BYOK); default: server key. */
    apiKey?: string;
    /** Allow the hosted web search tool (blog research). */
    webSearch?: boolean;
}

export const aiGenerate = async <T>(request: GenerateRequest): Promise<{ data: T; usage: ModelUsage }> => {
    const { model, effort, serviceTier } = tierModel(request.tier);
    let response: any;
    try {
        response = await clientFor(request.apiKey).responses.create({
            model,
            service_tier: serviceTier,
            reasoning: { effort },
            instructions: request.instructions,
            input: request.input,
            max_output_tokens: request.maxOutputTokens || 2000,
            ...(request.webSearch ? { tools: [{ type: 'web_search_preview' }] } : {}),
            text: { format: { type: 'json_schema', name: request.schema.name, schema: request.schema.schema, strict: true } }
        } as any);
    } catch (error) {
        throw toModelError(error);
    }
    const text = typeof response?.output_text === 'string' ? response.output_text : '';
    let data: T;
    try {
        data = JSON.parse(text) as T;
    } catch {
        throw new ModelError('AI returned no structured result.', 'invalid');
    }
    const usage = response?.usage || {};
    return {
        data,
        usage: {
            inputTokens: Number(usage.input_tokens) || 0,
            outputTokens: Number(usage.output_tokens) || 0,
            cachedTokens: Number(usage.input_tokens_details?.cached_tokens) || 0
        }
    };
};
