import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProjectActivity } from '../services/dataService';
import { Activity } from '../types';
import { toMillis } from '../utils/time';

const cleanText = (value?: string | null) => (value || '').replace(/\*\*/g, '');

export const ProjectActivity = () => {
    const { id } = useParams<{ id: string }>();
    const [activity, setActivity] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Activity | null>(null);

    useEffect(() => {
        if (!id) return;
        (async () => {
            const data = await getProjectActivity(id);
            setActivity(data);
            setLoading(false);
        })();
    }, [id]);

    return (
        <div className="max-w-[900px] mx-auto flex flex-col gap-4">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Activity</h1>
            {loading ? (
                <div className="flex justify-center py-10">
                    <span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span>
                </div>
            ) : activity.length === 0 ? (
                <div className="text-sm text-gray-500">No activity logged yet.</div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                    {activity.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setSelected(item)}
                            className="w-full text-left flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <span className="material-symbols-outlined text-[18px]">
                                    {item.type === 'task' ? 'check_circle' : item.type === 'status' ? 'flag' : item.type === 'priority' ? 'priority' : item.type === 'report' ? 'description' : 'history'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-900 dark:text-slate-100"><span className="font-bold">{item.user}</span> {cleanText(item.action)}</p>
                                <p className="text-xs text-slate-500 line-clamp-1">{cleanText(item.details || item.target)}</p>
                            </div>
                            <span className="text-xs text-slate-400">{item.createdAt ? new Date(toMillis(item.createdAt)).toLocaleString() : ''}</span>
                        </button>
                    ))}
                </div>
            )}

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setSelected(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-xl w-full border border-slate-200 dark:border-slate-800 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <span className="material-symbols-outlined text-[22px]">
                                        {selected.type === 'task' ? 'check_circle' : selected.type === 'status' ? 'flag' : selected.type === 'priority' ? 'priority' : selected.type === 'report' ? 'description' : 'history'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selected.user}</p>
                                    <p className="text-xs text-slate-500">{selected.createdAt ? new Date(toMillis(selected.createdAt)).toLocaleString() : ''}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelected(null)} className="p-2 rounded-full hover:bg-slate-100 dark:hover.bg-slate-800 text-slate-500">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="space-y-3">
                            <p className="text-base text-slate-900 dark:text-slate-100 font-semibold">{cleanText(selected.action)}</p>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                    {cleanText(selected.details || selected.target)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
