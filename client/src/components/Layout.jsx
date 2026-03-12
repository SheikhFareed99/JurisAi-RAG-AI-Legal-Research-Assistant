import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Scale, LayoutDashboard, MessageSquare, BookOpen, BarChart2, LogOut, User, Clock, Menu, X } from 'lucide-react';

const navItems = [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/research', label: 'Research', icon: MessageSquare },
    { to: '/app/library', label: 'Library', icon: BookOpen },
    { to: '/app/history', label: 'History', icon: Clock },
    { to: '/app/analytics', label: 'Analytics', icon: BarChart2 },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const sidebarContent = (
        <>
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-700">
                <div className="w-9 h-9 rounded-lg bg-gold-500 flex items-center justify-center flex-shrink-0">
                    <Scale size={18} className="text-navy-950" />
                </div>
                <div>
                    <h1 className="font-bold text-slate-100 text-lg leading-none">JurisAi</h1>
                    <p className="text-xs text-slate-500 mt-0.5">Legal Research</p>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="ml-auto md:hidden text-slate-400 hover:text-slate-100 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
                    >
                        <Icon size={18} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* User footer */}
            <div className="p-3 border-t border-navy-700">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-navy-800/50">
                    <div className="w-8 h-8 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                        <User size={15} className="text-gold-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Logout">
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Mobile topbar */}
            <div className="fixed top-0 left-0 right-0 z-40 md:hidden flex items-center gap-3 px-4 py-3 border-b border-navy-700 bg-navy-900">
                <button onClick={() => setSidebarOpen(true)} className="text-slate-300 hover:text-slate-100 transition-colors">
                    <Menu size={22} />
                </button>
                <div className="w-7 h-7 rounded-md bg-gold-500 flex items-center justify-center">
                    <Scale size={14} className="text-navy-950" />
                </div>
                <span className="font-bold text-slate-100">JurisAi</span>
            </div>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
                    <aside className="relative w-64 h-full flex flex-col bg-navy-900 border-r border-navy-700 z-10">
                        {sidebarContent}
                    </aside>
                </div>
            )}

            {/* Desktop sidebar */}
            <aside className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-navy-700 bg-navy-900">
                {sidebarContent}
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
                <Outlet />
            </main>
        </div>
    );
}
