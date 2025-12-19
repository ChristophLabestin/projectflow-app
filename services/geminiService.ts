import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Idea, MindmapGrouping, Project, Task } from "../types";

// Helper to get client instance safely
const getAiClient = () => {
    // Prefer Vite env var, then Node-style fallbacks (for CLI/local scripts)
    const apiKey =
        (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
        process.env.GEMINI_API_KEY ||
        process.env.API_KEY ||
        '';

    if (!apiKey) {
        throw new Error("Missing GEMINI API key. Set VITE_GEMINI_API_KEY (or GEMINI_API_KEY/API_KEY).");
    }
    return new GoogleGenAI({ apiKey });
};

export const generateBrainstormIdeas = async (prompt: string): Promise<Idea[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    type: { type: Type.STRING },
                },
                required: ['title', 'description', 'type'],
            },
        };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate 4-6 specific, actionable project ideas based on this goal: "${prompt}". 
            Keep descriptions concise (under 20 words).`,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.7,
            }
        });

        const rawIdeas = JSON.parse(response.text || "[]");
        if (!Array.isArray(rawIdeas) || rawIdeas.length === 0) {
            throw new Error("Gemini returned no ideas");
        }
        
        // Transform to Idea type with mock counts
        return rawIdeas.map((idea: any, index: number) => ({
            id: `gen-${Date.now()}-${index}`,
            title: idea.title,
            description: idea.description,
            type: idea.type,
            votes: Math.floor(Math.random() * 10),
            comments: Math.floor(Math.random() * 5),
            generated: true
        }));
    } catch (error) {
        console.error("Gemini Brainstorm Error:", error);
        throw error;
    }
};

export const generateProjectDescription = async (projectName: string, context: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Write a professional, concise (1-2 sentences) project description for a project named "${projectName}". 
            Context: ${context || "A general software or business initiative."}.`,
        });
        return response.text || "";
    } catch (error) {
        console.error("Gemini Description Error:", error);
        throw error;
    }
};

export const getGeminiInsight = async (): Promise<string> => {
    // Placeholder: caller should pass richer context. We keep a short default insight.
    return "Gemini is analyzing your latest project activity. Generate a report to get tailored guidance.";
};

export const generateProjectReport = async (project: Project, tasks: Task[]): Promise<string> => {
    try {
        const ai = getAiClient();
        const openTasks = tasks.filter(t => !t.isCompleted);
        const completed = tasks.filter(t => t.isCompleted);
        const prompt = `
        You are a project analyst. Create a concise status report (bullet points) for the project "${project.title}".
        Description: ${project.description || "No description provided"}.
        Status: ${project.status}. Priority: ${project.priority || "Medium"}.
        Due date: ${project.dueDate || "Not set"}; Start date: ${project.startDate || "Not set"}.
        Open tasks (${openTasks.length}): ${openTasks.map(t => t.title).join("; ") || "None"}.
        Completed tasks (${completed.length}): ${completed.slice(0,5).map(t => t.title).join("; ")}.
        Assess whether the due date seems realistic given open tasks; explicitly say if it is at risk or on track and why.
        Keep it under 180 words. Provide a short risk/next steps section.
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { temperature: 0.4 }
        });
        return response.text || "Report unavailable.";
    } catch (error) {
        console.error("Gemini Report Error:", error);
        throw error;
    }
};

export const generateProjectIdeasAI = async (project: Project, tasks: Task[]): Promise<Idea[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    type: { type: Type.STRING },
                },
                required: ['title', 'description', 'type'],
            },
        };
        const prompt = `
        Suggest 4-6 ideas to advance the project "${project.title}".
        Description: ${project.description || "No description."}
        Current status: ${project.status}; priority: ${project.priority || "Medium"}; due: ${project.dueDate || "Not set"}.
        Open tasks: ${tasks.filter(t => !t.isCompleted).map(t => t.title).join("; ") || "None"}.
        Balance quick wins and impactful improvements. Keep descriptions under 18 words.
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.6,
            }
        });
        const rawIdeas = JSON.parse(response.text || "[]");
        if (!Array.isArray(rawIdeas) || rawIdeas.length === 0) {
            throw new Error("Gemini returned no ideas");
        }
        return rawIdeas.map((idea: any, index: number) => ({
            id: `gen-${Date.now()}-${index}`,
            title: idea.title,
            description: idea.description,
            type: idea.type,
            votes: 0,
            comments: 0,
            generated: true
        }));
    } catch (error) {
        console.error("Gemini Project Ideas Error:", error);
        throw error;
    }
};

export const suggestMindmapGrouping = async (project: Project, ideas: Idea[]): Promise<MindmapGrouping[]> => {
    if (!ideas.length) return [];
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    group: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    ideaIds: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ['group', 'ideaIds']
            }
        };

        const ideaList = ideas
            .map((idea) => `- ${idea.id}: ${idea.title} — ${idea.description || 'No description'}`)
            .join('\n');

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are an AI mind-mapping assistant. Group the provided project ideas into 3-6 concise branches with short names (1-2 words).
Project: "${project.title}".
Ideas (id: title — description):
${ideaList}
Return JSON only. Each object must include:
- group: the group name you propose (keep it short, eg. "UI", "Architecture", "Growth Ops")
- ideaIds: an array of idea ids from above that belong in that group
- reason: optional one-line rationale`,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.5,
            }
        });

        const parsed = JSON.parse(response.text || "[]");
        return (Array.isArray(parsed) ? parsed : []).map((entry, index) => ({
            group: entry.group || `Group ${index + 1}`,
            reason: entry.reason || '',
            ideaIds: Array.isArray(entry.ideaIds) ? entry.ideaIds : [],
        })) as MindmapGrouping[];
    } catch (error) {
        console.error("Gemini Mindmap Grouping Error:", error);
        return [];
    }
};
