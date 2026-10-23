import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from './common/Button/Button';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';
import { auth } from '../services/firebase';
import { createProject } from '../services/domain/projectAdminService';
import { addTask } from '../services/domain/tasksService';
import { getProjectTemplateDefinition } from '../config/projectTemplates';
import { toIsoDate, addDaysFromToday } from '../utils/taskDates';
import type { ProjectTemplateId } from '../types';
import { planErrorMessage } from '../services/billingService';

/** The four templates a first project most often needs; everything else lives in "More options". */
const QUICK_TEMPLATES: { id: ProjectTemplateId; icon: string; labelKey: string }[] = [
    { id: 'blank', icon: 'folder_open', labelKey: 'quickProject.template.general' },
    { id: 'software_release', icon: 'terminal', labelKey: 'quickProject.template.software' },
    { id: 'creative_project', icon: 'palette', labelKey: 'quickProject.template.creative' },
    { id: 'client_delivery', icon: 'handshake', labelKey: 'quickProject.template.client' }
];

/** Starter tasks per template (i18n keys), due over the first week so the dashboard has a plan. */
const STARTER_TASKS: Record<string, { key: string; inDays: number }[]> = {
    blank: [
        { key: 'quickProject.starter.blank.1', inDays: 1 },
        { key: 'quickProject.starter.blank.2', inDays: 2 },
        { key: 'quickProject.starter.blank.3', inDays: 5 }
    ],
    software_release: [
        { key: 'quickProject.starter.software.1', inDays: 1 },
        { key: 'quickProject.starter.software.2', inDays: 3 },
        { key: 'quickProject.starter.software.3', inDays: 7 }
    ],
    creative_project: [
        { key: 'quickProject.starter.creative.1', inDays: 1 },
        { key: 'quickProject.starter.creative.2', inDays: 3 },
        { key: 'quickProject.starter.creative.3', inDays: 6 }
    ],
    client_delivery: [
        { key: 'quickProject.starter.client.1', inDays: 1 },
        { key: 'quickProject.starter.client.2', inDays: 3 },
        { key: 'quickProject.starter.client.3', inDays: 7 }
    ]
};

type QuickProjectCreateProps = {
    onClose: () => void;
    onMoreOptions: (draft: { name: string; templateId: ProjectTemplateId }) => void;
};

/**
 * One-step project creation: a name, an optional template and optional starter
 * tasks. The full wizard stays one click away for everything else.
 */
export const QuickProjectCreate: React.FC<QuickProjectCreateProps> = ({ onClose, onMoreOptions }) => {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [templateId, setTemplateId] = useState<ProjectTemplateId>('blank');
    const [withStarterTasks, setWithStarterTasks] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const inFlightRef = useRef(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const title = name.trim();
        if (!title || submitting || inFlightRef.current) return;
        inFlightRef.current = true;
        setSubmitting(true);
        try {
            const template = getProjectTemplateDefinition(templateId);
            const projectId = await createProject({
                title,
                description: '',
                projectType: template.legacyProjectType,
                projectCategory: template.projectCategory,
                templateId: template.id,
                operatingMode: template.defaultOperatingMode,
                operatingModel: { mode: template.defaultOperatingMode, cadence: template.defaultCadence, dateConfidence: 'rough' },
                priority: 'Medium',
                status: 'Active',
                isPrivate: false,
                modules: template.defaultModules
            });
            const uid = auth.currentUser?.uid;
            if (withStarterTasks) {
                const starters = STARTER_TASKS[template.id] || STARTER_TASKS.blank;
                for (const starter of starters) {
                    await addTask(projectId, t(starter.key), toIsoDate(addDaysFromToday(starter.inDays)), undefined, 'Medium', {
                        status: 'Open',
                        ...(uid ? { assigneeId: uid, assigneeIds: [uid] } : {})
                    });
                }
            }
            onClose();
            navigate(`/project/${projectId}`);
            showToast(t('createProjectWizard.toast.created').replace('{name}', title), 'success');
        } catch (error) {
            console.error(error);
            inFlightRef.current = false;
            setSubmitting(false);
            showToast(planErrorMessage(error, t) || t('createProjectWizard.errors.createProject'), 'error');
        }
    };

    return (
        <form className="quick-project" onSubmit={handleSubmit}>
            <header className="quick-project__head">
                <h2 className="quick-project__title">{t('quickProject.title')}</h2>
                <p className="quick-project__subtitle">{t('quickProject.subtitle')}</p>
            </header>

            <label className="quick-project__field">
                <span className="quick-project__label">{t('quickProject.nameLabel')}</span>
                <input
                    className="quick-project__input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('quickProject.namePlaceholder')}
                    autoFocus
                    maxLength={120}
                />
            </label>

            <div className="quick-project__field">
                <span className="quick-project__label">{t('quickProject.templateLabel')}</span>
                <div className="quick-project__templates" role="radiogroup" aria-label={t('quickProject.templateLabel')}>
                    {QUICK_TEMPLATES.map((template) => (
                        <button
                            key={template.id}
                            type="button"
                            role="radio"
                            aria-checked={templateId === template.id}
                            className={`quick-project__template ${templateId === template.id ? 'is-active' : ''}`.trim()}
                            onClick={() => setTemplateId(template.id)}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">{template.icon}</span>
                            {t(template.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            <label className="quick-project__check">
                <input type="checkbox" checked={withStarterTasks} onChange={(event) => setWithStarterTasks(event.target.checked)} />
                <span>
                    <strong>{t('quickProject.starterLabel')}</strong>
                    <small>{t('quickProject.starterHint')}</small>
                </span>
            </label>

            <footer className="quick-project__foot">
                <button type="button" className="quick-project__more" onClick={() => onMoreOptions({ name, templateId })}>
                    {t('quickProject.moreOptions')}
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                </button>
                <Button type="submit" variant="primary" isLoading={submitting} disabled={!name.trim()}>
                    {t('quickProject.create')}
                </Button>
            </footer>
        </form>
    );
};
