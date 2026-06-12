"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onProjectTaskGitHubSync = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions/v1");
const REGION = 'europe-west3';
const getString = (value) => (typeof value === 'string' ? value.trim() : '');
const getGitHubHeaders = (token) => ({
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28'
});
const toGitHubState = (task) => task.isCompleted === true || getString(task.status).toLowerCase() === 'done' ? 'closed' : 'open';
const shouldCreateGitHubIssue = (task) => {
    if (task.githubSyncDisabled === true)
        return false;
    if (task.githubIssueNumber || task.githubIssueUrl)
        return false;
    if (getString(task.source) === 'github_issue')
        return false;
    if (getString(task.externalKey).startsWith('github:'))
        return false;
    return true;
};
const buildIssueBody = (task, taskId, projectId) => {
    const description = getString(task.description);
    const footer = [
        '',
        '---',
        `Created from ProjectFlow task ${taskId}.`,
        `ProjectFlow project: ${projectId}`
    ].join('\n');
    return `${description}${footer}`;
};
const createGitHubIssue = async (repo, token, task, taskId, projectId) => {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: getGitHubHeaders(token),
        body: JSON.stringify({
            title: getString(task.title) || `ProjectFlow task ${taskId}`,
            body: buildIssueBody(task, taskId, projectId)
        })
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(getString(payload.message) || `GitHub create issue failed with ${response.status}`);
    }
    return payload;
};
const updateGitHubIssue = async (repo, token, issueNumber, task) => {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: getGitHubHeaders(token),
        body: JSON.stringify({
            title: getString(task.title),
            body: getString(task.description),
            state: toGitHubState(task)
        })
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(getString(payload.message) || `GitHub update issue failed with ${response.status}`);
    }
    return payload;
};
const taskSyncFieldsChanged = (before, after) => (getString(before.title) !== getString(after.title) ||
    getString(before.description) !== getString(after.description) ||
    getString(before.status) !== getString(after.status) ||
    before.isCompleted !== after.isCompleted);
exports.onProjectTaskGitHubSync = functions.region(REGION).firestore
    .document('tenants/{tenantId}/projects/{projectId}/tasks/{taskId}')
    .onWrite(async (change, context) => {
    var _a;
    if (!change.after.exists) {
        return;
    }
    const task = change.after.data();
    if (task.githubSyncDisabled === true) {
        return;
    }
    const projectRef = admin.firestore()
        .collection('tenants')
        .doc(context.params.tenantId)
        .collection('projects')
        .doc(context.params.projectId);
    const projectSnapshot = await projectRef.get();
    const project = projectSnapshot.data() || {};
    const repo = getString(task.githubRepo) || getString(project.githubRepo);
    let token = getString(project.githubToken);
    if (!token) {
        const tokenOwnerId = getString(project.ownerId) || getString(task.createdBy) || getString(task.ownerId);
        if (tokenOwnerId) {
            const userSnapshot = await admin.firestore().collection('users').doc(tokenOwnerId).get();
            token = getString((_a = userSnapshot.data()) === null || _a === void 0 ? void 0 : _a.githubToken);
        }
    }
    if (project.githubIssueSync !== true || !repo || !token) {
        return;
    }
    const taskRef = change.after.ref;
    try {
        if (!change.before.exists) {
            if (!shouldCreateGitHubIssue(task)) {
                return;
            }
            const issue = await createGitHubIssue(repo, token, task, context.params.taskId, context.params.projectId);
            await taskRef.set({
                githubRepo: repo,
                githubIssueNumber: issue.number,
                githubIssueUrl: issue.html_url,
                githubIssueNodeId: issue.node_id,
                githubIssueState: issue.state,
                githubSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
                githubSyncError: admin.firestore.FieldValue.delete()
            }, { merge: true });
            return;
        }
        const before = change.before.data();
        if (!task.githubIssueNumber || !taskSyncFieldsChanged(before, task)) {
            return;
        }
        const issue = await updateGitHubIssue(repo, token, Number(task.githubIssueNumber), task);
        await taskRef.set({
            githubRepo: repo,
            githubIssueUrl: issue.html_url || task.githubIssueUrl,
            githubIssueState: issue.state,
            githubSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            githubSyncError: admin.firestore.FieldValue.delete()
        }, { merge: true });
    }
    catch (error) {
        console.warn('GitHub task sync failed', error);
        await taskRef.set({
            githubSyncError: getString(error === null || error === void 0 ? void 0 : error.message) || 'GitHub task sync failed',
            githubSyncedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
});
//# sourceMappingURL=github-task-sync.js.map