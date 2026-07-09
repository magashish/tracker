export interface Screenshot {
  id: string;
  sessionId: string;
  employeeId: string;
  deviceId: string;
  storageKey: string;
  thumbnailKey: string | null;
  capturedAt: Date;
  uploadedAt: Date | null;
  activityPercent: number | null;
  appName: string | null;
  windowTitle: string | null;
  fileSizeBytes: number | null;
  isBlurred: boolean;
}
