import { apiRequest } from './client';
import { Device } from '../types/api';

export function listDevices(params: { employeeId?: string; status?: string } = {}) {
  return apiRequest<Device[]>('/devices', { query: params });
}

export function revokeDevice(deviceId: string) {
  return apiRequest<{ revoked: true }>(`/devices/${deviceId}/revoke`, { method: 'PATCH' });
}
