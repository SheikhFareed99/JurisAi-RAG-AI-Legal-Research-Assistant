import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ResearchChat from './pages/ResearchChat';
import DocumentLibrary from './pages/DocumentLibrary';
import Analytics from './pages/Analytics';
import HistoryPage from './pages/HistoryPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? children : <Navigate to="/auth" replace />;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route
                path="/app"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="research" element={<ResearchChat />} />
                <Route path="library" element={<DocumentLibrary />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="history" element={<HistoryPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
