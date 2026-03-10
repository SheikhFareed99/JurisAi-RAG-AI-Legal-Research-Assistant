import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { MessageSquare, BookOpen, Clock, TrendingUp, ChevronRight, Zap, Scale } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color = 'gold' }) {
    const colors = {
        gold: 'bg-gold-500/10 text-gold-400 border-gold-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };
    return (
        <div className="card-hover flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
                <Icon size={20} />
            </div>
            <div>
                <div className="text-2xl font-bold text-slate-100">{value}</div>
                <div className="text-sm text-slate-400 font-medium">{label}</div>
                {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const { data: docStats } = useQuery({
        queryKey: ['doc-stats'],
        queryFn: () => api.get('/documents/stats').then(r => r.data),
    });

    const { data: historyData } = useQuery({
        queryKey: ['analytics'],
        queryFn: () => api.get('/history/analytics/summary').then(r => r.data),
    });

    const { data: recentHistory } = useQuery({
        queryKey: ['history', 1],
        queryFn: () => api.get('/history?limit=5').then(r => r.data),
    });

    const timeSaved = historyData?.estimatedTimeSaved ?? 0;
    const hours = Math.floor(timeSaved / 60);
    const mins = timeSaved % 60;

    return (
        <div className="p-8 animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-100">
                    Good evening, <span className="text-gold-400">{user?.name?.split(' ')[0]}</span> 👋
                </h1>
                <p className="text-slate-400 mt-1">Your legal research intelligence dashboard</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <StatCard icon={BookOpen} label="Documents Indexed" value={docStats?.ingested ?? '—'} sub={`${docStats?.total ?? 0} total uploaded`} color="gold" />
                <StatCard icon={MessageSquare} label="Research Queries" value={historyData?.totalQueries ?? '—'} sub="All time" color="blue" />
                <StatCard icon={Clock} label="Time Saved" value={hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} sub="vs manual research" color="green" />
                <StatCard icon={TrendingUp} label="Accuracy Rate" value="98.4%" sub="Source-cited answers" color="purple" />
            </div>

            {/* Quick search */}
            <div className="card mb-8" style={{ background: 'linear-gradient(135deg, rgba(22,42,84,0.9) 0%, rgba(15,32,64,0.95) 100%)' }}>
                <div className="flex items-center gap-3 mb-4">
                    <Zap size={18} className="text-gold-400" />
                    <h2 className="text-lg font-semibold text-slate-100">Quick Research</h2>
                </div>
                <p className="text-slate-400 text-sm mb-4">Jump straight into the AI research chat to ask questions across your indexed documents.</p>
                <button onClick={() => navigate('/app/research')} className="btn-primary">
                    Start Researching <ChevronRight size={16} />
                </button>
            </div>

            {/* Recent activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-slate-100">Recent Queries</h2>
                        <button onClick={() => navigate('/app/research')} className="text-xs text-gold-400 hover:text-gold-300 transition-colors">View all →</button>
                    </div>
                    {recentHistory?.items?.length ? (
                        <div className="space-y-3">
                            {recentHistory.items.map((item) => (
                                <div key={item._id} className="flex items-start gap-3 p-3 bg-navy-800/50 rounded-lg hover:bg-navy-800 transition-colors cursor-pointer"
                                    onClick={() => navigate('/app/research')}>
                                    <Scale size={14} className="text-gold-400 mt-0.5 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm text-slate-200 truncate font-medium">{item.query}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{item.documentTitle} · {new Date(item.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">
                            <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No queries yet</p>
                            <button onClick={() => navigate('/app/research')} className="text-xs text-gold-400 mt-2 hover:underline">Ask your first question →</button>
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-slate-100">Top Documents</h2>
                        <button onClick={() => navigate('/app/library')} className="text-xs text-gold-400 hover:text-gold-300 transition-colors">Manage →</button>
                    </div>
                    {historyData?.topDocuments?.length ? (
                        <div className="space-y-3">
                            {historyData.topDocuments.map((doc) => (
                                <div key={doc._id} className="flex items-center justify-between p-3 bg-navy-800/50 rounded-lg">
                                    <span className="text-sm text-slate-200 truncate pr-3">{doc._id}</span>
                                    <span className="badge-gold flex-shrink-0">{doc.count} queries</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">
                            <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No documents queried yet</p>
                            <button onClick={() => navigate('/app/library')} className="text-xs text-gold-400 mt-2 hover:underline">Upload a document →</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
