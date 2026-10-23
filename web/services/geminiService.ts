import { Project, Task, ProjectBlueprint, Milestone, Activity, StudioTool } from "../types";
import { functions } from "./firebase";
import { httpsCallable } from 'firebase/functions';
import { applyLanguageInstruction, getAIResponseInstruction } from "../utils/aiLanguage";

// Polyfills for types removed from @google/genai import to specific string literals/types
enum Type {
    STRING = "STRING",
    NUMBER = "NUMBER",
    INTEGER = "INTEGER",
    BOOLEAN = "BOOLEAN",
    ARRAY = "ARRAY",
    OBJECT = "OBJECT"
}
type Schema = any;

// Helper to call generic AI Cloud Function
const callGeminiAPI = async (params: {
    prompt: string,
    systemInstruction?: string,
    responseSchema?: any,
    temperature?: number,
    jsonMode?: boolean,
    model?: string,
    tools?: any
}) => {
    const { prompt, systemInstruction, responseSchema, temperature = 0.7, jsonMode = false, model = "gpt-5-mini", tools } = params;

    const callFn = httpsCallable(functions, 'callGemini');

    // The backend now accepts 'responseSchema' as well.
    const { data }: any = await callFn({
        prompt,
        systemInstruction,
        temperature,
        jsonMode: jsonMode || !!responseSchema, // schema implies json
        responseSchema,
        model,
        tools
    });

    return data; // returns { text, tokensUsed }
};

// Adapter to support legacy code patterns during refactor
// This mocks the GoogleGenAI client and intercepts calls to redirect them to callGeminiAPI
const runWithTokenCheck = async (
    operation: (ai: any) => Promise<any>,
    tracking?: any
): Promise<any> => {
    // Create a mock AI client that intercepts generateContent
    const mockAi = {
        models: {
            generateContent: async (args: any) => {
                // Map args to callGeminiAPI params
                const params = {
                    model: args.model,
                    prompt: args.contents,
                    // Check config
                    temperature: args.config?.temperature,
                    responseSchema: args.config?.responseSchema,
                    tools: args.config?.tools,
                    // Convert mimeType 'application/json' to jsonMode=true
                    jsonMode: args.config?.responseMimeType?.includes('json'),
                    systemInstruction: args.systemInstruction
                };

                const result = await callGeminiAPI(params);

                // Return structure matching Gemini SDK response expectation
                // Existing code often checks result.text or result.usageMetadata
                return {
                    text: result.text,
                    usageMetadata: { totalTokenCount: result.tokensUsed || 0 },
                    // Mock function if code calls text() method instead of property
                    // usage: response.text()
                    functionCall: () => result.text
                };
            }
        }
    };

    // Execute the operation with the mock client
    return operation(mockAi);
};

// Stub for getAiClient - used by legacy functions but ignored by runWithTokenCheck
const getAiClient = () => {
    return { models: {} } as any;
};

type CoraChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

const getModeInstruction = (mode?: StudioTool | null) => {
    if (!mode) return '';
    switch (mode) {
        case 'Architect':
            return `ROLE: AI ARCHITECT. 
            GOAL: Create comprehensive, professional project blueprints and technical concepts.
            BEHAVIOR:
            - If the user provides an idea, IMMEDIATELY generate a detailed project concept including: Executive Summary, Key Features, Tech Stack, and Initial Milestones.
            - Do NOT summarize existing workspace projects unless explicitly asked to compare.
            - Focus on CREATION and STRUCTURING of the NEW idea.
            - Use a professional, authoritative, yet innovative tone.
            - Format the output as a clean, structured document using Markdown headers.`;
        case 'Brainstormer':
            return `ROLE: LEAD INNOVATOR.
            GOAL: Generate a high volume of diverse, creative, and actionable ideas.
            BEHAVIOR:
            - Focus on variety and "out of the box" thinking.
            - Provide lists, mind-map style breakdowns, and alternative angles.
            - Do not get bogged down in technical feasibility yet; focus on the "What" and "Why".`;
        case 'RiskScout':
            return `ROLE: RISK ANALYST.
            GOAL: Identify, assess, and mitigate potential pitfalls.
            BEHAVIOR:
            - Critically analyze the input for failure points, edge cases, and security gaps.
            - Provide structured risk tables (Risk, Impact, Probability, Mitigation).
            - Be skeptical and thorough.`;
        case 'Strategist':
            return `ROLE: CHIEF STRATEGY OFFICER.
            GOAL: Align initiatives with high-level business goals and prioritize effectively.
            BEHAVIOR:
            - Focus on ROI, market fit, and prioritization (MoSCoW method).
            - Ask strategic questions about target audience and monetization.`;
        default:
            return '';
    }
};

const formatChatHistory = (messages: CoraChatMessage[]) => {
    return messages
        .filter(message => message.content && message.content.trim().length > 0)
        .slice(-12)
        .map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content.trim()}`)
        .join('\n');
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
    const model = options?.model || 'gpt-5-mini';
    const contextLines: string[] = [];

    if (tenantContext?.name) {
        contextLines.push(`Workspace: ${tenantContext.name}`);
    }
    if (tenantContext?.description) {
        contextLines.push(`Workspace description: ${tenantContext.description}`);
    }
    if (tenantContext?.projectCount !== undefined) {
        contextLines.push(`Project count: ${tenantContext.projectCount}`);
    }
    if (tenantContext?.projects && tenantContext.projects.length > 0) {
        contextLines.push(`Active projects: ${tenantContext.projects.join('; ')}`);
    }

    const contextBlock = contextLines.length > 0
        ? `Workspace context (Reference only if relevant to the request):\n${contextLines.join('\n')}`
        : '';
    const modeInstruction = getModeInstruction(mode);
    const searchInstruction = useSearch
        ? 'Google Search is enabled. Use it to verify facts and include a short Sources section with links.'
        : '';

    // If a mode is active, it OVERRIDES the default assistant persona.
    const basePersona = mode
        ? 'You are an advanced AI Engine specialized in the selected role.'
        : 'You are CORA, a senior project and product assistant for ProjectFlow.';

    const systemInstruction = [
        basePersona,
        modeInstruction, // Mode instruction comes FIRST after persona to set the frame
        'Use common knowledge and best practices.',
        'You have access to the workspace context provided here, but prioritize the specific user request and Mode goal.',
        contextBlock,
        searchInstruction
    ].filter(Boolean).join('\n\n');

    const { instruction } = getAIResponseInstruction();
    const conversation = formatChatHistory(messages);
    const contextForPrompt = contextLines.length > 0 ? `\n\nContext:\n${contextLines.join('\n')}` : '';
    const prompt = applyLanguageInstruction(`${conversation}${contextForPrompt}\nAssistant:`, instruction);

    const response = await runWithTokenCheck((ai) => ai.models.generateContent({
        model,
        contents: prompt,
        systemInstruction,
        config: {
            temperature: 0.6,
            tools: useSearch ? [{ googleSearch: {} }] : undefined
        }
    }));

    return response.text || '';
};

// Start of functions refactored to use callGeminiAPI

export const generateProjectDescription = async (projectName: string, context: string): Promise<string> => {
    try {
        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gpt-5-mini",
            contents: `Write a professional, concise (1-2 sentences) project description for a project named "${projectName}". 
            Context: ${context || "A general software or business initiative."}.`,
        }));
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

export const generateProjectReport = async (
    project: Project,
    tasks: Task[],
    milestones: Milestone[],
    activity: Activity[],
    members: any[]
): Promise<string> => {
    try {
        const openTasks = tasks.filter(t => !t.isCompleted);
        const completedTasks = tasks.filter(t => t.isCompleted);
        const highPriorityTasks = openTasks.filter(t => t.priority === 'High' || t.priority === 'Urgent');

        const pendingMilestones = milestones.filter(m => m.status !== 'Achieved');
        const nextMilestone = pendingMilestones.sort((a, b) => new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime())[0];

        const recentActivity = activity.slice(0, 5).map(a => `${a.user} ${a.action} ${a.target}`).join('; ');

        const prompt = `
        You are CORA, an expert project manager. Create a comprehensive, professional status report for the project "${project.title}".
        
        **Project Context:**
        - Description: ${project.description || "No description provided"}
        - Status: ${project.status}
        - Priority: ${project.priority || "Medium"}
        - Phase/State: ${project.projectState || "Not specified"}
        - Timeline: Start ${project.startDate || "N/A"}, Due ${project.dueDate || "N/A"}
        - Team Size: ${members.length} members

        **Key Metrics:**
        - Tasks: ${openTasks.length} open (${highPriorityTasks.length} high priority), ${completedTasks.length} completed.
        - Milestones: ${milestones.filter(m => m.status === 'Achieved').length}/${milestones.length} achieved. Next up: ${nextMilestone ? `${nextMilestone.title} (Due: ${nextMilestone.dueDate})` : "None"}.

        **Recent Activity:**
        ${recentActivity}

        **Instructions:**
        Generate a structured Markdown report with the following sections:
        
        # 📊 Project Status Report: ${project.title}
        
        ## 🚨 Executive Summary
        A brief 2-3 sentence overview of the project's health. Is it on track, at risk, or blocked? Mention the most critical blocker if any.

        ## 📅 Timeline & Milestones
        Assessment of the timeline. Are we hitting the next milestone? Any delays expected?

        ## 🏗 Work in Progress
        Highlight key high-priority tasks and recent progress. Do NOT list every task, just the strategic focus.

        ## 🐛 Issues & Risks
        Summary of open issues. If there are high-priority issues, flag them.

        ## 💡 Recommendations
        2-3 actionable next steps for the team to maintain momentum or fix problems.

        Keep the tone professional yet encouraging. Use emojis sparingly for section headers only.
        `;

        const response = await callGeminiAPI({
            model: "gpt-5-mini", // Use a stable model name or whatever is available
            prompt: prompt,
            temperature: 0.4,
        });

        return response.text || "Report unavailable.";
    } catch (error) {
        console.error("Gemini Report Error:", error);
        throw error;
    }
};

export const generateProjectBlueprint = async (prompt: string): Promise<ProjectBlueprint> => {
    try {
        const responseSchema = {
            type: "OBJECT",
            properties: {
                title: { type: "STRING" },
                description: { type: "STRING" },
                targetAudience: { type: "STRING" },
                milestones: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            title: { type: "STRING" },
                            description: { type: "STRING" },
                        },
                        required: ['title', 'description']
                    }
                },
                initialTasks: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            title: { type: "STRING" },
                            priority: { type: "STRING", enum: ['Low', 'Medium', 'High'] },
                        },
                        required: ['title', 'priority']
                    }
                },
                suggestedTechStack: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                }
            },
            required: ['title', 'description', 'targetAudience', 'milestones', 'initialTasks']
        };

        const response = await callGeminiAPI({
            model: "gpt-5-mini",
            prompt: `Create a comprehensive project blueprint for this flow: "${prompt}". 
            Flesh out the name, a compelling description, identify the target audience,
            plan 3 - 5 major milestones, and list 5 - 8 initial setup and development tasks.`,
            responseSchema,
            temperature: 0.8
        });

        const blueprint = JSON.parse(response.text || "{}");
        return {
            ...blueprint,
            id: `blueprint - ${Date.now()} `,
            createdAt: new Date(),
        } as ProjectBlueprint;
    } catch (error) {
        console.error("Gemini Blueprint Error:", error);
        throw error;
    }
};

export const generateBlogPostAI = async (topic: string, language: string = 'en', useSearch: boolean = false): Promise<{ content: string; title: string; excerpt: string }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                excerpt: { type: Type.STRING },
                content: { type: Type.STRING },
            },
            required: ['title', 'excerpt', 'content']
        };

        const searchInstructions = useSearch ? `
        **Internet Search Enabled:**
        - You MUST use the Google Search tool to research the latest information, statistics, and trends related to this topic.
        - Include a "Sources & References" section at the very end of the content.
        - Link to the sources you found during your research.
        - Cite specific facts or data points within the text where appropriate.` : '';

        const prompt = `
        You are an expert SEO blog writer. Write a comprehensive, engaging, and professional blog post about: "${topic}".
        
        Language: ${language === 'de' ? 'German' : 'English'}
        
        ${searchInstructions}
        
        **Instructions:**
        1. **Title**: Catchy and SEO-optimized.
        2. **Excerpt**: A concise summary (max 2 sentences).
        3. **Content**:
           - Use rich HTML formatting compatible with a Tiptap editor.
           - Use <h1> for the main title (if you include it in content, otherwise start with intro), <h2> and <h3> for subheadings.
           - Use <p> for paragraphs.
           - Use <ul> / <ol> and <li> for lists.
           - Use <blockquote> for quotes or key emphasis.
           - **CRITICAL**: Include at least one "Key Takeaways" or "Summary" section using a special card block format:
             <div class="card-block">
               <p><strong>Key Takeaways</strong></p>
               <ul>
                 <li>Point 1...</li>
                 <li>Point 2...</li>
               </ul>
             </div>
           ${useSearch ? '- At the end, add a <hr /> followed by a "Sources & References" section.' : ''}
           - Write in a natural, human-like tone.
           
        Return the result as a JSON object with 'title', 'excerpt', and 'content' (the HTML string).
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gpt-5-mini",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
                tools: useSearch ? [{ googleSearch: {} }] : undefined
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Blog Generation Error:", error);
        throw error;
    }
};

export const suggestBlogTopicsAI = async (project: Project): Promise<{ title: string; rationale: string }[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                },
                required: ['title', 'rationale']
            }
        };

        const prompt = `
        You are a Content Strategist. Based on the following project context, suggest 4-6 specific blog post topics that would be relevant, engaging, and valuable for the project's audience.
        
        **Project Context:**
        - Title: ${project.title}
        - Description: ${project.description || "A professional project."}
        - Status: ${project.status}
        
        **Instructions:**
        1. Each topic should have a compelling **Title**.
        2. Each topic should have a brief **Rationale** (1 sentence) explaining why this topic is strategically relevant.
        3. Aim for a mix of "Thought Leadership", "How-to/Educational", and "Product/Service Deep Dive" styles.
        4. Focus on areas that help build authority and solve user problems related to the project.
        
        Return the result as a JSON array of objects with 'title' and 'rationale'.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gpt-5-mini",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.8,
            }
        }));

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("Gemini Blog Topic Suggestion Error:", error);
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
        const ai = getAiClient();

        const inputData = {
            title,
            excerpt,
            content
        };

        const prompt = `
        You are a professional translator.
        Task: Translate the provided blog post fields ${sourceLanguage ? `from ${sourceLanguage} ` : ''}to ${targetLanguage}.
        
        Input Data:
        ${JSON.stringify(inputData)}

        Rules:
        1. "content": Maintain all HTML tags, attributes, and structure EXACTLY. Only translate the text inside tags.
        2. "title": Translate the title naturally.
        3. "excerpt": Translate the excerpt naturally.
        4. Return ONLY a valid JSON object with the translated fields.
        `;

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                content: { type: Type.STRING },
                title: { type: Type.STRING },
                excerpt: { type: Type.STRING },
            },
            required: ['content']
        };

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gpt-5-mini",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.3
            }
        }));

        const result = JSON.parse(response.text || "{}");

        return {
            content: result.content || "",
            title: result.title,
            excerpt: result.excerpt
        };

    } catch (error) {
        console.error("Gemini Translation Error:", error);
        throw error;
    }
};
