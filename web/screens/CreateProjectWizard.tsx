import React, { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInitiative, createInitiativeTask, createMilestone, getAllWorkspaceProjects } from '../services/dataService';
import { getWorkspaceMembers } from '../services/domain/workspaceMembersService';
import { getWorkspaceGroups } from '../services/domain/workspaceGroupsService';
import { filterModulesForWizardOptions, isPmCoreOnly, normalizeModulesForPmCore, PM_CORE_DEPRECATED_MODULES } from '../config/pmCore';
import { createProject } from '../services/domain/projectAdminService';
import { addTask } from '../services/domain/tasksService';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';
import { TextArea } from '../components/common/Input/TextArea';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { Select } from '../components/common/Select/Select';
import { type Priority } from '../components/common/PrioritySelect/PrioritySelect';
import { Card } from '../components/common/Card/Card';
import { CompanyProjectRole, Project, ProjectModule, StartupJurisdictionTemplateId, StartupTrackId, WorkspaceGroup, ProjectCadence, ProjectDateConfidence, ProjectOperatingMode, ProjectStatus, ProjectTemplateId, ProjectType } from '../types';
import {
    PROJECT_TEMPLATE_DEFINITIONS,
    STARTUP_JURISDICTION_SEED_TASKS,
    STARTUP_SEED_INITIATIVES,
    STARTUP_SEED_MILESTONES,
    STARTUP_SEED_TASKS,
    STARTUP_TRACK_DEFINITIONS,
    getStartupJurisdictionTemplate,
    getStartupSourceReferences,
    getProjectTemplateDefinition,
    isCompanyProject,
    isSoftwareProject
} from '../config/projectTemplates';
import { useToast } from '../context/UIContext';
import { ModuleSelection } from '../components/common/ModuleSelection/ModuleSelection';
import MemberSelection from '../components/common/MemberSelection/MemberSelection';

import { useModuleAccess } from '../hooks/useModuleAccess';

const STEPS = [
    { id: 0, labelKey: 'createProjectWizard.steps.type' },
    { id: 1, labelKey: 'createProjectWizard.steps.details' },
    { id: 2, labelKey: 'createProjectWizard.steps.setup' },
    { id: 3, labelKey: 'createProjectWizard.steps.modules' },
    { id: 4, labelKey: 'createProjectWizard.steps.team' },
    { id: 5, labelKey: 'createProjectWizard.steps.visibility' },
    { id: 6, labelKey: 'createProjectWizard.steps.timeline' },
];

const SETUP_WORKSTREAMS_STEP_ID = 2;
const TEAM_STEP_ID = 4;
const VISIBILITY_STEP_ID = 5;

const getWizardSteps = (includeSetupWorkstreams: boolean) => (
    includeSetupWorkstreams
        ? STEPS
        : STEPS.filter(step => step.id !== SETUP_WORKSTREAMS_STEP_ID)
);

const getNextStepId = (currentStep: number, includeSetupWorkstreams: boolean) => {
    const steps = getWizardSteps(includeSetupWorkstreams);
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex === -1) {
        return steps.find(step => step.id > currentStep)?.id ?? steps[steps.length - 1]?.id ?? currentStep;
    }
    const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
    return steps[nextIndex]?.id ?? currentStep;
};

const getPreviousStepId = (currentStep: number, includeSetupWorkstreams: boolean) => {
    const steps = getWizardSteps(includeSetupWorkstreams);
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex === -1) {
        return [...steps].reverse().find(step => step.id < currentStep)?.id ?? steps[0]?.id ?? currentStep;
    }
    const previousIndex = Math.max(currentIndex - 1, 0);
    return steps[previousIndex]?.id ?? currentStep;
};

type ModuleOption = {
    id: ProjectModule;
    labelKey: string;
    descKey: string;
    icon: string;
    gatedBy?: 'social' | 'marketing' | 'accounting';
};

const MODULE_OPTIONS: ModuleOption[] = [
    { id: 'tasks', labelKey: 'createProjectWizard.modules.tasks.label', descKey: 'createProjectWizard.modules.tasks.desc', icon: 'check_circle' },
    { id: 'initiatives', labelKey: 'createProjectWizard.modules.initiatives.label', descKey: 'createProjectWizard.modules.initiatives.desc', icon: 'rocket_launch' },
    { id: 'sprints', labelKey: 'createProjectWizard.modules.sprints.label', descKey: 'createProjectWizard.modules.sprints.desc', icon: 'directions_run' },
    { id: 'issues', labelKey: 'createProjectWizard.modules.issues.label', descKey: 'createProjectWizard.modules.issues.desc', icon: 'bug_report' },
    { id: 'ideas', labelKey: 'createProjectWizard.modules.flows.label', descKey: 'createProjectWizard.modules.flows.desc', icon: 'lightbulb' },
    { id: 'milestones', labelKey: 'createProjectWizard.modules.milestones.label', descKey: 'createProjectWizard.modules.milestones.desc', icon: 'flag' },
    { id: 'activity', labelKey: 'createProjectWizard.modules.activity.label', descKey: 'createProjectWizard.modules.activity.desc', icon: 'history' },
    { id: 'social', labelKey: 'createProjectWizard.modules.social.label', descKey: 'createProjectWizard.modules.social.desc', icon: 'campaign', gatedBy: 'social' },
    { id: 'marketing', labelKey: 'createProjectWizard.modules.marketing.label', descKey: 'createProjectWizard.modules.marketing.desc', icon: 'ads_click', gatedBy: 'marketing' },
    { id: 'accounting', labelKey: 'createProjectWizard.modules.accounting.label', descKey: 'createProjectWizard.modules.accounting.desc', icon: 'receipt_long', gatedBy: 'accounting' },
];

type VisibilityMode = 'everyone' | 'groups' | 'private';

const StepHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <div className="create-project__step-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
    </div>
);

type CreateProjectWizardProps = {
    onClose?: () => void;
};

export const CreateProjectWizard: React.FC<CreateProjectWizardProps> = ({ onClose }) => {
    const navigate = useNavigate();
    const { can } = useWorkspacePermissions();
    const { hasAccess: isSocialAllowed } = useModuleAccess('social');
    const { hasAccess: isMarketingAllowed } = useModuleAccess('marketing');
    const { hasAccess: isAccountingAllowed } = useModuleAccess('accounting');
    const { showToast } = useToast();
    const { dateFormat, dateLocale, t } = useLanguage();
    const descriptionFieldId = useId();

    const [currentStep, setCurrentStep] = useState(0);
    const [furthestVisitedStep, setFurthestVisitedStep] = useState(0); // Track max progress

    // Form Data
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [templateId, setTemplateId] = useState<ProjectTemplateId>('blank');
    const [projectType, setProjectType] = useState<ProjectType>('standard');
    const [operatingMode, setOperatingMode] = useState<ProjectOperatingMode>('build');
    const [cadence, setCadence] = useState<ProjectCadence>('weekly');
    const dateConfidence: ProjectDateConfidence = 'target';
    const [successCriteria, setSuccessCriteria] = useState('');
    const [modules, setModules] = useState<ProjectModule[]>(['tasks', 'initiatives', 'activity']);
    const [availableMembers, setAvailableMembers] = useState<any[]>([]);
    const [workspaceGroups, setWorkspaceGroups] = useState<WorkspaceGroup[]>([]);
    const [companyProjects, setCompanyProjects] = useState<Project[]>([]);
    const [companyProjectId, setCompanyProjectId] = useState('');
    const [companyProjectRole, setCompanyProjectRole] = useState<CompanyProjectRole>('other');
    const [startupTrackIds, setStartupTrackIds] = useState<StartupTrackId[]>([]);
    const [startupSensitiveTracksConfirmed, setStartupSensitiveTracksConfirmed] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [visibilityGroupIds, setVisibilityGroupIds] = useState<string[]>([]);
    const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('everyone');
    const [isPrivate, setIsPrivate] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [priority, setPriority] = useState<Priority>('medium');
    const [status, setStatus] = useState<ProjectStatus>('Planning');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSuccessCriteriaChange = useArrowReplacement((e) => setSuccessCriteria(e.target.value));
    const filterAccessibleModules = (nextModules: ProjectModule[]) => {
        const scopedModules = isPmCoreOnly() ? normalizeModulesForPmCore(nextModules) : nextModules;
        return scopedModules.filter(module => (
            MODULE_OPTIONS.some(option => option.id === module)
            && (!isPmCoreOnly() || !PM_CORE_DEPRECATED_MODULES.includes(module))
            && (module !== 'social' || isSocialAllowed)
            && (module !== 'marketing' || isMarketingAllowed)
            && (module !== 'accounting' || isAccountingAllowed)
        ));
    };

    useEffect(() => {
        getWorkspaceMembers().then(members => {
            setAvailableMembers(members.filter(m => m.role !== 'Guest'));
        });
        getWorkspaceGroups().then(setWorkspaceGroups).catch(console.error);
        getAllWorkspaceProjects()
            .then(projects => setCompanyProjects(projects.filter(isCompanyProject)))
            .catch(error => {
                console.warn('Failed to load company projects for project creation', error);
                setCompanyProjects([]);
            });
    }, []);

    useEffect(() => {
        setModules(filterAccessibleModules(getProjectTemplateDefinition(templateId).defaultModules));
    }, [templateId, isSocialAllowed, isMarketingAllowed, isAccountingAllowed]);

    useEffect(() => {
        setModules(current => filterAccessibleModules(current));
    }, [isSocialAllowed, isMarketingAllowed, isAccountingAllowed]);

    const handleTemplateSelect = (nextTemplateId: ProjectTemplateId) => {
        const template = getProjectTemplateDefinition(nextTemplateId);
        setTemplateId(template.id);
        setProjectType(template.legacyProjectType);
        setOperatingMode(template.defaultOperatingMode);
        setCadence(template.defaultCadence);
        setModules(filterAccessibleModules(template.defaultModules));
        if (!isSoftwareProject({
            projectCategory: template.projectCategory,
            templateId: template.id,
            projectType: template.legacyProjectType
        }) && status === 'In Testing') {
            setStatus('Planning');
        }
        if (template.isCompanyProject) {
            setCompanyProjectId('');
            setCompanyProjectRole('other');
            setStartupTrackIds(template.suggestedStartupTrackIds || []);
            setStartupSensitiveTracksConfirmed(false);
        } else {
            setStartupTrackIds([]);
            setStartupSensitiveTracksConfirmed(false);
        }
    };

    const handleNext = () => {
        const currentTemplate = getProjectTemplateDefinition(templateId);
        const selectedSensitiveTracks = STARTUP_TRACK_DEFINITIONS.filter(track => (
            currentTemplate.isCompanyProject
            && track.sensitive
            && startupTrackIds.includes(track.id)
        ));
        if (currentStep === SETUP_WORKSTREAMS_STEP_ID && selectedSensitiveTracks.length > 0 && !startupSensitiveTracksConfirmed) {
            showToast(t('createProjectWizard.startup.confirmSensitive.error'), 'error');
            return;
        }
        if (currentStep === VISIBILITY_STEP_ID && visibilityMode === 'groups' && visibilityGroupIds.length === 0) {
            showToast(t('createProjectWizard.visibility.requiresGroup'), 'error');
            return;
        }

        setCurrentStep(c => {
            const next = getNextStepId(c, currentTemplate.isCompanyProject === true);
            setFurthestVisitedStep(max => Math.max(max, next));
            return next;
        });
    };

    const handleBack = () => {
        const currentTemplate = getProjectTemplateDefinition(templateId);
        setCurrentStep(c => getPreviousStepId(c, currentTemplate.isCompanyProject === true));
    };

    const handleStepClick = (stepIndex: number) => {
        // Only allow navigation to visited steps or the very next step
        if (stepIndex <= furthestVisitedStep) {
            setCurrentStep(stepIndex);
        }
    };

    const seedStartupProject = async (
        projectId: string,
        selectedTrackIds: StartupTrackId[],
        jurisdictionTemplateId: StartupJurisdictionTemplateId
    ) => {
        const selectedTracks = new Set(selectedTrackIds);
        const initiativeIdsByTrack = new Map<StartupTrackId, string>();

        const seedInitiatives = STARTUP_SEED_INITIATIVES.filter(initiative => selectedTracks.has(initiative.trackId));
        for (const initiative of seedInitiatives) {
            const initiativeId = await createInitiative(projectId, t(initiative.titleKey), {
                description: t(initiative.descriptionKey),
                priority: initiative.priority,
                status: 'Planning',
                source: 'template',
                templateId: 'startup_company_formation',
                templateTrack: initiative.trackId,
                templateSeedId: initiative.id,
                externalKey: `startup_company_formation:${initiative.id}`
            });
            initiativeIdsByTrack.set(initiative.trackId, initiativeId);
        }

        const seedMilestones = STARTUP_SEED_MILESTONES.filter(milestone => (
            milestone.trackIds.some(trackId => selectedTracks.has(trackId))
        ));
        for (const milestone of seedMilestones) {
            await createMilestone(projectId, {
                title: t(milestone.titleKey),
                description: t(milestone.descriptionKey),
                status: 'Pending',
                riskRating: milestone.riskRating,
                source: 'template',
                templateId: 'startup_company_formation',
                templateTrack: milestone.trackIds.find(trackId => selectedTracks.has(trackId)) || milestone.trackIds[0],
                templateSeedId: milestone.id,
                externalKey: `startup_company_formation:${milestone.id}`
            });
        }

        const seedTasks = [
            ...STARTUP_SEED_TASKS,
            ...STARTUP_JURISDICTION_SEED_TASKS.filter(task => (
                task.jurisdictionTemplateId === jurisdictionTemplateId
                && selectedTracks.has(task.trackId)
            ))
        ].filter(task => selectedTracks.has(task.trackId));
        for (const task of seedTasks) {
            const initiativeId = initiativeIdsByTrack.get(task.trackId);
            const track = STARTUP_TRACK_DEFINITIONS.find(item => item.id === task.trackId);
            const sourceReferences = getStartupSourceReferences(
                'jurisdictionTemplateId' in task ? task.jurisdictionTemplateId : jurisdictionTemplateId,
                task.sourceReferenceIds || []
            );
            const taskOptions = {
                description: t(task.descriptionKey),
                priority: task.priority,
                status: 'Open' as const,
                category: ['Startup', track ? t(track.labelKey) : 'Startup'],
                source: sourceReferences.length > 0 ? 'official_template' : 'template',
                templateId: 'startup_company_formation' as ProjectTemplateId,
                templateTrack: task.trackId,
                templateSeedId: task.id,
                sourceReferences,
                externalKey: `startup_company_formation:${task.id}`
            };

            if (initiativeId) {
                await createInitiativeTask(projectId, initiativeId, t(task.titleKey), taskOptions);
            } else {
                await addTask(projectId, t(task.titleKey), undefined, undefined, task.priority, taskOptions);
            }
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) return;
        if (startDate && dueDate && startDate > dueDate) {
            showToast(t('createProjectWizard.errors.dateOrder'), 'error');
            return;
        }
        if (visibilityMode === 'groups' && visibilityGroupIds.length === 0) {
            showToast(t('createProjectWizard.visibility.requiresGroup'), 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            const trimmedName = name.trim();
            const formattedStartDate = startDate ? format(startDate, 'yyyy-MM-dd') : '';
            const formattedDueDate = dueDate ? format(dueDate, 'yyyy-MM-dd') : '';
            const parsedSuccessCriteria = successCriteria
                .split(/\n|;/)
                .map(item => item.trim())
                .filter(Boolean);
            const brief = {
                ...(description.trim() && { objective: description.trim() }),
                ...(parsedSuccessCriteria.length > 0 && { successCriteria: parsedSuccessCriteria }),
                cadence
            };
            const hasBrief = Object.keys(brief).length > 1 || Boolean(brief.cadence);
            const selectedTemplate = getProjectTemplateDefinition(templateId);
            const trimmedCompanyProjectId = selectedTemplate.isCompanyProject ? '' : companyProjectId.trim();
            const jurisdictionTemplate = getStartupJurisdictionTemplate('', '');
            const selectedSensitiveTracks = STARTUP_TRACK_DEFINITIONS.filter(track => track.sensitive && startupTrackIds.includes(track.id));
            if (selectedTemplate.isCompanyProject && selectedSensitiveTracks.length > 0 && !startupSensitiveTracksConfirmed) {
                showToast(t('createProjectWizard.startup.confirmSensitive.error'), 'error');
                setIsSubmitting(false);
                return;
            }
            const jurisdictionSourcesReviewedAt = jurisdictionTemplate.sourceReferences[0]?.lastReviewedAt;
            const projectPayload: Partial<Project> = {
                title: trimmedName,
                description,
                projectType,
                projectCategory: selectedTemplate.projectCategory,
                templateId: selectedTemplate.id,
                ...(trimmedCompanyProjectId && {
                    companyProjectId: trimmedCompanyProjectId,
                    companyProjectRole
                }),
                operatingMode,
                dateConfidence,
                operatingModel: {
                    mode: operatingMode,
                    cadence,
                    dateConfidence
                },
                ...(hasBrief && { brief }),
                startDate: formattedStartDate,
                dueDate: formattedDueDate,
                priority: priorityValue,
                status: status as any,
                isPrivate,
                modules: safeModules,
                ...(selectedTemplate.isCompanyProject && {
                    startupProfile: {
                        workingName: trimmedName,
                        formationStatus: 'idea',
                        fundingRoute: 'undecided',
                        jurisdictionTemplateId: jurisdictionTemplate.id,
                        jurisdictionSources: jurisdictionTemplate.sourceReferences,
                        ...(jurisdictionSourcesReviewedAt && {
                            jurisdictionSourcesReviewedAt
                        }),
                        advisorReviewRequired: jurisdictionTemplate.advisorReviewRequired || selectedSensitiveTracks.length > 0,
                        regulatedIndustryStatus: 'unknown',
                        ...(formattedDueDate && {
                            targetLaunchDate: formattedDueDate
                        }),
                        selectedTrackIds: startupTrackIds
                    },
                    startupReadiness: {
                        legalStructureDecided: false,
                        founderAgreementReady: false,
                        ipAssignmentReady: false,
                        registrationSubmitted: false,
                        registrationConfirmed: false,
                        taxSetupReady: false,
                        bankAccountReady: false,
                        bookkeepingReady: false,
                        privacyDocsReady: false,
                        requiredPermitsKnown: false,
                        launchOfferReady: false,
                        firstChannelReady: false
                    }
                })
            };
            const projectId = await createProject(projectPayload, undefined, undefined, undefined, selectedMemberIds, undefined, visibilityGroupIds);
            let setupWarning = false;

            if (selectedTemplate.isCompanyProject && startupTrackIds.length > 0) {
                try {
                    await seedStartupProject(projectId, startupTrackIds, jurisdictionTemplate.id);
                } catch (setupError) {
                    setupWarning = true;
                    console.error('Project created, but startup setup seeding failed', setupError);
                }
            }

            onClose?.();
            navigate(`/project/${projectId}`);
            showToast(
                t(setupWarning ? 'createProjectWizard.toast.createdWithSetupWarning' : 'createProjectWizard.toast.created').replace('{name}', trimmedName),
                setupWarning ? 'info' : 'success'
            );
        } catch (e) {
            console.error(e);
            setIsSubmitting(false);
            showToast(t('createProjectWizard.errors.createProject'), 'error');
        }
    };

    const handleModuleToggle = (moduleId: string) => {
        // Map 'flows' from ModuleSelection to 'ideas' used in Wizard/Backend
        const targetId = moduleId === 'flows' ? 'ideas' : moduleId as ProjectModule;
        const option = MODULE_OPTIONS.find(item => item.id === targetId);
        if (!option) return;
        if (
            (targetId === 'social' && !isSocialAllowed)
            || (targetId === 'marketing' && !isMarketingAllowed)
            || (targetId === 'accounting' && !isAccountingAllowed)
        ) {
            return;
        }

        setModules(prev => {
            if (prev.includes(targetId)) {
                return prev.filter(m => m !== targetId);
            } else {
                return [...prev, targetId];
            }
        });
    };

    const handleStartupTrackToggle = (trackId: StartupTrackId) => {
        setStartupTrackIds(current => (
            current.includes(trackId)
                ? current.filter(id => id !== trackId)
                : [...current, trackId]
        ));
        setStartupSensitiveTracksConfirmed(false);
    };

    const handleVisibilitySelect = (mode: string) => {
        if (mode === 'everyone') {
            setVisibilityMode('everyone');
            setVisibilityGroupIds([]);
            setIsPrivate(false);
            return;
        }

        if (mode === 'groups') {
            if (workspaceGroups.length === 0) return;
            setVisibilityMode('groups');
            setIsPrivate(false);
            return;
        }

        if (mode === 'private') {
            setVisibilityMode('private');
            setIsPrivate(true);
            setVisibilityGroupIds([]);
        }
    };

    if (!can('canCreateProjects')) {
        return <div className="create-project__blocked">{t('createProjectWizard.errors.accessDenied')}</div>;
    }

    const selectedTemplate = getProjectTemplateDefinition(templateId);
    const isSelectedSoftwareProject = isSoftwareProject({
        projectCategory: selectedTemplate.projectCategory,
        templateId: selectedTemplate.id,
        projectType
    });
    const isCreatingCompanyProject = selectedTemplate.isCompanyProject === true;
    const visibleSteps = getWizardSteps(isCreatingCompanyProject);
    const finalStepId = visibleSteps[visibleSteps.length - 1]?.id ?? STEPS[STEPS.length - 1].id;
    const startupJurisdictionTemplate = getStartupJurisdictionTemplate('', '');
    const selectedStartupTracks = STARTUP_TRACK_DEFINITIONS.filter(track => startupTrackIds.includes(track.id));
    const selectedStartupTrackSet = new Set(startupTrackIds);
    const selectedSensitiveStartupTracks = selectedStartupTracks.filter(track => track.sensitive);
    const startupNeedsSensitiveConfirmation = isCreatingCompanyProject && selectedSensitiveStartupTracks.length > 0;
    const startupSeedMilestoneCount = STARTUP_SEED_MILESTONES.filter(milestone => (
        milestone.trackIds.some(trackId => selectedStartupTrackSet.has(trackId))
    )).length;
    const startupSeedTaskCount = STARTUP_SEED_TASKS.filter(task => selectedStartupTrackSet.has(task.trackId)).length
        + STARTUP_JURISDICTION_SEED_TASKS.filter(task => (
            task.jurisdictionTemplateId === startupJurisdictionTemplate.id
            && selectedStartupTrackSet.has(task.trackId)
        )).length;
    const startupSeedInitiativeCount = STARTUP_SEED_INITIATIVES.filter(initiative => selectedStartupTrackSet.has(initiative.trackId)).length;
    const companyProjectOptions = [
        { value: '', label: t('createProjectWizard.companyProject.none') },
        ...companyProjects.map(project => ({ value: project.id, label: project.title }))
    ];
    const companyProjectRoleOptions = [
        { value: 'product', label: t('projectCompanyRoles.product') },
        { value: 'marketing', label: t('projectCompanyRoles.marketing') },
        { value: 'finance', label: t('projectCompanyRoles.finance') },
        { value: 'legal', label: t('projectCompanyRoles.legal') },
        { value: 'operations', label: t('projectCompanyRoles.operations') },
        { value: 'funding', label: t('projectCompanyRoles.funding') },
        { value: 'research', label: t('projectCompanyRoles.research') },
        { value: 'other', label: t('projectCompanyRoles.other') }
    ];
    const operatingModeOptions = [
        { value: 'explore', label: t('createProjectWizard.brief.mode.explore') },
        { value: 'build', label: t('createProjectWizard.brief.mode.build') },
        { value: 'ship', label: t('createProjectWizard.brief.mode.ship') },
        { value: 'maintain', label: t('createProjectWizard.brief.mode.maintain') }
    ];
    const cadenceOptions = [
        { value: 'daily', label: t('createProjectWizard.brief.cadence.daily') },
        { value: 'weekly', label: t('createProjectWizard.brief.cadence.weekly') },
        { value: 'biweekly', label: t('createProjectWizard.brief.cadence.biweekly') },
        { value: 'monthly', label: t('createProjectWizard.brief.cadence.monthly') },
        { value: 'ad-hoc', label: t('createProjectWizard.brief.cadence.adHoc') }
    ];
    const priorityLabels: Record<Priority, string> = {
        low: t('tasks.priority.low'),
        medium: t('tasks.priority.medium'),
        high: t('tasks.priority.high'),
        urgent: t('tasks.priority.urgent'),
    };
    const projectPriorityOptions: Priority[] = ['low', 'medium', 'high', 'urgent'];
    const priorityIcons: Record<Priority, string> = {
        low: 'keyboard_arrow_down',
        medium: 'drag_handle',
        high: 'keyboard_double_arrow_up',
        urgent: 'priority_high'
    };

    const priorityValueMap: Record<Priority, 'Low' | 'Medium' | 'High' | 'Urgent'> = {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent',
    };

    const priorityValue = priorityValueMap[priority];

    const statusLabels: Record<string, string> = {
        Backlog: t('dashboard.projectStatus.backlog'),
        Planning: t('dashboard.projectStatus.planning'),
        Active: t('dashboard.projectStatus.active'),
        ...(isSelectedSoftwareProject ? { 'In Testing': t('dashboard.projectStatus.inTesting') } : {}),
        'On Hold': t('dashboard.projectStatus.onHold'),
    };
    const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
        value,
        label
    }));
    const statusLabel = statusLabels[status] || status;
    const templateSelectionItems = PROJECT_TEMPLATE_DEFINITIONS.map(template => ({
        id: template.id,
        title: t(template.labelKey),
        description: t(template.descriptionKey),
        icon: <span className="material-symbols-outlined">{template.icon}</span>
    }));
    const moduleAccess: Record<NonNullable<ModuleOption['gatedBy']>, boolean> = {
        social: isSocialAllowed,
        marketing: isMarketingAllowed,
        accounting: isAccountingAllowed
    };
    const wizardModuleOptions = MODULE_OPTIONS.filter(
        (option) => !isPmCoreOnly() || !PM_CORE_DEPRECATED_MODULES.includes(option.id)
    );
    const moduleSelectionItems = wizardModuleOptions.map(option => {
        const isLocked = option.gatedBy ? !moduleAccess[option.gatedBy] : false;
        return {
            id: option.id === 'ideas' ? 'flows' : option.id,
            title: t(option.labelKey),
            description: t(option.descKey),
            icon: <span className="material-symbols-outlined">{option.icon}</span>,
            disabled: isLocked,
            disabledReason: isLocked ? t('createProjectWizard.modules.locked') : undefined
        };
    });
    const startupTrackSelectionItems = STARTUP_TRACK_DEFINITIONS.map(track => ({
        id: track.id,
        title: t(track.labelKey),
        description: t(track.descriptionKey),
        icon: <span className="material-symbols-outlined">{track.icon}</span>
    }));
    const visibilitySelectionItems = [
        {
            id: 'everyone',
            title: t('createProjectWizard.visibility.everyone'),
            description: t('createProjectWizard.visibility.everyoneHint'),
            icon: <span className="material-symbols-outlined">public</span>
        },
        {
            id: 'groups',
            title: t('createProjectWizard.visibility.groups'),
            description: workspaceGroups.length === 0 ? t('createProjectWizard.visibility.noGroups') : t('createProjectWizard.visibility.groupsHint'),
            icon: <span className="material-symbols-outlined">lock_person</span>,
            disabled: workspaceGroups.length === 0,
            disabledReason: workspaceGroups.length === 0 ? t('createProjectWizard.visibility.noGroups') : undefined
        },
        {
            id: 'private',
            title: t('createProjectWizard.visibility.private'),
            description: t('createProjectWizard.visibility.privateHint'),
            icon: <span className="material-symbols-outlined">lock</span>
        }
    ];
    const invalidModuleIds = modules.filter(module => (
        !wizardModuleOptions.some(option => option.id === module)
        || (module === 'social' && !isSocialAllowed)
        || (module === 'marketing' && !isMarketingAllowed)
        || (module === 'accounting' && !isAccountingAllowed)
    ));
    const safeModules = modules.filter(module => !invalidModuleIds.includes(module));
    const dateRangeInvalid = Boolean(startDate && dueDate && startDate > dueDate);
    const cadenceIcons: Record<ProjectCadence, string> = {
        daily: 'today',
        weekly: 'view_week',
        biweekly: 'date_range',
        monthly: 'calendar_month',
        'ad-hoc': 'event_repeat'
    };
    const teamEmptyLabel = t('createProjectWizard.preview.teamEmpty');
    const deadlineValue = dueDate
        ? format(dueDate, dateFormat, { locale: dateLocale })
        : t('createProjectWizard.preview.deadlineEmpty');

    return (
        <div className="create-project">
            <div className="create-project__shell animate-fade-in">

                {/* LEFT: Form Panel */}
                <section className="create-project__form">

                    {/* Header */}
                    <header className="create-project__header">
                        <div className="create-project__header-title">
                            <div>
                                <h1>{t('createProjectWizard.header.title')}</h1>

                            </div>
                        </div>

                        {/* Step Pills */}
                        {/* Stepper Navigation */}
                        {/* Stepper Navigation (Pills) */}
                        <div className="create-project__stepper">
                            {visibleSteps.map((step) => {
                                const isActive = currentStep === step.id;
                                const isCompleted = currentStep > step.id;
                                const isClickable = step.id <= furthestVisitedStep;

                                return (
                                    <div
                                        key={step.id}
                                        className={`create-project__step-item ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-completed' : ''} ${isClickable ? 'is-clickable' : ''}`}
                                        onClick={() => handleStepClick(step.id)}
                                        role="button"
                                        tabIndex={isClickable ? 0 : -1}
                                        title={t(step.labelKey)} // Tooltip for context
                                    >
                                        <div className="create-project__step-indicator" />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="create-project__progress" style={{ display: 'none' }}>
                            {visibleSteps.slice(1).map((step) => (
                                <div
                                    key={step.id}
                                    className={`create-project__progress-pill ${currentStep >= step.id ? 'is-active' : ''}`}
                                />
                            ))}
                        </div>
                    </header>

                    {/* Content Area - Fixed Height with Overflow */}
                    <div className="create-project__content">

                        {/* Step 0: Type */}
                        {currentStep === 0 && (
                            <div className="create-project__step create-project__step--start animate-fade-in">
                                <StepHeader
                                    title={t('createProjectWizard.typeStep.title')}
                                    subtitle={t('createProjectWizard.typeStep.subtitle')}
                                />

                                <ModuleSelection
                                    modules={templateSelectionItems}
                                    selectedModules={[templateId]}
                                    onToggle={(nextTemplateId) => handleTemplateSelect(nextTemplateId as ProjectTemplateId)}
                                    ariaLabel={t('createProjectWizard.typeStep.title')}
                                    className="create-project__type-selection"
                                    selectionMode="single"
                                />
                            </div>
                        )}

                        {/* Step 1: Details */}
                        {currentStep === 1 && (
                            <div className="create-project__step animate-fade-in">
                                <StepHeader
                                    title={t('createProjectWizard.details.title')}
                                    subtitle={t('createProjectWizard.details.subtitle')}
                                />

                                <div className="create-project__form-grid create-project__form-grid--details">
                                    <TextInput
                                        label={t('createProjectWizard.details.name.label')}
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder={t('createProjectWizard.details.name.placeholder')}
                                        autoFocus
                                    />

                                    <div className="create-project__field">
                                        <div className="create-project__field-header">
                                            <label htmlFor={descriptionFieldId}>
                                                {t('createProjectWizard.details.description.label')}
                                            </label>
                                        </div>
                                        <TextArea
                                            id={descriptionFieldId}
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder={t('createProjectWizard.details.description.placeholder')}
                                            className="create-project__description-input"
                                        />
                                    </div>

                                    <div className="create-project__field create-project__field--wide">
                                        <label>{t('createProjectWizard.brief.successCriteria.label')}</label>
                                        <TextArea
                                            value={successCriteria}
                                            onChange={handleSuccessCriteriaChange}
                                            placeholder={t('createProjectWizard.brief.successCriteria.placeholder')}
                                            className="create-project__brief-input create-project__brief-input--short"
                                        />
                                    </div>

                                    {!isCreatingCompanyProject && (
                                        <div className="create-project__field create-project__field--wide">
                                            <Select
                                                label={t('createProjectWizard.companyProject.label')}
                                                value={companyProjectId}
                                                onChange={(value) => setCompanyProjectId(String(value))}
                                                options={companyProjectOptions}
                                                placeholder={t('createProjectWizard.companyProject.placeholder')}
                                            />
                                            {companyProjectId && (
                                                <div className="create-project__brief-options create-project__field--wide">
                                                    <Select
                                                        label={t('createProjectWizard.companyProject.roleLabel')}
                                                        value={companyProjectRole}
                                                        onChange={(value) => setCompanyProjectRole(value as CompanyProjectRole)}
                                                        options={companyProjectRoleOptions}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Setup Workstreams */}
                        {currentStep === SETUP_WORKSTREAMS_STEP_ID && isCreatingCompanyProject && (
                            <div className="create-project__step animate-fade-in">
                                <StepHeader
                                    title={t('createProjectWizard.startup.tracks.title')}
                                    subtitle={t('createProjectWizard.startup.tracks.subtitle')}
                                />

                                <div className="create-project__startup-panel create-project__startup-panel--tracks">
                                    <ModuleSelection
                                        modules={startupTrackSelectionItems}
                                        selectedModules={startupTrackIds}
                                        onToggle={(trackId) => handleStartupTrackToggle(trackId as StartupTrackId)}
                                        ariaLabel={t('createProjectWizard.startup.tracks.title')}
                                        className="create-project__startup-selection"
                                        selectionMode="multiple"
                                    />

                                    {startupNeedsSensitiveConfirmation && (
                                        <button
                                            type="button"
                                            className={`create-project__startup-sensitive ${startupSensitiveTracksConfirmed ? 'is-active' : ''}`}
                                            onClick={() => setStartupSensitiveTracksConfirmed(value => !value)}
                                        >
                                            <span className="create-project__startup-track-check" aria-hidden="true">
                                                {startupSensitiveTracksConfirmed && (
                                                    <span className="material-symbols-outlined">check</span>
                                                )}
                                            </span>
                                            <span>{t('createProjectWizard.startup.confirmSensitive.label')}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Modules */}
                        {currentStep === 3 && (
                            <div className="create-project__step animate-fade-in">
                                <StepHeader
                                    title={t('createProjectWizard.modules.title')}
                                    subtitle={t('createProjectWizard.modules.subtitle')}
                                />

                                <div className="create-project__selection-container">
                                    <ModuleSelection
                                        modules={moduleSelectionItems}
                                        selectedModules={safeModules.map(m => m === 'ideas' ? 'flows' : m)}
                                        onToggle={handleModuleToggle}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 4: Team */}
                        {currentStep === TEAM_STEP_ID && (
                            <div className="create-project__step animate-fade-in">
                                <StepHeader
                                    title={t('createProjectWizard.access.teamTitle')}
                                    subtitle={t('createProjectWizard.access.teamSubtitle')}
                                />

                                <div className="create-project__access-stack">
                                    <section className="create-project__access-section">
                                        {availableMembers.length === 0 ? (
                                            <div className="create-project__empty">
                                                <span className="material-symbols-outlined">group</span>
                                                <p>{t('createProjectWizard.team.empty')}</p>
                                            </div>
                                        ) : (
                                            <MemberSelection
                                                members={availableMembers}
                                                selectedIds={selectedMemberIds}
                                                onToggle={(id) => setSelectedMemberIds(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])}
                                                ariaLabel={t('createProjectWizard.access.teamTitle')}
                                                searchPlaceholder={t('createProjectWizard.team.search')}
                                                noResultsText={t('createProjectWizard.team.noSearchResults')}
                                            />
                                        )}
                                    </section>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Visibility */}
                        {currentStep === VISIBILITY_STEP_ID && (
                            <div className="create-project__step animate-fade-in">
                                <StepHeader
                                    title={t('createProjectWizard.access.visibilityTitle')}
                                    subtitle={t('createProjectWizard.access.visibilitySubtitle')}
                                />

                                <div className="create-project__access-stack">
                                    <section className="create-project__access-section">
                                        <ModuleSelection
                                            modules={visibilitySelectionItems}
                                            selectedModules={[visibilityMode]}
                                            onToggle={handleVisibilitySelect}
                                            ariaLabel={t('createProjectWizard.access.visibilityTitle')}
                                            className="create-project__visibility-selection"
                                            selectionMode="single"
                                        />

                                        {visibilityMode === 'groups' && workspaceGroups.length > 0 && (
                                            <div className="create-project__group-select animate-fade-in">
                                                <label>{t('createProjectWizard.visibility.selectGroups')}</label>
                                                <div className="create-project__group-grid">
                                                    {workspaceGroups.map(group => {
                                                        const isSelected = visibilityGroupIds.includes(group.id);
                                                        return (
                                                            <button
                                                                key={group.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setVisibilityGroupIds(prev => prev.filter(id => id !== group.id));
                                                                    } else {
                                                                        setVisibilityGroupIds(prev => [...prev, group.id]);
                                                                    }
                                                                }}
                                                                className={`create-project__group-chip ${isSelected ? 'is-active' : ''}`}
                                                            >
                                                                <span
                                                                    className="create-project__group-dot"
                                                                    style={{ backgroundColor: group.color || 'var(--color-text-subtle)' }}
                                                                />
                                                                <span className="create-project__group-name">{group.name}</span>
                                                                {isSelected && (
                                                                    <span className="material-symbols-outlined">check</span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {visibilityGroupIds.length === 0 && (
                                                    <p className="create-project__group-warning">
                                                        {t('createProjectWizard.visibility.requiresGroup')}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                </div>
                            </div>
                        )}

                        {/* Step 6: Timeline */}
                        {currentStep === 6 && (
                            <div className="create-project__step animate-fade-in">
                                <StepHeader
                                    title={t('createProjectWizard.timeline.title')}
                                    subtitle={t('createProjectWizard.timeline.subtitle')}
                                />

                                <div className="create-project__timeline-grid">
                                    <div className="create-project__timeline-control">
                                        <Select
                                            label={t('createProjectWizard.brief.operatingMode.label')}
                                            value={operatingMode}
                                            onChange={(value) => setOperatingMode(value as ProjectOperatingMode)}
                                            options={operatingModeOptions}
                                        />
                                    </div>
                                    <div className="create-project__timeline-control">
                                        <Select
                                            label={t('createProjectWizard.timeline.status')}
                                            value={status}
                                            onChange={(value) => setStatus(String(value) as ProjectStatus)}
                                            options={statusOptions}
                                        />
                                    </div>
                                    <div className="create-project__timeline-control">
                                        <DatePicker
                                            label={t('createProjectWizard.timeline.startDate')}
                                            value={startDate}
                                            onChange={setStartDate}
                                        />
                                    </div>
                                    <div className="create-project__timeline-control">
                                        <DatePicker
                                            label={t('createProjectWizard.timeline.dueDate')}
                                            value={dueDate}
                                            onChange={setDueDate}
                                        />
                                    </div>
                                    {dateRangeInvalid && (
                                        <div className="create-project__date-error">
                                            <span className="material-symbols-outlined">error</span>
                                            {t('createProjectWizard.errors.dateOrder')}
                                        </div>
                                    )}
                                    <div className="create-project__field create-project__timeline-control create-project__timeline-control--priority">
                                        <label>{t('createProjectWizard.timeline.priority')}</label>
                                        <div className="create-project__priority-grid" role="radiogroup" aria-label={t('createProjectWizard.timeline.priority')}>
                                            {projectPriorityOptions.map((option) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={priority === option}
                                                    className={`create-project__priority-option ${priority === option ? 'is-active' : ''}`}
                                                    data-priority={option}
                                                    onClick={() => setPriority(option)}
                                                >
                                                    <span className="material-symbols-outlined">{priorityIcons[option]}</span>
                                                    <span>{priorityLabels[option]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="create-project__timeline-control create-project__timeline-control--cadence">
                                        <label>{t('createProjectWizard.brief.cadence.label')}</label>
                                        <div className="create-project__cadence-rhythm" role="radiogroup" aria-label={t('createProjectWizard.brief.cadence.label')}>
                                            {cadenceOptions.map(option => {
                                                const optionValue = option.value as ProjectCadence;
                                                const isActive = cadence === optionValue;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={isActive}
                                                        className={`create-project__cadence-rhythm-option ${isActive ? 'is-active' : ''}`}
                                                        onClick={() => setCadence(optionValue)}
                                                    >
                                                        <span className="create-project__cadence-rhythm-icon material-symbols-outlined" aria-hidden="true">
                                                            {cadenceIcons[optionValue]}
                                                        </span>
                                                        <span className="create-project__cadence-rhythm-label">{option.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="create-project__post-create-note">
                                    <span className="material-symbols-outlined">info</span>
                                    <span>{t('createProjectWizard.timeline.postCreateHint')}</span>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Footer */}
                    <footer className="create-project__footer">
                        <div>
                            {currentStep > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                    icon={<span className="material-symbols-outlined">arrow_back</span>}
                                >
                                    {t('createProjectWizard.actions.back')}
                                </Button>
                            )}
                        </div>
                        <div className="create-project__footer-actions">
                            {currentStep !== finalStepId && (
                                <Button
                                    onClick={handleNext}
                                    disabled={
                                        (currentStep === 1 && !name.trim())
                                        || (currentStep === SETUP_WORKSTREAMS_STEP_ID && startupNeedsSensitiveConfirmation && !startupSensitiveTracksConfirmed)
                                        || (currentStep === VISIBILITY_STEP_ID && visibilityMode === 'groups' && visibilityGroupIds.length === 0)
                                    }
                                >
                                    {t('createProjectWizard.actions.continue')}
                                </Button>
                            )}
                            {currentStep === finalStepId && (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !name.trim() || dateRangeInvalid || (startupNeedsSensitiveConfirmation && !startupSensitiveTracksConfirmed)}
                                    isLoading={isSubmitting}
                                >
                                    {isSubmitting ? t('createProjectWizard.actions.creating') : t('createProjectWizard.actions.create')}
                                </Button>
                            )}
                        </div>
                    </footer>
                </section>

                {/* RIGHT: Preview Panel */}
                <aside className="create-project__preview">
                    <Card className="create-project__preview-card">
                        <div className="create-project__preview-cover">
                            <div className="create-project__preview-cover-placeholder">
                                <span className="material-symbols-outlined">landscape</span>
                            </div>
                            <div className="create-project__preview-status">
                                {statusLabel}
                            </div>
                        </div>

                        <div className="create-project__preview-body">
                            <div className="create-project__preview-icon">
                                <span className="material-symbols-outlined create-project__preview-icon-fallback">{selectedTemplate.icon}</span>
                            </div>

                            <div className="create-project__preview-info">
                                <h3 className="create-project__preview-title">{name || t('createProjectWizard.preview.nameFallback')}</h3>
                                <p className="create-project__preview-description">
                                    {description || t('createProjectWizard.preview.descriptionFallback')}
                                </p>
                                <span className="create-project__preview-template">
                                    {t(selectedTemplate.labelKey)}
                                </span>
                            </div>

                            <div className="create-project__preview-meta">
                                <div className="create-project__preview-meta-block">
                                    <span className="create-project__preview-label">{t('createProjectWizard.preview.team')}</span>
                                    <div className="create-project__preview-team">
                                        <div className="create-project__preview-team-list">
                                            {selectedMemberIds.length > 0 ? selectedMemberIds.slice(0, 3).map((id) => {
                                                const member = availableMembers.find((item) => item.uid === id);
                                                return (
                                                    <div key={id} className="create-project__preview-avatar">
                                                        {member?.photoURL ? (
                                                            <img src={member.photoURL} className="create-project__preview-avatar-image" alt="" />
                                                        ) : (
                                                            member?.displayName?.charAt(0) || '?'
                                                        )}
                                                    </div>
                                                );
                                            }) : (
                                                <span className="create-project__preview-empty">{teamEmptyLabel}</span>
                                            )}
                                            {selectedMemberIds.length > 3 && (
                                                <div className="create-project__preview-avatar create-project__preview-avatar--more">
                                                    +{selectedMemberIds.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="create-project__preview-meta-block create-project__preview-meta-block--right">
                                    <span className="create-project__preview-label">{t('createProjectWizard.preview.deadline')}</span>
                                    <span className="create-project__preview-date">{deadlineValue}</span>
                                </div>
                            </div>

                            {isCreatingCompanyProject && (
                                <div className="create-project__preview-startup">
                                    <div>
                                        <span>{t('createProjectWizard.startup.preview.seeded')}</span>
                                        <strong>{startupSeedInitiativeCount + startupSeedMilestoneCount + startupSeedTaskCount}</strong>
                                    </div>
                                    <div>
                                        <span>{t('createProjectWizard.startup.preview.tracks')}</span>
                                        <strong>{startupTrackIds.length}</strong>
                                    </div>
                                </div>
                            )}

                            <div className="create-project__preview-footer">
                                <div className="create-project__preview-modules">
                                    {safeModules.slice(0, 5).map((module) => {
                                        const option = MODULE_OPTIONS.find(item => item.id === module);
                                        return (
                                            <span
                                                key={module}
                                                className="create-project__preview-module-dot"
                                                title={option ? t(option.labelKey) : module}
                                            />
                                        );
                                    })}
                                    {safeModules.length > 5 && (
                                        <span className="create-project__preview-module-more">+{safeModules.length - 5}</span>
                                    )}
                                </div>
                                <span className={`create-project__preview-priority create-project__preview-priority--${priority}`}>
                                    {priorityLabels[priority] || priority}
                                </span>
                            </div>
                        </div>
                    </Card>
                </aside>
            </div>
        </div>
    );
};
