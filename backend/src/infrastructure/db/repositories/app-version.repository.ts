import { Pool } from 'pg';
import { AppVersionRepository } from '../../../application/ports/app-version-repository.port';
import { AppVersion, NewAppVersion, Platform } from '../../../domain/entities/app-version';

interface AppVersionRow {
  id: string;
  platform: Platform;
  version: string;
  download_url: string;
  checksum_sha256: string;
  release_notes: string | null;
  is_mandatory: boolean;
  published_at: Date;
}

function toAppVersion(row: AppVersionRow): AppVersion {
  return {
    id: row.id,
    platform: row.platform,
    version: row.version,
    downloadUrl: row.download_url,
    checksumSha256: row.checksum_sha256,
    releaseNotes: row.release_notes,
    isMandatory: row.is_mandatory,
    publishedAt: row.published_at,
  };
}

export class PostgresAppVersionRepository implements AppVersionRepository {
  constructor(private readonly pool: Pool) {}

  async findLatest(platform: Platform): Promise<AppVersion | null> {
    const { rows } = await this.pool.query<AppVersionRow>(
      'SELECT * FROM app_versions WHERE platform = $1 ORDER BY published_at DESC LIMIT 1',
      [platform]
    );
    return rows[0] ? toAppVersion(rows[0]) : null;
  }

  async create(version: NewAppVersion): Promise<AppVersion> {
    const { rows } = await this.pool.query<AppVersionRow>(
      `INSERT INTO app_versions (platform, version, download_url, checksum_sha256, release_notes, is_mandatory)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [version.platform, version.version, version.downloadUrl, version.checksumSha256, version.releaseNotes, version.isMandatory]
    );
    return toAppVersion(rows[0]!);
  }

  async list(platform?: Platform): Promise<AppVersion[]> {
    if (platform) {
      const { rows } = await this.pool.query<AppVersionRow>(
        'SELECT * FROM app_versions WHERE platform = $1 ORDER BY published_at DESC',
        [platform]
      );
      return rows.map(toAppVersion);
    }
    const { rows } = await this.pool.query<AppVersionRow>('SELECT * FROM app_versions ORDER BY published_at DESC');
    return rows.map(toAppVersion);
  }
}
