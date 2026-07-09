import { v4 as uuid } from 'uuid';
import { ScreenshotRepository } from '../ports/screenshot-repository.port';
import { ScreenshotStorage } from '../ports/screenshot-storage.port';

const UPLOAD_URL_TTL_SECONDS = 300;

export interface CreateUploadUrlInput {
  sessionId: string;
  employeeId: string;
  deviceId: string;
  capturedAt: Date;
  activityPercent?: number;
  appName?: string;
  windowTitle?: string;
  fileSizeBytes?: number;
}

export interface CreateUploadUrlResult {
  screenshotId: string;
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
}

export class CreateUploadUrlService {
  constructor(
    private readonly screenshots: ScreenshotRepository,
    private readonly storage: ScreenshotStorage
  ) {}

  async execute(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const screenshotId = uuid();
    const storageKey = this.storage.buildStorageKey(input.employeeId, input.capturedAt, screenshotId);

    const screenshot = await this.screenshots.create({
      sessionId: input.sessionId,
      employeeId: input.employeeId,
      deviceId: input.deviceId,
      storageKey,
      capturedAt: input.capturedAt,
      activityPercent: input.activityPercent,
      appName: input.appName,
      windowTitle: input.windowTitle,
      fileSizeBytes: input.fileSizeBytes,
    });

    const uploadUrl = await this.storage.createUploadUrl(storageKey, UPLOAD_URL_TTL_SECONDS);

    return {
      screenshotId: screenshot.id,
      uploadUrl,
      storageKey,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    };
  }
}
