export const toMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toMillis === "function") return value.toMillis();
    // Handle Firestore Timestamp like object {seconds: ..., nanoseconds: ...}
    if (value && typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
};

export const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number' || typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value.toDate === 'function') {
        const parsed = value.toDate();
        return parsed instanceof Date ? parsed : null;
    }
    // Handle serialized Timestamp {seconds, nanoseconds}
    if (value && typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000);
    }
    return null;
};

const normalizeLanguage = (language?: string) => {
    if (!language) return 'en';
    const value = language.toLowerCase();
    if (value.startsWith('de')) return 'de';
    return 'en';
};

const resolveLanguage = (language?: string) => {
    if (language) return normalizeLanguage(language);
    if (typeof document !== 'undefined' && document.documentElement.lang) {
        return normalizeLanguage(document.documentElement.lang);
    }
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('pf-language');
        if (stored) return normalizeLanguage(stored);
    }
    return 'en';
};

export const timeAgo = (timestamp?: any, language?: string) => {
    if (!timestamp) return '';
    const resolvedLanguage = resolveLanguage(language);
    const diff = Math.abs(Date.now() - toMillis(timestamp));
    const mins = Math.round(diff / 60000);
    const format = (value: number, unit: { en: string; de: string }) => {
        if (resolvedLanguage === 'de') return `vor ${value} ${unit.de}`;
        return `${value}${unit.en} ago`;
    };
    if (mins < 60) return format(mins || 1, { en: 'm', de: 'Min.' });
    const hours = Math.round(mins / 60);
    if (hours < 24) return format(hours, { en: 'h', de: 'Std.' });
    const days = Math.round(hours / 24);
    if (days < 30) return format(days, { en: 'd', de: 'T.' });
    const months = Math.round(days / 30);
    if (months < 12) return format(months, { en: 'mo', de: 'Mon.' });
    const years = Math.round(months / 12);
    return format(years, { en: 'y', de: 'J.' });
};
