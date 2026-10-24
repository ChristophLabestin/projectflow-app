// Adapters that turn a golden-fixture `input` into its `expected` output.
//
// Used by the Vitest suite (utils/__tests__/goldenFixtures.test.ts) and by
// shared/fixtures/generate.mjs, so both always call the implementation the
// same way. The iOS XCTests mirror these adapters; shared/fixtures/README.md
// documents the input/output of every module.

import { buildAttention, classifyPortfolio, type AttentionInput } from './attention';
import { buildDayPlan, type DayPlanInput } from './dayPlan';
import { groupByDueBucket, normalizeStatus, summarizeDue, type DueBucketTask, type DueContext } from './dueBuckets';
import { formQuotaFor, validateFormSchema, validateSubmission, visibleFormItems, type FormAnswers, type FormSchema } from './formsLogic';
import { parseQuery, scoreCandidate } from './globalSearch';

export const FIXTURE_MODULES = [
    'dayPlan',
    'dueBuckets',
    'attention',
    'portfolioGroup',
    'globalSearch',
    'globalSearchScore',
    'formsSchema',
    'formsVisibility',
    'formsSubmission',
    'formsQuota'
] as const;

export type FixtureModule = typeof FIXTURE_MODULES[number];

export interface DueBucketsFixtureInput extends DueContext {
    tasks: DueBucketTask[];
}

export const runFixture = (module: FixtureModule, input: unknown): unknown => {
    switch (module) {
        case 'dayPlan':
            return buildDayPlan(input as DayPlanInput);
        case 'dueBuckets': {
            const { tasks, ...context } = input as DueBucketsFixtureInput;
            return {
                groups: groupByDueBucket(tasks, context).map((group) => ({
                    key: group.key,
                    tasks: group.tasks.map((task) => ({ id: task.id, status: normalizeStatus(task) }))
                })),
                summary: summarizeDue(tasks, context)
            };
        }
        case 'attention':
            return buildAttention(input as AttentionInput);
        case 'portfolioGroup':
            return classifyPortfolio(input as Parameters<typeof classifyPortfolio>[0]);
        case 'globalSearch': {
            const parsed = parseQuery((input as { query: string }).query);
            return { ...parsed, prefixScope: parsed.prefixScope ?? null, priority: parsed.priority ?? null };
        }
        case 'globalSearchScore': {
            const { terms, title, secondary } = input as { terms: string[]; title: string; secondary?: string[] };
            return { score: scoreCandidate(terms, title, secondary || []) };
        }
        case 'formsSchema':
            return { issues: validateFormSchema((input as { schema: FormSchema }).schema) };
        case 'formsVisibility': {
            const { schema, answers } = input as { schema: FormSchema; answers: FormAnswers };
            return visibleFormItems(schema, answers);
        }
        case 'formsSubmission': {
            const { schema, answers } = input as { schema: FormSchema; answers: FormAnswers };
            return validateSubmission(schema, answers);
        }
        case 'formsQuota': {
            const { entitlement, tenant } = input as { entitlement: Record<string, unknown> | null; tenant: Record<string, unknown> | null };
            return formQuotaFor(entitlement, tenant);
        }
        default:
            throw new Error(`Unknown fixture module: ${String(module)}`);
    }
};
