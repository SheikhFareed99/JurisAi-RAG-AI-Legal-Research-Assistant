import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import {
    BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, FileText, Clock, Zap, MessageSquare, Scale } from 'lucide-react';

const CHART_COLORS = ['#f0c040', '#3b82f6', '#10b981', '#a78bfa', '#f97316', '#ec4899'];

function useCountUp(target, duration = 1200) {
    const [value, setValue] = useState(0);
    const ref = useRef(null);
    useEffect(() => {
        if (target === 0) return;
        const start = performance.now();
        const step = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) ref.current = requestAnimationFrame(step);
        };
        ref.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(ref.current);
    }, [target, duration]);
    return value;
}

function StatCard({ icon: Icon, label, value, suffix = '', color, delay = 0 }) {
    const count = useCountUp(typeof value === 'number' ? value : 0);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(t);
    }, [delay]);

    return (
        <div className={`card transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-3xl font-bold" style={{ color }}>
                        {count.toLocaleString()}{suffix}
                    </p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                    <Icon size={18} style={{ color }} />
                </div>
            </div>
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 shadow-xl text-xs">
            <p className="text-slate-400 mb-1">{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color }} className="font-semibold">{p.value} {p.name}</p>
            ))}
        </div>
    );
};

function EmptyState({ label }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <Scale size={24} className="text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-xs text-slate-600 mt-1">Data will appear after you use the Research Chat</p>
        </div>
    );
}

export default function Analytics() {
    const { data, isLoading } = useQuery({
        queryKey: ['analytics'],
        queryFn: () => api.get('/history/analytics/summary').then(r => r.data),
        refetchInterval: 30000,
    });

    const totalQueries = data?.totalQueries ?? 0;
    const totalDocs = data?.totalDocs ?? 0;
    const timeSaved = data?.estimatedTimeSaved ?? 0;
    const thisWeek = data?.queriesThisWeek ?? 0;

    const dailyData = (() => {
        const days = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
            const found = data?.queriesPerDay?.find(x => x._id === key);
            days.push({ date: label, queries: found?.count ?? 0 });
        }
        return days;
    })();

    const hasActivity = dailyData.some(d => d.queries > 0);

    const docCategoryData = (data?.docsByCategory ?? []).map((d, i) => ({
        name: d._id || 'Other',
        value: d.count,
        color: CHART_COLORS[i % CHART_COLORS.length],
    }));

    const topDocsData = (data?.topDocuments ?? []).map(d => ({
        name: d._id?.length > 22 ? d._id.slice(0, 22) + '…' : (d._id || 'Unknown'),
        queries: d.count,
    }));

    if (isLoading) {
        return (
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-fade-in">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
                <div className="skeleton h-72 rounded-xl col-span-full" />
                <div className="skeleton h-64 rounded-xl md:col-span-1" />
                <div className="skeleton h-64 rounded-xl md:col-span-1" />
            </div>
        );
    }

    return (
        <div className="p-8 animate-fade-in space-y-6">
            <div>
                <h1 className="section-title">Analytics</h1>
                <p className="section-subtitle">Live usage data across all your research sessions</p>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard icon={MessageSquare} label="Total Queries" value={totalQueries} color="#f0c040" delay={0} />
                <StatCard icon={FileText} label="Documents Loaded" value={totalDocs} color="#3b82f6" delay={80} />
                <StatCard icon={Zap} label="Queries This Week" value={thisWeek} color="#10b981" delay={160} />
                <StatCard icon={Clock} label="Minutes Saved" value={timeSaved} color="#a78bfa" delay={240} />
            </div>

            <div className="card">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="font-semibold text-slate-100">Research Activity</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Queries per day — last 30 days</p>
                    </div>
                    {hasActivity && (
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full flex items-center gap-1">
                            <TrendingUp size={11} /> Active
                        </span>
                    )}
                </div>
                {hasActivity ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="queryGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f0c040" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#f0c040" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a6e" />
                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false}
                                interval={Math.floor(dailyData.length / 6)} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="queries" name="queries" stroke="#f0c040" strokeWidth={2}
                                fill="url(#queryGrad)" dot={false} activeDot={{ r: 4, fill: '#f0c040' }} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyState label="No research activity yet" />
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                    <h2 className="font-semibold text-slate-100 mb-1">Most Researched Documents</h2>
                    <p className="text-xs text-slate-500 mb-5">Ranked by number of queries</p>
                    {topDocsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={topDocsData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a6e" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} width={90} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="queries" name="queries" radius={[0, 4, 4, 0]}>
                                    {topDocsData.map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState label="No document data yet" />
                    )}
                </div>

                <div className="card">
                    <h2 className="font-semibold text-slate-100 mb-1">Documents by Category</h2>
                    <p className="text-xs text-slate-500 mb-4">Distribution of your legal library</p>
                    {docCategoryData.length > 0 ? (
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width="50%" height={170}>
                                <PieChart>
                                    <Pie data={docCategoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                                        dataKey="value" paddingAngle={3}>
                                        {docCategoryData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-2">
                                {docCategoryData.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                                            <span className="text-xs text-slate-400 truncate max-w-[100px]">{d.name}</span>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-300">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState label="Upload documents to see categories" />
                    )}
                </div>
            </div>

            {data?.recentActivity?.length > 0 && (
                <div className="card">
                    <h2 className="font-semibold text-slate-100 mb-4">Recent Queries</h2>
                    <div className="space-y-3">
                        {data.recentActivity.map((item, i) => (
                            <div key={i} className="flex items-start gap-3 py-2 border-b border-navy-700 last:border-0">
                                <div className="w-6 h-6 rounded-md bg-gold-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Scale size={11} className="text-gold-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-300 truncate">{item.query}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{item.documentTitle}</p>
                                </div>
                                <span className="text-xs text-slate-600 flex-shrink-0">
                                    {new Date(item.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
