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
        const result = normalizeModulesForPmCore(['tasks', 'ideas', 'issues', 'social']);
        expect(result).toEqual(expect.arrayContaining(PM_CORE_DEFAULT_MODULES));
        PM_CORE_DEPRECATED_MODULES.forEach((module) => {
            expect(result).not.toContain(module);
        });
    });

    it('marks deprecated nav ids when PM core is on', () => {
        expect(isDeprecatedProjectNavId('issues')).toBe(true);
        expect(isDeprecatedProjectNavId('tasks')).toBe(false);
    });

    it('filters wizard module options', () => {
        const filtered = filterModulesForWizardOptions(['tasks', 'initiatives', 'ideas', 'issues']);
        expect(filtered).toEqual(['tasks', 'initiatives']);
    });
});
