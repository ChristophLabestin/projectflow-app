import React, { useState, useMemo } from 'react';
import { AdData } from '../../../../types';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '../../../ui/Button';

interface ModuleProps {
    adData: Partial<AdData>;
    updateAdData: (updates: Partial<AdData>) => void;
    onNext: () => void;
    onBack: () => void;
}

export const WarRoomModule: React.FC<ModuleProps> = ({ adData, updateAdData, onNext, onBack }) => {
    const [budget, setBudget] = useState(adData.budget?.amount || 50);

    const updateBudget = (val: number) => {
        setBudget(val);
        updateAdData({
            budget: {
                ...adData.budget,
                amount: val,
                currency: 'USD',
                type: 'Daily'
            } as any
        });
    };

    // Predictive Data based on Budget
    const predictiveData = useMemo(() => {
        // Simple linear-ish projection for demo
        const baseReach = val => val * 1200;
        const baseConversions = val => val * 0.05;

        return Array.from({ length: 7 }).map((_, i) => ({
            day: `Day ${i + 1}`,
            reach: Math.round(baseReach(budget) * (1 + (i * 0.1))),
            conversions: Math.round(baseConversions(budget) * (1 + (i * 0.15)))
        }));
    }, [budget]);

    return (
        <div className="h-full flex flex-col p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">

                {/* LEFT COL: Controls */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Map / Location Targeting */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl min-h-[400px] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 z-10">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Global Reach</h2>
                        </div>

                        {/* Interactive Dot Map Simulation */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-30 transition-opacity">
                            {/* Placeholder for SVG Map */}
                            <span className="material-symbols-outlined text-[300px] text-slate-900 dark:text-white">public</span>
                        </div>

                        {/* Active Regions */}
                        <div className="relative z-10">
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-6">Target Zones</h3>
                            <div className="flex flex-wrap gap-3">
                                {['North America', 'Europe', 'Australia'].map(region => (
                                    <Button
                                        key={region}
                                        className="px-6 py-3 h-auto rounded-xl font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-lg"
                                    >
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        {region}
                                    </Button>
                                ))}
                                <button className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700">
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Add Region
                                </button>
                            </div>
                        </div>

                        {/* Audience Tags */}
                        <div className="relative z-10 mt-12">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Interests & Behaviors</h3>
                            <div className="flex flex-wrap gap-2">
                                {(adData.targeting?.interests || ['Technology', 'SaaS', 'Marketing']).map(tag => (
                                    <span key={tag} className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-bold flex items-center gap-1">
                                        {tag}
                                        <button className="hover:text-emerald-900"><span className="material-symbols-outlined text-xs">close</span></button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Budget Slider */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Daily Budget</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium">Adjust spend to see predicted reach.</p>
                            </div>
                            <div className="text-4xl font-black text-emerald-500">
                                ${budget}<span className="text-lg text-slate-400 font-bold">/day</span>
                            </div>
                        </div>

                        <input
                            type="range"
                            min="5"
                            max="500"
                            step="5"
                            value={budget}
                            onChange={(e) => updateBudget(Number(e.target.value))}
                            className="w-full h-4 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                        />
                        <div className="flex justify-between mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span>Conservative ($5)</span>
                            <span>Aggressive ($500)</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT COL: Predictive Stats */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="flex-1 bg-slate-900 dark:bg-black rounded-[2rem] p-8 border border-slate-800 shadow-2xl relative overflow-hidden text-white flex flex-col">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-black mb-2">Predicted Results</h3>
                            <p className="text-slate-400 text-sm">7-Day Projection based on current trends.</p>
                        </div>

                        {/* Charts */}
                        <div className="h-48 w-full z-10 mb-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={predictiveData}>
                                    <defs>
                                        <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ color: '#94a3b8' }}
                                    />
                                    <Area type="monotone" dataKey="reach" stroke="#10b981" fillOpacity={1} fill="url(#colorReach)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="space-y-6 z-10">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div>
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Weekly Reach</div>
                                    <div className="text-2xl font-black text-white">{(budget * 1200 * 7).toLocaleString()}</div>
                                </div>
                                <span className="material-symbols-outlined text-emerald-500">groups</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div>
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Est. Clicks</div>
                                    <div className="text-2xl font-black text-white">{(budget * 15 * 7).toLocaleString()}</div>
                                </div>
                                <span className="material-symbols-outlined text-violet-500">ads_click</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={onBack} className="py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                            Back
                        </button>
                        <button onClick={onNext} className="py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase tracking-widest shadow-xl hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2">
                            Ready to Launch
                            <span className="material-symbols-outlined">rocket_launch</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
