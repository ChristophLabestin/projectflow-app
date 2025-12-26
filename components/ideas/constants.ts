
export interface PipelineStageConfig {
    id: string;
    title: string;
    color: string;
    icon: string;
    bgGradient: string;
}

export const PIPELINE_CONFIGS: Record<string, PipelineStageConfig[]> = {
    'Feature': [
        { id: 'Brainstorm', title: 'Brainstorm', color: 'bg-slate-500', icon: 'psychology', bgGradient: 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/30' },
        { id: 'Refining', title: 'Refining', color: 'bg-blue-500', icon: 'tune', bgGradient: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-950/30' },
        { id: 'Concept', title: 'Concept', color: 'bg-violet-500', icon: 'architecture', bgGradient: 'bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-950/30' },
        { id: 'Review', title: 'In Review', color: 'bg-amber-500', icon: 'rate_review', bgGradient: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-950/30' },
        { id: 'Approved', title: 'Approved', color: 'bg-emerald-500', icon: 'verified', bgGradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-950/30' },
    ],
    'Product': [
        { id: 'Discovery', title: 'Discovery', color: 'bg-orange-500', icon: 'explore', bgGradient: 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-950/30' },
        { id: 'Definition', title: 'Definition', color: 'bg-amber-500', icon: 'article', bgGradient: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-950/30' },
        { id: 'Development', title: 'Development', color: 'bg-sky-500', icon: 'construction', bgGradient: 'bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-900/20 dark:to-sky-950/30' },
        { id: 'Concept', title: 'Concept', color: 'bg-violet-500', icon: 'architecture', bgGradient: 'bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-950/30' },
        { id: 'Launch', title: 'Launch', color: 'bg-emerald-500', icon: 'rocket', bgGradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-950/30' },
    ],
    'Marketing': [
        { id: 'Strategy', title: 'Strategy', color: 'bg-pink-500', icon: 'ads_click', bgGradient: 'bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-900/20 dark:to-pink-950/30' },
        { id: 'Planning', title: 'Planning', color: 'bg-purple-500', icon: 'calendar_month', bgGradient: 'bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-950/30' },
        { id: 'Execution', title: 'Execution', color: 'bg-cyan-500', icon: 'bolt', bgGradient: 'bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-900/20 dark:to-cyan-950/30' },
        { id: 'Analysis', title: 'Analysis', color: 'bg-green-500', icon: 'analytics', bgGradient: 'bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-950/30' },
    ],
    'Social': [
        { id: 'Ideation', title: 'Ideation', color: 'bg-rose-500', icon: 'lightbulb', bgGradient: 'bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-900/20 dark:to-rose-950/30' },
        { id: 'Drafting', title: 'Drafting', color: 'bg-orange-500', icon: 'edit_note', bgGradient: 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-950/30' },
        { id: 'Scheduled', title: 'Scheduled', color: 'bg-indigo-500', icon: 'calendar_month', bgGradient: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-950/30' },
        { id: 'Posted', title: 'Posted', color: 'bg-emerald-500', icon: 'send', bgGradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-950/30' },
    ],
    'Moonshot': [
        { id: 'Feasibility', title: 'Feasibility', color: 'bg-indigo-500', icon: 'science', bgGradient: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-950/30' },
        { id: 'Prototype', title: 'Prototype', color: 'bg-fuchsia-500', icon: 'precision_manufacturing', bgGradient: 'bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/50 dark:from-fuchsia-900/20 dark:to-fuchsia-950/30' },
        { id: 'Greenlight', title: 'Greenlight', color: 'bg-lime-500', icon: 'check_circle', bgGradient: 'bg-gradient-to-br from-lime-50 to-lime-100/50 dark:from-lime-900/20 dark:to-lime-950/30' },
    ],
    'Optimization': [
        { id: 'Analysis', title: 'Analysis', color: 'bg-teal-500', icon: 'analytics', bgGradient: 'bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-900/20 dark:to-teal-950/30' },
        { id: 'Proposal', title: 'Proposal', color: 'bg-sky-500', icon: 'description', bgGradient: 'bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-900/20 dark:to-sky-950/30' },
        { id: 'Benchmark', title: 'Benchmark', color: 'bg-blue-500', icon: 'speed', bgGradient: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-950/30' },
        { id: 'Implementation', title: 'Implementation', color: 'bg-emerald-500', icon: 'code', bgGradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-950/30' },
    ],
};

export const OVERVIEW_COLUMNS: PipelineStageConfig[] = [
    { id: 'Feature', title: 'Feature Pipeline', color: 'bg-indigo-500', icon: 'extension', bgGradient: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-950/30' },
    { id: 'Product', title: 'Product Launch', color: 'bg-orange-500', icon: 'rocket_launch', bgGradient: 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-950/30' },
    { id: 'Marketing', title: 'Marketing', color: 'bg-pink-500', icon: 'campaign', bgGradient: 'bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-900/20 dark:to-pink-950/30' },
    { id: 'Social', title: 'Social Media', color: 'bg-rose-500', icon: 'share', bgGradient: 'bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-900/20 dark:to-rose-950/30' },
    { id: 'Moonshot', title: 'Moonshot', color: 'bg-fuchsia-500', icon: 'science', bgGradient: 'bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/50 dark:from-fuchsia-900/20 dark:to-fuchsia-950/30' },
    { id: 'Optimization', title: 'Optimization', color: 'bg-teal-500', icon: 'speed', bgGradient: 'bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-900/20 dark:to-teal-950/30' },
];

export const TYPE_COLORS: Record<string, string> = {
    'Feature': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    'Product': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'Marketing': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    'Social': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    'Moonshot': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
    'Optimization': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    'default': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
};
