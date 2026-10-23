import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/billingService', () => ({ personalAiKey: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../useEntitlements', () => ({ useActivePlan: () => ({ plan: null }) }));

import { aiAccessFromError } from '../useAiAccess';

describe('aiAccessFromError', () => {
    it('maps the AI plan codes and ignores everything else', () => {
        expect(aiAccessFromError('ai-addon-required')).toBe('addon-required');
        expect(aiAccessFromError('ai-plan-required')).toBe('plan-required');
        expect(aiAccessFromError('ai-not-enabled')).toBe('plan-required');
        expect(aiAccessFromError('plan-project-limit')).toBeNull();
        expect(aiAccessFromError(undefined)).toBeNull();
    });
});
