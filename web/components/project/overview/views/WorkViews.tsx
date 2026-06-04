import React from 'react';
import type { OverviewWorkView } from '../config/overviewConfig';
import type { WorkViewContext } from './shared/viewTypes';
import { WorkViewList } from './WorkViewList';
import { WorkViewBoard } from './WorkViewBoard';
import { WorkViewKanban } from './WorkViewKanban';
import { WorkViewTimeline } from './WorkViewTimeline';
import { WorkViewCalendar } from './WorkViewCalendar';
import { WorkViewRelationships } from './WorkViewRelationships';

export const WorkViews: React.FC<{ view: OverviewWorkView; ctx: WorkViewContext }> = ({ view, ctx }) => {
    switch (view) {
        case 'list':
            return <WorkViewList ctx={ctx} />;
        case 'board':
            return <WorkViewBoard ctx={ctx} />;
        case 'kanban':
            return <WorkViewKanban ctx={ctx} />;
        case 'timeline':
            return <WorkViewTimeline ctx={ctx} />;
        case 'calendar':
            return <WorkViewCalendar ctx={ctx} />;
        case 'relationships':
            return <WorkViewRelationships ctx={ctx} />;
        default:
            return <WorkViewKanban ctx={ctx} />;
    }
};
