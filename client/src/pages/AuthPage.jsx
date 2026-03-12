import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Scale, Eye, EyeOff, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuthPage() {
    const [searchParams] = useSearchParams();
    const [mode, setMode] = useState(searchParams.get('mode') === 'register' ? 'register' : 'login');
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
            const payload = mode === 'login' ? { email: form.email, password: form.password } : form;
            const { data } = await api.post(endpoint, payload);
            login(data.token, data.user);
            toast.success(`Welcome${mode === 'register' ? ', ' + data.user.name : ' back'}!`);
            navigate('/app/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-16">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md animate-slide-up relative">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gold-500 flex items-center justify-center mx-auto mb-4 shadow-lg"
                        style={{ boxShadow: '0 0 40px rgba(212,175,55,0.3)' }}>
                        <Scale size={26} className="text-navy-950" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-100">JurisAi</h1>
                    <p className="text-slate-400 text-sm mt-1">AI-Powered Legal Research</p>
                </div>

                <div className="card">
                    {/* Tabs */}
                    <div className="flex bg-navy-800 rounded-lg p-1 mb-6">
                        {['login', 'register'].map((m) => (
                            <button key={m} onClick={() => setMode(m)}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 capitalize
                  ${mode === m ? 'bg-gold-500 text-navy-950' : 'text-slate-400 hover:text-slate-200'}`}>
                                {m === 'login' ? 'Sign In' : 'Create Account'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        {mode === 'register' && (
                            <div>
                                <label className="text-sm text-slate-400 mb-1.5 block font-medium">Full Name</label>
                                <input name="name" value={form.name} onChange={handle} placeholder="John Doe"
                                    className="input" required />
                            </div>
                        )}
                        <div>
                            <label className="text-sm text-slate-400 mb-1.5 block font-medium">Email</label>
                            <input name="email" type="email" value={form.email} onChange={handle}
                                placeholder="you@lawfirm.com" className="input" required />
                        </div>
                        <div>
                            <label className="text-sm text-slate-400 mb-1.5 block font-medium">Password</label>
                            <div className="relative">
                                <input name="password" type={showPw ? 'text' : 'password'} value={form.password}
                                    onChange={handle} placeholder="••••••••" className="input pr-10" required />
                                <button type="button" onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="btn-primary w-full justify-center mt-2 py-3" disabled={loading}>
                            {loading ? <Loader size={16} className="animate-spin" /> : null}
                            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-slate-500 mt-5">
                        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                        <button className="text-gold-400 hover:text-gold-300 font-medium transition-colors"
                            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                            {mode === 'login' ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
