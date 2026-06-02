import { describe, expect, it } from 'vitest';

import type { InitiativeFeedbackField } from '../../types';
import {
    buildInitiativeFeedbackEmbedModel,
    defaultInitiativeFeedbackFields,
    getInitiativeFeedbackBuilderIssues,
    localizePublicInitiativeFeedbackCopy,
    localizePublicInitiativeFeedbackFields,
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

    it('builds an embed model with config, form schema, and submit example', () => {
        const model = buildInitiativeFeedbackEmbedModel({
            token: 'abc123',
            hostedUrl: 'https://app.example.com/feedback/initiative/abc123',
            configEndpoint: 'https://functions.example.com/getInitiativeFeedbackForm',
            submitEndpoint: 'https://functions.example.com/submitInitiativeFeedback',
            initiativeTitle: 'Install operating rhythm',
            title: 'Share feedback',
            description: 'Tell us what happened.',
            submitLabel: 'Send feedback',
            successMessage: 'Thanks!',
            allowAttachments: true,
            maxAttachments: 2,
            fields: [
                baseField({ id: 'summary', role: 'title', label: 'Summary', required: true, width: 'full' }),
                baseField({ id: 'details', role: 'description', label: 'Details', type: 'longText', width: 'full' }),
            ],
        });

        expect(model.token).toBe('abc123');
        expect(model.form.fields).toHaveLength(2);
        expect(model.submitExample).toMatchObject({
            token: 'abc123',
            source: 'embedded-endpoint',
            fieldValues: {
                summary: 'Summary',
                details: 'Describe the feedback in more detail.',
            },
        });
        expect(model.submitExample.attachments).toHaveLength(1);
    });

    it('localizes default public form fields and copy', () => {
        const t = (key: string) => {
            const translations: Record<string, string> = {
                'initiatives.feedback.public.fields.customerName': 'Dein Name',
                'initiatives.feedback.public.fields.customerEmail': 'E-Mail-Adresse',
                'initiatives.feedback.public.fields.company': 'Firma oder Team',
                'initiatives.feedback.public.fields.sourceUrl': 'Seiten- oder Screen-URL',
                'initiatives.feedback.public.fields.title': 'Kurze Zusammenfassung',
                'initiatives.feedback.public.fields.description': 'Was ist passiert?',
                'initiatives.feedback.builder.defaultPlaceholders.customerName': 'Max Mustermann',
                'initiatives.feedback.builder.defaultPlaceholders.customerEmail': 'max@firma.de',
                'initiatives.feedback.builder.defaultPlaceholders.company': 'Beispiel GmbH',
                'initiatives.feedback.builder.defaultPlaceholders.sourceUrl': 'https://app.beispiel.de',
                'initiatives.feedback.builder.defaultPlaceholders.title': 'Worauf sollen wir achten?',
                'initiatives.feedback.builder.defaultPlaceholders.description': 'Beschreibe das Feedback genauer.',
                'initiatives.feedback.fields.titlePlaceholder': 'Feedback teilen',
                'initiatives.feedback.fields.descriptionPlaceholder': 'Beschreibe, was passiert ist.',
                'initiatives.feedback.fields.submitLabelPlaceholder': 'Feedback senden',
                'initiatives.feedback.fields.successMessagePlaceholder': 'Danke für dein Feedback.',
            };
            return translations[key] || key;
        };

        const localizedFields = localizePublicInitiativeFeedbackFields(defaultInitiativeFeedbackFields(), t);
        expect(localizedFields[0]).toMatchObject({
            role: 'customerName',
            label: 'Dein Name',
            placeholder: 'Max Mustermann',
        });

        const localizedCopy = localizePublicInitiativeFeedbackCopy({
            title: 'Share feedback',
            description: '',
            submitLabel: 'Submit feedback',
            successMessage: 'Thanks. Your feedback was submitted successfully.',
        }, t);

        expect(localizedCopy).toMatchObject({
            title: 'Feedback teilen',
            description: 'Beschreibe, was passiert ist.',
            submitLabel: 'Feedback senden',
            successMessage: 'Danke für dein Feedback.',
        });
    });

    it('keeps custom public form copy and field labels untouched', () => {
        const t = (key: string) => key;
        const fields = defaultInitiativeFeedbackFields().map((field) => (
            field.role === 'customerName'
                ? { ...field, label: 'Reporter name', placeholder: 'Who are you?' }
                : field
        ));

        expect(localizePublicInitiativeFeedbackFields(fields, t)[0]).toMatchObject({
            label: 'Reporter name',
            placeholder: 'Who are you?',
        });

        expect(localizePublicInitiativeFeedbackCopy({
            title: 'Product feedback',
            description: 'Tell us what you think.',
            submitLabel: 'Send it',
            successMessage: 'We got it.',
        }, t)).toMatchObject({
            title: 'Product feedback',
            description: 'Tell us what you think.',
            submitLabel: 'Send it',
            successMessage: 'We got it.',
        });
    });
});
