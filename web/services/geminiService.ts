import { Project, Task, ProjectBlueprint, Milestone, Activity, StudioTool } from "../types";
import { functions } from "./firebase";
import { httpsCallable } from 'firebase/functions';
import { getAIResponseInstruction } from "../utils/aiLanguage";

/**
 * Client for the fixed, server-defined AI capabilities (`runAiCapability`). Prompts, schemas, tools and quotas
 * live in `functions/src/ai-capabilities.ts`; the client only sends field values for a named capability.
 */
type AiCapability =
    | 'studioChat'
    | 'taskDescription'
    | 'projectReport'
    | 'projectBlueprint'
    | 'blogPost'
    | 'blogTopics'
    | 'blogTranslate';

const runAiCapability = async (capability: AiCapability, input: Record<string, unknown>): Promise<string> => {
    const call = httpsCallable<
        { capability: AiCapability; input: Record<string, unknown>; language: string },
        { text: string; tokensUsed: number }
    >(functions, 'runAiCapability');
    const { language } = getAIResponseInstruction();
    const { data } = await call({ capability, input, language });
    return data?.text || '';
};

type CoraChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

export const chatWithCora = async (
    messages: CoraChatMessage[],
    options?: {
        mode?: StudioTool | null;
        useSearch?: boolean;
        model?: 'gpt-5-mini';
        tenantContext?: {
            name?: string;
            description?: string;
            projects?: string[];
            projectCount?: number;
        };
    }
): Promise<string> => {
    const { mode, useSearch, tenantContext } = options || {};
    return runAiCapability('studioChat', {
        messages: messages.slice(-12),
        mode: mode || null,
        useSearch: Boolean(useSearch),
        tenantContext: tenantContext || {}
    });
};

export const generateProjectDescription = async (projectName: string, context: string): Promise<string> => {
    try {
        return await runAiCapability('taskDescription', { title: projectName, context });
    } catch (error) {
        console.error("AI Description Error:", error);
        throw error;
    }
};

export const getGeminiInsight = async (): Promise<string> => {
    // Placeholder: caller should pass richer context. We keep a short default insight.
    return "Gemini is analyzing your latest project activity. Generate a report to get tailored guidance.";
};

export const generateProjectReport = async (
    project: Project,
    tasks: Task[],
    milestones: Milestone[],
    activity: Activity[],
    members: any[]
): Promise<string> => {
    try {
        const openTasks = tasks.filter(t => !t.isCompleted);
        const pendingMilestones = milestones.filter(m => m.status !== 'Achieved');
        const nextMilestone = [...pendingMilestones].sort((a, b) => new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime())[0];

        const text = await runAiCapability('projectReport', {
            project: {
                title: project.title,
                description: project.description,
                status: project.status,
                priority: project.priority,
                projectState: project.projectState,
                startDate: project.startDate,
                dueDate: project.dueDate
            },
            teamSize: members.length,
            openTasks: openTasks.length,
            highPriorityTasks: openTasks.filter(t => t.priority === 'High' || t.priority === 'Urgent').length,
            completedTasks: tasks.length - openTasks.length,
            milestonesAchieved: milestones.length - pendingMilestones.length,
            milestonesTotal: milestones.length,
            nextMilestone: nextMilestone ? { title: nextMilestone.title, dueDate: nextMilestone.dueDate } : null,
            recentActivity: activity.slice(0, 5).map(a => `${a.user} ${a.action} ${a.target}`)
        });
        return text || "Report unavailable.";
    } catch (error) {
        console.error("AI Report Error:", error);
        throw error;
    }
};

export const generateProjectBlueprint = async (prompt: string): Promise<ProjectBlueprint> => {
    try {
        const text = await runAiCapability('projectBlueprint', { idea: prompt });
        const blueprint = JSON.parse(text || "{}");
        return {
            ...blueprint,
            id: `blueprint - ${Date.now()} `,
            createdAt: new Date(),
        } as ProjectBlueprint;
    } catch (error) {
        console.error("AI Blueprint Error:", error);
        throw error;
    }
};

export const generateBlogPostAI = async (topic: string, language: string = 'en', useSearch: boolean = false): Promise<{ content: string; title: string; excerpt: string }> => {
    try {
        const text = await runAiCapability('blogPost', { topic, postLanguage: language, useSearch });
        return JSON.parse(text || "{}");
    } catch (error) {
        console.error("AI Blog Generation Error:", error);
        throw error;
    }
};

export const suggestBlogTopicsAI = async (project: Project): Promise<{ title: string; rationale: string }[]> => {
    try {
        const text = await runAiCapability('blogTopics', {
            project: { title: project.title, description: project.description, status: project.status }
        });
        const parsed = JSON.parse(text || "{}");
        return Array.isArray(parsed?.topics) ? parsed.topics : [];
    } catch (error) {
        console.error("AI Blog Topic Suggestion Error:", error);
        throw error;
    }
};

export const translateBlogPostAI = async (
    content: string,
    targetLanguage: string,
    sourceLanguage?: string,
    title?: string,
    excerpt?: string
): Promise<{ content: string; title?: string; excerpt?: string }> => {
    try {
        const text = await runAiCapability('blogTranslate', { content, targetLanguage, sourceLanguage, title, excerpt });
        const result = JSON.parse(text || "{}");
        return {
            content: result.content || "",
            title: result.title || undefined,
            excerpt: result.excerpt || undefined
        };
    } catch (error) {
        console.error("AI Translation Error:", error);
        throw error;
    }
};
