// Wiki AI helpers on the fixed server capabilities (`runAiCapability`, functions/src/ai-capabilities.ts).
// Callers always show the result for confirmation before anything is inserted or created.
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const MAX_INPUT_CHARS = 24_000;

type WikiCapability = 'wikiSummarize' | 'wikiImprove' | 'wikiExtractTasks';

const runCapability = async (capability: WikiCapability, input: Record<string, unknown>, language: string): Promise<string> => {
    const call = httpsCallable<
        { capability: WikiCapability; input: Record<string, unknown>; language: string },
        { text: string; tokensUsed: number }
    >(functions, 'runAiCapability');
    const { data } = await call({ capability, input, language });
    return String(data?.text || '').trim();
};

const clip = (value: string) => value.slice(0, MAX_INPUT_CHARS);

export const summarizeWikiPage = (title: string, text: string, language: string) =>
    runCapability('wikiSummarize', { title, text: clip(text) }, language);

export const improveWikiText = (text: string, language: string) =>
    runCapability('wikiImprove', { text: clip(text) }, language);

export interface WikiAiTask {
    title: string;
    description?: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
}

export const parseAiTasks = (raw: string): WikiAiTask[] => {
    try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tasks) ? parsed.tasks : [];
        return list
            .filter((item: unknown): item is WikiAiTask => Boolean(item && typeof (item as WikiAiTask).title === 'string' && (item as WikiAiTask).title.trim()))
            .slice(0, 20)
            .map((item: WikiAiTask) => ({
                title: item.title.trim().slice(0, 200),
                description: typeof item.description === 'string' ? item.description.trim().slice(0, 2000) : undefined,
                priority: ['Low', 'Medium', 'High', 'Urgent'].includes(item.priority as string) ? item.priority : 'Medium',
            }));
    } catch {
        return [];
    }
};

export const extractWikiTasks = async (title: string, text: string, language: string): Promise<WikiAiTask[]> =>
    parseAiTasks(await runCapability('wikiExtractTasks', { title, text: clip(text) }, language));
