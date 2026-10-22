import { httpsCallable } from "firebase/functions";
import { functions, auth } from "./firebase";
import { Project, Task, AISearchAnswer } from "../types";
import { getAllWorkspaceProjects, getAllWorkspaceTasks, incrementAIUsage, incrementImageUsage } from "./dataService";
import { getAIUsage } from './domain/usersService';
import { getAIResponseInstruction } from "../utils/aiLanguage";
import { isProjectIncludedInImportantSignals } from "./healthService";

/**
 * Build context string for AI from projects and tasks
 */
const buildContextForAI = (projects: Project[], tasks: Task[]): string => {
    let context = "Current Projects:\n";
    const contextProjects = projects.filter(isProjectIncludedInImportantSignals);

    for (const project of contextProjects) {
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
 * Answer a question using AI via Cloud Functions
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
        throw new Error(`CORA token limit reached (${usage.tokensUsed.toLocaleString()} / ${usage.tokenLimit.toLocaleString()}). Limit resets monthly.`);
    }

    try {
        // Fetch context data
        const [projects, tasks] = await Promise.all([
            getAllWorkspaceProjects(tenantId),
            getAllWorkspaceTasks(tenantId)
        ]);

        const contextStr = buildContextForAI(projects, tasks);
        const { instruction, language } = getAIResponseInstruction();

        const askCoraFn = httpsCallable<{
            question: string;
            contextStr: string;
            instruction: string;
            language: string;
        }, any>(functions, 'askCora');

        const { data: result } = await askCoraFn({
            question,
            contextStr,
            instruction,
            language
        });

        // Track usage (increment based on backend report)
        if (result.tokensUsed > 0) {
            await incrementAIUsage(user.uid, result.tokensUsed);
        }

        // Match project and task titles to IDs
        const relevantProjects = projects
            .filter(isProjectIncludedInImportantSignals)
            .filter(p => result.answer.toLowerCase().includes(p.title.toLowerCase()))
            .map(p => p.id)
            .slice(0, 3);

        const relevantTasks = tasks
            .filter(t => result.answer.toLowerCase().includes(t.title.toLowerCase()))
            .map(t => t.id)
            .slice(0, 3);

        const fallbackAnswer = language === 'de'
            ? "Ich konnte keine relevanten Informationen finden, um deine Frage zu beantworten."
            : "I couldn't find relevant information to answer your question.";

        return {
            answer: result.answer || fallbackAnswer,
            relevantProjects: relevantProjects.length > 0 ? relevantProjects : result.relevantProjects || [],
            relevantTasks: relevantTasks.length > 0 ? relevantTasks : result.relevantTasks || [],
            confidence: result.confidence || 'Low'
        };

    } catch (error) {
        console.error("CORA Search Error:", error);
        throw error;
    }
};

/**
 * Generate an image using OpenAI image model via Cloud Functions
 */
export const generateAIImage = async (prompt: string): Promise<string[]> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Check image usage limit
    const usage = await getAIUsage(user.uid);
    if (usage && (usage.imagesUsed || 0) >= (usage.imageLimit || 50)) {
        throw new Error(`CORA image generation limit reached. Limit resets monthly.`);
    }

    try {
        const generateImageFn = httpsCallable<{ prompt: string }, { images: string[] }>(functions, 'generateImage');
        const { data } = await generateImageFn({ prompt });

        if (!data.images || data.images.length === 0) {
            throw new Error("No images generated");
        }

        // Track usage (count images)
        await incrementImageUsage(user.uid, data.images.length);

        return data.images;

    } catch (error) {
        console.error("Image Generation Error:", error);
        throw error;
    }
};

/**
 * Edit/rework an existing image using OpenAI image model via Cloud Functions
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
        throw new Error(`CORA image generation limit reached. Limit resets monthly.`);
    }

    try {
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
            // Fetch from URL and convert to base64 using FileReader
            // IMPORTANT: If this is a cross-origin URL, this might fail without proper CORS headers on the source
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

        const editImageFn = httpsCallable<{
            prompt: string;
            image: string;
            mimeType: string;
            editMode: string;
        }, { images: string[] }>(functions, 'editImage');

        const { data } = await editImageFn({
            prompt,
            image: base64Data,
            mimeType,
            editMode
        });

        if (!data.images || data.images.length === 0) {
            throw new Error("No images generated from rework.");
        }

        // Track usage
        await incrementImageUsage(user.uid, data.images.length);

        return data.images;

    } catch (error) {
        console.error("Image Edit Error:", error);
        throw error;
    }
};
