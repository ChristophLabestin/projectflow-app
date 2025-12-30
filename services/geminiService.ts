import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Idea, MindmapGrouping, Project, Task, ProjectBlueprint, ProjectRisk, SocialCampaign, Milestone, Issue, Activity, Member } from "../types";
import { auth } from "./firebase";
import { getAIUsage, incrementAIUsage, incrementIdeaAIUsage, incrementCampaignAIUsage } from "./dataService";
import { applyLanguageInstruction, getAIResponseInstruction } from "../utils/aiLanguage";

import { getUserProfile } from "./dataService";

// Helper to check and track usage with retry logic
const runWithTokenCheck = async (
    operation: (ai: any) => Promise<any>,
    tracking?: { ideaId?: string; projectId?: string; campaignId?: string; tenantId?: string }
): Promise<any> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Pre-Beta Config Check
    const profile = await getUserProfile(user.uid);
    let apiKey = '';
    let tokenLimit = 1000000; // Default system limit

    if (profile?.geminiConfig?.apiKey) {
        apiKey = profile.geminiConfig.apiKey;
        tokenLimit = profile.geminiConfig.tokenLimit || 10000000; // User limit or high default
    } else {
        // Enforce user key in Pre-Beta
        throw new Error("Pre-Beta: You must set your own Gemini API Key in Settings > Pre-Beta to use AI features.");
    }

    const usage = await getAIUsage(user.uid);
    if (usage && usage.tokensUsed >= tokenLimit) {
        throw new Error(`AI token limit reached (${usage.tokensUsed.toLocaleString()} / ${tokenLimit.toLocaleString()}). Limit resets monthly.`);
    }

    const ai = getAiClient(apiKey);
    const { instruction } = getAIResponseInstruction();
    const aiWithLanguage = {
        ...ai,
        models: {
            ...ai.models,
            generateContent: (args: any) => {
                const contents = applyLanguageInstruction(args?.contents, instruction);
                return ai.models.generateContent({ ...args, contents });
            }
        }
    };

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            const result = await operation(aiWithLanguage);

            // Track usage
            const tokens = result.usageMetadata?.totalTokenCount || 0;
            if (tokens > 0) {
                await incrementAIUsage(user.uid, tokens);

                // Track per idea/campaign
                if (tracking?.ideaId && tracking?.projectId) {
                    await incrementIdeaAIUsage(tracking.ideaId, tokens, tracking.projectId, tracking.tenantId);
                } else if (tracking?.campaignId) {
                    await incrementCampaignAIUsage(tracking.campaignId, tokens, tracking.tenantId);
                }
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
const getAiClient = (apiKey?: string) => {
    // Prefer passed key (User key), then fallback to env ONLY if not in strict user-key mode (which we are)
    // Actually, user instruction says "currently set gemini api key should not be requested while in pre beta"
    // So if apiKey is passed, use it. If not, don't use system key.

    if (apiKey) {
        return new GoogleGenAI({ apiKey });
    }

    // Fallback logic for dev/build scripts that might not have user context, 
    // but for app usage, runWithTokenCheck enforces the key.
    // We KEEP this for non-user contexts (like CLI scripts), but likely won't be reached by app.
    const systemKey =
        (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
        process.env.GEMINI_API_KEY ||
        process.env.API_KEY ||
        '';

    if (!systemKey) {
        throw new Error("Missing GEMINI API key.");
    }
    return new GoogleGenAI({ apiKey: systemKey });
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
            model: "gemini-3-pro-preview",
            contents: `Generate 4-6 specific, actionable project flows based on this goal: "${prompt}". 
            Keep descriptions concise (under 20 words).`,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.7,
            }
        }));

        const rawIdeas = JSON.parse(response.text || "[]");
        if (!Array.isArray(rawIdeas) || rawIdeas.length === 0) {
            throw new Error("Gemini returned no flows");
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
            model: "gemini-3-pro-preview",
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
    issues: Issue[],
    ideas: Idea[],
    activity: Activity[],
    members: any[]
): Promise<string> => {
    try {
        const ai = getAiClient();
        const openTasks = tasks.filter(t => !t.isCompleted);
        const completedTasks = tasks.filter(t => t.isCompleted);
        const highPriorityTasks = openTasks.filter(t => t.priority === 'High' || t.priority === 'Urgent');

        const pendingMilestones = milestones.filter(m => m.status !== 'Achieved');
        const nextMilestone = pendingMilestones.sort((a, b) => new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime())[0];

        const openIssues = issues.filter(i => i.status !== 'Closed' && i.status !== 'Resolved');
        const highPriorityIssues = openIssues.filter(i => i.priority === 'High' || i.priority === 'Urgent');

        const recentActivity = activity.slice(0, 5).map(a => `${a.user} ${a.action} ${a.target}`).join('; ');

        const prompt = `
        You are an expert Project Manager AI. Create a comprehensive, professional status report for the project "${project.title}".
        
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
        - Issues/Bugs: ${openIssues.length} open (${highPriorityIssues.length} critical).
        - Idea Pipeline: ${ideas.length} flows captured.

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

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                temperature: 0.4,
                responseMimeType: "text/plain"
            }
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
            specificInstructions = "Focus on standout product features, monetization opportunities, and market differentiators. Flows should be commercially viable features or improvements to the product itself.";
        } else if (type === 'Marketing') {
            specificInstructions = "Focus strictly on marketing campaigns, promotional initiatives, and brand awareness strategies (e.g., Email blasts, Ad campaigns, Partnerships). Do NOT suggest product features. Flows must be actionable marketing activities.";
        } else if (type === 'Social') {
            specificInstructions = "Focus strictly on social media content (e.g., specific post flows, reels/tiktok concepts, thread topics, viral hooks). Do NOT suggest product features. Flows must be concrete content pieces or social campaigns.";
        }

        const prompt = `
        Suggest 4-6 flows to advance the project "${project.title}".
        
        Mandatory Type: ${type} (All flows MUST be of this type).
        ${categoryContext ? `Focus AREA: "${categoryContext}" (Ensure flows relate to this category).` : ''}
        
        Project Description: ${project.description || "No description."}
        Current status: ${project.status}; priority: ${project.priority || "Medium"}; due: ${project.dueDate || "Not set"}.
        Open tasks: ${tasks.filter(t => !t.isCompleted).map(t => t.title).join("; ") || "None"}.
        
        ${specificInstructions}
        Keep descriptions under 18 words.
        `;
        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));
        const rawIdeas = JSON.parse(response.text || "[]");
        if (!Array.isArray(rawIdeas) || rawIdeas.length === 0) {
            throw new Error("Gemini returned no flows");
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
        console.error("Gemini Project Flows Error:", error);
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
            model: "gemini-3-pro-preview",
            contents: `You are an AI mind - mapping assistant.Group the provided project flows into 3 - 6 concise branches with short names(1 - 2 words).
            Project: "${project.title}".
                Flows (id: title — description):
${ideaList}
Return JSON only.Each object must include:
        - group: the group name you propose(keep it short, eg. "UI", "Architecture", "Growth Ops")
            - ideaIds: an array of flow ids from above that belong in that group
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
            model: "gemini-3-pro-preview",
            contents: `Create a comprehensive project blueprint for this flow: "${prompt}". 
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
            model: "gemini-3-pro-preview",
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
        Perform a SWOT analysis for the following project flow. 
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
            model: "gemini-3-pro-preview",
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
        You are an intelligent product strategist helping to refine a project flow.
        The Flow: "${idea.title}"
        Description: "${idea.description}"
        Current Stage: ${idea.stage}
        
        Your goal is to ask clarifying questions, suggest improvements, or point out potential challenges.
        Be concise, helpful, and conversational.Do not just list generic advice; be specific to this flow.
        `;

        const contents = [
            { role: "user", parts: [{ text: context }] },
            { role: "model", parts: [{ text: "Understood. I am ready to help refine this flow. What specific aspect would you like to discuss, or should I start with some initial thoughts?" }] },
            ...history.map(msg => ({
                role: msg.role === 'ai' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            })),
            { role: "user", parts: [{ text: "Please provide your next response based on the latest input." }] }
        ];

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: contents
        }));

        return response.text || "";
    } catch (error) {
        console.error("Gemini Flow Refinement Error:", error);
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
Create a detailed, professional concept document for the following flow:

            Title: ${idea.title}
        Description: ${idea.description}
${keywordContext}
${swotContext}
${context ? `Note:\n${context}` : ''}

Output the response in ** clean, semantic HTML ** format that is ready to be pasted into a rich text editor. 
Do NOT use Markdown.Do NOT use \`\`\`html code blocks. Just return the raw HTML string.

Use the following structure:
<h1>${idea.title} Flow Concept</h1>

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
            model: "gemini-3-pro-preview",
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
            model: "gemini-3-pro-preview",
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
        Generate 6-8 relevant, specific keywords or short phrases (1-3 words max) for the following project flow.
        The keywords should help visualize different aspects of the flow (e.g., technologies, user benefits, core features, challenges).
        
        Flow Title: "${idea.title}"
        Existing Keywords: ${existingKeywords.join(', ') || "None"}
        
        Do NOT duplicate existing keywords. Return a flat JSON array of strings.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
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

        // Added: Parse campaign strategy if available to give better analysis
        let strategyContext = '';
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                strategyContext = `
Campaign Strategy:
Goal: ${parsed.campaignType || 'Engagement'}
Target Audience: ${Array.isArray(parsed.audienceSegments) ? parsed.audienceSegments.map((s: any) => typeof s === 'string' ? s : s.name).join(', ') : 'Not specified'}
Phases: ${parsed.phases?.map((p: any) => `${p.name} (${p.durationValue} ${p.durationUnit}) - Focus: ${p.focus}`).join('; ')}
Platforms: ${parsed.platforms?.map((p: any) => `${p.id} (${p.frequencyValue} ${p.frequencyUnit})`).join(', ')}
Content Plan: ${parsed.planningPosts?.length || 0} posts scheduled.
`;
            } else if (idea.concept) {
                strategyContext = `Concept: ${idea.concept.substring(0, 500)}...`;
            }
        } catch (e) { }

        const prompt = `
        Analyze the following project flow effectively as a Venture Capitalist and Chief Technology Officer.
        
        Title: ${idea.title}
        Description: ${idea.description}
        Type: ${idea.type}
        Impact: ${idea.impact || 'Unknown'}
        Effort: ${idea.effort || 'Unknown'}
        ${swotContext}
        ${strategyContext}


        Provide a quantitative and qualitative analysis:
        1. Success Probability (0-100%): Estimate based on feasibility and market need.
        2. Market Fit Score (0-10): How well does this address a real user need?
        3. Technical Feasibility Score (0-10): How easy/realistic is it to build?
        4. Risks: Top 3-5 risks with severity.
        5. Wins: Top 3-5 potential big wins/benefits with impact level.
        6. Recommendation: A 1-sentence verdict on whether to proceed.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Win/Risk Analysis Error:", error);
        throw error;
    }
};

export const generateBlogPostAI = async (topic: string, language: string = 'en'): Promise<{ content: string; title: string; excerpt: string }> => {
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

        const prompt = `
        You are an expert SEO blog writer. Write a comprehensive, engaging, and professional blog post about: "${topic}".
        
        Language: ${language === 'de' ? 'German' : 'English'}
        
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
           - Write in a natural, human-like tone.
           
        Return the result as a JSON object with 'title', 'excerpt', and 'content' (the HTML string).
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Blog Generation Error:", error);
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
                feasibility: { type: Type.NUMBER },
            },
            required: ['vision', 'marketFit', 'feasibility']
        };

        const prompt = `
        Develop a high-level product strategy for:
        Title: "${idea.title}"
        Description: "${idea.description}"

        Return:
        1. Vision Statement (Inspiring, forward-looking)
        2. Market Fit Score (0-10)
        3. Feasibility Score (0-10)
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Product Strategy Error:", error);
        throw error;
    }
};

export const generateAdCopy = async (
    productName: string,
    objective: string,
    platform: string,
    description: string
): Promise<{ headlines: string[]; primaryText: string[]; description: string }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                headlines: { type: Type.ARRAY, items: { type: Type.STRING } },
                primaryText: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING }
            },
            required: ['headlines', 'primaryText', 'description']
        };

        const prompt = `
        Generate high-converting ad copy for a "${platform}" ad campaign.
        Product: "${productName}"
        Objective: "${objective}"
        Context: "${description}"

        Provide:
        - 3-5 punchy headlines (under 40 chars)
        - 2-3 engaging primary text options (under 125 chars)
        - 1 link description (under 30 chars)
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.8,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Ad Copy Error:", error);
        throw error;
    }
};

export const generateTargetingSuggestions = async (
    productName: string,
    description: string,
    objective: string
): Promise<{ interests: string[]; demographics: { ageMin: number; ageMax: number; genders: string[] } }> => {
    try {
        const ai = getAiClient();

        // Define exact schema to avoid "genders" type mismatch
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                interests: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                demographics: {
                    type: Type.OBJECT,
                    properties: {
                        ageMin: { type: Type.NUMBER },
                        ageMax: { type: Type.NUMBER },
                        genders: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING, enum: ['Male', 'Female', 'All'] }
                        }
                    },
                    required: ['ageMin', 'ageMax', 'genders']
                }
            },
            required: ['interests', 'demographics']
        };

        const prompt = `
        Suggest precise ad targeting for:
        Product: "${productName}"
        Description: "${description}"
        Objective: "${objective}"

        Return:
        - 5-8 specific interests/behaviors (e.g. "Small Business Owners", "Yoga", "SaaS")
        - Demographic fit (Age range, Gender)
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.5,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Targeting Error:", error);
        throw error;
    }
};

export const generateBudgetRecommendation = async (
    objective: string,
    audienceSize: string
): Promise<{ recommendedBudget: number; rationale: string }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                recommendedBudget: { type: Type.NUMBER },
                rationale: { type: Type.STRING }
            },
            required: ['recommendedBudget', 'rationale']
        };

        const prompt = `
        Recommend a daily starting budget for an ad campaign.
        Objective: "${objective}"
        Audience Estimate: "${audienceSize}"

        Return reasonable daily spend (USD) and a 1-sentence rationale.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.5,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Budget Error:", error);
        throw error;
    }
};

export const suggestObjective = async (
    title: string,
    description: string
): Promise<string> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                objective: { type: Type.STRING, enum: ['Traffic', 'Leads', 'Sales', 'Brand Awareness', 'Engagement', 'Video Views'] },
                reason: { type: Type.STRING }
            },
            required: ['objective', 'reason']
        };

        const prompt = `
        Select the best ad campaign objective for:
        Project: "${title}"
        Description: "${description}"

        Choose one: Traffic, Leads, Sales, Brand Awareness, Engagement, Video Views.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.3,
            }
        }));

        const data = JSON.parse(response.text || "{}");
        return data.objective || 'Traffic';
    } catch (error) {
        console.error("Gemini Objective Suggestion Error:", error);
        return 'Traffic';
    }
};

export const rewriteText = async (
    text: string,
    tone: 'Professional' | 'Persuasive' | 'Punchy' = 'Professional'
): Promise<string> => {
    try {
        const ai = getAiClient();

        const prompt = `
        Rewrite the following text to be more ${tone}:
        "${text}"

        Return only the rewritten text. Keep it concise.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "text/plain",
                temperature: 0.7,
            }
        }));

        return response.text || text;
    } catch (error) {
        console.error("Gemini Rewrite Error:", error);
        return text;
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
            model: "gemini-3-pro-preview",
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
            model: "gemini-3-pro-preview",
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

export const generateSocialHashtags = async (topic: string, platform: string, limit?: number): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `
        Generate ${limit ? `exactly ${limit}` : '10-15'} highly relevant and trending hashtags for a ${platform} post about: "${topic}".
        Return them as a single string separated by spaces (e.g. #tech #coding #design).
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
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

export const reworkSocialHashtags = async (hashtags: string, caption: string, platform: string, limit: number): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `
        You are a social media expert. The following ${platform} post has too many hashtags.
        Limit: ${limit} hashtags.
        Current hashtags: ${hashtags}
        Caption for context: "${caption}"

        Please select the ${limit} most relevant and impactful hashtags from the list or generate better ones that fit the limit and the platform's current trends.
        Return ONLY the hashtags as a single string separated by spaces.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                temperature: 0.5,
            }
        }));

        return response.text?.trim() || "";
    } catch (error) {
        console.error("Gemini Hashtag Rework Error:", error);
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
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                temperature: 0.7,
            }
        }));

        return response.text || "";
    } catch (error) {
        console.error("Gemini YouTube Script Error:", error);
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
        Create a detailed Product Definition for the following flow.

    Context:
    Title: ${idea.title}
Description: ${idea.description}
Vision: ${idea.vision || 'N/A'}
        ${discoveryContext}

Generate:
1. ** In Scope **: 3 - 5 high - level deliverables or boundaries.
        2. ** Out of Scope **: 2 - 3 specific things we are NOT doing right now.
        3. ** Success Criteria **: 3 - 5 specific, measurable success metrics(KPIs).
        4. ** Requirements **: 6 - 10 specific functional requirements prioritized using MoSCoW (Must, Should, Could, Won't).
    - Must: Critical for MVP
        - Should: Important but not vital for launch
            - Could: Desirable but can be delayed
                - Wont: Explicitly deferred
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
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
                id: `ai - req - ${Date.now()} -${index} `,
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
        Create a practical Development Plan for the following flow.

    Context:
    Title: ${idea.title}
Description: ${idea.description}
        Tech Feasibility: ${idea.riskWinAnalysis?.technicalFeasibilityScore || 'Unknown'}/10
        ${definitionContext}

Generate:
1. ** Tech Stack **: Recommend a modern, appropriate tech stack grouped by category(e.g., Frontend, Backend, Database, Infrastructure).
           - Do NOT just list languages.Suggest specific frameworks / libraries(e.g., "React + Vite", "Firebase Auth", "PostgreSQL").
           - Create 3 - 4 categories.
        
        2. ** Implementation Phases **: Break the project into 3 - 4 logical phases(e.g., "Setup & Core", "MVP Features", "Polish & Launch").
           - For each phase, suggested duration(e.g. "2 weeks") and 4 - 6 specific actionable tasks.
           - Ensure tasks align with the provided scope and requirements.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
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

        const strategyContext = idea.description ? `Vision: ${idea.description} ` : '';

        const prompt = `
        Create a Go - to - Market Launch Plan for the following flow.

    Context:
    Title: ${idea.title}
        ${strategyContext}
        Target Audience: ${idea.riskWinAnalysis?.marketFitScore ? 'Defined in strategy' : 'General'}

Generate:
1. ** Launch Checklist **: 3 - 4 categories of tasks(e.g. "QA & Polish", "Assets", "Distribution").
           - 3 - 5 specific, critical launch tasks per category.
        
        2. ** Marketing Channels **: List 5 - 7 distinct channels appropriate for this product(e.g., "Product Hunt", "Hacker News", "LinkedIn", "Internal Newsletter").

        3. ** Announcement Draft **: A punchy, exciting "One-Liner" announcement text(tweet length) that can be used as a hook.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
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
1. ** Goal **: A specific, measurable goal(e.g., "Increase brand awareness by 20%").
        2. ** Description **: A detailed campaign strategy and overview(approx. 100 - 150 words).Return the content as ** clean HTML ** (e.g., using<h3>, <p>, <ul>, <li>, <strong>tags).Do NOT use markdown.Start with a<h3> for the overview title.
        3. ** Target Audience **: A concise description of the demographics and psychographics.
        4. ** Tone of Voice **: The desired persona(e.g., "Witty, Professional, Urgent").
        5. ** Platforms **: Choose the best platforms(Select from: Instagram, Facebook, LinkedIn, TikTok, X, YouTube).
        6. ** Tags **: 5 - 8 relevant hashtags or keywords(without #).
        7. ** Timeline **: Suggest a realistic Start Date(using ${today} as baseline) and End Date(typical duration 2 - 4 weeks).Format as YYYY - MM - DD.

        Return valid JSON.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
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

export const generateCampaignDescriptionAI = async (campaignData: {
    name: string;
    goal?: string;
    bigIdea?: string;
    hook?: string;
    platforms?: string;
    targetAudience?: string;
    toneOfVoice?: string;
    mood?: string;
    visualDirection?: string;
    phases?: string;
    startDate?: string;
    endDate?: string;
}): Promise<string> => {
    try {
        const prompt = `You are a marketing strategist. Write a compelling, professional campaign description (2-3 paragraphs in HTML format) based on the following campaign details:

Campaign Name: ${campaignData.name}
Goal: ${campaignData.goal || 'Not specified'}
Core Flow: ${campaignData.bigIdea || 'Not specified'}
Hook: ${campaignData.hook || 'Not specified'}
Platforms: ${campaignData.platforms || 'Not specified'}
Target Audience: ${campaignData.targetAudience || 'Not specified'}
Tone: ${campaignData.toneOfVoice || 'Not specified'}
Mood: ${campaignData.mood || 'Not specified'}
Visual Direction: ${campaignData.visualDirection || 'Not specified'}
Phases: ${campaignData.phases || 'Not specified'}
Start Date: ${campaignData.startDate || 'Not specified'}
End Date: ${campaignData.endDate || 'Not specified'}

Write the description in a way that:
1. Summarizes the campaign's purpose and objectives
2. Highlights the key strategy and approach
3. Creates excitement and clarity about the campaign

Respond ONLY with the HTML content (using <p>, <strong>, <em> tags). No markdown, no code blocks.`;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                temperature: 0.7,
            }
        }));

        const text = response.text || "";
        // Clean up any markdown artifacts
        return text.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    } catch (error) {
        console.error("Gemini Campaign Description Error:", error);
        throw error;
    }
};

// ... existing definitions

export interface SocialPostDraft {
    platforms: string[];
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
                    platforms: { type: Type.ARRAY, items: { type: Type.STRING } },
                    content: { type: Type.STRING },
                    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    scheduledDayOffset: { type: Type.INTEGER },
                    type: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING }
                },
                required: ['platforms', 'content', 'hashtags', 'scheduledDayOffset', 'type']
            }
        };

        const existingContext = existingPosts.length > 0
            ? `Avoid creating duplicates of these existing post concepts: ${existingPosts.join('; ')}.`
            : '';

        const targetPlatforms = overrides?.platforms?.length ? overrides.platforms : (campaign.platforms || ["Instagram", "LinkedIn"]);
        const focusContext = overrides?.focus ? `Main Focus / Theme for this week: "${overrides.focus}".` : '';

        const prompt = `
        You are a social media manager. Create a 7 - day content plan for the following campaign.

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
1. Generate 7 - 10 high - quality content * concepts * spread over 7 days(offsets 0 - 6).
        2. Each concept should be suitable for ONE OR MORE of the target platforms(list them in "platforms").
        3. Include a mix of formats(Posts, Reels / Shorts, Stories).
        4. "content" must be the actual caption / text ready to post, not just a flow.
        5. "imagePrompt" should describe a visual to accompany the text(NO text in image, just visual description).
        
        Return a JSON array of post drafts.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
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

export const generateSocialStrategyAI = async (idea: Idea): Promise<{
    goal: string;
    subGoal: string;
    targetAudience: string;
    pillar: string;
    platformNuances: string;
}> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                goal: { type: Type.STRING },
                subGoal: { type: Type.STRING },
                targetAudience: { type: Type.STRING },
                pillar: { type: Type.STRING },
                platformNuances: { type: Type.STRING }
            },
            required: ['goal', 'subGoal', 'targetAudience', 'pillar', 'platformNuances']
        };

        const prompt = `
        You are a Social Media Strategist. Define a high-level strategy for:
        "${idea.title}": ${idea.description}
        ${idea.keywords && idea.keywords.length > 0 ? `Contextual Keywords: ${idea.keywords.join(', ')}` : ''}

        Generate:
        1. **Goal**: A clear, measurable primary objective (e.g., Brand Awareness, Engagement).
        2. **Sub-Goal**: A complementary secondary objective (e.g., if Brand Awareness, maybe Community Building).
        3. **Target Audience**: Who is this for?
        4. **Brand Pillar**: Which content pillar does this fit (e.g., Educational, Promotional, Entertainment)?
        5. **Platform Nuances**: Tips for adapting this across various social platforms.
        
        Keep each field concise (1-2 sentences). Return JSON.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }), { ideaId: idea.id, projectId: idea.projectId, tenantId: idea.tenantId });

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Social Strategy Error:", error);
        throw error;
    }
};

export const generateSocialCreativeAI = async (idea: Idea, strategy: any): Promise<{
    hooks: string[];
    scenes: { title: string; visual: string; audio: string }[];
}> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                hooks: { type: Type.ARRAY, items: { type: Type.STRING } },
                scenes: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            visual: { type: Type.STRING },
                            audio: { type: Type.STRING }
                        },
                        required: ['title', 'visual', 'audio']
                    }
                }
            },
            required: ['hooks', 'scenes']
        };

        const prompt = `
        You are a Creative Director. Generate content flow concepts for:
    "${idea.title}"
Strategy: ${JSON.stringify(strategy)}

Generate:
1. ** Hooks **: 3 - 5 viral hooks to grab attention.
        2. ** Storyboard **: 3 - 4 scenes for a video / carousel breakdown. 
           Each scene needs a Title, Visual description, and Audio / Voicover suggestion.
           
        Return JSON.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.8,
            }
        }), { ideaId: idea.id, projectId: idea.projectId, tenantId: idea.tenantId });

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Social Creative Error:", error);
        throw error;
    }
};

export const refineSocialContentAI = async (content: string, platform: string, tone: string, customInstruction?: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const instructionPart = customInstruction ? `Additional Instruction: ${customInstruction}` : '';
        const prompt = `
        Refine the following social media content for better engagement.
        Target Platform: ${platform}
        Desired Tone: ${tone}
        ${instructionPart}
        
        Current Content:
"${content}"
        
        Output only the refined content.Do not include explanations.Ensure it feels native to ${platform}.
`;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { temperature: 0.7 }
        }));

        return response.text?.trim() || content;
    } catch (error) {
        console.error("Gemini Content Refine Error:", error);
        throw error;
    }
};

export const generateAudienceAlternativesAI = async (idea: Idea): Promise<string[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };

        const prompt = `
        Analyze the following campaign flow and perform a brief research to identify 3 high-potential, non-obvious target audience segments.
        Title: ${idea.title}
        Description: ${idea.description}
        
        Search for:
        - "Current trending demographics for [Topic]"
        - "Underserved niches interested in [Topic]"
        
        Return exactly 3 strings representing the audience descriptions. Include both demographics and psychographics.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.8,
                tools: [{ googleSearch: {} }]
            }
        }), { ideaId: idea.id, projectId: idea.projectId, tenantId: idea.tenantId });

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("Gemini Audience Alternatives Error:", error);
        throw error;
    }
};

export const expandStoryboardSceneAI = async (sceneTitle: string, visual: string, audio: string, tone: string): Promise<{ detailedVisual: string, detailedAudio: string }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                detailedVisual: { type: Type.STRING },
                detailedAudio: { type: Type.STRING }
            },
            required: ['detailedVisual', 'detailedAudio']
        };

        const prompt = `
        Expand the following storyboard scene into a detailed script.
        Scene Title: ${sceneTitle}
        Current Visual: ${visual}
        Current Audio: ${audio}
        Goal Tone: ${tone}
        
        Generate:
        1. **Detailed Visual**: A descriptive breakdown of what appears on screen, camera angles, and transitions.
        2. **Detailed Audio**: A word-for-word script or professional audio direction.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Scene Expansion Error:", error);
        throw error;
    }
};

export const generateSocialCTA_AI = async (content: string, platform: string, goal: string): Promise<string[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };

        const prompt = `
        Suggest 3 high-converting Call to Action (CTA) options for the following social media post.
        Platform: ${platform}
        Goal: ${goal}
        Content: "${content}"
        
        Return exactly 3 different CTA strings.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("Gemini CTA Suggestion Error:", error);
        throw error;
    }
};

export const scoreSocialContentAI = async (content: string, strategy: string): Promise<{ score: number, feedback: string }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                score: { type: Type.NUMBER },
                feedback: { type: Type.STRING }
            },
            required: ['score', 'feedback']
        };

        const prompt = `
        Score the following social media content (0-100) based on how well it aligns with the defined strategy.
        Strategy: ${strategy}
        Content: "${content}"
        
        Provide:
        1. **Score**: A number from 0 to 100.
        2. **Feedback**: A concise explanation (max 2 sentences) on how to improve alignment.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.5,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Content Scoring Error:", error);
        throw error;
    }
};

export const generateSocialPlaybookAI = async (idea: Idea, platforms: SocialPlatform[], scope: 'post' | 'campaign' = 'post', strategy?: { goal?: string, subGoal?: string, audience?: string }): Promise<Record<string, { play: string, tips: string[] }>> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: platforms.reduce((acc: any, p) => {
                acc[p] = {
                    type: Type.OBJECT,
                    properties: {
                        play: { type: Type.STRING },
                        tips: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['play', 'tips']
                };
                return acc;
            }, {}),
            required: platforms
        };

        const prompt = `
        Create a high-impact "Winning Play" for each social platform based on this flow.
        The scope of this project is a: ${scope === 'post' ? 'Single Post (spread across platforms)' : 'Full Multi-Post Campaign'}.
        
        Title: ${idea.title}
        Description: ${idea.description}
        Goals: ${strategy?.goal || idea.campaignType || 'Engagement'} ${strategy?.subGoal ? ` & ${strategy.subGoal}` : ''}
        Target Audience: ${strategy?.audience || idea.targetAudience || 'General Audience'}
        ${idea.keywords && idea.keywords.length > 0 ? `Contextual Keywords: ${idea.keywords.join(', ')}` : ''}
        
        For each platform (${platforms.join(", ")}):
        1. **Play**: A catchy title for the content strategy (e.g., "The Educational Carousel", "The Behind-the-Scenes Reel").
        2. **Tips**: 3 actionable, platform-specific tips to make this content go viral.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.8,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Playbook Error:", error);
        throw error;
    }
};

export const generatePlatformConceptsAI = async (
    idea: Idea,
    strategy: any,
    tone: string
): Promise<Record<string, { hook: string; contentBody: string; visualCue: string; format: string }>> => {
    try {
        const ai = getAiClient();
        const platforms = strategy.channels as string[] || [];

        // Dynamic schema based on selected platforms
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: platforms.reduce((acc: any, p) => {
                acc[p] = {
                    type: Type.OBJECT,
                    properties: {
                        hook: { type: Type.STRING },
                        contentBody: { type: Type.STRING },
                        visualCue: { type: Type.STRING },
                        format: { type: Type.STRING } // e.g., 'Reel', 'Carousel', 'Thread'
                    },
                    required: ['hook', 'contentBody', 'visualCue', 'format']
                };
                return acc;
            }, {}),
            required: platforms
        };

        const prompt = `
        You are a generic Social Media Content Creator.
        Transform the strategic "Winning Plays" into concrete content concepts for each platform.
        
        Project: "${idea.title}"
        Description: ${idea.description}
        Tone: ${tone}
        Strategy: ${JSON.stringify(strategy)}
        
        For each platform (${platforms.join(', ')}):
        1. **Format**: Reconfirm the best format (e.g. Reel, Carousel, Text Post).
        2. **Hook**: Write a specific, attention-grabbing opening line or visual text hook (3-sec rule).
        3. **ContentBody**: A brief outline of the value proposition or main content (bullet points).
        4. **VisualCue**: A one-sentence direction for the visual style or key shot.
        
        Ensure the content perfectly matches the "Winning Play" described in the strategy for that platform.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.85, // Higher creativity
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Platform Concepts Error:", error);
        throw error;
    }
};
// ... existing code ...

export const refineCampaignConceptAI = async (
    currentIdea: string,
    feedback: string,
    context: any
): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `
        You are a Senior Creative Strategist. Refine the following Campaign Core Flow based on user feedback.
        
        Current Core Flow: "${currentIdea}"
        User Feedback/Instruction: "${feedback}"
        Campaign Context: ${JSON.stringify(context)}
        
        Provide a refined, more impactful version of the Core Flow. Keep it to max 3 sentences.
        Return ONLY the refined text.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { temperature: 0.8 }
        }));

        return response.text || currentIdea;
    } catch (error) {
        console.error("Gemini Concept Refinement Error:", error);
        throw error;
    }
};

export const generateCampaignHooksAI = async (
    bigIdea: string,
    themes: string[]
): Promise<string[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };

        const prompt = `
        You are a Copywriter specialized in viral social hooks.
        Generate 5 high-converting, punchy campaign hooks/taglines based on this Core Flow and Themes.
        
        Core Flow: "${bigIdea}"
        Themes: ${themes.join(', ')}
        
        Return exactly 5 unique options.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.9,
            }
        }));

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("Gemini Hook Generation Error:", error);
        throw error;
    }
};

export const optimizeCampaignTimelineAI = async (
    phases: any[],
    goal: string,
    bigIdea: string
): Promise<{ name: string; duration: string; focus: string }[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    focus: { type: Type.STRING }
                },
                required: ['name', 'duration', 'focus']
            }
        };

        const prompt = `
        You are a Campaign Growth Strategist. Review and optimize these campaign phases to maximize ROI for the goal "${goal}".
        
        Campaign Flow: "${bigIdea}"
        Current Phases: ${JSON.stringify(phases)}
        
        Improve the phase names, suggest better durations, and refine the focus for each to create a high-performance rollout.
        Keep the number of phases relative to the input (usually 3-4).
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
            }
        }));

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("Gemini Timeline Optimization Error:", error);
        throw error;
    }
};


export const generateSocialCampaignConceptAI = async (idea: Idea): Promise<{
    bigIdea: string;
    hook: string;
    themes: string[];
    mood: string;
    visualDirection: string;
}> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                bigIdea: { type: Type.STRING },
                hook: { type: Type.STRING },
                themes: { type: Type.ARRAY, items: { type: Type.STRING } },
                mood: { type: Type.STRING },
                visualDirection: { type: Type.STRING }
            },
            required: ['bigIdea', 'hook', 'themes', 'mood', 'visualDirection']
        };

        const prompt = `
        You are a Creative Director at a top-tier Social Media Agency.
        Develop a creative campaign concept for the following project:

        Title: ${idea.title}
        Description: ${idea.description}

        Generate:
        1. Core Flow (bigIdea): A compelling, creative core concept for a social media campaign (max 2 sentences).
        2. Hook: A catchy, one-sentence elevator pitch or tagline.
        3. Themes: 3-4 content pillars or themes that support the core flow (short phrases).
        4. Mood: A single word describing the vibe (e.g., "Energetic", "Authentic", "Luxurious").
        5. Visual Direction: A concise description of the aesthetic and production style (max 2 sentences).

        Be creative, specific, and trend-aware.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.8,
            }
        }), { ideaId: idea.id, projectId: idea.projectId, tenantId: idea.tenantId });

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Social Campaign Concept Error:", error);
        throw error;
    }
};

export const generateSocialCampaignStrategyAI = async (
    idea: Idea,
    conceptData?: any,
    enabledPlatforms?: SocialPlatform[],
    customInstructions?: string,
    brandSettings?: { preferredTone?: string; brandPillars?: string }
): Promise<{
    phases: { name: string; duration: string; focus: string }[];
    platforms: { id: string; role: string; frequency: string }[];
    kpis: { metric: string; target: string }[];
    audienceSegments: string[];
    campaignType?: string;
    subGoal?: string;
    pillar?: string;
}> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                phases: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            duration: { type: Type.STRING },
                            focus: { type: Type.STRING }
                        },
                        required: ['name', 'duration', 'focus']
                    }
                },
                platforms: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            role: { type: Type.STRING },
                            frequency: { type: Type.STRING },
                            phaseFrequencies: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        phaseName: { type: Type.STRING },
                                        frequency: { type: Type.STRING }
                                    },
                                    required: ['phaseName', 'frequency']
                                }
                            }
                        },
                        required: ['id', 'role', 'frequency']
                    }
                },
                kpis: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            metric: { type: Type.STRING },
                            target: { type: Type.STRING }
                        },
                        required: ['metric', 'target']
                    }
                },
                audienceSegments: { type: Type.ARRAY, items: { type: Type.STRING } },
                campaignType: { type: Type.STRING },
                subGoal: { type: Type.STRING },
                pillar: { type: Type.STRING }
            },
            required: ['phases', 'platforms', 'kpis', 'audienceSegments', 'campaignType']
        };

        // Build rich context from concept data
        const conceptContext = conceptData ? `
        === CAMPAIGN CREATIVE CONCEPT ===
        Core Flow: "${conceptData.bigIdea || 'Not defined'}"
        Hook/Tagline: "${conceptData.hook || 'Not defined'}"
        Content Themes: ${Array.isArray(conceptData.themes) ? conceptData.themes.join(', ') : 'Not defined'}
        Mood/Vibe: "${conceptData.mood || 'Not defined'}"
        Visual Direction: "${conceptData.visualDirection || 'Not defined'}"
        ` : '';

        const swotContext = idea.analysis ? `
        === SWOT ANALYSIS ===
        Strengths: ${idea.analysis.strengths.join(', ') || 'N/A'}
        Weaknesses: ${idea.analysis.weaknesses.join(', ') || 'N/A'}
        Opportunities: ${idea.analysis.opportunities.join(', ') || 'N/A'}
        Threats: ${idea.analysis.threats.join(', ') || 'N/A'}
        ` : '';

        const keywordsContext = idea.keywords && idea.keywords.length > 0
            ? `=== CORE KEYWORDS ===\n${idea.keywords.join(', ')}`
            : '';

        const brandContext = brandSettings ? `
        === BRAND IDENTITY ===
        Tone: ${brandSettings.preferredTone || 'Professional & Engaging'}
        Pillars/Values: ${brandSettings.brandPillars || 'Expertise, Quality, Innovation'}
        ` : '';

        // Platforms the user has enabled
        const availablePlatforms = enabledPlatforms && enabledPlatforms.length > 0
            ? enabledPlatforms
            : ['Instagram', 'Facebook', 'TikTok', 'X', 'YouTube Video', 'YouTube Shorts'];

        const platformsList = availablePlatforms.join(', ');

        const instructionContext = customInstructions ? `
        === SPECIAL INSTRUCTIONS ===
        The user has provided specific requirements for this strategy:
        "${customInstructions}"
        Please ensure these instructions are prioritized in your generation.
        ` : '';

        const prompt = `
        You are a Senior Social Media Strategist at a leading digital marketing agency.
        Create a comprehensive, realistic, and actionable campaign execution strategy.

        === CAMPAIGN OVERVIEW ===
        Campaign Title: "${idea.title}"
        Campaign Description: ${idea.description}
        ${brandContext}
        ${conceptContext}
        ${swotContext}
        ${keywordsContext}

        === AVAILABLE PLATFORMS ===
        You may ONLY use these platforms (user's enabled channels): ${platformsList}
        
        ${instructionContext}

        === RESEARCH TASK (MANDATORY) ===
        Before recommending frequencies, you MUST use the Google Search tool to research:
        
        1. **Niche-Specific Best Practices**: Search for "optimal posting frequency for [campaign topic/niche] ${new Date().getFullYear()}"
        2. **Platform Algorithm Trends**: Search for "[platform name] algorithm best practices ${new Date().getFullYear()}"
        3. **Campaign Type Cadence**: Search for "[campaign goal] campaign posting schedule recommendations"
        
        Use your research findings to determine realistic, topic-appropriate frequencies. Different campaigns require different approaches:
        - A product launch may need high-intensity bursts
        - A brand awareness campaign may favor consistent, moderate frequency
        - An educational series may work best with weekly scheduled content
        - A viral/trend-based campaign may require daily or multiple daily posts

        === MULTI-FORMAT PLATFORM CONSIDERATIONS ===
        Remember that some platforms support MULTIPLE content formats, allowing for higher total frequency:
        
        **Instagram**: Can combine Posts + Reels + Stories (e.g., 2 Posts/week + 3 Reels/week + daily Stories)
        **YouTube**: Distinguish between long-form Videos (high production, 1-2/week max) and Shorts (quick content, can be daily)
        **Facebook**: Mix of Posts, Reels, Stories, and Live content
        **TikTok**: Primary format is short video, high frequency often rewarded by algorithm
        **X**: Tweets, Threads, Spaces - higher volume typically acceptable
        **LinkedIn**: Professional posts, articles, document carousels - quality over quantity
        
        When recommending frequency, specify the FORMAT mix in the "role" field if using multiple formats.

        === YOUR TASK ===
        Generate a complete rollout strategy:

        1. **PHASES** (3-4 phases):
           - Create a logical campaign arc appropriate for this specific campaign type
           - Duration: specific and realistic based on your research (e.g., "5 days", "2 weeks", "10 days")
           - Focus: describe key activities for each phase

        2. **PLATFORMS** (2-4 from available):
           - Select platforms that make strategic sense FOR THIS SPECIFIC CAMPAIGN TOPIC
           - "role": Explain the strategic purpose AND format strategy (e.g., "Primary engagement driver via Reels (3/week) + Stories (daily) + 1 Carousel/week")
           - "frequency": Your researched recommendation in format "X Posts/Week" or "X Posts/Day"
             - Base this on your research, NOT on generic guidelines
             - Consider the campaign topic, audience behavior, and platform algorithms
           - **phaseFrequencies**: Provide overrides for each phase based on campaign intensity
             - Teaser phases typically have lower frequency
             - Launch/Peak phases may spike to 2-3x normal
             - Sustaining phases return to sustainable cadence
             - Match "phaseName" EXACTLY to phase names you generate

        3. **KPIs** (4-5 metrics):
           - Mix awareness, engagement, conversion metrics
           - Specific, realistic targets based on campaign scope

        4. **AUDIENCE SEGMENTS** (3-4 segments):
           - Specific personas with demographics AND psychographics
           - Tailored to this campaign's topic and goals

        5. **CAMPAIGN OBJECTIVES** (select the most appropriate):
           - "campaignType": Choose ONE primary goal from: "Brand Awareness", "Engagement", "Traffic / Link", "Sales / Promo", "Community Building", "Education"
           - "subGoal": Choose ONE secondary goal (different from campaignType) from the same list, or leave empty
           - "pillar": Choose ONE content pillar from: "Educational", "Promotional", "Entertainment", "Inspirational", "Community", "Behind the Scenes"
           - Base your selections on the campaign description, concept, and what makes strategic sense

        IMPORTANT: Your frequency recommendations must be:
        - Grounded in your research findings
        - Appropriate for the specific campaign topic (not generic)
        - Realistic for the content production requirements
        - Aligned with current platform algorithm preferences
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.7,
                tools: [{ googleSearch: {} }]
            }
        }), { ideaId: idea.id, projectId: idea.projectId, tenantId: idea.tenantId });

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini Campaign Strategy Error:", error);
        throw error;
    }
};

// ==========================================
// CAMPAIGN PLANNING AI FUNCTIONS
// ==========================================

export interface PostPlaceholder {
    id: string;
    dayOffset: number;
    platforms: string[];
    contentType: 'Reel' | 'Story' | 'Post' | 'Carousel' | 'Short' | 'Video';
    phaseId?: string;
    hook?: string;
    visualDirection?: string;
    status: 'empty' | 'outlined' | 'ready';
}

export const generateCampaignWeekPlanAI = async (
    idea: Idea,
    strategyData: {
        phases?: { id: string; name: string; durationValue: number; durationUnit: string; focus: string }[];
        platforms?: {
            id: string;
            role: string;
            frequencyValue?: number;
            frequencyUnit?: string;
            phaseFrequencies?: { phaseId: string; frequencyValue?: number; frequencyUnit: string }[];
        }[];
        audienceSegments?: string[];
        campaignType?: string;
        totalDays?: number;
        totalWeeks?: number;
        targetPosts?: number;
        platformFrequencies?: { platform: string; postsPerWeek: number; totalPosts: number }[];
        phaseRanges?: { name: string; startDay: number; endDay: number; focus: string }[];
    },
    weekOffset: number = 0
): Promise<PostPlaceholder[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    dayOffset: { type: Type.INTEGER },
                    platforms: { type: Type.ARRAY, items: { type: Type.STRING } },
                    contentType: { type: Type.STRING },
                    phaseId: { type: Type.STRING },
                    hook: { type: Type.STRING },
                    visualDirection: { type: Type.STRING },
                    status: { type: Type.STRING }
                },
                required: ['id', 'dayOffset', 'platforms', 'contentType', 'hook', 'status']
            }
        };

        // Build platform frequency context with explicit targets
        const platformFrequencies = strategyData.platforms?.map(p => {
            if (p.phaseFrequencies && p.phaseFrequencies.length > 0) {
                // Format phase frequencies
                const details = p.phaseFrequencies.map(pf => {
                    const phaseName = strategyData.phases?.find(ph => ph.id === pf.phaseId)?.name || 'Unknown Phase';
                    return `${phaseName}: ${pf.frequencyValue} ${pf.frequencyUnit}`;
                }).join(', ');
                return `${p.id}: [Phase Specific] ${details}`;
            } else {
                const freq = p.frequencyValue || 3;
                const unit = p.frequencyUnit || 'Posts/Week';
                return `${p.id}: ${freq} ${unit}`;
            }
        }).join('\n') || 'No frequencies set';

        // Build phase ranges context
        const phaseRangesContext = strategyData.phaseRanges?.map(r =>
            `"${r.name}" (Days ${r.startDay + 1}-${r.endDay + 1}): ${r.focus}`
        ).join('\n') || strategyData.phases?.map((p, i) => `Phase ${i + 1}: "${p.name}" - ${p.focus}`).join('\n') || 'No phases defined';

        const audienceContext = strategyData.audienceSegments?.join(', ') || 'General audience';
        const totalDays = strategyData.totalDays || 14;
        const targetPosts = strategyData.targetPosts || 10;

        const prompt = `
        You are a Social Media Content Planner. Generate post placeholders for an ENTIRE campaign based on the strategy settings.
        
        === CAMPAIGN CONTEXT ===
        Campaign: "${idea.title}"
        Description: ${idea.description}
        Goal: ${strategyData.campaignType || 'Engagement'}
        Target Audience: ${audienceContext}
        
        === CAMPAIGN DURATION ===
        Total Campaign Length: ${totalDays} days (Days 1 to ${totalDays})
        Target Total Posts: ${targetPosts} posts
        
        === TIMELINE & PHASES ===
        ${phaseRangesContext}
        
        === FREQUENCIES (CRITICAL) ===
        ${platformFrequencies}
        
        === EXECUTION PLAN ===
        You must generate a schedule that distributes exactly ${targetPosts} posts.
        
        **ALGORITHM TO FOLLOW:**
        1. **Map the Calendar**: For each of the ${totalDays} days, determine which Phase it falls into.
        2. **Check Frequency**: For that day/phase, check the "PLATFORM POSTING FREQUENCY" rules.
           - If it says "Daily" -> You MUST schedule a post.
           - If it says "3 Posts/Week" -> Check if you need a post to maintain that average.
        3. **Distribute**: Ensure posts are not bunched up. If frequency is "3/Week", spread them (Mon/Wed/Fri logic).
        4. **YouTube Video vs Shorts (CRITICAL)**:
           - "YouTube Video" = Long-form content. Use contentType: "Video", platform: "YouTube Video"
           - "YouTube Shorts" = Short-form vertical content. Use contentType: "Short", platform: "YouTube Shorts"
           - These are SEPARATE platforms with DIFFERENT frequencies. Check the strategy to see which are enabled.
           - If both are enabled: YouTube Video posts should be LOW frequency (1-2/week), YouTube Shorts should be HIGHER frequency
           - For every YouTube Video planned, consider adding a YouTube Shorts teaser on the same or following day
        
        **JSON OUTPUT REQUIREMENTS:**
        Return an ARRAY of Post objects.
        1. "dayOffset": INTEGER (0 to ${totalDays - 1}). 0 is the first day.
        2. "platforms": Array of STRINGS. Use the EXACT platform names from strategy:
           - Available: ${strategyData.platforms?.map(p => p.id).join(', ')}.
           - For YouTube content, use EXACTLY "YouTube Video" or "YouTube Shorts" as specified in the strategy.
        3. "contentType": MUST match the platform's valid formats:
           
           === PLATFORM FORMAT RULES (MANDATORY) ===
           | Platform       | Valid Formats                    |
           |----------------|----------------------------------|
           | Instagram      | "Post", "Story", "Reel"          |
           | Facebook       | "Text", "Post", "Reel", "Story"  |
           | LinkedIn       | "Text", "Post", "Carousel"       |
           | TikTok         | "Video"                          |
           | X              | "Text", "Post"                   |
           | YouTube Video  | "Video" (ONLY)                   |
           | YouTube Shorts | "Short" (ONLY)                   |
           
           You MUST use only the formats listed above for each platform.
           If a post has multiple platforms, pick a format that works for all OR create separate posts.
           
        4. "phaseId": STRING. The name of the phase matching the dayOffset.
        5. "hook": STRING. 1-2 sentences. Specific to the phase focus.
        6. "status": "outlined".
        
        **CRITICAL RULES:**
        - DO NOT generate more than ${targetPosts + 5} posts.
        - DO NOT generate fewer than ${Math.max(1, targetPosts - 2)} posts.
        - dayOffset MUST be < ${totalDays}.
        - Start posting on dayOffset 0 or 1.
        - Use EXACT platform names from the strategy ("YouTube Video" not just "YouTube").
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.8,
            }
        }));

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("Gemini Campaign Plan Error:", error);
        throw error;
    }
};


export const suggestOptimalScheduleAI = async (
    platforms: string[],
    targetAudience: string,
    timezone?: string
): Promise<{ platform: string; bestTimes: string[]; rationale: string }[]> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    platform: { type: Type.STRING },
                    bestTimes: { type: Type.ARRAY, items: { type: Type.STRING } },
                    rationale: { type: Type.STRING }
                },
                required: ['platform', 'bestTimes', 'rationale']
            }
        };

        const prompt = `
        You are a Social Media Analytics Expert. Suggest optimal posting times for each platform.
        
        === CONTEXT ===
        Platforms: ${platforms.join(', ')}
        Target Audience: ${targetAudience}
        Timezone: ${timezone || 'User timezone (general recommendations)'}
        
        === TASK ===
        For each platform, provide:
        1. "platform": The platform name
        2. "bestTimes": Array of 2-3 optimal posting times (e.g., "9:00 AM", "1:00 PM", "7:00 PM")
        3. "rationale": A brief explanation of why these times work best for this audience (1-2 sentences)
        
        Consider:
        - Platform-specific peak usage times
        - Target audience behavior patterns
        - Content consumption habits
        - Weekday vs. weekend differences
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.6,
            }
        }));

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("Gemini Schedule Suggestion Error:", error);
        throw error;
    }
};

export const analyzeContentMixAI = async (
    posts: PostPlaceholder[],
    strategyData: { platforms?: { id: string }[]; campaignType?: string }
): Promise<{
    analysis: { category: string; current: number; recommended: number; status: 'good' | 'low' | 'high' }[];
    suggestions: string[];
}> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                analysis: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING },
                            current: { type: Type.INTEGER },
                            recommended: { type: Type.INTEGER },
                            status: { type: Type.STRING }
                        },
                        required: ['category', 'current', 'recommended', 'status']
                    }
                },
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['analysis', 'suggestions']
        };

        const postsSummary = posts.map(p => `${p.contentType} on ${p.platforms.join(', ')}`).join('; ');
        const platformsList = strategyData.platforms?.map(p => p.id).join(', ') || 'Multiple platforms';

        const prompt = `
        You are a Content Strategy Analyst. Analyze the content mix and provide recommendations.
        
        === CURRENT CONTENT PLAN ===
        Posts: ${postsSummary || 'No posts planned yet'}
        Total Posts: ${posts.length}
        Platforms: ${platformsList}
        Campaign Goal: ${strategyData.campaignType || 'Engagement'}
        
        === TASK ===
        Analyze the content mix across these dimensions:
        
        1. "analysis": Array of categories with current vs. recommended counts
           Categories to analyze:
           - "Reels/Shorts" (video content)
           - "Carousels" (educational swipe content)
           - "Static Posts" (single image/text posts)
           - "Stories" (ephemeral content)
           
           For each:
           - "category": The content type
           - "current": Number of posts of this type
           - "recommended": Optimal number for the campaign goal
           - "status": "good" if balanced, "low" if underrepresented, "high" if overrepresented
        
        2. "suggestions": 2-4 actionable suggestions to improve the content mix
        
        Consider the campaign goal when making recommendations (e.g., Reels for engagement, Carousels for education).
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.5,
            }
        }));

        return JSON.parse(response.text || '{"analysis":[],"suggestions":[]}');
    } catch (error) {
        console.error("Gemini Content Mix Analysis Error:", error);
        throw error;
    }
};

export const generatePaidAdsRiskAnalysis = async (
    campaignDetails: string
): Promise<{ wins: string[]; risks: string[]; score: number }> => {
    try {
        const ai = getAiClient();
        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                wins: { type: Type.ARRAY, items: { type: Type.STRING } },
                risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                score: { type: Type.NUMBER }
            },
            required: ['wins', 'risks', 'score']
        };

        const prompt = `
        Analyze the following ad campaign for potential Wins and Risks.
        Campaign Details:
        ${campaignDetails}

        Provide:
        1. Wins: 3 key strengths or reasons why this campaign will succeed.
        2. Risks: 3 potential pitfalls or things to watch out for.
        3. Score: A predicted success probability score from 0-100.
        `;

        const response = await runWithTokenCheck((ai) => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.6,
            }
        }));

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Gemini risk win analysis error:", error);
        return { wins: [], risks: [], score: 50 };
    }
};
