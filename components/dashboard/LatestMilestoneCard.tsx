import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Milestone, Project } from '../../types';
import { subscribeProjectMilestones } from '../../services/dataService';
import { toMillis } from '../../utils/time';
import { useLanguage } from '../../context/LanguageContext';

interface LatestMilestoneCardProps {
    projects: Project[];
}

type MilestoneWithProject = Milestone & { projectTitle: string };

export const LatestMilestoneCard: React.FC<LatestMilestoneCardProps> = ({ projects }) => {
    const { t } = useLanguage();
    const [allMilestones, setAllMilestones] = useState<MilestoneWithProject[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter only projects with milestones module enabled
    const milestoneProjects = useMemo(() =>
        projects.filter(p => p.modules?.includes('milestones')),
        [projects]
    );

    useEffect(() => {
        if (milestoneProjects.length === 0) {
            setLoading(false);
            return;
        }

        const milestonesPerProject = new Map<string, MilestoneWithProject[]>();
        let completedProjects = 0;

        const unsubscribes = milestoneProjects.map(project => {
            return subscribeProjectMilestones(project.id, (milestones) => {
                const milestonesWithProject = milestones.map(m => ({
                    ...m,
                    projectTitle: project.title
                }));
                milestonesPerProject.set(project.id, milestonesWithProject);
                completedProjects++;

                // Once all projects have reported, aggregate
                if (completedProjects >= milestoneProjects.length) {
                    const all: MilestoneWithProject[] = [];
                    milestonesPerProject.forEach(arr => all.push(...arr));
                    setAllMilestones(all);
                    setLoading(false);
                }
            }, project.tenantId);
        });

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [milestoneProjects]);

    // Find the latest achieved milestone (most recently achieved)
    const latestAchieved = useMemo(() => {
        const achieved = allMilestones.filter(m => m.status === 'Achieved');
        if (achieved.length === 0) return null;

        // Sort by createdAt or dueDate descending to get most recent
        return achieved.sort((a, b) => {
            const aTime = toMillis(a.createdAt) || 0;
            const bTime = toMillis(b.createdAt) || 0;
            return bTime - aTime;
        })[0];
    }, [allMilestones]);

    // Compute summary stats
    const stats = useMemo(() => {
        const total = allMilestones.length;
        const achieved = allMilestones.filter(m => m.status === 'Achieved').length;
        const pending = allMilestones.filter(m => m.status === 'Pending').length;
        return { total, achieved, pending };
    }, [allMilestones]);

    // Don't render if no projects have the milestones module
    if (milestoneProjects.length === 0) {
        return null;
    }

    if (loading) {
        return (
            <Card padding="md" className="animate-pulse">
                <div className="h-5 w-1/2 bg-[var(--color-surface-hover)] rounded mb-3" />
                <div className="h-16 bg-[var(--color-surface-hover)] rounded-xl" />
            </Card>
        );
    }

    // If no milestones at all
    if (allMilestones.length === 0) {
        return (
            <Card padding="md" className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="h5">{t('dashboard.milestones.title')}</h3>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">flag</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center py-4 opacity-70">
                    <span className="material-symbols-outlined text-3xl text-[var(--color-text-subtle)] mb-2">flag_circle</span>
                    <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.milestones.empty')}</p>
                </div>
            </Card>
        );
    }

    return (
        <Card padding="md" className="flex flex-col border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="h5 text-emerald-600 dark:text-emerald-400">{t('dashboard.milestones.latestTitle')}</h3>
                <span className="material-symbols-outlined text-emerald-500 text-[20px]">emoji_events</span>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold text-[var(--color-text-main)]">{stats.achieved}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">{t('dashboard.milestones.achieved')}</span>
                </div>
                <div className="w-px h-4 bg-[var(--color-surface-border)]" />
                <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold text-[var(--color-text-main)]">{stats.pending}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">{t('dashboard.milestones.pending')}</span>
                </div>
            </div>

            {latestAchieved ? (
                <Link
                    to={`/project/${latestAchieved.projectId}/milestones`}
                    className="block p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 hover:shadow-sm transition-shadow group"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                        <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">{t('dashboard.milestones.mostRecent')}</span>
                    </div>
                    <p className="text-sm font-bold text-[var(--color-text-main)] line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {latestAchieved.title}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">
                        {latestAchieved.projectTitle}
                    </p>
                </Link>
            ) : (
                <div className="p-3 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] text-center">
                    <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.milestones.noneAchieved')}</p>
                    <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">{t('dashboard.milestones.pendingCount').replace('{count}', String(stats.pending))}</p>
                </div>
            )}
        </Card>
    );
};
