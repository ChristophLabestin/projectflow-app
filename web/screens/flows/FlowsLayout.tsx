// Flows shell (/flows/*, /project/:id/flows): sidebar with all flows + "Neuer Flow", content via <Outlet>.
import React, { useEffect, useState } from 'react';
import { Outlet, useOutletContext, useParams } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { FlowsSidebar } from '../../components/flows/FlowsSidebar';
import {
    subscribeFlowQuota,
    subscribeFlowUsage,
    subscribeFlows,
    type Flow,
    type FlowQuota,
} from '../../services/domain/automationsService';
import { useFlowContext } from './useFlowContext';
import './flows.scss';

export interface FlowsOutlet {
    flows: Flow[] | null;
    failed: boolean;
    quota: FlowQuota | null;
    usage: { runs: number; aiSteps: number; skipped: number };
    ctx: ReturnType<typeof useFlowContext>;
    /** Set on /project/:id/flows: list and "new" are scoped to that project. */
    routeProjectId: string | null;
}

export const useFlowsOutlet = () => useOutletContext<FlowsOutlet>();

/** `/flows/new` link that keeps the project scope. */
export const newFlowPath = (projectId: string | null, extra?: Record<string, string>) => {
    const params = new URLSearchParams(extra);
    if (projectId) params.set('projectId', projectId);
    const query = params.toString();
    return `/flows/new${query ? `?${query}` : ''}`;
};

export const FlowsLayout = () => {
    const { t } = useLanguage();
    const { id: routeProjectId } = useParams<{ id: string }>();
    const ctx = useFlowContext();
    const { tenantId, isGuest } = ctx;
    const [flows, setFlows] = useState<Flow[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [usage, setUsage] = useState({ runs: 0, aiSteps: 0, skipped: 0 });
    const [quota, setQuota] = useState<FlowQuota | null>(null);

    useEffect(() => {
        if (!tenantId || isGuest) return undefined;
        setFlows(null);
        const offFlows = subscribeFlows(tenantId, setFlows, () => setFailed(true));
        const offUsage = subscribeFlowUsage(tenantId, setUsage);
        const offQuota = subscribeFlowQuota(tenantId, setQuota);
        return () => { offFlows(); offUsage(); offQuota(); };
    }, [tenantId, isGuest]);

    if (isGuest) {
        return <EmptyState title={t('flows.noAccess')} icon={<span className="material-symbols-outlined">lock</span>} />;
    }

    const outlet: FlowsOutlet = { flows, failed, quota, usage, ctx, routeProjectId: routeProjectId || null };
    return (
        <div className="flows-shell">
            <div className="flows-layout">
                <FlowsSidebar t={t} flows={flows} names={ctx.names} quota={quota} usage={usage}
                    routeProjectId={routeProjectId || null} canCreate={ctx.role === 'Owner' || ctx.role === 'Admin' || ctx.role === 'Member'} />
                <main className="flows-main">
                    <Outlet context={outlet} />
                </main>
            </div>
        </div>
    );
};

export default FlowsLayout;
