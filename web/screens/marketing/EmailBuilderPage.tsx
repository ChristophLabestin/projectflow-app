import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { EmailBuilder } from './components/email-builder/EmailBuilder';
import { EmailBlock, TemplateVariable } from '../../types';
import { getLatestEmailTemplateDraft, saveEmailTemplateDraft, getEmailTemplateDrafts, getProjectById, getEmailTemplateById, getTemplateVersions } from '../../services/dataService';
import { auth, db } from '../../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '../../context/UIContext';

// Helper to compare template content for change detection
const hasContentChanged = (
    currentBlocks: EmailBlock[],
    currentVariables: TemplateVariable[],
    currentName: string,
    originalBlocks: EmailBlock[],
    originalVariables: TemplateVariable[],
    originalName: string
): boolean => {
    // Quick checks first
    if (currentName !== originalName) return true;
    if (currentBlocks.length !== originalBlocks.length) return true;
    if (currentVariables.length !== originalVariables.length) return true;

    // Deep comparison using JSON stringify (simple but effective for this use case)
    return JSON.stringify(currentBlocks) !== JSON.stringify(originalBlocks) ||
        JSON.stringify(currentVariables) !== JSON.stringify(originalVariables);
};

const STANDARD_VARIABLES: TemplateVariable[] = [
    { id: 'recipient.firstName', name: 'firstName', label: 'First Name', type: 'text', defaultValue: 'John' },
    { id: 'recipient.lastName', name: 'lastName', label: 'Last Name', type: 'text', defaultValue: 'Doe' },
    { id: 'recipient.email', name: 'email', label: 'Email', type: 'text', defaultValue: 'john@example.com' },
    { id: 'recipient.gender', name: 'gender', label: 'Gender', type: 'text', defaultValue: 'other' },
    { id: 'recipient.formOfAddress', name: 'formOfAddress', label: 'Form of Address (Mr./Ms.)', type: 'text', defaultValue: 'Mr. Doe' }
];

export const EmailBuilderPage = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const templateIdFromUrl = searchParams.get('templateId');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [initialBlocks, setInitialBlocks] = useState<EmailBlock[]>([]);
    const [initialVariables, setInitialVariables] = useState<TemplateVariable[]>(STANDARD_VARIABLES);
    const [initialName, setInitialName] = useState<string>('Unnamed Template');
    const [activeTemplateId, setActiveTemplateId] = useState<string | undefined>(undefined);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const { showError } = useToast();

    // Refs to track original content for change detection
    const originalContentRef = useRef<{
        blocks: EmailBlock[];
        variables: TemplateVariable[];
        name: string;
    } | null>(null);

    const [resolvedTenantId, setResolvedTenantId] = useState<string | undefined>();

    useEffect(() => {
        // Wait for auth to be initialized before loading data
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && projectId) {
                try {
                    // First, find the project to get the correct tenantId (important for shared projects)
                    const project = await getProjectById(projectId);
                    const tenantId = project?.tenantId || user.uid;
                    setResolvedTenantId(tenantId);

                    if (templateIdFromUrl) {
                        const template = await getEmailTemplateById(projectId, templateIdFromUrl, tenantId);
                        if (template) {
                            const loadedBlocks = template.blocks || [];
                            const loadedVariables = template.variables || [];
                            const loadedName = template.name || 'Unnamed Template';

                            setInitialBlocks(loadedBlocks);
                            setInitialVariables(loadedVariables);
                            setInitialName(loadedName);
                            setActiveTemplateId(template.id);

                            // Store original content for change detection
                            originalContentRef.current = {
                                blocks: loadedBlocks,
                                variables: loadedVariables,
                                name: loadedName
                            };
                        }
                    } else {
                        const draft = await getLatestEmailTemplateDraft(projectId, tenantId);
                        if (draft) {
                            const loadedBlocks = draft.blocks || [];
                            const loadedVariables = [...STANDARD_VARIABLES, ...(draft.variables || [])];
                            const loadedName = draft.name || 'Unnamed Template';

                            setInitialBlocks(loadedBlocks);
                            setInitialVariables(loadedVariables);
                            setInitialName(loadedName);
                            setActiveTemplateId(draft.id);

                            // Store original content for change detection
                            originalContentRef.current = {
                                blocks: loadedBlocks,
                                variables: loadedVariables,
                                name: loadedName
                            };
                        }
                    }
                } catch (e) {
                    console.error("Failed to load email draft or template", e);
                } finally {
                    setLoading(false);
                }
            } else if (!user) {
                // Not authenticated, let the global auth guard handle it or show error
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [projectId]);

    // Check for ReadOnly Status
    useEffect(() => {
        if (!activeTemplateId || !projectId) return;

        const checkUsage = async () => {
            try {
                // Check email_campaigns for this templateId where status is NOT draft/in_review
                // Assuming status 'ready', 'scheduled', 'sent' locks it. 
                // Adjust logic if 'ready' should still allow edits (usually ready implies locked too)
                const q = query(
                    collection(db, 'email_campaigns'),
                    where('projectId', '==', projectId),
                    where('templateId', '==', activeTemplateId),
                    where('status', 'in', ['scheduled', 'sent', 'ready'])
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    setIsReadOnly(true);
                } else {
                    setIsReadOnly(false);
                }
            } catch (e) {
                console.error("Failed to check template usage", e);
            }
        };
        checkUsage();
    }, [activeTemplateId, projectId]);

    const handleSave = async (blocks: EmailBlock[], variables: TemplateVariable[], name?: string) => {
        setSaving(true);
        try {
            // Save as final draft/template (you might want to set status: 'published' here if intended)
            const newId = await saveEmailTemplateDraft(projectId!, blocks, variables, resolvedTenantId, name, 'published', activeTemplateId);
            if (newId) setActiveTemplateId(newId);
            navigate(`/project/${projectId}/marketing/email`);
        } catch (e) {
            console.error("Failed to save email template", e);
            showError("Failed to save template");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = useCallback(async (blocks: EmailBlock[], variables: TemplateVariable[], name?: string) => {
        if (!projectId || !resolvedTenantId) return;

        // IMPORTANT: Only autosave if we have an existing template to update
        // This prevents autosave from creating new templates when:
        // 1. User is starting fresh (no templateId in URL)
        // 2. Previous template was deleted but builder still has blocks
        if (!activeTemplateId) {
            console.log("Autosave skipped: No active template ID (save manually to create new template)");
            return;
        }

        // Check if content has actually changed from original
        // Only change status to draft if there are real changes
        if (originalContentRef.current) {
            const changed = hasContentChanged(
                blocks,
                variables,
                name || 'Unnamed Template',
                originalContentRef.current.blocks,
                originalContentRef.current.variables,
                originalContentRef.current.name
            );

            if (!changed) {
                console.log("Autosave skipped: No changes detected from original content");
                return;
            }
        }

        try {
            await saveEmailTemplateDraft(projectId, blocks, variables, resolvedTenantId, name, 'draft', activeTemplateId);
            console.log("Draft saved to template:", activeTemplateId);
        } catch (e) {
            console.error("Autosave failed in page", e);
        }
    }, [projectId, resolvedTenantId, activeTemplateId]);

    const fetchDrafts = useCallback(async () => {
        if (!projectId || !resolvedTenantId) return [];
        if (activeTemplateId) {
            return await getTemplateVersions(projectId, activeTemplateId, resolvedTenantId);
        }
        return [];
    }, [projectId, resolvedTenantId, activeTemplateId]);

    const handleLoadDraft = useCallback(async (draftId: string) => {
        if (!projectId || !resolvedTenantId) return;
        setLoading(true);
        try {
            let foundDraft: EmailTemplate | undefined;

            // If we have an active template, checking its history versions first
            if (activeTemplateId) {
                const versions = await getTemplateVersions(projectId, activeTemplateId, resolvedTenantId);
                foundDraft = versions.find(v => v.id === draftId);
            }

            if (foundDraft) {
                // Loaded a version of the current template. Restore content but KEEP the activeTemplateId.
                setInitialBlocks(foundDraft.blocks || []);
                setInitialVariables(foundDraft.variables || []);
                setInitialName(foundDraft.name || 'Unnamed Template');
            } else {
                // Fallback: Check top-level drafts (legacy behavior or switching templates)
                const drafts = await getEmailTemplateDrafts(projectId, resolvedTenantId);
                foundDraft = drafts.find(d => d.id === draftId);
                if (foundDraft) {
                    setInitialBlocks(foundDraft.blocks || []);
                    setInitialVariables(foundDraft.variables || []);
                    setInitialName(foundDraft.name || 'Unnamed Template');
                    setActiveTemplateId(foundDraft.id);
                }
            }
        } catch (e) {
            console.error("Failed to load draft", e);
        } finally {
            setLoading(false);
        }
    }, [projectId, resolvedTenantId, activeTemplateId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full gap-3 text-muted bg-zinc-50 dark:bg-zinc-950">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined animate-spin text-[32px] text-primary">sync</span>
                    <div className="text-center">
                        <span className="text-sm font-bold uppercase tracking-widest block">Restoring Workspace</span>
                        <span className="text-[10px] opacity-50 uppercase tracking-tighter">Connecting to Cloud Storage...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <EmailBuilder
                projectId={projectId || ''}
                initialBlocks={initialBlocks}
                initialVariables={initialVariables}
                initialName={initialName}
                onSave={handleSave}
                onSaveDraft={handleSaveDraft}
                onFetchDrafts={fetchDrafts}
                onLoadDraft={handleLoadDraft}
                onCancel={() => navigate(-1)}
                saving={saving}
                readOnly={isReadOnly}
                tenantId={resolvedTenantId}
            />
        </div>
    );
};
