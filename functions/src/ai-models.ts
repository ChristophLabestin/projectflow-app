/**
 * Model layer for the in-app assistant: one place that knows the provider. Callers ask for a tier
 * (`fast` inline writing, `agent` panel with tools, `deep` reports) and get streamed text, tool calls
 * and usage. Today OpenAI (Responses API); switching providers only touches this file.
 */
import OpenAI from 'openai';

export type ModelTier = 'fast' | 'agent' | 'deep';
type Effort = 'none' | 'low' | 'medium' | 'high';
/** OpenAI processing tier: `fast` (former priority processing, 2x price) cuts time to first token. */
type ServiceTier = 'default' | 'fast' | 'flex';

/**
 * Tier → model, reasoning effort and processing tier. Env overrides (`AI_MODEL_FAST`, `AI_EFFORT_FAST`,
 * `AI_SERVICE_TIER_FAST`, …) allow tuning without code. Inline writing and the panel are latency-bound,
 * so they run on Fast mode; reports are not.
 */
const env = (key: string) => process.env[key] || undefined;
const TIERS: Record<ModelTier, { model: string; effort: Effort; serviceTier: ServiceTier }> = {
    fast: { model: env('AI_MODEL_FAST') || 'gpt-6-luna', effort: (env('AI_EFFORT_FAST') as Effort) || 'none', serviceTier: (env('AI_SERVICE_TIER_FAST') as ServiceTier) || 'fast' },
    agent: { model: env('AI_MODEL_AGENT') || 'gpt-6-luna', effort: (env('AI_EFFORT_AGENT') as Effort) || 'low', serviceTier: (env('AI_SERVICE_TIER_AGENT') as ServiceTier) || 'fast' },
    deep: { model: env('AI_MODEL_DEEP') || 'gpt-6-sol', effort: (env('AI_EFFORT_DEEP') as Effort) || 'medium', serviceTier: (env('AI_SERVICE_TIER_DEEP') as ServiceTier) || 'default' }
};

export const tierModel = (tier: ModelTier) => TIERS[tier];

export interface ModelUsage { inputTokens: number; outputTokens: number; cachedTokens: number }

export interface FunctionCall { callId: string; name: string; arguments: string }

export interface ModelTurn {
    responseId: string;
    text: string;
    functionCalls: FunctionCall[];
    usage: ModelUsage;
}

export interface FunctionTool { type: 'function'; name: string; description: string; parameters: Record<string, unknown>; strict: boolean }

export interface StreamRequest {
    tier: ModelTier;
    instructions: string;
    /** First turn: user input; follow-up turns: tool outputs for `previousResponseId`. */
    input: string | Array<{ role: 'user' | 'assistant'; content: string } | { type: 'function_call_output'; call_id: string; output: string }>;
    previousResponseId?: string;
    tools?: FunctionTool[];
    maxOutputTokens?: number;
    signal?: AbortSignal;
}

let client: OpenAI | null = null;
export const getClient = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set in environment variables.');
    client = client || new OpenAI({ apiKey });
    return client;
};

export class ModelError extends Error {
    constructor(message: string, readonly kind: 'quota' | 'unavailable' | 'invalid') {
        super(message);
    }
}

export const toModelError = (error: any): ModelError => {
    const status = Number(error?.status);
    console.error('AI provider error', { status, message: error?.message });
    if (status === 429) return new ModelError('AI provider is busy or out of credit.', 'quota');
    if (status === 400) return new ModelError(`AI request rejected: ${error?.message || 'bad request'}`, 'invalid');
    return new ModelError('AI provider unavailable.', 'unavailable');
};

/** Stream one model turn. `onDelta` gets text chunks as they arrive. */
export const streamTurn = async (request: StreamRequest, onDelta: (text: string) => void): Promise<ModelTurn> => {
    const { model, effort, serviceTier } = TIERS[request.tier];
    const body: any = {
        model,
        service_tier: serviceTier,
        reasoning: { effort },
        instructions: request.instructions,
        input: request.input,
        stream: true,
        max_output_tokens: request.maxOutputTokens || 4000
    };
    if (request.previousResponseId) body.previous_response_id = request.previousResponseId;
    if (request.tools?.length) {
        body.tools = request.tools;
        body.parallel_tool_calls = true;
    }

    const startedAt = Date.now();
    let firstDeltaAt = 0;
    let stream: any;
    try {
        stream = await getClient().responses.create(body, { signal: request.signal });
    } catch (error) {
        throw toModelError(error);
    }

    let text = '';
    let final: any = null;
    try {
        for await (const event of stream) {
            if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
                if (!firstDeltaAt) firstDeltaAt = Date.now();
                text += event.delta;
                onDelta(event.delta);
            } else if (event.type === 'response.completed' || event.type === 'response.incomplete') {
                final = event.response;
            } else if (event.type === 'response.failed' || event.type === 'error') {
                throw new ModelError(event.response?.error?.message || event.message || 'AI response failed.', 'unavailable');
            }
        }
    } catch (error) {
        throw error instanceof ModelError ? error : toModelError(error);
    }

    const output = Array.isArray(final?.output) ? final.output : [];
    const functionCalls: FunctionCall[] = output
        .filter((item: any) => item?.type === 'function_call')
        .map((item: any) => ({ callId: item.call_id, name: item.name, arguments: item.arguments || '{}' }));
    const usage = final?.usage || {};
    console.log('AI model timing', {
        tier: request.tier, model, effort, serviceTier: final?.service_tier, firstTextMs: firstDeltaAt ? firstDeltaAt - startedAt : null, totalMs: Date.now() - startedAt,
        inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, reasoningTokens: usage.output_tokens_details?.reasoning_tokens
    });
    return {
        responseId: final?.id || '',
        text,
        functionCalls,
        usage: {
            inputTokens: Number(usage.input_tokens) || 0,
            outputTokens: Number(usage.output_tokens) || 0,
            cachedTokens: Number(usage.input_tokens_details?.cached_tokens) || 0
        }
    };
};
