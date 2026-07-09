export type PrincipalType = 'employee' | 'admin';

export interface RefreshTokenRecord {
  id: string;
  principalType: PrincipalType;
  principalId: string;
  deviceId: string | null;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

export interface RefreshTokenRepository {
  create(record: {
    principalType: PrincipalType;
    principalId: string;
    deviceId?: string | null;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  rotate(oldId: string, newRecordId: string): Promise<void>;
  revoke(id: string): Promise<void>;
  revokeAllForPrincipal(principalType: PrincipalType, principalId: string): Promise<void>;
}
