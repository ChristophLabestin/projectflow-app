import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Project, Task, SearchResult, AISearchAnswer } from "../types";
import { getAllWorkspaceProjects, getAllWorkspaceTasks, getAllWorkspaceIssues, getAllWorkspaceIdeas, getAIUsage, incrementAIUsage, incrementImageUsage } from "./dataService";
import { auth } from "./firebase";

// ... existing code ...


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
 * Search projects, tasks, issues, and ideas locally using keyword matching
 */
export const searchProjectsAndTasks = async (
    query: string,
    tenantId?: string
): Promise<SearchResult[]> => {
    if (!query || query.trim().length < 2) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    try {
        // Fetch all searchable entities
        const [projects, tasks, issues, ideas] = await Promise.all([
            getAllWorkspaceProjects(tenantId),
            getAllWorkspaceTasks(tenantId),
            getAllWorkspaceIssues(tenantId),
            getAllWorkspaceIdeas(tenantId)
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
                    status: project.status,
                    relevance: titleMatch ? 10 : 5
                });
            }
        }

        // Search tasks
        for (const task of tasks) {
            const titleMatch = task.title.toLowerCase().includes(normalizedQuery);
            const descMatch = task.description?.toLowerCase().includes(normalizedQuery);

            if (titleMatch || descMatch) {
                const project = projects.find(p => p.id === task.projectId);
                results.push({
                    type: 'task',
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    projectId: task.projectId,
                    projectTitle: project?.title,
                    status: task.status || (task.isCompleted ? 'Completed' : 'Open'),
                    relevance: titleMatch ? 8 : 4
                });
            }
        }

        // Search issues
        for (const issue of issues) {
            const titleMatch = issue.title.toLowerCase().includes(normalizedQuery);
            const descMatch = issue.description.toLowerCase().includes(normalizedQuery);

            if (titleMatch || descMatch) {
                const project = projects.find(p => p.id === issue.projectId);
                results.push({
                    type: 'issue',
                    id: issue.id,
                    title: issue.title,
                    description: issue.description,
                    projectId: issue.projectId,
                    projectTitle: project?.title,
                    status: issue.status,
                    relevance: titleMatch ? 8 : 4
                });
            }
        }

        // Search ideas
        for (const idea of ideas) {
            const titleMatch = idea.title.toLowerCase().includes(normalizedQuery);
            const descMatch = idea.description.toLowerCase().includes(normalizedQuery);

            if (titleMatch || descMatch) {
                const project = projects.find(p => p.id === idea.projectId);
                results.push({
                    type: 'idea',
                    id: idea.id,
                    title: idea.title,
                    description: idea.description,
                    projectId: idea.projectId,
                    projectTitle: project?.title,
                    status: idea.stage,
                    relevance: titleMatch ? 8 : 4
                });
            }
        }

        // Sort by relevance (higher first)
        results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

        // Limit to first 15 results (increased from 10)
        return results.slice(0, 15);

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

/**
 * Generate an image using Google Imagen 3 model
 */
export const generateAIImage = async (prompt: string): Promise<string[]> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Check image usage limit
    const usage = await getAIUsage(user.uid);
    if (usage && (usage.imagesUsed || 0) >= (usage.imageLimit || 50)) {
        throw new Error(`AI image generation limit reached. Limit resets monthly.`);
    }

    try {
        const apiKey =
            (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
            process.env.GEMINI_API_KEY ||
            process.env.API_KEY ||
            '';

        if (!apiKey) {
            throw new Error("Missing GEMINI API key");
        }

        // Initialize GoogleGenAI
        const ai = new GoogleGenAI({ apiKey });

        // Use the native generateImages method from the new SDK
        // This is specific to the @google/genai package
        const response = await ai.models.generateImages({
            model: "imagen-4.0-generate-001",
            prompt: prompt,
            config: {
                numberOfImages: 4,
                // aspectRatio: "4:3", // Optional, if needed
            }
        });

        // Extract image data
        // response.generatedImages is the array
        // each item has .image.imageBytes (base64)

        const images: string[] = [];

        if (response.generatedImages) {
            for (const item of response.generatedImages) {
                if (item.image?.imageBytes) {
                    // Start with data URI prefix
                    // Imagen typically returns JPEG or PNG bytes. 
                    // Usually safe to assume image/jpeg or image/png.
                    // The SDK type definition implies it's just bytes string (base64).
                    images.push(`data:image/jpeg;base64,${item.image.imageBytes}`);
                }
            }
        }

        if (images.length === 0) {
            throw new Error("No images generated");
        }

        // Track usage (count images, e.g. 4)
        await incrementImageUsage(user.uid, images.length);

        return images;

    } catch (error) {
        console.error("Image Generation Error:", error);
        // Fallback mechanism or re-throw
        throw error;
    }
};

/**
 * Edit/rework an existing image using Vertex AI via Cloud Function
 * The Cloud Function handles the Vertex AI integration server-side
 */
export const editAIImage = async (
    prompt: string,
    imageUrl: string,
    editMode: 'default' | 'style' = 'default'
): Promise<string[]> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Check image usage limit
    const usage = await getAIUsage(user.uid);
    if (usage && (usage.imagesUsed || 0) >= (usage.imageLimit || 50)) {
        throw new Error(`AI image generation limit reached. Limit resets monthly.`);
    }

    try {
        // Get user's auth token for the Cloud Function
        const idToken = await user.getIdToken();

        // Fetch image and convert to base64 if it's a URL
        let base64Data: string;
        let mimeType = 'image/jpeg';

        if (imageUrl.startsWith('data:')) {
            // Already a data URL
            const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            } else {
                throw new Error("Invalid data URL format");
            }
        } else {
            // Fetch from URL and convert to base64 using FileReader (avoids stack overflow)
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            mimeType = blob.type || 'image/jpeg';

            // Convert blob to base64 safely
            base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    // Extract base64 data from data URL
                    const base64 = result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        // Call the Vertex AI Cloud Function
        const functionUrl = 'https://europe-west3-project-manager-9d0ad.cloudfunctions.net/editImageWithVertexAI';

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                prompt,
                imageBase64: base64Data,
                mimeType,
                editMode,
                numberOfImages: 1,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Cloud Function error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.images || data.images.length === 0) {
            throw new Error("No images generated. Try a different prompt.");
        }

        // Track usage
        await incrementImageUsage(user.uid, data.images.length);

        return data.images;

    } catch (error) {
        console.error("Image Edit Error:", error);
        throw error;
    }
};

