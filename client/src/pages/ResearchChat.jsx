import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { Send, Scale, ChevronDown, ExternalLink, BookOpen, Loader, Trash2, Info, X } from 'lucide-react';

const STORAGE_KEY = 'JurisAi_chat_state';

function SourceBadge({ source, index }) {
    const page = source.page ? `Page ${source.page}` : null;
    return (
        <div className="p-3 bg-navy-800/60 rounded-lg border border-navy-600 hover:border-gold-500/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gold-400">Source [{index + 1}]</span>
                {page && <span className="text-xs text-slate-400 bg-navy-700 px-2 py-0.5 rounded-full">{page}</span>}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{source.text}</p>
        </div>
    );
}

function ChatBubble({ msg }) {
    const isUser = msg.role === 'user';
    return (
        <div className={`flex gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
        ${isUser ? 'bg-gold-500 text-navy-950' : 'bg-navy-700 border border-navy-600'}`}>
                {isUser ? 'U' : <Scale size={14} className="text-gold-400" />}
            </div>
            <div className={`max-w-2xl flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm ${isUser
                    ? 'bg-gold-500/15 border border-gold-500/20 text-slate-200 rounded-tr-none'
                    : 'bg-navy-800 border border-navy-700 text-slate-200 rounded-tl-none'}`}>
                    {isUser ? (
                        <p>{msg.content}</p>
                    ) : (
                        <div className="prose-legal text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                            {msg.streaming && (
                                <span className="inline-block w-2 h-4 bg-gold-400 animate-pulse ml-0.5 align-middle" />
                            )}
                        </div>
                    )}
                </div>
                {!msg.streaming && msg.sources?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-1">
                        {msg.sources.map((src, i) => (
                            <span key={i} className="text-xs bg-gold-500/10 text-gold-400 border border-gold-500/20 px-2 py-0.5 rounded-full">
                                {src.page ? `p.${src.page}` : `[${i + 1}]`}
                            </span>
                        ))}
                        <span className="text-xs text-slate-500">{msg.sources.length} source{msg.sources.length > 1 ? 's' : ''} cited</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ResearchChat() {
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [activeSources, setActiveSources] = useState([]);
    const [showBanner, setShowBanner] = useState(() => !sessionStorage.getItem('JurisAi_chat_banner_dismissed'));
    const bottomRef = useRef(null);
    const abortRef = useRef(null);

    const { data: docs } = useQuery({
        queryKey: ['documents'],
        queryFn: () => api.get('/documents').then(r => r.data),
    });

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (saved.messages) setMessages(saved.messages);
            if (saved.activeSources) setActiveSources(saved.activeSources);
            if (saved.selectedDocBookName && docs) {
                const doc = docs.find(d => d.bookName === saved.selectedDocBookName);
                if (doc) setSelectedDoc(doc);
            }
        } catch { }
    }, [docs]);

    useEffect(() => {
        if (messages.length === 0 && !selectedDoc) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                messages: messages.filter(m => !m.streaming),
                activeSources,
                selectedDocBookName: selectedDoc?.bookName || null,
            }));
        } catch { }
    }, [messages, activeSources, selectedDoc]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleDocChange = useCallback((doc) => {
        setSelectedDoc(doc);
        setActiveSources([]);
        const welcome = {
            role: 'assistant',
            content: `**${doc.title}** is ready for research.\n\nAsk any legal question and I will provide source-cited answers from this document only.`,
            sources: [],
        };
        setMessages([welcome]);
    }, []);

    const clearChat = () => {
        setMessages([]);
        setActiveSources([]);
        setSelectedDoc(null);
        localStorage.removeItem(STORAGE_KEY);
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedDoc || streaming) return;
        if (!selectedDoc?.ingested) {
            toast.error('Document is still being prepared. Please wait a moment.');
            return;
        }

        const userQuery = input.trim();
        setMessages(m => [...m, { role: 'user', content: userQuery }]);
        setInput('');
        setStreaming(true);
        setActiveSources([]);

        setMessages(m => [...m, { role: 'assistant', content: '', sources: [], streaming: true }]);

        const token = localStorage.getItem('JurisAi_token');
        const url = `https://jurisai-rag-ai-legal-research-assistant.onrender.com/api/query/stream?bookName=${encodeURIComponent(selectedDoc.bookName)}&query=${encodeURIComponent(userQuery)}&topK=5`;

        const controller = new AbortController();
        abortRef.current = controller;
        let localSources = [];

        try {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
            });

            if (!response.ok) throw new Error(`Server error: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const parsed = JSON.parse(line.slice(6));
                        if (parsed.type === 'sources') {
                            localSources = parsed.sources;
                            setActiveSources(parsed.sources);
                        } else if (parsed.type === 'token') {
                            setMessages(m => {
                                const updated = [...m];
                                const last = updated[updated.length - 1];
                                if (last?.role === 'assistant') {
                                    updated[updated.length - 1] = { ...last, content: last.content + parsed.content };
                                }
                                return updated;
                            });
                        } else if (parsed.type === 'done') {
                            setMessages(m => {
                                const updated = [...m];
                                const last = updated[updated.length - 1];
                                if (last?.role === 'assistant') {
                                    updated[updated.length - 1] = { ...last, streaming: false, sources: localSources };
                                }
                                return updated;
                            });
                        } else if (parsed.type === 'error') {
                            toast.error(parsed.content);
                            setMessages(m => {
                                const updated = [...m];
                                updated[updated.length - 1] = { role: 'assistant', content: parsed.content, sources: [], streaming: false };
                                return updated;
                            });
                        }
                    } catch { }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                toast.error('Connection failed. Are both servers running?');
                setMessages(m => {
                    const updated = [...m];
                    updated[updated.length - 1] = {
                        role: 'assistant',
                        content: 'Could not reach the server. Please ensure the Express server and FastAPI are both running.',
                        sources: [],
                        streaming: false,
                    };
                    return updated;
                });
            }
        } finally {
            setStreaming(false);
            setMessages(m => {
                const updated = [...m];
                const last = updated[updated.length - 1];
                if (last?.streaming) updated[updated.length - 1] = { ...last, streaming: false };
                return updated;
            });
        }
    };

    const suggestions = [
        'What are the key obligations of each party?',
        'Who bears liability and under what conditions?',
        'Define the key legal terms in this document',
        'Summarize this document — parties, issue, ruling, consequences',
        'What actions are prohibited?',
        'What penalties or remedies are specified?',
    ];

    return (
        <div className="h-full flex">
            <div className="flex-1 flex flex-col min-w-0">
                <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-navy-700 flex flex-wrap items-center gap-2 sm:gap-4 bg-navy-900/50 flex-shrink-0">
                    <Scale size={20} className="text-gold-400 flex-shrink-0 hidden sm:block" />
                    <div className="flex-1 min-w-0">
                        <h1 className="font-semibold text-slate-100 text-sm sm:text-base">Legal Research Chat</h1>
                        <p className="text-xs text-slate-500 hidden sm:block">Answers are cited directly from the selected document</p>
                    </div>
                    {messages.length > 0 && (
                        <button onClick={clearChat} className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10" title="Clear chat">
                            <Trash2 size={15} />
                        </button>
                    )}
                    <div className="relative w-full sm:w-auto sm:flex-shrink-0 order-last sm:order-none">
                        <select
                            className="input py-2 pr-8 text-sm appearance-none cursor-pointer w-full sm:min-w-[200px]"
                            value={selectedDoc?.bookName || ''}
                            onChange={(e) => {
                                const doc = docs?.find(d => d.bookName === e.target.value);
                                if (doc) handleDocChange(doc);
                            }}
                        >
                            <option value="">Select document</option>
                            {docs?.map(d => (
                                <option key={d.bookName} value={d.bookName} disabled={!d.ingested}>
                                    {d.title}{!d.ingested ? ' (preparing...)' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5">
                    {/* Cold start banner */}
                    {showBanner && (
                        <div className="flex items-start gap-3 rounded-lg bg-gold-500/10 border border-gold-500/20 px-4 py-3">
                            <Info size={18} className="text-gold-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gold-400">First query may be slow</p>
                                <p className="text-xs text-slate-400 mt-0.5">Our AI model may take up to a minute to respond on the first query as it wakes up. After that, responses will be much faster.</p>
                            </div>
                            <button onClick={() => { setShowBanner(false); sessionStorage.setItem('JurisAi_chat_banner_dismissed', '1'); }} className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {!selectedDoc && messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-4">
                                <BookOpen size={28} className="text-gold-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-200 mb-2">Select a Document</h2>
                            <p className="text-slate-400 text-sm max-w-xs">
                                Choose an indexed legal document from the dropdown above, then ask any legal question.
                            </p>
                            {docs?.length === 0 && (
                                <p className="text-xs text-slate-600 mt-4">
                                    No documents yet — upload one in the{' '}
                                    <a href="/app/library" className="text-gold-400 hover:underline">Library</a>
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                            {streaming && messages[messages.length - 1]?.content === '' && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-navy-700 border border-navy-600 flex items-center justify-center">
                                        <Scale size={14} className="text-gold-400" />
                                    </div>
                                    <div className="bg-navy-800 border border-navy-700 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                                        <Loader size={13} className="animate-spin text-gold-400" />
                                        <span className="text-xs text-slate-400">Searching document and generating answer...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </>
                    )}
                </div>

                {selectedDoc && messages.length <= 1 && (
                    <div className="px-3 sm:px-6 pb-3 flex gap-2 flex-wrap flex-shrink-0">
                        {suggestions.map((s) => (
                            <button key={s} onClick={() => setInput(s)}
                                className="text-xs bg-navy-800 border border-navy-600 hover:border-gold-500/40 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-full transition-all">
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-navy-700 flex-shrink-0">
                    <form onSubmit={sendMessage} className="flex gap-3">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={selectedDoc ? 'Ask a legal question...' : 'Select a document first'}
                            className="input flex-1"
                            disabled={!selectedDoc || streaming}
                        />
                        <button
                            type="submit"
                            className="btn-primary px-4 py-2.5 flex-shrink-0"
                            disabled={!input.trim() || !selectedDoc || streaming}
                        >
                            {streaming ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </form>
                </div>
            </div>

            {activeSources.length > 0 && (
                <div className="hidden lg:flex w-72 xl:w-80 border-l border-navy-700 bg-navy-900/50 flex-col flex-shrink-0">
                    <div className="px-4 py-4 border-b border-navy-700 flex items-center gap-2">
                        <ExternalLink size={15} className="text-gold-400" />
                        <span className="font-medium text-sm text-slate-200">Document Sources</span>
                        <span className="ml-auto text-xs bg-gold-500/10 text-gold-400 border border-gold-500/20 px-2 py-0.5 rounded-full">{activeSources.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {activeSources.map((src, i) => <SourceBadge key={src.id} source={src} index={i} />)}
                    </div>
                </div>
            )}
        </div>
    );
}
