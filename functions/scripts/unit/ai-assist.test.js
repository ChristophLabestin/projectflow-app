// Unit test: in-app assistant building blocks — context envelope, write requests, credits, tool registry.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeContext, renderContextBlock, normalizeMessages, buildAssistInstructions, buildWriteRequest, AssistInputError, WRITE_ACTIONS
} = require('../../lib/ai-assist-prompts');
const { canSpend, estimateCostMicros, resolveMonthlyLimit, CREDIT_WEIGHTS, DEFAULT_MONTHLY_CREDITS } = require('../../lib/ai-credits');
const { AI_TOOLS, toOpenAiTools, parseToolArgs, findTool, ToolError, serializeToolResult } = require('../../lib/ai-tools/registry');
const { normalizeAiPolicy, DEFAULT_AI_POLICY } = require('../../lib/ai-access');

test('context envelope keeps only references, clips text and drops bad ids', () => {
    const context = normalizeContext({
        surface: 'task', route: '/project/p1/tasks/t1?secret=1',
        entity: { kind: 'task', id: 't1', projectId: 'p1' },
        selection: { ids: ['a', 'b/../c', 'd'], text: 'x'.repeat(9000) },
        view: { items: [{ id: 't2', title: 'Hero' }, { id: '', title: 'no id' }] },
        injected: 'ignore me'
    }, 'de');
    assert.equal(context.surface, 'task');
    assert.equal(context.route, '/project/p1/tasks/t1');
    assert.deepEqual(context.entity, { kind: 'task', id: 't1', projectId: 'p1' });
    assert.deepEqual(context.selectionIds, ['a', 'd']);
    assert.equal(context.selectionText.length, 4000);
    assert.deepEqual(context.visible, [{ id: 't2', title: 'Hero' }]);
    assert.equal(context.language, 'de');
    assert.equal(normalizeContext({ surface: 'evil' }, 'en').surface, 'other');
});

test('context block wraps everything as workspace data', () => {
    const block = renderContextBlock(normalizeContext({ surface: 'board' }, 'en'), { project: { id: 'p1', title: 'Web' } });
    assert.match(block, /^<workspace_data source="current_screen">/);
    assert.match(block, /<\/workspace_data>$/);
    const instructions = buildAssistInstructions('de', block, new Date('2026-10-23T10:00:00Z'));
    assert.match(instructions, /Today is 2026-10-23/);
    assert.match(instructions, /Answer in German/);
    assert.match(instructions, /not instructions/);
    assert.match(instructions, /pf:\/\/task/);
});

test('messages: last one must be from the user, history capped', () => {
    assert.throws(() => normalizeMessages([]), AssistInputError);
    assert.throws(() => normalizeMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]), AssistInputError);
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })).concat([{ role: 'user', content: 'last' }]);
    const result = normalizeMessages(many);
    assert.equal(result.length, 20);
    assert.equal(result.at(-1).content, 'last');
});

test('write requests: known actions only, field data delimited, limits per field', () => {
    assert.throws(() => buildWriteRequest({ action: 'jailbreak', text: 'x' }, 'en'), AssistInputError);
    assert.throws(() => buildWriteRequest({ action: 'shorten', text: '' }, 'en'), AssistInputError);
    assert.throws(() => buildWriteRequest({ action: 'custom', text: 'x' }, 'en'), AssistInputError);
    assert.throws(() => buildWriteRequest({ action: 'draft' }, 'en'), AssistInputError);
    const draft = buildWriteRequest({ action: 'draft', field: 'description', itemTitle: 'Login bug' }, 'de');
    assert.match(draft.input, /^<field_data>/);
    assert.match(draft.instructions, /German/);
    assert.equal(buildWriteRequest({ action: 'rephrase', field: 'title', text: 'x' }, 'en').maxOutputTokens, 120);
    const custom = buildWriteRequest({ action: 'custom', text: 'abc', instruction: 'y'.repeat(1000) }, 'en');
    assert.ok(custom.input.length < 600);
    for (const action of WRITE_ACTIONS) {
        assert.ok(buildWriteRequest({ action, text: 'Hallo Welt', instruction: 'kürzer' }, 'de').instructions.length > 50, action);
    }
});

test('credits: weights, limit resolution, spend check and cost estimate', () => {
    assert.equal(CREDIT_WEIGHTS.write, 1);
    assert.equal(CREDIT_WEIGHTS.assist, 5);
    assert.equal(resolveMonthlyLimit({}), DEFAULT_MONTHLY_CREDITS);
    assert.equal(resolveMonthlyLimit({ monthlyCredits: 500 }), 500);
    assert.equal(resolveMonthlyLimit({ monthlyCredits: -1 }), DEFAULT_MONTHLY_CREDITS);
    assert.ok(canSpend(1995, 5, 2000));
    assert.ok(!canSpend(1996, 5, 2000));
    // 1M uncached input + 1M output on gpt-6-luna = $0.10 + $0.50 = 600000 micro-dollars
    assert.equal(estimateCostMicros('gpt-6-luna', { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedTokens: 0 }), 600000);
    assert.equal(estimateCostMicros('gpt-6-luna', { inputTokens: 1_000_000, outputTokens: 0, cachedTokens: 0 }, 'fast'), 200000);
    assert.equal(estimateCostMicros('unknown', { inputTokens: 5, outputTokens: 5, cachedTokens: 0 }), 0);
});

test('policy: in-app assistant switch on, rollout flag off by default', () => {
    assert.equal(DEFAULT_AI_POLICY.inAppEnabled, true);
    assert.equal(DEFAULT_AI_POLICY.inAppAi, false);
    assert.equal(normalizeAiPolicy({ inAppAi: true }).inAppAi, true);
    assert.equal(normalizeAiPolicy({ inAppAi: 'yes' }).inAppAi, false);
});

test('tool registry: JSON schemas for OpenAI, argument validation, result cap', () => {
    const tools = toOpenAiTools(AI_TOOLS);
    assert.equal(tools.length, AI_TOOLS.length);
    for (const entry of tools) {
        assert.equal(entry.type, 'function');
        assert.equal(entry.parameters.type, 'object');
        assert.equal(entry.parameters.$schema, undefined);
    }
    assert.deepEqual(AI_TOOLS.filter((t) => t.kind === 'write').map((t) => t.name).sort(), ['add_comment', 'add_subtask', 'create_task', 'update_task']);
    const search = findTool('search');
    assert.deepEqual(parseToolArgs(search, '{"query":"login"}'), { query: 'login' });
    assert.throws(() => parseToolArgs(search, '{"query":"x"}'), ToolError);
    assert.throws(() => parseToolArgs(search, 'not json'), ToolError);
    assert.throws(() => parseToolArgs(findTool('list_tasks'), '{"projectId":"p","status":"Nope"}'), ToolError);
    assert.ok(serializeToolResult({ text: 'x'.repeat(50000) }).length < 12100);
});

test('action cards: update diff only lists real changes and keeps the undo body', () => {
    const { diffTaskUpdate, undoStepFor } = require('../../lib/ai-actions');
    const current = { title: 'Login bug', status: 'Open', priority: 'Medium', dueDate: '', assigneeIds: ['u1'] };
    const { changes, before } = diffTaskUpdate(current, { projectId: 'p', taskId: 't', status: 'Done', priority: 'Medium', dueDate: '2026-11-01' });
    assert.deepEqual(changes, [{ field: 'status', from: 'Open', to: 'Done' }, { field: 'dueDate', from: '', to: '2026-11-01' }]);
    assert.deepEqual(before, { status: 'Open', dueDate: '', isCompleted: false });
    assert.deepEqual(diffTaskUpdate(current, { status: 'Open' }).changes, []);

    assert.deepEqual(undoStepFor('create_task', { projectId: 'p' }, null, { task: { id: 'new' } }), { method: 'DELETE', path: '/projects/p/tasks/new' });
    assert.deepEqual(undoStepFor('update_task', { projectId: 'p', taskId: 't' }, before, {}), { method: 'PATCH', path: '/projects/p/tasks/t', body: before });
    assert.deepEqual(undoStepFor('add_comment', { projectId: 'p' }, null, { comment: { id: 'c1' } }), { method: 'DELETE', path: '/projects/p/comments/c1' });
    assert.deepEqual(undoStepFor('add_subtask', { projectId: 'p', taskId: 't' }, null, { subtask: { id: 's1' } }), { method: 'DELETE', path: '/projects/p/tasks/t/subtasks/s1' });
    assert.equal(undoStepFor('create_task', { projectId: 'p' }, null, {}), null);
});

test('assist instructions: changes are proposals the user confirms', () => {
    const text = buildAssistInstructions('en', '<workspace_data></workspace_data>');
    assert.match(text, /NOT applied/);
    assert.match(text, /Never claim a change was made/);
});
