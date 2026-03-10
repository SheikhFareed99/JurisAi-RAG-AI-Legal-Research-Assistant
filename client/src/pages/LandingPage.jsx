import { useNavigate } from 'react-router-dom';
import { Scale, Zap, Shield, Clock, ChevronRight, CheckCircle } from 'lucide-react';

const features = [
    { icon: Zap, title: 'Instant Answers', desc: 'Ask legal questions and get cited answers from indexed case law in seconds, not hours.' },
    { icon: Shield, title: 'Source-Verified', desc: 'Every answer is grounded in your uploaded documents — no hallucinations, no fabricated citations.' },
    { icon: Clock, title: 'Save 90% Time', desc: 'Cut research time from 6+ hours to under a minute. Focus on strategy, not searching.' },
];


export default function LandingPage() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen">
            {/* Navbar */}
            <nav className="glass sticky top-0 z-50 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gold-500 flex items-center justify-center">
                        <Scale size={16} className="text-navy-950" />
                    </div>
                    <span className="font-bold text-xl text-slate-100">LexAI</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/auth')} className="btn-ghost text-sm">Sign in</button>
                    <button onClick={() => navigate('/auth')} className="btn-primary text-sm">Get Started <ChevronRight size={16} /></button>
                </div>
            </nav>

            {/* Hero */}
            <section className="max-w-6xl mx-auto px-8 pt-28 pb-20 text-center animate-fade-in">
                <div className="badge-gold text-xs mb-6 mx-auto flex items-center gap-1.5 w-fit px-3 py-1.5">
                    <Zap size={12} /> Powered by Retrieval-Augmented Generation
                </div>
                <h1 className="text-5xl md:text-7xl font-extrabold text-slate-100 leading-tight mb-6">
                    Legal Research,<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">
                        Reimagined with AI
                    </span>
                </h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                    Ask questions across case law, contracts, and statutes — and get accurate,
                    source-cited answers in seconds. Built for lawyers who value precision and speed.
                </p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                    <button onClick={() => navigate('/auth')} className="btn-primary text-base px-8 py-3">
                        Start Free Trial <ChevronRight size={18} />
                    </button>
                    <button onClick={() => navigate('/auth')} className="btn-secondary text-base px-8 py-3">
                        View Demo
                    </button>
                </div>

                {/* Stats */}
                <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
                    {[['90%', 'Time saved'], ['0', 'Hallucinations'], ['< 5s', 'Answer latency']].map(([val, label]) => (
                        <div key={label} className="text-center">
                            <div className="text-3xl font-bold text-gold-400">{val}</div>
                            <div className="text-xs text-slate-500 mt-1">{label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section className="max-w-6xl mx-auto px-8 py-20">
                <h2 className="text-3xl font-bold text-center text-slate-100 mb-12">
                    Why lawyers choose JurisAi
                </h2>
                <div className="grid md:grid-cols-3 gap-6">
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
        
            {/* Footer */}
            <footer className="border-t border-navy-700 py-8 text-center text-slate-500 text-sm">
                © 2026 JurisAi · Built with FastAPI · Pinecone · Groq · React
            </footer>
        </div>
    );
}
