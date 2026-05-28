import { describe, expect, it } from 'vitest';

import type { Project, Task } from '../../types';
import { calculateCompanyLinkedProjectRollup, calculateStartupReadinessSnapshot } from '../startupProjects';

const baseProject: Project = {
    id: 'company-1',
    title: 'NewCo',
    description: '',
    progress: 0,
    status: 'Active',
    ownerId: 'owner-1',
    projectCategory: 'startup_company',
    templateId: 'startup_company_formation',
    startupProfile: {
        formationStatus: 'preparing',
        selectedTrackIds: ['finance_accounting', 'marketing_sales', 'compliance']
    },
    startupReadiness: {
        taxSetupReady: true,
        bankAccountReady: false,
        bookkeepingReady: false,
        privacyDocsReady: true,
        requiredPermitsKnown: true,
        firstChannelReady: false
    }
};

describe('startup project utilities', () => {
    it('calculates finance, marketing, and compliance readiness from startup tasks and checklist data', () => {
        const tasks: Task[] = [
            {
                id: 'task-1',
                projectId: 'company-1',
                tenantId: 'tenant-1',
                ownerId: 'owner-1',
                title: 'Pick first channel',
                isCompleted: true,
                priority: 'Medium',
                templateId: 'startup_company_formation',
                templateTrack: 'marketing_sales'
            } as Task,
            {
                id: 'task-2',
                projectId: 'company-1',
                tenantId: 'tenant-1',
                ownerId: 'owner-1',
                title: 'Prepare bank account',
                isCompleted: false,
                status: 'Blocked',
                priority: 'High',
                templateId: 'startup_company_formation',
                templateTrack: 'finance_accounting'
            } as Task
        ];

        const snapshot = calculateStartupReadinessSnapshot(baseProject, tasks);

        expect(snapshot.financePercent).toBe(33);
        expect(snapshot.marketingPercent).toBe(100);
        expect(snapshot.compliancePercent).toBe(100);
        expect(snapshot.launchGate).toBe('blocked');
        expect(snapshot.nextFounderAction?.id).toBe('task-2');
    });

    it('rolls up only directly linked normal projects for a company project', () => {
        const linkedProjects: Project[] = [
            {
                id: 'product-1',
                title: 'MVP',
                description: '',
                progress: 50,
                status: 'Active',
                ownerId: 'owner-1',
                companyProjectId: 'company-1',
                companyProjectRole: 'product',
                healthSnapshot: { score: 72, status: 'healthy' }
            } as Project,
            {
                id: 'finance-1',
                title: 'Finance Setup',
                description: '',
                progress: 20,
                status: 'On Hold',
                ownerId: 'owner-1',
                companyProjectId: 'company-1',
                companyProjectRole: 'finance',
                healthSnapshot: { score: 45, status: 'warning' }
            } as Project,
            {
                id: 'qa-1',
                title: 'Release QA',
                description: '',
                progress: 80,
                status: 'In Testing',
                ownerId: 'owner-1',
                companyProjectId: 'company-1',
                companyProjectRole: 'product',
                healthSnapshot: { score: 88, status: 'healthy' }
            } as Project,
            {
                id: 'standalone-1',
                title: 'Standalone',
                description: '',
                progress: 100,
                status: 'Completed',
                ownerId: 'owner-1'
            } as Project
        ];

        const rollup = calculateCompanyLinkedProjectRollup(linkedProjects);

        expect(rollup.total).toBe(3);
        expect(rollup.activeCount).toBe(2);
        expect(rollup.averageProgress).toBe(50);
        expect(rollup.averageHealthScore).toBe(68);
        expect(rollup.atRiskCount).toBe(1);
        expect(rollup.roles.finance).toBe(1);
        expect(rollup.roles.product).toBe(2);
    });
});
