import { apiRequest, setAuthTokens } from './client';
import { AdminSession } from '../types/api';

export async function loginAdmin(email: string, password: string): Promise<AdminSession> {
  const session = await apiRequest<AdminSession>('/auth/admin/login', {
    method: 'POST',
    body: { email, password },
  });
  setAuthTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
  return session;
}

export async function logoutAdmin(refreshToken: string): Promise<void> {
  await apiRequest('/auth/admin/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
  setAuthTokens(null);
}
