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

export const timeAgo = (timestamp?: any) => {
    if (!timestamp) return '';
    const diff = Math.abs(Date.now() - toMillis(timestamp));
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${mins || 1}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.round(months / 12);
    return `${years}y ago`;
};
