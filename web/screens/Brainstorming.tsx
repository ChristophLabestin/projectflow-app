import React, { useEffect, useMemo, useRef, useState } from 'react';
import { chatWithCora, generateProjectBlueprint } from '../services/geminiService';
import { fetchAiStudioChats, saveAiStudioChat } from '../services/aiStudioService';
import { getAllWorkspaceProjects } from '../services/dataService';
import { getActiveTenantId } from '../services/domain/authService';
import { getTenant } from '../services/domain/workspaceService';
import { ProjectBlueprint, StudioChatSession, StudioMessage, StudioTool } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';
import { Button } from '../components/common/Button/Button';
import { Select } from '../components/common/Select/Select';
import { TextArea } from '../components/common/Input/TextArea';
import { BlueprintResult } from '../components/studio/BlueprintResult';
import './brainstorming.scss';

type Tenant = {
    id: string;
    name?: string;
    description?: string;
};

type TenantContext = {
    name?: string;
    description?: string;
    projects?: string[];
    projectCount?: number;
};

type ModelOption = {
    label: string;
    value: 'gemini-3-flash-preview' | 'gemini-3-pro-preview';
};

const renderMarkdownContent = (text: string) => {
    if (!text) return null;

    const cleanedText = text.replace(/\n{3,}/g, '\n\n').trim();
    const lines = cleanedText.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushList = (keySeed: string) => {
        if (listItems.length === 0 || !listType) return;
        const list = listType === 'ul' ? (
            <ul key={`list-${keySeed}`} className="ai-studio__markdown-list">
                {listItems}
            </ul>
        ) : (
            <ol key={`list-${keySeed}`} className="ai-studio__markdown-list">
                {listItems}
            </ol>
        );
        elements.push(list);
        listItems = [];
        listType = null;
    };

    const parseInline = (line: string) => {
        const parts = line.split(/(\*\*.*?\*\*|`[^`]+`|https?:\/\/\S+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={`code-${index}`}>{part.slice(1, -1)}</code>;
            }
            if (/^https?:\/\//.test(part)) {
                return (
                    <a key={`link-${index}`} href={part} target="_blank" rel="noreferrer">
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('```')) {
            if (!inCodeBlock) {
                flushList(`code-open-${index}`);
                inCodeBlock = true;
                codeLines = [];
            } else {
                elements.push(
                    <pre key={`code-${index}`} className="ai-studio__markdown-code">
                        <code>{codeLines.join('\n')}</code>
                    </pre>
                );
                inCodeBlock = false;
                codeLines = [];
            }
            return;
        }

        if (inCodeBlock) {
            codeLines.push(line);
            return;
        }

        if (!trimmedLine) {
            flushList(`space-${index}`);
            elements.push(<div key={`space-${index}`} className="ai-studio__markdown-space" />);
            return;
        }

        if (trimmedLine.startsWith('# ')) {
            flushList(`h1-${index}`);
            elements.push(
                <h3 key={`h1-${index}`} className="ai-studio__markdown-heading">
                    {parseInline(trimmedLine.replace('# ', ''))}
                </h3>
            );
            return;
        }

        if (trimmedLine.startsWith('## ') || trimmedLine.startsWith('### ')) {
            flushList(`h2-${index}`);
            elements.push(
                <h4 key={`h2-${index}`} className="ai-studio__markdown-subheading">
                    {parseInline(trimmedLine.replace(/^##\s|^###\s/, ''))}
                </h4>
            );
            return;
        }

        if (/^\d+\.\s/.test(trimmedLine)) {
            const content = trimmedLine.replace(/^\d+\.\s/, '');
            if (listType !== 'ol') {
                flushList(`ol-${index}`);
                listType = 'ol';
            }
            listItems.push(
                <li key={`ol-item-${index}`} className="ai-studio__markdown-item">
                    {parseInline(content)}
                </li>
            );
            return;
        }

        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            const content = trimmedLine.replace(/^[-*]\s/, '');
            if (listType !== 'ul') {
                flushList(`ul-${index}`);
                listType = 'ul';
            }
            listItems.push(
                <li key={`ul-item-${index}`} className="ai-studio__markdown-item">
                    {parseInline(content)}
                </li>
            );
            return;
        }

        flushList(`p-${index}`);
        elements.push(
            <p key={`p-${index}`} className="ai-studio__markdown-paragraph">
                {parseInline(trimmedLine)}
            </p>
        );
    });

    if (inCodeBlock && codeLines.length > 0) {
        elements.push(
            <pre key="code-end" className="ai-studio__markdown-code">
                <code>{codeLines.join('\n')}</code>
            </pre>
        );
    }

    flushList('end');

    return elements;
};

const MODE_OPTIONS: { id: StudioTool; icon: string; labelKey: string; descriptionKey: string }[] = [
    {
        id: 'Architect',
        icon: 'architecture',
        labelKey: 'aiStudio.tools.architect.label',
        descriptionKey: 'aiStudio.tools.architect.description'
    },
    {
        id: 'Brainstormer',
        icon: 'lightbulb',
        labelKey: 'aiStudio.tools.brainstormer.label',
        descriptionKey: 'aiStudio.tools.brainstormer.description'
    },
    {
        id: 'RiskScout',
        icon: 'shield',
        labelKey: 'aiStudio.tools.riskscout.label',
        descriptionKey: 'aiStudio.tools.riskscout.description'
    }
];

export const Brainstorming = () => {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [sessions, setSessions] = useState<StudioChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [activeMode, setActiveMode] = useState<StudioTool | null>(null);
    const [useSearch, setUseSearch] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
    const [selectedModel, setSelectedModel] = useState<ModelOption['value']>('gemini-3-flash-preview');
    const [blueprint, setBlueprint] = useState<ProjectBlueprint | null>(null);
    const [isConvertingBlueprint, setIsConvertingBlueprint] = useState(false);
    const [isCanvasMode, setIsCanvasMode] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const modeOptions = useMemo(() => MODE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.labelKey),
        description: t(option.descriptionKey)
    })), [t]);

    const modeLabels = useMemo(() => modeOptions.reduce((acc, option) => {
        acc[option.id] = option.label;
        return acc;
    }, {} as Record<StudioTool, string>), [modeOptions]);

    const modelOptions = useMemo<ModelOption[]>(() => ([
        {
            label: t('aiStudio.chat.model.flash'),
            value: 'gemini-3-flash-preview'
        },
        {
            label: t('aiStudio.chat.model.pro'),
            value: 'gemini-3-pro-preview'
        }
    ]), [t]);

    const activeModelLabel = modelOptions.find(option => option.value === selectedModel)?.label
        || t('aiStudio.chat.model.flash');

    const activeSession = useMemo(
        () => sessions.find((session) => session.id === activeSessionId) || null,
        [sessions, activeSessionId]
    );

    const messages = activeSession?.messages ?? [];

    const tenantLabel = useMemo(() => {
        if (tenantContext?.name) {
            return t('aiStudio.chat.contextLabel').replace('{name}', tenantContext.name);
        }
        return '';
    }, [tenantContext?.name, t]);

    const emptyHistory = t('aiStudio.chat.noHistory');

    const storageKey = useMemo(() => {
        const tenantId = getActiveTenantId();
        return `pf-ai-studio-chats-${tenantId || 'default'}`;
    }, []);

    const resolveSessionMode = (session: StudioChatSession) => {
        if (session.mode) return session.mode;
        for (let i = session.messages.length - 1; i >= 0; i -= 1) {
            const mode = session.messages[i].mode;
            if (mode) return mode;
        }
        return null;
    };

    const persistSession = (session: StudioChatSession) => {
        if (!user) return;
        saveAiStudioChat(session, getActiveTenantId()).catch((error) => {
            console.warn('Failed to persist AI Studio chat session', error);
        });
    };

    const getSessionTitle = (text: string) => {
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (!normalized) return t('aiStudio.chat.newSessionTitle');
        return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
    };

    const createSession = (seedTitle?: string, initialMessages: StudioMessage[] = []) => {
        const now = Date.now();
        const session: StudioChatSession = {
            id: `chat-${now}`,
            title: seedTitle ? getSessionTitle(seedTitle) : t('aiStudio.chat.newSessionTitle'),
            messages: initialMessages,
            createdAt: now,
            updatedAt: now,
            mode: activeMode,
            blueprint: null
        };
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        persistSession(session);
        return session.id;
    };

    const updateSession = (sessionId: string, updater: (session: StudioChatSession) => StudioChatSession) => {
        setSessions((prev) => {
            let nextSession: StudioChatSession | null = null;
            const next = prev.map((session) => {
                if (session.id !== sessionId) return session;
                nextSession = updater(session);
                return nextSession;
            });
            if (nextSession) {
                persistSession(nextSession);
            }
            return next;
        });
    };

    useEffect(() => {
        if (!user) {
            setSessions([]);
            setActiveSessionId(null);
            setActiveMode(null);
            setBlueprint(null);
            setIsCanvasMode(false);
            return;
        }

        let isMounted = true;

        const loadSessions = async () => {
            try {
                const fetchedSessions = await fetchAiStudioChats(getActiveTenantId());
                if (!isMounted) return;
                setSessions(fetchedSessions);
            } catch (error) {
                console.warn('Failed to load AI Studio chat sessions', error);
            }
        };

        loadSessions();

        return () => {
            isMounted = false;
        };
    }, [user]);

    const abortControllerRef = useRef<AbortController | null>(null);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsSending(false);
    };

    const handleSend = async () => {
        const trimmed = draft.trim();
        if (!trimmed || isSending) return;

        const userMessage: StudioMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
            mode: activeMode
        };

        setDraft('');
        setIsSending(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        let currentSessionId = activeSessionId;
        let nextMessages: StudioMessage[] = [];

        if (!currentSessionId) {
            // Use unified helper to create session with message
            currentSessionId = createSession(trimmed, [userMessage]);
            nextMessages = [userMessage];
        } else {
            // Update existing session
            nextMessages = [...messages, userMessage];
            updateSession(currentSessionId, (session) => ({
                ...session,
                title: session.title === t('aiStudio.chat.newSessionTitle') ? getSessionTitle(trimmed) : session.title,
                messages: nextMessages,
                updatedAt: Date.now(),
                mode: activeMode ?? session.mode ?? null
            }));
        }

        try {
            if (controller.signal.aborted) return;

            const resolvedContext = tenantContext || await (async () => {
                const tenantId = getActiveTenantId();
                if (!tenantId) return null;
                try {
                    const [tenant, projects] = await Promise.all([
                        getTenant(tenantId) as Promise<Tenant | null>,
                        getAllWorkspaceProjects(tenantId)
                    ]);
                    const projectSummaries = projects
                        .slice(0, 12)
                        .map((project) => {
                            const details = [
                                project.status ? `Status: ${project.status}` : null,
                                project.priority ? `Priority: ${project.priority}` : null
                            ].filter(Boolean).join(', ');
                            const description = project.description ? ` - ${project.description}` : '';
                            return `${project.title}${description}${details ? ` (${details})` : ''}`;
                        });
                    const context = {
                        name: tenant?.name,
                        description: tenant?.description,
                        projects: projectSummaries,
                        projectCount: projects.length
                    };
                    setTenantContext(context);
                    return context;
                } catch (error) {
                    console.warn('Failed to refresh CORA context', error);
                    return null;
                }
            })();

            if (controller.signal.aborted) return;

            // CANVAS MODE REFINEMENT: Intelligently update the existing blueprint
            if (isCanvasMode && blueprint) {
                // Create a context-rich prompt with the current blueprint
                const refinementPrompt = `
You are refining an existing project blueprint. The user wants to modify a specific part.

CURRENT BLUEPRINT:
- Title: ${blueprint.title}
- Description: ${blueprint.description}
- Target Audience: ${blueprint.targetAudience}
- Milestones: ${blueprint.milestones.map(m => `${m.title}: ${m.description}`).join('; ')}
- Initial Tasks: ${blueprint.initialTasks.map(t => `${t.title} (${t.priority})`).join('; ')}
- Tech Stack: ${blueprint.suggestedTechStack?.join(', ') || 'None specified'}

USER REQUEST: "${trimmed}"

INSTRUCTIONS:
1. Analyze what part of the blueprint the user wants to change (milestones, tasks, description, tech stack, etc.)
2. Return ONLY the updated fields as JSON in this exact format:
{
  "updatedFields": ["field1", "field2"],
  "title": "only if changed",
  "description": "only if changed",
  "targetAudience": "only if changed",
  "milestones": [{"title": "...", "description": "..."}],
  "initialTasks": [{"title": "...", "priority": "High/Medium/Low"}],
  "suggestedTechStack": ["tech1", "tech2"]
}

Only include fields that need to be updated. Be intelligent about what to change based on the user's request.
`;

                const response = await chatWithCora(
                    [{ role: 'user', content: refinementPrompt }],
                    { model: 'gemini-3-flash-preview' }
                );

                if (controller.signal.aborted) return;

                // Try to parse the JSON response and update blueprint
                try {
                    const jsonMatch = response.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const updates = JSON.parse(jsonMatch[0]);
                        const updatedBlueprint = { ...blueprint };

                        if (updates.title) updatedBlueprint.title = updates.title;
                        if (updates.description) updatedBlueprint.description = updates.description;
                        if (updates.targetAudience) updatedBlueprint.targetAudience = updates.targetAudience;
                        if (updates.milestones) updatedBlueprint.milestones = updates.milestones;
                        if (updates.initialTasks) updatedBlueprint.initialTasks = updates.initialTasks;
                        if (updates.suggestedTechStack) updatedBlueprint.suggestedTechStack = updates.suggestedTechStack;

                        setBlueprint(updatedBlueprint);

                        const fieldsUpdated = updates.updatedFields?.join(', ') || 'blueprint';
                        const assistantMessage: StudioMessage = {
                            id: `assistant-${Date.now()}`,
                            role: 'assistant',
                            content: `Updated ${fieldsUpdated}. Your changes have been applied.`,
                            mode: activeMode
                        };
                        if (currentSessionId) {
                            updateSession(currentSessionId, (session) => ({
                                ...session,
                                messages: [...session.messages, assistantMessage],
                                updatedAt: Date.now(),
                                mode: activeMode ?? session.mode ?? 'Architect',
                                blueprint: updatedBlueprint
                            }));
                        }
                    } else {
                        throw new Error('Could not parse refinement response');
                    }
                } catch {
                    // If parsing fails, just show the response as a message
                    const assistantMessage: StudioMessage = {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: response || 'I could not process that refinement. Please try again.',
                        mode: activeMode
                    };
                    if (currentSessionId) {
                        updateSession(currentSessionId, (session) => ({
                            ...session,
                            messages: [...session.messages, assistantMessage],
                            updatedAt: Date.now(),
                            mode: activeMode ?? session.mode ?? null
                        }));
                    }
                }
            }
            // ARCHITECT MODE: Generate new blueprint
            else if (activeMode === 'Architect' && !isCanvasMode) {
                const blueprintResult = await generateProjectBlueprint(trimmed);
                if (!controller.signal.aborted) {
                    setBlueprint(blueprintResult);
                    setIsCanvasMode(true); // Activate canvas split-view
                    const assistantMessage: StudioMessage = {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: `Generated blueprint: "${blueprintResult.title}"`,
                        mode: activeMode
                    };
                    if (currentSessionId) {
                        updateSession(currentSessionId, (session) => ({
                            ...session,
                            messages: [...session.messages, assistantMessage],
                            updatedAt: Date.now(),
                            mode: 'Architect',
                            blueprint: blueprintResult
                        }));
                    }
                }
            } else {
                // Standard chat for other modes
                const response = await chatWithCora(
                    nextMessages.map(({ role, content }) => ({ role, content })),
                    {
                        mode: activeMode,
                        useSearch,
                        model: selectedModel,
                        tenantContext: resolvedContext || undefined
                    }
                );

                if (controller.signal.aborted) return;

                const assistantMessage: StudioMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: response || t('aiStudio.chat.emptyResponse'),
                    mode: activeMode
                };

                if (currentSessionId) {
                    updateSession(currentSessionId, (session) => ({
                        ...session,
                        messages: [...session.messages, assistantMessage],
                        updatedAt: Date.now(),
                        mode: activeMode ?? session.mode ?? null
                    }));
                }
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                console.error(error);
                showToast(error instanceof Error ? error.message : t('aiStudio.errors.generate'), 'error');
            }
        } finally {
            if (!controller.signal.aborted) {
                setIsSending(false);
                abortControllerRef.current = null;
            }
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const handleModeToggle = (mode: StudioTool) => {
        setActiveMode((current) => (current === mode ? null : mode));
    };

    const handleNewChat = () => {
        createSession();
        setDraft('');
        setBlueprint(null);
        setIsCanvasMode(false);
        setIsFullscreen(false);
    };

    const handleSelectSession = (sessionId: string) => {
        const selectedSession = sessions.find((session) => session.id === sessionId) || null;
        const resolvedMode = selectedSession ? resolveSessionMode(selectedSession) : null;
        const nextMode = selectedSession?.blueprint && !resolvedMode ? 'Architect' : resolvedMode;
        setActiveSessionId(sessionId);
        setDraft('');
        setActiveMode(nextMode);
        setBlueprint(selectedSession?.blueprint ?? null);
        setIsCanvasMode(Boolean(selectedSession?.blueprint));
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting(t('aiStudio.greeting.morning'));
        else if (hour < 18) setGreeting(t('aiStudio.greeting.afternoon'));
        else setGreeting(t('aiStudio.greeting.evening'));
    }, [t]);

    const handleSuggestionClick = (mode: StudioTool) => {
        setActiveMode(mode);
        const input = document.querySelector('.ai-studio__input') as HTMLTextAreaElement;
        input?.focus();
    };

    const renderComposer = (variant: 'center' | 'dock') => (
        <div className={`ai-studio__composer ai-studio__composer--${variant}`.trim()}>
            <div className="ai-studio__input-pill">
                <TextArea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('aiStudio.chat.placeholder')}
                    className="ai-studio__input"
                    rows={1}
                    disabled={isSending}
                />

                <div className="ai-studio__pill-actions">
                    <Select
                        value={selectedModel}
                        options={modelOptions}
                        onChange={(value) => setSelectedModel(value as ModelOption['value'])}
                        className="ai-studio__model-select-pill"
                    />

                    {isSending ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="ai-studio__send-pill stop-btn"
                            onClick={handleStop}
                            isLoading={false}
                            icon={<span className="material-symbols-outlined">stop_circle</span>}
                            aria-label={t('aiStudio.chat.stop')}
                        />
                    ) : (
                        <Button
                            variant="primary"
                            size="sm"
                            className="ai-studio__send-pill"
                            onClick={handleSend}
                            isLoading={false}
                            disabled={!draft.trim()}
                            icon={<span className="material-symbols-outlined">send</span>}
                            aria-label={t('aiStudio.chat.send')}
                        />
                    )}
                </div>
            </div>

            {variant === 'dock' && (
                <div className="ai-studio__composer-meta">
                    <div className="ai-studio__mode-selector-dock">
                        {modeOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                className={`ai-studio__mode-chip ${activeMode === option.id ? 'is-active' : ''}`.trim()}
                                onClick={() => handleModeToggle(option.id)}
                                aria-pressed={activeMode === option.id}
                                title={option.description}
                            >
                                <span className="material-symbols-outlined">{option.icon}</span>
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className={`ai-studio ${isSidebarOpen ? 'is-sidebar-open' : 'is-sidebar-collapsed'} ${isFullscreen ? 'is-fullscreen' : ''}`.trim()}>
            <div className="ai-studio__workspace">
                <aside className={`ai-studio__sidebar ${isSidebarOpen ? 'is-open' : ''}`.trim()}>
                    <div className="ai-studio__sidebar-top">
                        <button
                            type="button"
                            className="ai-studio__menu-button"
                            onClick={() => setIsSidebarOpen(false)}
                            aria-label={t('aiStudio.chat.closeSidebar')}
                        >
                            <span className="material-symbols-outlined">menu_open</span>
                        </button>
                    </div>

                    <div className="ai-studio__sidebar-list">
                        <div className="ai-studio__sidebar-actions">
                            <Button
                                variant="secondary"
                                className="ai-studio__new-chat-btn"
                                onClick={handleNewChat}
                                icon={<span className="material-symbols-outlined">add</span>}
                            >
                                {t('aiStudio.chat.newSession')}
                            </Button>
                        </div>
                        {sessions.length === 0 ? (
                            <div className="ai-studio__sidebar-empty">{emptyHistory}</div>
                        ) : (
                            sessions
                                .slice()
                                .sort((a, b) => b.updatedAt - a.updatedAt)
                                .map((session) => {
                                    const sessionMode = resolveSessionMode(session);
                                    const modeClass = sessionMode ? `ai-studio__sidebar-item--${sessionMode.toLowerCase()}` : '';
                                    return (
                                        <button
                                            key={session.id}
                                            type="button"
                                            className={`ai-studio__sidebar-item ${modeClass} ${session.id === activeSessionId ? 'is-active' : ''}`.trim()}
                                            onClick={() => handleSelectSession(session.id)}
                                        >
                                            <span className="material-symbols-outlined ai-studio__item-icon">chat_bubble_outline</span>
                                            <div className="ai-studio__item-content">
                                                <span className="ai-studio__sidebar-item-title">{session.title}</span>
                                            </div>
                                        </button>
                                    );
                                })
                        )}
                    </div>
                </aside>

                <div className="ai-studio__shell dotted-bg">
                    {!isSidebarOpen && (
                        <div className="ai-studio__shell-controls" style={{ position: 'absolute', top: 16, left: 16, zIndex: 50 }}>
                            <button
                                type="button"
                                className="ai-studio__menu-button"
                                onClick={() => setIsSidebarOpen(true)}
                                aria-label={t('aiStudio.chat.toggleSidebar')}
                            >
                                <span className="material-symbols-outlined">menu</span>
                            </button>
                        </div>
                    )}

                    <div className={`ai-studio__body ${messages.length === 0 ? 'is-empty' : ''}`.trim()}>
                        {messages.length === 0 ? (
                            <div className="ai-studio__empty">
                                {activeMode ? (
                                    <div className={`ai-studio__mode-entry ai-studio__mode-entry--${activeMode.toLowerCase()}`}>
                                        <div className="ai-studio__mode-content">
                                            <div className="ai-studio__mode-icon-wrapper">
                                                <span className="material-symbols-outlined ai-studio__mode-icon">
                                                    {modeOptions.find(m => m.id === activeMode)?.icon}
                                                </span>
                                            </div>
                                            <h2 className="ai-studio__mode-title">
                                                {modeOptions.find(m => m.id === activeMode)?.label}
                                            </h2>
                                            <p className="ai-studio__mode-description">
                                                {modeOptions.find(m => m.id === activeMode)?.description}
                                            </p>
                                        </div>
                                        {renderComposer('center')}
                                        <div className="ai-studio__suggestions">
                                            <button
                                                type="button"
                                                className="ai-studio__suggestion-chip ai-studio__suggestion-chip--back"
                                                onClick={() => { setActiveMode(null); setBlueprint(null); }}
                                            >
                                                <span className="material-symbols-outlined">arrow_back</span>
                                                <span>{t('aiStudio.common.back')}</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="ai-studio__empty-inner">
                                        <div className="ai-studio__greeting">
                                            <span className="ai-studio__greeting-icon">✨</span>
                                            <h2 className="ai-studio__greeting-text">
                                                {t('aiStudio.greeting.hello')} {tenantContext?.name || 'Christoph'}
                                            </h2>
                                            <p className="ai-studio__greeting-sub">{t('aiStudio.greeting.prompt')}</p>
                                        </div>

                                        {renderComposer('center')}

                                        <div className="ai-studio__suggestions">
                                            {modeOptions.map((option) => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    className={`ai-studio__suggestion-chip ${activeMode === option.id ? 'is-active' : ''}`.trim()}
                                                    onClick={() => handleModeToggle(option.id)}
                                                >
                                                    <span>{option.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="ai-studio__conversation">
                                {isCanvasMode && blueprint ? (
                                    /* CANVAS MODE: Split View */
                                    <div className="ai-studio__canvas-mode">
                                        {/* Left Panel: Chat */}
                                        <div className="ai-studio__canvas-chat">
                                            <div className="ai-studio__canvas-chat-header">
                                                <h3>
                                                    <span className="material-symbols-outlined">chat</span>
                                                    Refine Blueprint
                                                </h3>
                                                <button
                                                    type="button"
                                                    className="ai-studio__suggestion-chip ai-studio__suggestion-chip--back"
                                                    onClick={() => {
                                                        setIsCanvasMode(false);
                                                        setActiveMode(null);
                                                        setBlueprint(null);
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            </div>
                                            <div className="ai-studio__canvas-messages">
                                                {messages.map((message) => (
                                                    <div
                                                        key={message.id}
                                                        className={`ai-studio__message ai-studio__message--${message.role}`.trim()}
                                                    >
                                                        {message.role === 'assistant' && (
                                                            <div className="ai-studio__message-avatar">
                                                                <span className="material-symbols-outlined">auto_awesome</span>
                                                            </div>
                                                        )}
                                                        <div className="ai-studio__bubble">
                                                            <div className="ai-studio__message-content">
                                                                {message.role === 'assistant'
                                                                    ? renderMarkdownContent(message.content)
                                                                    : <p className="ai-studio__markdown-paragraph">{message.content}</p>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {isSending && (
                                                    <div className="ai-studio__message ai-studio__message--assistant">
                                                        <div className="ai-studio__message-avatar">
                                                            <span className="material-symbols-outlined">auto_awesome</span>
                                                        </div>
                                                        <div className="ai-studio__bubble ai-studio__bubble--typing">
                                                            <div className="ai-studio__typing">
                                                                <span />
                                                                <span />
                                                                <span />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div ref={messagesEndRef} />
                                            </div>
                                            <div className="ai-studio__canvas-composer">
                                                {renderComposer('dock')}
                                            </div>
                                        </div>

                                        {/* Right Panel: Blueprint Canvas */}
                                        <div className={`ai-studio__canvas-panel ai-studio__canvas-panel--${activeMode?.toLowerCase() || 'default'}`}>
                                            <div className="ai-studio__canvas-panel-header">
                                                <h3>
                                                    <span className="material-symbols-outlined">architecture</span>
                                                    {blueprint.title}
                                                </h3>
                                                <button
                                                    type="button"
                                                    className="ai-studio__fullscreen-toggle"
                                                    onClick={() => setIsFullscreen(!isFullscreen)}
                                                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                                                >
                                                    <span className="material-symbols-outlined">
                                                        {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                                                    </span>
                                                </button>
                                            </div>
                                            <div className="ai-studio__canvas-content">
                                                <BlueprintResult
                                                    blueprint={blueprint}
                                                    onConvert={(bp) => {
                                                        showToast(t('aiStudio.blueprint.converting'), 'info');
                                                        setIsConvertingBlueprint(true);
                                                        setTimeout(() => {
                                                            showToast(t('aiStudio.blueprint.converted'), 'success');
                                                            setIsConvertingBlueprint(false);
                                                        }, 1500);
                                                    }}
                                                    isConverting={isConvertingBlueprint}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : activeMode && messages.length > 0 ? (
                                    <div className={`ai-studio__mode-result ai-studio__mode-entry--${activeMode.toLowerCase()}`}>
                                        <div className="ai-studio__result-header">
                                            <div className="ai-studio__result-title-row">
                                                <div className="ai-studio__mode-icon-wrapper mini">
                                                    <span className="material-symbols-outlined ai-studio__mode-icon">
                                                        {modeOptions.find(m => m.id === activeMode)?.icon}
                                                    </span>
                                                </div>
                                                <h3 className="ai-studio__mode-title mini">
                                                    {modeOptions.find(m => m.id === activeMode)?.label} Result
                                                </h3>
                                            </div>
                                            <button
                                                type="button"
                                                className="ai-studio__suggestion-chip ai-studio__suggestion-chip--back"
                                                onClick={() => {
                                                    setActiveMode(null);
                                                    setBlueprint(null);
                                                }}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                                <span>{t('aiStudio.common.exitMode')}</span>
                                            </button>
                                        </div>

                                        <div className="ai-studio__result-content">
                                            {activeMode === 'Architect' && blueprint ? (
                                                <BlueprintResult
                                                    blueprint={blueprint}
                                                    onConvert={(bp) => {
                                                        showToast(t('aiStudio.blueprint.converting'), 'info');
                                                        setIsConvertingBlueprint(true);
                                                        setTimeout(() => {
                                                            showToast(t('aiStudio.blueprint.converted'), 'success');
                                                            setIsConvertingBlueprint(false);
                                                        }, 1500);
                                                    }}
                                                    isConverting={isConvertingBlueprint}
                                                />
                                            ) : (
                                                <>
                                                    {messages.filter(m => m.role === 'assistant').slice(-1).map(lastMessage => (
                                                        <div key={lastMessage.id} className="ai-studio__result-document">
                                                            {renderMarkdownContent(lastMessage.content)}
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                            {isSending && (
                                                <div className="ai-studio__result-loading">
                                                    <div className="ai-studio__typing">
                                                        <span /> <span /> <span />
                                                    </div>
                                                    <p>Generating...</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="ai-studio__result-composer">
                                            {renderComposer('dock')}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="ai-studio__messages">
                                            {messages.map((message) => (
                                                <div
                                                    key={message.id}
                                                    className={`ai-studio__message ai-studio__message--${message.role}`.trim()}
                                                >
                                                    {message.role === 'assistant' && (
                                                        <div className="ai-studio__message-avatar">
                                                            <span className="material-symbols-outlined">auto_awesome</span>
                                                        </div>
                                                    )}
                                                    <div className="ai-studio__bubble">
                                                        <div className="ai-studio__message-content">
                                                            {message.role === 'assistant'
                                                                ? renderMarkdownContent(message.content)
                                                                : <p className="ai-studio__markdown-paragraph">{message.content}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {isSending && (
                                                <div className="ai-studio__message ai-studio__message--assistant">
                                                    <div className="ai-studio__message-avatar">
                                                        <span className="material-symbols-outlined">auto_awesome</span>
                                                    </div>
                                                    <div className="ai-studio__bubble ai-studio__bubble--typing">
                                                        <div className="ai-studio__typing">
                                                            <span />
                                                            <span />
                                                            <span />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>
                                        {renderComposer('dock')}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {isSidebarOpen && (
                <button
                    type="button"
                    className="ai-studio__sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-label={t('aiStudio.chat.closeSidebar')}
                />
            )}
        </div>
    );
};
