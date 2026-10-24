// /flows/new: choose how to start — describe it (AI draft), pick a template, or start empty.
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../../components/common/Button/Button';
import { FlowFromText } from '../../components/flows/FlowFromText';
import { FlowTemplateGallery } from '../../components/flows/FlowTemplateGallery';
import { FLOW_TEMPLATE_CATEGORIES, type FlowTemplateCategory } from '../../config/flowTemplates';
import { useFlowsOutlet } from './FlowsLayout';

type Start = 'text' | 'template' | 'blank';
const STARTS: { key: Start; icon: string }[] = [
    { key: 'text', icon: 'auto_awesome' },
    { key: 'template', icon: 'dashboard_customize' },
    { key: 'blank', icon: 'edit_square' },
];

export const FlowNew = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { ctx } = useFlowsOutlet();
    const projectId = params.get('projectId');
    const start = (['text', 'template', 'blank'].includes(params.get('start') || '') ? params.get('start') : 'text') as Start;
    const category = (params.get('category') || 'all') as FlowTemplateCategory | 'all';

    const setParam = (key: string, value: string | null) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };
    const editPath = (extra: string) => `/flows/new/edit?${extra}${projectId ? `&projectId=${projectId}` : ''}`;

    return (
        <div className="flow-new">
            <header className="flow-new__header">
                <h1>{t('flows.newPage.title')}</h1>
                <p>{projectId ? t('flows.newPage.subtitleProject').replace('{project}', ctx.names.project(projectId)) : t('flows.newPage.subtitle')}</p>
            </header>

            <div className="flow-new__starts" role="radiogroup" aria-label={t('flows.newPage.how')}>
                {STARTS.map((option) => (
                    <button key={option.key} type="button" role="radio" aria-checked={start === option.key}
                        className={`flow-new__start ${start === option.key ? 'is-active' : ''}`.trim()}
                        onClick={() => setParam('start', option.key)}>
                        <span className="flow-new__start-icon material-symbols-outlined" aria-hidden="true">{option.icon}</span>
                        <span className="flow-new__start-title">{t(`flows.newPage.start.${option.key}.title`)}</span>
                        <span className="flow-new__start-text">{t(`flows.newPage.start.${option.key}.text`)}</span>
                    </button>
                ))}
            </div>

            {start === 'text' && <FlowFromText t={t} tenantId={ctx.tenantId || ''} projectId={projectId} autoFocus />}

            {start === 'template' && (
                <section className="flow-new__templates">
                    <div className="flow-new__chips" role="tablist" aria-label={t('flows.templates.title')}>
                        {(['all', ...FLOW_TEMPLATE_CATEGORIES] as const).map((key) => (
                            <button key={key} type="button" role="tab" aria-selected={category === key}
                                className={`flow-chip ${category === key ? 'is-active' : ''}`.trim()} onClick={() => setParam('category', key === 'all' ? null : key)}>
                                {t(`flows.templates.category.${key}`)}
                            </button>
                        ))}
                    </div>
                    <FlowTemplateGallery t={t} category={category} onPick={(templateId) => navigate(editPath(templateId ? `template=${templateId}` : 'blank=1'))} />
                </section>
            )}

            {start === 'blank' && (
                <section className="flow-new__blank">
                    <ol className="flows-home__how">
                        {(['when', 'if', 'then'] as const).map((step) => (
                            <li key={step}>
                                <span className="flows-home__how-kind">{t(`flows.step.${step}`)}</span>
                                <span>{t(`flows.home.how.${step}`)}</span>
                            </li>
                        ))}
                    </ol>
                    <Button onClick={() => navigate(editPath('blank=1'))} icon={<span className="material-symbols-outlined">arrow_forward</span>} iconPosition="right">
                        {t('flows.newPage.openBlank')}
                    </Button>
                </section>
            )}
        </div>
    );
};

export default FlowNew;
