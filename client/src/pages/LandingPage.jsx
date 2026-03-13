import { useNavigate } from 'react-router-dom';
import { Scale, Zap, Shield, Clock, ChevronRight, CheckCircle, Upload, MessageSquare, BookOpen, Search } from 'lucide-react';

const features = [
    { icon: Zap, title: 'Instant Answers', desc: 'Ask legal questions and get cited answers from indexed case law in seconds, not hours.' },
    { icon: Shield, title: 'Source-Verified', desc: 'Every answer is grounded in your uploaded documents — no hallucinations, no fabricated citations.' },
    { icon: Clock, title: 'Save 90% Time', desc: 'Cut research time from 6+ hours to under a minute. Focus on strategy, not searching.' },
];

const steps = [
    { icon: Upload, step: '01', title: 'Upload Documents', desc: 'Upload your legal documents — PDFs, DOCX, TXT, or PPTX. They are securely stored and indexed.' },
    { icon: Search, step: '02', title: 'AI Indexes & Chunks', desc: 'Our RAG pipeline breaks documents into searchable chunks and stores them in a vector database.' },
    { icon: MessageSquare, step: '03', title: 'Ask Questions', desc: 'Ask any legal question in natural language. The AI retrieves relevant sections and generates cited answers.' },
    { icon: BookOpen, step: '04', title: 'Get Cited Answers', desc: 'Every answer comes with source citations pointing back to the exact sections in your documents.' },
];


export default function LandingPage() {
    const navigate = useNavigate();
    const goSignup = () => navigate('/auth?mode=register');

    return (
        <div className="min-h-screen">
            {/* Navbar */}
            <nav className="glass sticky top-0 z-50 px-4 sm:px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gold-500 flex items-center justify-center">
                        <Scale size={16} className="text-navy-950" />
                    </div>
                    <span className="font-bold text-xl text-slate-100">LexAI</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <button onClick={() => navigate('/auth')} className="btn-ghost text-sm">Sign in</button>
                    <button onClick={goSignup} className="btn-primary text-sm">
                        <span className="hidden sm:inline">Get Started</span>
                        <span className="sm:hidden">Start</span>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </nav>

            {/* Hero */}
            <section className="max-w-6xl mx-auto px-4 sm:px-8 pt-16 sm:pt-28 pb-16 sm:pb-20 text-center animate-fade-in">
                <div className="badge-gold text-xs mb-6 mx-auto flex items-center gap-1.5 w-fit px-3 py-1.5">
                    <Zap size={12} /> Powered by Retrieval-Augmented Generation
                </div>
                <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold text-slate-100 leading-tight mb-6">
                    Legal Research,<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">
                        Reimagined with AI
                    </span>
                </h1>
                <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                    Ask questions across case law, contracts, and statutes — and get accurate,
                    source-cited answers in seconds. Built for lawyers who value precision and speed.
                </p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                    <button onClick={goSignup} className="btn-primary text-base px-8 py-3">
                        Get Started <ChevronRight size={18} />
                    </button>
                </div>

                {/* Stats */}
                <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-6 max-w-lg mx-auto">
                    {[['90%', 'Time saved'], ['0', 'Hallucinations'], ['< 5s', 'Answer latency']].map(([val, label]) => (
                        <div key={label} className="text-center">
                            <div className="text-2xl sm:text-3xl font-bold text-gold-400">{val}</div>
                            <div className="text-xs text-slate-500 mt-1">{label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
                <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-100 mb-10 sm:mb-12">
                    Why lawyers choose JurisAi
                </h2>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    {features.map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="card-hover animate-slide-up">
                            <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mb-4">
                                <Icon size={22} className="text-gold-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How It Works */}
            <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
                <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-100 mb-4">
                    How It Works
                </h2>
                <p className="text-slate-400 text-center max-w-xl mx-auto mb-10 sm:mb-14 text-sm sm:text-base">
                    From document upload to cited answers — in just a few steps.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {steps.map(({ icon: Icon, step, title, desc }) => (
                        <div key={step} className="relative card-hover text-center">
                            <div className="text-xs font-bold text-gold-500/50 mb-3">{step}</div>
                            <div className="w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mx-auto mb-4">
                                <Icon size={24} className="text-gold-400" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-100 mb-2">{title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Built With */}
            <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
                <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-100 mb-4">
                    Built on Modern AI Infrastructure
                </h2>
                <p className="text-slate-400 text-center max-w-xl mx-auto mb-10 sm:mb-14 text-sm sm:text-base">
                    JurisAi combines state-of-the-art language models with a reliable retrieval pipeline.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto">
                    {[
                        { name: 'FastAPI', desc: 'High-performance Python backend' },
                        { name: 'Pinecone', desc: 'Vector database for fast retrieval' },
                        { name: 'meta-llama/llama-3.1-8b-instruct', desc: 'Ultra-fast LLM inference' },
                        { name: 'React', desc: 'Modern responsive frontend' },
                    ].map(({ name, desc }) => (
                        <div key={name} className="card text-center py-6">
                            <div className="text-lg font-bold text-gold-400 mb-1">{name}</div>
                            <p className="text-xs text-slate-500">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-20 text-center">
                <div className="card py-12 sm:py-16 px-6 sm:px-12">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-4">
                        Ready to transform your legal research?
                    </h2>
                    <p className="text-slate-400 max-w-lg mx-auto mb-8 text-sm sm:text-base">
                        Upload your first document and get AI-powered, source-cited answers in seconds.
                    </p>
                    <button onClick={goSignup} className="btn-primary text-base px-8 py-3 mx-auto">
                        Get Started Now <ChevronRight size={18} />
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-navy-700 py-8 text-center text-slate-500 text-xs sm:text-sm px-4">
                © 2026 JurisAi · Built with FastAPI · Pinecone · OpenRouter · React
            </footer>
        </div>
    );
}
