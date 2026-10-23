// Wiki AI helpers on the existing `callGemini` callable (OpenAI via functions/src/ai-service.ts).
// Callers always show the result for confirmation before anything is inserted or created.
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const MAX_INPUT_CHARS = 24_000;

const callAi = async (prompt: string, systemInstruction: string, jsonMode = false): Promise<string> => {
    const call = httpsCallable(functions, 'callGemini');
    const { data } = await call({ prompt, systemInstruction, jsonMode, temperature: 0.3, model: 'gpt-5-mini' });
    return String((data as { text?: string })?.text || '').trim();
};

const languageName = (language: string) => (language === 'de' ? 'German' : 'English');

const clip = (value: string) => (value.length > MAX_INPUT_CHARS ? `${value.slice(0, MAX_INPUT_CHARS)}\n…` : value);

export const summarizeWikiPage = (title: string, text: string, language: string) =>
    callAi(
        `Page title: ${title}\n\n${clip(text)}`,
        `You summarize internal wiki pages for a project team. Answer in ${languageName(language)}. `
        + 'Return 3 to 6 short bullet points as plain lines starting with "- ". No intro, no closing remark, no markdown headings.',
    );

export const improveWikiText = (text: string, language: string) =>
    callAi(
        clip(text),
        `You are an editor. Improve clarity, grammar and flow of the text while keeping its meaning, facts, tone and language `
        + `(default ${languageName(language)}). Keep line breaks and list structure. Return only the improved text.`,
    );

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

export const extractWikiTasks = async (title: string, text: string, language: string): Promise<WikiAiTask[]> => {
    const raw = await callAi(
        `Page title: ${title}\n\n${clip(text)}`,
        `Extract concrete, actionable tasks from this wiki page. Write titles in ${languageName(language)}, imperative, max 80 characters. `
        + 'Skip anything that is already done or only an idea. Return JSON: {"tasks":[{"title":string,"description":string,"priority":"Low"|"Medium"|"High"|"Urgent"}]}. '
        + 'Return {"tasks":[]} when there are none.',
        true,
    );
    return parseAiTasks(raw);
};
