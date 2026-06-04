import { describe, expect, it } from 'vitest';
import {
    filterModulesForWizardOptions,
    isDeprecatedProjectNavId,
    normalizeModulesForPmCore,
    PM_CORE_DEFAULT_MODULES,
    PM_CORE_DEPRECATED_MODULES
} from '../config/pmCore';

describe('pmCore', () => {
    it('normalizes modules to PM core defaults', () => {
        const result = normalizeModulesForPmCore(['tasks', 'social']);
        expect(result).toEqual(expect.arrayContaining(PM_CORE_DEFAULT_MODULES));
        PM_CORE_DEPRECATED_MODULES.forEach((module) => {
            expect(result).not.toContain(module);
        });
        expect(result).toContain('social');
        expect(result).toContain('marketing');
        expect(result).toContain('accounting');
        expect(result).toContain('sprints');
        expect(result).toContain('milestones');
    });

    it('marks deprecated nav ids when PM core is on', () => {
        expect(isDeprecatedProjectNavId('issues')).toBe(true);
        expect(isDeprecatedProjectNavId('ideas')).toBe(true);
        expect(isDeprecatedProjectNavId('flows')).toBe(true);
        expect(isDeprecatedProjectNavId('tasks')).toBe(false);
        expect(isDeprecatedProjectNavId('social')).toBe(false);
        expect(isDeprecatedProjectNavId('marketing')).toBe(false);
        expect(isDeprecatedProjectNavId('sprints')).toBe(false);
        expect(isDeprecatedProjectNavId('milestones')).toBe(false);
    });

    it('filters wizard module options', () => {
        const filtered = filterModulesForWizardOptions(['tasks', 'initiatives', 'social', 'marketing', 'sprints', 'milestones']);
        expect(filtered).toEqual(['tasks', 'initiatives', 'social', 'marketing', 'sprints', 'milestones']);
    });
});
