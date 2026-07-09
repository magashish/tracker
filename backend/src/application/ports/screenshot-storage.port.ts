export interface ScreenshotStorage {
  buildStorageKey(employeeId: string, capturedAt: Date, screenshotId: string): string;
  createUploadUrl(storageKey: string, expiresInSeconds: number): Promise<string>;
  createViewUrl(storageKey: string, expiresInSeconds: number): Promise<string>;
  deleteObject(storageKey: string): Promise<void>;
}
