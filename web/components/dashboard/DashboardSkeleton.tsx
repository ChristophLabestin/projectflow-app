import { Skeleton } from '../common/Skeleton/Skeleton';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Loading state of the Dashboard in its real layout (same containers as the Today slide), so the page does not
 * jump when the data arrives: top line, two-line headline, cause, day band, plan list and the right rail.
 */
export const DashboardSkeleton = () => {
    const { t } = useLanguage();
    return (
        <div className="dashboard-page dashboard-skeleton" aria-busy="true" aria-label={t('common.loading')}>
            <div className="dashboard-stage">
                <div className="dashboard-track">
                    <section className="dashboard-slide">
                        <div className="dashboard-today">
                            <div className="dashboard-today__top">
                                <Skeleton width="240px" height="19px" />
                                <Skeleton width="96px" height="19px" />
                            </div>
                            <div className="dashboard-today__headline dashboard-skeleton__headline">
                                <Skeleton width="78%" height="36px" />
                                <Skeleton width="52%" height="36px" />
                            </div>
                            <div className="dashboard-today__cause">
                                <Skeleton width="58%" height="22px" />
                            </div>
                            <div className="dashboard-band-wrap">
                                <Skeleton height="41px" className="dashboard-skeleton__band" />
                            </div>
                            <div className="dashboard-today__grid">
                                <div className="dashboard-plan">
                                    <div className="dashboard-plan__head">
                                        <Skeleton width="140px" height="1rem" />
                                    </div>
                                    <div className="dashboard-skeleton__rows">
                                        <Skeleton variant="row" height="58px" count={4} />
                                    </div>
                                </div>
                                <div className="dashboard-today__rail dashboard-skeleton__rail">
                                    <Skeleton variant="card" height="128px" />
                                    <Skeleton height="47px" />
                                    <Skeleton variant="card" height="95px" />
                                    <Skeleton height="41px" />
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
