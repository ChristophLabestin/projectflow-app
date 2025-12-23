import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EmailBuilder } from './components/email-builder/EmailBuilder';
import { EmailBlock, TemplateVariable } from '../../types';
import { getLatestEmailTemplateDraft, saveEmailTemplateDraft, getEmailTemplateDrafts, getProjectById } from '../../services/dataService';
import { auth } from '../../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const EmailBuilderPage = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [initialBlocks, setInitialBlocks] = useState<EmailBlock[]>([]);
    const [initialVariables, setInitialVariables] = useState<TemplateVariable[]>([]);
    const [initialName, setInitialName] = useState<string>('Unnamed Template');

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

                    const draft = await getLatestEmailTemplateDraft(projectId, tenantId);
                    if (draft) {
                        setInitialBlocks(draft.blocks || []);
                        setInitialVariables(draft.variables || []);
                        setInitialName(draft.name || 'Unnamed Template');
                    }
                } catch (e) {
                    console.error("Failed to load email draft", e);
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

    const handleSave = async (blocks: EmailBlock[], variables: TemplateVariable[], name?: string) => {
        setSaving(true);
        try {
            // Save as final draft/template (you might want to set status: 'published' here if intended)
            await saveEmailTemplateDraft(projectId!, blocks, variables, resolvedTenantId, name);
            navigate(`/project/${projectId}/marketing/email`);
        } catch (e) {
            console.error("Failed to save email template", e);
            alert("Failed to save template");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = async (blocks: EmailBlock[], variables: TemplateVariable[], name?: string) => {
        if (!projectId) return;
        try {
            await saveEmailTemplateDraft(projectId, blocks, variables, resolvedTenantId, name);
        } catch (e) {
            console.error("Autosave failed in page", e);
        }
    };

    const fetchDrafts = useCallback(async () => {
        if (!projectId) return [];
        return await getEmailTemplateDrafts(projectId, resolvedTenantId);
    }, [projectId, resolvedTenantId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full gap-3 text-[var(--color-text-muted)] bg-zinc-50 dark:bg-zinc-950">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined animate-spin text-[32px] text-[var(--color-primary)]">sync</span>
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
                onCancel={() => navigate(-1)}
                saving={saving}
            />
        </div>
    );
};
