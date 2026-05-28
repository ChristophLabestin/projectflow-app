import type {
    Project,
    ProjectCadence,
    ProjectCategory,
    ProjectModule,
    ProjectOperatingMode,
    StartupJurisdictionTemplateId,
    StartupSourceReference,
    ProjectTemplateId,
    ProjectType,
    StartupTrackId
} from '../types';

export type ProjectTemplateDefinition = {
    id: ProjectTemplateId;
    labelKey: string;
    descriptionKey: string;
    icon: string;
    projectCategory: ProjectCategory;
    legacyProjectType: ProjectType;
    defaultModules: ProjectModule[];
    defaultOperatingMode: ProjectOperatingMode;
    defaultCadence: ProjectCadence;
    isCompanyProject?: boolean;
    suggestedStartupTrackIds?: StartupTrackId[];
};

export type StartupTrackDefinition = {
    id: StartupTrackId;
    labelKey: string;
    descriptionKey: string;
    icon: string;
    sensitive?: boolean;
};

export type StartupSeedTaskDefinition = {
    id: string;
    trackId: StartupTrackId;
    titleKey: string;
    descriptionKey: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    sourceReferenceIds?: string[];
};

export type StartupSeedMilestoneDefinition = {
    id: string;
    titleKey: string;
    descriptionKey: string;
    trackIds: StartupTrackId[];
    riskRating: 'Low' | 'Medium' | 'High';
};

export type StartupSeedInitiativeDefinition = {
    id: string;
    trackId: StartupTrackId;
    titleKey: string;
    descriptionKey: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
};

export type StartupJurisdictionTemplateDefinition = {
    id: StartupJurisdictionTemplateId;
    labelKey: string;
    descriptionKey: string;
    countryCodes: string[];
    regionHintKey?: string;
    advisorReviewRequired: boolean;
    suggestedStartupTrackIds: StartupTrackId[];
    sourceReferences: StartupSourceReference[];
};

export type StartupJurisdictionSeedTaskDefinition = StartupSeedTaskDefinition & {
    jurisdictionTemplateId: StartupJurisdictionTemplateId;
};

const SOURCE_REVIEW_DATE = '2026-05-27';

export const PROJECT_TEMPLATE_DEFINITIONS: ProjectTemplateDefinition[] = [
    {
        id: 'blank',
        labelKey: 'projectTemplates.blank.label',
        descriptionKey: 'projectTemplates.blank.description',
        icon: 'folder_open',
        projectCategory: 'general',
        legacyProjectType: 'standard',
        defaultModules: ['tasks', 'initiatives', 'ideas', 'milestones', 'activity'],
        defaultOperatingMode: 'build',
        defaultCadence: 'weekly'
    },
    {
        id: 'software_release',
        labelKey: 'projectTemplates.softwareRelease.label',
        descriptionKey: 'projectTemplates.softwareRelease.description',
        icon: 'terminal',
        projectCategory: 'software',
        legacyProjectType: 'software',
        defaultModules: ['tasks', 'initiatives', 'issues', 'activity'],
        defaultOperatingMode: 'build',
        defaultCadence: 'weekly'
    },
    {
        id: 'creative_project',
        labelKey: 'projectTemplates.creativeProject.label',
        descriptionKey: 'projectTemplates.creativeProject.description',
        icon: 'palette',
        projectCategory: 'creative',
        legacyProjectType: 'creative',
        defaultModules: ['ideas', 'initiatives', 'tasks', 'activity'],
        defaultOperatingMode: 'explore',
        defaultCadence: 'weekly'
    },
    {
        id: 'client_delivery',
        labelKey: 'projectTemplates.clientDelivery.label',
        descriptionKey: 'projectTemplates.clientDelivery.description',
        icon: 'handshake',
        projectCategory: 'client_delivery',
        legacyProjectType: 'standard',
        defaultModules: ['tasks', 'initiatives', 'milestones', 'activity'],
        defaultOperatingMode: 'ship',
        defaultCadence: 'weekly'
    },
    {
        id: 'startup_company_formation',
        labelKey: 'projectTemplates.startupCompany.label',
        descriptionKey: 'projectTemplates.startupCompany.description',
        icon: 'domain_add',
        projectCategory: 'startup_company',
        legacyProjectType: 'standard',
        defaultModules: ['tasks', 'initiatives', 'ideas', 'milestones', 'activity', 'accounting', 'marketing'],
        defaultOperatingMode: 'explore',
        defaultCadence: 'weekly',
        isCompanyProject: true,
        suggestedStartupTrackIds: [
            'validation',
            'legal_formation',
            'finance_accounting',
            'product_delivery',
            'marketing_sales',
            'operations'
        ]
    },
    {
        id: 'marketing_campaign',
        labelKey: 'projectTemplates.marketingCampaign.label',
        descriptionKey: 'projectTemplates.marketingCampaign.description',
        icon: 'campaign',
        projectCategory: 'marketing',
        legacyProjectType: 'standard',
        defaultModules: ['tasks', 'initiatives', 'ideas', 'milestones', 'activity', 'marketing', 'social'],
        defaultOperatingMode: 'ship',
        defaultCadence: 'weekly'
    },
    {
        id: 'internal_operations',
        labelKey: 'projectTemplates.internalOperations.label',
        descriptionKey: 'projectTemplates.internalOperations.description',
        icon: 'tune',
        projectCategory: 'operations',
        legacyProjectType: 'standard',
        defaultModules: ['tasks', 'initiatives', 'milestones', 'activity'],
        defaultOperatingMode: 'maintain',
        defaultCadence: 'biweekly'
    },
    {
        id: 'finance_setup',
        labelKey: 'projectTemplates.financeSetup.label',
        descriptionKey: 'projectTemplates.financeSetup.description',
        icon: 'account_balance',
        projectCategory: 'finance',
        legacyProjectType: 'standard',
        defaultModules: ['tasks', 'initiatives', 'milestones', 'activity', 'accounting'],
        defaultOperatingMode: 'build',
        defaultCadence: 'monthly'
    }
];

export const STARTUP_TRACK_DEFINITIONS: StartupTrackDefinition[] = [
    {
        id: 'validation',
        labelKey: 'startupTracks.validation.label',
        descriptionKey: 'startupTracks.validation.description',
        icon: 'fact_check'
    },
    {
        id: 'legal_formation',
        labelKey: 'startupTracks.legalFormation.label',
        descriptionKey: 'startupTracks.legalFormation.description',
        icon: 'gavel',
        sensitive: true
    },
    {
        id: 'finance_accounting',
        labelKey: 'startupTracks.financeAccounting.label',
        descriptionKey: 'startupTracks.financeAccounting.description',
        icon: 'account_balance',
        sensitive: true
    },
    {
        id: 'compliance',
        labelKey: 'startupTracks.compliance.label',
        descriptionKey: 'startupTracks.compliance.description',
        icon: 'verified_user',
        sensitive: true
    },
    {
        id: 'product_delivery',
        labelKey: 'startupTracks.productDelivery.label',
        descriptionKey: 'startupTracks.productDelivery.description',
        icon: 'rocket_launch'
    },
    {
        id: 'marketing_sales',
        labelKey: 'startupTracks.marketingSales.label',
        descriptionKey: 'startupTracks.marketingSales.description',
        icon: 'campaign'
    },
    {
        id: 'funding',
        labelKey: 'startupTracks.funding.label',
        descriptionKey: 'startupTracks.funding.description',
        icon: 'payments',
        sensitive: true
    },
    {
        id: 'operations',
        labelKey: 'startupTracks.operations.label',
        descriptionKey: 'startupTracks.operations.description',
        icon: 'settings_suggest'
    }
];

export const STARTUP_JURISDICTION_TEMPLATES: StartupJurisdictionTemplateDefinition[] = [
    {
        id: 'global_generic',
        labelKey: 'startupJurisdictions.global.label',
        descriptionKey: 'startupJurisdictions.global.description',
        countryCodes: [],
        advisorReviewRequired: true,
        suggestedStartupTrackIds: ['validation', 'legal_formation', 'finance_accounting', 'compliance', 'operations'],
        sourceReferences: []
    },
    {
        id: 'de_generic',
        labelKey: 'startupJurisdictions.de.label',
        descriptionKey: 'startupJurisdictions.de.description',
        countryCodes: ['DE', 'DEU', 'GERMANY', 'DEUTSCHLAND'],
        regionHintKey: 'startupJurisdictions.de.regionHint',
        advisorReviewRequired: true,
        suggestedStartupTrackIds: ['legal_formation', 'finance_accounting', 'compliance', 'operations'],
        sourceReferences: [
            {
                id: 'de-bmwk-rechtsformen',
                labelKey: 'startupSources.de.bmwkRechtsformen',
                url: 'https://www.existenzgruendungsportal.de/Navigation/DE/Gruendungswissen/Rechtsformen/rechtsformen',
                publisher: 'BMWK Existenzgründungsportal',
                lastReviewedAt: SOURCE_REVIEW_DATE
            },
            {
                id: 'de-bmwk-anmeldung-recht',
                labelKey: 'startupSources.de.bmwkAnmeldungRecht',
                url: 'https://www.existenzgruendungsportal.de/Redaktion/DE/Downloads/DE/GruenderZeiten/GruenderZeiten-24.pdf?__blob=publicationFile',
                publisher: 'BMWK Existenzgründungsportal',
                lastReviewedAt: SOURCE_REVIEW_DATE
            },
            {
                id: 'de-ihk-formal-steps',
                labelKey: 'startupSources.de.ihkFormalSteps',
                url: 'https://www.ihk.de/stuttgart/gruendung/orientierungsphase/anmeldung-eines-unternehmens/formerfordernisse-einer-gruendung-685190',
                publisher: 'IHK Region Stuttgart',
                lastReviewedAt: SOURCE_REVIEW_DATE
            },
            {
                id: 'de-ihk-tax-registration',
                labelKey: 'startupSources.de.ihkTaxRegistration',
                url: 'https://www.ihk.de/darmstadt/produktmarken/gruendung/existenzgruendung-und-steuern/aufnahme-einer-gewerblichen-taetigkeit-2538356',
                publisher: 'IHK Darmstadt',
                lastReviewedAt: SOURCE_REVIEW_DATE
            }
        ]
    },
    {
        id: 'us_generic',
        labelKey: 'startupJurisdictions.us.label',
        descriptionKey: 'startupJurisdictions.us.description',
        countryCodes: ['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'],
        regionHintKey: 'startupJurisdictions.us.regionHint',
        advisorReviewRequired: true,
        suggestedStartupTrackIds: ['legal_formation', 'finance_accounting', 'compliance', 'operations'],
        sourceReferences: [
            {
                id: 'us-sba-launch',
                labelKey: 'startupSources.us.sbaLaunch',
                url: 'https://www.sba.gov/business-guide/launch-your-business',
                publisher: 'U.S. Small Business Administration',
                lastReviewedAt: SOURCE_REVIEW_DATE
            },
            {
                id: 'us-sba-register',
                labelKey: 'startupSources.us.sbaRegister',
                url: 'https://www.sba.gov/business-guide/launch-your-business/register-your-business',
                publisher: 'U.S. Small Business Administration',
                lastReviewedAt: SOURCE_REVIEW_DATE
            },
            {
                id: 'us-sba-tax-id',
                labelKey: 'startupSources.us.sbaTaxId',
                url: 'https://www.sba.gov/business-guide/launch-your-business/get-federal-state-tax-id-numbers',
                publisher: 'U.S. Small Business Administration',
                lastReviewedAt: SOURCE_REVIEW_DATE
            },
            {
                id: 'us-irs-starting-business',
                labelKey: 'startupSources.us.irsStartingBusiness',
                url: 'https://www.irs.gov/businesses/small-businesses-self-employed/starting-a-business',
                publisher: 'Internal Revenue Service',
                lastReviewedAt: SOURCE_REVIEW_DATE
            }
        ]
    }
];

export const STARTUP_SEED_INITIATIVES: StartupSeedInitiativeDefinition[] = [
    {
        id: 'validation-system',
        trackId: 'validation',
        titleKey: 'startupSeeds.initiatives.validation.title',
        descriptionKey: 'startupSeeds.initiatives.validation.description',
        priority: 'High'
    },
    {
        id: 'formation-readiness',
        trackId: 'legal_formation',
        titleKey: 'startupSeeds.initiatives.legalFormation.title',
        descriptionKey: 'startupSeeds.initiatives.legalFormation.description',
        priority: 'High'
    },
    {
        id: 'finance-foundation',
        trackId: 'finance_accounting',
        titleKey: 'startupSeeds.initiatives.financeAccounting.title',
        descriptionKey: 'startupSeeds.initiatives.financeAccounting.description',
        priority: 'High'
    },
    {
        id: 'compliance-review',
        trackId: 'compliance',
        titleKey: 'startupSeeds.initiatives.compliance.title',
        descriptionKey: 'startupSeeds.initiatives.compliance.description',
        priority: 'High'
    },
    {
        id: 'offer-delivery',
        trackId: 'product_delivery',
        titleKey: 'startupSeeds.initiatives.productDelivery.title',
        descriptionKey: 'startupSeeds.initiatives.productDelivery.description',
        priority: 'Medium'
    },
    {
        id: 'go-to-market',
        trackId: 'marketing_sales',
        titleKey: 'startupSeeds.initiatives.marketingSales.title',
        descriptionKey: 'startupSeeds.initiatives.marketingSales.description',
        priority: 'Medium'
    },
    {
        id: 'funding-path',
        trackId: 'funding',
        titleKey: 'startupSeeds.initiatives.funding.title',
        descriptionKey: 'startupSeeds.initiatives.funding.description',
        priority: 'Medium'
    },
    {
        id: 'operating-rhythm',
        trackId: 'operations',
        titleKey: 'startupSeeds.initiatives.operations.title',
        descriptionKey: 'startupSeeds.initiatives.operations.description',
        priority: 'Medium'
    }
];

export const STARTUP_SEED_TASKS: StartupSeedTaskDefinition[] = [
    { id: 'validation-customer', trackId: 'validation', titleKey: 'startupSeeds.tasks.validationCustomer.title', descriptionKey: 'startupSeeds.tasks.validationCustomer.description', priority: 'High' },
    { id: 'validation-evidence', trackId: 'validation', titleKey: 'startupSeeds.tasks.validationEvidence.title', descriptionKey: 'startupSeeds.tasks.validationEvidence.description', priority: 'Medium' },
    { id: 'validation-success', trackId: 'validation', titleKey: 'startupSeeds.tasks.validationSuccess.title', descriptionKey: 'startupSeeds.tasks.validationSuccess.description', priority: 'Medium' },
    { id: 'legal-structure', trackId: 'legal_formation', titleKey: 'startupSeeds.tasks.legalStructure.title', descriptionKey: 'startupSeeds.tasks.legalStructure.description', priority: 'High' },
    { id: 'legal-founder-agreement', trackId: 'legal_formation', titleKey: 'startupSeeds.tasks.legalFounderAgreement.title', descriptionKey: 'startupSeeds.tasks.legalFounderAgreement.description', priority: 'High' },
    { id: 'legal-registration', trackId: 'legal_formation', titleKey: 'startupSeeds.tasks.legalRegistration.title', descriptionKey: 'startupSeeds.tasks.legalRegistration.description', priority: 'High' },
    { id: 'finance-budget', trackId: 'finance_accounting', titleKey: 'startupSeeds.tasks.financeBudget.title', descriptionKey: 'startupSeeds.tasks.financeBudget.description', priority: 'High' },
    { id: 'finance-bookkeeping', trackId: 'finance_accounting', titleKey: 'startupSeeds.tasks.financeBookkeeping.title', descriptionKey: 'startupSeeds.tasks.financeBookkeeping.description', priority: 'High' },
    { id: 'finance-bank-tax', trackId: 'finance_accounting', titleKey: 'startupSeeds.tasks.financeBankTax.title', descriptionKey: 'startupSeeds.tasks.financeBankTax.description', priority: 'High' },
    { id: 'compliance-permits', trackId: 'compliance', titleKey: 'startupSeeds.tasks.compliancePermits.title', descriptionKey: 'startupSeeds.tasks.compliancePermits.description', priority: 'High' },
    { id: 'compliance-privacy', trackId: 'compliance', titleKey: 'startupSeeds.tasks.compliancePrivacy.title', descriptionKey: 'startupSeeds.tasks.compliancePrivacy.description', priority: 'High' },
    { id: 'compliance-advisor', trackId: 'compliance', titleKey: 'startupSeeds.tasks.complianceAdvisor.title', descriptionKey: 'startupSeeds.tasks.complianceAdvisor.description', priority: 'Medium' },
    { id: 'product-offer', trackId: 'product_delivery', titleKey: 'startupSeeds.tasks.productOffer.title', descriptionKey: 'startupSeeds.tasks.productOffer.description', priority: 'High' },
    { id: 'product-delivery', trackId: 'product_delivery', titleKey: 'startupSeeds.tasks.productDelivery.title', descriptionKey: 'startupSeeds.tasks.productDelivery.description', priority: 'Medium' },
    { id: 'product-support', trackId: 'product_delivery', titleKey: 'startupSeeds.tasks.productSupport.title', descriptionKey: 'startupSeeds.tasks.productSupport.description', priority: 'Medium' },
    { id: 'marketing-positioning', trackId: 'marketing_sales', titleKey: 'startupSeeds.tasks.marketingPositioning.title', descriptionKey: 'startupSeeds.tasks.marketingPositioning.description', priority: 'High' },
    { id: 'marketing-channel', trackId: 'marketing_sales', titleKey: 'startupSeeds.tasks.marketingChannel.title', descriptionKey: 'startupSeeds.tasks.marketingChannel.description', priority: 'Medium' },
    { id: 'marketing-sales-loop', trackId: 'marketing_sales', titleKey: 'startupSeeds.tasks.marketingSalesLoop.title', descriptionKey: 'startupSeeds.tasks.marketingSalesLoop.description', priority: 'Medium' },
    { id: 'funding-needs', trackId: 'funding', titleKey: 'startupSeeds.tasks.fundingNeeds.title', descriptionKey: 'startupSeeds.tasks.fundingNeeds.description', priority: 'Medium' },
    { id: 'funding-materials', trackId: 'funding', titleKey: 'startupSeeds.tasks.fundingMaterials.title', descriptionKey: 'startupSeeds.tasks.fundingMaterials.description', priority: 'Medium' },
    { id: 'funding-pipeline', trackId: 'funding', titleKey: 'startupSeeds.tasks.fundingPipeline.title', descriptionKey: 'startupSeeds.tasks.fundingPipeline.description', priority: 'Medium' },
    { id: 'operations-cadence', trackId: 'operations', titleKey: 'startupSeeds.tasks.operationsCadence.title', descriptionKey: 'startupSeeds.tasks.operationsCadence.description', priority: 'Medium' },
    { id: 'operations-resources', trackId: 'operations', titleKey: 'startupSeeds.tasks.operationsResources.title', descriptionKey: 'startupSeeds.tasks.operationsResources.description', priority: 'Medium' },
    { id: 'operations-advisors', trackId: 'operations', titleKey: 'startupSeeds.tasks.operationsAdvisors.title', descriptionKey: 'startupSeeds.tasks.operationsAdvisors.description', priority: 'Medium' }
];

export const STARTUP_JURISDICTION_SEED_TASKS: StartupJurisdictionSeedTaskDefinition[] = [
    {
        id: 'de-choose-legal-form',
        jurisdictionTemplateId: 'de_generic',
        trackId: 'legal_formation',
        titleKey: 'startupJurisdictionSeeds.de.legalForm.title',
        descriptionKey: 'startupJurisdictionSeeds.de.legalForm.description',
        priority: 'High',
        sourceReferenceIds: ['de-bmwk-rechtsformen']
    },
    {
        id: 'de-register-business-and-tax',
        jurisdictionTemplateId: 'de_generic',
        trackId: 'finance_accounting',
        titleKey: 'startupJurisdictionSeeds.de.taxRegistration.title',
        descriptionKey: 'startupJurisdictionSeeds.de.taxRegistration.description',
        priority: 'High',
        sourceReferenceIds: ['de-ihk-tax-registration', 'de-ihk-formal-steps']
    },
    {
        id: 'de-authorities-and-permits',
        jurisdictionTemplateId: 'de_generic',
        trackId: 'compliance',
        titleKey: 'startupJurisdictionSeeds.de.authorities.title',
        descriptionKey: 'startupJurisdictionSeeds.de.authorities.description',
        priority: 'High',
        sourceReferenceIds: ['de-bmwk-anmeldung-recht', 'de-ihk-formal-steps']
    },
    {
        id: 'us-entity-state-registration',
        jurisdictionTemplateId: 'us_generic',
        trackId: 'legal_formation',
        titleKey: 'startupJurisdictionSeeds.us.stateRegistration.title',
        descriptionKey: 'startupJurisdictionSeeds.us.stateRegistration.description',
        priority: 'High',
        sourceReferenceIds: ['us-sba-register']
    },
    {
        id: 'us-ein-and-tax-setup',
        jurisdictionTemplateId: 'us_generic',
        trackId: 'finance_accounting',
        titleKey: 'startupJurisdictionSeeds.us.einTax.title',
        descriptionKey: 'startupJurisdictionSeeds.us.einTax.description',
        priority: 'High',
        sourceReferenceIds: ['us-sba-tax-id', 'us-irs-starting-business']
    },
    {
        id: 'us-licenses-permits-insurance',
        jurisdictionTemplateId: 'us_generic',
        trackId: 'compliance',
        titleKey: 'startupJurisdictionSeeds.us.permits.title',
        descriptionKey: 'startupJurisdictionSeeds.us.permits.description',
        priority: 'High',
        sourceReferenceIds: ['us-sba-launch', 'us-sba-register']
    }
];

export const STARTUP_SEED_MILESTONES: StartupSeedMilestoneDefinition[] = [
    {
        id: 'validation-gate',
        titleKey: 'startupSeeds.milestones.validationGate.title',
        descriptionKey: 'startupSeeds.milestones.validationGate.description',
        trackIds: ['validation'],
        riskRating: 'Medium'
    },
    {
        id: 'formation-ready',
        titleKey: 'startupSeeds.milestones.formationReady.title',
        descriptionKey: 'startupSeeds.milestones.formationReady.description',
        trackIds: ['legal_formation', 'finance_accounting', 'compliance'],
        riskRating: 'High'
    },
    {
        id: 'launch-gate',
        titleKey: 'startupSeeds.milestones.launchGate.title',
        descriptionKey: 'startupSeeds.milestones.launchGate.description',
        trackIds: ['product_delivery', 'marketing_sales', 'compliance'],
        riskRating: 'High'
    },
    {
        id: 'operating-cadence',
        titleKey: 'startupSeeds.milestones.operatingCadence.title',
        descriptionKey: 'startupSeeds.milestones.operatingCadence.description',
        trackIds: ['operations', 'finance_accounting'],
        riskRating: 'Medium'
    }
];

export const getProjectTemplateDefinition = (templateId?: ProjectTemplateId | string): ProjectTemplateDefinition => (
    PROJECT_TEMPLATE_DEFINITIONS.find((template) => template.id === templateId) || PROJECT_TEMPLATE_DEFINITIONS[0]
);

export const isCompanyProjectTemplate = (templateId?: ProjectTemplateId | string): boolean => (
    getProjectTemplateDefinition(templateId).isCompanyProject === true
);

export const isCompanyProject = (project: Pick<Project, 'projectCategory' | 'templateId' | 'projectType'>): boolean => (
    project.projectCategory === 'startup_company'
    || project.templateId === 'startup_company_formation'
);

export const isSoftwareProject = (project: Pick<Project, 'projectCategory' | 'templateId' | 'projectType'>): boolean => (
    project.projectCategory === 'software'
    || project.templateId === 'software_release'
    || project.projectType === 'software'
);

export const resolveProjectTemplateId = (project: Pick<Project, 'projectCategory' | 'templateId' | 'projectType'>): ProjectTemplateId => {
    if (project.templateId) return project.templateId;
    if (project.projectCategory === 'startup_company') return 'startup_company_formation';
    if (project.projectCategory === 'client_delivery') return 'client_delivery';
    if (project.projectCategory === 'marketing') return 'marketing_campaign';
    if (project.projectCategory === 'operations') return 'internal_operations';
    if (project.projectCategory === 'finance') return 'finance_setup';
    if (project.projectType === 'software') return 'software_release';
    if (project.projectType === 'creative') return 'creative_project';
    return 'blank';
};

export const getStartupJurisdictionTemplate = (
    country?: string,
    _region?: string
): StartupJurisdictionTemplateDefinition => {
    const normalizedCountry = (country || '').trim().toUpperCase();
    if (!normalizedCountry) {
        return STARTUP_JURISDICTION_TEMPLATES[0];
    }

    return STARTUP_JURISDICTION_TEMPLATES.find(template => (
        template.countryCodes.includes(normalizedCountry)
    )) || STARTUP_JURISDICTION_TEMPLATES[0];
};

export const getStartupSourceReferences = (
    jurisdictionTemplateId?: StartupJurisdictionTemplateId,
    sourceReferenceIds: string[] = []
): StartupSourceReference[] => {
    const template = STARTUP_JURISDICTION_TEMPLATES.find(item => item.id === jurisdictionTemplateId);
    if (!template || sourceReferenceIds.length === 0) return [];
    const wanted = new Set(sourceReferenceIds);
    return template.sourceReferences.filter(reference => wanted.has(reference.id));
};
