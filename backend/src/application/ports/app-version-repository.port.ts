import { AppVersion, NewAppVersion, Platform } from '../../domain/entities/app-version';

export interface AppVersionRepository {
  findLatest(platform: Platform): Promise<AppVersion | null>;
  create(version: NewAppVersion): Promise<AppVersion>;
  list(platform?: Platform): Promise<AppVersion[]>;
}
