import { describe, expect, it } from 'vitest';

import type { InitiativeFeedbackField } from '../../types';
import {
    getInitiativeFeedbackBuilderIssues,
    prepareInitiativeFeedbackFieldsForSave,
} from '../initiativeFeedbackBuilder';

const baseField = (overrides: Partial<InitiativeFeedbackField>): InitiativeFeedbackField => ({
    id: 'field-a',
    role: 'general',
    type: 'shortText',
    label: 'Field A',
    enabled: true,
    width: 'half',
    options: [],
    ...overrides,
});

describe('initiative feedback builder helpers', () => {
    it('normalizes field ids and trims save payload text', () => {
        const fields = prepareInitiativeFeedbackFieldsForSave([
            baseField({
                id: ' Custom Field ',
                label: '  Customer need  ',
                placeholder: '  Add detail  ',
                helpText: '  Keep it short  ',
            }),
        ]);

        expect(fields[0]).toMatchObject({
            id: 'custom-field',
            label: 'Customer need',
            placeholder: 'Add detail',
            helpText: 'Keep it short',
            role: 'general',
        });
    });

    it('keeps select options trimmed and limited', () => {
        const fields = prepareInitiativeFeedbackFieldsForSave([
            baseField({
                type: 'select',
                options: Array.from({ length: 10 }, (_, index) => ({
                    id: ` option ${index + 1} `,
                    label: ` Option ${index + 1} `,
                    value: ` Option ${index + 1} `,
                })),
            }),
        ]);

        expect(fields[0].options).toHaveLength(8);
        expect(fields[0].options?.[0]).toMatchObject({
            id: 'option-1',
            label: 'Option 1',
            value: 'Option 1',
        });
    });

    it('reports blocking issues for unsavable forms', () => {
        const issues = getInitiativeFeedbackBuilderIssues([
            baseField({ id: 'blank', label: '', type: 'shortText' }),
            baseField({ id: 'select', label: 'Topic', type: 'select', options: [] }),
        ]);

        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'missingLabel', severity: 'blocking', fieldId: 'blank' }),
            expect.objectContaining({ code: 'selectNeedsOptions', severity: 'blocking', fieldId: 'select' }),
        ]));
    });

    it('warns when task mapping fields are hidden', () => {
        const issues = getInitiativeFeedbackBuilderIssues([
            baseField({ id: 'title', role: 'title', label: 'Summary', enabled: false }),
            baseField({ id: 'details', role: 'description', label: 'Details', enabled: true }),
        ]);

        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'missingTitleMapping', severity: 'warning' }),
        ]));
    });

    it('warns when multiple visible fields use the same task mapping', () => {
        const issues = getInitiativeFeedbackBuilderIssues([
            baseField({ id: 'title-a', role: 'title', label: 'Summary', enabled: true }),
            baseField({ id: 'title-b', role: 'title', label: 'Customer headline', enabled: true }),
            baseField({ id: 'details', role: 'description', label: 'Details', enabled: true }),
        ]);

        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'duplicateRoleMapping', severity: 'warning', fieldId: 'title-a' }),
            expect.objectContaining({ code: 'duplicateRoleMapping', severity: 'warning', fieldId: 'title-b' }),
        ]));
    });
});
