import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clock, Scale, ChevronRight, Search, MessageSquare } from 'lucide-react';

function HistoryEntry({ item, onExpand, expanded }) {
    return (
        <div className="card-hover cursor-pointer" onClick={() => onExpand(item._id)}>
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Scale size={14} className="text-gold-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 leading-snug">{item.query}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">{item.documentTitle}</span>
                        <span className="text-slate-700">·</span>
                        <span className="text-xs text-slate-600">
                            {new Date(item.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                    </div>
                </div>
                <ChevronRight size={15} className={`text-slate-600 flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
            </div>

            {expanded && (
                <div className="mt-4 pt-4 border-t border-navy-700 animate-fade-in">
                    <div className="text-xs text-gold-400 font-medium mb-2 uppercase tracking-wide">Answer</div>
                    <div className="prose-legal text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.answer}</ReactMarkdown>
                    </div>
                    {item.sources?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-navy-700">
                            <div className="text-xs text-slate-500 mb-2">{item.sources.length} source{item.sources.length > 1 ? 's' : ''} cited</div>
                            <div className="space-y-2">
                                {item.sources.map((src, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="text-xs text-gold-400 font-mono flex-shrink-0 mt-0.5">[{i + 1}]</span>
                                        <p className="text-xs text-slate-500 line-clamp-2">{src.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function HistoryPage() {
    const [expandedId, setExpandedId] = useState(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['history', page],
        queryFn: () => api.get(`/history?page=${page}&limit=20`).then(r => r.data),
        keepPreviousData: true,
    });

    const toggle = (id) => setExpandedId(prev => (prev === id ? null : id));

    const filtered = data?.items?.filter(item =>
        item.query.toLowerCase().includes(search.toLowerCase()) ||
        item.documentTitle.toLowerCase().includes(search.toLowerCase())
    ) ?? [];

    return (
        <div className="p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="section-title">Research History</h1>
                    <p className="section-subtitle">
                        {data?.total ?? 0} saved queries across all documents
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-navy-800 px-3 py-2 rounded-lg border border-navy-700">
                    <Clock size={13} />
                    All queries saved automatically
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input pl-9"
                    placeholder="Search queries or documents…"
                />
            </div>

            {/* List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-navy-800 border border-navy-700 flex items-center justify-center mx-auto mb-4">
                        <MessageSquare size={28} className="text-slate-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-300 mb-1">
                        {search ? 'No matching queries' : 'No research history yet'}
                    </h3>
                    <p className="text-slate-500 text-sm">
                        {search ? 'Try a different search term' : 'Your queries will appear here after you use the Research Chat'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(item => (
                        <HistoryEntry
                            key={item._id}
                            item={item}
                            expanded={expandedId === item._id}
                            onExpand={toggle}
                        />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {data && data.pages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-8">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-slate-500">Page {page} of {data.pages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                        disabled={page === data.pages}
                        className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
