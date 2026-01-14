import React, { useEffect, useMemo, useRef, useState } from 'react';
import { chatWithCora } from '../services/geminiService';
import { getActiveTenantId, getAllWorkspaceProjects, getTenant } from '../services/dataService';
import { StudioTool } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';
import { Button } from '../components/common/Button/Button';
import { Select } from '../components/common/Select/Select';
import { TextArea } from '../components/common/Input/TextArea';
import './brainstorming.scss';

type StudioMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    mode?: StudioTool | null;
};

type ChatSession = {
    id: string;
    title: string;
    messages: StudioMessage[];
    createdAt: number;
    updatedAt: number;
};

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
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [activeMode, setActiveMode] = useState<StudioTool | null>(null);
    const [useSearch, setUseSearch] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
    const [selectedModel, setSelectedModel] = useState<ModelOption['value']>('gemini-3-flash-preview');
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

    const getSessionTitle = (text: string) => {
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (!normalized) return t('aiStudio.chat.newSessionTitle');
        return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
    };

    const createSession = (seedTitle?: string, initialMessages: StudioMessage[] = []) => {
        const now = Date.now();
        const session: ChatSession = {
            id: `chat-${now}`,
            title: seedTitle ? getSessionTitle(seedTitle) : t('aiStudio.chat.newSessionTitle'),
            messages: initialMessages,
            createdAt: now,
            updatedAt: now
        };
        setSessions((prev) => [session, ...prev]);
        setActiveSessionId(session.id);
        return session.id;
    };

    const updateSession = (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
        setSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(session) : session)));
    };

    // ... useEffects ...

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
                updatedAt: Date.now()
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
                    updatedAt: Date.now()
                }));
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
    };

    const handleSelectSession = (sessionId: string) => {
        setActiveSessionId(sessionId);
        setDraft('');
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
        <div className={`ai-studio ${isSidebarOpen ? 'is-sidebar-open' : 'is-sidebar-collapsed'}`.trim()}>
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
                                .map((session) => (
                                    <button
                                        key={session.id}
                                        type="button"
                                        className={`ai-studio__sidebar-item ${session.id === activeSessionId ? 'is-active' : ''}`.trim()}
                                        onClick={() => handleSelectSession(session.id)}
                                    >
                                        <span className="material-symbols-outlined ai-studio__item-icon">chat_bubble_outline</span>
                                        <div className="ai-studio__item-content">
                                            <span className="ai-studio__sidebar-item-title">{session.title}</span>
                                        </div>
                                    </button>
                                ))
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
                            </div>
                        ) : (
                            <div className="ai-studio__conversation">
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
