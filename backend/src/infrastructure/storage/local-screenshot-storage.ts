import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ScreenshotStorage } from '../../application/ports/screenshot-storage.port';
import { SignedStorageUrlService } from '../security/signed-storage-url.service';

export class LocalScreenshotStorage implements ScreenshotStorage {
  constructor(
    private readonly rootDir: string,
    private readonly publicApiUrl: string,
    private readonly signer: SignedStorageUrlService
  ) {}

  buildStorageKey(employeeId: string, capturedAt: Date, screenshotId: string): string {
    const datePart = capturedAt.toISOString().slice(0, 10);
    return `employee/${employeeId}/${datePart}/${screenshotId}.jpg`;
  }

  async createUploadUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    const { token, expiresAt } = this.signer.sign(storageKey, 'upload', expiresInSeconds);
    const url = new URL('/api/v1/storage/upload', this.publicApiUrl);
    url.searchParams.set('key', storageKey);
    url.searchParams.set('token', token);
    url.searchParams.set('expiresAt', String(expiresAt));
    return url.toString();
  }

  async createViewUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    const { token, expiresAt } = this.signer.sign(storageKey, 'view', expiresInSeconds);
    const url = new URL('/api/v1/storage/view', this.publicApiUrl);
    url.searchParams.set('key', storageKey);
    url.searchParams.set('token', token);
    url.searchParams.set('expiresAt', String(expiresAt));
    return url.toString();
  }

  async deleteObject(storageKey: string): Promise<void> {
    const absolutePath = this.resolvePath(storageKey);
    await fs.unlink(absolutePath).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }

  /** Used only by the storage.routes.ts raw-file handlers, not by application code. */
  resolvePath(storageKey: string): string {
    const normalized = path.normalize(storageKey);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new Error('Invalid storage key');
    }
    return path.join(this.rootDir, normalized);
  }

  async writeFile(storageKey: string, data: Buffer): Promise<void> {
    const absolutePath = this.resolvePath(storageKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, data);
  }

  async readFile(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(storageKey));
  }
}
