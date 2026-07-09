import { apiRequest, apiRequestPaginated } from './client';
import { Employee } from '../types/api';

export function listEmployees(params: { search?: string; status?: string; page?: number; pageSize?: number }) {
  return apiRequestPaginated<Employee>('/admin/employees', { query: params });
}

export function createEmployee(input: { email: string; fullName: string; password: string; team?: string }) {
  return apiRequest<Employee>('/admin/employees', { method: 'POST', body: input });
}

export function updateEmployee(
  employeeId: string,
  patch: { fullName?: string; team?: string; status?: Employee['status'] }
) {
  return apiRequest<Employee>(`/admin/employees/${employeeId}`, { method: 'PATCH', body: patch });
}
