import { createHmac, timingSafeEqual } from 'node:crypto';

export type StorageUrlPurpose = 'upload' | 'view';

export interface SignedStorageToken {
  key: string;
  purpose: StorageUrlPurpose;
  expiresAt: number;
  token: string;
}

// Same role a presigned S3 URL would play: a short-lived, tamper-proof
// credential scoped to one object key and one operation, without needing a
// full JWT/session on the raw file transfer endpoints.
export class SignedStorageUrlService {
  constructor(private readonly secret: string) {}

  sign(key: string, purpose: StorageUrlPurpose, expiresInSeconds: number): SignedStorageToken {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const token = this.computeSignature(key, purpose, expiresAt);
    return { key, purpose, expiresAt, token };
  }

  verify(key: string, purpose: StorageUrlPurpose, expiresAt: number, token: string): boolean {
    if (Date.now() > expiresAt) return false;
    const expected = this.computeSignature(key, purpose, expiresAt);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private computeSignature(key: string, purpose: StorageUrlPurpose, expiresAt: number): string {
    return createHmac('sha256', this.secret).update(`${purpose}:${key}:${expiresAt}`).digest('hex');
  }
}
