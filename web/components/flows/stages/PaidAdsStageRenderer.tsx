import React from 'react';
import '../../../src/styles/components/_project-flow-paid-ads.scss';
import { PaidAdsBriefView } from './PaidAdsBriefView';
import { PaidAdsResearchView } from './PaidAdsResearchView';
import { PaidAdsCreativeView } from './PaidAdsCreativeView';
import { PaidAdsTargetingView } from './PaidAdsTargetingView';
import { PaidAdsBudgetView } from './PaidAdsBudgetView';
import { PaidAdsBuildView } from './PaidAdsBuildView';
import { PaidAdsReviewView } from './PaidAdsReviewView';
import { PaidAdsLiveView } from './PaidAdsLiveView';
import { PaidAdsOptimizationView } from './PaidAdsOptimizationView';
import type { Idea } from '../../../types';

interface PaidAdsStageRendererProps {
    activeTab: string;
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const PaidAdsStageRenderer: React.FC<PaidAdsStageRendererProps> = ({ activeTab, idea, onUpdate }) => {
    switch (activeTab) {
        case 'Brief':
            return <PaidAdsBriefView idea={idea} onUpdate={onUpdate} />;
        case 'Research':
            return <PaidAdsResearchView idea={idea} onUpdate={onUpdate} />;
        case 'Creative':
            return <PaidAdsCreativeView idea={idea} onUpdate={onUpdate} />;
        case 'Targeting':
            return <PaidAdsTargetingView idea={idea} onUpdate={onUpdate} />;
        case 'Budget':
            return <PaidAdsBudgetView idea={idea} onUpdate={onUpdate} />;
        case 'Build':
            return <PaidAdsBuildView idea={idea} onUpdate={onUpdate} />;
        case 'Review':
            return <PaidAdsReviewView idea={idea} onUpdate={onUpdate} />;
        case 'Live':
            return <PaidAdsLiveView idea={idea} onUpdate={onUpdate} />;
        case 'Optimization':
            return <PaidAdsOptimizationView idea={idea} onUpdate={onUpdate} />;
        default:
            return <PaidAdsBriefView idea={idea} onUpdate={onUpdate} />;
    }
};

export default PaidAdsStageRenderer;
