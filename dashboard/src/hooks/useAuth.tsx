import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getTokens, onAuthChange } from '../api/client';
import { loginAdmin, logoutAdmin } from '../api/auth.api';
import { AdminSession, Role } from '../types/api';

interface AuthState {
  isAuthenticated: boolean;
  admin: AdminSession['admin'] | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (minimumRole: Role) => boolean;
}

const ROLE_LEVEL: Record<Role, number> = { viewer: 0, manager: 1, admin: 2, owner: 3 };
const ADMIN_KEY = 'tracker.admin.profile';

const AuthContext = createContext<AuthState | null>(null);

function loadAdmin(): AdminSession['admin'] | null {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession['admin'];
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminSession['admin'] | null>(() => (getTokens() ? loadAdmin() : null));

  useEffect(() => {
    return onAuthChange((tokens) => {
      if (!tokens) {
        setAdmin(null);
        localStorage.removeItem(ADMIN_KEY);
      }
    });
  }, []);

  const login = async (email: string, password: string) => {
    const session = await loginAdmin(email, password);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(session.admin));
    setAdmin(session.admin);
  };

  const logout = async () => {
    const tokens = getTokens();
    if (tokens) await logoutAdmin(tokens.refreshToken);
    localStorage.removeItem(ADMIN_KEY);
    setAdmin(null);
  };

  const hasRole = (minimumRole: Role) => (admin ? ROLE_LEVEL[admin.role] >= ROLE_LEVEL[minimumRole] : false);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!admin, admin, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
