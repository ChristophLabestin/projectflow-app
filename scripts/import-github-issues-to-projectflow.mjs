#!/usr/bin/env node

const DEFAULT_PROJECTFLOW_API_BASE = 'https://europe-west3-project-manager-9d0ad.cloudfunctions.net/api/projectflow';

const args = process.argv.slice(2);

const getArg = (name, fallback = '') => {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    return args[index + 1] || fallback;
};

const hasFlag = (name) => args.includes(name);

const usage = () => {
    console.log(`Usage:
  node scripts/import-github-issues-to-projectflow.mjs \\
    --repo owner/repo \\
    --projectflow-project-id PROJECT_ID \\
    --github-token GITHUB_TOKEN \\
    --projectflow-token PROJECTFLOW_API_TOKEN

Options:
  --projectflow-api-base URL       Defaults to production ProjectFlow API.
  --github-project-owner LOGIN     Filter imported Projects v2 fields to this project owner.
  --github-project-number NUMBER   Filter imported Projects v2 fields to this project number.
  --assignee-map FILE              JSON object mapping GitHub login -> ProjectFlow uid.
  --include-comments               Append GitHub comments to the ProjectFlow task description.
  --state open|closed|all          Defaults to all.
  --dry-run                        Print mapped tasks without writing ProjectFlow.
  --help                           Show this help.

Environment fallbacks:
  GITHUB_REPO, GITHUB_TOKEN, PROJECTFLOW_PROJECT_ID, PROJECTFLOW_API_TOKEN,
  PROJECTFLOW_API_BASE, GITHUB_PROJECT_OWNER, GITHUB_PROJECT_NUMBER
`);
};

if (hasFlag('--help')) {
    usage();
    process.exit(0);
}

const repo = getArg('--repo', process.env.GITHUB_REPO || '');
const githubToken = getArg('--github-token', process.env.GITHUB_TOKEN || '');
const projectflowProjectId = getArg('--projectflow-project-id', process.env.PROJECTFLOW_PROJECT_ID || '');
const projectflowToken = getArg('--projectflow-token', process.env.PROJECTFLOW_API_TOKEN || '');
const projectflowApiBase = getArg('--projectflow-api-base', process.env.PROJECTFLOW_API_BASE || DEFAULT_PROJECTFLOW_API_BASE);
const githubProjectOwner = getArg('--github-project-owner', process.env.GITHUB_PROJECT_OWNER || '');
const githubProjectNumber = getArg('--github-project-number', process.env.GITHUB_PROJECT_NUMBER || '');
const state = getArg('--state', 'all');
const includeComments = hasFlag('--include-comments');
const dryRun = hasFlag('--dry-run');

if (!repo || !repo.includes('/')) {
    console.error('Missing --repo owner/repo.');
    usage();
    process.exit(1);
}

if (!githubToken) {
    console.error('Missing --github-token or GITHUB_TOKEN.');
    process.exit(1);
}

if (!projectflowProjectId) {
    console.error('Missing --projectflow-project-id or PROJECTFLOW_PROJECT_ID.');
    process.exit(1);
}

if (!dryRun && !projectflowToken) {
    console.error('Missing --projectflow-token or PROJECTFLOW_API_TOKEN. Use --dry-run to inspect without writing.');
    process.exit(1);
}

const assigneeMapPath = getArg('--assignee-map');
let assigneeMap = {};
if (assigneeMapPath) {
    const fs = await import('node:fs/promises');
    assigneeMap = JSON.parse(await fs.readFile(assigneeMapPath, 'utf8'));
}

const normalizeProjectFlowBase = (base) => {
    const trimmed = base.replace(/\/+$/, '');
    if (trimmed.endsWith('/projectflow')) return trimmed;
    if (trimmed.endsWith('/api')) return `${trimmed}/projectflow`;
    return `${trimmed}/api/projectflow`;
};

const githubHeaders = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${githubToken}`,
    'X-GitHub-Api-Version': '2022-11-28'
};

const projectflowHeaders = {
    Accept: 'application/json',
    Authorization: `Bearer ${projectflowToken}`,
    'Content-Type': 'application/json'
};

const requestJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(`${options.method || 'GET'} ${url} failed (${response.status}): ${payload.message || payload.error || text}`);
    }

    return payload;
};

const fetchGitHubIssues = async () => {
    const issues = [];
    let page = 1;

    while (true) {
        const url = new URL(`https://api.github.com/repos/${repo}/issues`);
        url.searchParams.set('state', state);
        url.searchParams.set('per_page', '100');
        url.searchParams.set('page', String(page));

        const batch = await requestJson(url.toString(), { headers: githubHeaders });
        const issueBatch = batch.filter((item) => !item.pull_request);
        issues.push(...issueBatch);

        if (batch.length < 100) break;
        page += 1;
    }

    return issues;
};

const fetchComments = async (issue) => {
    if (!includeComments || issue.comments === 0) return [];

    const comments = [];
    let page = 1;

    while (true) {
        const url = new URL(issue.comments_url);
        url.searchParams.set('per_page', '100');
        url.searchParams.set('page', String(page));

        const batch = await requestJson(url.toString(), { headers: githubHeaders });
        comments.push(...batch);

        if (batch.length < 100) break;
        page += 1;
    }

    return comments;
};

const graphQL = async (query, variables) => {
    const payload = await requestJson('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            ...githubHeaders,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
    });

    if (payload.errors?.length) {
        throw new Error(payload.errors.map((error) => error.message).join('; '));
    }

    return payload.data;
};

const projectFieldQuery = `
query IssueProjectFields($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Issue {
      id
      number
      projectItems(first: 20) {
        nodes {
          id
          project {
            id
            title
            number
            url
            owner {
              ... on Organization { login }
              ... on User { login }
            }
          }
          fieldValues(first: 50) {
            nodes {
              __typename
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2FieldCommon { name dataType } }
              }
              ... on ProjectV2ItemFieldNumberValue {
                number
                field { ... on ProjectV2FieldCommon { name dataType } }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field { ... on ProjectV2FieldCommon { name dataType } }
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field { ... on ProjectV2FieldCommon { name dataType } }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                startDate
                duration
                field { ... on ProjectV2FieldCommon { name dataType } }
              }
              ... on ProjectV2ItemFieldUserValue {
                users(first: 20) { nodes { login name } }
                field { ... on ProjectV2FieldCommon { name dataType } }
              }
              ... on ProjectV2ItemFieldLabelValue {
                labels(first: 20) { nodes { name color } }
                field { ... on ProjectV2FieldCommon { name dataType } }
              }
              ... on ProjectV2ItemFieldMilestoneValue {
                milestone { title dueOn }
                field { ... on ProjectV2FieldCommon { name dataType } }
              }
              ... on ProjectV2ItemFieldRepositoryValue {
                repository { nameWithOwner url }
                field { ... on ProjectV2FieldCommon { name dataType } }
              }
            }
          }
        }
      }
    }
  }
}`;

const fieldValueToPlain = (fieldValue) => {
    const fieldName = fieldValue.field?.name;
    if (!fieldName) return null;

    let value;
    if ('text' in fieldValue) value = fieldValue.text;
    else if ('number' in fieldValue) value = fieldValue.number;
    else if ('date' in fieldValue) value = fieldValue.date;
    else if ('name' in fieldValue) value = fieldValue.name;
    else if ('title' in fieldValue) value = fieldValue.title;
    else if (fieldValue.users) value = fieldValue.users.nodes.map((user) => user.login);
    else if (fieldValue.labels) value = fieldValue.labels.nodes.map((label) => label.name);
    else if (fieldValue.milestone) value = fieldValue.milestone;
    else if (fieldValue.repository) value = fieldValue.repository;
    else value = null;

    return {
        name: fieldName,
        dataType: fieldValue.field?.dataType || '',
        type: fieldValue.__typename,
        value
    };
};

const projectMatchesFilter = (project) => {
    if (!githubProjectOwner && !githubProjectNumber) return true;

    const owner = project.owner?.login || '';
    const number = project.number ? String(project.number) : '';

    return (
        (!githubProjectOwner || owner.toLowerCase() === githubProjectOwner.toLowerCase()) &&
        (!githubProjectNumber || number === String(githubProjectNumber))
    );
};

const fetchProjectV2Fields = async (issues) => {
    const result = new Map();
    const ids = issues.map((issue) => issue.node_id).filter(Boolean);

    for (let index = 0; index < ids.length; index += 25) {
        const chunk = ids.slice(index, index + 25);
        const data = await graphQL(projectFieldQuery, { ids: chunk });

        for (const node of data.nodes || []) {
            if (!node?.id) continue;

            const projectItems = (node.projectItems?.nodes || [])
                .filter((item) => item?.project && projectMatchesFilter(item.project))
                .map((item) => {
                    const fields = {};
                    for (const rawField of item.fieldValues?.nodes || []) {
                        const plain = fieldValueToPlain(rawField);
                        if (plain) fields[plain.name] = plain;
                    }

                    return {
                        project: {
                            id: item.project.id,
                            title: item.project.title,
                            number: item.project.number,
                            owner: item.project.owner?.login || '',
                            url: item.project.url
                        },
                        fields
                    };
                });

            result.set(node.id, projectItems);
        }
    }

    return result;
};

const normalizePriority = (issue) => {
    const labels = issue.labels.map((label) => label.name.toLowerCase());
    if (labels.some((label) => label.includes('urgent') || label.includes('p0') || label.includes('critical'))) return 'Urgent';
    if (labels.some((label) => label.includes('high') || label.includes('p1'))) return 'High';
    if (labels.some((label) => label.includes('low') || label.includes('p3'))) return 'Low';
    return 'Medium';
};

const normalizeStatus = (issue, projectFields) => {
    if (issue.state === 'closed') return 'Done';

    const statusField = findProjectField(projectFields, ['status', 'state']);
    const status = typeof statusField?.value === 'string' ? statusField.value.toLowerCase() : '';

    if (status.includes('backlog')) return 'Backlog';
    if (status.includes('todo') || status.includes('to do')) return 'Todo';
    if (status.includes('progress') || status.includes('doing')) return 'In Progress';
    if (status.includes('review')) return 'Review';
    if (status.includes('blocked')) return 'Blocked';
    if (status.includes('done') || status.includes('closed')) return 'Done';

    return 'Open';
};

const findProjectField = (projectFields, names) => {
    const normalizedNames = names.map((name) => name.toLowerCase());
    for (const item of projectFields) {
        for (const field of Object.values(item.fields || {})) {
            if (normalizedNames.includes(field.name.toLowerCase())) {
                return field;
            }
        }
    }
    return null;
};

const buildDescription = (issue, comments) => {
    const lines = [
        issue.body || '',
        '',
        '---',
        `GitHub issue: ${issue.html_url}`,
        `GitHub author: ${issue.user?.login || 'unknown'}`,
        `GitHub state: ${issue.state}`,
        `GitHub labels: ${issue.labels.map((label) => label.name).join(', ') || 'none'}`
    ];

    if (comments.length > 0) {
        lines.push('', 'GitHub comments:');
        for (const comment of comments) {
            lines.push('', `### ${comment.user?.login || 'unknown'} on ${comment.created_at}`, comment.body || '');
        }
    }

    return lines.join('\n').trim();
};

const mapIssueToTask = (issue, projectFields, comments) => {
    const dueField = findProjectField(projectFields, ['due date', 'due', 'deadline']);
    const assigneeIds = issue.assignees
        .map((assignee) => assigneeMap[assignee.login])
        .filter(Boolean);

    return {
        externalKey: `github:${repo}:issue:${issue.number}`,
        source: 'github_issue',
        title: issue.title,
        description: buildDescription(issue, comments),
        status: normalizeStatus(issue, projectFields),
        priority: normalizePriority(issue),
        dueDate: typeof dueField?.value === 'string' ? dueField.value : '',
        isCompleted: issue.state === 'closed',
        assigneeIds,
        category: issue.labels.map((label) => label.name),
        githubRepo: repo,
        githubIssueNumber: issue.number,
        githubIssueUrl: issue.html_url,
        githubIssueNodeId: issue.node_id,
        githubIssueState: issue.state,
        githubProjectV2Fields: {
            importedAt: new Date().toISOString(),
            projectItems: projectFields
        },
        sourceReferences: [
            {
                id: `github-issue-${issue.number}`,
                labelKey: `GitHub #${issue.number}`,
                url: issue.html_url,
                publisher: 'GitHub',
                lastReviewedAt: new Date().toISOString()
            }
        ]
    };
};

const upsertProjectFlowTask = async (task) => {
    const base = normalizeProjectFlowBase(projectflowApiBase);
    const url = `${base}/projects/${encodeURIComponent(projectflowProjectId)}/tasks/upsert-by-external-key`;
    return requestJson(url, {
        method: 'POST',
        headers: projectflowHeaders,
        body: JSON.stringify(task)
    });
};

const main = async () => {
    console.log(`Loading GitHub issues from ${repo} (${state})...`);
    const issues = await fetchGitHubIssues();
    console.log(`Found ${issues.length} issues. Loading Projects v2 fields...`);
    const fieldsByNodeId = await fetchProjectV2Fields(issues);

    const results = [];
    for (const issue of issues) {
        const comments = await fetchComments(issue);
        const projectFields = fieldsByNodeId.get(issue.node_id) || [];
        const task = mapIssueToTask(issue, projectFields, comments);

        if (dryRun) {
            console.log(JSON.stringify({
                issue: `#${issue.number}`,
                title: task.title,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                projectFieldProjects: projectFields.map((item) => `${item.project.owner}/${item.project.number}:${item.project.title}`),
                externalKey: task.externalKey
            }, null, 2));
            results.push({ issue: issue.number, operation: 'dry-run' });
            continue;
        }

        const response = await upsertProjectFlowTask(task);
        console.log(`${response.operation || 'synced'} GitHub #${issue.number} -> ProjectFlow task ${response.task?.id || 'unknown'}`);
        results.push({ issue: issue.number, operation: response.operation, taskId: response.task?.id });
    }

    console.log(`Done. Processed ${results.length} issues.`);
};

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
