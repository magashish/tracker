import { apiRequest } from './client';
import { Admin, RoleDefinition, EffectiveConfig, AuditLog } from '../types/api';

export function listAdmins() {
  return apiRequest<Admin[]>('/admin/admins');
}

export function listRoles() {
  return apiRequest<RoleDefinition[]>('/admin/roles');
}

export function createAdmin(input: { email: string; fullName: string; password: string; roleName: string }) {
  return apiRequest<Admin>('/admin/admins', { method: 'POST', body: input });
}

export function updateAdmin(adminId: string, patch: { fullName?: string; status?: Admin['status']; roleName?: string }) {
  return apiRequest<Admin>(`/admin/admins/${adminId}`, { method: 'PATCH', body: patch });
}

export function getGlobalConfig() {
  return apiRequest<EffectiveConfig>('/config/global');
}

export function updateGlobalConfig(config: Partial<EffectiveConfig>) {
  return apiRequest<EffectiveConfig>('/config/global', { method: 'PUT', body: config });
}

export function listAuditLogs(params: { page?: number; pageSize?: number } = {}) {
  return apiRequest<AuditLog[]>('/audit-logs', { query: params });
}
