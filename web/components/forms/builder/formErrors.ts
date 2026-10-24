import { formErrorCode } from '../../../services/domain/formsService';

/** User-facing text for a Forms callable error (`forms.error.<code>`, else a generic message). */
export const formErrorText = (t: (key: string, fallback?: string) => string, error: unknown) =>
    t(`forms.error.${formErrorCode(error)}`, t('forms.error.generic'));
