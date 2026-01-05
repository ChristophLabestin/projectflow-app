import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../common/Card/Card';
import { Milestone, Project } from '../../types';
import { subscribeProjectMilestones } from '../../services/dataService';
import { toMillis } from '../../utils/time';
import { useLanguage } from '../../context/LanguageContext';
import './dashboard-cards.scss';

interface LatestMilestoneCardProps {
    projects: Project[];
}

type MilestoneWithProject = Milestone & { projectTitle: string };

export const LatestMilestoneCard: React.FC<LatestMilestoneCardProps> = ({ projects }) => {
    const { t } = useLanguage();
    const [allMilestones, setAllMilestones] = useState<MilestoneWithProject[]>([]);
    const [loading, setLoading] = useState(true);

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

    const latestAchieved = useMemo(() => {
        const achieved = allMilestones.filter(m => m.status === 'Achieved');
        if (achieved.length === 0) return null;

        return achieved.sort((a, b) => {
            const aTime = toMillis(a.createdAt) || 0;
            const bTime = toMillis(b.createdAt) || 0;
            return bTime - aTime;
        })[0];
    }, [allMilestones]);

    const stats = useMemo(() => {
        const total = allMilestones.length;
        const achieved = allMilestones.filter(m => m.status === 'Achieved').length;
        const pending = allMilestones.filter(m => m.status === 'Pending').length;
        return { total, achieved, pending };
    }, [allMilestones]);

    if (milestoneProjects.length === 0) return null;

    if (loading) {
        return (
            <Card className="milestone-card dashboard__card--padded" style={{ opacity: 0.5 }}>
                {/* Simple loading state */}
                <div style={{ height: '20px', backgroundColor: 'var(--color-surface-hover)', marginBottom: '10px', borderRadius: '4px' }}></div>
                <div style={{ height: '60px', backgroundColor: 'var(--color-surface-hover)', borderRadius: '8px' }}></div>
            </Card>
        );
    }

    if (allMilestones.length === 0) {
        return (
            <Card className="milestone-card dashboard__card--padded">
                <div className="dashboard-card-header">
                    <h3 className="h5">{t('dashboard.milestones.title')}</h3>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-text-muted)' }}>flag</span>
                </div>
                <div className="milestone-card__none">
                    <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: 'var(--color-text-subtle)', marginBottom: '0.5rem' }}>flag_circle</span>
                    <p className="milestone-card__none-text">{t('dashboard.milestones.empty')}</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="milestone-card dashboard__card--padded">
            <div className="dashboard-card-header">
                <h3 className="h5" style={{ color: 'var(--color-success)' }}>{t('dashboard.milestones.latestTitle')}</h3>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-success)', fontSize: '20px' }}>emoji_events</span>
            </div>

            <div className="milestone-card__stats-row">
                <div className="milestone-card__stat">
                    <span className="milestone-card__stat-value">{stats.achieved}</span>
                    <span className="milestone-card__stat-label">{t('dashboard.milestones.achieved')}</span>
                </div>
                <div className="milestone-card__divider" />
                <div className="milestone-card__stat">
                    <span className="milestone-card__stat-value">{stats.pending}</span>
                    <span className="milestone-card__stat-label">{t('dashboard.milestones.pending')}</span>
                </div>
            </div>

            {latestAchieved ? (
                <Link
                    to={`/project/${latestAchieved.projectId}/milestones`}
                    className="milestone-card__latest group"
                >
                    <div className="milestone-card__latest-header">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-success)' }}>check_circle</span>
                        <span className="milestone-card__latest-tag">{t('dashboard.milestones.mostRecent')}</span>
                    </div>
                    <p className="milestone-card__latest-title">
                        {latestAchieved.title}
                    </p>
                    <p className="milestone-card__latest-project">
                        {latestAchieved.projectTitle}
                    </p>
                </Link>
            ) : (
                <div className="milestone-card__none">
                    <p className="milestone-card__none-text">{t('dashboard.milestones.noneAchieved')}</p>
                    <p className="milestone-card__none-subtext">{t('dashboard.milestones.pendingCount').replace('{count}', String(stats.pending))}</p>
                </div>
            )}
        </Card>
    );
};
