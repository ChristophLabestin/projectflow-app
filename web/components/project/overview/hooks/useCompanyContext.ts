import { useEffect, useState } from 'react';
import type { Project } from '../../../../types';
import { getProjectById } from '../../../../services/domain/projectsService';
import { getAllWorkspaceProjects } from '../../../../services/dataService';
import { getActiveTenantId } from '../../../../services/domain/authService';
import { isCompanyProject } from '../../../../config/projectTemplates';

export type CompanyContext = {
    companyContextProject: Project | null;
    linkedCompanyProjects: Project[];
};

/**
 * Loads the parent company project (when this project is linked to one) and the
 * child projects (when this project is itself a company project). Mirrors the
 * legacy overview's company-context effect.
 */
export const useCompanyContext = (project: Project | null): CompanyContext => {
    const [companyContextProject, setCompanyContextProject] = useState<Project | null>(null);
    const [linkedCompanyProjects, setLinkedCompanyProjects] = useState<Project[]>([]);

    useEffect(() => {
        if (!project) {
            setCompanyContextProject(null);
            setLinkedCompanyProjects([]);
            return;
        }
        let mounted = true;
        const tenantId = project.tenantId || getActiveTenantId() || undefined;

        if (project.companyProjectId) {
            getProjectById(project.companyProjectId, tenantId)
                .then((parent) => { if (mounted) setCompanyContextProject(parent); })
                .catch(() => { if (mounted) setCompanyContextProject(null); });
        } else {
            setCompanyContextProject(null);
        }

        if (isCompanyProject(project)) {
            getAllWorkspaceProjects(tenantId)
                .then((projects) => {
                    if (mounted) setLinkedCompanyProjects(projects.filter((item) => item.companyProjectId === project.id));
                })
                .catch(() => { if (mounted) setLinkedCompanyProjects([]); });
        } else {
            setLinkedCompanyProjects([]);
        }

        return () => { mounted = false; };
    }, [project?.id, project?.companyProjectId, project?.projectCategory, project?.templateId, project?.tenantId]);

    return { companyContextProject, linkedCompanyProjects };
};
