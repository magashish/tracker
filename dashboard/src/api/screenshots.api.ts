import { apiRequestPaginated, apiRequest } from './client';
import { Screenshot } from '../types/api';

export function listScreenshots(params: { employeeId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
  return apiRequestPaginated<Screenshot>('/screenshots', { query: params });
}

export function blurScreenshot(screenshotId: string, blurred: boolean) {
  return apiRequest<{ updated: true }>(`/screenshots/${screenshotId}/blur`, { method: 'PATCH', body: { blurred } });
}
