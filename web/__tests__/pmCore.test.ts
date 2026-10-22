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
        const legacy = normalizeModulesForPmCore(['tasks', 'social' as any]);
        expect(legacy).not.toContain('social');
        const result = normalizeModulesForPmCore(['tasks', 'marketing']);
        expect(result).toEqual(expect.arrayContaining(PM_CORE_DEFAULT_MODULES));
        PM_CORE_DEPRECATED_MODULES.forEach((module) => {
            expect(result).not.toContain(module);
        });
        // Chosen extras are kept; unchosen ones are not forced onto new projects.
        expect(result).toContain('marketing');
        expect(result).toContain('milestones');
        expect(result).not.toContain('accounting');
        expect(result).not.toContain('sprints');
    });

    it('marks deprecated nav ids when PM core is on', () => {
        expect(isDeprecatedProjectNavId('issues')).toBe(true);
        expect(isDeprecatedProjectNavId('ideas')).toBe(true);
        expect(isDeprecatedProjectNavId('flows')).toBe(true);
        expect(isDeprecatedProjectNavId('tasks')).toBe(false);
        expect(isDeprecatedProjectNavId('social')).toBe(true);
        expect(isDeprecatedProjectNavId('marketing')).toBe(false);
        expect(isDeprecatedProjectNavId('sprints')).toBe(false);
        expect(isDeprecatedProjectNavId('milestones')).toBe(false);
    });

    it('filters wizard module options', () => {
        const filtered = filterModulesForWizardOptions(['tasks', 'initiatives', 'social' as any, 'marketing', 'sprints', 'milestones']);
        expect(filtered).toEqual(['tasks', 'initiatives', 'marketing', 'sprints', 'milestones']);
    });
});
