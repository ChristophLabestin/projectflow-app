import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { isPmCoreOnly } from '../../config/pmCore';

type Props = {
    fallback?: 'tasks' | 'overview';
    children?: React.ReactNode;
};

/**
 * When PM-core mode is on, redirects deprecated module routes to project tasks (or overview).
 */
export const PmCoreDeprecatedRedirect: React.FC<Props> = ({ fallback = 'tasks', children }) => {
    const { id: projectId } = useParams<{ id: string }>();

    if (!isPmCoreOnly()) {
        return <>{children}</>;
    }

    if (!projectId) {
        return <Navigate to="/projects" replace />;
    }

    const target = fallback === 'overview'
        ? `/project/${projectId}`
        : `/project/${projectId}/tasks`;

    return <Navigate to={target} replace />;
};
