export type AppLanguage = 'en' | 'de';

const normalizeLanguage = (value?: string): AppLanguage => {
    if (!value) return 'en';
    const lower = value.toLowerCase();
    if (lower.startsWith('de')) return 'de';
    return 'en';
};

export const getPreferredLanguage = (): AppLanguage => {
    if (typeof document !== 'undefined' && document.documentElement?.lang) {
        return normalizeLanguage(document.documentElement.lang);
    }
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('pf-language');
        if (stored) return normalizeLanguage(stored);
    }
    return 'en';
};

export const getAIResponseInstruction = (language?: AppLanguage) => {
    const resolved = language || getPreferredLanguage();
    const languageName = resolved === 'de' ? 'German' : 'English';
    const instruction = `Respond in ${languageName}. If your response must follow a JSON schema, keep keys and any IDs, enums, statuses, priorities, and type fields in English, and only translate free-text fields.`;
    return { language: resolved, languageName, instruction };
};

export const applyLanguageInstruction = (contents: any, instruction: string) => {
    if (!instruction) return contents;
    if (typeof contents === 'string') {
        return `${contents}\n\n${instruction}`;
    }
    if (Array.isArray(contents)) {
        const updated = contents.map(item => ({
            ...item,
            parts: Array.isArray(item.parts) ? item.parts.map((part: any) => ({ ...part })) : item.parts
        }));
        const lastIndex = updated.length - 1;
        const last = updated[lastIndex];
        if (last && last.role === 'user' && Array.isArray(last.parts)) {
            const lastParts = last.parts.slice();
            const lastPartIndex = lastParts.length - 1;
            const lastPart = lastParts[lastPartIndex];
            if (lastPart && typeof lastPart.text === 'string') {
                lastParts[lastPartIndex] = { ...lastPart, text: `${lastPart.text}\n\n${instruction}` };
            } else {
                lastParts.push({ text: instruction });
            }
            updated[lastIndex] = { ...last, parts: lastParts };
            return updated;
        }
        return [...updated, { role: 'user', parts: [{ text: instruction }] }];
    }
    return contents;
};
