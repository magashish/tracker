import { apiRequest } from './client';
import { LiveEmployee, EmployeeDaySummary, EmployeeTimeline } from '../types/api';

export function getLiveEmployees() {
  return apiRequest<LiveEmployee[]>('/dashboard/live');
}

export function getEmployeeSummary(employeeId: string, date?: string) {
  return apiRequest<EmployeeDaySummary>(`/dashboard/employees/${employeeId}/summary`, { query: { date } });
}

export function getEmployeeTimeline(employeeId: string, date?: string) {
  return apiRequest<EmployeeTimeline>(`/dashboard/employees/${employeeId}/timeline`, { query: { date } });
}
