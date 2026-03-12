import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { BookOpen, Plus, Trash2, Loader, CheckCircle, Clock, X, Search, Upload, FileText, Info } from 'lucide-react';

const CATEGORIES = ['Case Law', 'Statute', 'Contract', 'Regulation', 'Legal Opinion', 'Other'];
const BADGE_MAP = {
    'Case Law': 'badge-gold',
    'Statute': 'badge-blue',
    'Contract': 'badge-green',
    'Regulation': 'badge-purple',
    'Legal Opinion': 'badge-gold',
    'Other': 'badge text-slate-400 border border-slate-500/20',
};

function UploadModal({ onClose, onSuccess }) {
    const [form, setForm] = useState({ title: '', bookName: '', category: 'Case Law' });
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileRef = useRef();

    const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const pickFile = (f) => {
        if (!f) return;
        setFile(f);
        const name = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const slug = f.name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/\s+/g, '-');
        setForm(prev => ({
            ...prev,
            title: prev.title || name,
            bookName: prev.bookName || slug,
        }));
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        pickFile(e.dataTransfer.files[0]);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!file) return toast.error('Please select a file');
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('title', form.title);
            fd.append('bookName', form.bookName);
            fd.append('category', form.category);
            await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('Uploaded! Indexing in progress — ready in ~30 seconds.');
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="card w-full max-w-md relative z-10 animate-slide-up">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-100">Upload Legal Document</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-4">\n                    <div
                        onClick={() => fileRef.current.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
              ${dragging ? 'border-gold-500 bg-gold-500/5' : 'border-navy-600 hover:border-gold-500/50 hover:bg-navy-800/50'}`}
                    >
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.docx,.doc,.txt,.pptx"
                            className="hidden"
                            onChange={e => pickFile(e.target.files[0])}
                        />
                        {file ? (
                            <div className="flex items-center gap-3">
                                <FileText size={22} className="text-gold-400 flex-shrink-0" />
                                <div className="text-left flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Upload size={24} className="mx-auto mb-2 text-slate-500" />
                                <p className="text-sm text-slate-400 font-medium">
                                    Drop file here or <span className="text-gold-400">browse</span>
                                </p>
                                <p className="text-xs text-slate-600 mt-1">PDF, DOCX, TXT, PPTX — max 50 MB</p>
                            </>
                        )}
                    </div>

                    <div>
                        <label className="text-sm text-slate-400 mb-1.5 block">Document Title *</label>
                        <input
                            name="title"
                            value={form.title}
                            onChange={handle}
                            className="input"
                            placeholder="e.g. Smith v. Jones 2023"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm text-slate-400 mb-1.5 block">Unique ID *</label>
                        <input
                            name="bookName"
                            value={form.bookName}
                            onChange={handle}
                            className="input"
                            placeholder="e.g. smith-v-jones-2023"
                            required
                        />
                        <p className="text-xs text-slate-600 mt-1">No spaces. Auto-filled from filename.</p>
                    </div>

                    <div>
                        <label className="text-sm text-slate-400 mb-1.5 block">Category</label>
                        <select name="category" value={form.category} onChange={handle} className="input">
                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary flex-1 justify-center"
                            disabled={loading || !file}
                        >
                            {loading ? <Loader size={15} className="animate-spin" /> : <Upload size={15} />}
                            {loading ? 'Uploading...' : 'Upload & Index'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function DocumentLibrary() {
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const [showBanner, setShowBanner] = useState(() => !sessionStorage.getItem('JurisAi_lib_banner_dismissed'));
    const queryClient = useQueryClient();

    const { data: docs, isLoading } = useQuery({
        queryKey: ['documents'],
        queryFn: () => api.get('/documents').then(r => r.data),
        refetchInterval: 10000,
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/documents/${id}`),
        onSuccess: () => {
            toast.success('Document removed');
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        },
        onError: () => toast.error('Delete failed'),
    });

    const filtered = docs?.filter(d =>
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.category.toLowerCase().includes(search.toLowerCase())
    ) ?? [];

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            {/* Cold start banner */}
            {showBanner && (
                <div className="mb-4 flex items-start gap-3 rounded-lg bg-gold-500/10 border border-gold-500/20 px-4 py-3">
                    <Info size={18} className="text-gold-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gold-400">Document processing may take a moment</p>
                        <p className="text-xs text-slate-400 mt-0.5">This app runs on a free-tier server that sleeps after periods of inactivity. Your first upload or indexing request may take up to 60 seconds while the server wakes up. Subsequent operations will be noticeably faster.</p>
                    </div>
                    <button onClick={() => { setShowBanner(false); sessionStorage.setItem('JurisAi_lib_banner_dismissed', '1'); }} className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="section-title">Document Library</h1>
                    <p className="section-subtitle">
                        {docs?.length ?? 0} documents indexed in your legal knowledge base
                    </p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-primary">
                    <Plus size={16} /> Upload Document
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input pl-9"
                    placeholder="Search by title or category…"
                />
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-navy-800 border border-navy-700 flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={28} className="text-slate-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-300 mb-1">
                        {search ? 'No matching documents' : 'Your library is empty'}
                    </h3>
                    <p className="text-slate-500 text-sm mb-4">
                        {search ? 'Try a different search term' : 'Upload your first legal document to get started'}
                    </p>
                    {!search && (
                        <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">
                            <Plus size={16} /> Upload First Document
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(doc => (
                        <div key={doc._id} className="card-hover group relative flex flex-col">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <span className={BADGE_MAP[doc.category] || 'badge'}>{doc.category}</span>
                                <button
                                    onClick={() => deleteMutation.mutate(doc._id)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1 -mt-1 -mr-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            <h3 className="font-semibold text-slate-100 mb-1 leading-snug flex-1">{doc.title}</h3>
                            <p className="text-xs text-slate-500 font-mono mb-4">{doc.bookName}</p>

                            <div className="mt-auto">
                                <div className="divider mb-3" />
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        {doc.ingested ? (
                                            <>
                                                <CheckCircle size={12} className="text-emerald-400" />
                                                <span className="text-emerald-400">Ready</span>
                                            </>
                                        ) : (
                                            <>
                                                <Clock size={12} className="text-yellow-400 animate-pulse" />
                                                <span className="text-yellow-400">Preparing…</span>
                                            </>
                                        )}
                                    </div>
                                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                </div>
                                {doc.chunkCount > 0 && (
                                    <div className="text-xs text-slate-600 mt-1">{doc.chunkCount} sections processed</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <UploadModal
                    onClose={() => setShowModal(false)}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
                />
            )}
        </div>
    );
}
