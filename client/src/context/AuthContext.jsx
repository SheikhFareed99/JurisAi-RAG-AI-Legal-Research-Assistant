import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('JurisAi_user')); } catch { return null; }
    });

    const login = useCallback((token, userData) => {
        localStorage.setItem('JurisAi_token', token);
        localStorage.setItem('JurisAi_user', JSON.stringify(userData));
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('JurisAi_token');
        localStorage.removeItem('JurisAi_user');
        localStorage.removeItem('JurisAi_chat_state');
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
