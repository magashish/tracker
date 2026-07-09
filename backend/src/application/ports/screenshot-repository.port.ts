import { Screenshot } from '../../domain/entities/screenshot';

export interface CreateScreenshotInput {
  sessionId: string;
  employeeId: string;
  deviceId: string;
  storageKey: string;
  capturedAt: Date;
  activityPercent?: number;
  appName?: string;
  windowTitle?: string;
  fileSizeBytes?: number;
}

export interface ScreenshotRepository {
  create(input: CreateScreenshotInput): Promise<Screenshot>;
  findById(id: string): Promise<Screenshot | null>;
  confirmUploaded(id: string): Promise<void>;
  setBlurred(id: string, blurred: boolean): Promise<void>;
  query(params: {
    employeeId?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }): Promise<{ items: Screenshot[]; total: number }>;
  findOlderThan(cutoff: Date, limit: number): Promise<Screenshot[]>;
  deleteById(id: string): Promise<void>;
}
