import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <App />
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            style: { background: '#0f2040', color: '#e2e8f0', border: '1px solid #162a54' },
                            success: { iconTheme: { primary: '#d4af37', secondary: '#040d1a' } },
                        }}
                    />
                </AuthProvider>
            </QueryClientProvider>
        </BrowserRouter>
    </React.StrictMode>
);
