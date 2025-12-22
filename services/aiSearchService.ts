import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Project, Task, SearchResult, AISearchAnswer } from "../types";
import { getAllWorkspaceProjects, getAllWorkspaceTasks } from "./dataService";
import { auth } from "./firebase";
import { getAIUsage, incrementAIUsage } from "./dataService";

/**
 * Helper to check if a query looks like a question
 */
export const isQuestionQuery = (input: string): boolean => {
    const trimmed = input.trim().toLowerCase();

    // Check for question words at the start
    const questionStarters = ['what', 'when', 'where', 'who', 'why', 'how', 'which', 'can', 'is', 'are', 'do', 'does', 'should', 'will', 'would'];
    const startsWithQuestion = questionStarters.some(word => trimmed.startsWith(word + ' '));

    // Check for question mark
    const hasQuestionMark = trimmed.includes('?');

    // Questions are usually longer than 3 words
    const wordCount = trimmed.split(/\s+/).length;

    return (startsWithQuestion || hasQuestionMark) && wordCount >= 3;
};

/**
 * Search projects and tasks locally using keyword matching
 */
export const searchProjectsAndTasks = async (
    query: string,
    tenantId?: string
): Promise<SearchResult[]> => {
    if (!query || query.trim().length < 2) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    try {
        // Fetch all projects and tasks
        const [projects, tasks] = await Promise.all([
            getAllWorkspaceProjects(tenantId),
            getAllWorkspaceTasks(tenantId)
        ]);

        // Search projects
        for (const project of projects) {
            const titleMatch = project.title.toLowerCase().includes(normalizedQuery);
            const descMatch = project.description?.toLowerCase().includes(normalizedQuery);

            if (titleMatch || descMatch) {
                results.push({
                    type: 'project',
                    id: project.id,
                    title: project.title,
                    description: project.description,
                    relevance: titleMatch ? 2 : 1 // Title matches are more relevant
                });
            }
        }

        // Search tasks
        for (const task of tasks) {
            const titleMatch = task.title.toLowerCase().includes(normalizedQuery);
            const descMatch = task.description?.toLowerCase().includes(normalizedQuery);

            if (titleMatch || descMatch) {
                // Find the project for this task
                const project = projects.find(p => p.id === task.projectId);

                results.push({
                    type: 'task',
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    projectId: task.projectId,
                    projectTitle: project?.title,
                    relevance: titleMatch ? 2 : 1
                });
            }
        }

        // Sort by relevance (higher first)
        results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

        // Limit to first 10 results
        return results.slice(0, 10);

    } catch (error) {
        console.error("Search error:", error);
        return [];
    }
};

/**
 * Build context string for AI from projects and tasks
 */
const buildContextForAI = (projects: Project[], tasks: Task[]): string => {
    let context = "Current Projects:\n";

    for (const project of projects) {
        context += `- ${project.title} (Status: ${project.status}, Priority: ${project.priority || 'Medium'}`;
        if (project.dueDate) context += `, Due: ${project.dueDate}`;
        context += `)\n`;
        if (project.description) context += `  Description: ${project.description}\n`;

        // Add tasks for this project
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        if (projectTasks.length > 0) {
            context += `  Tasks (${projectTasks.length}):\n`;
            projectTasks.slice(0, 5).forEach(task => {
                context += `    - ${task.title} (${task.status || 'Open'}, Priority: ${task.priority || 'Medium'}`;
                if (task.isCompleted) context += ', Completed';
                context += `)\n`;
            });
            if (projectTasks.length > 5) {
                context += `    ... and ${projectTasks.length - 5} more tasks\n`;
            }
        }
    }

    return context;
};

/**
 * Answer a question using Gemini AI with project context
 */
export const answerQuestionWithContext = async (
    question: string,
    tenantId?: string
): Promise<AISearchAnswer> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Check token usage
    const usage = await getAIUsage(user.uid);
    if (usage && usage.tokensUsed >= usage.tokenLimit) {
        throw new Error(`AI token limit reached (${usage.tokensUsed.toLocaleString()} / ${usage.tokenLimit.toLocaleString()}). Limit resets monthly.`);
    }

    try {
        // Fetch context data
        const [projects, tasks] = await Promise.all([
            getAllWorkspaceProjects(tenantId),
            getAllWorkspaceTasks(tenantId)
        ]);

        const contextStr = buildContextForAI(projects, tasks);

        // Get Gemini API key
        const apiKey =
            (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
            process.env.GEMINI_API_KEY ||
            process.env.API_KEY ||
            '';

        if (!apiKey) {
            throw new Error("Missing GEMINI API key");
        }

        const ai = new GoogleGenAI({ apiKey });

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                answer: { type: Type.STRING },
                relevantProjects: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                relevantTasks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                confidence: {
                    type: Type.STRING,
                    enum: ['Low', 'Medium', 'High']
                }
            },
            required: ['answer', 'relevantProjects', 'relevantTasks', 'confidence']
        };

        const prompt = `You are a project management assistant. Answer the following question based on the project context provided.
        
Context:
${contextStr}

Question: ${question}

Provide a helpful, concise answer (2-3 sentences max). Include IDs of relevant projects and tasks in your response.
If you reference specific projects or tasks, use their exact titles.
Rate your confidence in the answer as Low, Medium, or High.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.4,
            }
        });

        // Track usage
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        if (tokens > 0) {
            await incrementAIUsage(user.uid, tokens);
        }

        const result = JSON.parse(response.text || "{}");

        // Match project and task titles to IDs
        const relevantProjects = projects
            .filter(p => result.answer.toLowerCase().includes(p.title.toLowerCase()))
            .map(p => p.id)
            .slice(0, 3);

        const relevantTasks = tasks
            .filter(t => result.answer.toLowerCase().includes(t.title.toLowerCase()))
            .map(t => t.id)
            .slice(0, 3);

        return {
            answer: result.answer || "I couldn't find relevant information to answer your question.",
            relevantProjects: relevantProjects.length > 0 ? relevantProjects : result.relevantProjects || [],
            relevantTasks: relevantTasks.length > 0 ? relevantTasks : result.relevantTasks || [],
            confidence: result.confidence || 'Low'
        };

    } catch (error) {
        console.error("AI Search Error:", error);
        throw error;
    }
};
