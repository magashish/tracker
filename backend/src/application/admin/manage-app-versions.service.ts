import { AppVersionRepository } from '../ports/app-version-repository.port';
import { NewAppVersion, Platform } from '../../domain/entities/app-version';

export class ManageAppVersionsService {
  constructor(private readonly versions: AppVersionRepository) {}

  getLatest(platform: Platform) {
    return this.versions.findLatest(platform);
  }

  publish(version: NewAppVersion) {
    return this.versions.create(version);
  }

  list(platform?: Platform) {
    return this.versions.list(platform);
  }
}
