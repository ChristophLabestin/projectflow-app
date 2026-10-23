import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({
    auth: { currentUser: { getIdToken: () => Promise.resolve('id-token') } }
}));

import { AiAssistError, streamAiAssist } from '../aiAssistClient';

const sseResponse = (chunks: string[], status = 200) => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
            controller.close();
        }
    });
    return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
};

const writeRequest = { capability: 'write' as const, tenantId: 't1', input: { action: 'shorten' as const, field: 'comment' as const, text: 'Hallo' } };

describe('streamAiAssist', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('streams deltas across chunk boundaries and reports credits', async () => {
        const fetchMock = vi.fn().mockResolvedValue(sseResponse([
            'event: delta\ndata: {"text":"Hal"}\n\nevent: del',
            'ta\ndata: {"text":"lo"}\n\n',
            'event: done\ndata: {"credits":3,"limit":2000}\n\n'
        ]));
        vi.stubGlobal('fetch', fetchMock);
        const deltas: string[] = [];
        const result = await streamAiAssist(writeRequest, { onDelta: (text) => deltas.push(text) });
        expect(deltas).toEqual(['Hal', 'lo']);
        expect(result).toEqual({ text: 'Hallo', credits: 3, limit: 2000 });
        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers.Authorization).toBe('Bearer id-token');
        expect(JSON.parse(init.body)).toMatchObject({ capability: 'write', tenantId: 't1' });
    });

    it('turns stream error events into AiAssistError with the server code', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([
            'event: delta\ndata: {"text":"x"}\n\n',
            'event: error\ndata: {"code":"provider-unavailable","message":"down"}\n\n'
        ])));
        await expect(streamAiAssist(writeRequest)).rejects.toMatchObject({ code: 'provider-unavailable' });
    });

    it('maps HTTP errors before the stream starts', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Out', code: 'credits-exhausted' }), { status: 429 })));
        const error = await streamAiAssist(writeRequest).catch((caught) => caught);
        expect(error).toBeInstanceOf(AiAssistError);
        expect(error.code).toBe('credits-exhausted');
    });

    it('reports network failures', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
        await expect(streamAiAssist(writeRequest)).rejects.toMatchObject({ code: 'network' });
    });
});
