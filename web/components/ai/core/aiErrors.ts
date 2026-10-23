/** User-facing text for an aiAssist error code (`ai.error.<code>`), falling back to the generic message. */
export const aiErrorMessage = (code: string, t: (key: string) => string) => {
    const key = `ai.error.${code}`;
    const message = t(key);
    return message === key ? t('ai.error.internal') : message;
};
