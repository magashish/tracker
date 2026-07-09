import { Pool } from 'pg';
import {
  RefreshTokenRepository,
  RefreshTokenRecord,
  PrincipalType,
} from '../../../application/ports/refresh-token-repository.port';

interface RefreshTokenRow {
  id: string;
  principal_type: PrincipalType;
  principal_id: string;
  device_id: string | null;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by: string | null;
}

function toRecord(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    principalType: row.principal_type,
    principalId: row.principal_id,
    deviceId: row.device_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    replacedBy: row.replaced_by,
  };
}

export class PostgresRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(record: {
    principalType: PrincipalType;
    principalId: string;
    deviceId?: string | null;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const { rows } = await this.pool.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (principal_type, principal_id, device_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [record.principalType, record.principalId, record.deviceId ?? null, record.tokenHash, record.expiresAt]
    );
    return toRecord(rows[0]!);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const { rows } = await this.pool.query<RefreshTokenRow>('SELECT * FROM refresh_tokens WHERE token_hash = $1', [
      tokenHash,
    ]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async rotate(oldId: string, newRecordId: string): Promise<void> {
    await this.pool.query('UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1', [
      oldId,
      newRecordId,
    ]);
  }

  async revoke(id: string): Promise<void> {
    await this.pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]);
  }

  async revokeAllForPrincipal(principalType: PrincipalType, principalId: string): Promise<void> {
    await this.pool.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE principal_type = $1 AND principal_id = $2 AND revoked_at IS NULL',
      [principalType, principalId]
    );
  }
}
