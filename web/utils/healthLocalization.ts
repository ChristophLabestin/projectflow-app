import { HealthFactor, ProjectHealth } from '../services/healthService';

type Translator = (key: string, fallback?: string) => string;

export const interpolate = (
    template: string,
    meta?: Record<string, number | string>
): string => {
    if (!meta) return template;
    return Object.entries(meta).reduce((text, [key, value]) => {
        const token = new RegExp(`\\{${key}\\}`, 'g');
        return text.replace(token, String(value));
    }, template);
};

export const getHealthFactorText = (factor: HealthFactor, t: Translator) => {
    const label = factor.labelKey ? t(factor.labelKey, factor.label) : factor.label;
    const rawDescription = factor.descriptionKey ? t(factor.descriptionKey, factor.description) : factor.description;
    const description = interpolate(rawDescription, factor.meta);
    return { label, description };
};

export const getHealthRecommendations = (health: ProjectHealth, t: Translator): string[] => {
    if (health.recommendationKeys && health.recommendationKeys.length > 0) {
        return health.recommendationKeys.map((key, index) => {
            const fallback = health.recommendations?.[index] || '';
            return t(key, fallback);
        });
    }
    return health.recommendations || [];
};
