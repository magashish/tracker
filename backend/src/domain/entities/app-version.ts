export type Platform = 'windows' | 'linux';

export interface AppVersion {
  id: string;
  platform: Platform;
  version: string;
  downloadUrl: string;
  checksumSha256: string;
  releaseNotes: string | null;
  isMandatory: boolean;
  publishedAt: Date;
}

export type NewAppVersion = Omit<AppVersion, 'id' | 'publishedAt'>;
