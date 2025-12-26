import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Idea, MindmapGrouping, Project, Task, ProjectBlueprint, ProjectRisk } from "../types";
import { auth } from "./firebase";
import { getAIUsage, incrementAIUsage } from "./dataService";

// Helper to check and track usage with retry logic
const runWithTokenCheck = async (operation: (ai: any) => Promise<any>): Promise<any> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const usage = await getAIUsage(user.uid);
    if (usage && usage.tokensUsed >= usage.tokenLimit) {
        throw new Error(`AI token limit reached (${usage.tokensUsed.toLocaleString()} / ${usage.tokenLimit.toLocaleString()}). Limit resets monthly.`);
    }

    const ai = getAiClient();

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            const result = await operation(ai);

            // Track usage
            const tokens = result.usageMetadata?.totalTokenCount || 0;
            if (tokens > 0) {
                await incrementAIUsage(user.uid, tokens);
            }

            return result;
        } catch (error: any) {
            attempts++;

            // Checks for common network/fetch errors
            const isNetworkError =
                error.message?.includes('Failed to fetch') ||
                error.message?.includes('network') ||
                error.message?.includes('PROTOCOL_ERROR');

            if (isNetworkError && attempts < maxAttempts) {
                console.warn(`Gemini API request failed (attempt ${attempts}/${maxAttempts}). Retrying in ${attempts * 1000}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, attempts * 1000));
                continue;
            }

            throw error;
        }
    }
};

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

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate 4-6 specific, actionable project ideas based on this goal: "${prompt}". 
            Keep descriptions concise (under 20 words).`,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.7,
            }
        }));

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
            generated: true,
            stage: 'Ideation'
        }));
    } catch (error) {
        console.error("Gemini Brainstorm Error:", error);
        throw error;
    }
};

export const generateProjectDescription = async (projectName: string, context: string): Promise<string> => {
    try {
        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
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
        Completed tasks (${completed.length}): ${completed.slice(0, 5).map(t => t.title).join("; ")}.
        Assess whether the due date seems realistic given open tasks; explicitly say if it is at risk or on track and why.
        Keep it under 180 words. Provide a short risk/next steps section.
        `;
        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { temperature: 0.4 }
        }));
        return response.text || "Report unavailable.";
    } catch (error) {
        console.error("Gemini Report Error:", error);
        throw error;
    }
};

export const generateProjectIdeasAI = async (project: Project, tasks: Task[], type: string, categoryContext?: string): Promise<Idea[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    // type field is optional in response since we force it, but good for AI to confirm
                    type: { type: Type.STRING },
                },
                required: ['title', 'description'],
            },
        };
        let specificInstructions = "Balance quick wins and impactful improvements.";
        if (type === 'Product') {
            specificInstructions = "Focus on standout product features, monetization opportunities, and market differentiators. Ideas should be commercially viable features or improvements to the product itself.";
        } else if (type === 'Marketing') {
            specificInstructions = "Focus strictly on marketing campaigns, promotional initiatives, and brand awareness strategies (e.g., Email blasts, Ad campaigns, Partnerships). Do NOT suggest product features. Ideas must be actionable marketing activities.";
        } else if (type === 'Social') {
            specificInstructions = "Focus strictly on social media content (e.g., specific post ideas, reels/tiktok concepts, thread topics, viral hooks). Do NOT suggest product features. Ideas must be concrete content pieces or social campaigns.";
        }

        const prompt = `
        Suggest 4-6 ideas to advance the project "${project.title}".
        
        Mandatory Type: ${type} (All ideas MUST be of this type).
        ${categoryContext ? `Focus AREA: "${categoryContext}" (Ensure ideas relate to this category).` : ''}
        
        Project Description: ${project.description || "No description."}
        Current status: ${project.status}; priority: ${project.priority || "Medium"}; due: ${project.dueDate || "Not set"}.
        Open tasks: ${tasks.filter(t => !t.isCompleted).map(t => t.title).join("; ") || "None"}.
        
        ${specificInstructions}
        Keep descriptions under 18 words.
        `;
        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));
        const rawIdeas = JSON.parse(response.text || "[]");
        if (!Array.isArray(rawIdeas) || rawIdeas.length === 0) {
            throw new Error("Gemini returned no ideas");
        }
        return rawIdeas.map((idea: any, index: number) => ({
            id: `gen - ${Date.now()} -${index} `,
            title: idea.title,
            description: idea.description,
            type: type, // Enforce the requested type
            votes: 0,
            comments: 0,
            generated: true,
            stage: 'Ideation'
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
            .map((idea) => `- ${idea.id}: ${idea.title} — ${idea.description || 'No description'} `)
            .join('\n');

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are an AI mind - mapping assistant.Group the provided project ideas into 3 - 6 concise branches with short names(1 - 2 words).
            Project: "${project.title}".
                Ideas(id: title — description):
${ideaList}
Return JSON only.Each object must include:
        - group: the group name you propose(keep it short, eg. "UI", "Architecture", "Growth Ops")
            - ideaIds: an array of idea ids from above that belong in that group
                - reason: optional one - line rationale`,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.5,
            }
        }));

        const parsed = JSON.parse(response.text || "[]");
        return (Array.isArray(parsed) ? parsed : []).map((entry, index) => ({
            group: entry.group || `Group ${index + 1} `,
            reason: entry.reason || '',
            ideaIds: Array.isArray(entry.ideaIds) ? entry.ideaIds : [],
        })) as MindmapGrouping[];
    } catch (error) {
        console.error("Gemini Mindmap Grouping Error:", error);
        return [];
    }
};

export const generateProjectBlueprint = async (prompt: string): Promise<ProjectBlueprint> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                targetAudience: { type: Type.STRING },
                milestones: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                        },
                        required: ['title', 'description']
                    }
                },
                initialTasks: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            priority: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                        },
                        required: ['title', 'priority']
                    }
                },
                suggestedTechStack: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ['title', 'description', 'targetAudience', 'milestones', 'initialTasks']
        };

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: `Create a comprehensive project blueprint for this idea: "${prompt}". 
            Flesh out the name, a compelling description, identify the target audience,
            plan 3 - 5 major milestones, and list 5 - 8 initial setup and development tasks.`,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.8,
            }
        }));

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

export const analyzeProjectRisks = async (context: string): Promise<ProjectRisk[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    risk: { type: Type.STRING },
                    impact: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                    probability: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                    mitigation: { type: Type.STRING },
                },
                required: ['risk', 'impact', 'probability', 'mitigation']
            }
        };

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: `Analyze the potential project risks for this project description: "${context}".
            Identify 4 - 6 specific risks, assess their impact and probability, and suggest a practical mitigation strategy for each.`,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.6,
            }
        }));

        return JSON.parse(response.text || "[]") as ProjectRisk[];
    } catch (error) {
        console.error("Gemini Risk Analysis Error:", error);
        throw error;
    }
};

export const generateSWOTAnalysisAI = async (idea: any): Promise<{ strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                threats: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['strengths', 'weaknesses', 'opportunities', 'threats'],
        };
        const existingStrengths = idea.analysis?.strengths?.join(', ') || "None";
        const existingWeaknesses = idea.analysis?.weaknesses?.join(', ') || "None";
        const existingOpportunities = idea.analysis?.opportunities?.join(', ') || "None";
        const existingThreats = idea.analysis?.threats?.join(', ') || "None";
        const keywords = idea.keywords?.join(', ') || "None";

        const prompt = `
        Perform a SWOT analysis for the following project idea. 
        Your goal is to provide ** ADDITIONAL ** unique points that are not already listed.Do NOT duplicate existing points.

            Context:
        Title: ${idea.title}
        Description: ${idea.description || 'No description provided'}
        Type: ${idea.type || 'General'}
        Brainstorming Keywords: ${keywords}
        
        Current Analysis(Do NOT repeat these):
        - Strengths: ${existingStrengths}
        - Weaknesses: ${existingWeaknesses}
        - Opportunities: ${existingOpportunities}
        - Threats: ${existingThreats}
        
        Provide 3 - 5 NEW, concise bullet points for each category based on the description and keywords.
        `;
        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));
        const parsed = JSON.parse(response.text || "{}");
        // Ensure all arrays exist and are valid
        return {
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
            opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
            threats: Array.isArray(parsed.threats) ? parsed.threats : [],
        };
    } catch (error) {
        console.error("Gemini SWOT Error:", error);
        throw error;
    }
};

export const refineIdeaAI = async (idea: any, history: { role: string, content: string }[]): Promise<string> => {
    try {
        const ai = getAiClient();
        // Construct a prompt context based on the existing idea and chat history
        const context = `
        You are an intelligent product strategist helping to refine a project idea.
        The Idea: "${idea.title}"
        Description: "${idea.description}"
        Current Stage: ${idea.stage}
        
        Your goal is to ask clarifying questions, suggest improvements, or point out potential challenges.
        Be concise, helpful, and conversational.Do not just list generic advice; be specific to this idea.
        `;

        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: context }] },
                { role: "model", parts: [{ text: "Understood. I am ready to help refine this idea. What specific aspect would you like to discuss, or should I start with some initial thoughts?" }] },
                ...history.map(msg => ({
                    role: msg.role === 'ai' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }))
            ]
        });

        const result = await runWithTokenCheck((_ai) => chat.sendMessage("Please provide your next response based on the latest input."));
        return result.response.text();
    } catch (error) {
        console.error("Gemini Idea Refinement Error:", error);
        throw error;
    }
};

export const generateIdeaConceptAI = async (idea: Idea, context: string): Promise<string> => {
    try {
        const ai = getAiClient();

        // Construct a rich prompt with all available context
        const swotContext = idea.analysis ? `
SWOT Analysis:
        - Strengths: ${idea.analysis.strengths.join(', ') || 'N/A'}
        - Weaknesses: ${idea.analysis.weaknesses.join(', ') || 'N/A'}
        - Opportunities: ${idea.analysis.opportunities.join(', ') || 'N/A'}
        - Threats: ${idea.analysis.threats.join(', ') || 'N/A'}
        ` : '';

        const keywordContext = idea.keywords?.length ? `Keywords: ${idea.keywords.join(', ')} ` : '';

        const prompt = `
You are an expert Product Manager writing a Product Requirements Document(PRD).
Create a detailed, professional concept document for the following idea:

            Title: ${idea.title}
        Description: ${idea.description}
${keywordContext}
${swotContext}
${context ? `Note:\n${context}` : ''}

Output the response in ** clean, semantic HTML ** format that is ready to be pasted into a rich text editor. 
Do NOT use Markdown.Do NOT use \`\`\`html code blocks. Just return the raw HTML string.

Use the following structure:
<h1>${idea.title} Concept</h1>

<h2>Executive Summary</h2>
<p>(A concise paragraph summarizing the vision and value proposition)</p>

<h2>Problem Statement</h2>
<p>(What user problem are we solving?)</p>

<h2>Proposed Solution</h2>
<p>(How does this fulfill needs?)</p>

<h2>Key Features & Requirements</h2>
<ul>
  <li><strong>Feature Name:</strong> Description...</li>
  <li><strong>Feature Name:</strong> Description...</li>
</ul>

<h2>Target Audience</h2>
<p>(Who is this for?)</p>

<h2>Implementation Risks</h2>
<p>(Reference weaknesses/threats)</p>

<h2>Success Metrics</h2>
<ul>
  <li>Metric 1</li>
  <li>Metric 2</li>
</ul>

Keep the HTML clean. Use only h1, h2, h3, p, ul, li, strong, em tags. No div or span classes.
`;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.7,
            }
        }));

        const text = response.text || "";
        // Clean up any markdown code blocks if the model ignores instruction
        return text.replace(/```html/g, '').replace(/```/g, '');
    } catch (error) {
        console.error("Gemini Concept Generation Error:", error);
        throw error;
    }
};

export const generateMagicalDraft = async (title: string, type: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `
        You are a product manager helper.
        Write a concise initial description for a "${type}" titled "${title}".
        
        If it's a Feature, include a user story and 3 acceptance criteria.
        If it's a Bug, include a blank structure for Steps to Reproduce.
        If it's a Moonshot, describe the visionary goal.
        
        Keep it under 100 words. Format in Markdown.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.7,
            }
        }));

        return response.text || "";
    } catch (error) {
        console.error("Gemini Magic Draft Error:", error);
        throw error;
    }
};

export const generateKeywordsAI = async (idea: Idea, existingKeywords: string[]): Promise<string[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };

        const prompt = `
        Generate 6-8 relevant, specific keywords or short phrases (1-3 words max) for the following project idea.
        The keywords should help visualize different aspects of the idea (e.g., technologies, user benefits, core features, challenges).
        
        Idea Title: "${idea.title}"
        Existing Keywords: ${existingKeywords.join(', ') || "None"}
        
        Do NOT duplicate existing keywords. Return a flat JSON array of strings.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("Gemini Keyword Generation Error:", error);
        return [];
    }
};

export const generateRiskWinAnalysis = async (idea: Idea): Promise<import("../types").RiskWinAnalysis> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                successProbability: { type: Type.NUMBER },
                marketFitScore: { type: Type.NUMBER },
                technicalFeasibilityScore: { type: Type.NUMBER },
                risks: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                            mitigation: { type: Type.STRING }
                        },
                        required: ['title', 'severity']
                    }
                },
                wins: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            impact: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] }
                        },
                        required: ['title', 'impact']
                    }
                },
                recommendation: { type: Type.STRING }
            },
            required: ['successProbability', 'marketFitScore', 'technicalFeasibilityScore', 'risks', 'wins', 'recommendation']
        };

        const swotContext = idea.analysis ? `
SWOT:
S: ${idea.analysis.strengths.join(', ')}
W: ${idea.analysis.weaknesses.join(', ')}
O: ${idea.analysis.opportunities.join(', ')}
T: ${idea.analysis.threats.join(', ')}` : '';

        const prompt = `
        Analyze the following project idea effectively as a Venture Capitalist and Chief Technology Officer.
        
        Title: ${idea.title}
        Description: ${idea.description}
        Type: ${idea.type}
        Impact: ${idea.impact || 'Unknown'}
        Effort: ${idea.effort || 'Unknown'}
        ${swotContext}

        Provide a quantitative and qualitative analysis:
        1. Success Probability (0-100%): Estimate based on feasibility and market need.
        2. Market Fit Score (0-10): How well does this address a real user need?
        3. Technical Feasibility Score (0-10): How easy/realistic is it to build?
        4. Risks: Top 3-5 risks with severity.
        5. Wins: Top 3-5 potential big wins/benefits with impact level.
        6. Recommendation: A 1-sentence verdict on whether to proceed.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.5,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Risk/Win Analysis Error:", error);
        throw error;
    }
};

export const generateProductStrategyAI = async (idea: Idea): Promise<{ vision: string, marketFit: number, feasibility: number }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                vision: { type: Type.STRING },
                marketFit: { type: Type.NUMBER },
                feasibility: { type: Type.NUMBER }
            },
            required: ['vision', 'marketFit', 'feasibility']
        };

        const prompt = `
        You are a Chief Product Officer. defining the strategy for a new product.
        
        Title: ${idea.title}
        Description: ${idea.description}
        Type: ${idea.type}
        
        1. Write a compelling **Product Vision Statement** (max 3 sentences) that describes the long-term goal and impact.
        2. Estimate a **Market Fit Score** (0-10) based on the problem's universality and urgency.
        3. Estimate a **Technical Feasibility Score** (0-10) based on typical complexity for such a product.
        
        Return JSON.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        const result = JSON.parse(response.text || "{}");
        return {
            vision: result.vision || "",
            marketFit: result.marketFit || 5,
            feasibility: result.feasibility || 5
        };
    } catch (error) {
        console.error("Gemini Strategy Error:", error);
        throw error;
    }
};

export const generateProductDiscoveryAI = async (idea: Idea): Promise<{
    personas: { name: string; role: string; painPoints: string[]; goals: string[] }[];
    competitors: { name: string; strengths: string; weaknesses: string }[];
    marketSize: string;
    targetSegment: string;
}> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                personas: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            role: { type: Type.STRING },
                            painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                            goals: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['name', 'role', 'painPoints', 'goals']
                    }
                },
                competitors: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            strengths: { type: Type.STRING },
                            weaknesses: { type: Type.STRING }
                        },
                        required: ['name', 'strengths', 'weaknesses']
                    }
                },
                marketSize: { type: Type.STRING },
                targetSegment: { type: Type.STRING }
            },
            required: ['personas', 'competitors', 'marketSize', 'targetSegment']
        };

        const prompt = `
        You are a Product Researcher conducting discovery for a new product.
        
        Product: ${idea.title}
        Description: ${idea.description}
        Type: ${idea.type}
        
        Generate discovery research:
        1. Create 2-3 distinct user personas with realistic names, roles, 2-3 pain points each, and 2-3 goals each.
        2. Identify 2-3 potential competitors with their key strengths (1 sentence) and weaknesses (1 sentence).
        3. Estimate the market size (TAM) as a concise string (e.g., "$15B global market").
        4. Define the target segment in one sentence.
        
        Be specific and realistic based on the product description.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        const result = JSON.parse(response.text || "{}");
        return {
            personas: result.personas || [],
            competitors: result.competitors || [],
            marketSize: result.marketSize || "",
            targetSegment: result.targetSegment || ""
        };
    } catch (error) {
        console.error("Gemini Discovery Error:", error);
        throw error;
    }
};

export const generateSocialCaption = async (topic: string, tone: string, platform: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `
        Generate a creative and engaging social media caption for ${platform}.
        Topic: "${topic}"
        Tone: ${tone}
        
        Requirements:
        - Optimized for ${platform} audience and algorithm.
        - Include 2-3 relevant emojis.
        - Keep it concise but impactful.
        - Do NOT include hashtags in the caption text (hashtags are separate).
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.8,
            }
        }));

        return response.text?.trim() || "";
    } catch (error) {
        console.error("Gemini Caption Gen Error:", error);
        throw error;
    }
};

export const generateSocialHashtags = async (topic: string, platform: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `
        Generate 10-15 highly relevant and trending hashtags for a ${platform} post about: "${topic}".
        Return them as a single string separated by spaces (e.g. #tech #coding #design).
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.7,
            }
        }));

        return response.text?.trim() || "";
    } catch (error) {
        console.error("Gemini Hashtag Gen Error:", error);
        throw error;
    }
};

export const generateYouTubeScript = async (title: string, thumbnailIdea: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `
        Create a high-level script outline and video description for a YouTube video.
        
        Video Title: "${title}"
        Thumbnail Concept: "${thumbnailIdea}"
        
        Output suggested structure:
        1. Hook (0:00-0:30)
        2. Intro & Value Prop
        3. Key Point 1
        4. Key Point 2
        5. Key Point 3
        6. Outro & Call to Action
        
        Also include a short, SEO-friendly video description at the end.
        Keep the total length under 300 words.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.7,
            }
        }));

        return response.text?.trim() || "";
    } catch (error) {
        console.error("Gemini Script Gen Error:", error);
        throw error;
    }
};

export const generateProductDefinitionAI = async (idea: Idea): Promise<{ scope: string, outOfScope: string, successCriteria: string, requirements: import("../types").Requirement[] }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                scope: { type: Type.ARRAY, items: { type: Type.STRING } },
                outOfScope: { type: Type.ARRAY, items: { type: Type.STRING } },
                successCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                requirements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            priority: { type: Type.STRING, enum: ['must', 'should', 'could', 'wont'] }
                        },
                        required: ['title', 'description', 'priority']
                    }
                }
            },
            required: ['scope', 'outOfScope', 'successCriteria', 'requirements']
        };

        const discoveryContext = idea.concept ? (() => {
            try {
                const parsed = JSON.parse(idea.concept);
                return `
                    Personas: ${parsed.personas?.map((p: any) => p.name + " (" + p.role + ")").join(', ') || 'N/A'}
                    Market: ${parsed.marketSize || 'N/A'} / ${parsed.targetSegment || 'N/A'}
                `;
            } catch { return ''; }
        })() : '';

        const prompt = `
        Create a detailed Product Definition for the following idea.
        
        Context:
        Title: ${idea.title}
        Description: ${idea.description}
        Vision: ${idea.vision || 'N/A'}
        ${discoveryContext}

        Generate:
        1. **In Scope**: 3-5 high-level deliverables or boundaries.
        2. **Out of Scope**: 2-3 specific things we are NOT doing right now.
        3. **Success Criteria**: 3-5 specific, measurable success metrics (KPIs).
        4. **Requirements**: 6-10 specific functional requirements prioritized using MoSCoW (Must, Should, Could, Won't).
           - Must: Critical for MVP
           - Should: Important but not vital for launch
           - Could: Desirable but can be delayed
           - Wont: Explicitly deferred
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        const result = JSON.parse(response.text || "{}");

        return {
            scope: (result.scope || []).join('\n'),
            outOfScope: (result.outOfScope || []).join('\n'),
            successCriteria: (result.successCriteria || []).join('\n'),
            requirements: (result.requirements || []).map((req: any, index: number) => ({
                id: `ai-req-${Date.now()}-${index}`,
                ...req
            }))
        };

    } catch (error) {
        console.error("Gemini Product Definition Error:", error);
        throw error;
    }
};

export const generateProductDevelopmentAI = async (idea: Idea): Promise<{ techStack: { category: string, items: string[] }[], phases: { name: string, weeks: string, tasks: string[] }[] }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                techStack: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING },
                            items: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['category', 'items']
                    }
                },
                phases: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            weeks: { type: Type.STRING },
                            tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['name', 'weeks', 'tasks']
                    }
                }
            },
            required: ['techStack', 'phases']
        };

        const definitionContext = idea.requirements ? (() => {
            try {
                const parsed = JSON.parse(idea.requirements);
                const reqs = parsed.requirements?.filter((r: any) => r.priority === 'must' || r.priority === 'should').map((r: any) => r.title).join(', ') || 'N/A';
                return `
                    Scope: ${parsed.scope || 'N/A'}
                    Core Requirements: ${reqs}
                `;
            } catch { return ''; }
        })() : '';

        const prompt = `
        Create a practical Development Plan for the following idea.
        
        Context:
        Title: ${idea.title}
        Description: ${idea.description}
        Tech Feasibility: ${idea.riskWinAnalysis?.technicalFeasibilityScore || 'Unknown'}/10
        ${definitionContext}

        Generate:
        1. **Tech Stack**: Recommend a modern, appropriate tech stack grouped by category (e.g., Frontend, Backend, Database, Infrastructure).
           - Do NOT just list languages. Suggest specific frameworks/libraries (e.g., "React + Vite", "Firebase Auth", "PostgreSQL").
           - Create 3-4 categories.
        
        2. **Implementation Phases**: Break the project into 3-4 logical phases (e.g., "Setup & Core", "MVP Features", "Polish & Launch").
           - For each phase, suggested duration (e.g. "2 weeks") and 4-6 specific actionable tasks.
           - Ensure tasks align with the provided scope and requirements.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.6,
            }
        }));

        const result = JSON.parse(response.text || "{}");
        return {
            techStack: result.techStack || [],
            phases: result.phases || []
        };

    } catch (error) {
        console.error("Gemini Product Development Error:", error);
        throw error;
    }
};

export const generateProductLaunchAI = async (idea: Idea): Promise<{ checklist: { category: string, items: string[] }[], channels: string[], announcement: string }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                checklist: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING },
                            items: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['category', 'items']
                    }
                },
                channels: { type: Type.ARRAY, items: { type: Type.STRING } },
                announcement: { type: Type.STRING }
            },
            required: ['checklist', 'channels', 'announcement']
        };

        const strategyContext = idea.description ? `Vision: ${idea.description}` : '';

        const prompt = `
        Create a Go-to-Market Launch Plan for the following idea.
        
        Context:
        Title: ${idea.title}
        ${strategyContext}
        Target Audience: ${idea.riskWinAnalysis?.marketFitScore ? 'Defined in strategy' : 'General'}

        Generate:
        1. **Launch Checklist**: 3-4 categories of tasks (e.g. "QA & Polish", "Assets", "Distribution").
           - 3-5 specific, critical launch tasks per category.
        
        2. **Marketing Channels**: List 5-7 distinct channels appropriate for this product (e.g., "Product Hunt", "Hacker News", "LinkedIn", "Internal Newsletter").

        3. **Announcement Draft**: A punchy, exciting "One-Liner" announcement text (tweet length) that can be used as a hook.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        const result = JSON.parse(response.text || "{}");
        return {
            checklist: result.checklist || [],
            channels: result.channels || [],
            announcement: result.announcement || ""
        };

    } catch (error) {
        console.error("Gemini Product Launch Error:", error);
        throw error;
    }
};
export const generateCampaignDetailsAI = async (title: string): Promise<{
    goal: string;
    description: string;
    targetAudience: string;
    toneOfVoice: string;
    platforms: string[];
    tags: string[];
    startDate: string;
    endDate: string;
}> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                goal: { type: Type.STRING },
                description: { type: Type.STRING },
                targetAudience: { type: Type.STRING },
                toneOfVoice: { type: Type.STRING },
                platforms: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
            },
            required: ['goal', 'description', 'targetAudience', 'toneOfVoice', 'platforms', 'tags', 'startDate', 'endDate']
        };

        const today = new Date().toISOString().split('T')[0];

        const prompt = `
        You are a Social Media Marketing Expert.
        Creates a comprehensive social media campaign plan for a campaign titled: "${title}".

        Generate the following details:
        1. **Goal**: A specific, measurable goal (e.g., "Increase brand awareness by 20%").
        2. **Description**: A detailed campaign strategy and overview (approx. 100-150 words). Return the content as **clean HTML** (e.g., using <h3>, <p>, <ul>, <li>, <strong> tags). Do NOT use markdown. Start with a <h3> for the overview title.
        3. **Target Audience**: A concise description of the demographics and psychographics.
        4. **Tone of Voice**: The desired persona (e.g., "Witty, Professional, Urgent").
        5. **Platforms**: Choose the best platforms (Select from: Instagram, Facebook, LinkedIn, TikTok, X, YouTube).
        6. **Tags**: 5-8 relevant hashtags or keywords (without #).
        7. **Timeline**: Suggest a realistic Start Date (using ${today} as baseline) and End Date (typical duration 2-4 weeks). Format as YYYY-MM-DD.

        Return valid JSON.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Campaign Gen Error:", error);
        throw error;
    }
};
// ... existing imports
import { SocialCampaign } from "../types";

export interface SocialPostDraft {
    platform: string;
    content: string; // The main text/caption
    hashtags: string[];
    scheduledDayOffset: number; // 0-6
    type: 'Image' | 'Video' | 'Carousel' | 'Story' | 'Reel'; // Format suggestion
    imagePrompt?: string; // Prompt for image generation if needed
}

export const generateCampaignContentPlan = async (
    campaign: SocialCampaign,
    project: { title: string; description: string },
    existingPosts: string[] = [],
    overrides?: { focus?: string; platforms?: string[] }
): Promise<SocialPostDraft[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    platform: { type: Type.STRING },
                    content: { type: Type.STRING },
                    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    scheduledDayOffset: { type: Type.INTEGER },
                    type: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING }
                },
                required: ['platform', 'content', 'hashtags', 'scheduledDayOffset', 'type']
            }
        };

        const existingContext = existingPosts.length > 0
            ? `Avoid creating duplicates of these existing post concepts: ${existingPosts.join('; ')}.`
            : '';

        const targetPlatforms = overrides?.platforms?.length ? overrides.platforms : (campaign.platforms || ["Instagram", "LinkedIn"]);
        const focusContext = overrides?.focus ? `Main Focus/Theme for this week: "${overrides.focus}".` : '';

        const prompt = `
        You are a social media manager. Create a 7-day content plan for the following campaign.
        
        Campaign: "${campaign.name}"
        Goal: ${campaign.goal || "Engagement"}
        Description: ${campaign.description || "No description"}
        Audience: ${campaign.targetAudience}
        Tone: ${campaign.toneOfVoice}
        Platforms: ${targetPlatforms.join(', ')}
        
        Project Context: "${project.title}" - ${project.description}
        
        ${focusContext}
        ${existingContext}
        
        Requirements:
        1. Generate 7-10 high-quality, fully fleshed-out posts spread over 7 days (offsets 0-6).
        2. Vary the platforms based on the provided target platforms.
        3. Include a mix of formats (Posts, Reels/Shorts, Stories).
        4. "content" must be the actual caption/text ready to post, not just an idea.
        5. "imagePrompt" should describe a visual to accompany the text (NO text in image, just visual description).
        
        Return a JSON array of post drafts.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        const result = JSON.parse(response.text || "[]");
        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error("Gemini Content Plan Error:", error);
        throw error;
    }
};
