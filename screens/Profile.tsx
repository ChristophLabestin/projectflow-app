import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../services/firebase';
import { updateUserProfile, getActiveTenantId, subscribeTenantUsers, getUserGlobalActivities, getUserProfileStats, getAllMemberProjects } from '../services/dataService';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../context/UIContext';
import { Activity, PrivacySettings, Project } from '../types';
import { ProfileSettingsModal } from '../components/ProfileSettingsModal';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';

export const Profile = () => {
    const user = auth.currentUser;
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [title, setTitle] = useState('');
    const [bio, setBio] = useState('');
    const [address, setAddress] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [coverURL, setCoverURL] = useState('');
    const [privacySettings, setPrivacySettings] = useState<PrivacySettings | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'activity' | 'about'>('overview');
    const [activities, setActivities] = useState<Activity[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [statsData, setStatsData] = useState({ projects: 0, teams: 1 });
    const [showEditModal, setShowEditModal] = useState(false);

    const { showSuccess, showError } = useToast();
    const { t, dateFormat, dateLocale } = useLanguage();

    useEffect(() => {
        if (!user) return;
        const tenantId = getActiveTenantId();
        if (tenantId) {
            setLoading(true);
            const unsub = subscribeTenantUsers((users) => {
                const me = users.find(u => u.id === user.uid) as any;
                if (me) {
                    setTitle(me.title || '');
                    setBio(me.bio || '');
                    setAddress(me.address || '');
                    setSkills(me.skills || []);
                    if (me.coverURL) setCoverURL(me.coverURL);
                    if (me.photoURL) setPhotoURL(me.photoURL);
                    if (me.coverURL) setCoverURL(me.coverURL);
                    if (me.photoURL) setPhotoURL(me.photoURL);
                    if (me.displayName) setDisplayName(me.displayName);
                    if (me.privacySettings) setPrivacySettings(me.privacySettings);
                }
                setLoading(false);
            }, tenantId);

            // Fetch activities
            getUserGlobalActivities(tenantId, 10).then(setActivities);

            // Fetch real stats
            getUserProfileStats(user.uid, tenantId).then(setStatsData);

            // Fetch projects
            getAllMemberProjects(user.uid).then(setProjects);

            return () => unsub();
        }
    }, [user]);

    if (!user) return <div className="p-10 text-center">{t('profile.auth.required')}</div>;

    const statsMetrics = [
        { label: t('profile.stats.activeProjects'), value: statsData.projects.toString(), icon: 'rocket_launch' },
        { label: t('profile.stats.teams'), value: statsData.teams.toString(), icon: 'groups' },
    ];

    const projectStatusLabels: Record<string, string> = {
        Active: t('project.status.active'),
        Completed: t('project.status.completed'),
        Planning: t('project.status.planning'),
        'On Hold': t('project.status.onHold'),
        Brainstorming: t('project.status.brainstorming')
    };

    return (
        <div className="min-h-screen bg-surface text-main pb-20 fade-in">
            <div className="max-w-[1600px] mx-auto px-6 pt-8">

                {/* 1. HERO BANNER */}
                <div className="relative h-64 md:h-80 w-full rounded-3xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-surface shadow-sm group">
                    {coverURL ? (
                        <img src={coverURL} alt={t('profile.cover.alt')} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-6xl text-zinc-300 dark:text-zinc-700 opacity-20">image</span>
                        </div>
                    )}

                    {/* Gradient Overlay for Text Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />

                    <button
                        onClick={() => setShowEditModal(true)}
                        className="absolute top-6 right-6 px-5 py-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 border border-white/10 opacity-0 group-hover:opacity-100 hover:scale-105"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        {t('profile.actions.edit')}
                    </button>
                </div>

                {/* 2. IDENTITY BAR (Overlapping) */}
                <div className="relative px-4 md:px-10 -mt-20 mb-12 flex flex-col md:flex-row items-end gap-8">
                    {/* Avatar */}
                    <div className="relative group shrink-0">
                        <div className="size-40 md:size-48 rounded-full border-[8px] border-[var(--color-surface-bg)] shadow-2xl bg-white dark:bg-black overflow-hidden relative z-10">
                            {photoURL ? (
                                <img src={photoURL} alt={t('profile.avatar.alt')} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-6xl font-black text-black dark:text-white bg-white dark:bg-black">
                                    {displayName[0]?.toUpperCase() || 'U'}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="absolute bottom-2 right-2 z-20 size-10 bg-black text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg border-2 border-white dark:border-zinc-800"
                        >
                            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                        </button>
                    </div>

                    {/* Info */}
                    <div className="flex-1 pb-4 text-center md:text-left">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 flex items-center justify-center md:justify-start gap-3">
                                    {displayName || t('profile.fallback.anonymous')}
                                    <span className="material-symbols-outlined text-2xl text-blue-500" title={t('profile.badges.verified')}>verified</span>
                                </h1>
                                <p className="text-xl font-medium text-muted flex items-center justify-center md:justify-start gap-2">
                                    {title || t('profile.fallback.title')}
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-subtle)]" />
                                    <span className="text-base text-subtle">{address || t('profile.fallback.location')}</span>
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button className="px-8 py-4 rounded-2xl font-bold hover:opacity-90 shadow-lg shadow-black/5 dark:shadow-white/5">
                                    {t('profile.actions.follow')}
                                </Button>
                                <Button variant="secondary" className="px-8 py-4 rounded-2xl font-bold border-surface bg-white dark:bg-black hover:bg-surface-hover">
                                    {t('profile.actions.message')}
                                </Button>
                                <button className="p-4 rounded-2xl border border-surface bg-white dark:bg-black hover:bg-surface-hover transition-colors">
                                    <span className="material-symbols-outlined" aria-label={t('profile.actions.more')}>more_horiz</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. CONTENT AREA */}
                {/* Desktop: Sidebar + Content Layout */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pb-20">
                    <div className="flex flex-col lg:flex-row gap-8 items-start">

                        {/* Left Sidebar Navigation */}
                        <aside className="w-full lg:w-64 shrink-0 space-y-2 sticky top-24">
                            <div className="pb-4 mb-4 border-b border-surface lg:hidden">
                                {/* Mobile Nav Header if needed, or just rely on the vertical list collapsing */}
                            </div>

                            <nav className="space-y-1">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'overview'
                                        ? 'bg-surface-hover text-main shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted hover:bg-surface-hover hover:text-main'
                                        }`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${activeTab === 'overview' ? 'text-primary' : ''}`}>dashboard</span>
                                    {t('profile.tabs.overview')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('projects')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'projects'
                                        ? 'bg-surface-hover text-main shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted hover:bg-surface-hover hover:text-main'
                                        }`}
                                >
                                    <div className="relative">
                                        <span className={`material-symbols-outlined text-[20px] ${activeTab === 'projects' ? 'text-primary' : ''}`}>folder_open</span>
                                        {projects.length > 0 && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                                        </span>}
                                    </div>
                                    {t('profile.tabs.projects')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('activity')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'activity'
                                        ? 'bg-surface-hover text-main shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted hover:bg-surface-hover hover:text-main'
                                        }`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${activeTab === 'activity' ? 'text-primary' : ''}`}>history</span>
                                    {t('profile.tabs.activity')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('about')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'about'
                                        ? 'bg-surface-hover text-main shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted hover:bg-surface-hover hover:text-main'
                                        }`}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${activeTab === 'about' ? 'text-primary' : ''}`}>person</span>
                                    {t('profile.tabs.about')}
                                </button>
                            </nav>

                            {/* Quick Stats in Sidebar */}
                            <div className="pt-6 mt-6 border-t border-surface px-4">
                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">{t('profile.quickStats.title')}</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-subtle">{t('profile.quickStats.projects')}</span>
                                        <span className="text-sm font-bold font-mono">{statsData.projects}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-subtle">{t('profile.quickStats.karma')}</span>
                                        <span className="text-sm font-bold font-mono text-primary">940</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-subtle">{t('profile.quickStats.joined')}</span>
                                        <span className="text-sm font-bold font-mono">{t('profile.quickStats.joinedValue')}</span>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Main Content Area */}
                        <main className="flex-1 w-full min-w-0 space-y-6">
                            {activeTab === 'overview' && (
                                <div className="space-y-6 animate-fade-in">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-surface shadow-sm">
                                            <div className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">{t('profile.stats.projects')}</div>
                                            <div className="text-2xl font-display font-bold">{statsData.projects}</div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-surface shadow-sm">
                                            <div className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">{t('profile.stats.tasksDone')}</div>
                                            <div className="text-2xl font-display font-bold">142</div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-surface shadow-sm">
                                            <div className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">{t('profile.stats.teams')}</div>
                                            <div className="text-2xl font-display font-bold">{statsData.teams}</div>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-surface shadow-sm">
                                            <div className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">{t('profile.stats.focus')}</div>
                                            <div className="text-2xl font-display font-bold text-emerald-500">89%</div>
                                        </div>
                                    </div>

                                    <Card className="p-6">
                                        <h3 className="text-lg font-bold mb-4">{t('profile.sections.recentActivity')}</h3>
                                        <div className="space-y-6">
                                            {activities.length > 0 ? (
                                                activities.slice(0, 5).map((activity) => (
                                                    <div key={activity.id} className="flex gap-4 group">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-2 h-2 rounded-full bg-primary ring-4 ring-[var(--color-surface-hover)] group-hover:ring-primary/20 transition-all"></div>
                                                            <div className="w-px h-full bg-surface-border my-2 group-last:hidden"></div>
                                                        </div>
                                                        <div className="pb-4">
                                                            <p className="text-sm text-main">
                                                                <span className="font-semibold">{activity.action}</span>
                                                                <span className="text-muted"> {activity.target}</span>
                                                            </p>
                                                            <p className="text-xs text-muted mt-1">
                                                                {activity.createdAt ? format(new Date(activity.createdAt.seconds * 1000), dateFormat, { locale: dateLocale }) : t('profile.activity.justNow')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-8 text-muted">
                                                    {t('profile.activity.empty')}
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {activeTab === 'projects' && (
                                <div className="animate-fade-in space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-bold font-display">{t('profile.sections.projects')}</h2>
                                        <Button size="sm" variant="outline">{t('profile.actions.filter')}</Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {projects.length > 0 ? projects.map(project => (
                                            <div key={project.id} className="group bg-white dark:bg-black rounded-3xl border border-surface overflow-hidden shadow-sm hover:translate-y-[-4px] transition-all duration-300 cursor-pointer">
                                                {/* Cover */}
                                                <div className="h-40 bg-zinc-100 dark:bg-zinc-800 relative">
                                                    {project.coverImage ? (
                                                        <img src={project.coverImage} alt={project.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-4xl text-zinc-300 dark:text-zinc-700">folder</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute top-3 right-3">
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${project.status === 'Active' ? 'bg-green-100/90 text-green-700 dark:bg-green-900/60 dark:text-green-300' :
                                                            project.status === 'Completed' ? 'bg-blue-100/90 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' :
                                                                'bg-zinc-100/90 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300'
                                                            }`}>
                                                            {projectStatusLabels[project.status || 'Active'] || project.status || projectStatusLabels.Active}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div className="p-6">
                                                    <h3 className="font-bold text-lg mb-1 truncate group-hover:text-primary transition-colors">{project.title}</h3>
                                                    <p className="text-sm text-muted line-clamp-2 mb-4 h-10 leading-relaxed">
                                                        {project.description || t('profile.projects.emptyDescription')}
                                                    </p>

                                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-surface">
                                                        <div className="flex -space-x-2">
                                                            {project.members?.slice(0, 3).map((m, i) => (
                                                                <div key={i} className="size-8 rounded-full border-2 border-white dark:border-black bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold overflow-hidden" title={m.role}>
                                                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                                                </div>
                                                            ))}
                                                            {(project.members?.length || 0) > 3 && (
                                                                <div className="size-8 rounded-full border-2 border-white dark:border-black bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-subtle">
                                                                    +{(project.members?.length || 0) - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-bold text-subtle uppercase tracking-wider flex items-center gap-1">
                                                            {project.ownerId === user?.uid ? t('roles.owner') : t('roles.member')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="col-span-full py-20 text-center bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl border border-dashed border-surface">
                                                <span className="material-symbols-outlined text-5xl text-zinc-300 mb-4">folder_off</span>
                                                <p className="text-muted font-medium">{t('profile.projects.empty')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'activity' && (
                                <div className="animate-fade-in">
                                    <h2 className="text-xl font-bold font-display mb-6">{t('profile.sections.activity')}</h2>
                                    <Card className="p-0 overflow-hidden divide-y divide-[var(--color-surface-border)]">
                                        {activities.map((activity) => (
                                            <div key={activity.id} className="p-4 hover:bg-surface-hover transition-colors flex gap-4">
                                                <div className="size-10 rounded-full bg-[var(--color-surface-highlight)] flex items-center justify-center shrink-0 text-primary">
                                                    <span className="material-symbols-outlined text-[20px]">
                                                        {activity.type === 'comment' ? 'chat_bubble' :
                                                            activity.type === 'task' ? 'check_circle' :
                                                                activity.type === 'file' ? 'description' :
                                                                    'history'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-main">
                                                        {activity.user} <span className="font-normal text-muted">{activity.action}</span>
                                                    </div>
                                                    <div className="text-sm text-main mb-1">{activity.target}</div>
                                                    <div className="text-xs text-muted">
                                                        {activity.createdAt ? format(new Date(activity.createdAt.seconds * 1000), 'PP p', { locale: dateLocale }) : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {activities.length === 0 && (
                                            <div className="p-8 text-center text-muted">{t('profile.activity.detailsEmpty')}</div>
                                        )}
                                    </Card>
                                </div>
                            )}

                            {activeTab === 'about' && (
                                <div className="animate-fade-in space-y-6">
                                    <h2 className="text-xl font-bold font-display">{t('profile.sections.about')}</h2>
                                    <Card className="p-6">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">{t('profile.about.bio')}</h3>
                                        <p className="text-main leading-relaxed">{bio || t('profile.about.bioEmpty')}</p>
                                    </Card>

                                    <Card className="p-6">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">{t('profile.about.skills')}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {(skills || 'React, TypeScript, Firebase, Tailwind CSS, UI/UX Design').split(',').map((skill, i) => (
                                                <span key={i} className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm font-medium border border-surface">
                                                    {skill.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </Card>

                                    <Card className="p-6">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">{t('profile.about.contact')}</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="material-symbols-outlined text-muted">mail</span>
                                                <span>{user?.email}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="material-symbols-outlined text-muted">location_on</span>
                                                <span>{address || t('profile.about.remote')}</span>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </main>
                    </div>
                </div>
            </div>

            {/* Profile Settings Modal */}
            <ProfileSettingsModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                initialData={{
                    displayName,
                    title,
                    bio,
                    address,
                    skills,
                    photoURL,
                    coverURL,
                    privacySettings
                }}
                onUpdate={(newData) => {
                    if (newData.displayName) setDisplayName(newData.displayName);
                    if (newData.title) setTitle(newData.title);
                    if (newData.bio) setBio(newData.bio);
                    if (newData.address) setAddress(newData.address);
                    if (newData.skills) setSkills(newData.skills);
                    if (newData.photoURL) setPhotoURL(newData.photoURL);
                    if (newData.coverURL) setCoverURL(newData.coverURL);
                    if (newData.privacySettings) setPrivacySettings(newData.privacySettings);

                    if (user) getUserProfileStats(user.uid).then(setStatsData);
                }}
            />
        </div>
    );
};
