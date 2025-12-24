import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../services/firebase';
import { updateUserProfile, getActiveTenantId, subscribeTenantUsers, getUserGlobalActivities, getUserProfileStats } from '../services/dataService';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../context/UIContext';
import { Activity } from '../types';
import { ProfileSettingsModal } from '../components/ProfileSettingsModal';

export const Profile = () => {
    const user = auth.currentUser;
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [title, setTitle] = useState('');
    const [bio, setBio] = useState('');
    const [address, setAddress] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [coverURL, setCoverURL] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'activity'>('overview');
    const [activities, setActivities] = useState<Activity[]>([]);
    const [statsData, setStatsData] = useState({ projects: 0, teams: 1 });
    const [showEditModal, setShowEditModal] = useState(false);

    const { showSuccess, showError } = useToast();

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
                    if (me.displayName) setDisplayName(me.displayName);
                }
                setLoading(false);
            }, tenantId);

            // Fetch activities
            getUserGlobalActivities(tenantId, 10).then(setActivities);

            // Fetch real stats
            getUserProfileStats(user.uid, tenantId).then(setStatsData);

            return () => unsub();
        }
    }, [user]);

    if (!user) return <div className="p-10 text-center">Please login to view your profile.</div>;

    const statsMetrics = [
        { label: 'Active Projects', value: statsData.projects.toString(), icon: 'rocket_launch', color: 'text-blue-500' },
        { label: 'Teams', value: statsData.teams.toString(), icon: 'groups', color: 'text-purple-500' },
    ];

    return (
        <div className="min-h-screen bg-[var(--color-surface-bg)] fade-in pb-20">
            {/* Header Section with Cover - Rounded edges like project overview */}
            <div className="max-w-6xl mx-auto px-6 pt-6">
                <div className="relative h-64 md:h-80 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-900 border border-[var(--color-surface-border)] shadow-sm">
                    {coverURL ? (
                        <img src={coverURL} alt="Cover" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                        <>
                            <div className="absolute inset-0 opacity-30 dotted-bg"></div>
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40"></div>
                        </>
                    )}
                    <button
                        onClick={() => setShowEditModal(true)}
                        className="absolute top-6 right-6 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full text-sm font-medium transition-all flex items-center gap-2 border border-white/20"
                    >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Edit Profile
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6">
                <div className="relative -mt-24 mb-8 flex flex-col md:flex-row items-end gap-6">
                    {/* Avatar Container */}
                    <div className="relative group">
                        <div className="size-40 rounded-full overflow-hidden border-8 border-[var(--color-surface-bg)] shadow-2xl bg-white dark:bg-gray-800 ring-1 ring-black/5">
                            {photoURL ? (
                                <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-5xl font-bold bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                    {displayName[0] || user.email?.[0].toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Header Info */}
                    <div className="flex-1 pb-2">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-[var(--color-text-main)] flex items-center gap-3">
                                    {displayName || 'Anonymous User'}
                                    <span className="material-symbols-outlined text-blue-500 fill-blue-500 text-xl" title="Verified Professional">verified</span>
                                </h1>
                                <p className="text-lg text-[var(--color-text-muted)] font-medium mt-1">{title || 'Digital Architect'}</p>
                                <div className="flex items-center gap-4 mt-3 text-sm text-[var(--color-text-subtle)]">
                                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">location_on</span>{address || 'Location Unknown'}</span>
                                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">calendar_today</span>Joined Dec 2023</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="secondary" className="rounded-full px-6">Message</Button>
                                <Button className="rounded-full px-6 bg-indigo-600 hover:bg-indigo-700 text-white">Follow</Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Bar - Actual Data */}
                <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 mb-8">
                    {statsMetrics.map((stat, idx) => (
                        <Card key={idx} className="p-5 glass-card border-none flex items-center gap-4 hover:translate-y-[-4px] transition-transform cursor-pointer group">
                            <div className={`size-12 rounded-2xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}>
                                <span className="material-symbols-outlined">{stat.icon}</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">{stat.label}</p>
                                <p className="text-2xl font-bold text-[var(--color-text-main)] mt-0.5">{stat.value}</p>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Tabs Selection */}
                <div className="flex border-b border-[var(--color-surface-border)] mb-8 gap-8">
                    {(['overview', 'projects', 'activity'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-indigo-600' : 'text-[var(--color-text-subtle)] hover:text-[var(--color-text-main)]'
                                }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Unified Content Area - Replaced when switching tabs */}
                <div className="animate-fade-in min-h-[400px]">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-8">
                                <section>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-indigo-500">person</span>
                                        About Me
                                    </h3>
                                    <div className="prose dark:prose-invert max-w-none text-[var(--color-text-muted)] p-6 bg-white dark:bg-gray-800/50 rounded-3xl border border-[var(--color-surface-border)]">
                                        {bio || "Tell us something about yourself in your profile settings."}
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <span className="material-symbols-outlined text-indigo-500">history</span>
                                            Recent Activity
                                        </h3>
                                        <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700">View All</button>
                                    </div>
                                    <div className="space-y-4">
                                        {activities.length > 0 ? activities.map(act => (
                                            <div key={act.id} className="flex gap-4 p-4 hover:bg-white dark:hover:bg-gray-800 rounded-2xl transition-all group">
                                                <div className="size-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                                                    <span className="material-symbols-outlined text-[20px]">
                                                        {act.type === 'task' ? 'list_alt' : act.type === 'comment' ? 'chat_bubble' : 'edit'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-[var(--color-text-main)] font-medium">
                                                        {act.action} <span className="font-bold">{act.target}</span>
                                                    </p>
                                                    <p className="text-xs text-[var(--color-text-subtle)] mt-1">{new Date(act.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="p-8 text-center text-[var(--color-text-subtle)] italic bg-gray-50 dark:bg-gray-900/50 rounded-3xl">
                                                No recent activity to display.
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>

                            {/* Sidebar Column - Visual Summary */}
                            <div className="space-y-6">
                                <section>
                                    <h3 className="text-sm font-bold text-[var(--color-text-subtle)] uppercase tracking-widest mb-4">Focus & Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.map(skill => (
                                            <span key={skill} className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-[var(--color-surface-border)] rounded-xl text-xs font-bold text-[var(--color-text-muted)]">
                                                {skill}
                                            </span>
                                        ))}
                                        {skills.length === 0 && <p className="text-xs text-[var(--color-text-subtle)] italic">No skills listed.</p>}
                                    </div>
                                </section>

                                <section>
                                    <Card className="p-6 bg-gradient-to-br from-indigo-600 to-purple-600 text-white border-none shadow-xl relative overflow-hidden group rounded-3xl">
                                        <div className="absolute -top-10 -right-10 size-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                                        <h3 className="text-lg font-bold mb-2 relative z-10">Trusted Professional</h3>
                                        <p className="text-white/80 text-sm mb-4 relative z-10">Verified expert in {skills[0] || 'Digital Products'}.</p>
                                        <Button variant="secondary" className="w-full bg-white text-indigo-600 border-none hover:bg-white/90 relative z-10">Contact for Hire</Button>
                                    </Card>
                                </section>
                            </div>
                        </div>
                    )}

                    {(activeTab === 'projects' || activeTab === 'activity') && (
                        <div className="p-20 text-center space-y-4">
                            <div className="size-20 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 mb-6 animate-pulse">
                                <span className="material-symbols-outlined text-4xl">construction</span>
                            </div>
                            <h3 className="text-2xl font-bold">Coming Soon</h3>
                            <p className="text-[var(--color-text-muted)] max-w-sm mx-auto">This section is currently under development. Check back soon for detailed insights.</p>
                        </div>
                    )}
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
                    coverURL
                }}
                onUpdate={(newData) => {
                    if (newData.displayName) setDisplayName(newData.displayName);
                    if (newData.title) setTitle(newData.title);
                    if (newData.bio) setBio(newData.bio);
                    if (newData.address) setAddress(newData.address);
                    if (newData.skills) setSkills(newData.skills);
                    if (newData.photoURL) setPhotoURL(newData.photoURL);
                    if (newData.coverURL) setCoverURL(newData.coverURL);

                    // Refresh stats just in case
                    getUserProfileStats(user.uid).then(setStatsData);
                }}
            />
        </div>
    );
};

